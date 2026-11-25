import { jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { TechniqueService } from './technique.service';
import { PrismaService } from '../prisma/prisma.service';
import { RoomProblemsService } from '../rooms/room-problems.service';
import { RoomStatus } from '@residence-blue/shared';

describe('TechniqueService (Tests Unitaires Dashboard Technique & Confidentialité)', () => {
  let service: TechniqueService;
  let mockPrisma: any;
  let mockRoomProblemsService: any;

  const baseDate = new Date('2026-11-25T08:00:00Z');

  const rawProblems = [
    {
      id: 'prob-1',
      roomId: 'room-101',
      type: 'CLIMATISATION',
      description: 'Climatiseur fait du bruit',
      status: 'REPORTED',
      reportedAt: new Date(baseDate.getTime() + 1000),
      blocksRental: true,
      wasOccupied: false,
      room: {
        id: 'room-101',
        number: '101',
        status: RoomStatus.OCCUPIED,
        reservations: [{ id: 'res-1', status: 'CHECKED_IN', guest: { fullName: 'Secret Guest' } }],
      },
    },
    {
      id: 'prob-2',
      roomId: 'room-102',
      type: 'PLOMBERIE',
      description: 'Robinet fuit',
      status: 'REPORTED',
      reportedAt: new Date(baseDate.getTime() + 2000),
      blocksRental: true,
      wasOccupied: false,
      room: {
        id: 'room-102',
        number: '102',
        status: RoomStatus.FREE,
        reservations: [],
      },
    },
    {
      id: 'prob-3',
      roomId: 'room-103',
      type: 'ELECTRICITE',
      description: 'Prise défectueuse',
      status: 'IN_PROGRESS',
      reportedAt: baseDate,
      assignedToUserId: 'tech-1',
      assignedToName: 'Technicien Ali',
      blocksRental: false,
      wasOccupied: false,
      room: {
        id: 'room-103',
        number: '103',
        status: RoomStatus.FREE,
        reservations: [],
      },
    },
  ];

  beforeEach(async () => {
    mockPrisma = {
      roomProblem: {
        findMany: jest.fn().mockImplementation(({ where }: any) => {
          if (where?.status === 'REPORTED') {
            return Promise.resolve(rawProblems.filter((p) => p.status === 'REPORTED'));
          }
          if (where?.status === 'IN_PROGRESS') {
            return Promise.resolve(rawProblems.filter((p) => p.status === 'IN_PROGRESS'));
          }
          if (where?.status === 'RESOLVED') {
            return Promise.resolve(rawProblems.filter((p) => p.status === 'RESOLVED'));
          }
          return Promise.resolve(rawProblems);
        }),
        findUnique: jest.fn().mockImplementation(({ where }: any) => {
          const found = rawProblems.find((p) => p.id === where.id);
          return Promise.resolve(found || null);
        }),
      },
    };

    mockRoomProblemsService = {
      acknowledgeProblem: jest.fn(),
      resolveProblem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TechniqueService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RoomProblemsService, useValue: mockRoomProblemsService },
      ],
    }).compile();

    service = module.get<TechniqueService>(TechniqueService);
  });

  it('doit classer les pannes à traiter avec les chambres vides en priorité', async () => {
    const dashboard = await service.getDashboard();

    expect(dashboard.toTreat).toHaveLength(2);
    // Chambre 102 est vide -> doit apparaître avant chambre 101 occupée
    expect(dashboard.toTreat[0].roomNumber).toBe('102');
    expect(dashboard.toTreat[0].isCurrentlyOccupied).toBe(false);
    expect(dashboard.toTreat[1].roomNumber).toBe('101');
    expect(dashboard.toTreat[1].isCurrentlyOccupied).toBe(true);

    expect(dashboard.inProgress).toHaveLength(1);
    expect(dashboard.inProgress[0].roomNumber).toBe('103');
  });

  it('ne doit JAMAIS divulguer de nom de client, prix ou id de réservation', async () => {
    const dashboard = await service.getDashboard();
    const serialized = JSON.stringify(dashboard);

    expect(serialized).not.toContain('Secret Guest');
    expect(serialized).not.toContain('res-1');
    expect(serialized).not.toContain('price');
  });
});
