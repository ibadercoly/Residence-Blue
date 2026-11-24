import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CreateCashClosureDto } from './dto/cash-closure.dto';

export interface CashClosureActor {
  id: string;
  fullName: string;
  role: string;
  ip?: string;
}

export interface CashClosureByMethod {
  CASH: number;
  ORANGE_MONEY: number;
  WAVE: number;
  CARD: number;
  BANK_TRANSFER: number;
}

export interface CashClosureItem {
  id: string;
  businessDate: string;
  closedAt: string;
  closedById: string;
  closedByName: string;
  totalTheoreticalCash: number;
  totalCountedCash: number;
  difference: number;
  notes: string | null;
}

export interface TodayCashClosureStatus {
  businessDate: string;
  isClosedToday: boolean;
  latestClosureToday: CashClosureItem | null;
  totalTheoreticalCash: number;
  totalCollectedToday: number;
  byMethod: CashClosureByMethod;
}

@Injectable()
export class CashClosureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Calcule la date civile et les bornes exactes [00:00:00.000Z .. 23:59:59.999Z]
   * en heure officielle du Sénégal (Africa/Dakar, UTC+0 permanent).
   */
  getDakarDayBounds(reference: Date = new Date()): {
    businessDate: string;
    startOfDay: Date;
    endOfDay: Date;
  } {
    const businessDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Dakar',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(reference);

    return {
      businessDate,
      startOfDay: new Date(`${businessDate}T00:00:00.000Z`),
      endOfDay: new Date(`${businessDate}T23:59:59.999Z`),
    };
  }

  private formatClosure(row: {
    id: string;
    businessDate: string;
    closedAt: Date;
    closedById: string;
    closedByName: string;
    totalTheoreticalCash: number;
    totalCountedCash: number;
    difference: number;
    notes: string | null;
  }): CashClosureItem {
    return {
      id: row.id,
      businessDate: row.businessDate,
      closedAt: row.closedAt.toISOString(),
      closedById: row.closedById,
      closedByName: row.closedByName,
      totalTheoreticalCash: row.totalTheoreticalCash,
      totalCountedCash: row.totalCountedCash,
      difference: row.difference,
      notes: row.notes,
    };
  }

  private async computeTodayPaymentsByMethod(
    startOfDay: Date,
    endOfDay: Date,
  ): Promise<CashClosureByMethod> {
    const payments = await this.prisma.payment.findMany({
      where: {
        paidAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        invoice: {
          status: { not: 'CANCELLED' },
        },
      },
      select: {
        method: true,
        amountFcfa: true,
      },
    });

    const byMethod: CashClosureByMethod = {
      CASH: 0,
      ORANGE_MONEY: 0,
      WAVE: 0,
      CARD: 0,
      BANK_TRANSFER: 0,
    };

    for (const p of payments) {
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amountFcfa;
    }

    return byMethod;
  }

  async getTodayStatus(reference: Date = new Date()): Promise<TodayCashClosureStatus> {
    const { businessDate, startOfDay, endOfDay } = this.getDakarDayBounds(reference);

    const [byMethod, latestToday] = await Promise.all([
      this.computeTodayPaymentsByMethod(startOfDay, endOfDay),
      this.prisma.cashClosure.findFirst({
        where: { businessDate },
        orderBy: { closedAt: 'desc' },
      }),
    ]);

    const totalTheoreticalCash = Math.max(0, byMethod[PaymentMethod.CASH]);
    const totalCollectedToday =
      byMethod.CASH +
      byMethod.ORANGE_MONEY +
      byMethod.WAVE +
      byMethod.CARD +
      byMethod.BANK_TRANSFER;

    return {
      businessDate,
      isClosedToday: Boolean(latestToday),
      latestClosureToday: latestToday ? this.formatClosure(latestToday) : null,
      totalTheoreticalCash,
      totalCollectedToday,
      byMethod,
    };
  }

  async createCashClosure(
    dto: CreateCashClosureDto,
    actor: CashClosureActor,
    reference: Date = new Date(),
  ): Promise<CashClosureItem> {
    if (!actor.id) {
      throw new BadRequestException('Utilisateur non identifié pour la clôture de caisse.');
    }

    const { businessDate, startOfDay, endOfDay } = this.getDakarDayBounds(reference);
    const byMethod = await this.computeTodayPaymentsByMethod(startOfDay, endOfDay);
    const totalTheoreticalCash = Math.max(0, byMethod[PaymentMethod.CASH]);
    const totalCountedCash = Math.round(dto.totalCountedCash);
    const difference = totalCountedCash - totalTheoreticalCash;
    const cleanNotes = dto.notes?.trim() ? dto.notes.trim() : null;

    const created = await this.prisma.$transaction(async (tx) => {
      const closure = await tx.cashClosure.create({
        data: {
          id: crypto.randomUUID(),
          businessDate,
          closedAt: reference,
          closedById: actor.id,
          closedByName: actor.fullName || `Opérateur (${actor.role})`,
          totalTheoreticalCash,
          totalCountedCash,
          difference,
          notes: cleanNotes,
        },
      });

      await this.auditService.log(
        {
          userId: actor.id,
          action: 'CASH_CLOSURE_CREATED',
          entity: 'CashClosure',
          entityId: closure.id,
          ip: actor.ip ?? null,
          after: {
            businessDate,
            totalTheoreticalCash,
            totalCountedCash,
            difference,
            notes: cleanNotes,
            byMethod,
          },
        },
        tx,
      );

      return closure;
    });

    return this.formatClosure(created);
  }

  async getHistory(limit = 50): Promise<CashClosureItem[]> {
    const safeLimit = Math.min(Math.max(1, limit), 200);
    const rows = await this.prisma.cashClosure.findMany({
      orderBy: { closedAt: 'desc' },
      take: safeLimit,
    });
    return rows.map((r) => this.formatClosure(r));
  }
}
