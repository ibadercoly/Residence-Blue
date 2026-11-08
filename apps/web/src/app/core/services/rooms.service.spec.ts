import { RoomsService, RoomUiItem } from './rooms.service';
import { IdbService } from '../offline/idb.service';
import { OutboxService } from '../offline/outbox.service';
import { NetworkService } from '../offline/network.service';
import { RoomStatus, Role } from '@residence-blue/shared';

describe('RoomsService', () => {
  let service: RoomsService;
  let mockIdb: jest.Mocked<IdbService>;
  let mockOutbox: jest.Mocked<OutboxService>;
  let mockNetwork: jest.Mocked<NetworkService>;

  beforeEach(() => {
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

    service = new RoomsService(mockIdb, mockOutbox, mockNetwork);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialisation', () => {
    it('doit initialiser 12 chambres par défaut quand IndexedDB est vide', async () => {
      // Le constructeur a déjà appelé initRooms()
      const rooms = service.rooms();

      expect(rooms).toHaveLength(12);
      expect(mockIdb.put).toHaveBeenCalledWith('rooms', expect.objectContaining({ number: '101' }));
      expect(rooms[0].number).toBe('101');
      expect(rooms[0].type?.pricePerNight).toBe(35000);
      expect(rooms[11].number).toBe('302');
      expect(rooms[11].type?.pricePerNight).toBe(95000);
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
      await service.initRooms();
    });

    it('doit refuser une transition interdite par la matrice des rôles (ex. HOUSEKEEPING vers OCCUPIED)', async () => {
      service.setRole(Role.HOUSEKEEPING);
      const room = service.rooms()[0]; // 101 FREE

      const success = await service.changeRoomStatus(room.id, RoomStatus.OCCUPIED);
      expect(success).toBe(false);
      expect(service.errorMessage()).toContain('non habilité');
      expect(room.status).toBe(RoomStatus.FREE);
    });

    it('doit refuser une transition interdite par la machine à états (ex. OCCUPIED vers FREE direct)', async () => {
      // Met d'abord la chambre à OCCUPIED
      service.setRole(Role.RECEPTION);
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
      service.setRole(Role.RECEPTION);
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
      service.setRole(Role.RECEPTION);
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
      service.setRole(Role.RECEPTION);
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
});
