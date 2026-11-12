import { Injectable } from '@nestjs/common';
import {
  RapportsDailyRow,
  RapportsEvolutionPoint,
  RapportsOccupancyDayPoint,
  RapportsPeriodKey,
  RapportsResponse,
  RapportsRoomCategoryItem,
  RapportsSalesByTypeWeek,
  RapportsSummaryTiles,
  RapportsTopDishItem,
  RapportsWeekdayAverageItem,
} from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  addDakarDays,
  dakarWeekdayIndex,
  dakarWeekMonday,
  DakarPeriodWindow,
  enumerateDakarDays,
  enumerateDakarMonths,
  formatFullDakarDate,
  formatMonthYearFr,
  formatShortDakarDate,
  resolveDakarPeriodWindow,
  WEEKDAY_LABELS_FR,
} from './rapports-date.util';

interface RawInvoiceRow {
  id: string;
  dakar_date: string;
  doc_type: string;
  parent_id: string | null;
  ht_fcfa: bigint | number;
  balance_fcfa: bigint | number;
  status: string;
  room_id: string | null;
  reservation_id: string | null;
  heb_gross: bigint | number;
  rest_gross: bigint | number;
  other_gross: bigint | number;
  total_gross: bigint | number;
  room_category: string | null;
}

interface RawPaymentRow {
  dakar_date: string;
  method: string;
  amount_fcfa: bigint | number;
}

interface RawOccupancyRow {
  dakar_date: string;
  occupied_rooms: number;
}

interface RawSourceRow {
  source: string;
  cnt: number;
}

interface RawTopDishRow {
  dish_name: string;
  qty: number;
  ht_fcfa: bigint | number;
}

interface CategoryBreakdown {
  heb: number;
  rest: number;
  other: number;
  total: number;
  roomCategory: string | null;
}

const PAYMENT_METHOD_LABELS: Array<{ code: string; label: string }> = [
  { code: 'CASH', label: 'Espèces' },
  { code: 'ORANGE_MONEY', label: 'Orange Money' },
  { code: 'WAVE', label: 'Wave' },
  { code: 'CARD', label: 'Carte bancaire' },
  { code: 'BANK_TRANSFER', label: 'Virement' },
];

const SOURCE_LABELS: Record<string, string> = {
  RECEPTION: 'Réception directe',
  DIRECT: 'Réservation directe',
  BOOKING: 'Booking.com',
  AIRBNB: 'Airbnb',
  EXPEDIA: 'Expedia',
  TELEPHONE: 'Téléphone',
  TEL: 'Téléphone',
  WHATSAPP: 'WhatsApp',
  AGENCE: 'Agence de voyages',
  CORPORATE: 'Entreprise',
  SITE_WEB: 'Site internet',
  WALK_IN: 'Client de passage',
};

function formatSourceLabel(raw: string): string {
  const upper = raw.trim().toUpperCase();
  return SOURCE_LABELS[upper] || raw.trim();
}

function toNum(v: bigint | number | null | undefined): number {
  return Math.round(Number(v ?? 0));
}

function computeDeltaPercent(current: number, previous: number, previousHasData: boolean): number | undefined {
  if (!previousHasData || previous <= 0) return undefined;
  return Math.round(((current - previous) * 100) / previous);
}

/**
 * Ventile un montant HT entier sur (Hébergement, Restaurant, Autres) sans perte d'arrondi.
 */
function apportionHtCategories(
  ht: number,
  hebGross: number,
  restGross: number,
  otherGross: number,
  hasRoomContext: boolean,
): { heb: number; rest: number; other: number } {
  const grossSum = hebGross + restGross + otherGross;
  if (grossSum === 0) {
    return hasRoomContext
      ? { heb: ht, rest: 0, other: 0 }
      : { heb: 0, rest: 0, other: ht };
  }

  let heb = hebGross !== 0 ? Math.round((ht * hebGross) / grossSum) : 0;
  let rest = restGross !== 0 ? Math.round((ht * restGross) / grossSum) : 0;
  let other = otherGross !== 0 ? Math.round((ht * otherGross) / grossSum) : 0;

  const drift = ht - (heb + rest + other);
  if (drift !== 0) {
    if (otherGross !== 0) other += drift;
    else if (hebGross >= restGross && hebGross !== 0) heb += drift;
    else if (restGross !== 0) rest += drift;
    else heb += drift;
  }
  return { heb, rest, other };
}

