import { jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@residence-blue/shared';
import {
  AccueilService,
  getDakarDayBounds,
  resolveVisibleAccueilBlocks,
} from './accueil.service';

describe('AccueilService', () => {
  it('calcule strictement la fenêtre 00:00 -> 23:59 heure de Dakar (UTC+0)', () => {
    // 23:30 UTC le 12 nov = 00:30 à Paris (J+1), mais encore 23:30 le 12 nov à Dakar
    const dakarNightUtc = new Date('2026-11-12T23:30:00.000Z');
    const b1 = getDakarDayBounds(dakarNightUtc);
    expect(b1.dateDakarIso).toBe('2026-11-12');
    expect(b1.startOfDay.toISOString()).toBe('2026-11-12T00:00:00.000Z');
    expect(b1.endOfDay.toISOString()).toBe('2026-11-13T00:00:00.000Z');

    // Bascule exactement à 00:00:00.000 UTC (minuit Dakar)
    const dakarMidnight = new Date('2026-11-13T00:00:00.000Z');
    const b2 = getDakarDayBounds(dakarMidnight);
    expect(b2.dateDakarIso).toBe('2026-11-13');
    expect(b2.startOfDay.toISOString()).toBe('2026-11-13T00:00:00.000Z');
  });

  it('filtre les blocs autorisés et omet totalement les blocs interdits', async () => {
    expect(resolveVisibleAccueilBlocks(Role.DIRECTION)).toEqual([
      'CLIENTS',
      'BILLING',
      'RESTAURANT',
    ]);
    expect(resolveVisibleAccueilBlocks(Role.COMPTABLE)).toEqual([
      'CLIENTS',
      'BILLING',
      'RESTAURANT',
    ]);
    expect(resolveVisibleAccueilBlocks(Role.RECEPTION)).toEqual([
      'CLIENTS',
      'BILLING',
      'RESTAURANT',
    ]);
    expect(resolveVisibleAccueilBlocks(Role.RESTAURANT)).toEqual(['RESTAURANT']);
    expect(resolveVisibleAccueilBlocks(Role.HOUSEKEEPING)).toEqual(['CLIENTS']);
    expect(resolveVisibleAccueilBlocks(Role.MAINTENANCE)).toEqual(['CLIENTS']);

    const mockPrisma: any = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            status: 'CHECKED_IN',
            checkInDate: new Date('2026-11-12T00:00:00.000Z'),
            checkOutDate: new Date('2026-11-13T00:00:00.000Z'),
            guestId: 'g1',
          },
          {
            status: 'CHECKED_IN',
            checkInDate: new Date('2026-11-11T00:00:00.000Z'),
            checkOutDate: new Date('2026-11-14T00:00:00.000Z'),
            guestId: 'g2',
          },
        ]),
      },
      guest: {
        count: jest.fn().mockResolvedValue(1),
      },
      invoice: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalFcfa: 0, balanceFcfa: 0 }, _count: { _all: 0 } }),
      },
      payment: {
        groupBy: jest.fn().mockResolvedValue([]),
      },
      restaurantOrder: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new AccueilService(mockPrisma);

    const hkRes = await service.getDailyStats(Role.HOUSEKEEPING, new Date('2026-11-12T12:00:00.000Z'));
    expect(hkRes.clients).toBeDefined();
    expect('billing' in hkRes).toBe(false);
    expect('restaurant' in hkRes).toBe(false);
    expect(mockPrisma.invoice.aggregate).not.toHaveBeenCalled();

    const restoRes = await service.getDailyStats(Role.RESTAURANT, new Date('2026-11-12T12:00:00.000Z'));
    expect(restoRes.restaurant).toBeDefined();
    expect('clients' in restoRes).toBe(false);
    expect('billing' in restoRes).toBe(false);

    await expect(service.getDailyStats(Role.CUISINE)).rejects.toThrow(ForbiddenException);
  });

  it('départage une égalité sur la quantité du plat le plus vendu par le plus gros chiffre d affaires', async () => {
    const mockPrisma: any = {
      reservation: { findMany: jest.fn() },
      guest: { count: jest.fn() },
      invoice: { aggregate: jest.fn() },
      payment: { groupBy: jest.fn() },
      restaurantOrder: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'o1',
            totalTtcFcfa: 15000,
            lines: [
              { name: 'Bissap Frais', quantity: 3, totalPriceFcfa: 4500 },
              { name: 'Brochette Capitaine', quantity: 3, totalPriceFcfa: 10500 },
            ],
          },
          {
            id: 'o2',
            totalTtcFcfa: 4000,
            lines: [{ name: 'Café Touba', quantity: 2, totalPriceFcfa: 2000 }],
          },
        ]),
      },
    };

    const service = new AccueilService(mockPrisma);
    const res = await service.getDailyStats(Role.RESTAURANT, new Date('2026-11-12T14:00:00.000Z'));

    expect(res.restaurant?.ordersCount).toBe(2);
    expect(res.restaurant?.revenueFcfa).toBe(19000);
    expect(res.restaurant?.topDish).toEqual({
      name: 'Brochette Capitaine',
      quantity: 3,
      amountFcfa: 10500,
    });
    expect(res.restaurant?.topDishes.map((d) => d.name)).toEqual([
      'Brochette Capitaine',
      'Bissap Frais',
      'Café Touba',
    ]);
  });
});
