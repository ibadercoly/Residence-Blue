import { Injectable, signal, computed, effect, inject, Injector } from '@angular/core';
import { IdbService } from '../offline/idb.service';
import { OutboxService } from '../offline/outbox.service';
import { NetworkService } from '../offline/network.service';
import {
  RoomDto,
  CreateRoomDto,
  UpdateRoomDto,
  RoomStatus,
  RoomInterventionStatus,
  RoomInterventionRequestDto,
  RoomStatusStreamEvent,
  SEED_ROOMS,
  Role,
  isRoomStatusTransitionAllowed,
  getRoomImageUrl,
  getRoomImageAlt,
  FALLBACK_ROOM_IMAGE,
} from '@residence-blue/shared';
import { PlanningService } from './planning.service';
import { AuthService } from './auth.service';

export interface RoomUiItem extends RoomDto {
  syncPending?: boolean;
  image?: string;
  imageUrl?: string;
  imageAlt?: string;
  category?: string;
}

export interface RoomAlertItem {
  id: string;
  roomId: string;
  roomNumber: string;
  status: RoomStatus;
  previousStatus?: RoomStatus | null;
  reason?: string | null;
  message: string;
  timestamp: string;
  read: boolean;
}

export function formatRoomAlertMessage(
  roomNumber: string,
  status: RoomStatus,
  reason?: string | null,
): string {
  if (status === RoomStatus.FREE) {
    return `Chambre ${roomNumber} : propre, pr\u00eate \u00e0 louer`;
  }
  if (status === RoomStatus.MAINTENANCE) {
    const cleanReason = typeof reason === 'string' ? reason.trim() : '';
    return cleanReason
      ? `Chambre ${roomNumber} : probl\u00e8me signal\u00e9 (${cleanReason})`
      : `Chambre ${roomNumber} : probl\u00e8me signal\u00e9`;
  }
  if (status === RoomStatus.CLEANING) {
    return `Chambre ${roomNumber} : \u00e0 nettoyer`;
  }
  if (status === RoomStatus.OCCUPIED) {
    return `Chambre ${roomNumber} : occup\u00e9e`;
  }
  return `Chambre ${roomNumber} : \u00e9tat mis \u00e0 jour`;
}

@Injectable({
  providedIn: 'root',
})
export class RoomsService {
  private readonly injector = inject(Injector);

  readonly rooms = signal<RoomUiItem[]>([]);
  readonly currentRole = computed<Role>(() => this.authService?.currentRole() || Role.RECEPTION);
  readonly canViewAmounts = computed<boolean>(() => {
    if (!this.authService || typeof this.authService.hasPermission !== 'function') return true;
    return this.authService.hasPermission('voir_montants');
  });
  readonly selectedFilter = signal<string>('ALL');
  readonly selectedFloor = signal<number | null>(null);
  readonly selectedCategory = signal<string | null>(null);
  readonly searchQuery = signal<string>('');

  /** État du tiroir d'ajout / modification */
  readonly isDrawerOpen = signal<boolean>(false);
  readonly editingRoom = signal<RoomUiItem | null>(null);

  /** Animation de mise en évidence (ID de la chambre récemment ajoutée ou modifiée) */
  readonly justHighlightedRoomId = signal<string | null>(null);

  /** Alerte détaillée de conflit lors d'une tentative de désactivation */
  readonly deactivationConflictMessage = signal<string | null>(null);

  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  /** Demandes d'intervention technique en chambre (workflow validation Direction) */
  readonly interventions = signal<RoomInterventionRequestDto[]>([]);
  readonly pendingInterventions = computed(() =>
    this.interventions().filter((i) => i.status === RoomInterventionStatus.PENDING_DIRECTOR),
  );
  readonly approvedInterventions = computed(() =>
    this.interventions().filter((i) => i.status === RoomInterventionStatus.APPROVED),
  );

  /** Alertes temps réel d'état des chambres (RECEPTION, DIRECTION, TECHNIQUE) */
  private readonly alertSoundStorageKey = 'residence_blue_room_alerts_sound';
  readonly roomAlerts = signal<RoomAlertItem[]>([]);
  readonly unreadAlertsCount = computed(() => this.roomAlerts().filter((a) => !a.read).length);
  readonly soundEnabled = signal<boolean>(this.readSoundPreference());
  readonly sseConnected = signal<boolean>(false);
  readonly latestLiveAlert = computed(() => this.roomAlerts()[0] ?? null);
  readonly canReceiveRoomAlerts = computed<boolean>(() => {
    const auth = this.authService as unknown as {
      currentUser?: () => { role?: Role } | null;
      currentRole?: () => Role | null;
    } | undefined;
    const role = auth?.currentUser?.()?.role ?? auth?.currentRole?.() ?? null;
    return role === Role.RECEPTION || role === Role.DIRECTION || role === Role.MAINTENANCE;
  });

  private roomSseAbort: AbortController | null = null;
  private roomSseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private roomSseStartTimer: ReturnType<typeof setTimeout> | null = null;
  private roomPollingTimer: ReturnType<typeof setInterval> | null = null;
  private lastRoomEventId: number | null = null;
  private readonly recentAlertTimestamps = new Map<string, number>();

  /** Chambres actives (exclut les chambres inactives) */
  readonly activeRooms = computed(() => {
    return this.rooms().filter((r) => r.isActive !== false);
  });

  /** Chambres inactives */
  readonly inactiveRooms = computed(() => {
    return this.rooms().filter((r) => r.isActive === false);
  });

  readonly hasInactiveRooms = computed(() => {
    return this.inactiveRooms().length > 0;
  });

  readonly totalCount = computed(() => this.rooms().length);

  /** Liste dynamique et ordonnée de tous les étages existants */
  readonly floors = computed<number[]>(() => {
    const floorSet = new Set<number>();
    for (const r of this.rooms()) {
      if (typeof r.floor === 'number') {
        floorSet.add(r.floor);
      }
    }
    return Array.from(floorSet).sort((a, b) => a - b);
  });

  /** Liste dynamique de toutes les catégories de chambres existantes */
  readonly categories = computed<string[]>(() => {
    const catSet = new Set<string>();
    for (const r of this.rooms()) {
      const cat = r.category || r.type?.name || 'Standard';
      if (cat) catSet.add(cat);
    }
    return Array.from(catSet).sort();
  });

