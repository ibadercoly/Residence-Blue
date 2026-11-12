import { InvoiceDocumentType, InvoiceStatus, PaymentMethod, Prisma, ReservationStatus } from '@prisma/client';
import {
  BillingPaymentMethod,
  BillingSortField,
  BillingSortOrder,
  BillingSummaryCard,
} from '@residence-blue/shared';
import { ArchivesQueryDto, CounterQueryDto } from './dto/billing.dto';

export interface UtcDayBounds {
  startOfDay: Date;
  endOfDay: Date;
  todayIso: string;
  cutoff24h: Date;
}

export function getUtcDayBounds(now: Date = new Date()): UtcDayBounds {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
  const endOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0),
  );
  return {
    startOfDay,
    endOfDay,
    todayIso: startOfDay.toISOString().slice(0, 10),
    cutoff24h: new Date(now.getTime() - 24 * 60 * 60 * 1000),
  };
}

/**
 * Règle métier Comptoir : une note non émise dont le reste vaut 0 FCFA
 * affiche « Soldée à clôturer », jamais « Note ouverte ».
 */
export function resolveInvoiceDisplayNumber(inv: {
  invoiceNumber?: string | null;
  documentType: InvoiceDocumentType | string;
  balanceFcfa: number;
}): string {
  if (inv.invoiceNumber) {
    return inv.invoiceNumber;
  }
  if (inv.documentType === InvoiceDocumentType.INVOICE && inv.balanceFcfa <= 0) {
    return 'Soldée à clôturer';
  }
  return 'Note ouverte';
}

export function buildBillingSearchWhere(search?: string): Prisma.InvoiceWhereInput | null {
  const q = (search || '').trim();
  if (!q) return null;
  return {
    OR: [
      { invoiceNumber: { contains: q, mode: 'insensitive' } },
      { billingCompanyName: { contains: q, mode: 'insensitive' } },
      { guest: { fullName: { contains: q, mode: 'insensitive' } } },
      { room: { number: { contains: q, mode: 'insensitive' } } },
    ],
  };
}

export function buildBillingOrderBy(
  sortBy?: BillingSortField,
  sortOrder?: BillingSortOrder,
): Prisma.InvoiceOrderByWithRelationInput[] {
  const dir: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
  switch (sortBy) {
    case 'guest':
      return [{ guest: { fullName: dir } }, { updatedAt: 'desc' }];
    case 'stay':
      return [{ reservation: { checkInDate: dir } }, { createdAt: dir }];
    case 'balance':
      return [{ balanceFcfa: dir }, { updatedAt: 'desc' }];
    default:
      return [{ updatedAt: dir }];
  }
}

export function buildCounterWhere(query: CounterQueryDto, bounds: UtcDayBounds): Prisma.InvoiceWhereInput {
  const clauses: Prisma.InvoiceWhereInput[] = [
    {
      documentType: InvoiceDocumentType.INVOICE,
      isIssued: false,
      status: { not: InvoiceStatus.CANCELLED },
    },
  ];

  const filter = query.filter || 'TO_PROCESS';
  if (filter === 'TO_PROCESS') {
    clauses.push({ status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIAL] } });
  } else if (filter === 'DEPARTURES_TODAY') {
    clauses.push({
      reservation: {
        checkOutDate: { gte: bounds.startOfDay, lt: bounds.endOfDay },
        status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
      },
    });
  } else if (filter === 'OVERDUE_24H') {
    clauses.push({
      balanceFcfa: { gt: 0 },
      createdAt: { lt: bounds.cutoff24h },
    });
  } else if (filter === 'PAID_TODAY') {
    clauses.push({
      balanceFcfa: { lte: 0 },
      status: InvoiceStatus.PAID,
      OR: [
        { settledAt: { gte: bounds.startOfDay, lt: bounds.endOfDay } },
        { settledAt: null, updatedAt: { gte: bounds.startOfDay, lt: bounds.endOfDay } },
      ],
    });
  }

  const searchClause = buildBillingSearchWhere(query.search);
  if (searchClause) {
    clauses.push(searchClause);
  }

  return { AND: clauses };
}

