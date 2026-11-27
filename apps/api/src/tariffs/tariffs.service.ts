import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ExtraServiceItemDto,
  ReservationPriceQuoteDto,
  RoomTariffDto,
  TariffCategoryDto,
  TariffGridResponseDto,
  UNCLASSIFIED_ROOM_CATEGORY,
  normalizeTariffCategoryCode,
} from '@residence-blue/shared';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { loadRealTariffsAndIdentity } from './real-tariffs-loader.util';
import {
  CreateExtraServiceDto,
  TariffQuoteQueryDto,
  UpdateExtraServiceDto,
  UpdateTariffGridDto,
} from './dto/tariffs.dto';
import {
  DirectorPriceOverrideInput,
  TariffLookupRow,
  calculateStayPrice,
} from './pricing-calculator.util';

export interface TariffActorContext {
  userId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  ip?: string | null;
}

@Injectable()
export class TariffsService implements OnModuleInit {
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureRealDataLoaded();
    } catch {
      // Ne jamais bloquer le démarrage si la base est en cours de migration
    }
  }

  /**
   * Garantit la présence idempotente des catégories, tarifs réels, prestations
   * et champs vides de l'identité de l'hôtel sans jamais écraser les modifications de la direction.
   */
  async ensureRealDataLoaded(force = false): Promise<void> {
    if (this.initialized && !force) {
      const catCount = await this.prisma.tariffCategory.count();
      if (catCount >= 3) return;
    }
    await loadRealTariffsAndIdentity(this.prisma);
    this.initialized = true;
  }

  async getTariffGrid(): Promise<TariffGridResponseDto> {
    await this.ensureRealDataLoaded();

    const [categories, tariffs, extraServices] = await Promise.all([
      this.prisma.tariffCategory.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.roomTariff.findMany({
        include: { category: true },
        orderBy: [
          { category: { displayOrder: 'asc' } },
          { displayOrder: 'asc' },
          { guestsCount: 'asc' },
        ],
      }),
      this.prisma.extraServiceItem.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      }),
    ]);

    const categoryDtos: TariffCategoryDto[] = categories.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      displayOrder: c.displayOrder,
      isActive: c.isActive,
    }));

    const tariffDtos: RoomTariffDto[] = tariffs.map((t) => ({
      id: t.id,
      categoryId: t.categoryId,
      categoryCode: t.category.code,
      categoryName: t.category.name,
      guestsCount: t.guestsCount,
      roomsUsed: t.roomsUsed,
      label: t.label,
      pricePerNightFcfa: t.pricePerNightFcfa,
      isActive: t.isActive,
      displayOrder: t.displayOrder,
    }));

    const extraDtos: ExtraServiceItemDto[] = extraServices.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      unit: s.unit,
      unitLabel: s.unitLabel,
      priceFcfa: s.priceFcfa,
      category: 'AUTRES',
      isActive: s.isActive,
      displayOrder: s.displayOrder,
    }));

    return {
      categories: categoryDtos,
      tariffs: tariffDtos,
      extraServices: extraDtos,
    };
  }

  async listActiveExtraServices(): Promise<ExtraServiceItemDto[]> {
    await this.ensureRealDataLoaded();
    const rows = await this.prisma.extraServiceItem.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return rows.map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      unit: s.unit,
      unitLabel: s.unitLabel,
      priceFcfa: s.priceFcfa,
      category: 'AUTRES',
      isActive: s.isActive,
      displayOrder: s.displayOrder,
    }));
  }

  async getLookupRows(
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<TariffLookupRow[]> {
    const rows = await tx.roomTariff.findMany({
      include: { category: true },
      orderBy: [{ displayOrder: 'asc' }, { guestsCount: 'asc' }],
    });
    return rows.map((t) => ({
      id: t.id,
      categoryCode: t.category.code,
      categoryName: t.category.name,
      guestsCount: t.guestsCount,
      roomsUsed: t.roomsUsed,
      label: t.label,
      pricePerNightFcfa: t.pricePerNightFcfa,
      isActive: t.isActive,
    }));
  }

  async computeReservationPriceForRoom(params: {
    room: {
      category?: string | null;
      tariffCategory?: { code: string; name: string } | null;
      breakfastIncluded?: boolean;
    };
    guestsCount: number;
    roomsUsed?: number | null;
    nights: number;
    breakfastIncluded?: boolean;
    directorOverride?: DirectorPriceOverrideInput | null;
    tx?: Prisma.TransactionClient;
  }) {
    await this.ensureRealDataLoaded();
    const db = params.tx ?? this.prisma;
    const tariffs = await this.getLookupRows(db);
    const categoryCode =
      params.room.tariffCategory?.code ??
      normalizeTariffCategoryCode(params.room.category);
    const categoryName =
      params.room.tariffCategory?.name ??
      params.room.category ??
      UNCLASSIFIED_ROOM_CATEGORY;

    return calculateStayPrice({
      categoryCode,
      categoryName,
      guestsCount: params.guestsCount,
      roomsUsed: params.roomsUsed ?? 1,
      nights: params.nights,
      breakfastIncluded: params.breakfastIncluded ?? params.room.breakfastIncluded ?? true,
      tariffs,
      directorOverride: params.directorOverride ?? null,
    });
  }

  async quoteStay(query: TariffQuoteQueryDto): Promise<ReservationPriceQuoteDto> {
    await this.ensureRealDataLoaded();
    let categoryCode: string | null = normalizeTariffCategoryCode(query.categoryCode);
    let categoryName = categoryCode || UNCLASSIFIED_ROOM_CATEGORY;
    let roomBreakfast = true;

    if (query.roomId) {
      const room = await this.prisma.room.findUnique({
        where: { id: query.roomId },
        include: { tariffCategory: true },
      });
      if (!room) {
        throw new NotFoundException('Chambre introuvable pour le calcul du tarif.');
      }
      categoryCode = room.tariffCategory?.code ?? normalizeTariffCategoryCode(room.category);
      categoryName = room.tariffCategory?.name ?? room.category ?? UNCLASSIFIED_ROOM_CATEGORY;
      roomBreakfast = room.breakfastIncluded;
    }

    const settings = await this.prisma.hotelSetting.findUnique({
      where: { id: 'default' },
      select: {
        tourismTaxPerNightPerPerson: true,
        tourismTaxIncludesChildren: true,
      },
    });
    const taxRate = settings?.tourismTaxPerNightPerPerson ?? 1000;
    const includesChildren = settings?.tourismTaxIncludesChildren ?? false;
    const adults = query.adultsCount ?? query.guestsCount;
    const children = query.childrenCount ?? Math.max(0, query.guestsCount - adults);
    const taxablePersons = includesChildren ? adults + children : adults;
    const tourismTaxFcfa = Math.max(0, taxRate * taxablePersons * query.nights);

    const breakfastIncluded =
      query.breakfastIncluded === 'false'
        ? false
        : query.breakfastIncluded === 'true'
          ? true
          : roomBreakfast;

    const tariffs = await this.getLookupRows();
    const roomsUsed = categoryCode === 'APPARTEMENT' ? (query.roomsUsed ?? 1) : 1;

    try {
      const res = calculateStayPrice({
        categoryCode,
        categoryName,
        guestsCount: query.guestsCount,
        roomsUsed,
        nights: query.nights,
        breakfastIncluded,
        tariffs,
      });

      return {
        available: true,
        categoryCode: res.categoryCode,
        categoryName: res.categoryName,
        guestsCount: res.guestsCount,
        roomsUsed: res.roomsUsed,
        nights: res.nights,
        ratePerNightFcfa: res.ratePerNightFcfa,
        accommodationTotalFcfa: res.accommodationTotalFcfa,
        tourismTaxFcfa,
        totalFcfa: res.accommodationTotalFcfa + tourismTaxFcfa,
        tariffId: res.tariffId,
        tariffLabel: res.tariffLabel,
        summaryLine: res.summaryLine,
        errorMessage: null,
      };
    } catch (err: any) {
      return {
        available: false,
        categoryCode,
        categoryName,
        guestsCount: query.guestsCount,
        roomsUsed,
        nights: query.nights,
        ratePerNightFcfa: null,
        accommodationTotalFcfa: null,
        tourismTaxFcfa,
        totalFcfa: null,
        tariffId: null,
        tariffLabel: null,
        summaryLine: null,
        errorMessage:
          err?.message ||
          'Aucun tarif disponible pour cette configuration. Demandez à la direction.',
      };
    }
  }

  /**
   * Mise à jour en lot des tarifs de la grille (DIRECTION uniquement).
   * Chaque modification est journalisée (ancien prix, nouveau prix, qui, quand)
   * et ne s'applique qu'aux NOUVELLES réservations.
   */
  async updateTariffGrid(
    dto: UpdateTariffGridDto,
    actor: TariffActorContext,
  ): Promise<TariffGridResponseDto> {
    await this.ensureRealDataLoaded();

    await this.prisma.$transaction(async (tx) => {
      for (const item of dto.items) {
        const existing = await tx.roomTariff.findUnique({
          where: { id: item.id },
          include: { category: true },
        });
        if (!existing) {
          throw new NotFoundException(`Ligne tarifaire "${item.id}" introuvable.`);
        }

        const nextPrice =
          item.pricePerNightFcfa === null || item.pricePerNightFcfa === undefined
            ? null
            : Math.round(item.pricePerNightFcfa);
        if (nextPrice !== null && nextPrice <= 0) {
          throw new BadRequestException(
            'Le prix par nuit doit être un entier positif en FCFA ou laissé « À définir ».',
          );
        }

        const nextActive =
          item.isActive !== undefined ? item.isActive : existing.isActive;

        const changed =
          existing.pricePerNightFcfa !== nextPrice || existing.isActive !== nextActive;
        if (!changed) continue;

        await tx.roomTariff.update({
          where: { id: existing.id },
          data: {
            pricePerNightFcfa: nextPrice,
            isActive: nextActive,
          },
        });

        await appendChainedAuditLog(tx, {
          userId: actor.userId || null,
          action: 'TARIFF_UPDATE',
          entity: 'RoomTariff',
          entityId: existing.id,
          ip: actor.ip || null,
          before: {
            category: existing.category.name,
            label: existing.label,
            guestsCount: existing.guestsCount,
            roomsUsed: existing.roomsUsed,
            pricePerNightFcfa: existing.pricePerNightFcfa,
            isActive: existing.isActive,
          },
          after: {
            category: existing.category.name,
            label: existing.label,
            guestsCount: existing.guestsCount,
            roomsUsed: existing.roomsUsed,
            pricePerNightFcfa: nextPrice,
            isActive: nextActive,
            actorName: actor.actorName || null,
            changedAt: new Date().toISOString(),
          },
        });
      }
    });

    return this.getTariffGrid();
  }

  async updateExtraService(
    id: string,
    dto: UpdateExtraServiceDto,
    actor: TariffActorContext,
  ): Promise<ExtraServiceItemDto> {
    await this.ensureRealDataLoaded();
    const existing = await this.prisma.extraServiceItem.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Prestation "${id}" introuvable.`);
    }

    const nextName = dto.name !== undefined ? dto.name.trim() : existing.name;
    const nextUnit = dto.unit !== undefined ? dto.unit : existing.unit;
    const nextUnitLabel =
      dto.unitLabel !== undefined
        ? dto.unitLabel.trim()
        : dto.unit !== undefined
          ? dto.unit === 'DAY'
            ? 'journée'
            : 'personne'
          : existing.unitLabel;
    const nextPrice =
      dto.priceFcfa !== undefined ? Math.round(dto.priceFcfa) : existing.priceFcfa;
    const nextActive = dto.isActive !== undefined ? dto.isActive : existing.isActive;

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.extraServiceItem.update({
        where: { id },
        data: {
          name: nextName,
          unit: nextUnit,
          unitLabel: nextUnitLabel,
          priceFcfa: nextPrice,
          isActive: nextActive,
        },
      });

      await appendChainedAuditLog(tx, {
        userId: actor.userId || null,
        action: 'EXTRA_SERVICE_UPDATE',
        entity: 'ExtraServiceItem',
        entityId: saved.id,
        ip: actor.ip || null,
        before: {
          code: existing.code,
          name: existing.name,
          unitLabel: existing.unitLabel,
          priceFcfa: existing.priceFcfa,
          isActive: existing.isActive,
        },
        after: {
          code: saved.code,
          name: saved.name,
          unitLabel: saved.unitLabel,
          priceFcfa: saved.priceFcfa,
          isActive: saved.isActive,
          actorName: actor.actorName || null,
          changedAt: new Date().toISOString(),
        },
      });

      return saved;
    });

    return {
      id: updated.id,
      code: updated.code,
      name: updated.name,
      unit: updated.unit,
      unitLabel: updated.unitLabel,
      priceFcfa: updated.priceFcfa,
      category: 'AUTRES',
      isActive: updated.isActive,
      displayOrder: updated.displayOrder,
    };
  }

  async createExtraService(
    dto: CreateExtraServiceDto,
    actor: TariffActorContext,
  ): Promise<ExtraServiceItemDto> {
    await this.ensureRealDataLoaded();
    const name = dto.name.trim();
    const baseCode = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
    const code = `${baseCode || 'PRESTATION'}_${Date.now().toString(36).toUpperCase()}`;
    const unitLabel =
      dto.unitLabel?.trim() || (dto.unit === 'DAY' ? 'journée' : 'personne');
    const maxOrder = await this.prisma.extraServiceItem.aggregate({
      _max: { displayOrder: true },
    });

    const created = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.extraServiceItem.create({
        data: {
          code,
          name,
          unit: dto.unit,
          unitLabel,
          priceFcfa: Math.round(dto.priceFcfa),
          category: 'AUTRES',
          displayOrder: (maxOrder._max.displayOrder ?? 0) + 1,
          isActive: true,
        },
      });

      await appendChainedAuditLog(tx, {
        userId: actor.userId || null,
        action: 'EXTRA_SERVICE_CREATE',
        entity: 'ExtraServiceItem',
        entityId: saved.id,
        ip: actor.ip || null,
        after: {
          code: saved.code,
          name: saved.name,
          unitLabel: saved.unitLabel,
          priceFcfa: saved.priceFcfa,
          actorName: actor.actorName || null,
        },
      });

      return saved;
    });

    return {
      id: created.id,
      code: created.code,
      name: created.name,
      unit: created.unit,
      unitLabel: created.unitLabel,
      priceFcfa: created.priceFcfa,
      category: 'AUTRES',
      isActive: created.isActive,
      displayOrder: created.displayOrder,
    };
  }
}
