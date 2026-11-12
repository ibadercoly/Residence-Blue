import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  PaymentMethod,
  ReservationStatus,
} from '@prisma/client';
import {
  AccueilBillingStats,
  AccueilBlocKey,
  AccueilClientsStats,
  AccueilJourResponse,
  AccueilPaymentMethodCode,
  AccueilPaymentMethodSlice,
  AccueilRestaurantStats,
  AccueilTopDishItem,
  Role,
} from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface DakarDayBounds {
  dateDakarIso: string;
  startOfDay: Date;
  endOfDay: Date;
}

const PAYMENT_METHOD_ORDER: Array<{ code: AccueilPaymentMethodCode; label: string }> = [
  { code: 'CASH', label: 'Espèces' },
  { code: 'ORANGE_MONEY', label: 'Orange Money' },
  { code: 'WAVE', label: 'Wave' },
  { code: 'CARD', label: 'Carte' },
  { code: 'BANK_TRANSFER', label: 'Virement' },
];

/**
 * Calcule la fenêtre exacte 00:00:00 -> 23:59:59.999 en heure de Dakar (Africa/Dakar, UTC+0 permanent).
 */
export function getDakarDayBounds(referenceDate: Date = new Date()): DakarDayBounds {
  const dateDakarIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate);

  const startOfDay = new Date(`${dateDakarIso}T00:00:00.000Z`);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  return {
    dateDakarIso,
    startOfDay,
    endOfDay,
  };
}

export function resolveVisibleAccueilBlocks(role: string | undefined): AccueilBlocKey[] {
  switch (role) {
    case Role.DIRECTION:
    case Role.COMPTABLE:
    case Role.RECEPTION:
      return ['CLIENTS', 'BILLING', 'RESTAURANT'];
    case Role.RESTAURANT:
    case Role.SERVEUR:
      return ['RESTAURANT'];
    case Role.HOUSEKEEPING:
    case Role.MAINTENANCE:
      return ['CLIENTS'];
    default:
      return [];
  }
}

