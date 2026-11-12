import { NotFoundException } from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus, Prisma } from '@prisma/client';

export interface ComputedInvoiceTotals {
  grossLinesFcfa: number;
  discountFcfa?: number;
  subtotalHtFcfa: number;
  serviceAmountFcfa: number;
  vatAmountFcfa: number;
  tourismTaxFcfa: number;
  totalFcfa: number;
  balanceFcfa: number;
  status: InvoiceStatus;
}

/**
 * Calcule les totaux d'une facture/note strictement en entiers FCFA.
 */
export function computeInvoiceTotalsData(params: {
  lines: Array<{ category: string; totalPriceFcfa: number }>;
  discountFcfa: number;
  depositFcfa: number;
  paidAmountFcfa: number;
  vatRatePercent: number;
  serviceRatePercent: number;
  isCreditNote?: boolean;
}): ComputedInvoiceTotals {
  if (params.isCreditNote) {
    const signedSum = params.lines.reduce((acc, l) => acc + l.totalPriceFcfa, 0);
    const absTotal = Math.abs(signedSum);
    const absHt =
      params.vatRatePercent > 0
        ? Math.round((absTotal * 100) / (100 + params.vatRatePercent))
        : absTotal;
    const absService =
      params.serviceRatePercent > 0
        ? Math.round((absHt * params.serviceRatePercent) / 100)
        : 0;
    const absVat =
      params.serviceRatePercent > 0
        ? Math.round(((absHt + absService) * params.vatRatePercent) / 100)
        : absTotal - absHt;
    return {
      grossLinesFcfa: signedSum,
      subtotalHtFcfa: -absHt,
      serviceAmountFcfa: -absService,
      vatAmountFcfa: -absVat,
      tourismTaxFcfa: 0,
      totalFcfa: -(absHt + absService + absVat),
      balanceFcfa: 0,
      status: InvoiceStatus.PAID,
    };
  }

  const tourismTaxFcfa = params.lines
    .filter((l) => (l.category || '').toUpperCase() === 'TAX')
    .reduce((acc, l) => acc + l.totalPriceFcfa, 0);

  const grossLinesFcfa = params.lines
    .filter((l) => (l.category || '').toUpperCase() !== 'TAX')
    .reduce((acc, l) => acc + l.totalPriceFcfa, 0);

  const safeDiscount = Math.max(0, Math.min(Math.round(params.discountFcfa || 0), grossLinesFcfa));
  const netPrestations = Math.max(0, grossLinesFcfa - safeDiscount);

  const vatRate = Math.max(0, Math.round(params.vatRatePercent || 0));
  const serviceRate = Math.max(0, Math.round(params.serviceRatePercent || 0));

  const subtotalHtFcfa =
    vatRate > 0 ? Math.round((netPrestations * 100) / (100 + vatRate)) : netPrestations;

  let serviceAmountFcfa = 0;
  let vatAmountFcfa = 0;

  if (serviceRate > 0) {
    serviceAmountFcfa = Math.round((subtotalHtFcfa * serviceRate) / 100);
    vatAmountFcfa =
      vatRate > 0 ? Math.round(((subtotalHtFcfa + serviceAmountFcfa) * vatRate) / 100) : 0;
  } else {
    vatAmountFcfa = netPrestations - subtotalHtFcfa;
  }

  const totalFcfa = subtotalHtFcfa + serviceAmountFcfa + vatAmountFcfa + tourismTaxFcfa;
  const settledTotal = Math.max(
    0,
    Math.round(params.depositFcfa || 0) + Math.round(params.paidAmountFcfa || 0),
  );
  const balanceFcfa = Math.max(0, totalFcfa - settledTotal);

  const status =
    balanceFcfa === 0 && totalFcfa > 0
      ? InvoiceStatus.PAID
      : settledTotal > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.OPEN;

  return {
    grossLinesFcfa,
    discountFcfa: safeDiscount,
    subtotalHtFcfa,
    serviceAmountFcfa,
    vatAmountFcfa,
    tourismTaxFcfa,
    totalFcfa,
    balanceFcfa,
    status,
  };
}

/**
 * Recalcule et persiste les totaux d'une facture/note dans une transaction Prisma.
 */
export async function recalculateInvoiceTotalsInTx(
  tx: Prisma.TransactionClient,
  invoiceId: string,
): Promise<void> {
  const inv = await tx.invoice.findUnique({
    where: { id: invoiceId },
    include: { lines: true, payments: true },
  });
  if (!inv) {
    throw new NotFoundException(`Facture "${invoiceId}" introuvable.`);
  }

  const settings = await tx.hotelSetting.findUnique({ where: { id: 'default' } });
  const vatRatePercent = settings?.vatRatePercent ?? 0;
  const serviceRatePercent = settings?.serviceRatePercent ?? 0;

  const paidAmountFcfa = inv.payments.reduce((acc, p) => acc + p.amountFcfa, 0);
  const computed = computeInvoiceTotalsData({
    lines: inv.lines,
    discountFcfa: inv.discountFcfa,
    depositFcfa: inv.depositFcfa,
    paidAmountFcfa,
    vatRatePercent,
    serviceRatePercent,
    isCreditNote: inv.documentType === InvoiceDocumentType.CREDIT_NOTE,
  });

  const isCancelled = inv.status === InvoiceStatus.CANCELLED;
  const nextStatus = isCancelled ? InvoiceStatus.CANCELLED : computed.status;

  await tx.invoice.update({
    where: { id: invoiceId },
    data: {
      discountFcfa: computed.discountFcfa ?? inv.discountFcfa,
      vatRatePercent,
      serviceRatePercent,
      subtotalHtFcfa: computed.subtotalHtFcfa,
      serviceAmountFcfa: computed.serviceAmountFcfa,
      vatAmountFcfa: computed.vatAmountFcfa,
      tourismTaxFcfa: computed.tourismTaxFcfa,
      totalFcfa: computed.totalFcfa,
      paidAmountFcfa,
      balanceFcfa: computed.balanceFcfa,
      status: nextStatus,
      settledAt: nextStatus === InvoiceStatus.PAID ? inv.settledAt || new Date() : null,
    },
  });
}
