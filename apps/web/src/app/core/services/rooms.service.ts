import { Injectable, signal, computed } from '@angular/core';
import { IdbService } from '../offline/idb.service';
import { OutboxService } from '../offline/outbox.service';
import { NetworkService } from '../offline/network.service';
import {
  RoomDto,
  RoomStatus,
  SEED_ROOMS,
  Role,
  isRoomStatusTransitionAllowed,
  getRoomImageUrl,
  getRoomImageAlt,
} from '@residence-blue/shared';

export interface RoomUiItem extends RoomDto {
  syncPending?: boolean;
  image?: string;
  imageUrl?: string;
  imageAlt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class RoomsService {
  readonly rooms = signal<RoomUiItem[]>([]);
  readonly currentRole = signal<Role>(Role.RECEPTION);
  readonly selectedFilter = signal<string>('ALL');
  readonly selectedFloor = signal<number | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly filteredRooms = computed(() => {
    let list = this.rooms();
    const filter = this.selectedFilter();
    const floor = this.selectedFloor();

    if (filter !== 'ALL') {
      list = list.filter((r) => r.status === filter);
    }
    if (floor !== null) {
      list = list.filter((r) => r.floor === floor);
    }
    return list;
  });

  readonly counts = computed(() => {
    const all = this.rooms();
    return {
      total: all.length,
      free: all.filter((r) => r.status === RoomStatus.FREE).length,
      occupied: all.filter((r) => r.status === RoomStatus.OCCUPIED).length,
      cleaning: all.filter((r) => r.status === RoomStatus.CLEANING).length,
      maintenance: all.filter((r) => r.status === RoomStatus.MAINTENANCE).length,
      pendingSync: all.filter((r) => r.syncPending).length,
    };
  });

  constructor(
    private readonly idb: IdbService,
    private readonly outbox: OutboxService,
    private readonly network: NetworkService,
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
      // 1. Lecture locale depuis IndexedDB
      const cached = await this.idb.getAll<RoomUiItem>('rooms');
      if (cached && cached.length > 0) {
        // Migration ou rafraîchissement des URLs d'images si manquantes ou obsolètes
        const enriched = cached.map((r) => ({
          ...r,
          imageUrl: r.imageUrl || getRoomImageUrl(r.number),
          imageAlt: r.imageAlt || getRoomImageAlt(r.number),
          image: r.imageUrl || getRoomImageUrl(r.number),
        }));
        this.rooms.set(this.sortRooms(enriched));
      } else {
        // Peuplement par défaut si IndexedDB est vide
        const initialRooms = this.buildInitialRooms();
        for (const r of initialRooms) {
          await this.idb.put('rooms', r);
        }
        this.rooms.set(initialRooms);
      }

      // 2. Synchronisation réseau en tâche de fond si connecté
      if (this.network.isOnline()) {
        await this.fetchFromServer();
      }
    } catch {
      // En cas d'erreur IndexedDB, repli sur le catalogue en mémoire
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
          const imgUrl = sr.imageUrl || getRoomImageUrl(sr.number);
          const imgAlt = sr.imageAlt || getRoomImageAlt(sr.number);
          return {
            ...sr,
            image: imgUrl,
            imageUrl: imgUrl,
            imageAlt: imgAlt,
            // Si une modification locale est toujours dans l'outbox, on garde le flag syncPending
            syncPending: currentLocal?.syncPending || false,
            status: currentLocal?.syncPending ? currentLocal.status : sr.status,
          };
        });

        this.rooms.set(this.sortRooms(merged));
        for (const r of merged) {
          await this.idb.put('rooms', r);
        }
      }
    } catch {
      // Échec réseau transparent : le mode hors-ligne prend le relais
    }
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

    // Validation métier immédiate côté client selon la machine à états
    const check = isRoomStatusTransitionAllowed(room.status, targetStatus, this.currentRole());
    if (!check.allowed) {
      this.errorMessage.set(check.reason || 'Transition non autorisée.');
      return false;
    }

    const previousStatus = room.status;

    // Mise à jour optimiste immédiate de l'UI
    this.rooms.update((list) =>
      list.map((r) => (r.id === roomId ? { ...r, status: targetStatus, syncPending: true } : r)),
    );

    // Sauvegarde immédiate dans IndexedDB
    const updatedRoom = this.rooms().find((r) => r.id === roomId)!;
    await this.idb.put('rooms', updatedRoom);

    // Si hors ligne : mise en file d'attente dans l'Outbox
    if (!this.network.isOnline()) {
      await this.outbox.enqueue('PATCH_ROOM_STATUS', `/api/rooms/${roomId}/status`, {
        status: targetStatus,
        reason,
      });
      this.successMessage.set(
        `Statut changé vers ${targetStatus} (enregistré hors-ligne, en attente de synchronisation).`,
      );
      return true;
    }

    // Si en ligne : appel réseau direct
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
        // Si le serveur a rejeté pour règle métier ou droits, rollback de la mise à jour optimiste
        if (response.status === 400 || response.status === 403) {
          const rollbackRoom: RoomUiItem = { ...room, status: previousStatus, syncPending: false };
          this.rooms.update((list) =>
            list.map((r) => (r.id === roomId ? rollbackRoom : r)),
          );
          await this.idb.put('rooms', rollbackRoom);
          return false;
        }
        throw new Error(errorData.message || 'Erreur serveur lors de la mise à jour.');
      }

      // Succès confirmé par le serveur : retrait du flag syncPending
      this.rooms.update((list) =>
        list.map((r) => (r.id === roomId ? { ...r, syncPending: false } : r)),
      );
      const syncedRoom = this.rooms().find((r) => r.id === roomId)!;
      await this.idb.put('rooms', syncedRoom);

      this.successMessage.set(`Chambre ${room.number} : statut mis à jour (${targetStatus}).`);
      return true;
    } catch {
      // En cas de panne réseau inattendue, repli sur l'outbox
      await this.outbox.enqueue('PATCH_ROOM_STATUS', `/api/rooms/${roomId}/status`, {
        status: targetStatus,
        reason,
      });
      this.successMessage.set(
        `Connexion perturbée : action enregistrée dans la file hors-ligne.`,
      );
      return true;
    }
  }

  /**
   * Synchronisation manuelle ou automatique de l'outbox.
   */
  async syncOutbox(): Promise<void> {
    await this.outbox.syncOutbox();
    // Rafraîchissement depuis le serveur
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

  private sortRooms(list: RoomUiItem[]): RoomUiItem[] {
    return [...list].sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.number.localeCompare(b.number);
    });
  }

  private buildInitialRooms(): RoomUiItem[] {
    const typePrices: Record<string, number> = {
      Standard: 35000,
      Deluxe: 55000,
      Suite: 95000,
    };

    return SEED_ROOMS.map((seed, idx) => ({
      id: `00000000-0000-0000-0000-${(100 + idx + 1).toString().padStart(12, '0')}`,
      number: seed.number,
      typeId: `type-${seed.typeName.toLowerCase()}`,
      floor: seed.floor,
      status: RoomStatus.FREE,
      amenities: seed.amenities,
      syncPending: false,
      image: seed.imageUrl || getRoomImageUrl(seed.number),
      imageUrl: seed.imageUrl || getRoomImageUrl(seed.number),
      imageAlt: seed.imageAlt || getRoomImageAlt(seed.number),
      type: {
        id: `type-${seed.typeName.toLowerCase()}`,
        name: seed.typeName,
        pricePerNight: typePrices[seed.typeName] || 35000,
      },
    }));
  }
}