  readonly counts = computed(() => {
    const all = this.rooms();
    const active = all.filter((r) => r.isActive !== false);
    return {
      total: all.length,
      active: active.length,
      free: active.filter((r) => r.status === RoomStatus.FREE).length,
      occupied: active.filter((r) => r.status === RoomStatus.OCCUPIED).length,
      cleaning: active.filter((r) => r.status === RoomStatus.CLEANING).length,
      maintenance: active.filter((r) => r.status === RoomStatus.MAINTENANCE).length,
      inactive: all.filter((r) => r.isActive === false).length,
      pendingSync: all.filter((r) => r.syncPending).length,
    };
  });

  readonly filteredRooms = computed(() => {
    let list = this.rooms();
    const filter = this.selectedFilter();
    const floor = this.selectedFloor();
    const category = this.selectedCategory();
    const query = this.searchQuery().trim().toLowerCase();

    // Filtre d'état
    if (filter === 'INACTIVE') {
      list = list.filter((r) => r.isActive === false);
    } else if (filter !== 'ALL') {
      list = list.filter((r) => r.isActive !== false && r.status === filter);
    } else {
      // 'ALL' affiche toutes les chambres actives
      list = list.filter((r) => r.isActive !== false);
    }

    // Filtre par étage
    if (floor !== null) {
      list = list.filter((r) => r.floor === floor);
    }

    // Filtre par catégorie
    if (category !== null && category !== 'ALL') {
      list = list.filter((r) => (r.category || r.type?.name || 'Standard') === category);
    }

    // Recherche par numéro ou catégorie
    if (query) {
      list = list.filter(
        (r) =>
          r.number.toLowerCase().includes(query) ||
          (r.category || r.type?.name || '').toLowerCase().includes(query) ||
          (r.description || '').toLowerCase().includes(query)
      );
    }

    return list;
  });

  private readonly authService: AuthService | null;

