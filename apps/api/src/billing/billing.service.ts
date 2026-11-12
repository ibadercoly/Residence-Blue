import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import {
  CheckoutInvoiceDto,
  CounterQueryDto,
  CreateCreditNoteDto,
  CreateInvoiceDto,
  CreateInvoiceLineDto,
  CreatePaymentDto,
  ReversePaymentDto,
  RoomRestaurantChargeDto,
  UpdateDiscountDto,
} from './dto/billing.dto';
import {
  InvoiceDocumentType,
  InvoiceStatus,
  PaymentMethod,
  Prisma,
  ReservationStatus,
  RoomStatus,
} from '@prisma/client';
import {
  BillingCounterResponse,
  BillingLineCategory,
  BillingNoteDetail,
  BillingPaymentMethod,
  BillingSummaryCard,
  numberToFrenchWordsFcfa,
} from '@residence-blue/shared';
import { sanitizeSpreadsheetCell } from '../exports/exports.service';

export interface BillingActorContext {
  actorRole: string;
  actorName: string;
  actorId?: string;
  ip?: string;
  idempotencyKey?: string;
}

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Espèces',
  ORANGE_MONEY: 'Orange Money',
  WAVE: 'Wave',
  CARD: 'Carte',
  BANK_TRANSFER: 'Virement',
};

