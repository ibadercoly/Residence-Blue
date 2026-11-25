import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomProblemsService } from './room-problems.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BadRequestException } from '@nestjs/common';
import { Role, RoomStatus } from '@residence-blue/shared';

describe('RoomProblemsService (Tests Unitaires Règles Pannes & Propreté)', () => {
  let service: RoomProblemsService;
  let mockPrisma: any;
  let mockNotificationsService: any;

  const sampleRoomFree = {
    id: '11111111-1111-1111-1111-111111111101',
    number: '101',
    status: RoomStatus.FREE,
    isClean: true,
    reservations: [],
  };

  const sampleRoomOccupied = {
    id: '11111111-1111-1111-1111-111111111102',
    number: '102',
    status: RoomStatus.OCCUPIED,
    isClean: true,
    reservations: [
      {
        id: 'res-uuid-1',
        status: 'CHECKED_IN',
        guest: { fullName: 'Moussa Diop' },
      },
    ],
  };

  beforeEach(async () => {
    mockNotificationsService = {
      createNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
    };

    mockPrisma = {
      room: {
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === sampleRoomFree.id) return Promise.resolve({ ...sampleRoomFree });
          if (where.id === sampleRoomOccupied.id) return Promise.resolve({ ...sampleRoomOccupied });
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ where, data }: any) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      },
      roomProblem: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'prob-uuid-1',
            createdAt: new Date(),
            updatedAt: new Date(),
            status: 'REPORTED',
            ...data,
          }),
        ),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(({ where, data }: any) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (callback: any) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomProblemsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<RoomProblemsService>(RoomProblemsService);
  });

  describe('reportProblem', () => {
    it('chambre libre : passe en MAINTENANCE si panne bloquante et émet notification', async () => {
      const result = await service.reportProblem(
        sampleRoomFree.id,
        {
          type: 'CLIMATISATION',
          description: 'Ne souffle que de l’air tiède',
        },
        { id: 'user-menage-1', role: Role.HOUSEKEEPING, firstName: 'Awa', lastName: 'Ndiaye' },
      );

      expect(result.type).toBe('CLIMATISATION');
      expect(result.blocksRental).toBe(true);
      expect(result.wasOccupied).toBe(false);

      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleRoomFree.id },
          data: expect.objectContaining({ status: RoomStatus.MAINTENANCE }),
        }),
      );

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'MAINTENANCE',
          type: 'PANNE_SIGNALEE',
          title: expect.stringContaining('Chambre 101'),
        }),
      );
    });

    it('chambre occupée : NE passe PAS en MAINTENANCE (reste OCCUPIED) et wasOccupied=true', async () => {
      const result = await service.reportProblem(
        sampleRoomOccupied.id,
        {
          type: 'PLOMBERIE',
          description: 'Fuite sous le lavabo',
        },
        { id: 'user-rec-1', role: Role.RECEPTION, firstName: 'Fatou', lastName: 'Sow' },
      );

      expect(result.wasOccupied).toBe(true);
      expect(mockPrisma.room.update).not.toHaveBeenCalled();
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'MAINTENANCE',
          title: expect.stringContaining('Chambre 102'),
          detail: 'Client présent : prévenir avant d’entrer',
        }),
      );
    });
  });

  describe('acknowledgeProblem (Prise en charge technicien)', () => {
    it('passe en IN_PROGRESS avec l’identité du technicien et émet la notification', async () => {
      const existingProblem = {
        id: 'prob-1',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'CLIMATISATION',
        status: 'REPORTED',
        blocksRental: true,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(existingProblem);

      const result = await service.acknowledgeProblem(
        'prob-1',
        { id: 'tech-uuid-1', role: Role.MAINTENANCE, firstName: 'Ousmane', lastName: 'Cissé' },
      );

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Chambre 101 : le technicien s'en occupe",
        }),
      );
    });
  });

  describe('resolveProblem (Résolution de panne)', () => {
    it('chambre libre sans autre panne bloquante et propre : redevient FREE', async () => {
      const existingProblem = {
        id: 'prob-1',
        roomId: sampleRoomFree.id,
        room: { ...sampleRoomFree, isClean: true },
        type: 'CLIMATISATION',
        status: 'IN_PROGRESS',
        blocksRental: true,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(existingProblem);
      mockPrisma.roomProblem.findMany.mockResolvedValue([]); // Aucun autre problème

      const result = await service.resolveProblem(
        'prob-1',
        { resolutionNote: 'Recharge fluide frigorigène effectuée' },
        { id: 'tech-uuid-1', role: Role.MAINTENANCE, firstName: 'Ousmane', lastName: 'Cissé' },
      );

      expect(result.status).toBe('RESOLVED');
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleRoomFree.id },
          data: expect.objectContaining({ status: RoomStatus.FREE }),
        }),
      );
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Chambre 101 : climatisation réparée, chambre de nouveau louable',
        }),
      );
    });

    it('chambre libre mais sale : redevient CLEANING', async () => {
      const existingProblem = {
        id: 'prob-1',
        roomId: sampleRoomFree.id,
        room: { ...sampleRoomFree, isClean: false },
        type: 'CLIMATISATION',
        status: 'IN_PROGRESS',
        blocksRental: true,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(existingProblem);
      mockPrisma.roomProblem.findMany.mockResolvedValue([]);

      await service.resolveProblem(
        'prob-1',
        {},
        { id: 'tech-uuid-1', role: Role.MAINTENANCE, firstName: 'Ousmane', lastName: 'Cissé' },
      );

      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleRoomFree.id },
          data: expect.objectContaining({ status: RoomStatus.CLEANING }),
        }),
      );
    });
  });

  describe('updateCleanliness (Nettoyage indépendant)', () => {
    it('nettoyer une chambre occupée : isClean=true sans changer le statut OCCUPIED', async () => {
      const res = await service.updateCleanliness(
        sampleRoomOccupied.id,
        { isClean: true },
        { id: 'menage-1', role: Role.HOUSEKEEPING },
      );

      expect(res.isClean).toBe(true);
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleRoomOccupied.id },
          data: expect.objectContaining({ isClean: true }),
        }),
      );
    });

    it('nettoyer une chambre avec panne bloquante : isClean=true mais statut reste MAINTENANCE', async () => {
      const roomWithProblem = {
        ...sampleRoomFree,
        status: RoomStatus.MAINTENANCE,
        isClean: false,
      };
      mockPrisma.room.findUnique.mockResolvedValue(roomWithProblem);
      mockPrisma.roomProblem.findMany.mockResolvedValue([{ id: 'p1', blocksRental: true }]);
      mockPrisma.roomProblem.count.mockResolvedValue(1);

      const res = await service.updateCleanliness(
        roomWithProblem.id,
        { isClean: true },
        { id: 'menage-1', role: Role.HOUSEKEEPING },
      );

      expect(res.isClean).toBe(true);
      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: roomWithProblem.id },
          data: { isClean: true, status: RoomStatus.MAINTENANCE },
        }),
      );
    });
  });

  describe('cancelProblem (Annulation par erreur)', () => {
    it('rejette si motif vide', async () => {
      mockPrisma.roomProblem.findUnique.mockResolvedValue({
        id: 'prob-1',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        status: 'REPORTED',
      });
      await expect(
        service.cancelProblem('prob-1', { cancellationReason: '   ' }, { id: 'u1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