export function buildArchivesWhere(query: ArchivesQueryDto): Prisma.InvoiceWhereInput {
  const clauses: Prisma.InvoiceWhereInput[] = [];
  const status = query.status || 'ALL';

  if (status === 'ALL') {
    clauses.push({
      OR: [{ isIssued: true }, { documentType: InvoiceDocumentType.CREDIT_NOTE }],
    });
  } else if (status === 'PAID') {
    clauses.push({
      documentType: InvoiceDocumentType.INVOICE,
      status: InvoiceStatus.PAID,
      isIssued: true,
    });
  } else if (status === 'OPEN') {
    clauses.push({
      documentType: InvoiceDocumentType.INVOICE,
      status: InvoiceStatus.OPEN,
    });
  } else if (status === 'PARTIAL') {
    clauses.push({
      documentType: InvoiceDocumentType.INVOICE,
      status: InvoiceStatus.PARTIAL,
    });
  } else if (status === 'CREDIT_NOTE') {
    clauses.push({ documentType: InvoiceDocumentType.CREDIT_NOTE });
  } else if (status === 'CANCELLED') {
    clauses.push({ status: InvoiceStatus.CANCELLED });
  }

  if (query.fromDate) {
    clauses.push({ issuedAt: { gte: new Date(`${query.fromDate}T00:00:00.000Z`) } });
  }
  if (query.toDate) {
    const end = new Date(`${query.toDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    clauses.push({ issuedAt: { lt: end } });
  }

  if (query.paymentMethod && query.paymentMethod !== 'ALL') {
    clauses.push({
      payments: {
        some: {
          method: query.paymentMethod as PaymentMethod,
          isReversal: false,
        },
      },
    });
  }

  const searchClause = buildBillingSearchWhere(query.search);
  if (searchClause) {
    clauses.push(searchClause);
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export function formatSummaryCardRow(inv: any, bounds: UtcDayBounds): BillingSummaryCard {
  const startIso = inv.reservation?.checkInDate
    ? new Date(inv.reservation.checkInDate).toISOString().slice(0, 10)
    : null;
  const endIso = inv.reservation?.checkOutDate
    ? new Date(inv.reservation.checkOutDate).toISOString().slice(0, 10)
    : null;

  const stayLabel =
    startIso && endIso
      ? `${new Date(startIso).toLocaleDateString('fr-FR')} → ${new Date(endIso).toLocaleDateString('fr-FR')}`
      : `Note du ${new Date(inv.issuedAt || inv.createdAt).toLocaleDateString('fr-FR')}`;

  const totalFcfa = inv.totalFcfa;
  const paidTotalFcfa = Math.max(0, (inv.depositFcfa || 0) + (inv.paidAmountFcfa || 0));
  const progressPercent =
    inv.documentType === InvoiceDocumentType.CREDIT_NOTE
      ? 100
      : totalFcfa > 0
        ? Math.min(100, Math.round((paidTotalFcfa * 100) / totalFcfa))
        : inv.status === InvoiceStatus.PAID
          ? 100
          : 0;

  const methods = Array.isArray(inv.payments)
    ? Array.from(
        new Set<BillingPaymentMethod>(
          inv.payments.filter((p: any) => !p.isReversal).map((p: any) => p.method as BillingPaymentMethod),
        ),
      )
    : undefined;

  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    displayNumber: resolveInvoiceDisplayNumber(inv),
    documentType: inv.documentType,
    isIssued: inv.isIssued,
    status: inv.status,
    guestId: inv.guestId,
    guestName: inv.guest?.fullName || inv.billingCompanyName || 'Client de passage',
    roomNumber: inv.room?.number || '—',
    stayStartDate: startIso,
    stayEndDate: endIso,
    stayLabel,
    totalFcfa,
    paidTotalFcfa,
    balanceFcfa: inv.balanceFcfa,
    progressPercent,
    isDepartureToday: endIso === bounds.todayIso && inv.balanceFcfa > 0,
    isOverdue24h: inv.balanceFcfa > 0 && new Date(inv.createdAt).getTime() < bounds.cutoff24h.getTime(),
    ...(methods ? { paymentMethods: methods } : {}),
    parentInvoiceId: inv.parentInvoiceId || null,
    createdAt: new Date(inv.createdAt).toISOString(),
    issuedAt: new Date(inv.issuedAt).toISOString(),
    updatedAt: new Date(inv.updatedAt).toISOString(),
  };
}
