import { jest } from '@jest/globals';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Role, RoomInterventionStatus, RoomStatus } from '@residence-blue/shared';
import { RoomInterventionsService } from './room-interventions.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('RoomInterventionsService (Tests Unitaires Workflow Intervention)', () => {
  let service: RoomInterventionsService;
  let mockPrisma: any;
  let mockNotifications: any;

  const roomId = '11111111-1111-4111-8111-111111111101';
  const reqId = '22222222-2222-4222-8222-222222222201';
  const hkUserId = '33333333-3333-4333-8333-333333333301';
  const recUserId = '33333333-3333-4333-8333-333333333302';
  const dirUserId = '33333333-3333-4333-8333-333333333303';
  const techUserId = '33333333-3333-4333-8333-333333333304';

  const sampleRoom = {
    id: roomId,
    number: '101',
    floor: 1,
    category: 'Standard',
    status: RoomStatus.FREE,
  };

  beforeEach(async () => {
    mockNotifications = {
      createInterventionNotification: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      listInterventionNotificationsForRole: jest.fn().mockResolvedValue([]),
    };

    mockPrisma = {
      room: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) =>
          where.id === roomId ? { ...sampleRoom } : null,
        ),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
          ...sampleRoom,
          id: where.id,
          ...data,
        })),
      },
      roomInterventionRequest: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: reqId,
          ...data,
          room: sampleRoom,
          reportedBy: {
            id: data.reportedById,
            fullName: data.reportedById === hkUserId ? 'Awa Ménage' : 'Fatou Réception',
            email: 'staff@residenceblue.sn',
            role: data.reportedById === hkUserId ? Role.HOUSEKEEPING : Role.RECEPTION,
          },
          approvedBy: null,
          completedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
          id: where.id,
          roomId,
          reportedById: hkUserId,
          issueDescription: 'Fuite sous le lavabo',
          room: sampleRoom,
          reportedBy: { id: hkUserId, fullName: 'Awa Ménage', role: Role.HOUSEKEEPING },
          approvedBy: data.approvedById
            ? { id: data.approvedById, fullName: 'Directrice', role: Role.DIRECTION }
            : null,
          completedBy: data.completedById
            ? { id: data.completedById, fullName: 'Technicien', role: Role.MAINTENANCE }
            : null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        })),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomInterventionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(RoomInterventionsService);
  });

  it('crée une demande PENDING_DIRECTOR depuis HOUSEKEEPING et notifie uniquement DIRECTION', async () => {
    const res = await service.createRequest(
      roomId,
      { issueDescription: 'Fuite sous le lavabo' },
      { id: hkUserId, role: Role.HOUSEKEEPING, fullName: 'Awa Ménage' },
    );

    expect(res.status).toBe(RoomInterventionStatus.PENDING_DIRECTOR);
    expect(res.reportedById).toBe(hkUserId);
    expect(mockPrisma.room.update).not.toHaveBeenCalled();
    expect(mockNotifications.createInterventionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRoles: [Role.DIRECTION],
        type: 'INTERVENTION_DEMANDEE',
        roomNumber: '101',
      }),
    );
  });

  it('crée une demande PENDING_DIRECTOR depuis RECEPTION et enregistre reportedBy', async () => {
    const res = await service.createRequest(
      roomId,
      { issueDescription: 'Climatisation ne refroidit plus' },
      { id: recUserId, role: Role.RECEPTION, fullName: 'Fatou Réception' },
    );

    expect(res.status).toBe(RoomInterventionStatus.PENDING_DIRECTOR);
    expect(res.reportedById).toBe(recUserId);
    expect(mockNotifications.createInterventionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRoles: [Role.DIRECTION],
        type: 'INTERVENTION_DEMANDEE',
      }),
    );
  });

  it('approuve la demande (DIRECTION) -> APPROVED, passe la chambre en MAINTENANCE et notifie MAINTENANCE', async () => {
    mockPrisma.roomInterventionRequest.findUnique.mockResolvedValue({
      id: reqId,
      roomId,
      room: sampleRoom,
      reportedById: hkUserId,
      issueDescription: 'Fuite sous le lavabo',
      status: RoomInterventionStatus.PENDING_DIRECTOR,
    });

    const res = await service.approveRequest(reqId, {
      id: dirUserId,
      role: Role.DIRECTION,
      fullName: 'Directrice',
    });

    expect(res.status).toBe(RoomInterventionStatus.APPROVED);
    expect(mockPrisma.room.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: roomId },
        data: expect.objectContaining({
          status: RoomStatus.MAINTENANCE,
          maintenanceReason: 'Fuite sous le lavabo',
        }),
      }),
    );
    expect(mockNotifications.createInterventionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRoles: [Role.MAINTENANCE],
        type: 'INTERVENTION_APPROUVEE',
        roomNumber: '101',
        title: expect.stringContaining('Fuite sous le lavabo'),
      }),
    );
  });

  it('refuse la demande (DIRECTION) -> REJECTED, ne passe pas en MAINTENANCE et notifie RECEPTION et HOUSEKEEPING', async () => {
    mockPrisma.roomInterventionRequest.findUnique.mockResolvedValue({
      id: reqId,
      roomId,
      room: sampleRoom,
      reportedById: recUserId,
      issueDescription: 'Fuite mineure',
      status: RoomInterventionStatus.PENDING_DIRECTOR,
    });

    const res = await service.rejectRequest(
      reqId,
      { reason: 'Attendre le départ du client' },
      { id: dirUserId, role: Role.DIRECTION },
    );

    expect(res.status).toBe(RoomInterventionStatus.REJECTED);
    expect(mockPrisma.room.update).not.toHaveBeenCalled();
    expect(mockNotifications.createInterventionNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRoles: [Role.RECEPTION, Role.HOUSEKEEPING],
        type: 'INTERVENTION_REFUSEE',
        title: expect.stringContaining('Attendre le départ du client'),
      }),
    );
  });

  it('complète une intervention APPROVED (MAINTENANCE) -> COMPLETED et remet la chambre en CLEANING', async () => {
    mockPrisma.roomInterventionRequest.findUnique.mockResolvedValue({
      id: reqId,
      roomId,
      room: { ...sampleRoom, status: RoomStatus.MAINTENANCE },
      reportedById: hkUserId,
      issueDescription: 'Fuite sous le lavabo',
      status: RoomInterventionStatus.APPROVED,
    });

    const res = await service.completeRequest(reqId, {
      id: techUserId,
      role: Role.MAINTENANCE,
    });

    expect(res.status).toBe(RoomInterventionStatus.COMPLETED);
    expect(mockPrisma.room.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: roomId },
        data: { status: RoomStatus.CLEANING, maintenanceReason: null },
      }),
    );
  });

  it('refuse complete si la demande n’est pas APPROVED (409) ou introuvable (404)', async () => {
    mockPrisma.roomInterventionRequest.findUnique.mockResolvedValueOnce({
      id: reqId,
      roomId,
      room: sampleRoom,
      status: RoomInterventionStatus.PENDING_DIRECTOR,
    });

    await expect(
      service.completeRequest(reqId, { id: techUserId, role: Role.MAINTENANCE }),
    ).rejects.toThrow(ConflictException);

    await expect(
      service.approveRequest('not-a-uuid', { id: dirUserId, role: Role.DIRECTION }),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuse (409) à la Réception de créer ou modifier une demande lorsqu’un signalement du Ménage est déjà en attente', async () => {
    mockPrisma.roomInterventionRequest.findFirst.mockResolvedValueOnce({
      id: reqId,
      roomId,
      status: RoomInterventionStatus.PENDING_DIRECTOR,
      reportedBy: { role: Role.HOUSEKEEPING },
    });

    await expect(
      service.createRequest(
        roomId,
        { issueDescription: 'Tentative interaction assistant' },
        { id: recUserId, role: Role.RECEPTION },
      ),
    ).rejects.toThrow(ConflictException);
  });
});