@Injectable()
export class AccueilService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailyStats(
    role: string | undefined,
    referenceDate: Date = new Date(),
  ): Promise<AccueilJourResponse> {
    const visibleBlocks = resolveVisibleAccueilBlocks(role);
    if (visibleBlocks.length === 0) {
      throw new ForbiddenException(
        'Votre rôle ne permet pas de consulter les statistiques de la journée.',
      );
    }

    const bounds = getDakarDayBounds(referenceDate);
    const includeClients = visibleBlocks.includes('CLIENTS');
    const includeBilling = visibleBlocks.includes('BILLING');
    const includeRestaurant = visibleBlocks.includes('RESTAURANT');

    const [clients, billing, restaurant] = await Promise.all([
      includeClients ? this.computeClientsStats(bounds) : Promise.resolve(undefined),
      includeBilling ? this.computeBillingStats(bounds) : Promise.resolve(undefined),
      includeRestaurant ? this.computeRestaurantStats(bounds) : Promise.resolve(undefined),
    ]);

    const response: AccueilJourResponse = {
      dateDakarIso: bounds.dateDakarIso,
      timezone: 'Africa/Dakar',
      generatedAt: referenceDate.toISOString(),
      visibleBlocks,
    };

    if (includeClients && clients) {
      response.clients = clients;
    }
    if (includeBilling && billing) {
      response.billing = billing;
    }
    if (includeRestaurant && restaurant) {
      response.restaurant = restaurant;
    }

    return response;
  }

  private async computeClientsStats(bounds: DakarDayBounds): Promise<AccueilClientsStats> {
    const startMs = bounds.startOfDay.getTime();
    const endMs = bounds.endOfDay.getTime();

    const [reservations, newGuestsToday] = await Promise.all([
      this.prisma.reservation.findMany({
        where: {
          OR: [
            { checkInDate: { gte: bounds.startOfDay, lt: bounds.endOfDay } },
            { checkOutDate: { gte: bounds.startOfDay, lt: bounds.endOfDay } },
            { status: ReservationStatus.CHECKED_IN },
          ],
        },
        select: {
          status: true,
          checkInDate: true,
          checkOutDate: true,
          guestId: true,
        },
      }),
      this.prisma.guest.count({
        where: {
          createdAt: { gte: bounds.startOfDay, lt: bounds.endOfDay },
        },
      }),
    ]);

    let arrivalsExpected = 0;
    let arrivalsDone = 0;
    let departuresExpected = 0;
    let departuresDone = 0;
    const inStayGuests = new Set<string>();

    for (const r of reservations) {
      const active =
        r.status !== ReservationStatus.CANCELLED && r.status !== ReservationStatus.NO_SHOW;
      const inMs = r.checkInDate.getTime();
      const outMs = r.checkOutDate.getTime();

      if (active && inMs >= startMs && inMs < endMs) {
        arrivalsExpected += 1;
        if (
          r.status === ReservationStatus.CHECKED_IN ||
          r.status === ReservationStatus.CHECKED_OUT
        ) {
          arrivalsDone += 1;
        }
      }

      if (active && outMs >= startMs && outMs < endMs) {
        departuresExpected += 1;
        if (r.status === ReservationStatus.CHECKED_OUT) {
          departuresDone += 1;
        }
      }

      if (r.status === ReservationStatus.CHECKED_IN) {
        inStayGuests.add(r.guestId);
      }
    }

    return {
      arrivalsDone,
      arrivalsExpected,
      departuresDone,
      departuresExpected,
      guestsInStay: inStayGuests.size,
      newGuestsToday,
    };
  }

  private async computeBillingStats(bounds: DakarDayBounds): Promise<AccueilBillingStats> {
    const [issuedTodayAgg, notesToSettleAgg, groupedPayments] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: {
          documentType: InvoiceDocumentType.INVOICE,
          isIssued: true,
          status: { not: InvoiceStatus.CANCELLED },
          issuedAt: { gte: bounds.startOfDay, lt: bounds.endOfDay },
        },
        _sum: { totalFcfa: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          documentType: InvoiceDocumentType.INVOICE,
          isIssued: false,
          status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIAL] },
          balanceFcfa: { gt: 0 },
        },
        _sum: { balanceFcfa: true },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where: {
          paidAt: { gte: bounds.startOfDay, lt: bounds.endOfDay },
        },
        _sum: { amountFcfa: true },
      }),
    ]);

    const totalsByMethod: Record<PaymentMethod, number> = {
      CASH: 0,
      ORANGE_MONEY: 0,
      WAVE: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
    };

    for (const grp of groupedPayments) {
      totalsByMethod[grp.method] = Math.round(grp._sum.amountFcfa ?? 0);
    }

    const totalCollectedTodayFcfa = PAYMENT_METHOD_ORDER.reduce(
      (sum, entry) => sum + totalsByMethod[entry.code],
      0,
    );

    const positiveBase = PAYMENT_METHOD_ORDER.reduce(
      (sum, entry) => sum + Math.max(0, totalsByMethod[entry.code]),
      0,
    );

    const collectedByMethod: AccueilPaymentMethodSlice[] = PAYMENT_METHOD_ORDER.map((entry) => {
      const amountFcfa = totalsByMethod[entry.code];
      const positive = Math.max(0, amountFcfa);
      const percent = positiveBase > 0 ? Math.round((positive * 100) / positiveBase) : 0;
      return {
        method: entry.code,
        label: entry.label,
        amountFcfa,
        percent,
      };
    });

    return {
      issuedInvoicesToday: issuedTodayAgg._count._all ?? 0,
      notesToSettleCount: notesToSettleAgg._count._all ?? 0,
      totalBilledTodayFcfa: Math.round(issuedTodayAgg._sum.totalFcfa ?? 0),
      totalCollectedTodayFcfa: Math.round(totalCollectedTodayFcfa),
      remainingToCollectFcfa: Math.round(notesToSettleAgg._sum.balanceFcfa ?? 0),
      collectedByMethod,
    };
  }

  private async computeRestaurantStats(bounds: DakarDayBounds): Promise<AccueilRestaurantStats> {
    const orders = await this.prisma.restaurantOrder.findMany({
      where: {
        createdAt: { gte: bounds.startOfDay, lt: bounds.endOfDay },
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        totalTtcFcfa: true,
        lines: {
          select: {
            name: true,
            quantity: true,
            totalPriceFcfa: true,
          },
        },
      },
    });

    let revenueFcfa = 0;
    const dishMap = new Map<string, AccueilTopDishItem>();

    for (const order of orders) {
      revenueFcfa += Math.round(order.totalTtcFcfa || 0);
      for (const line of order.lines) {
        const key = line.name.trim();
        if (!key) continue;
        const existing = dishMap.get(key) || { name: key, quantity: 0, amountFcfa: 0 };
        existing.quantity += Math.round(line.quantity || 0);
        existing.amountFcfa += Math.round(line.totalPriceFcfa || 0);
        dishMap.set(key, existing);
      }
    }

    const sortedDishes = Array.from(dishMap.values()).sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      if (b.amountFcfa !== a.amountFcfa) return b.amountFcfa - a.amountFcfa;
      return a.name.localeCompare(b.name, 'fr');
    });

    const topDishes = sortedDishes.slice(0, 5);

    return {
      ordersCount: orders.length,
      revenueFcfa: Math.round(revenueFcfa),
      topDish: topDishes[0] || null,
      topDishes,
    };
  }
}
