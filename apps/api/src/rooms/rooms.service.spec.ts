import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { RoomsService } from './rooms.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role, RoomStatus } from '@residence-blue/shared';

describe('RoomsService (Tests Unitaires Métier)', () => {
  let service: RoomsService;
  let mockPrisma: any;

  const sampleRoom = {
    id: 'a0000000-0000-0000-0000-000000000101',
    number: '101',
    typeId: 'b0000000-0000-0000-0000-000000000001',
    floor: 1,
    status: 'FREE',
    amenities: ['Climatisation', 'Wi-Fi Fibre'],
    type: {
      id: 'b0000000-0000-0000-0000-000000000001',
      name: 'Standard',
      pricePerNight: 35000,
    },
  };

  beforeEach(async () => {
    mockPrisma = {
      room: {
        findMany: jest.fn().mockResolvedValue([sampleRoom]),
        findUnique: jest.fn().mockImplementation(({ where }: { where: { id: string } }) => {
          if (where.id === sampleRoom.id) {
            return Promise.resolve(sampleRoom);
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }: { data: { status: string } }) =>
          Promise.resolve({ ...sampleRoom, status: data.status }),
        ),
      },
      roomType: {
        findUnique: jest.fn().mockResolvedValue(sampleRoom.type),
        create: jest.fn().mockResolvedValue(sampleRoom.type),
        update: jest.fn().mockResolvedValue(sampleRoom.type),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-uuid-1' }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoomsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<RoomsService>(RoomsService);
  });

  describe('findAll & findOne', () => {
    it('doit lister toutes les chambres ordonnées', async () => {
      const rooms = await service.findAll();
      expect(rooms).toHaveLength(1);
      expect(rooms[0].number).toBe('101');
    });

    it('doit lever NotFoundException pour un UUID inexistant', async () => {
      await expect(
        service.findOne('00000000-0000-0000-0000-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });

    it('doit lever NotFoundException pour un format non-UUID', async () => {
      await expect(service.findOne('invalid-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus & Machine à états', () => {
    it('doit autoriser le check-in (FREE -> OCCUPIED) pour RECEPTION et créer un log d’audit', async () => {
      const updated = await service.updateStatus(
        sampleRoom.id,
        { status: RoomStatus.OCCUPIED, reason: 'Check-in client' },
        Role.RECEPTION,
        'user-uuid-1',
        '127.0.0.1',
      );

      expect(updated.status).toBe(RoomStatus.OCCUPIED);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ROOM_STATUS_CHANGE',
            entity: 'Room',
            entityId: sampleRoom.id,
            before: expect.objectContaining({ status: RoomStatus.FREE }),
            after: expect.objectContaining({ status: RoomStatus.OCCUPIED }),
          }),
        }),
      );
    });

    it('doit REJETER catégoriquement la transition OCCUPIED -> FREE même pour DIRECTION', async () => {
      mockPrisma.room.findUnique.mockResolvedValueOnce({
        ...sampleRoom,
        status: RoomStatus.OCCUPIED,
      });

      await expect(
        service.updateStatus(
          sampleRoom.id,
          { status: RoomStatus.FREE },
          Role.DIRECTION,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('doit REJETER la transition si le rôle n’est pas habilité (ex: RESTAURANT)', async () => {
      await expect(
        service.updateStatus(
          sampleRoom.id,
          { status: RoomStatus.OCCUPIED },
          Role.RESTAURANT,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Gestion des tarifs (RoomType)', () => {
    it('doit créer une catégorie et enregistrer une trace d’audit', async () => {
      const type = await service.createRoomType(
        { name: 'Standard', pricePerNight: 35000 },
        'admin-uuid',
        '127.0.0.1',
      );

      expect(type.name).toBe('Standard');
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'ROOM_TYPE_CREATE' }),
        }),
      );
    });
  });
});
