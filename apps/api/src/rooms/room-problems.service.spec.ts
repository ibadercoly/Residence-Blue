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
    it('chambre libre : passe en MAINTENANCE si panne bloquante et requiert accord directeur si signalé par ménage', async () => {
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
      expect(result.directorApproved).toBe(false);

      expect(mockPrisma.room.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleRoomFree.id },
          data: expect.objectContaining({ status: RoomStatus.MAINTENANCE }),
        }),
      );

      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'MAINTENANCE',
          type: 'ACCORD_DIRECTEUR_REQUIS',
          title: expect.stringContaining('Chambre 101'),
        }),
      );
    });

    it('cuisinier signale une panne majeure : directorApproved=false et notification ACCORD_DIRECTEUR_REQUIS', async () => {
      const result = await service.reportProblem(
        sampleRoomFree.id,
        {
          type: 'ELECTRICITE',
          description: 'Disjoncteur chambre déclenché suite court-circuit',
        },
        { id: 'user-cuisine-1', role: Role.RESTAURANT, firstName: 'Mamadou', lastName: 'Diallo' },
      );

      expect(result.blocksRental).toBe(true);
      expect(result.directorApproved).toBe(false);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ACCORD_DIRECTEUR_REQUIS',
          title: expect.stringContaining('Chambre 101'),
        }),
      );
    });

    it('assistant de réception rend la chambre louable malgré une panne majeure : accord du directeur toujours requis', async () => {
      const result = await service.reportProblem(
        sampleRoomFree.id,
        {
          type: 'FUITE_EAU',
          description: 'Fuite signalée par l’assistant de réception',
          blocksRental: false,
        },
        { id: 'user-rec-1', role: Role.RECEPTION, firstName: 'Fatou', lastName: 'Sow' },
      );

      expect(result.blocksRental).toBe(false);
      expect(result.directorApproved).toBe(false);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ACCORD_DIRECTEUR_REQUIS',
        }),
      );
    });

    it('directeur signale directement : auto-approuvé (directorApproved=true)', async () => {
      const result = await service.reportProblem(
        sampleRoomFree.id,
        {
          type: 'CLIMATISATION',
          description: 'Contrôlé par la direction',
        },
        { id: 'dir-1', role: Role.DIRECTION, firstName: 'Directeur', lastName: 'Général' },
      );

      expect(result.blocksRental).toBe(true);
      expect(result.directorApproved).toBe(true);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PANNE_SIGNALEE',
        }),
      );
    });

    it('chambre occupée : NE passe PAS en MAINTENANCE (reste OCCUPIED) et wasOccupied=true', async () => {
      const result = await service.reportProblem(
        sampleRoomOccupied.id,
        {
          type: 'FUITE_EAU',
          description: 'Fuite sous le lavabo',
        },
        { id: 'user-rec-1', role: Role.RECEPTION, firstName: 'Fatou', lastName: 'Sow' },
      );

      expect(result.wasOccupied).toBe(true);
      expect(result.directorApproved).toBe(false);
      expect(mockPrisma.room.update).not.toHaveBeenCalled();
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'MAINTENANCE',
          type: 'ACCORD_DIRECTEUR_REQUIS',
          title: expect.stringContaining('Chambre 102'),
        }),
      );
    });
  });

  describe('acknowledgeProblem (Prise en charge technicien & Règle accord directeur)', () => {
    it('refuse l’intervention (ConflictException) si panne majeure non autorisée par le directeur', async () => {
      const existingProblem = {
        id: 'prob-unapproved',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'CLIMATISATION',
        status: 'REPORTED',
        blocksRental: true,
        directorApproved: false,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(existingProblem);

      await expect(
        service.acknowledgeProblem('prob-unapproved', {
          id: 'tech-uuid-1',
          role: Role.MAINTENANCE,
          firstName: 'Ousmane',
          lastName: 'Cissé',
        }),
      ).rejects.toThrow('accord préalable du directeur');
    });

    it('passe en IN_PROGRESS avec l’identité du technicien quand la panne est approuvée par le directeur', async () => {
      const existingProblem = {
        id: 'prob-approved',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'CLIMATISATION',
        status: 'REPORTED',
        blocksRental: true,
        directorApproved: true,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(existingProblem);

      const result = await service.acknowledgeProblem(
        'prob-approved',
        { id: 'tech-uuid-1', role: Role.MAINTENANCE, firstName: 'Ousmane', lastName: 'Cissé' },
      );

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Chambre 101 : le technicien s'en occupe",
        }),
      );
    });

    it('une panne mineure (ampoule) est pris en charge sans accord du directeur', async () => {
      const minorProblem = {
        id: 'prob-ampoule',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'AMPOULE',
        status: 'REPORTED',
        blocksRental: true,
        directorApproved: false,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(minorProblem);

      const result = await service.acknowledgeProblem('prob-ampoule', {
        id: 'tech-1',
        role: Role.MAINTENANCE,
        firstName: 'Ousmane',
        lastName: 'Cissé',
      });

      expect(result.status).toBe('IN_PROGRESS');
    });
  });

  describe('toggleBlocking (Louable malgré ce problème)', () => {
    it('ne donne PAS l’autorisation de réparer une panne majeure au technicien qui retire le blocage', async () => {
      const majorProblem = {
        id: 'prob-major-toggle',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'CLIMATISATION',
        status: 'REPORTED',
        blocksRental: true,
        directorApproved: false,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(majorProblem);

      const toggled = await service.toggleBlocking(
        'prob-major-toggle',
        { id: 'tech-1', role: Role.MAINTENANCE, firstName: 'Ousmane', lastName: 'Cissé' },
      );

      expect(toggled.blocksRental).toBe(false);
      expect(toggled.directorApproved).toBe(false);

      // Le verrou reste actif même si la chambre est de nouveau louable.
      mockPrisma.roomProblem.findUnique.mockResolvedValue({
        ...majorProblem,
        blocksRental: false,
        directorApproved: false,
      });
      await expect(
        service.acknowledgeProblem('prob-major-toggle', {
          id: 'tech-1',
          role: Role.MAINTENANCE,
          firstName: 'Ousmane',
          lastName: 'Cissé',
        }),
      ).rejects.toThrow('accord préalable du directeur');
    });
  });

  describe('approveProblem (Autorisation directeur)', () => {
    it('accorde l’autorisation, met directorApproved=true et notifie l’équipe technique', async () => {
      const pendingProblem = {
        id: 'prob-pending-1',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'CLIMATISATION',
        status: 'REPORTED',
        blocksRental: true,
        directorApproved: false,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(pendingProblem);

      const result = await service.approveProblem(
        'prob-pending-1',
        { id: 'dir-uuid', role: Role.DIRECTION, fullName: 'M. Le Directeur' },
      );

      expect(result.directorApproved).toBe(true);
      expect(mockNotificationsService.createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'MAINTENANCE',
          type: 'PANNE_AUTORISEE',
          title: expect.stringContaining('intervention autorisée par la direction'),
        }),
      );
    });
  });

  describe('resolveProblem (Résolution de panne)', () => {
    it('refuse la résolution si la panne majeure n’est pas approuvée par le directeur', async () => {
      const existingProblem = {
        id: 'prob-unapproved',
        roomId: sampleRoomFree.id,
        room: sampleRoomFree,
        type: 'CLIMATISATION',
        status: 'IN_PROGRESS',
        blocksRental: true,
        directorApproved: false,
        wasOccupied: false,
      };
      mockPrisma.roomProblem.findUnique.mockResolvedValue(existingProblem);

      await expect(
        service.resolveProblem(
          'prob-unapproved',
          {},
          { id: 'tech-1', role: Role.MAINTENANCE },
        ),
      ).rejects.toThrow('autorisation préalable du directeur');
    });

    it('chambre libre sans autre panne bloquante et propre : redevient FREE si approuvée', async () => {
      const existingProblem = {
        id: 'prob-1',
        roomId: sampleRoomFree.id,
        room: { ...sampleRoomFree, isClean: true },
        type: 'CLIMATISATION',
        status: 'IN_PROGRESS',
        blocksRental: true,
        directorApproved: true,
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
        directorApproved: true,
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