const CATEGORY_LABELS: Record<BillingLineCategory, string> = {
  HEBERGEMENT: 'Hébergement',
  RESTAURANT: 'Restaurant',
  PISCINE: 'Piscine',
  BLANCHISSERIE: 'Blanchisserie',
  AUTRES: 'Autres',
};

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private isUuid(val?: string | null): boolean {
    return !!val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
  }

  private normalizePaymentMethod(raw: string): PaymentMethod {
    const upper = (raw || 'CASH').toUpperCase();
    if (upper === 'WAVE') return PaymentMethod.WAVE;
    if (upper === 'ORANGE_MONEY' || upper === 'OM') return PaymentMethod.ORANGE_MONEY;
    if (upper === 'CARD' || upper === 'CARTE' || upper === 'CARTE_TPE') return PaymentMethod.CARD;
    if (upper === 'BANK_TRANSFER' || upper === 'VIREMENT') return PaymentMethod.BANK_TRANSFER;
    return PaymentMethod.CASH;
  }

  private normalizeCategory(raw?: string | null): BillingLineCategory {
    const upper = (raw || 'HEBERGEMENT').toUpperCase();
    if (upper === 'HEBERGEMENT' || upper === 'ROOM') return 'HEBERGEMENT';
    if (upper === 'RESTAURANT') return 'RESTAURANT';
    if (upper === 'PISCINE' || upper === 'POOL') return 'PISCINE';
    if (upper === 'BLANCHISSERIE' || upper === 'HOUSEKEEPING') return 'BLANCHISSERIE';
    return 'AUTRES';
  }

  private assertNoCardPan(transactionRef?: string | null): void {
    if (!transactionRef) return;
    const compact = transactionRef.replace(/[\s-]/g, '');
    if (/^\d{13,19}$/.test(compact)) {
      throw new BadRequestException(
        'Aucun numéro de carte bancaire ne doit être saisi dans la référence de transaction.',
      );
    }
  }

  private async getHotelSettings(tx: Prisma.TransactionClient | PrismaService = this.prisma) {
    let settings = await tx.hotelSetting.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await tx.hotelSetting.create({ data: { id: 'default' } });
    }
    return settings;
  }

  /**
   * Calcule les totaux strictement en entiers FCFA selon les taux lus des Paramètres.
   * Règle d'arrondi : arithmétique demi-supérieur (Math.round).
   */
  private computeInvoiceTotals(params: {
    lines: Array<{ category?: string | null; totalPriceFcfa: number }>;
    discountFcfa: number;
    depositFcfa: number;
    paidAmountFcfa: number;
    vatRatePercent: number;
    serviceRatePercent: number;
    isCreditNote?: boolean;
  }) {
    if (params.isCreditNote) {
      const signedSum = params.lines.reduce((s, l) => s + l.totalPriceFcfa, 0);
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
    const settledTotal = Math.max(0, Math.round(params.depositFcfa || 0) + Math.round(params.paidAmountFcfa || 0));
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

  private checkDiscountThreshold(
    grossLinesFcfa: number,
    discountFcfa: number,
    thresholdPercent: number | null,
    actorRole: string,
  ): void {
    if (discountFcfa <= 0) return;
    if (discountFcfa > grossLinesFcfa) {
      throw new BadRequestException('La remise ne peut pas dépasser le montant des prestations.');
    }
    if (actorRole === 'DIRECTION') return;

    const effectiveThreshold = thresholdPercent ?? 0;
    const maxAllowedFcfa = Math.floor((grossLinesFcfa * effectiveThreshold) / 100);
    if (discountFcfa > maxAllowedFcfa) {
      throw new ForbiddenException(
        `Remise supérieure au seuil autorisé (${effectiveThreshold} %, soit max ${maxAllowedFcfa} FCFA) : réservée à la DIRECTION.`,
      );
    }
  }

  /**
   * Numérotation séquentielle sans trou avec verrou PostgreSQL dans la transaction :
   * FA-AAAA-NNNN pour les factures, AV-AAAA-NNNN pour les avoirs.
   */
  private async nextSequenceNumber(
    tx: Prisma.TransactionClient,
    docType: 'FA' | 'AV',
  ): Promise<string> {
    const year = new Date().getFullYear();
    const key = `${docType}-${year}`;
    const rows = await tx.$queryRaw<Array<{ last_seq: number }>>`
      INSERT INTO "invoice_sequences" ("id", "doc_type", "year", "last_seq")
      VALUES (${key}, ${docType}, ${year}, 1)
      ON CONFLICT ("id") DO UPDATE
      SET "last_seq" = "invoice_sequences"."last_seq" + 1
      RETURNING "last_seq"
    `;
    const seq = rows[0]?.last_seq ?? 1;
    return `${docType}-${year}-${String(seq).padStart(4, '0')}`;
  }

  private async recalculateAndPersist(
    tx: Prisma.TransactionClient,
    invoiceId: string,
    overrideDiscountFcfa?: number,
  ) {
    const inv = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true, payments: true },
    });
    if (!inv) {
      throw new NotFoundException(`Facture "${invoiceId}" introuvable.`);
    }

    const settings = await this.getHotelSettings(tx);
    const vatRatePercent = settings.vatRatePercent ?? 0;
    const serviceRatePercent = settings.serviceRatePercent ?? 0;

    const paidAmountFcfa = inv.payments.reduce((acc, p) => acc + p.amountFcfa, 0);
    const discountFcfa =
      overrideDiscountFcfa !== undefined ? overrideDiscountFcfa : inv.discountFcfa;

    const computed = this.computeInvoiceTotals({
      lines: inv.lines,
      discountFcfa,
      depositFcfa: inv.depositFcfa,
      paidAmountFcfa,
      vatRatePercent,
      serviceRatePercent,
      isCreditNote: inv.documentType === InvoiceDocumentType.CREDIT_NOTE,
    });

    const isCancelled = inv.status === InvoiceStatus.CANCELLED;
    const nextStatus = isCancelled ? InvoiceStatus.CANCELLED : computed.status;

    return tx.invoice.update({
      where: { id: invoiceId },
      data: {
        discountFcfa: computed.discountFcfa ?? discountFcfa,
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
        settledAt:
          nextStatus === InvoiceStatus.PAID ? inv.settledAt || new Date() : null,
      },
      include: this.detailInclude,
    });
  }

  private readonly detailInclude = {
    lines: { orderBy: { createdAt: 'asc' as const } },
    payments: {
      orderBy: { paidAt: 'desc' as const },
      include: { receivedBy: true },
    },
    guest: true,
    room: true,
    reservation: true,
    parentInvoice: true,
    creditNotes: { orderBy: { issuedAt: 'desc' as const } },
  };

  /**
   * Synchronise automatiquement vers leurs notes ouvertes :
   * - les réservations actives/en séjour qui n'ont pas encore de note
   * - les commandes restaurant facturées sur la chambre non encore rattachées à une ligne de facture
   */
  private async syncOpenStayNotesAndRoomOrders(): Promise<void> {
    const settings = await this.getHotelSettings();
    const vatRatePercent = settings.vatRatePercent ?? 0;
    const serviceRatePercent = settings.serviceRatePercent ?? 0;
    const tourismTaxRate = settings.tourismTaxPerNightPerPerson ?? 0;

    // 1. Créer des notes ouvertes pour les réservations confirmées / en séjour sans note
    const reservationsWithoutInvoice = await this.prisma.reservation.findMany({
      where: {
        status: {
          in: [ReservationStatus.CONFIRMED, ReservationStatus.CHECKED_IN],
        },
        invoices: { none: {} },
      },
      include: { room: true },
    });

    for (const res of reservationsWithoutInvoice) {
      const ratePerNight = res.room?.pricePerNight ?? Math.round(res.totalFcfa / Math.max(1, res.nights));
      const accTotal = Math.max(0, ratePerNight * Math.max(1, res.nights));
      const checkInStr = new Date(res.checkInDate).toISOString().slice(0, 10);
      const tourismTax = res.tourismTaxFcfa > 0 ? res.tourismTaxFcfa : tourismTaxRate * res.adultsCount * res.nights;

      const linesData: Prisma.InvoiceLineCreateWithoutInvoiceInput[] = [
        {
          dateLabel: checkInStr,
          description: `Séjour Chambre ${res.room?.number || ''} (${res.room?.category || 'Standard'})`.trim(),
          subDescription: `${res.nights} nuit(s) × ${ratePerNight} FCFA`,
          category: 'HEBERGEMENT',
          quantity: res.nights,
          quantityLabel: `${res.nights}n`,
          unitPriceFcfa: ratePerNight,
          totalPriceFcfa: accTotal,
          isSystem: true,
        },
      ];

      if (tourismTax > 0) {
        linesData.push({
          dateLabel: checkInStr,
          description: 'Taxe de séjour',
          subDescription: `${res.adultsCount} adulte(s) × ${res.nights} nuit(s)`,
          category: 'TAX',
          quantity: res.adultsCount * res.nights,
          quantityLabel: `${res.adultsCount * res.nights}`,
          unitPriceFcfa: tourismTaxRate,
          totalPriceFcfa: tourismTax,
          isSystem: true,
        });
      }

      const computed = this.computeInvoiceTotals({
        lines: linesData,
        discountFcfa: res.discountFcfa,
        depositFcfa: res.depositFcfa,
        paidAmountFcfa: 0,
        vatRatePercent,
        serviceRatePercent,
      });

      await this.prisma.invoice.create({
        data: {
          invoiceNumber: null,
          documentType: InvoiceDocumentType.INVOICE,
          isIssued: false,
          reservationId: res.id,
          guestId: res.guestId,
          roomId: res.roomId,
          discountFcfa: res.discountFcfa,
          vatRatePercent,
          serviceRatePercent,
          subtotalHtFcfa: computed.subtotalHtFcfa,
          serviceAmountFcfa: computed.serviceAmountFcfa,
          vatAmountFcfa: computed.vatAmountFcfa,
          tourismTaxFcfa: computed.tourismTaxFcfa,
          totalFcfa: computed.totalFcfa,
          depositFcfa: res.depositFcfa,
          paidAmountFcfa: 0,
          balanceFcfa: computed.balanceFcfa,
          status: computed.status,
          lines: { create: linesData },
        },
      });
    }

    // 2. Rattacher automatiquement les commandes Restaurant sur chambre sans invoiceId
    const unlinkedRoomOrders = await this.prisma.restaurantOrder.findMany({
      where: {
        destinationType: 'ROOM',
        invoiceId: null,
        status: { not: 'CANCELLED' },
        OR: [{ roomId: { not: null } }, { reservationId: { not: null } }],
      },
      include: { lines: true, room: true },
    });

    for (const ord of unlinkedRoomOrders) {
      let targetInvoice = await this.prisma.invoice.findFirst({
        where: {
          isIssued: false,
          documentType: InvoiceDocumentType.INVOICE,
          status: { not: InvoiceStatus.CANCELLED },
          ...(ord.reservationId ? { reservationId: ord.reservationId } : { roomId: ord.roomId! }),
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!targetInvoice && ord.roomId) {
        const activeRes = await this.prisma.reservation.findFirst({
          where: {
            roomId: ord.roomId,
            status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CONFIRMED] },
          },
          orderBy: { status: 'desc' },
        });

        targetInvoice = await this.prisma.invoice.create({
          data: {
            invoiceNumber: null,
            isIssued: false,
            documentType: InvoiceDocumentType.INVOICE,
            reservationId: activeRes?.id || null,
            guestId: activeRes?.guestId || null,
            roomId: ord.roomId,
            vatRatePercent,
            serviceRatePercent,
            status: InvoiceStatus.OPEN,
          },
        });
      }

      if (targetInvoice) {
        const invoiceId = targetInvoice.id;
        await this.prisma.$transaction(async (tx) => {
          const alreadyLinked = await tx.invoiceLine.count({
            where: { invoiceId, sourceOrderId: ord.id },
          });
          if (alreadyLinked === 0) {
            for (const l of ord.lines) {
              await tx.invoiceLine.create({
                data: {
                  invoiceId,
                  dateLabel: new Date(ord.createdAt).toLocaleDateString('fr-FR'),
                  description: `${l.name} (${ord.ticketNumber})`,
                  subDescription: `Restaurant • ${ord.serverName}`,
                  category: 'RESTAURANT',
                  quantity: l.quantity,
                  quantityLabel: `${l.quantity}`,
                  unitPriceFcfa: l.unitPriceFcfa,
                  totalPriceFcfa: l.totalPriceFcfa,
                  isSystem: true,
                  sourceOrderId: ord.id,
                },
              });
            }
            await tx.restaurantOrder.update({
              where: { id: ord.id },
              data: { invoiceId },
            });
            await this.recalculateAndPersist(tx, invoiceId);
          }
        });
      }
    }
  }

  private formatSummaryCard(inv: any, todayIso: string): BillingSummaryCard {
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

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      displayNumber: inv.invoiceNumber || 'Note ouverte',
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
      isDepartureToday: endIso === todayIso && inv.balanceFcfa > 0,
      parentInvoiceId: inv.parentInvoiceId || null,
      updatedAt: new Date(inv.updatedAt).toISOString(),
    };
  }

  private async formatDetail(inv: any): Promise<BillingNoteDetail> {
    const settings = await this.getHotelSettings();
    const reversedIds = new Set<string>(
      (inv.payments || [])
        .filter((p: any) => p.isReversal && p.reversedPaymentId)
        .map((p: any) => p.reversedPaymentId),
    );

    const startIso = inv.reservation?.checkInDate
      ? new Date(inv.reservation.checkInDate).toISOString().slice(0, 10)
      : null;
    const endIso = inv.reservation?.checkOutDate
      ? new Date(inv.reservation.checkOutDate).toISOString().slice(0, 10)
      : null;
    const stayLabel =
      startIso && endIso
        ? `${new Date(startIso).toLocaleDateString('fr-FR')} → ${new Date(endIso).toLocaleDateString('fr-FR')}`
        : `Créée le ${new Date(inv.createdAt).toLocaleDateString('fr-FR')}`;

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      displayNumber: inv.invoiceNumber || 'Note ouverte',
      documentType: inv.documentType,
      isIssued: inv.isIssued,
      status: inv.status,
      reservationId: inv.reservationId,
      reservationStatus: inv.reservation?.status || null,
      guestId: inv.guestId,
      guestName: inv.guest?.fullName || inv.billingCompanyName || 'Client de passage',
      phone: inv.guest?.phone || '',
      roomId: inv.roomId,
      roomNumber: inv.room?.number || '—',
      roomCategory: inv.room?.category || 'Standard',
      stayStartDate: startIso,
      stayEndDate: endIso,
      stayLabel,
      nights: inv.reservation?.nights ?? 1,
      adultsCount: inv.reservation?.adultsCount ?? 1,
      lines: (inv.lines || []).map((l: any) => ({
        id: l.id,
        dateLabel: l.dateLabel || new Date(l.createdAt).toLocaleDateString('fr-FR'),
        description: l.description,
        subDescription: l.subDescription || '',
        category: this.normalizeCategory(l.category),
        rawCategory: l.category,
        quantity: l.quantity,
        unitPriceFcfa: l.unitPriceFcfa,
        totalPriceFcfa: l.totalPriceFcfa,
        isSystem: !!l.isSystem,
      })),
      subtotalHtFcfa: inv.subtotalHtFcfa,
      discountFcfa: inv.discountFcfa || 0,
      serviceRatePercent: inv.serviceRatePercent ?? (settings.serviceRatePercent ?? 0),
      serviceAmountFcfa: inv.serviceAmountFcfa || 0,
      vatRatePercent: inv.vatRatePercent ?? (settings.vatRatePercent ?? 0),
      vatAmountFcfa: inv.vatAmountFcfa,
      tourismTaxFcfa: inv.tourismTaxFcfa,
      totalFcfa: inv.totalFcfa,
      depositFcfa: inv.depositFcfa,
      paidAmountFcfa: inv.paidAmountFcfa,
      balanceFcfa: inv.balanceFcfa,
      totalInWordsFr: numberToFrenchWordsFcfa(inv.totalFcfa),
      payments: (inv.payments || []).map((p: any) => ({
        id: p.id,
        method: p.method as BillingPaymentMethod,
        methodLabel: METHOD_LABELS[p.method as PaymentMethod] || p.method,
        amountFcfa: p.amountFcfa,
        transactionRef: p.transactionRef,
        receivedByName: p.receivedBy?.fullName || p.receivedByName || 'Réception',
        paidAt: new Date(p.paidAt).toISOString(),
        isReversal: !!p.isReversal,
        reversedPaymentId: p.reversedPaymentId || null,
        reversalReason: p.reversalReason || null,
        alreadyReversed: reversedIds.has(p.id),
      })),
      parentInvoiceId: inv.parentInvoiceId || null,
      parentInvoiceNumber: inv.parentInvoice?.invoiceNumber || null,
      creditNotes: (inv.creditNotes || []).map((cn: any) => ({
        id: cn.id,
        invoiceNumber: cn.invoiceNumber,
        totalFcfa: cn.totalFcfa,
        reason: cn.reason,
        issuedAt: new Date(cn.issuedAt).toISOString(),
      })),
      reason: inv.reason || null,
      forcedCheckout: !!inv.forcedCheckout,
      forcedCheckoutReason: inv.forcedCheckoutReason || null,
      settings: {
        vatRatePercent: settings.vatRatePercent ?? null,
        serviceRatePercent: settings.serviceRatePercent ?? null,
        tourismTaxPerNightPerPerson: settings.tourismTaxPerNightPerPerson ?? null,
        discountThresholdPercent: settings.discountThresholdPercent ?? null,
      },
      canCheckout: inv.documentType === InvoiceDocumentType.INVOICE && inv.balanceFcfa === 0 && inv.status !== InvoiceStatus.CANCELLED,
      issuedAt: new Date(inv.issuedAt).toISOString(),
      settledAt: inv.settledAt ? new Date(inv.settledAt).toISOString() : null,
    };
  }

  async getCounterSummary(query: CounterQueryDto): Promise<BillingCounterResponse> {
    await this.syncOpenStayNotesAndRoomOrders();

    const search = (query.search || '').trim();
    const limit = Math.min(50, Math.max(1, query.limit ?? 8));
    const openOffset = Math.max(0, query.openOffset ?? 0);
    const partialOffset = Math.max(0, query.partialOffset ?? 0);
    const paidOffset = Math.max(0, query.paidOffset ?? 0);

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const todayIso = startOfDay.toISOString().slice(0, 10);

    const searchWhere: Prisma.InvoiceWhereInput = search
      ? {
          OR: [
            { invoiceNumber: { contains: search, mode: 'insensitive' } },
            { billingCompanyName: { contains: search, mode: 'insensitive' } },
            { guest: { fullName: { contains: search, mode: 'insensitive' } } },
            { room: { number: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : {};

    const toPayWhere: Prisma.InvoiceWhereInput = {
      ...searchWhere,
      documentType: InvoiceDocumentType.INVOICE,
      status: InvoiceStatus.OPEN,
    };

    const partialWhere: Prisma.InvoiceWhereInput = {
      ...searchWhere,
      documentType: InvoiceDocumentType.INVOICE,
      status: InvoiceStatus.PARTIAL,
    };

    const paidWhere: Prisma.InvoiceWhereInput = {
      ...searchWhere,
      OR: [
        { documentType: InvoiceDocumentType.INVOICE, status: InvoiceStatus.PAID },
        { documentType: InvoiceDocumentType.CREDIT_NOTE },
      ],
    };

    const listInclude = { guest: true, room: true, reservation: true };

    const [
      toPayItems,
      toPayTotal,
      partialItems,
      partialTotal,
      paidItems,
      paidTotal,
      unpaidAgg,
      departuresTodayToSettleCount,
      todayPayments,
    ] = await Promise.all([
      this.prisma.invoice.findMany({
        where: toPayWhere,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        skip: openOffset,
        take: limit,
      }),
      this.prisma.invoice.count({ where: toPayWhere }),
      this.prisma.invoice.findMany({
        where: partialWhere,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        skip: partialOffset,
        take: limit,
      }),
      this.prisma.invoice.count({ where: partialWhere }),
      this.prisma.invoice.findMany({
        where: paidWhere,
        include: listInclude,
        orderBy: { updatedAt: 'desc' },
        skip: paidOffset,
        take: limit,
      }),
      this.prisma.invoice.count({ where: paidWhere }),
      this.prisma.invoice.aggregate({
        where: {
          documentType: InvoiceDocumentType.INVOICE,
          status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIAL] },
          balanceFcfa: { gt: 0 },
        },
        _sum: { balanceFcfa: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.count({
        where: {
          documentType: InvoiceDocumentType.INVOICE,
          status: { in: [InvoiceStatus.OPEN, InvoiceStatus.PARTIAL] },
          balanceFcfa: { gt: 0 },
          reservation: {
            checkOutDate: { gte: startOfDay, lt: endOfDay },
            status: { notIn: [ReservationStatus.CANCELLED, ReservationStatus.NO_SHOW] },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: { paidAt: { gte: startOfDay, lt: endOfDay } },
        select: { method: true, amountFcfa: true },
      }),
    ]);

    const byMethod = {
      CASH: 0,
      ORANGE_MONEY: 0,
      WAVE: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
    };

    for (const p of todayPayments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amountFcfa;
    }

    const totalTodayFcfa =
      byMethod.CASH +
      byMethod.ORANGE_MONEY +
      byMethod.WAVE +
      byMethod.CARD +
      byMethod.BANK_TRANSFER;

    return {
      kpis: {
        toCollectFcfa: unpaidAgg._sum.balanceFcfa ?? 0,
        collectedTodayFcfa: totalTodayFcfa,
        unpaidCount: unpaidAgg._count._all ?? 0,
        departuresTodayToSettleCount,
      },
      dailyCash: {
        dateIso: todayIso,
        totalTodayFcfa,
        byMethod,
      },
      columns: {
        toPay: {
          items: toPayItems.map((inv) => this.formatSummaryCard(inv, todayIso)),
          total: toPayTotal,
          hasMore: openOffset + toPayItems.length < toPayTotal,
        },
        partial: {
          items: partialItems.map((inv) => this.formatSummaryCard(inv, todayIso)),
          total: partialTotal,
          hasMore: partialOffset + partialItems.length < partialTotal,
        },
        paid: {
          items: paidItems.map((inv) => this.formatSummaryCard(inv, todayIso)),
          total: paidTotal,
          hasMore: paidOffset + paidItems.length < paidTotal,
        },
      },
    };
  }

  async findAll() {
    await this.syncOpenStayNotesAndRoomOrders();
    const invoices = await this.prisma.invoice.findMany({
      include: this.detailInclude,
      orderBy: { issuedAt: 'desc' },
      take: 100,
    });
    return Promise.all(invoices.map((i) => this.formatDetail(i)));
  }

  async findOne(id: string): Promise<BillingNoteDetail> {
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Facture "${id}" introuvable.`);
    }
    await this.syncOpenStayNotesAndRoomOrders();
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: this.detailInclude,
    });
    if (!inv) {
      throw new NotFoundException(`Facture "${id}" introuvable.`);
    }
    return this.formatDetail(inv);
  }

  async create(dto: CreateInvoiceDto, actor: BillingActorContext): Promise<BillingNoteDetail> {
    const settings = await this.getHotelSettings();
    let resolvedRoomId = this.isUuid(dto.roomId) ? dto.roomId!.trim() : null;
    if (!resolvedRoomId && dto.roomNumber) {
      const r = await this.prisma.room.findUnique({ where: { number: dto.roomNumber.trim() } });
      if (r) resolvedRoomId = r.id;
    }

    const linesInput = dto.lines || [];
    const preparedLines = linesInput.map((l) => {
      const qty = Math.max(1, Math.round(l.quantity || 1));
      const unit = Math.round(l.unitPriceFcfa);
      const total = qty * unit;
      return {
        dateLabel: l.dateLabel || new Date().toLocaleDateString('fr-FR'),
        description: l.description.trim(),
        subDescription: l.subDescription?.trim() || null,
        category: l.category === 'TAX' ? 'TAX' : this.normalizeCategory(l.category),
        quantity: qty,
        quantityLabel: l.quantityLabel || `${qty}`,
        unitPriceFcfa: unit,
        totalPriceFcfa: total,
        isSystem: false,
      };
    });

    const grossLines = preparedLines
      .filter((l) => l.category !== 'TAX')
      .reduce((acc, l) => acc + l.totalPriceFcfa, 0);
    const discountFcfa = Math.round(dto.discountFcfa || 0);
    this.checkDiscountThreshold(
      grossLines,
      discountFcfa,
      settings.discountThresholdPercent ?? null,
      actor.actorRole,
    );

    const depositFcfa = Math.round(dto.depositFcfa || 0);
    const computed = this.computeInvoiceTotals({
      lines: preparedLines,
      discountFcfa,
      depositFcfa,
      paidAmountFcfa: 0,
      vatRatePercent: settings.vatRatePercent ?? 0,
      serviceRatePercent: settings.serviceRatePercent ?? 0,
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber: null,
          documentType: InvoiceDocumentType.INVOICE,
          isIssued: false,
          reservationId: this.isUuid(dto.reservationId) ? dto.reservationId!.trim() : null,
          guestId: this.isUuid(dto.guestId) ? dto.guestId!.trim() : null,
          roomId: resolvedRoomId,
          discountFcfa,
          vatRatePercent: settings.vatRatePercent ?? 0,
          serviceRatePercent: settings.serviceRatePercent ?? 0,
          subtotalHtFcfa: computed.subtotalHtFcfa,
          serviceAmountFcfa: computed.serviceAmountFcfa,
          vatAmountFcfa: computed.vatAmountFcfa,
          tourismTaxFcfa: computed.tourismTaxFcfa,
          totalFcfa: computed.totalFcfa,
          depositFcfa,
          paidAmountFcfa: 0,
          balanceFcfa: computed.balanceFcfa,
          status: computed.status,
          billingCompanyName: dto.billingCompanyName?.trim() || null,
          billingNinea: dto.billingNinea?.trim() || null,
          billingAddress: dto.billingAddress?.trim() || null,
          lines: { create: preparedLines },
        },
        include: this.detailInclude,
      });

      await tx.auditLog.create({
        data: {
          userId: actor.actorId || null,
          action: 'INVOICE_CREATE',
          entity: 'Invoice',
          entityId: inv.id,
          ip: actor.ip || null,
          after: {
            id: inv.id,
            totalFcfa: inv.totalFcfa,
            discountFcfa: inv.discountFcfa,
            actorRole: actor.actorRole,
          },
        },
      });

      return inv;
    });

    return this.formatDetail(created);
  }

  async addRoomRestaurantCharge(
    roomNumber: string,
    dto: RoomRestaurantChargeDto,
    actor: BillingActorContext,
  ) {
    const room = await this.prisma.room.findUnique({ where: { number: roomNumber.trim() } });
    if (!room) {
      throw new NotFoundException(`Chambre ${roomNumber} introuvable.`);
    }

    await this.syncOpenStayNotesAndRoomOrders();

    let openNote = await this.prisma.invoice.findFirst({
      where: {
        roomId: room.id,
        isIssued: false,
        documentType: InvoiceDocumentType.INVOICE,
        status: { not: InvoiceStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!openNote) {
      const activeRes = await this.prisma.reservation.findFirst({
        where: {
          roomId: room.id,
          status: { in: [ReservationStatus.CHECKED_IN, ReservationStatus.CONFIRMED] },
        },
        orderBy: { status: 'desc' },
      });
      if (!activeRes) {
        throw new BadRequestException(
          `Aucun séjour actif sur la chambre ${room.number} pour imputer une consommation restaurant.`,
        );
      }
      const settings = await this.getHotelSettings();
      openNote = await this.prisma.invoice.create({
        data: {
          invoiceNumber: null,
          isIssued: false,
          documentType: InvoiceDocumentType.INVOICE,
          reservationId: activeRes.id,
          guestId: activeRes.guestId,
          roomId: room.id,
          vatRatePercent: settings.vatRatePercent ?? 0,
          serviceRatePercent: settings.serviceRatePercent ?? 0,
          status: InvoiceStatus.OPEN,
        },
      });
    }

    return this.addLine(
      openNote.id,
      {
        description: dto.description,
        category: 'RESTAURANT',
        quantity: dto.quantity ?? 1,
        unitPriceFcfa: dto.unitPriceFcfa,
        dateLabel: dto.dateLabel,
      },
      actor,
    );
  }

  async addLine(id: string, dto: CreateInvoiceLineDto, actor: BillingActorContext) {
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Note "${id}" introuvable.`);
    }
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true, payments: true },
    });
    if (!existing) throw new NotFoundException(`Facture "${id}" introuvable.`);

    if (existing.isIssued) {
      throw new BadRequestException(
        'Une facture émise est immuable et ne peut pas être modifiée. Créez un avoir pour toute correction.',
      );
    }
    if (existing.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException("Impossible d'ajouter une ligne à une facture annulée.");
    }

    const requestedCat = dto.category ? this.normalizeCategory(dto.category) : 'RESTAURANT';
    if (actor.actorRole === 'RESTAURANT' && requestedCat !== 'RESTAURANT') {
      throw new ForbiddenException(
        'Le rôle RESTAURANT ne peut ajouter que des lignes de catégorie RESTAURANT.',
      );
    }

    const qty = Math.max(1, Math.round(dto.quantity || 1));
    const unit = Math.round(dto.unitPriceFcfa);
    const lineTotal = qty * unit;

    const updated = await this.prisma.$transaction(async (tx) => {
      const line = await tx.invoiceLine.create({
        data: {
          invoiceId: id,
          dateLabel: dto.dateLabel || new Date().toLocaleDateString('fr-FR'),
          description: dto.description.trim(),
          subDescription: dto.subDescription?.trim() || null,
          category: requestedCat,
          quantity: qty,
          quantityLabel: dto.quantityLabel || `${qty}`,
          unitPriceFcfa: unit,
          totalPriceFcfa: lineTotal,
        },
      });

      const inv = await this.recalculateAndPersist(tx, id);

      await tx.auditLog.create({
        data: {
          userId: actor.actorId || null,
          action: 'INVOICE_LINE_ADD',
          entity: 'InvoiceLine',
          entityId: line.id,
          ip: actor.ip || null,
          after: {
            invoiceId: id,
            category: requestedCat,
            description: line.description,
            quantity: qty,
            unitPriceFcfa: unit,
            totalPriceFcfa: lineTotal,
            actorRole: actor.actorRole,
          },
        },
      });

      return inv;
    });

    // RESTAURANT ne voit ni totaux généraux ni caisse
    if (actor.actorRole === 'RESTAURANT') {
      return {
        lineAdded: true,
        invoiceId: updated.id,
        roomNumber: updated.room?.number || null,
        category: requestedCat,
        description: dto.description.trim(),
        quantity: qty,
        totalPriceFcfa: lineTotal,
      };
    }

    return this.formatDetail(updated);
  }

  async updateDiscount(
    id: string,
    dto: UpdateDiscountDto,
    actor: BillingActorContext,
  ): Promise<BillingNoteDetail> {
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Facture "${id}" introuvable.`);
    }
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) throw new NotFoundException(`Facture "${id}" introuvable.`);
    if (existing.isIssued) {
      throw new BadRequestException(
        'Une facture émise est immuable et sa remise ne peut plus être modifiée.',
      );
    }

    const settings = await this.getHotelSettings();
    const grossLines = existing.lines
      .filter((l) => l.category.toUpperCase() !== 'TAX')
      .reduce((acc, l) => acc + l.totalPriceFcfa, 0);

    const discountFcfa = Math.round(dto.discountFcfa);
    this.checkDiscountThreshold(
      grossLines,
      discountFcfa,
      settings.discountThresholdPercent ?? null,
      actor.actorRole,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      const inv = await this.recalculateAndPersist(tx, id, discountFcfa);
      await tx.auditLog.create({
        data: {
          userId: actor.actorId || null,
          action: 'INVOICE_DISCOUNT_UPDATE',
          entity: 'Invoice',
          entityId: id,
          ip: actor.ip || null,
          before: { discountFcfa: existing.discountFcfa },
          after: { discountFcfa, reason: dto.reason?.trim() || null, actorRole: actor.actorRole },
        },
      });
      return inv;
    });

    return this.formatDetail(updated);
  }

  async addPayment(
    id: string,
    dto: CreatePaymentDto,
    actor: BillingActorContext,
  ): Promise<BillingNoteDetail> {
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Facture "${id}" introuvable.`);
    }

    this.assertNoCardPan(dto.transactionRef);

    const idempotencyKey = actor.idempotencyKey?.trim();
    if (idempotencyKey) {
      const existingPayment = await this.prisma.payment.findUnique({
        where: { idempotencyKey },
      });
      if (existingPayment) {
        return this.findOne(existingPayment.invoiceId);
      }
    }

    const amount = Math.round(dto.amountFcfa);
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new BadRequestException('Le montant encaissé doit être un entier strictement positif.');
    }

    const method = this.normalizePaymentMethod(dto.method);

    try {
      const updated = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.invoice.findUnique({
            where: { id },
            include: { payments: true, lines: true },
          });
          if (!existing) {
            throw new NotFoundException(`Facture "${id}" introuvable.`);
          }
          if (existing.documentType === InvoiceDocumentType.CREDIT_NOTE) {
            throw new BadRequestException("Impossible d'encaisser sur un avoir.");
          }
          if (existing.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestException("Impossible d'encaisser sur une facture annulée.");
          }

          if (idempotencyKey) {
            const replay = await tx.payment.findUnique({ where: { idempotencyKey } });
            if (replay) {
              return tx.invoice.findUnique({ where: { id }, include: this.detailInclude });
            }
          }

          const alreadyPaid = existing.payments.reduce((acc, p) => acc + p.amountFcfa, 0);
          const currentBalance = Math.max(0, existing.totalFcfa - existing.depositFcfa - alreadyPaid);
          if (currentBalance <= 0) {
            throw new BadRequestException('Cette note est déjà intégralement soldée.');
          }
          if (amount > currentBalance) {
            throw new BadRequestException(
              `Le montant encaissé (${amount} FCFA) dépasse le reste à payer (${currentBalance} FCFA).`,
            );
          }

          const payment = await tx.payment.create({
            data: {
              invoiceId: id,
              method,
              amountFcfa: amount,
              transactionRef: dto.transactionRef?.trim() || null,
              receivedById: actor.actorId || null,
              receivedByName: actor.actorName,
              idempotencyKey: idempotencyKey || null,
            },
          });

          const inv = await this.recalculateAndPersist(tx, id);

          await tx.auditLog.create({
            data: {
              userId: actor.actorId || null,
              action: 'PAYMENT_CREATE',
              entity: 'Payment',
              entityId: payment.id,
              ip: actor.ip || null,
              after: {
                invoiceId: id,
                method: payment.method,
                amountFcfa: payment.amountFcfa,
                transactionRef: payment.transactionRef,
                receivedByName: actor.actorName,
                remainingBalanceFcfa: inv.balanceFcfa,
              },
            },
          });

          return inv;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return this.formatDetail(updated);
    } catch (err: any) {
      if (
        idempotencyKey &&
        (err?.code === 'P2002' || String(err?.message || '').includes('idempotency_key'))
      ) {
        return this.findOne(id);
      }
      if (err?.code === 'P2034') {
        throw new ConflictException('Conflit concurrent lors de l’encaissement, veuillez réessayer.');
      }
      throw err;
    }
  }

  async reversePayment(
    invoiceId: string,
    paymentId: string,
    dto: ReversePaymentDto,
    actor: BillingActorContext,
  ): Promise<BillingNoteDetail> {
    if (actor.actorRole !== 'DIRECTION') {
      throw new ForbiddenException("L'annulation d'un paiement par écriture inverse est réservée à la DIRECTION.");
    }
    if (!this.isUuid(invoiceId) || !this.isUuid(paymentId)) {
      throw new NotFoundException('Facture ou paiement introuvable.');
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const original = await tx.payment.findUnique({ where: { id: paymentId } });
        if (!original || original.invoiceId !== invoiceId) {
          throw new NotFoundException(`Paiement "${paymentId}" introuvable sur cette facture.`);
        }
        if (original.isReversal || original.amountFcfa <= 0) {
          throw new BadRequestException("Impossible d'annuler une écriture d'annulation.");
        }

        const existingReversal = await tx.payment.findFirst({
          where: { reversedPaymentId: paymentId, isReversal: true },
        });
        if (existingReversal) {
          throw new ConflictException('Ce paiement a déjà fait l’objet d’une écriture inverse.');
        }

        const reversal = await tx.payment.create({
          data: {
            invoiceId,
            method: original.method,
            amountFcfa: -original.amountFcfa,
            transactionRef: original.transactionRef ? `ANNUL-${original.transactionRef}` : null,
            receivedById: actor.actorId || null,
            receivedByName: actor.actorName,
            isReversal: true,
            reversedPaymentId: original.id,
            reversalReason: dto.reason.trim(),
          },
        });

        const inv = await this.recalculateAndPersist(tx, invoiceId);

        await tx.auditLog.create({
          data: {
            userId: actor.actorId || null,
            action: 'PAYMENT_REVERSE',
            entity: 'Payment',
            entityId: reversal.id,
            ip: actor.ip || null,
            before: { originalPaymentId: original.id, amountFcfa: original.amountFcfa },
            after: {
              invoiceId,
              reversalAmountFcfa: reversal.amountFcfa,
              reason: dto.reason.trim(),
              balanceFcfa: inv.balanceFcfa,
            },
          },
        });

        return inv;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.formatDetail(updated);
  }

  async checkoutAndIssue(
    id: string,
    dto: CheckoutInvoiceDto,
    actor: BillingActorContext,
  ): Promise<BillingNoteDetail> {
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Facture "${id}" introuvable.`);
    }

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const inv = await tx.invoice.findUnique({
          where: { id },
          include: { reservation: true, room: true },
        });
        if (!inv) {
          throw new NotFoundException(`Facture "${id}" introuvable.`);
        }
        if (inv.documentType === InvoiceDocumentType.CREDIT_NOTE) {
          throw new BadRequestException("Un avoir ne peut pas déclencher de check-out.");
        }

        const hasBalance = inv.balanceFcfa > 0;
        if (hasBalance) {
          if (!dto.force) {
            throw new BadRequestException(
              `Check-out refusé : il reste ${inv.balanceFcfa} FCFA à régler sur cette note.`,
            );
          }
          if (actor.actorRole !== 'DIRECTION') {
            throw new ForbiddenException(
              'Le check-out forcé avec un reste à payer est réservé exclusivement à la DIRECTION.',
            );
          }
          if (!dto.reason || dto.reason.trim().length < 5) {
            throw new BadRequestException(
              'Un motif obligatoire (au moins 5 caractères) est requis pour un check-out forcé.',
            );
          }
        }

        let assignedNumber = inv.invoiceNumber;
        let issuedNow = false;
        if (!inv.isIssued || !assignedNumber) {
          assignedNumber = await this.nextSequenceNumber(tx, 'FA');
          issuedNow = true;
        }

        const updatedInv = await tx.invoice.update({
          where: { id },
          data: {
            invoiceNumber: assignedNumber,
            isIssued: true,
            issuedAt: issuedNow ? new Date() : inv.issuedAt,
            forcedCheckout: hasBalance ? true : inv.forcedCheckout,
            forcedCheckoutReason: hasBalance ? dto.reason!.trim() : inv.forcedCheckoutReason,
          },
          include: this.detailInclude,
        });

        if (inv.reservationId && inv.reservation?.status !== ReservationStatus.CHECKED_OUT) {
          await tx.reservation.update({
            where: { id: inv.reservationId },
            data: {
              status: ReservationStatus.CHECKED_OUT,
              checkedOutAt: new Date(),
            },
          });
        }

        if (inv.roomId) {
          await tx.room.update({
            where: { id: inv.roomId },
            data: { status: RoomStatus.CLEANING },
          });
        }

        await tx.auditLog.create({
          data: {
            userId: actor.actorId || null,
            action: hasBalance ? 'FORCED_CHECKOUT' : 'INVOICE_ISSUE',
            entity: 'Invoice',
            entityId: id,
            ip: actor.ip || null,
            after: {
              invoiceNumber: assignedNumber,
              reservationId: inv.reservationId,
              roomId: inv.roomId,
              balanceFcfa: inv.balanceFcfa,
              forcedCheckout: !!hasBalance,
              reason: dto.reason?.trim() || null,
              actorRole: actor.actorRole,
            },
          },
        });

        return tx.invoice.findUnique({ where: { id }, include: this.detailInclude });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.formatDetail(updated);
  }

  async createCreditNote(
    parentId: string,
    dto: CreateCreditNoteDto,
    actor: BillingActorContext,
  ): Promise<BillingNoteDetail> {
    if (!this.isUuid(parentId)) {
      throw new NotFoundException(`Facture "${parentId}" introuvable.`);
    }

    const creditNote = await this.prisma.$transaction(
      async (tx) => {
        const parent = await tx.invoice.findUnique({
          where: { id: parentId },
          include: { creditNotes: true },
        });
        if (!parent) {
          throw new NotFoundException(`Facture "${parentId}" introuvable.`);
        }
        if (!parent.isIssued || parent.documentType !== InvoiceDocumentType.INVOICE) {
          throw new BadRequestException(
            'Un avoir ne peut être créé que sur une facture émise (FA-AAAA-NNNN).',
          );
        }

        const alreadyCredited = parent.creditNotes.reduce(
          (acc, cn) => acc + Math.abs(cn.totalFcfa),
          0,
        );
        const remainingCreditable = Math.max(0, parent.totalFcfa - alreadyCredited);
        if (remainingCreditable <= 0) {
          throw new BadRequestException('Cette facture a déjà fait l’objet d’un avoir total.');
        }

        const amount =
          dto.amountFcfa !== undefined ? Math.round(dto.amountFcfa) : remainingCreditable;
        if (amount <= 0 || amount > remainingCreditable) {
          throw new BadRequestException(
            `Le montant de l'avoir (${amount} FCFA) doit être compris entre 1 et ${remainingCreditable} FCFA.`,
          );
        }

        const creditNumber = await this.nextSequenceNumber(tx, 'AV');
        const settings = await this.getHotelSettings(tx);
        const vatRate = parent.vatRatePercent ?? (settings.vatRatePercent ?? 0);
        const serviceRate = parent.serviceRatePercent ?? (settings.serviceRatePercent ?? 0);

        const computed = this.computeInvoiceTotals({
          lines: [{ category: 'AUTRES', totalPriceFcfa: -amount }],
          discountFcfa: 0,
          depositFcfa: 0,
          paidAmountFcfa: 0,
          vatRatePercent: vatRate,
          serviceRatePercent: serviceRate,
          isCreditNote: true,
        });

        const cn = await tx.invoice.create({
          data: {
            invoiceNumber: creditNumber,
            documentType: InvoiceDocumentType.CREDIT_NOTE,
            isIssued: true,
            parentInvoiceId: parent.id,
            reason: dto.reason.trim(),
            reservationId: parent.reservationId,
            guestId: parent.guestId,
            roomId: parent.roomId,
            vatRatePercent: vatRate,
            serviceRatePercent: serviceRate,
            subtotalHtFcfa: computed.subtotalHtFcfa,
            serviceAmountFcfa: computed.serviceAmountFcfa,
            vatAmountFcfa: computed.vatAmountFcfa,
            tourismTaxFcfa: 0,
            totalFcfa: -amount,
            depositFcfa: 0,
            paidAmountFcfa: 0,
            balanceFcfa: 0,
            status: InvoiceStatus.PAID,
            settledAt: new Date(),
            lines: {
              create: [
                {
                  dateLabel: new Date().toLocaleDateString('fr-FR'),
                  description: `Avoir sur facture ${parent.invoiceNumber} : ${dto.reason.trim()}`,
                  category: 'AUTRES',
                  quantity: 1,
                  quantityLabel: '1',
                  unitPriceFcfa: -amount,
                  totalPriceFcfa: -amount,
                  isSystem: true,
                },
              ],
            },
          },
          include: this.detailInclude,
        });

        await tx.auditLog.create({
          data: {
            userId: actor.actorId || null,
            action: 'CREDIT_NOTE_CREATE',
            entity: 'Invoice',
            entityId: cn.id,
            ip: actor.ip || null,
            after: {
              creditNumber,
              parentInvoiceId: parent.id,
              parentInvoiceNumber: parent.invoiceNumber,
              totalFcfa: cn.totalFcfa,
              reason: dto.reason.trim(),
              actorRole: actor.actorRole,
            },
          },
        });

        return cn;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.formatDetail(creditNote);
  }

  async removeLine(id: string, lineId: string, actor: BillingActorContext): Promise<BillingNoteDetail> {
    if (!this.isUuid(id) || !this.isUuid(lineId)) {
      throw new NotFoundException('Note ou ligne introuvable.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.findUnique({ where: { id } });
      if (!inv) throw new NotFoundException(`Facture "${id}" introuvable.`);
      if (inv.isIssued || inv.documentType === InvoiceDocumentType.CREDIT_NOTE) {
        throw new BadRequestException(
          'Une facture émise ou un avoir est immuable : impossible de supprimer une ligne.',
        );
      }

      const line = await tx.invoiceLine.findFirst({ where: { id: lineId, invoiceId: id } });
      if (!line) throw new NotFoundException(`Ligne "${lineId}" introuvable.`);
      if (line.isSystem || (line.category || '').toUpperCase() === 'TAX') {
        throw new BadRequestException('Les lignes système (nuitées, taxes, restaurant auto) ne peuvent pas être supprimées.');
      }

      await tx.invoiceLine.delete({ where: { id: lineId } });
      const recalculated = await this.recalculateAndPersist(tx, id);

      await tx.auditLog.create({
        data: {
          userId: actor.actorId || null,
          action: 'INVOICE_LINE_DELETE',
          entity: 'InvoiceLine',
          entityId: lineId,
          ip: actor.ip || null,
          before: { invoiceId: id, description: line.description, totalPriceFcfa: line.totalPriceFcfa },
          after: { invoiceId: id, newTotalFcfa: recalculated.totalFcfa },
        },
      });

      return recalculated;
    });

    return this.formatDetail(updated);
  }

  async removeOrBlockIssued(id: string, actor: BillingActorContext) {
    if (!this.isUuid(id)) {
      throw new NotFoundException(`Facture "${id}" introuvable.`);
    }
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!existing) throw new NotFoundException(`Facture "${id}" introuvable.`);

    if (existing.isIssued) {
      throw new BadRequestException(
        'Une facture émise est immuable et ne peut pas être supprimée. Créez un avoir pour toute correction.',
      );
    }

    if (existing.payments.length > 0) {
      throw new BadRequestException(
        "Cette note comporte des paiements enregistrés : annulez-les par écriture inverse ou émettez un avoir.",
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          userId: actor.actorId || null,
          action: 'INVOICE_DELETE',
          entity: 'Invoice',
          entityId: existing.id,
          ip: actor.ip || null,
          before: { id: existing.id, totalFcfa: existing.totalFcfa },
        },
      });
      await tx.invoice.delete({ where: { id } });
    });

    return { deleted: true, id };
  }

  async streamInvoicePdf(
    id: string,
    actor: BillingActorContext,
    res: Response,
  ): Promise<void> {
    const detail = await this.findOne(id);
    const settings = await this.getHotelSettings();

    const safeNumber = (detail.invoiceNumber || `NOTE-OUVERTE-${detail.id.slice(0, 8)}`).replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${safeNumber}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    // Logo local s'il est configuré et présent sur disque
    const candidateLogoPaths = [
      settings.invoiceLogoPath,
      path.resolve(process.cwd(), 'apps/web/src/assets/images/logo-residence-blue.png'),
      path.resolve(process.cwd(), 'assets/images/logo-residence-blue.png'),
    ].filter((p): p is string => !!p);

    let logoRendered = false;
    for (const logoPath of candidateLogoPaths) {
      try {
        if (fs.existsSync(logoPath)) {
          doc.image(logoPath, 40, 38, { width: 48 });
          logoRendered = true;
          break;
        }
      } catch {
        // Ignorer si format non supporté
      }
    }

    if (!logoRendered) {
      doc.save();
      doc.roundedRect(40, 38, 42, 42, 6).fill('#00666f');
      doc.fillColor('#ffffff').fontSize(16).text('RB', 40, 51, { width: 42, align: 'center' });
      doc.restore();
    }

    // En-tête hôtel (Paramètres)
    doc.fillColor('#161d20').fontSize(16).text(settings.legalName || settings.hotelName, 96, 40);
    doc.fillColor('#3d494a').fontSize(9);
    doc.text(`${settings.fullAddress} • Tél : ${settings.supportPhone}`, 96, 60);
    doc.text(`NINEA : ${settings.ninea} • RCCM : ${settings.rccm}`, 96, 73);

    doc.moveDown(1.8);
    doc.strokeColor('#bdc9ca').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.8);

    // Titre document & client
    const docTitle =
      detail.documentType === 'CREDIT_NOTE'
        ? `AVOIR N° ${detail.displayNumber}`
        : detail.isIssued
          ? `FACTURE N° ${detail.displayNumber}`
          : `NOTE DE SÉJOUR OUVERTE (Proforma)`;

    doc.fillColor('#00666f').fontSize(14).text(docTitle);
    doc.fillColor('#161d20').fontSize(10);
    doc.text(`Date d'édition : ${new Date(detail.issuedAt).toLocaleDateString('fr-FR')}`);
    if (detail.parentInvoiceNumber) {
      doc.text(`Facture d'origine liée : ${detail.parentInvoiceNumber}`);
    }
    doc.text(`Client : ${detail.guestName}${detail.phone ? ` • ${detail.phone}` : ''}`);
    doc.text(`Chambre : ${detail.roomNumber} (${detail.roomCategory}) • ${detail.stayLabel}`);
    doc.moveDown(0.8);

    // Lignes groupées par catégorie
    const categories: BillingLineCategory[] = [
      'HEBERGEMENT',
      'RESTAURANT',
      'PISCINE',
      'BLANCHISSERIE',
      'AUTRES',
    ];
    const extraTaxLines = detail.lines.filter((l) => l.rawCategory === 'TAX');

    for (const cat of categories) {
      const catLines = detail.lines.filter(
        (l) => l.category === cat && l.rawCategory !== 'TAX',
      );
      if (catLines.length === 0) continue;

      doc.fillColor('#00666f').fontSize(10).text(CATEGORY_LABELS[cat].toUpperCase());
      for (const l of catLines) {
        doc
          .fillColor('#161d20')
          .fontSize(9.5)
          .text(
            `• ${l.description} (${l.quantity} × ${l.unitPriceFcfa} FCFA)`,
            50,
            doc.y,
            { continued: true, width: 380 },
          )
          .text(`${l.totalPriceFcfa} FCFA`, { align: 'right' });
      }
      doc.moveDown(0.3);
    }

    if (extraTaxLines.length > 0) {
      doc.fillColor('#00666f').fontSize(10).text('TAXE DE SÉJOUR');
      for (const l of extraTaxLines) {
        doc
          .fillColor('#161d20')
          .fontSize(9.5)
          .text(`• ${l.description} (${l.quantity} × ${l.unitPriceFcfa} FCFA)`, 50, doc.y, {
            continued: true,
            width: 380,
          })
          .text(`${l.totalPriceFcfa} FCFA`, { align: 'right' });
      }
      doc.moveDown(0.3);
    }

    // Totaux
    doc.moveDown(0.5);
    doc.strokeColor('#bdc9ca').lineWidth(0.5).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fillColor('#161d20').fontSize(10);
    doc.text(`Sous-total HT : ${detail.subtotalHtFcfa} FCFA`, { align: 'right' });
    if (detail.discountFcfa > 0) {
      doc.text(`Remise : -${detail.discountFcfa} FCFA`, { align: 'right' });
    }
    doc.text(`Service (${detail.serviceRatePercent} %) : ${detail.serviceAmountFcfa} FCFA`, { align: 'right' });
    doc.text(`TVA (${detail.vatRatePercent} %) : ${detail.vatAmountFcfa} FCFA`, { align: 'right' });
    doc.text(`Taxe de séjour : ${detail.tourismTaxFcfa} FCFA`, { align: 'right' });
    doc.moveDown(0.3);
    doc.fillColor('#00666f').fontSize(12).text(`TOTAL TTC : ${detail.totalFcfa} FCFA`, { align: 'right' });
    doc.fillColor('#161d20').fontSize(10).text(`Acompte / Déjà réglé : ${detail.depositFcfa + detail.paidAmountFcfa} FCFA`, { align: 'right' });
    doc.fillColor(detail.balanceFcfa > 0 ? '#ba1a1a' : '#00666f')
      .fontSize(11)
      .text(`RESTE À PAYER : ${detail.balanceFcfa} FCFA`, { align: 'right' });

    // Paiements
    if (detail.payments.length > 0) {
      doc.moveDown(0.8);
      doc.fillColor('#00666f').fontSize(10).text('HISTORIQUE DES PAIEMENTS');
      for (const p of detail.payments) {
        doc
          .fillColor('#161d20')
          .fontSize(9)
          .text(
            `• ${new Date(p.paidAt).toLocaleString('fr-FR')} — ${p.methodLabel} : ${p.amountFcfa} FCFA` +
              (p.transactionRef ? ` (Réf: ${p.transactionRef})` : '') +
              ` — Par ${p.receivedByName}`,
          );
      }
    }

    // Montant en lettres en français
    doc.moveDown(1);
    doc
      .fillColor('#161d20')
      .fontSize(10)
      .text(`Arrêtée la présente pièce à la somme de : ${detail.totalInWordsFr}.`);

    doc.end();

    await this.prisma.auditLog.create({
      data: {
        userId: actor.actorId || null,
        action: 'INVOICE_PDF_EXPORT',
        entity: 'Invoice',
        entityId: detail.id,
        ip: actor.ip || null,
        after: { invoiceNumber: detail.displayNumber, actorRole: actor.actorRole },
      },
    });
  }

  async streamCashClosureExport(
    format: 'pdf' | 'excel',
    actor: BillingActorContext,
    res: Response,
  ): Promise<void> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
    const dateIso = startOfDay.toISOString().slice(0, 10);

    const [settings, payments] = await Promise.all([
      this.getHotelSettings(),
      this.prisma.payment.findMany({
        where: { paidAt: { gte: startOfDay, lt: endOfDay } },
        include: { invoice: { include: { guest: true, room: true } }, receivedBy: true },
        orderBy: { paidAt: 'asc' },
      }),
    ]);

    const byMethod = new Map<PaymentMethod, number>([
      [PaymentMethod.CASH, 0],
      [PaymentMethod.ORANGE_MONEY, 0],
      [PaymentMethod.WAVE, 0],
      [PaymentMethod.CARD, 0],
      [PaymentMethod.BANK_TRANSFER, 0],
    ]);

    let totalFcfa = 0;
    for (const p of payments) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amountFcfa);
      totalFcfa += p.amountFcfa;
    }

    if (format === 'excel') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="cloture-caisse-${dateIso}.xlsx"`,
      );

      const ExcelJSClass: any = (ExcelJS as any).default || ExcelJS;
      const workbook = new ExcelJSClass.stream.xlsx.WorkbookWriter({
        stream: res,
        useStyles: true,
        useSharedStrings: true,
      });

      const sheet = workbook.addWorksheet('Clôture du jour');
      sheet.columns = [
        { header: 'Heure', key: 'time', width: 12 },
        { header: 'Facture', key: 'invoice', width: 18 },
        { header: 'Client', key: 'guest', width: 24 },
        { header: 'Chambre', key: 'room', width: 10 },
        { header: 'Mode', key: 'method', width: 18 },
        { header: 'Référence', key: 'ref', width: 22 },
        { header: 'Montant FCFA', key: 'amount', width: 16 },
        { header: 'Encaissé par', key: 'actor', width: 20 },
      ];

      for (const p of payments) {
        sheet
          .addRow({
            time: new Date(p.paidAt).toLocaleTimeString('fr-FR'),
            invoice: sanitizeSpreadsheetCell(p.invoice?.invoiceNumber || 'Note ouverte'),
            guest: sanitizeSpreadsheetCell(p.invoice?.guest?.fullName || 'Client'),
            room: sanitizeSpreadsheetCell(p.invoice?.room?.number || '—'),
            method: sanitizeSpreadsheetCell(METHOD_LABELS[p.method] || p.method),
            ref: sanitizeSpreadsheetCell(p.transactionRef || ''),
            amount: p.amountFcfa,
            actor: sanitizeSpreadsheetCell(p.receivedBy?.fullName || p.receivedByName || 'Réception'),
          })
          .commit();
      }

      sheet
        .addRow({
          time: 'TOTAL',
          invoice: '',
          guest: '',
          room: '',
          method: 'TOUS MODES',
          ref: `${payments.length} opération(s)`,
          amount: totalFcfa,
          actor: '',
        })
        .commit();

      sheet.commit();
      await workbook.commit();
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="cloture-caisse-${dateIso}.pdf"`);

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      doc.pipe(res);
      doc.fillColor('#161d20').fontSize(16).text(`${settings.legalName || settings.hotelName} — CLÔTURE DE CAISSE`);
      doc.fillColor('#3d494a').fontSize(9.5).text(`${settings.fullAddress} • NINEA : ${settings.ninea} • RCCM : ${settings.rccm}`);
      doc.moveDown(0.5);
      doc.fillColor('#00666f').fontSize(12).text(`Journée du ${new Date(startOfDay).toLocaleDateString('fr-FR')}`);
      doc.moveDown(0.8);

      for (const [m, val] of byMethod.entries()) {
        doc.fillColor('#161d20').fontSize(10).text(`• ${METHOD_LABELS[m]} : ${val} FCFA`);
      }

      doc.moveDown(0.5);
      doc.fillColor('#00666f').fontSize(12).text(`TOTAL ENCAISSÉ : ${totalFcfa} FCFA`);
      doc.fillColor('#161d20').fontSize(10).text(`Soit : ${numberToFrenchWordsFcfa(totalFcfa)}`);
      doc.moveDown(0.8);

      if (payments.length > 0) {
        doc.fillColor('#00666f').fontSize(10).text('DÉTAIL DES OPÉRATIONS');
        for (const p of payments) {
          doc
            .fillColor('#161d20')
            .fontSize(9)
            .text(
              `${new Date(p.paidAt).toLocaleTimeString('fr-FR')} • ${p.invoice?.invoiceNumber || 'Note ouverte'} • ` +
                `${p.invoice?.guest?.fullName || 'Client'} • ${METHOD_LABELS[p.method]} : ${p.amountFcfa} FCFA`,
            );
        }
      }

      doc.moveDown(1);
      doc.fillColor('#3d494a').fontSize(9).text(`Exporté par ${actor.actorName} (${actor.actorRole})`);
      doc.end();
    }

    await this.prisma.auditLog.create({
      data: {
        userId: actor.actorId || null,
        action: 'CASH_CLOSURE_EXPORT',
        entity: 'CashClosure',
        entityId: dateIso,
        ip: actor.ip || null,
        after: {
          format,
          dateIso,
          totalFcfa,
          operationsCount: payments.length,
          actorRole: actor.actorRole,
        },
      },
    });
  }
}