  constructor(
    private readonly idb: IdbService,
    private readonly outbox: OutboxService,
    public readonly network: NetworkService,
    authServiceOverride?: AuthService,
  ) {
    let injectedAuth: AuthService | null = null;
    try {
      injectedAuth = inject(AuthService, { optional: true });
    } catch {
      injectedAuth = null;
    }
    this.authService = authServiceOverride ?? injectedAuth;
    this.initRooms();
    try {
      effect(() => {
        const authenticated = Boolean(this.authService?.isAuthenticated());
        const allowed = this.canReceiveRoomAlerts();
        if (authenticated) {
          void this.fetchFromServer();
          void this.fetchInterventions();
        }
        if (authenticated && allowed) {
          this.startLiveAlerts();
        } else {
          this.stopLiveAlerts();
          if (!authenticated) {
            this.roomAlerts.set([]);
            this.recentAlertTimestamps.clear();
            this.lastRoomEventId = null;
          }
        }
      });
    } catch {
      // Hors contexte d'injection Angular
    }

    // Rejeu automatique de l'outbox au retour de la connexion
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.syncOutbox();
      });
    }
  }

  /**
   * Initialisation : lecture depuis IndexedDB d'abord (Offline-First),
   * puis synchronisation réseau avec le serveur si disponible.
   */
  async initRooms(): Promise<void> {
    try {
      try {
        const cached = await this.idb.getAll<RoomUiItem>('rooms');
        if (cached && cached.length > 0) {
          const dedup = new Map<string, RoomUiItem>();
          for (const r of cached) {
            dedup.set(r.number, r);
          }
          const enriched = Array.from(dedup.values()).map((r) => this.normalizeRoom(r));
          this.rooms.set(this.sortRooms(enriched));
        }
      } catch {}

      if (this.network.isOnline()) {
        await this.fetchFromServer();
      }
    } catch {
      // Aucun jeu de démonstration en dur : en cas d'erreur et cache vide, rooms reste []
    }
  }

  /**
   * Récupère la liste des chambres depuis l'API serveur (source de vérité).
   */
  private getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      ...(this.authService ? this.authService.getAuthHeaders() : {}),
      ...(extra || {}),
    };
  }

  async fetchFromServer(): Promise<boolean> {
    if (this.authService && !this.authService.isAuthenticated()) {
      return false;
    }
    try {
      const response = await fetch('/api/rooms', {
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });

      if (response.ok) {
        const serverRooms: RoomDto[] = await response.json();
        const previousById = new Map(this.rooms().map((r) => [r.id, r]));
        const hasInitialSnapshot = previousById.size > 0;
        const detectedChanges: Array<{ previous: RoomUiItem; next: RoomUiItem }> = [];

        const merged: RoomUiItem[] = serverRooms.map((sr) => {
          const currentLocal = previousById.get(sr.id) ?? this.rooms().find((r) => r.number === sr.number);
          const normalized = this.normalizeRoom({
            ...sr,
            syncPending: currentLocal?.syncPending || false,
            status: currentLocal?.syncPending ? currentLocal.status : sr.status,
            isActive: sr.isActive !== undefined ? sr.isActive : (currentLocal?.isActive ?? true),
          });
          if (
            hasInitialSnapshot &&
            currentLocal &&
            !currentLocal.syncPending &&
            (currentLocal.status !== normalized.status ||
              (currentLocal.maintenanceReason ?? null) !== (normalized.maintenanceReason ?? null))
          ) {
            detectedChanges.push({ previous: currentLocal, next: normalized });
          }
          return normalized;
        });

        const dedup = new Map<string, RoomUiItem>();
        for (const r of merged) {
          dedup.set(r.number, r);
        }
        const uniqueMerged = Array.from(dedup.values());
        this.rooms.set(this.sortRooms(uniqueMerged));

        if (this.canReceiveRoomAlerts()) {
          for (const change of detectedChanges) {
            this.pushRoomAlert({
              roomId: change.next.id,
              roomNumber: change.next.number,
              status: change.next.status,
              previousStatus: change.previous.status,
              reason: change.next.maintenanceReason ?? null,
              timestamp: new Date().toISOString(),
            });
          }
        }
        try {
          const validIds = new Set(uniqueMerged.map((r) => r.id));
          const existingInIdb = await this.idb.getAll<RoomUiItem>('rooms');
          for (const old of existingInIdb || []) {
            if (!validIds.has(old.id)) {
              await this.idb.delete('rooms', old.id);
            }
          }
          for (const r of uniqueMerged) {
            await this.idb.put('rooms', r);
          }
        } catch {}
        return true;
      }
      return false;
    } catch {
      // Mode hors-ligne transparent
      return false;
    }
  }

  /**
   * Ouvre le tiroir pour ajouter une nouvelle chambre.
   */
  openAddDrawer(): void {
    this.errorMessage.set(null);
    this.deactivationConflictMessage.set(null);
    this.editingRoom.set(null);
    this.isDrawerOpen.set(true);
  }

  /**
   * Ouvre le tiroir pour modifier une chambre existante.
   */
  openEditDrawer(room: RoomUiItem): void {
    this.errorMessage.set(null);
    this.deactivationConflictMessage.set(null);
    this.editingRoom.set(room);
    this.isDrawerOpen.set(true);
  }

  /**
   * Ferme le tiroir d'ajout / modification.
   */
  closeDrawer(): void {
    this.isDrawerOpen.set(false);
    this.editingRoom.set(null);
  }

  /**
   * Ajout d'une nouvelle chambre avec validation stricte de l'unicité du numéro.
   */
  async addRoom(
    dto: CreateRoomDto,
    imageFile?: File | Blob,
  ): Promise<{ success: boolean; error?: string; room?: RoomUiItem }> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const cleanNumber = dto.number.trim();
    if (!cleanNumber) {
      const err = 'Le numéro ou nom de la chambre est obligatoire.';
      this.errorMessage.set(err);
      return { success: false, error: err };
    }

    // Vérification d'unicité (insensible à la casse)
    const duplicate = this.rooms().some(
      (r) => r.number.trim().toLowerCase() === cleanNumber.toLowerCase()
    );
    if (duplicate) {
      const err = `La chambre "${cleanNumber}" existe déjà. Veuillez renseigner un numéro unique.`;
      this.errorMessage.set(err);
      return { success: false, error: err };
    }

    const price =
      dto.pricePerNight !== undefined && dto.pricePerNight !== null && Number(dto.pricePerNight) > 0
        ? Math.round(Number(dto.pricePerNight))
        : null;
    const category = dto.category?.trim() || 'À classer';
    const floor = Number(dto.floor) || 1;
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `room-${Date.now()}`;

    const newRoom: RoomUiItem = this.normalizeRoom({
      id: newId,
      number: cleanNumber,
      floor,
      status: dto.status || RoomStatus.FREE,
      category,
      typeId: `type-${category.toLowerCase().replace(/\s+/g, '-')}`,
      type: {
        id: `type-${category.toLowerCase().replace(/\s+/g, '-')}`,
        name: category,
        pricePerNight: price,
      },
      amenities: dto.amenities || ['Climatisation', 'Wi-Fi Fibre'],
      imageUrl: dto.imageUrl || FALLBACK_ROOM_IMAGE,
      image: dto.imageUrl || FALLBACK_ROOM_IMAGE,
      imageAlt: `Chambre ${cleanNumber} - ${category}`,
      adultsCapacity: Number(dto.adultsCapacity || (category === 'Appartement' ? 6 : 2)),
      childrenCapacity: Number(dto.childrenCapacity || 0),
      bedType: dto.bedType || 'queen',
      bedsCount: Number(dto.bedsCount || 1),
      surfaceM2: dto.surfaceM2 ?? null,
      view: dto.view ?? null,
      smoking: Boolean(dto.smoking),
      connectingRoom: dto.connectingRoom?.trim() || '',
      highSeasonPricePerNight: dto.highSeasonPricePerNight ? Math.round(Number(dto.highSeasonPricePerNight)) : undefined,
      corporatePricePerNight: dto.corporatePricePerNight ? Math.round(Number(dto.corporatePricePerNight)) : undefined,
      breakfastIncluded: dto.breakfastIncluded ?? true,
      description: dto.description?.trim() || '',
      internalNote: dto.internalNote?.trim() || '',
      isActive: true,
      syncPending: !this.network.isOnline(),
    });

    // Mise à jour locale réactive immédiate & fermeture du tiroir (Offline-First)
    this.rooms.update((list) => this.sortRooms([...list, newRoom]));
    this.successMessage.set(`La chambre ${newRoom.number} a été créée avec succès.`);
    this.closeDrawer();

    // Effet de mise en évidence temporaire
    this.justHighlightedRoomId.set(newRoom.id);
    setTimeout(() => {
      if (this.justHighlightedRoomId() === newRoom.id) {
        this.justHighlightedRoomId.set(null);
      }
    }, 3000);

    // Persistance IndexedDB locale (non bloquante pour l'appel réseau)
    this.idb.put('rooms', newRoom).catch(() => {});

    // Enregistrement hors-ligne / réseau
    if (!this.network.isOnline()) {
      await this.outbox.enqueue('POST_ROOM', '/api/rooms', dto);
    } else {
      try {
        let response: Response;
        if (imageFile) {
          const formData = new FormData();
          formData.append('image', imageFile, 'photo.webp');
          formData.append('number', cleanNumber);
          formData.append('floor', String(floor));
          formData.append('category', category);
          if (price !== null) formData.append('pricePerNight', String(price));
          if (dto.status) formData.append('status', dto.status);
          if (dto.amenities) formData.append('amenities', JSON.stringify(dto.amenities));
          if (dto.description) formData.append('description', dto.description);
          if (dto.internalNote) formData.append('internalNote', dto.internalNote);

          response = await fetch('/api/rooms', {
            method: 'POST',
            credentials: 'include',
            headers: this.getAuthHeaders(),
            body: formData,
          });
        } else {
          response = await fetch('/api/rooms', {
            method: 'POST',
            credentials: 'include',
            headers: this.getAuthHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
              ...dto,
              number: cleanNumber,
              floor,
              category,
              ...(price !== null ? { pricePerNight: price } : {}),
            }),
          });
        }

        if (response.ok) {
          const serverRoom: RoomDto = await response.json().catch(() => ({} as RoomDto));
          if (serverRoom && serverRoom.id && serverRoom.number) {
            const normalizedServer = this.normalizeRoom({
              ...serverRoom,
              syncPending: false,
            });
            this.rooms.update((list) =>
              this.sortRooms([...list.filter((r) => r.id !== newRoom.id && r.number !== cleanNumber), normalizedServer])
            );
            try {
              await this.idb.put('rooms', normalizedServer);
            } catch {}
            return { success: true, room: normalizedServer };
          }
          return { success: true, room: newRoom };
        } else if (response.status >= 500) {
          await this.outbox.enqueue('POST_ROOM', '/api/rooms', dto);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.message || 'Erreur serveur lors de la création de la chambre.';
          this.errorMessage.set(errMsg);
          return { success: false, error: errMsg };
        }
      } catch {
        await this.outbox.enqueue('POST_ROOM', '/api/rooms', dto);
      }
    }

    return { success: true, room: newRoom };
  }

  /**
   * Modification d'une chambre existante.
   */
  async updateRoom(
    roomId: string,
    dto: UpdateRoomDto,
    imageFile?: File | Blob,
  ): Promise<{ success: boolean; error?: string; room?: RoomUiItem }> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const room = this.rooms().find((r) => r.id === roomId);
    if (!room) {
      const err = 'Chambre introuvable.';
      this.errorMessage.set(err);
      return { success: false, error: err };
    }

    if (dto.number) {
      const cleanNumber = dto.number.trim();
      const duplicate = this.rooms().some(
        (r) => r.id !== roomId && r.number.trim().toLowerCase() === cleanNumber.toLowerCase()
      );
      if (duplicate) {
        const err = `Le numéro de chambre "${cleanNumber}" est déjà attribué à une autre chambre.`;
        this.errorMessage.set(err);
        return { success: false, error: err };
      }
    }

    const updatedCategory = dto.category?.trim() || room.category || room.type?.name || 'À classer';
    const updatedPrice: number | null =
      dto.pricePerNight !== undefined && dto.pricePerNight !== null
        ? Math.round(Number(dto.pricePerNight))
        : (room.pricePerNight ?? room.type?.pricePerNight ?? null);
    const cleanNumber = dto.number?.trim() || room.number;

    let pendingImageUrl = room.imageUrl;
    if (dto.removeImage) {
      pendingImageUrl = FALLBACK_ROOM_IMAGE;
    } else if (dto.imageUrl) {
      pendingImageUrl = dto.imageUrl;
    }

    const optimisticRoom: RoomUiItem = this.normalizeRoom({
      ...room,
      ...dto,
      number: cleanNumber,
      floor: dto.floor !== undefined ? Number(dto.floor) : room.floor,
      category: updatedCategory,
      type: {
        id: `type-${updatedCategory.toLowerCase().replace(/\s+/g, '-')}`,
        name: updatedCategory,
        pricePerNight: updatedPrice,
      },
      typeId: `type-${updatedCategory.toLowerCase().replace(/\s+/g, '-')}`,
      imageUrl: pendingImageUrl,
      image: pendingImageUrl,
      imageAlt: `Chambre ${cleanNumber} - ${updatedCategory}`,
      syncPending: !this.network.isOnline(),
    });

    // Mise à jour locale réactive immédiate & fermeture du tiroir (Offline-First)
    this.rooms.update((list) => list.map((r) => (r.id === roomId ? optimisticRoom : r)));
    this.closeDrawer();

    // Effet de mise en évidence
    this.justHighlightedRoomId.set(roomId);
    setTimeout(() => {
      if (this.justHighlightedRoomId() === roomId) {
        this.justHighlightedRoomId.set(null);
      }
    }, 3000);

    // Persistance IndexedDB locale (non bloquante pour l'appel réseau)
    this.idb.put('rooms', optimisticRoom).catch(() => {});

    // Envoi réseau ou Outbox
    if (!this.network.isOnline()) {
      await this.outbox.enqueue('PATCH_ROOM', `/api/rooms/${roomId}`, dto);
    } else {
      try {
        let response: Response;
        if (imageFile) {
          const formData = new FormData();
          formData.append('image', imageFile, 'photo.webp');
          formData.append('number', cleanNumber);
          if (dto.floor !== undefined) formData.append('floor', String(dto.floor));
          if (dto.category) formData.append('category', updatedCategory);
          if (dto.pricePerNight !== undefined && updatedPrice !== null) {
            formData.append('pricePerNight', String(updatedPrice));
          }
          if (dto.status) formData.append('status', dto.status);
          if (dto.amenities) formData.append('amenities', JSON.stringify(dto.amenities));
          if (dto.description !== undefined) formData.append('description', dto.description);
          if (dto.internalNote !== undefined) formData.append('internalNote', dto.internalNote);

          response = await fetch(`/api/rooms/${roomId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: this.getAuthHeaders(),
            body: formData,
          });
        } else {
          response = await fetch(`/api/rooms/${roomId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: this.getAuthHeaders({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({
              ...dto,
              number: cleanNumber,
              floor: dto.floor !== undefined ? Number(dto.floor) : room.floor,
              category: updatedCategory,
              ...(updatedPrice !== null ? { pricePerNight: updatedPrice } : {}),
            }),
          });
        }

        if (response.ok) {
          const serverRoom: RoomDto = await response.json().catch(() => ({} as RoomDto));
          if (serverRoom && serverRoom.id && serverRoom.number) {
            const normalizedServer = this.normalizeRoom({
              ...serverRoom,
              syncPending: false,
            });
            this.rooms.update((list) =>
              list.map((r) => (r.id === roomId || r.number === normalizedServer.number ? normalizedServer : r))
            );
            this.idb.put('rooms', normalizedServer).catch(() => {});
            this.successMessage.set(`La chambre ${normalizedServer.number} a été modifiée avec succès.`);
            return { success: true, room: normalizedServer };
          }
          this.successMessage.set(`La chambre ${optimisticRoom.number} a été modifiée avec succès.`);
          return { success: true, room: optimisticRoom };
        } else if (response.status >= 500) {
          await this.outbox.enqueue('PATCH_ROOM', `/api/rooms/${roomId}`, dto);
        } else {
          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData.message || 'Erreur lors de la modification de la chambre.';
          this.errorMessage.set(errMsg);
          return { success: false, error: errMsg };
        }
      } catch {
        await this.outbox.enqueue('PATCH_ROOM', `/api/rooms/${roomId}`, dto);
      }
    }

    this.successMessage.set(`La chambre ${optimisticRoom.number} a été modifiée avec succès.`);
    return { success: true, room: optimisticRoom };
  }

  /**
   * Suppression définitive d'une chambre (Réservé à la DIRECTION).
   */
  async deleteRoom(roomId: string): Promise<{
    success: boolean;
    conflict?: boolean;
    forbidden?: boolean;
    error?: string;
    history?: { reservationsCount: number; invoicesCount: number; ordersCount: number };
  }> {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.deactivationConflictMessage.set(null);

    const room = this.rooms().find((r) => r.id === roomId);
    if (!room) {
      const err = 'Chambre introuvable.';
      this.errorMessage.set(err);
      return { success: false, error: err };
    }

    if (this.currentRole() !== Role.DIRECTION) {
      const err = 'Action réservée exclusivement à la DIRECTION.';
      this.errorMessage.set(err);
      return { success: false, forbidden: true, error: err };
    }

    if (this.network.isOnline()) {
      try {
        const response = await fetch(`/api/rooms/${roomId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: this.getAuthHeaders(),
        });

        if (response.status === 409) {
          const conflictData = await response.json().catch(() => ({}));
          const msg =
            conflictData.message ||
            `Cette chambre possède un historique de réservations ou factures. Utilisez Désactiver pour la retirer sans perdre l'historique.`;
          this.errorMessage.set(msg);
          this.deactivationConflictMessage.set(msg);
          return {
            success: false,
            conflict: true,
            error: msg,
            history: conflictData.history,
          };
        }

        if (response.status === 403) {
          const err = 'Action réservée exclusivement à la DIRECTION.';
          this.errorMessage.set(err);
          return { success: false, forbidden: true, error: err };
        }

        if (!response.ok && response.status < 500) {
          const errData = await response.json().catch(() => ({}));
          const errMsg = errData.message || 'Erreur lors de la suppression de la chambre.';
          this.errorMessage.set(errMsg);
          return { success: false, error: errMsg };
        }
      } catch {}
    }

    // Suppression locale réactive immédiate (sans rechargement)
    this.rooms.update((list) => list.filter((r) => r.id !== roomId));
    this.idb.delete('rooms', roomId).catch(() => {});

    this.successMessage.set(`La chambre ${room.number} a été définitivement supprimée.`);
    return { success: true };
  }

  /**
   * Désactive une chambre après vérification de l'absence de réservations en cours ou à venir.
   */
  async deactivateRoom(roomId: string, force = false): Promise<{ success: boolean; error?: string }> {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.deactivationConflictMessage.set(null);

    const room = this.rooms().find((r) => r.id === roomId);
    if (!room) {
      const err = 'Chambre introuvable.';
      this.errorMessage.set(err);
      return { success: false, error: err };
    }

    if (!force) {
      // Vérification des réservations actives via PlanningService
      const conflicts = this.getFutureOrCurrentReservationsForRoom(room.number);
      if (conflicts.length > 0) {
        const conflictList = conflicts
          .map((c) => `• Dossier #${c.id} : ${c.guestName} (${c.checkIn} au ${c.checkOut})`)
          .join('\n');
        const errorMsg = `Impossible de désactiver la chambre ${room.number} : ${conflicts.length} réservation(s) en cours ou à venir détectée(s) :\n${conflictList}`;
        this.errorMessage.set(errorMsg);
        this.deactivationConflictMessage.set(errorMsg);
        return { success: false, error: errorMsg };
      }
    }

    // Aucun conflit : marquage en tant qu'inactive
    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, isActive: false, syncPending: !this.network.isOnline() } : r))
    );

    const updated = this.rooms().find((r) => r.id === roomId)!;
    await this.idb.put('rooms', updated);

    if (!this.network.isOnline()) {
      await this.outbox.enqueue('PATCH_ROOM_DEACTIVATE', `/api/rooms/${roomId}/deactivate`, {});
    }

    this.successMessage.set(`La chambre ${room.number} a été désactivée des réservations futures.`);
    return { success: true };
  }

  /**
   * Réactive une chambre préalablement désactivée.
   */
  async reactivateRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const room = this.rooms().find((r) => r.id === roomId);
    if (!room) {
      return { success: false, error: 'Chambre introuvable.' };
    }

    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, isActive: true, syncPending: !this.network.isOnline() } : r))
    );

    const updated = this.rooms().find((r) => r.id === roomId)!;
    await this.idb.put('rooms', updated);

    this.successMessage.set(`La chambre ${room.number} a été réactivée avec succès.`);
    return { success: true };
  }

  /**
   * Vérifie si une chambre a des réservations en cours ou à venir.
   */
  getFutureOrCurrentReservationsForRoom(roomNumber: string): Array<{
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    status: string;
  }> {
    const planningService = this.injector.get(PlanningService, null, { optional: true });
    if (!planningService) {
      return [];
    }
    const all = planningService.allReservations();
    return all
      .filter((r) => r.roomNumber === roomNumber && r.status !== 'CHECKOUT')
      .map((r) => ({
        id: r.id,
        guestName: r.guestName,
        checkIn: r.checkInDate,
        checkOut: r.checkOutDate,
        status: r.status,
      }));
  }

  /**
   * Changement de statut d'une chambre (avec validation de transition et outbox hors-ligne).
   */
  async changeRoomStatus(roomId: string, targetStatus: RoomStatus, reason?: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const room = this.rooms().find((r) => r.id === roomId);
    if (!room) {
      this.errorMessage.set('Chambre introuvable.');
      return false;
    }

    const check = isRoomStatusTransitionAllowed(room.status, targetStatus, this.currentRole());
    if (!check.allowed) {
      this.errorMessage.set(check.reason || 'Transition non autorisée.');
      return false;
    }

    const previousStatus = room.status;
    const previousReason = room.maintenanceReason ?? null;
    const nextReason =
      targetStatus === RoomStatus.MAINTENANCE
        ? (reason?.trim() || 'Problème signalé')
        : (room.status === RoomStatus.MAINTENANCE || targetStatus === RoomStatus.FREE ? null : previousReason);

    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, status: targetStatus, maintenanceReason: nextReason, syncPending: true } : r))
    );

    const updatedRoom = this.rooms().find((r) => r.id === roomId)!;
    await this.idb.put('rooms', updatedRoom);

    if (!this.network.isOnline()) {
      await this.outbox.enqueue('PATCH_ROOM_STATUS', `/api/rooms/${roomId}/status`, {
        status: targetStatus,
        reason,
      });
      this.successMessage.set(
        `Statut changé vers ${targetStatus} (enregistré hors-ligne, en attente de synchronisation).`
      );
      return true;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/status`, {
        method: 'PATCH',
        credentials: 'include',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ status: targetStatus, reason }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.errorMessage.set(errorData.message || `Erreur serveur (${response.status}).`);
        if (response.status === 400 || response.status === 403) {
          const rollbackRoom: RoomUiItem = { ...room, status: previousStatus, maintenanceReason: previousReason, syncPending: false };
          this.rooms.update((list) =>
            list.map((r) => (r.id === roomId ? rollbackRoom : r))
          );
          await this.idb.put('rooms', rollbackRoom);
          return false;
        }
        throw new Error(errorData.message || 'Erreur serveur lors de la mise à jour.');
      }

      this.rooms.update((list) =>
        list.map((r) => (r.id === roomId ? { ...r, syncPending: false } : r))
      );
      const syncedRoom = this.rooms().find((r) => r.id === roomId)!;
      await this.idb.put('rooms', syncedRoom);

      const statusLabels: Record<string, string> = {
        FREE: 'Propre',
        CLEANING: 'À nettoyer',
        OCCUPIED: 'Occupée',
        MAINTENANCE: 'Hors service',
      };
      this.successMessage.set(`Chambre ${room.number} : ${statusLabels[targetStatus] || targetStatus}.`);
      return true;
    } catch {
      await this.outbox.enqueue('PATCH_ROOM_STATUS', `/api/rooms/${roomId}/status`, {
        status: targetStatus,
        reason,
      });
      this.successMessage.set(`Connexion perturbée : action enregistrée dans la file hors-ligne.`);
      return true;
    }
  }

  async syncOutbox(): Promise<void> {
    await this.outbox.syncOutbox();
    await this.fetchFromServer();
    await this.fetchInterventions();
  }

  /**
   * Charge les demandes d'intervention technique visibles pour le rôle connecté.
   */
  async fetchInterventions(): Promise<RoomInterventionRequestDto[]> {
    if (this.authService && !this.authService.isAuthenticated()) {
      return [];
    }
    try {
      const response = await fetch('/api/rooms/interventions', {
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        return this.interventions();
      }
      const data: RoomInterventionRequestDto[] = await response.json();
      this.interventions.set(Array.isArray(data) ? data : []);
      return this.interventions();
    } catch {
      return this.interventions();
    }
  }

  /**
   * Constat d'un problème en chambre par Ménage ou Réception -> statut PENDING_DIRECTOR.
   */
  async requestIntervention(roomId: string, issueDescription: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const cleanDesc = issueDescription.trim();
    if (!cleanDesc) {
      this.errorMessage.set('La description du problème est obligatoire.');
      return false;
    }

    const room = this.rooms().find((r) => r.id === roomId);
    const tempId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `int-${Date.now()}`;
    const nowIso = new Date().toISOString();
    const optimistic: RoomInterventionRequestDto = {
      id: tempId,
      roomId,
      roomNumber: room?.number,
      roomFloor: room?.floor,
      roomCategory: room?.category || room?.type?.name,
      reportedById: this.authService?.currentUser()?.id || '',
      reportedByName: this.authService?.currentUser()?.fullName || 'Équipe',
      reportedByRole: this.currentRole(),
      issueDescription: cleanDesc,
      status: RoomInterventionStatus.PENDING_DIRECTOR,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    const applyLocal = (entry: RoomInterventionRequestDto) => {
      this.interventions.update((list) => [entry, ...list.filter((i) => i.id !== tempId && i.id !== entry.id)]);
      this.rooms.update((list) =>
        list.map((r) =>
          r.id === roomId
            ? {
                ...r,
                activeInterventions: [
                  entry,
                  ...(r.activeInterventions || []).filter((i) => i.id !== tempId && i.id !== entry.id),
                ],
              }
            : r,
        ),
      );
    };

    applyLocal(optimistic);

    if (!this.network.isOnline()) {
      await this.outbox.enqueue('POST_ROOM_INTERVENTION', `/api/rooms/${roomId}/intervention`, {
        issueDescription: cleanDesc,
      });
      this.successMessage.set("Demande enregistrée hors-ligne (en attente d'accord du Directeur).");
      return true;
    }

    try {
      const response = await fetch(`/api/rooms/${roomId}/intervention`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders({
          'Content-Type': 'application/json',
          'Idempotency-Key': tempId,
        }),
        body: JSON.stringify({ issueDescription: cleanDesc }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.errorMessage.set(errData.message || `Erreur serveur (${response.status}).`);
        await this.fetchFromServer();
        await this.fetchInterventions();
        return false;
      }

      const created: RoomInterventionRequestDto = await response.json();
      applyLocal(created);
      this.successMessage.set(
        `Problème signalé pour la chambre ${room?.number || ''} : en attente d'accord du Directeur.`,
      );
      await this.fetchFromServer();
      await this.fetchInterventions();
      return true;
    } catch {
      await this.outbox.enqueue('POST_ROOM_INTERVENTION', `/api/rooms/${roomId}/intervention`, {
        issueDescription: cleanDesc,
      });
      this.successMessage.set("Connexion perturbée : demande mise en file d'attente hors-ligne.");
      return true;
    }
  }

  /**
   * Validation par la Direction -> APPROVED + notification Maintenance.
   */
  async approveIntervention(interventionId: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const response = await fetch(`/api/rooms/interventions/${interventionId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.errorMessage.set(errData.message || `Erreur serveur (${response.status}).`);
        return false;
      }
      this.successMessage.set(
        "Intervention approuvée : l'ordre de mission a été transmis à l'équipe Technique.",
      );
      await Promise.all([this.fetchFromServer(), this.fetchInterventions()]);
      return true;
    } catch {
      this.errorMessage.set("Impossible d'approuver l'intervention pour le moment.");
      return false;
    }
  }

  /**
   * Refus par la Direction -> REJECTED + notification Réception & Ménage.
   */
  async rejectIntervention(interventionId: string, reason?: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const response = await fetch(`/api/rooms/interventions/${interventionId}/reject`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: reason?.trim() || undefined }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.errorMessage.set(errData.message || `Erreur serveur (${response.status}).`);
        return false;
      }
      this.successMessage.set(
        'Demande refusée : la Réception et le Ménage ont été notifiés.',
      );
      await Promise.all([this.fetchFromServer(), this.fetchInterventions()]);
      return true;
    } catch {
      this.errorMessage.set("Impossible de refuser l'intervention pour le moment.");
      return false;
    }
  }

  /**
   * Clôture par l'équipe Technique (MAINTENANCE) -> COMPLETED + chambre remise en CLEANING.
   */
  async completeIntervention(interventionId: string): Promise<boolean> {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const response = await fetch(`/api/rooms/interventions/${interventionId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: this.getAuthHeaders(),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.errorMessage.set(errData.message || `Erreur serveur (${response.status}).`);
        return false;
      }
      this.successMessage.set(
        'Intervention marquée comme réparée : la chambre passe en nettoyage (CLEANING).',
      );
      await Promise.all([this.fetchFromServer(), this.fetchInterventions()]);
      return true;
    } catch {
      this.errorMessage.set('Impossible de clôturer cette intervention pour le moment.');
      return false;
    }
  }


  setFilter(filter: string): void {
    this.selectedFilter.set(filter);
  }

  setFloor(floor: number | null): void {
    this.selectedFloor.set(floor);
  }

  setCategory(category: string | null): void {
    this.selectedCategory.set(category);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  private sortRooms(list: RoomUiItem[]): RoomUiItem[] {
    return [...list].sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.number.localeCompare(b.number, undefined, { numeric: true });
    });
  }

  private normalizeRoom(r: Partial<RoomUiItem> & { id: string; number: string }): RoomUiItem {
    const category = r.tariffCategory?.name || r.category || r.type?.name || 'À classer';
    const canViewAmounts = this.authService && typeof this.authService.hasPermission === 'function'
      ? this.authService.hasPermission('voir_montants')
      : true;
    const rawPrice = r.minTariffFcfa ?? r.pricePerNight ?? r.type?.pricePerNight;
    const price: number | null =
      canViewAmounts && typeof rawPrice === 'number' && Number.isFinite(rawPrice) && rawPrice > 0
        ? rawPrice
        : null;
    const imageUrl = r.imageUrl || r.image || getRoomImageUrl(r.number);
    const imageAlt = r.imageAlt || getRoomImageAlt(r.number);
    const isUnclassified =
      r.isUnclassified !== undefined
        ? Boolean(r.isUnclassified)
        : !r.tariffCategory && !['Standard', 'Confort', 'Appartement'].includes(category);

    return {
      id: r.id,
      number: r.number,
      floor: typeof r.floor === 'number' ? r.floor : 1,
      status: r.status || RoomStatus.FREE,
      category,
      tariffCategoryId: r.tariffCategoryId ?? r.tariffCategory?.id ?? null,
      tariffCategory: r.tariffCategory ?? null,
      isUnclassified,
      minTariffFcfa: canViewAmounts && typeof r.minTariffFcfa === 'number' ? r.minTariffFcfa : null,
      typeId: r.typeId || `type-${category.toLowerCase().replace(/\s+/g, '-')}`,
      pricePerNight: price,
      type: {
        id: r.typeId || `type-${category.toLowerCase().replace(/\s+/g, '-')}`,
        name: category,
        pricePerNight: price as any,
      },
      amenities: r.amenities || ['Climatisation', 'Wi-Fi Fibre'],
      image: imageUrl,
      imageUrl,
      imageAlt,
      adultsCapacity: r.adultsCapacity ?? (category === 'Appartement' ? 6 : 2),
      childrenCapacity: r.childrenCapacity ?? 0,
      bedType: r.bedType || 'queen',
      bedsCount: r.bedsCount ?? 1,
      surfaceM2: r.surfaceM2 ?? null,
      view: r.view ?? null,
      smoking: Boolean(r.smoking),
      connectingRoom: r.connectingRoom || '',
      highSeasonPricePerNight: canViewAmounts ? r.highSeasonPricePerNight : null,
      corporatePricePerNight: canViewAmounts ? r.corporatePricePerNight : null,
      breakfastIncluded: r.breakfastIncluded ?? true,
      description: r.description || '',
      internalNote: r.internalNote || '',
      maintenanceReason: r.status === RoomStatus.MAINTENANCE ? (r.maintenanceReason ?? null) : null,
      activeInterventions: Array.isArray(r.activeInterventions) ? r.activeInterventions : undefined,
      isActive: r.isActive !== false,
      syncPending: Boolean(r.syncPending),
    };
  }

  toggleAlertSound(): void {
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.alertSoundStorageKey, next ? '1' : '0');
      }
    } catch {}
  }

  markAllAlertsRead(): void {
    this.roomAlerts.update((list) => list.map((a) => (a.read ? a : { ...a, read: true })));
  }

  markAlertRead(alertId: string): void {
    this.roomAlerts.update((list) =>
      list.map((a) => (a.id === alertId ? { ...a, read: true } : a)),
    );
  }

  dismissAlert(alertId: string): void {
    this.roomAlerts.update((list) => list.filter((a) => a.id !== alertId));
  }

  startLiveAlerts(): void {
    if (!this.canReceiveRoomAlerts()) return;
    if (!this.roomSseAbort && !this.roomSseStartTimer && typeof window !== 'undefined') {
      this.roomSseStartTimer = setTimeout(() => {
        this.roomSseStartTimer = null;
        if (this.canReceiveRoomAlerts() && this.authService?.isAuthenticated()) {
          this.connectRoomStream();
        }
      }, 4000);
    }
    if (!this.roomPollingTimer && typeof window !== 'undefined') {
      this.roomPollingTimer = setInterval(() => {
        if (this.network.isOnline() && this.authService?.isAuthenticated()) {
          void this.fetchFromServer();
          void this.fetchInterventions();
        }
      }, 10000);
    }
  }

  stopLiveAlerts(): void {
    if (this.roomSseStartTimer) {
      clearTimeout(this.roomSseStartTimer);
      this.roomSseStartTimer = null;
    }
    this.disconnectRoomStream();
    if (this.roomPollingTimer) {
      clearInterval(this.roomPollingTimer);
      this.roomPollingTimer = null;
    }
  }

  connectRoomStream(): void {
    this.disconnectRoomStream();
    if (!this.canReceiveRoomAlerts()) return;
    if (!this.network.isOnline() || typeof fetch === 'undefined') return;
    if (this.authService && !this.authService.isAuthenticated()) return;

    const controller = new AbortController();
    this.roomSseAbort = controller;

    const connectLoop = async () => {
      if (controller.signal.aborted) return;
      try {
        const extraHeaders: Record<string, string> = { Accept: 'text/event-stream' };
        if (this.lastRoomEventId !== null) {
          extraHeaders['Last-Event-ID'] = String(this.lastRoomEventId);
        }
        const res = await fetch('/api/rooms/stream', {
          method: 'GET',
          credentials: 'include',
          headers: this.getAuthHeaders(extraHeaders),
          signal: controller.signal,
        });

        if (res.status === 401 || res.status === 403) {
          this.sseConnected.set(false);
          return;
        }
        if (!res.ok || !res.body) {
          this.sseConnected.set(false);
          this.scheduleRoomSseReconnect(controller, connectLoop);
          return;
        }

        this.sseConnected.set(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const idMatch = frame.match(/^id:\s*(\d+)/m);
            if (idMatch) {
              const parsedId = Number(idMatch[1]);
              if (!Number.isNaN(parsedId)) {
                this.lastRoomEventId = parsedId;
              }
            }
            const dataMatch = frame.match(/^data:\s*(.+)$/m);
            if (!dataMatch) continue;
            try {
              const parsed = JSON.parse(dataMatch[1]) as Partial<RoomStatusStreamEvent>;
              if (typeof parsed.eventId === 'number') {
                this.lastRoomEventId = parsed.eventId;
              }
              if (parsed.type === 'ROOM_STATUS_UPDATED' && parsed.roomId && parsed.roomNumber && parsed.status) {
                this.handleRoomStreamEvent(parsed as RoomStatusStreamEvent);
              }
            } catch {
              // Trame SSE ignorée (battement de coeur ou JSON incomplet)
            }
          }
        }
      } catch {
        // Baisse propre sur le polling de secours 10 s et reconnexion auto
      } finally {
        if (this.roomSseAbort === controller && !controller.signal.aborted) {
          this.sseConnected.set(false);
          this.scheduleRoomSseReconnect(controller, connectLoop);
        }
      }
    };

    void connectLoop();
  }

  disconnectRoomStream(): void {
    if (this.roomSseReconnectTimer) {
      clearTimeout(this.roomSseReconnectTimer);
      this.roomSseReconnectTimer = null;
    }
    this.roomSseAbort?.abort();
    this.roomSseAbort = null;
    this.sseConnected.set(false);
  }

  private scheduleRoomSseReconnect(controller: AbortController, retryFn: () => Promise<void>): void {
    if (controller.signal.aborted) return;
    if (this.roomSseReconnectTimer) clearTimeout(this.roomSseReconnectTimer);
    this.roomSseReconnectTimer = setTimeout(() => {
      if (!controller.signal.aborted && this.roomSseAbort === controller) {
        void retryFn();
      }
    }, 3000);
  }

  private handleRoomStreamEvent(evt: RoomStatusStreamEvent): void {
    const { roomId, roomNumber, status } = evt;
    if (!roomId || !roomNumber || !status) return;

    this.rooms.update((list) =>
      list.map((room) => {
        if (room.id !== roomId && room.number !== roomNumber) return room;
        return this.normalizeRoom({
          ...room,
          status,
          maintenanceReason: status === RoomStatus.MAINTENANCE ? (evt.reason ?? null) : null,
          syncPending: false,
        });
      }),
    );

    if (this.canReceiveRoomAlerts()) {
      this.pushRoomAlert({
        eventId: evt.eventId,
        roomId,
        roomNumber,
        status,
        previousStatus: evt.previousStatus ?? null,
        reason: evt.reason ?? null,
        timestamp: evt.timestamp || new Date().toISOString(),
      });
    }
  }

  private pushRoomAlert(input: {
    eventId?: number;
    roomId: string;
    roomNumber: string;
    status: RoomStatus;
    previousStatus?: RoomStatus | null;
    reason?: string | null;
    timestamp: string;
  }): void {
    const dedupKey = `${input.roomId}:${input.status}:${input.reason ?? ''}`;
    const now = Date.now();
    const lastTs = this.recentAlertTimestamps.get(dedupKey);
    if (lastTs !== undefined && now - lastTs < 3000) {
      return;
    }
    if (input.eventId !== undefined && this.roomAlerts().some((a) => a.id === `sse-${input.eventId}`)) {
      return;
    }
    this.recentAlertTimestamps.set(dedupKey, now);

    const item: RoomAlertItem = {
      id: input.eventId !== undefined ? `sse-${input.eventId}` : `poll-${input.roomId}-${now}`,
      roomId: input.roomId,
      roomNumber: input.roomNumber,
      status: input.status,
      previousStatus: input.previousStatus ?? null,
      reason: input.reason ?? null,
      message: formatRoomAlertMessage(input.roomNumber, input.status, input.reason),
      timestamp: input.timestamp,
      read: false,
    };

    this.roomAlerts.update((list) => [item, ...list].slice(0, 25));
    this.playRoomAlertTone();
  }

  private readSoundPreference(): boolean {
    try {
      if (typeof localStorage === 'undefined') return false;
      return localStorage.getItem(this.alertSoundStorageKey) === '1';
    } catch {
      return false;
    }
  }

  private playRoomAlertTone(): void {
    if (!this.soundEnabled() || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.23);
    } catch {
      // Lecture audio bloqu\u00e9e par le navigateur
    }
  }

  private buildInitialRooms(): RoomUiItem[] {
    return SEED_ROOMS.map((seed, idx) => {
      const price: number | null = null;
      const category = seed.typeName;
      const imageUrl = seed.imageUrl || getRoomImageUrl(seed.number);
      const imageAlt = seed.imageAlt || getRoomImageAlt(seed.number);

      return {
        id: `00000000-0000-0000-0000-${(100 + idx + 1).toString().padStart(12, '0')}`,
        number: seed.number,
        typeId: `type-${category.toLowerCase()}`,
        category,
        floor: seed.floor,
        status: RoomStatus.FREE,
        amenities: seed.amenities,
        syncPending: false,
        image: imageUrl,
        imageUrl,
        imageAlt,
        type: {
          id: `type-${category.toLowerCase()}`,
          name: category,
          pricePerNight: price,
        },
        adultsCapacity: category === 'Suite' ? 4 : 2,
        childrenCapacity: category === 'Suite' ? 2 : 1,
        bedType: category === 'Suite' ? 'king' : category === 'Deluxe' ? 'king' : 'queen',
        bedsCount: 1,
        surfaceM2: category === 'Suite' ? 45 : category === 'Deluxe' ? 32 : 22,
        view: category === 'Suite' ? 'mer' : category === 'Deluxe' ? 'piscine' : 'jardin',
        smoking: false,
        connectingRoom: '',
        breakfastIncluded: true,
        description: `Chambre ${seed.number} (${category}), idéale pour séjour d'affaires ou de loisirs.`,
        internalNote: '',
        isActive: true,
      };
    });
  }
}
