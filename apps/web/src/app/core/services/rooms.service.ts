import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import { IdbService } from '../offline/idb.service';
import { OutboxService } from '../offline/outbox.service';
import { NetworkService } from '../offline/network.service';
import {
  RoomDto,
  CreateRoomDto,
  UpdateRoomDto,
  RoomStatus,
  SEED_ROOMS,
  Role,
  isRoomStatusTransitionAllowed,
  getRoomImageUrl,
  getRoomImageAlt,
  FALLBACK_ROOM_IMAGE,
} from '@residence-blue/shared';
import { PlanningMockService } from './planning-mock.service';

export interface RoomUiItem extends RoomDto {
  syncPending?: boolean;
  image?: string;
  imageUrl?: string;
  imageAlt?: string;
  category?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RoomsService {
  private readonly injector = inject(Injector);

  readonly rooms = signal<RoomUiItem[]>([]);
  readonly currentRole = signal<Role>(Role.DIRECTION);
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

  constructor(
    private readonly idb: IdbService,
    private readonly outbox: OutboxService,
    public readonly network: NetworkService,
  ) {
    this.initRooms();

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
      const cached = await this.idb.getAll<RoomUiItem>('rooms');
      if (cached && cached.length > 0) {
        const dedup = new Map<string, RoomUiItem>();
        for (const r of cached) {
          dedup.set(r.number, r);
        }
        const enriched = Array.from(dedup.values()).map((r) => this.normalizeRoom(r));
        this.rooms.set(this.sortRooms(enriched));
      } else {
        const initialRooms = this.buildInitialRooms();
        for (const r of initialRooms) {
          await this.idb.put('rooms', r);
        }
        this.rooms.set(initialRooms);
      }

      if (this.network.isOnline()) {
        await this.fetchFromServer();
      }
    } catch {
      if (this.rooms().length === 0) {
        this.rooms.set(this.buildInitialRooms());
      }
    }
  }

