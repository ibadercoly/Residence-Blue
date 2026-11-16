import { RoomsService, RoomUiItem, formatRoomAlertMessage } from './rooms.service';
import { IdbService } from '../offline/idb.service';
import { OutboxService } from '../offline/outbox.service';
import { NetworkService } from '../offline/network.service';
import { RoomStatus, Role } from '@residence-blue/shared';
import { signal } from '@angular/core';

const TEST_ROOMS: RoomUiItem[] = [
  { id: 'r-101', number: '101', typeId: 't-std', floor: 1, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-std', name: 'Standard', pricePerNight: 35000 } },
  { id: 'r-102', number: '102', typeId: 't-std', floor: 1, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-std', name: 'Standard', pricePerNight: 35000 } },
  { id: 'r-103', number: '103', typeId: 't-std', floor: 1, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-std', name: 'Standard', pricePerNight: 35000 } },
  { id: 'r-104', number: '104', typeId: 't-std', floor: 1, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-std', name: 'Standard', pricePerNight: 35000 } },
  { id: 'r-105', number: '105', typeId: 't-std', floor: 1, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-std', name: 'Standard', pricePerNight: 35000 } },
  { id: 'r-106', number: '106', typeId: 't-std', floor: 1, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-std', name: 'Standard', pricePerNight: 35000 } },
  { id: 'r-201', number: '201', typeId: 't-dlx', floor: 2, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-dlx', name: 'Deluxe', pricePerNight: 55000 } },
  { id: 'r-202', number: '202', typeId: 't-dlx', floor: 2, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-dlx', name: 'Deluxe', pricePerNight: 55000 } },
  { id: 'r-203', number: '203', typeId: 't-dlx', floor: 2, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-dlx', name: 'Deluxe', pricePerNight: 55000 } },
  { id: 'r-204', number: '204', typeId: 't-dlx', floor: 2, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-dlx', name: 'Deluxe', pricePerNight: 55000 } },
  { id: 'r-301', number: '301', typeId: 't-ste', floor: 3, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-ste', name: 'Suite', pricePerNight: 95000 } },
  { id: 'r-302', number: '302', typeId: 't-ste', floor: 3, status: RoomStatus.FREE, amenities: [], syncPending: false, type: { id: 't-ste', name: 'Suite', pricePerNight: 95000 } },
];

describe('RoomsService', () => {
  let service: RoomsService;
  let mockIdb: jest.Mocked<IdbService>;
  let mockOutbox: jest.Mocked<OutboxService>;
  let mockNetwork: jest.Mocked<NetworkService>;
  let mockRoleSig = signal<Role | null>(Role.DIRECTION);
  let mockAuth: any;

  beforeEach(() => {
    mockRoleSig = signal<Role | null>(Role.DIRECTION);
    mockAuth = {
      currentRole: mockRoleSig,
      isAuthenticated: () => true,
      getAuthHeaders: () => ({ Authorization: 'Bearer test-jwt' }),
    };
    // Reset fetch
    global.fetch = jest.fn();

    // Mock IndexedDB service
    mockIdb = {
      get: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
      put: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<IdbService>;

    // Mock Outbox service
    mockOutbox = {
      pendingCount: { set: jest.fn() },
      isSyncing: { set: jest.fn() },
      enqueue: jest.fn().mockResolvedValue({
        id: 'outbox-1',
        idempotencyKey: 'idem-1',
        type: 'PATCH_ROOM_STATUS',
        endpoint: '/api/rooms/101/status',
        payload: {},
        createdAt: Date.now(),
        status: 'PENDING',
        retryCount: 0,
      }),
      refreshPendingCount: jest.fn().mockResolvedValue(0),
      syncOutbox: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OutboxService>;

    // Mock Network service
    mockNetwork = {
      isOnline: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<NetworkService>;

    service = new RoomsService(mockIdb, mockOutbox, mockNetwork, mockAuth);
  });

  afterEach(() => {
    service?.stopLiveAlerts();
    jest.clearAllMocks();
  });

  describe('Initialisation', () => {
    it('ne doit injecter aucune chambre fictive quand IndexedDB et API sont vides', async () => {
      await service.initRooms();
      const rooms = service.rooms();

      expect(rooms).toHaveLength(0);
    });

    it('doit charger les chambres depuis IndexedDB si elles existent déjà en cache', async () => {
      const cachedRooms: RoomUiItem[] = [
        {
          id: 'room-101',
          number: '101',
          typeId: 'type-standard',
          floor: 1,
          status: RoomStatus.OCCUPIED,
          amenities: ['Climatisation'],
          syncPending: false,
          type: { id: 'type-standard', name: 'Standard', pricePerNight: 35000 },
        },
      ];
      mockIdb.getAll.mockResolvedValueOnce(cachedRooms);

      await service.initRooms();
      const rooms = service.rooms();

      expect(rooms).toHaveLength(1);
      expect(rooms[0].number).toBe('101');
      expect(rooms[0].status).toBe(RoomStatus.OCCUPIED);
    });
  });

  describe('Filtres et Statistiques (Signaux)', () => {
    beforeEach(async () => {
      mockIdb.getAll.mockResolvedValueOnce(TEST_ROOMS);
      await service.initRooms();
    });

    it('doit calculer correctement les compteurs initiaux', () => {
      const counts = service.counts();
      expect(counts.total).toBe(12);
      expect(counts.free).toBe(12);
      expect(counts.occupied).toBe(0);
      expect(counts.cleaning).toBe(0);
      expect(counts.maintenance).toBe(0);
      expect(counts.pendingSync).toBe(0);
    });

    it('doit filtrer les chambres par étage', () => {
      service.setFloor(1);
      const floor1Rooms = service.filteredRooms();
      expect(floor1Rooms).toHaveLength(6);
      expect(floor1Rooms.every((r) => r.floor === 1)).toBe(true);

      service.setFloor(3);
      const floor3Rooms = service.filteredRooms();
      expect(floor3Rooms).toHaveLength(2);
      expect(floor3Rooms.every((r) => r.floor === 3)).toBe(true);

      service.setFloor(null);
      expect(service.filteredRooms()).toHaveLength(12);
    });

    it('doit filtrer les chambres par statut', () => {
      service.setFilter(RoomStatus.OCCUPIED);
      expect(service.filteredRooms()).toHaveLength(0);

      service.setFilter(RoomStatus.FREE);
      expect(service.filteredRooms()).toHaveLength(12);

      service.setFilter('ALL');
      expect(service.filteredRooms()).toHaveLength(12);
    });
  });

  describe('Changement de Statut (Online et Offline)', () => {
    beforeEach(async () => {
      mockIdb.getAll.mockResolvedValueOnce(TEST_ROOMS);
      await service.initRooms();
    });

    it('doit refuser une transition interdite par la matrice des rôles (ex. HOUSEKEEPING vers OCCUPIED)', async () => {
      mockRoleSig.set(Role.HOUSEKEEPING);
      const room = service.rooms()[0]; // 101 FREE

      const success = await service.changeRoomStatus(room.id, RoomStatus.OCCUPIED);
      expect(success).toBe(false);
      expect(service.errorMessage()).toContain('non habilité');
      expect(room.status).toBe(RoomStatus.FREE);
    });

    it('doit refuser une transition interdite par la machine à états (ex. OCCUPIED vers FREE direct)', async () => {
      // Met d'abord la chambre à OCCUPIED
      mockRoleSig.set(Role.RECEPTION);
      const room = service.rooms()[0];
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...room, status: RoomStatus.OCCUPIED }),
      });
      await service.changeRoomStatus(room.id, RoomStatus.OCCUPIED);

      // Tente la transition directe OCCUPIED -> FREE
      const success = await service.changeRoomStatus(room.id, RoomStatus.FREE);
      expect(success).toBe(false);
      expect(service.errorMessage()).toContain('nettoyage');
    });

    it('doit réussir un changement de statut en ligne avec appel API réussi', async () => {
      mockRoleSig.set(Role.RECEPTION);
      const room = service.rooms()[0]; // 101 FREE

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...room,
          status: RoomStatus.OCCUPIED,
        }),
      });

      const success = await service.changeRoomStatus(room.id, RoomStatus.OCCUPIED);
      expect(success).toBe(true);

      const updated = service.rooms().find((r) => r.id === room.id);
      expect(updated?.status).toBe(RoomStatus.OCCUPIED);
      expect(updated?.syncPending).toBe(false);
      expect(mockIdb.put).toHaveBeenCalledWith('rooms', expect.objectContaining({ status: RoomStatus.OCCUPIED }));
    });

    it('doit mettre en file d attente hors-ligne (outbox) avec indicateur syncPending si le réseau est coupé', async () => {
      mockNetwork.isOnline.mockReturnValue(false);
      mockRoleSig.set(Role.RECEPTION);
      const room = service.rooms()[0]; // 101 FREE

      const success = await service.changeRoomStatus(room.id, RoomStatus.OCCUPIED);
      expect(success).toBe(true);

      const updated = service.rooms().find((r) => r.id === room.id);
      expect(updated?.status).toBe(RoomStatus.OCCUPIED);
      expect(updated?.syncPending).toBe(true);
      expect(mockOutbox.enqueue).toHaveBeenCalledWith(
        'PATCH_ROOM_STATUS',
        `/api/rooms/${room.id}/status`,
        expect.objectContaining({ status: RoomStatus.OCCUPIED }),
      );
      expect(service.counts().pendingSync).toBe(1);
    });

    it('doit annuler la mise à jour optimiste (rollback) si le serveur renvoie 400 ou 403', async () => {
      mockRoleSig.set(Role.RECEPTION);
      const room = service.rooms()[0]; // 101 FREE

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Transition rejetée par le serveur' }),
      });

      const success = await service.changeRoomStatus(room.id, RoomStatus.OCCUPIED);
      expect(success).toBe(false);

      const rolledBack = service.rooms().find((r) => r.id === room.id);
      expect(rolledBack?.status).toBe(RoomStatus.FREE);
      expect(rolledBack?.syncPending).toBe(false);
      expect(service.errorMessage()).toBe('Transition rejetée par le serveur');
    });
  });

  describe('Synchronisation Outbox', () => {
    it('doit déclencher outbox.syncOutbox et actualiser depuis le serveur', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await service.syncOutbox();
      expect(mockOutbox.syncOutbox).toHaveBeenCalled();
    });
  });

  describe('Masquage strict des tarifs (sans prix inventés)', () => {
    it('ne doit jamais inventer 35000/55000/95000 quand pricePerNight est null ou sans voir_montants', async () => {
      mockAuth.hasPermission = () => false;
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'r-1', number: '101', floor: 1, status: RoomStatus.FREE, category: 'Standard', amenities: [], type: { id: 't1', name: 'Standard', pricePerNight: null } },
          { id: 'r-2', number: '301', floor: 3, status: RoomStatus.FREE, category: 'Suite', amenities: [], type: { id: 't3', name: 'Suite', pricePerNight: 95000 } },
        ],
      });

      await service.fetchFromServer();
      const loaded = service.rooms();
      expect(loaded).toHaveLength(2);
      expect(loaded[0].type?.pricePerNight).toBeNull();
      expect(loaded[1].type?.pricePerNight).toBeNull();
    });
  });

  describe('Alertes temps r\u00e9el et formatage', () => {
    it('formate les messages courts attendus pour propre et probl\u00e8me signal\u00e9', () => {
      expect(formatRoomAlertMessage('204', RoomStatus.FREE)).toBe(
        'Chambre 204 : propre, pr\u00eate \u00e0 louer',
      );
      expect(formatRoomAlertMessage('204', RoomStatus.MAINTENANCE, "fuite d'eau")).toBe(
        "Chambre 204 : probl\u00e8me signal\u00e9 (fuite d'eau)",
      );
    });

    it("n'autorise les alertes que pour RECEPTION, DIRECTION et Technique (MAINTENANCE)", () => {
      for (const allowed of [Role.RECEPTION, Role.DIRECTION, Role.MAINTENANCE]) {
        mockRoleSig.set(allowed);
        expect(service.canReceiveRoomAlerts()).toBe(true);
      }
      for (const denied of [Role.HOUSEKEEPING, Role.RESTAURANT, Role.CUISINIER, Role.COMPTABLE]) {
        mockRoleSig.set(denied);
        expect(service.canReceiveRoomAlerts()).toBe(false);
      }
    });

    it('bascule le son optionnel et marque les alertes comme lues', async () => {
      expect(service.soundEnabled()).toBe(false);
      service.toggleAlertSound();
      expect(service.soundEnabled()).toBe(true);
      service.toggleAlertSound();
      expect(service.soundEnabled()).toBe(false);

      mockRoleSig.set(Role.RECEPTION);
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'r-204', number: '204', floor: 2, status: RoomStatus.CLEANING, category: 'Deluxe', amenities: [], type: { id: 't2', name: 'Deluxe', pricePerNight: 55000 } },
        ],
      });
      await service.fetchFromServer();
      expect(service.unreadAlertsCount()).toBe(0);

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { id: 'r-204', number: '204', floor: 2, status: RoomStatus.FREE, category: 'Deluxe', amenities: [], type: { id: 't2', name: 'Deluxe', pricePerNight: 55000 } },
        ],
      });
      await service.fetchFromServer();
      expect(service.unreadAlertsCount()).toBe(1);
      expect(service.roomAlerts()[0].message).toBe('Chambre 204 : propre, pr\u00eate \u00e0 louer');

      service.markAllAlertsRead();
      expect(service.unreadAlertsCount()).toBe(0);
    });
  });
});
