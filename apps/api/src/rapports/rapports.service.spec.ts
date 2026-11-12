import { RapportsService } from './rapports.service';
import {
  addDakarDays,
  dakarWeekdayIndex,
  dakarWeekMonday,
  resolveDakarPeriodWindow,
  toDakarIsoDate,
} from './rapports-date.util';

describe('RapportsService & calculs Africa/Dakar (unit)', () => {
  it('bascule de jour exactement à minuit de Dakar (UTC+0)', () => {
    const beforeMidnight = new Date('2026-11-12T23:59:59.999Z');
    const atMidnight = new Date('2026-11-13T00:00:00.000Z');

    expect(toDakarIsoDate(beforeMidnight)).toBe('2026-11-12');
    expect(toDakarIsoDate(atMidnight)).toBe('2026-11-13');

    const wBefore = resolveDakarPeriodWindow('30j', beforeMidnight);
    const wAfter = resolveDakarPeriodWindow('30j', atMidnight);

    expect(wBefore.endInclusiveIso).toBe('2026-11-12');
    expect(wAfter.endInclusiveIso).toBe('2026-11-13');
    expect(wBefore.startIso).toBe(addDakarDays('2026-11-12', -29));
    expect(wAfter.startIso).toBe(addDakarDays('2026-11-13', -29));
  });

  it('calcule correctement le lundi de semaine et les index de jours en heure de Dakar', () => {
    // 2026-11-15 est un dimanche -> semaine du lundi 2026-11-09, index 6
    expect(dakarWeekdayIndex('2026-11-15')).toBe(6);
    expect(dakarWeekMonday('2026-11-15')).toBe('2026-11-09');
    // 2026-11-09 est un lundi -> index 0
    expect(dakarWeekdayIndex('2026-11-09')).toBe(0);
  });

  it('retourne uniquement l’enveloppe sans aucune tuile ni diagramme sur base vide', async () => {
    const mockPrisma: any = {
      hotelSetting: {
        findUnique: async () => ({ hotelName: 'Résidence Blue', roomCount: 12 }),
      },
      room: {
        count: async () => 12,
      },
      invoice: {
        findMany: async () => [],
      },
      $queryRaw: async () => [],
    };

    const service = new RapportsService(mockPrisma);
    const report = await service.getReport('30j', new Date('2026-11-12T12:00:00.000Z'));

    expect(report.hasData).toBe(false);
    expect(report.previousPeriodHasData).toBe(false);
    expect(report.hotelName).toBe('Résidence Blue');
    expect(report.activeRoomsCount).toBe(12);
    expect(report.tiles).toBeUndefined();
    expect(report.revenueEvolution).toBeUndefined();
    expect(report.salesByTypeByWeek).toBeUndefined();
    expect(report.occupancyByDay).toBeUndefined();
    expect(report.paymentsByMethod).toBeUndefined();
    expect(report.reservationSources).toBeUndefined();
    expect(report.salesByRoomCategory).toBeUndefined();
    expect(report.weekdayAverages).toBeUndefined();
    expect(report.topDishes).toBeUndefined();
    expect(report.dailyTable).toBeUndefined();
  });

  it('une seule facture sans période précédente : affiche uniquement les blocs ayant assez de données, sans comparaison ni courbe (< 2 points)', async () => {
    let queryCall = 0;
    const mockPrisma: any = {
      hotelSetting: {
        findUnique: async () => ({ hotelName: 'Résidence Blue', roomCount: 12 }),
      },
      room: {
        count: async () => 12,
      },
      invoice: {
        findMany: async () => [],
      },
      $queryRaw: async () => {
        queryCall += 1;
        if (queryCall === 1) {
          // 1 seule facture d'hébergement non réglée le 2026-11-10
          return [
            {
              id: 'inv-1',
              dakar_date: '2026-11-10',
              doc_type: 'INVOICE',
              parent_id: null,
              ht_fcfa: 50000n,
              balance_fcfa: 55000n,
              status: 'OPEN',
              room_id: 'room-1',
              reservation_id: 'res-1',
              heb_gross: 55000n,
              rest_gross: 0n,
              other_gross: 0n,
              total_gross: 55000n,
              room_category: 'Deluxe',
            },
          ];
        }
        return [];
      },
    };

    const service = new RapportsService(mockPrisma);
    const report = await service.getReport('30j', new Date('2026-11-12T12:00:00.000Z'));

    expect(report.hasData).toBe(true);
    expect(report.previousPeriodHasData).toBe(false);
    expect(report.tiles?.revenue?.amountFcfa).toBe(50000);
    expect(report.tiles?.revenue?.deltaPercent).toBeUndefined();
    expect(report.tiles?.accommodation).toEqual({ amountFcfa: 50000, sharePercent: 100 });
    expect(report.tiles?.restaurant).toBeUndefined();
    expect(report.tiles?.collected).toBeUndefined();
    expect(report.tiles?.remaining).toEqual({ amountFcfa: 55000 });

    // 1 seul jour non nul -> pas de courbe d'évolution (exige >= 2 points non nuls)
    expect(report.revenueEvolution).toBeUndefined();
    // Barres >= 1 valeur non nulle -> présentes
    expect(report.salesByTypeByWeek?.some((w) => w.totalFcfa === 50000)).toBe(true);
    expect(report.salesByRoomCategory?.items).toEqual([
      { category: 'Deluxe', amountFcfa: 50000, sharePercent: 100, nightsCount: 0 },
    ]);
    // Sections sans données absentes
    expect(report.paymentsByMethod).toBeUndefined();
    expect(report.reservationSources).toBeUndefined();
    expect(report.topDishes).toBeUndefined();
  });

  it('déduit les avoirs et calcule la variation lorsque la période précédente a des données', async () => {
    let queryCall = 0;
    const mockPrisma: any = {
      hotelSetting: {
        findUnique: async () => ({ hotelName: 'Résidence Blue', roomCount: 12 }),
      },
      room: {
        count: async () => 12,
      },
      invoice: {
        findMany: async () => [],
      },
      $queryRaw: async () => {
        queryCall += 1;
        if (queryCall === 1) {
          return [
            // Période précédente (octobre) : 100 000 FCFA HT
            {
              id: 'inv-prev',
              dakar_date: '2026-10-05',
              doc_type: 'INVOICE',
              parent_id: null,
              ht_fcfa: 100000n,
              balance_fcfa: 0n,
              status: 'PAID',
              room_id: 'room-1',
              reservation_id: null,
              heb_gross: 110000n,
              rest_gross: 0n,
              other_gross: 0n,
              total_gross: 110000n,
              room_category: 'Standard',
            },
            // Période courante : 100 000 + 50 000 - 30 000 (avoir) = 120 000 FCFA HT (+20 %)
            {
              id: 'inv-curr-1',
              dakar_date: '2026-11-02',
              doc_type: 'INVOICE',
              parent_id: null,
              ht_fcfa: 100000n,
              balance_fcfa: 0n,
              status: 'PAID',
              room_id: 'room-1',
              reservation_id: null,
              heb_gross: 110000n,
              rest_gross: 0n,
              other_gross: 0n,
              total_gross: 110000n,
              room_category: 'Standard',
            },
            {
              id: 'inv-curr-2',
              dakar_date: '2026-11-08',
              doc_type: 'INVOICE',
              parent_id: null,
              ht_fcfa: 50000n,
              balance_fcfa: 0n,
              status: 'PAID',
              room_id: null,
              reservation_id: null,
              heb_gross: 0n,
              rest_gross: 55000n,
              other_gross: 0n,
              total_gross: 55000n,
              room_category: null,
            },
            {
              id: 'cn-curr-1',
              dakar_date: '2026-11-09',
              doc_type: 'CREDIT_NOTE',
              parent_id: 'inv-curr-1',
              ht_fcfa: -30000n,
              balance_fcfa: 0n,
              status: 'PAID',
              room_id: 'room-1',
              reservation_id: null,
              heb_gross: 0n,
              rest_gross: 0n,
              other_gross: -33000n,
              total_gross: -33000n,
              room_category: 'Standard',
            },
          ];
        }
        return [];
      },
    };

    const service = new RapportsService(mockPrisma);
    const report = await service.getReport('30j', new Date('2026-11-12T12:00:00.000Z'));

    expect(report.hasData).toBe(true);
    expect(report.previousPeriodHasData).toBe(true);
    expect(report.tiles?.revenue).toEqual({
      amountFcfa: 120000,
      deltaPercent: 20,
    });
    expect(report.tiles?.accommodation).toEqual({
      amountFcfa: 70000,
      sharePercent: 58,
    });
    expect(report.tiles?.restaurant).toEqual({
      amountFcfa: 50000,
      sharePercent: 42,
    });
    // 3 jours non nuls -> courbe d'évolution présente avec meilleur jour
    expect(report.revenueEvolution).toBeDefined();
    expect(report.revenueEvolution?.bestPoint.amountFcfa).toBe(100000);
  });
});