  /**
   * Récupère la liste des chambres depuis l'API serveur (source de vérité).
   */
  async fetchFromServer(): Promise<void> {
    try {
      const response = await fetch('/api/rooms', {
        headers: {
          'x-user-role': this.currentRole(),
        },
      });

      if (response.ok) {
        const serverRooms: RoomDto[] = await response.json();
        const merged: RoomUiItem[] = serverRooms.map((sr) => {
          const currentLocal = this.rooms().find((r) => r.id === sr.id || r.number === sr.number);
          const normalized = this.normalizeRoom({
            ...sr,
            syncPending: currentLocal?.syncPending || false,
            status: currentLocal?.syncPending ? currentLocal.status : sr.status,
            isActive: currentLocal?.isActive !== undefined ? currentLocal.isActive : (sr.isActive !== false),
          });
          return normalized;
        });

        const dedup = new Map<string, RoomUiItem>();
        for (const r of merged) {
          dedup.set(r.number, r);
        }
        const uniqueMerged = Array.from(dedup.values());
        this.rooms.set(this.sortRooms(uniqueMerged));
        for (const r of uniqueMerged) {
          await this.idb.put('rooms', r);
        }
      }
    } catch {
      // Mode hors-ligne transparent
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
  async addRoom(dto: CreateRoomDto): Promise<{ success: boolean; error?: string; room?: RoomUiItem }> {
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

    const price = Math.round(Number(dto.pricePerNight) || 35000);
    const category = dto.category?.trim() || 'Standard';
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
      adultsCapacity: Number(dto.adultsCapacity || 2),
      childrenCapacity: Number(dto.childrenCapacity || 0),
      bedType: dto.bedType || 'queen',
      bedsCount: Number(dto.bedsCount || 1),
      surfaceM2: Number(dto.surfaceM2 || 25),
      view: dto.view || 'jardin',
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

    // Persistance IndexedDB locale
    try {
      await this.idb.put('rooms', newRoom);
    } catch {
      // Ignorer les erreurs IndexedDB locales si non bloquantes
    }

    // Enregistrement hors-ligne / réseau
    if (!this.network.isOnline()) {
      await this.outbox.enqueue('POST_ROOM', '/api/rooms', dto);
    } else {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        await fetch('/api/rooms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': this.currentRole(),
          },
          body: JSON.stringify(dto),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch {
        await this.outbox.enqueue('POST_ROOM', '/api/rooms', dto);
      }
    }

    return { success: true, room: newRoom };
  }

  /**
   * Modification d'une chambre existante.
   */
  async updateRoom(roomId: string, dto: UpdateRoomDto): Promise<{ success: boolean; error?: string }> {
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

    const updatedCategory = dto.category?.trim() || room.category || room.type?.name || 'Standard';
    const updatedPrice = dto.pricePerNight !== undefined
      ? Math.round(Number(dto.pricePerNight))
      : (room.type?.pricePerNight || 35000);

    this.rooms.update((list) =>
      list.map((r) => {
        if (r.id !== roomId) return r;
        const cleanNumber = dto.number?.trim() || r.number;
        return this.normalizeRoom({
          ...r,
          ...dto,
          number: cleanNumber,
          floor: dto.floor !== undefined ? Number(dto.floor) : r.floor,
          category: updatedCategory,
          type: {
            id: `type-${updatedCategory.toLowerCase().replace(/\s+/g, '-')}`,
            name: updatedCategory,
            pricePerNight: updatedPrice,
          },
          typeId: `type-${updatedCategory.toLowerCase().replace(/\s+/g, '-')}`,
          imageUrl: dto.imageUrl || r.imageUrl,
          image: dto.imageUrl || r.image,
          imageAlt: `Chambre ${cleanNumber} - ${updatedCategory}`,
          syncPending: !this.network.isOnline(),
        });
      })
    );

    // Mise à jour locale réactive immédiate & fermeture du tiroir (Offline-First)
    const updated = this.rooms().find((r) => r.id === roomId)!;
    this.successMessage.set(`La chambre ${updated.number} a été modifiée avec succès.`);
    this.closeDrawer();

    // Effet de mise en évidence
    this.justHighlightedRoomId.set(roomId);
    setTimeout(() => {
      if (this.justHighlightedRoomId() === roomId) {
        this.justHighlightedRoomId.set(null);
      }
    }, 3000);

    // Persistance IndexedDB locale
    try {
      await this.idb.put('rooms', updated);
    } catch {
      // Ignorer les erreurs IndexedDB locales si non bloquantes
    }

    // Envoi réseau ou Outbox
    if (!this.network.isOnline()) {
      await this.outbox.enqueue('PUT_ROOM', `/api/rooms/${roomId}`, dto);
    } else {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        await fetch(`/api/rooms/${roomId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': this.currentRole(),
          },
          body: JSON.stringify(dto),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
      } catch {
        await this.outbox.enqueue('PUT_ROOM', `/api/rooms/${roomId}`, dto);
      }
    }

    return { success: true };
  }

  /**
   * Désactive une chambre après vérification de l'absence de réservations en cours ou à venir.
   */
  async deactivateRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.deactivationConflictMessage.set(null);

    const room = this.rooms().find((r) => r.id === roomId);
    if (!room) {
      const err = 'Chambre introuvable.';
      this.errorMessage.set(err);
      return { success: false, error: err };
    }

    // Vérification des réservations actives via PlanningMockService
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
    const planningService = this.injector.get(PlanningMockService, null, { optional: true });
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

    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, status: targetStatus, syncPending: true } : r))
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': this.currentRole(),
        },
        body: JSON.stringify({ status: targetStatus, reason }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.errorMessage.set(errorData.message || `Erreur serveur (${response.status}).`);
        if (response.status === 400 || response.status === 403) {
          const rollbackRoom: RoomUiItem = { ...room, status: previousStatus, syncPending: false };
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

      this.successMessage.set(`Chambre ${room.number} : statut mis à jour (${targetStatus}).`);
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
  }

  setRole(role: Role): void {
    this.currentRole.set(role);
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
    const category = r.category || r.type?.name || 'Standard';
    const price = r.type?.pricePerNight || (category === 'Suite' ? 95000 : category === 'Deluxe' ? 55000 : 35000);
    const imageUrl = r.imageUrl || r.image || getRoomImageUrl(r.number);
    const imageAlt = r.imageAlt || getRoomImageAlt(r.number);

    return {
      id: r.id,
      number: r.number,
      floor: typeof r.floor === 'number' ? r.floor : 1,
      status: r.status || RoomStatus.FREE,
      category,
      typeId: r.typeId || `type-${category.toLowerCase().replace(/\s+/g, '-')}`,
      type: {
        id: r.typeId || `type-${category.toLowerCase().replace(/\s+/g, '-')}`,
        name: category,
        pricePerNight: price,
      },
      amenities: r.amenities || ['Climatisation', 'Wi-Fi Fibre'],
      image: imageUrl,
      imageUrl,
      imageAlt,
      adultsCapacity: r.adultsCapacity ?? (category === 'Suite' ? 4 : 2),
      childrenCapacity: r.childrenCapacity ?? (category === 'Suite' ? 2 : 1),
      bedType: r.bedType || (category === 'Suite' ? 'king' : category === 'Deluxe' ? 'king' : 'queen'),
      bedsCount: r.bedsCount ?? 1,
      surfaceM2: r.surfaceM2 ?? (category === 'Suite' ? 45 : category === 'Deluxe' ? 32 : 22),
      view: r.view || (category === 'Suite' ? 'mer' : category === 'Deluxe' ? 'piscine' : 'jardin'),
      smoking: Boolean(r.smoking),
      connectingRoom: r.connectingRoom || '',
      highSeasonPricePerNight: r.highSeasonPricePerNight,
      corporatePricePerNight: r.corporatePricePerNight,
      breakfastIncluded: r.breakfastIncluded ?? true,
      description: r.description || '',
      internalNote: r.internalNote || '',
      isActive: r.isActive !== false,
      syncPending: Boolean(r.syncPending),
    };
  }

  private buildInitialRooms(): RoomUiItem[] {
    const typePrices: Record<string, number> = {
      Standard: 35000,
      Deluxe: 55000,
      Suite: 95000,
    };

    return SEED_ROOMS.map((seed, idx) => {
      const price = typePrices[seed.typeName] || 35000;
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