@Injectable()
export class RapportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    periodInput?: RapportsPeriodKey,
    referenceDate: Date = new Date(),
  ): Promise<RapportsResponse> {
    const window = resolveDakarPeriodWindow(periodInput || '30j', referenceDate);

    const [
      settings,
      activeRoomsDb,
      allInvoices,
      allPayments,
      allOccupancy,
      sourcesRows,
      topDishRows,
    ] = await Promise.all([
      this.prisma.hotelSetting.findUnique({
        where: { id: 'default' },
        select: { hotelName: true, roomCount: true },
      }),
      this.prisma.room.count({ where: { isActive: true } }),
      this.fetchInvoicesInRange(window.prevStartDate, window.endExclusiveDate),
      this.fetchPaymentsInRange(window.prevStartDate, window.endExclusiveDate),
      this.fetchOccupancyByDay(window.prevStartIso, window.endInclusiveIso),
      this.fetchReservationSources(
        window.startIso,
        window.endInclusiveIso,
        window.startDate,
        window.endExclusiveDate,
      ),
      this.fetchTopDishes(window.startDate, window.endExclusiveDate),
    ]);

    const hotelName = settings?.hotelName?.trim() || 'Résidence Blue';
    const activeRoomsCount = activeRoomsDb > 0 ? activeRoomsDb : Math.max(1, settings?.roomCount || 12);

    const parentBreakdownMap = await this.resolveMissingParents(allInvoices);

    const currInvoices = allInvoices.filter(
      (i) => i.dakar_date >= window.startIso && i.dakar_date <= window.endInclusiveIso,
    );
    const prevInvoices = allInvoices.filter(
      (i) => i.dakar_date >= window.prevStartIso && i.dakar_date <= window.prevEndInclusiveIso,
    );

    const currPayments = allPayments.filter(
      (p) => p.dakar_date >= window.startIso && p.dakar_date <= window.endInclusiveIso,
    );
    const prevPayments = allPayments.filter(
      (p) => p.dakar_date >= window.prevStartIso && p.dakar_date <= window.prevEndInclusiveIso,
    );

    const currOccMap = new Map<string, number>();
    const prevOccMap = new Map<string, number>();
    for (const row of allOccupancy) {
      if (row.dakar_date >= window.startIso && row.dakar_date <= window.endInclusiveIso) {
        currOccMap.set(row.dakar_date, row.occupied_rooms);
      } else if (row.dakar_date >= window.prevStartIso && row.dakar_date <= window.prevEndInclusiveIso) {
        prevOccMap.set(row.dakar_date, row.occupied_rooms);
      }
    }

    const currOccupiedNights = Array.from(currOccMap.values()).reduce((s, n) => s + n, 0);
    const prevOccupiedNights = Array.from(prevOccMap.values()).reduce((s, n) => s + n, 0);
    const currCollectedTotal = currPayments.reduce((s, p) => s + toNum(p.amount_fcfa), 0);
    const prevCollectedTotal = prevPayments.reduce((s, p) => s + toNum(p.amount_fcfa), 0);

    const hasData =
      currInvoices.length > 0 ||
      currCollectedTotal !== 0 ||
      currOccupiedNights > 0 ||
      sourcesRows.length > 0 ||
      topDishRows.length > 0;

    const previousPeriodHasData =
      prevInvoices.length > 0 || prevCollectedTotal !== 0 || prevOccupiedNights > 0;

    const baseResponse: RapportsResponse = {
      period: window.period,
      periodLabel: window.periodLabel,
      startDateIso: window.startIso,
      endDateIso: window.endInclusiveIso,
      timezone: 'Africa/Dakar',
      generatedAt: referenceDate.toISOString(),
      hotelName,
      activeRoomsCount,
      hasData,
      previousPeriodHasData,
    };

    if (!hasData) {
      return baseResponse;
    }

    // Ventilation des factures courantes et précédentes
    const currBreakdown = this.aggregateInvoices(currInvoices, parentBreakdownMap);
    const prevBreakdown = this.aggregateInvoices(prevInvoices, parentBreakdownMap);

    const currDays = enumerateDakarDays(window.startIso, window.endInclusiveIso);
    const prevDays = enumerateDakarDays(window.prevStartIso, window.prevEndInclusiveIso);
    const currCapacityNights = activeRoomsCount * currDays.length;
    const prevCapacityNights = activeRoomsCount * prevDays.length;

    const currOccupancyPct =
      currCapacityNights > 0 ? Math.round((currOccupiedNights * 100) / currCapacityNights) : 0;
    const prevOccupancyPct =
      prevCapacityNights > 0 ? Math.round((prevOccupiedNights * 100) / prevCapacityNights) : 0;

    // Calcul du reste à encaisser sur les factures ouvertes / partielles de la période
    const remainingFcfa = currInvoices
      .filter(
        (i) =>
          i.doc_type === 'INVOICE' &&
          (i.status === 'OPEN' || i.status === 'PARTIAL') &&
          toNum(i.balance_fcfa) > 0,
      )
      .reduce((s, i) => s + toNum(i.balance_fcfa), 0);

    // 1. Tuiles conditionnelles (jamais de tuiles vides inventées)
    const tiles: RapportsSummaryTiles = {};
    if (currBreakdown.totalRevenue !== 0 || currInvoices.length > 0) {
      const deltaPercent = computeDeltaPercent(
        currBreakdown.totalRevenue,
        prevBreakdown.totalRevenue,
        previousPeriodHasData,
      );
      tiles.revenue = {
        amountFcfa: currBreakdown.totalRevenue,
        ...(deltaPercent !== undefined ? { deltaPercent } : {}),
      };
    }

    const totalForShare = currBreakdown.totalRevenue > 0 ? currBreakdown.totalRevenue : 0;
    if (currBreakdown.hebTotal !== 0) {
      tiles.accommodation = {
        amountFcfa: currBreakdown.hebTotal,
        sharePercent:
          totalForShare > 0 ? Math.round((currBreakdown.hebTotal * 100) / totalForShare) : 0,
      };
    }
    if (currBreakdown.restTotal !== 0) {
      tiles.restaurant = {
        amountFcfa: currBreakdown.restTotal,
        sharePercent:
          totalForShare > 0 ? Math.round((currBreakdown.restTotal * 100) / totalForShare) : 0,
      };
    }
    if (currOccupiedNights > 0) {
      const occDelta =
        previousPeriodHasData && prevOccupiedNights > 0
          ? currOccupancyPct - prevOccupancyPct
          : undefined;
      tiles.occupancy = {
        averagePercent: currOccupancyPct,
        occupiedRoomNights: currOccupiedNights,
        capacityRoomNights: currCapacityNights,
        ...(occDelta !== undefined ? { deltaPercent: occDelta } : {}),
      };
    }
    if (currCollectedTotal !== 0) {
      const collectedDelta = computeDeltaPercent(
        currCollectedTotal,
        prevCollectedTotal,
        previousPeriodHasData,
      );
      tiles.collected = {
        amountFcfa: currCollectedTotal,
        ...(collectedDelta !== undefined ? { deltaPercent: collectedDelta } : {}),
      };
    }
    if (remainingFcfa > 0) {
      tiles.remaining = { amountFcfa: remainingFcfa };
    }

    if (Object.keys(tiles).length > 0) {
      baseResponse.tiles = tiles;
    }

    // 2. Diagramme a) Évolution du chiffre d'affaires (>= 2 points non nuls)
    const evolutionPoints = this.buildEvolutionSeries(
      window.granularity,
      currDays,
      currBreakdown.byDay,
    );
    const nonZeroEvo = evolutionPoints.filter((p) => p.amountFcfa !== 0);
    if (nonZeroEvo.length >= 2) {
      const sortedDesc = [...nonZeroEvo].sort(
        (a, b) => b.amountFcfa - a.amountFcfa || a.key.localeCompare(b.key),
      );
      const sortedAsc = [...nonZeroEvo].sort(
        (a, b) => a.amountFcfa - b.amountFcfa || a.key.localeCompare(b.key),
      );
      const topPoints = sortedDesc.slice(0, 3).map((pt, idx) => ({
        key: pt.key,
        label: pt.label,
        amountFcfa: pt.amountFcfa,
        rank: (idx + 1) as 1 | 2 | 3,
      }));
      const best = sortedDesc[0];
      const lowest = sortedAsc[0];

      let previousPoints: RapportsEvolutionPoint[] | undefined;
      if (previousPeriodHasData) {
        const prevSeries = this.buildEvolutionSeries(
          window.granularity,
          prevDays,
          prevBreakdown.byDay,
        );
        if (prevSeries.filter((p) => p.amountFcfa !== 0).length >= 2) {
          previousPoints = prevSeries;
        }
      }

      baseResponse.revenueEvolution = {
        granularity: window.granularity,
        points: evolutionPoints,
        ...(previousPoints ? { previousPoints } : {}),
        topPoints,
        lowestPoint: { key: lowest.key, label: lowest.label, amountFcfa: lowest.amountFcfa },
        bestPoint: { key: best.key, label: best.label, amountFcfa: best.amountFcfa },
      };
    }

    // 3. Diagramme b) Ventes par type et par semaine (>= 1 valeur non nulle)
    const salesByWeek = this.buildWeeklyStackedSales(currDays, currBreakdown.byDay);
    if (salesByWeek.some((w) => w.totalFcfa !== 0)) {
      baseResponse.salesByTypeByWeek = salesByWeek;
    }

    // 4. Diagramme c) Chambres occupées par jour (>= 1 jour occupé > 0)
    if (currOccupiedNights > 0) {
      const points: RapportsOccupancyDayPoint[] = currDays.map((dIso) => {
        const occupiedRooms = currOccMap.get(dIso) ?? 0;
        const percent =
          activeRoomsCount > 0 ? Math.round((occupiedRooms * 100) / activeRoomsCount) : 0;
        return {
          dateIso: dIso,
          label: formatShortDakarDate(dIso),
          occupiedRooms,
          activeRooms: activeRoomsCount,
          percent,
        };
      });
      const avgRooms = Math.round((currOccupiedNights / Math.max(1, currDays.length)) * 10) / 10;
      baseResponse.occupancyByDay = {
        averageRooms: avgRooms,
        averagePercent: currOccupancyPct,
        activeRoomsCount,
        points,
      };
    }

    // 5. Diagramme d) Argent encaissé par mode de paiement (> 0)
    if (currCollectedTotal > 0) {
      const methodMap = new Map<string, number>();
      for (const row of currPayments) {
        methodMap.set(row.method, (methodMap.get(row.method) || 0) + toNum(row.amount_fcfa));
      }
      const positiveItems = PAYMENT_METHOD_LABELS.map((entry) => ({
        method: entry.code,
        label: entry.label,
        amountFcfa: methodMap.get(entry.code) || 0,
      })).filter((it) => it.amountFcfa > 0);

      const positiveBase = positiveItems.reduce((s, it) => s + it.amountFcfa, 0);
      if (positiveBase > 0) {
        baseResponse.paymentsByMethod = {
          totalFcfa: positiveBase,
          items: positiveItems.map((it) => ({
            ...it,
            percent: Math.round((it.amountFcfa * 100) / positiveBase),
          })),
        };
      }
    }

    // 6. Diagramme e) D'où viennent les réservations
    if (sourcesRows.length > 0) {
      const grouped = new Map<string, { label: string; count: number }>();
      let totalCount = 0;
      for (const r of sourcesRows) {
        const code = r.source.trim().toUpperCase();
        const existing = grouped.get(code) || {
          label: formatSourceLabel(r.source),
          count: 0,
        };
        existing.count += r.cnt;
        totalCount += r.cnt;
        grouped.set(code, existing);
      }
      if (totalCount > 0) {
        baseResponse.reservationSources = {
          totalCount,
          items: Array.from(grouped.entries())
            .map(([source, v]) => ({
              source,
              label: v.label,
              count: v.count,
              percent: Math.round((v.count * 100) / totalCount),
            }))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr')),
        };
      }
    }

    // 7. Diagramme f) Ventes par catégorie de chambre (>= 1 valeur non nulle)
    const roomCategories = Array.from(currBreakdown.byRoomCategory.entries())
      .filter(([, amount]) => amount !== 0)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'));

    if (roomCategories.length > 0) {
      const catNights = await this.fetchRoomCategoryNights(
        window.startIso,
        window.endInclusiveIso,
      );
      const totalRoomCat = roomCategories.reduce((s, [, v]) => s + v, 0);
      const items: RapportsRoomCategoryItem[] = roomCategories.map(([category, amountFcfa]) => ({
        category,
        amountFcfa,
        sharePercent: totalRoomCat > 0 ? Math.round((amountFcfa * 100) / totalRoomCat) : 0,
        nightsCount: catNights.get(category) ?? 0,
      }));
      baseResponse.salesByRoomCategory = {
        totalFcfa: totalRoomCat,
        items,
      };
    }

    // 8. Diagramme g) Jours de la semaine (moyenne des ventes par jour)
    const weekdaySums = new Array<number>(7).fill(0);
    const weekdayCounts = new Array<number>(7).fill(0);
    for (const dIso of currDays) {
      const idx = dakarWeekdayIndex(dIso);
      weekdayCounts[idx] += 1;
      weekdaySums[idx] += currBreakdown.byDay.get(dIso)?.total || 0;
    }
    const weekdayAverages: RapportsWeekdayAverageItem[] = WEEKDAY_LABELS_FR.map((label, idx) => ({
      weekdayIndex: idx,
      label,
      totalFcfa: weekdaySums[idx],
      daysCount: weekdayCounts[idx],
      averageFcfa:
        weekdayCounts[idx] > 0 ? Math.round(weekdaySums[idx] / weekdayCounts[idx]) : 0,
    }));
    if (weekdayAverages.some((w) => w.averageFcfa > 0)) {
      baseResponse.weekdayAverages = weekdayAverages;
    }

    // 9. Diagramme h) Les 10 plats les plus vendus
    if (topDishRows.length > 0) {
      const topDishes: RapportsTopDishItem[] = topDishRows.map((r) => ({
        name: r.dish_name,
        quantity: r.qty,
        amountFcfa: toNum(r.ht_fcfa),
      }));
      baseResponse.topDishes = topDishes;
    }

    // 10. Tableau Jour par jour (trié du plus récent au plus ancien pour lecture directe)
    const tableRows: RapportsDailyRow[] = [...currDays].reverse().map((dIso) => {
      const daySales = currBreakdown.byDay.get(dIso) || { heb: 0, rest: 0, other: 0, total: 0 };
      return {
        dateIso: dIso,
        label: formatFullDakarDate(dIso),
        occupiedRooms: currOccMap.get(dIso) ?? 0,
        activeRooms: activeRoomsCount,
        accommodationFcfa: daySales.heb,
        restaurantFcfa: daySales.rest,
        otherFcfa: daySales.other,
        totalFcfa: daySales.total,
      };
    });

    baseResponse.dailyTable = {
      activeRoomsCount,
      rows: tableRows,
      totals: {
        occupiedRoomNights: currOccupiedNights,
        capacityRoomNights: currCapacityNights,
        accommodationFcfa: currBreakdown.hebTotal,
        restaurantFcfa: currBreakdown.restTotal,
        otherFcfa: currBreakdown.otherTotal,
        totalFcfa: currBreakdown.totalRevenue,
      },
    };

    return baseResponse;
  }

  private aggregateInvoices(
    rows: RawInvoiceRow[],
    parentBreakdownMap: Map<string, CategoryBreakdown>,
  ) {
    const byDay = new Map<string, { heb: number; rest: number; other: number; total: number }>();
    const byRoomCategory = new Map<string, number>();
    let hebTotal = 0;
    let restTotal = 0;
    let otherTotal = 0;
    let totalRevenue = 0;

    // Traiter d'abord les factures normales pour alimenter les parents de la période
    const regularInvoices = rows.filter((r) => r.doc_type !== 'CREDIT_NOTE');
    const creditNotes = rows.filter((r) => r.doc_type === 'CREDIT_NOTE');

    for (const inv of regularInvoices) {
      const ht = toNum(inv.ht_fcfa);
      const cats = apportionHtCategories(
        ht,
        toNum(inv.heb_gross),
        toNum(inv.rest_gross),
        toNum(inv.other_gross),
        Boolean(inv.room_id || inv.reservation_id),
      );

      parentBreakdownMap.set(inv.id, {
        ...cats,
        total: ht,
        roomCategory: inv.room_category || null,
      });

      const dayEntry = byDay.get(inv.dakar_date) || { heb: 0, rest: 0, other: 0, total: 0 };
      dayEntry.heb += cats.heb;
      dayEntry.rest += cats.rest;
      dayEntry.other += cats.other;
      dayEntry.total += ht;
      byDay.set(inv.dakar_date, dayEntry);

      hebTotal += cats.heb;
      restTotal += cats.rest;
      otherTotal += cats.other;
      totalRevenue += ht;

      if (cats.heb !== 0) {
        const roomCat = inv.room_category?.trim() || 'Standard';
        byRoomCategory.set(roomCat, (byRoomCategory.get(roomCat) || 0) + cats.heb);
      }
    }

    for (const cn of creditNotes) {
      const ht = toNum(cn.ht_fcfa); // déjà négatif sur un avoir
      const parent = cn.parent_id ? parentBreakdownMap.get(cn.parent_id) : undefined;
      const cats = parent && parent.total !== 0
        ? apportionHtCategories(ht, parent.heb, parent.rest, parent.other, false)
        : apportionHtCategories(
            ht,
            toNum(cn.heb_gross),
            toNum(cn.rest_gross),
            toNum(cn.other_gross),
            false,
          );

      const dayEntry = byDay.get(cn.dakar_date) || { heb: 0, rest: 0, other: 0, total: 0 };
      dayEntry.heb += cats.heb;
      dayEntry.rest += cats.rest;
      dayEntry.other += cats.other;
      dayEntry.total += ht;
      byDay.set(cn.dakar_date, dayEntry);

      hebTotal += cats.heb;
      restTotal += cats.rest;
      otherTotal += cats.other;
      totalRevenue += ht;

      if (cats.heb !== 0 && parent?.roomCategory) {
        byRoomCategory.set(
          parent.roomCategory,
          (byRoomCategory.get(parent.roomCategory) || 0) + cats.heb,
        );
      }
    }

    return {
      byDay,
      byRoomCategory,
      hebTotal,
      restTotal,
      otherTotal,
      totalRevenue,
    };
  }

  private async resolveMissingParents(
    rows: RawInvoiceRow[],
  ): Promise<Map<string, CategoryBreakdown>> {
    const map = new Map<string, CategoryBreakdown>();
    const existingIds = new Set(rows.map((r) => r.id));
    const missingParentIds = Array.from(
      new Set(
        rows
          .filter((r) => r.doc_type === 'CREDIT_NOTE' && r.parent_id && !existingIds.has(r.parent_id))
          .map((r) => r.parent_id!),
      ),
    );
    if (missingParentIds.length === 0) return map;

    const parents = await this.prisma.invoice.findMany({
      where: { id: { in: missingParentIds } },
      select: {
        id: true,
        subtotalHtFcfa: true,
        roomId: true,
        reservationId: true,
        room: { select: { category: true, type: { select: { name: true } } } },
        lines: { select: { category: true, totalPriceFcfa: true } },
      },
    });

    for (const p of parents) {
      let hebGross = 0;
      let restGross = 0;
      let otherGross = 0;
      for (const l of p.lines) {
        const cat = (l.category || '').toUpperCase();
        if (cat === 'TAX') continue;
        if (cat === 'HEBERGEMENT') hebGross += l.totalPriceFcfa;
        else if (cat === 'RESTAURANT') restGross += l.totalPriceFcfa;
        else otherGross += l.totalPriceFcfa;
      }
      const cats = apportionHtCategories(
        p.subtotalHtFcfa,
        hebGross,
        restGross,
        otherGross,
        Boolean(p.roomId || p.reservationId),
      );
      map.set(p.id, {
        ...cats,
        total: p.subtotalHtFcfa,
        roomCategory: p.room?.type?.name || p.room?.category || null,
      });
    }
    return map;
  }

  private buildEvolutionSeries(
    granularity: DakarPeriodWindow['granularity'],
    days: string[],
    byDay: Map<string, { heb: number; rest: number; other: number; total: number }>,
  ): RapportsEvolutionPoint[] {
    if (days.length === 0) return [];

    if (granularity === 'day') {
      return days.map((dIso) => ({
        key: dIso,
        label: formatShortDakarDate(dIso),
        amountFcfa: byDay.get(dIso)?.total || 0,
      }));
    }

    if (granularity === 'week') {
      const weekMap = new Map<string, number>();
      const weekOrder: string[] = [];
      for (const dIso of days) {
        const wKey = dakarWeekMonday(dIso);
        if (!weekMap.has(wKey)) {
          weekMap.set(wKey, 0);
          weekOrder.push(wKey);
        }
        weekMap.set(wKey, (weekMap.get(wKey) || 0) + (byDay.get(dIso)?.total || 0));
      }
      return weekOrder.map((wKey) => ({
        key: wKey,
        label: `Sem. ${formatShortDakarDate(wKey)}`,
        amountFcfa: weekMap.get(wKey) || 0,
      }));
    }

    // 12 mois : regroupement par mois calendaire
    const monthKeys = enumerateDakarMonths(days[0], days[days.length - 1]);
    const monthMap = new Map<string, number>(monthKeys.map((m) => [m, 0]));
    for (const dIso of days) {
      const ym = dIso.slice(0, 7);
      monthMap.set(ym, (monthMap.get(ym) || 0) + (byDay.get(dIso)?.total || 0));
    }
    return monthKeys.map((ym) => ({
      key: ym,
      label: formatMonthYearFr(ym),
      amountFcfa: monthMap.get(ym) || 0,
    }));
  }

  private buildWeeklyStackedSales(
    days: string[],
    byDay: Map<string, { heb: number; rest: number; other: number; total: number }>,
  ): RapportsSalesByTypeWeek[] {
    const map = new Map<string, { heb: number; rest: number; other: number; total: number }>();
    const order: string[] = [];
    for (const dIso of days) {
      const wKey = dakarWeekMonday(dIso);
      if (!map.has(wKey)) {
        map.set(wKey, { heb: 0, rest: 0, other: 0, total: 0 });
        order.push(wKey);
      }
      const daySales = byDay.get(dIso);
      if (daySales) {
        const entry = map.get(wKey)!;
        entry.heb += daySales.heb;
        entry.rest += daySales.rest;
        entry.other += daySales.other;
        entry.total += daySales.total;
      }
    }
    return order.map((wKey) => {
      const v = map.get(wKey)!;
      const wEnd = addDakarDays(wKey, 6);
      return {
        weekKey: wKey,
        label: `${formatShortDakarDate(wKey)} - ${formatShortDakarDate(wEnd)}`,
        accommodationFcfa: v.heb,
        restaurantFcfa: v.rest,
        otherFcfa: v.other,
        totalFcfa: v.total,
      };
    });
  }

  private async fetchInvoicesInRange(
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<RawInvoiceRow[]> {
    return this.prisma.$queryRaw<RawInvoiceRow[]>`
      WITH inv_lines AS (
        SELECT
          il."invoice_id",
          SUM(CASE WHEN UPPER(il."category") = 'HEBERGEMENT' THEN il."total_price_fcfa" ELSE 0 END)::bigint AS heb_gross,
          SUM(CASE WHEN UPPER(il."category") = 'RESTAURANT' THEN il."total_price_fcfa" ELSE 0 END)::bigint AS rest_gross,
          SUM(CASE WHEN UPPER(il."category") NOT IN ('HEBERGEMENT', 'RESTAURANT', 'TAX') THEN il."total_price_fcfa" ELSE 0 END)::bigint AS other_gross,
          SUM(CASE WHEN UPPER(il."category") <> 'TAX' THEN il."total_price_fcfa" ELSE 0 END)::bigint AS total_gross
        FROM "invoice_lines" il
        INNER JOIN "invoices" i2 ON i2."id" = il."invoice_id"
        WHERE i2."status"::text <> 'CANCELLED'
          AND i2."issued_at" >= ${rangeStart}
          AND i2."issued_at" < ${rangeEnd}
        GROUP BY il."invoice_id"
      )
      SELECT
        i."id",
        (i."issued_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Dakar')::date::text AS dakar_date,
        i."document_type"::text AS doc_type,
        i."parent_invoice_id" AS parent_id,
        i."subtotal_ht_fcfa"::bigint AS ht_fcfa,
        i."balance_fcfa"::bigint AS balance_fcfa,
        i."status"::text AS status,
        i."room_id" AS room_id,
        i."reservation_id" AS reservation_id,
        COALESCE(l.heb_gross, 0)::bigint AS heb_gross,
        COALESCE(l.rest_gross, 0)::bigint AS rest_gross,
        COALESCE(l.other_gross, 0)::bigint AS other_gross,
        COALESCE(l.total_gross, 0)::bigint AS total_gross,
        COALESCE(rt."name", r."category") AS room_category
      FROM "invoices" i
      LEFT JOIN inv_lines l ON l."invoice_id" = i."id"
      LEFT JOIN "reservations" res ON res."id" = i."reservation_id"
      LEFT JOIN "rooms" r ON r."id" = COALESCE(i."room_id", res."room_id")
      LEFT JOIN "room_types" rt ON rt."id" = r."type_id"
      WHERE i."status"::text <> 'CANCELLED'
        AND i."issued_at" >= ${rangeStart}
        AND i."issued_at" < ${rangeEnd}
      ORDER BY i."issued_at" ASC
    `;
  }

  private async fetchPaymentsInRange(
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<RawPaymentRow[]> {
    return this.prisma.$queryRaw<RawPaymentRow[]>`
      SELECT
        (p."paid_at" AT TIME ZONE 'UTC' AT TIME ZONE 'Africa/Dakar')::date::text AS dakar_date,
        p."method"::text AS method,
        SUM(p."amount_fcfa")::bigint AS amount_fcfa
      FROM "payments" p
      INNER JOIN "invoices" i ON i."id" = p."invoice_id"
      WHERE i."status"::text <> 'CANCELLED'
        AND p."paid_at" >= ${rangeStart}
        AND p."paid_at" < ${rangeEnd}
      GROUP BY 1, 2
    `;
  }

  private async fetchOccupancyByDay(
    startIso: string,
    endInclusiveIso: string,
  ): Promise<RawOccupancyRow[]> {
    return this.prisma.$queryRaw<RawOccupancyRow[]>`
      SELECT
        gs::date::text AS dakar_date,
        COUNT(DISTINCT res."room_id")::int AS occupied_rooms
      FROM generate_series(${startIso}::date, ${endInclusiveIso}::date, INTERVAL '1 day') AS gs
      INNER JOIN "reservations" res
        ON res."check_in_date" <= gs::date
       AND res."check_out_date" > gs::date
       AND res."status"::text IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      GROUP BY gs
      ORDER BY gs ASC
    `;
  }

  private async fetchRoomCategoryNights(
    startIso: string,
    endInclusiveIso: string,
  ): Promise<Map<string, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ room_category: string; nights: number }>>`
      SELECT
        COALESCE(rt."name", r."category", 'Standard') AS room_category,
        COUNT(*)::int AS nights
      FROM generate_series(${startIso}::date, ${endInclusiveIso}::date, INTERVAL '1 day') AS gs
      INNER JOIN "reservations" res
        ON res."check_in_date" <= gs::date
       AND res."check_out_date" > gs::date
       AND res."status"::text IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT')
      INNER JOIN "rooms" r ON r."id" = res."room_id"
      LEFT JOIN "room_types" rt ON rt."id" = r."type_id"
      GROUP BY 1
    `;
    return new Map(rows.map((r) => [r.room_category, r.nights]));
  }

  private async fetchReservationSources(
    startIso: string,
    endInclusiveIso: string,
    startDate: Date,
    endExclusiveDate: Date,
  ): Promise<RawSourceRow[]> {
    return this.prisma.$queryRaw<RawSourceRow[]>`
      SELECT
        TRIM(res."source") AS source,
        COUNT(*)::int AS cnt
      FROM "reservations" res
      WHERE res."status"::text NOT IN ('CANCELLED', 'NO_SHOW')
        AND TRIM(COALESCE(res."source", '')) <> ''
        AND (
          (res."check_in_date" <= ${endInclusiveIso}::date AND res."check_out_date" > ${startIso}::date)
          OR (res."created_at" >= ${startDate} AND res."created_at" < ${endExclusiveDate})
        )
      GROUP BY TRIM(res."source")
      ORDER BY cnt DESC, source ASC
    `;
  }

  private async fetchTopDishes(
    startDate: Date,
    endExclusiveDate: Date,
  ): Promise<RawTopDishRow[]> {
    return this.prisma.$queryRaw<RawTopDishRow[]>`
      SELECT
        TRIM(ol."name") AS dish_name,
        SUM(ol."quantity")::int AS qty,
        SUM(
          CASE
            WHEN o."total_ttc_fcfa" > 0 AND o."subtotal_ht_fcfa" >= 0
              THEN ROUND((ol."total_price_fcfa"::numeric * o."subtotal_ht_fcfa"::numeric) / o."total_ttc_fcfa"::numeric)
            ELSE ROUND(ol."total_price_fcfa"::numeric * 100.0 / 110.0)
          END
        )::bigint AS ht_fcfa
      FROM "order_lines" ol
      INNER JOIN "orders" o ON o."id" = ol."order_id"
      WHERE o."status"::text <> 'CANCELLED'
        AND o."created_at" >= ${startDate}
        AND o."created_at" < ${endExclusiveDate}
        AND TRIM(COALESCE(ol."name", '')) <> ''
      GROUP BY TRIM(ol."name")
      ORDER BY qty DESC, ht_fcfa DESC, dish_name ASC
      LIMIT 10
    `;
  }
}
