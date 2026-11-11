import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, CreateInvoiceLineDto, CreatePaymentDto } from './dto/billing.dto';
import { InvoiceStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizePaymentMethod(raw: string): PaymentMethod {
    const upper = (raw || 'CASH').toUpperCase();
    if (upper === 'WAVE') return PaymentMethod.WAVE;
    if (upper === 'ORANGE_MONEY' || upper === 'OM') return PaymentMethod.ORANGE_MONEY;
    if (upper === 'CARD' || upper === 'CARTE') return PaymentMethod.CARD;
    if (upper === 'BANK_TRANSFER' || upper === 'VIREMENT') return PaymentMethod.BANK_TRANSFER;
    return PaymentMethod.CASH;
  }

  private formatInvoice(inv: any) {
    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      reservationId: inv.reservationId,
      guestId: inv.guestId,
      guestName: inv.guest?.fullName || 'Client Résidence Blue',
      phone: inv.guest?.phone || '+221 77 000 00 00',
      roomId: inv.roomId,
      roomNumber: inv.room?.number || '101',
      roomCategory: inv.room?.category || 'Standard',
      roomName: inv.room ? `Chambre ${inv.room.number} — ${inv.room.category}` : 'Chambre',
      subtotalHtFcfa: inv.subtotalHtFcfa,
      vatRatePercent: inv.vatRatePercent,
      vatAmountFcfa: inv.vatAmountFcfa,
      tourismTaxFcfa: inv.tourismTaxFcfa,
      totalFcfa: inv.totalFcfa,
      depositFcfa: inv.depositFcfa,
      paidAmountFcfa: inv.paidAmountFcfa,
      balanceFcfa: inv.balanceFcfa,
      status: inv.status,
      isPaid: inv.status === InvoiceStatus.PAID,
      billingEntity: {
        companyName: inv.billingCompanyName || 'Particulier',
        ninea: inv.billingNinea || '',
        address: inv.billingAddress || 'Thiès, Sénégal',
      },
      items: (inv.lines || []).map((l: any) => ({
        id: l.id,
        date: l.dateLabel || new Date(l.createdAt).toLocaleDateString('fr-FR'),
        description: l.description,
        subDescription: l.subDescription || '',
        category: l.category || 'ROOM',
        quantity: l.quantityLabel || l.quantity,
        unitPriceFcfa: l.unitPriceFcfa,
        totalPriceFcfa: l.totalPriceFcfa,
      })),
      payments: (inv.payments || []).map((p: any) => ({
        id: p.id,
        method: p.method,
        amountFcfa: p.amountFcfa,
        transactionRef: p.transactionRef,
        paidAt: p.paidAt,
      })),
      issuedAt: inv.issuedAt,
      settledAt: inv.settledAt,
    };
  }

  async findAll() {
    const invoices = await this.prisma.invoice.findMany({
      include: { lines: true, payments: true, guest: true, room: true },
      orderBy: { issuedAt: 'desc' },
    });
    return invoices.map((i) => this.formatInvoice(i));
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true, payments: true, guest: true, room: true },
    });
    if (!inv) throw new NotFoundException(`Facture "${id}" introuvable.`);
    return this.formatInvoice(inv);
  }

  async create(dto: CreateInvoiceDto) {
    let resolvedRoomId = dto.roomId && /^[0-9a-f-]{36}$/i.test(dto.roomId) ? dto.roomId : null;
    if (!resolvedRoomId && dto.roomNumber) {
      const r = await this.prisma.room.findUnique({ where: { number: dto.roomNumber.trim() } });
      if (r) resolvedRoomId = r.id;
    }

    const linesInput = dto.lines || [];
    const preparedLines = linesInput.map((l) => {
      const qty = Math.max(1, Math.round(l.quantity || 1));
      const unit = Math.round(l.unitPriceFcfa);
      const total = l.totalPriceFcfa !== undefined ? Math.round(l.totalPriceFcfa) : qty * unit;
      return {
        dateLabel: l.dateLabel || new Date().toLocaleDateString('fr-FR'),
        description: l.description.trim(),
        subDescription: l.subDescription?.trim() || null,
        category: l.category || 'ROOM',
        quantity: qty,
        quantityLabel: l.quantityLabel || `${qty}`,
        unitPriceFcfa: unit,
        totalPriceFcfa: total,
      };
    });

    const totalFcfa = preparedLines.reduce((acc, l) => acc + l.totalPriceFcfa, 0);
    const tourismTaxFcfa = preparedLines
      .filter((l) => l.category === 'TAX')
      .reduce((acc, l) => acc + l.totalPriceFcfa, 0);
    const taxableTtc = Math.max(0, totalFcfa - tourismTaxFcfa);
    const subtotalHtFcfa = Math.round(taxableTtc / 1.1);
    const vatAmountFcfa = taxableTtc - subtotalHtFcfa;
    const depositFcfa = Math.round(dto.depositFcfa || 0);
    const balanceFcfa = Math.max(0, totalFcfa - depositFcfa);
    const invoiceNumber =
      dto.invoiceNumber?.trim() || `#INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const created = await this.prisma.$transaction(async (tx) => {
      const inv = await tx.invoice.create({
        data: {
          invoiceNumber,
          reservationId: dto.reservationId && /^[0-9a-f-]{36}$/i.test(dto.reservationId) ? dto.reservationId : null,
          guestId: dto.guestId && /^[0-9a-f-]{36}$/i.test(dto.guestId) ? dto.guestId : null,
          roomId: resolvedRoomId,
          subtotalHtFcfa,
          vatRatePercent: 10,
          vatAmountFcfa,
          tourismTaxFcfa,
          totalFcfa,
          depositFcfa,
          paidAmountFcfa: 0,
          balanceFcfa,
          status: balanceFcfa === 0 && totalFcfa > 0 ? InvoiceStatus.PAID : depositFcfa > 0 ? InvoiceStatus.PARTIAL : InvoiceStatus.OPEN,
          billingCompanyName: dto.billingCompanyName || null,
          billingNinea: dto.billingNinea || null,
          billingAddress: dto.billingAddress || null,
          lines: {
            create: preparedLines,
          },
        },
        include: { lines: true, payments: true, guest: true, room: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'INVOICE_CREATE',
          entity: 'Invoice',
          entityId: inv.id,
          after: { id: inv.id, invoiceNumber: inv.invoiceNumber, totalFcfa: inv.totalFcfa },
        },
      });

      return inv;
    });

    return this.formatInvoice(created);
  }

  async addLine(id: string, dto: CreateInvoiceLineDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lines: true, payments: true },
    });
    if (!existing) throw new NotFoundException(`Facture "${id}" introuvable.`);

    const qty = Math.max(1, Math.round(dto.quantity || 1));
    const unit = Math.round(dto.unitPriceFcfa);
    const lineTotal = dto.totalPriceFcfa !== undefined ? Math.round(dto.totalPriceFcfa) : qty * unit;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.invoiceLine.create({
        data: {
          invoiceId: id,
          dateLabel: dto.dateLabel || new Date().toLocaleDateString('fr-FR'),
          description: dto.description.trim(),
          subDescription: dto.subDescription?.trim() || null,
          category: dto.category || 'RESTAURANT',
          quantity: qty,
          quantityLabel: dto.quantityLabel || `${qty}`,
          unitPriceFcfa: unit,
          totalPriceFcfa: lineTotal,
        },
      });

      const allLines = await tx.invoiceLine.findMany({ where: { invoiceId: id } });
      const totalFcfa = allLines.reduce((acc, l) => acc + l.totalPriceFcfa, 0);
      const tourismTaxFcfa = allLines
        .filter((l) => l.category === 'TAX')
        .reduce((acc, l) => acc + l.totalPriceFcfa, 0);
      const taxableTtc = Math.max(0, totalFcfa - tourismTaxFcfa);
      const subtotalHtFcfa = Math.round(taxableTtc / 1.1);
      const vatAmountFcfa = taxableTtc - subtotalHtFcfa;
      const balanceFcfa = Math.max(0, totalFcfa - existing.depositFcfa - existing.paidAmountFcfa);

      return tx.invoice.update({
        where: { id },
        data: {
          subtotalHtFcfa,
          vatAmountFcfa,
          tourismTaxFcfa,
          totalFcfa,
          balanceFcfa,
          status:
            balanceFcfa === 0 && totalFcfa > 0
              ? InvoiceStatus.PAID
              : existing.paidAmountFcfa + existing.depositFcfa > 0
                ? InvoiceStatus.PARTIAL
                : InvoiceStatus.OPEN,
        },
        include: { lines: true, payments: true, guest: true, room: true },
      });
    });

    return this.formatInvoice(updated);
  }

  async addPayment(id: string, dto: CreatePaymentDto) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { payments: true, lines: true },
    });
    if (!existing) throw new NotFoundException(`Facture "${id}" introuvable.`);

    const amount = Math.round(dto.amountFcfa);
    if (amount <= 0) {
      throw new BadRequestException('Le montant du paiement doit être un entier strictement positif.');
    }

    const method = this.normalizePaymentMethod(dto.method);

    const updated = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          method,
          amountFcfa: amount,
          transactionRef: dto.transactionRef?.trim() || null,
        },
      });

      const allPayments = await tx.payment.findMany({ where: { invoiceId: id } });
      const paidAmountFcfa = allPayments.reduce((acc, p) => acc + p.amountFcfa, 0);
      const balanceFcfa = Math.max(0, existing.totalFcfa - existing.depositFcfa - paidAmountFcfa);
      const isPaid = balanceFcfa === 0;

      const inv = await tx.invoice.update({
        where: { id },
        data: {
          paidAmountFcfa,
          balanceFcfa,
          status: isPaid ? InvoiceStatus.PAID : InvoiceStatus.PARTIAL,
          settledAt: isPaid ? new Date() : existing.settledAt,
        },
        include: { lines: true, payments: true, guest: true, room: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'PAYMENT_CREATE',
          entity: 'Payment',
          entityId: payment.id,
          after: {
            invoiceId: id,
            method: payment.method,
            amountFcfa: payment.amountFcfa,
            transactionRef: payment.transactionRef,
            remainingBalanceFcfa: balanceFcfa,
          },
        },
      });

      return inv;
    });

    return this.formatInvoice(updated);
  }

  async removeOrCancel(id: string) {
    const existing = await this.prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });
    if (!existing) throw new NotFoundException(`Facture "${id}" introuvable.`);

    if (existing.payments.length > 0) {
      const cancelled = await this.prisma.invoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED },
        include: { lines: true, payments: true, guest: true, room: true },
      });
      return { deleted: false, cancelled: true, invoice: this.formatInvoice(cancelled) };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_DELETE',
          entity: 'Invoice',
          entityId: existing.id,
          before: { id: existing.id, invoiceNumber: existing.invoiceNumber, totalFcfa: existing.totalFcfa },
        },
      });
      await tx.invoice.delete({ where: { id } });
    });

    return { deleted: true, cancelled: false, id };
  }
}
