import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus, PaymentMethod, Prisma, ReservationStatus } from '@prisma/client';
import { Observable, Subject, concat, from, map } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { recalculateInvoiceTotalsInTx } from '../billing/billing-totals.helper';
import {
  CancelRestaurantOrderDto,
  CreateRestaurantOrderDto,
  CreateRestaurantProductDto,
  ModifyRestaurantOrderItemsDto,
  PayRestaurantOrderDto,
  RestaurantOrdersQueryDto,
  UpdateRestaurantOrderDto,
  UpdateRestaurantProductDto,
} from './dto/restaurant.dto';
import {
  deleteProductImageFiles,
  saveProductImageAndThumb,
} from './restaurant-image.util';

export interface RestaurantActorContext {
  idempotencyKey?: string;
  userId?: string;
  actorName?: string;
  actorRole?: string;
  hideAmounts?: boolean;
  kitchenOnly?: boolean;
  ip?: string;
}

export interface RestaurantOrderStreamEvent {
  eventId: number;
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED' | 'HEARTBEAT';
  orderId?: string;
  order?: any;
  timestamp: string;
}

interface BufferedRestaurantOrderEvent {
  eventId: number;
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED';
  orderId?: string;
  rawOrder?: any;
  timestamp: string;
}

const CARD_PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/;
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class RestaurantService {
  private readonly orderEvents$ = new Subject<BufferedRestaurantOrderEvent>();
  private readonly recentEventsBuffer: BufferedRestaurantOrderEvent[] = [];
  private nextEventId = 1;

  constructor(private readonly prisma: PrismaService) {}

  private isKitchenRole(role?: string | null): boolean {
    return role === 'CUISINIER' || role === 'CUISINE';
  }

  getOrderEventStream(): Observable<RestaurantOrderStreamEvent> {
    return this.getRoleFilteredOrderEventStream(undefined);
  }

  getRoleFilteredOrderEventStream(
    role?: string,
    lastEventId?: number,
    explicitHideAmounts?: boolean,
  ): Observable<RestaurantOrderStreamEvent> {
    const isKitchen = Boolean(explicitHideAmounts) || this.isKitchenRole(role);
    const replayEvents =
      typeof lastEventId === 'number' && !Number.isNaN(lastEventId)
        ? this.recentEventsBuffer.filter((evt) => evt.eventId > lastEventId)
        : [];

    const toClientEvent = (evt: BufferedRestaurantOrderEvent): RestaurantOrderStreamEvent => ({
      eventId: evt.eventId,
      type: evt.type,
      orderId: evt.orderId,
      order: evt.rawOrder ? this.formatOrder(evt.rawOrder, isKitchen) : undefined,
      timestamp: evt.timestamp,
    });

    const live$ = this.orderEvents$.asObservable().pipe(map(toClientEvent));
    if (replayEvents.length > 0) {
      return concat(from(replayEvents.map(toClientEvent)), live$);
    }
    return live$;
  }

  private emitOrderEvent(
    type: BufferedRestaurantOrderEvent['type'],
    orderId?: string,
    rawOrder?: any,
  ): void {
    const evt: BufferedRestaurantOrderEvent = {
      eventId: this.nextEventId++,
      type,
      orderId,
      rawOrder,
      timestamp: new Date().toISOString(),
    };
    this.recentEventsBuffer.push(evt);
    if (this.recentEventsBuffer.length > 100) {
      this.recentEventsBuffer.shift();
    }
    this.orderEvents$.next(evt);
  }

  private normalizeOrderStatus(status?: string | null): string {
    if (!status || status === 'SENT_TO_KITCHEN' || status === 'ENVOYEE') return 'PENDING';
    if (status === 'CONFIRMEE') return 'CONFIRMED';
    if (status === 'EN_PREPARATION') return 'IN_PREPARATION';
    if (status === 'PRETE') return 'READY';
    if (status === 'AUTORISEE') return 'AUTHORIZED';
    if (status === 'SERVIE') return 'SERVED';
    if (status === 'ANNULEE') return 'CANCELLED';
    return status;
  }

  private toFrenchStatut(
    normalizedStatus: string,
  ): 'ENVOYEE' | 'CONFIRMEE' | 'EN_PREPARATION' | 'PRETE' | 'AUTORISEE' | 'SERVIE' | 'ANNULEE' {
    switch (normalizedStatus) {
      case 'CONFIRMED':
        return 'CONFIRMEE';
      case 'IN_PREPARATION':
        return 'EN_PREPARATION';
      case 'READY':
        return 'PRETE';
      case 'AUTHORIZED':
        return 'AUTORISEE';
      case 'SERVED':
        return 'SERVIE';
      case 'CANCELLED':
        return 'ANNULEE';
      default:
        return 'ENVOYEE';
    }
  }

  private formatHourMinute(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  private get standardOrderInclude() {
    return {
      lines: true,
      room: true,
      reservation: { include: { guest: { select: { fullName: true } } } },
      events: { orderBy: { createdAt: 'desc' as const } },
    };
  }

  private getServiceStart04hDakar(now = new Date()): Date {
    const dakarStart = new Date(now);
    dakarStart.setUTCHours(4, 0, 0, 0);
    if (now.getUTCHours() < 4) {
      dakarStart.setUTCDate(dakarStart.getUTCDate() - 1);
    }
    return dakarStart;
  }

  private assertNoCardPan(value?: string | null): void {
    if (!value) return;
    const digits = value.replace(/[^\d]/g, '');
    if (digits.length >= 13 && digits.length <= 19 && CARD_PAN_REGEX.test(value)) {
      throw new BadRequestException(
        'Aucun numéro de carte bancaire complet ne doit être saisi ou conservé.',
      );
    }
  }

  private formatProduct(p: any) {
    return {
      id: p.id,
      name: p.name,
      description: p.description || '',
      categoryId: p.categoryId,
      categoryName: p.category?.name || 'Plats sénégalais & Mer',
      priceFcfa: p.priceFcfa,
      halfPortionPriceFcfa: p.halfPortionPriceFcfa ?? undefined,
      tags: p.tags || [],
      allergens: p.allergens || [],
      prepTimeMinutes: p.prepTimeMinutes || 15,
      prepStation: p.prepStation || 'CUISINE',
      availability: p.availability || { type: 'ALWAYS' },
      options: Array.isArray(p.options) ? p.options : [],
      vatRatePercent: p.vatRatePercent || 10,
      displayOrder: p.displayOrder || 1,
      photoUrl: p.photoUrl || undefined,
      thumbnailUrl: p.thumbnailUrl || p.photoUrl || undefined,
      status: p.status || 'AVAILABLE',
      orderLinesCount: p._count?.orderLines ?? 0,
    };
  }

  private resolveDestinationLabel(o: any, fullRoomLabel = false): string {
    if (o.destinationType === 'ROOM') {
      const num = o.room?.number || o.tableLabel?.replace(/^(Ch\.|Chambre)\s*/i, '') || '';
      if (!num) return 'Chambre';
      return fullRoomLabel ? `Chambre ${num}` : `Ch. ${num}`;
    }
    if (o.destinationType === 'TAKEAWAY') {
      return 'À emporter';
    }
    return o.tableLabel || 'Table 1';
  }

  private formatOrder(o: any, hideAmounts = false) {
    const destType =
      o.destinationType === 'ROOM'
        ? 'ROOM'
        : o.destinationType === 'TAKEAWAY'
          ? 'TAKEAWAY'
          : 'TABLE';
    const destValue =
      destType === 'ROOM'
        ? o.room?.number || ''
        : destType === 'TAKEAWAY'
          ? 'À emporter'
          : o.tableLabel || 'T1';
    const guestName =
      o.guestName ||
      o.reservation?.guest?.fullName ||
      (destType === 'ROOM' ? 'Client séjour' : 'Client de passage');

    const normalizedStatus = this.normalizeOrderStatus(o.status);
    const frenchStatut = this.toFrenchStatut(normalizedStatus);
    const createdAtDate = new Date(o.createdAt);
    const envoyeeAtDate = o.envoyeeAt ? new Date(o.envoyeeAt) : createdAtDate;
    const priseEnChargeAtDate = o.priseEnChargeAt
      ? new Date(o.priseEnChargeAt)
      : o.preparingAt
        ? new Date(o.preparingAt)
        : null;
    const preteAtDate = o.preteAt
      ? new Date(o.preteAt)
      : o.readyAt
        ? new Date(o.readyAt)
        : null;
    const autoriseAtDate = o.autoriseAt ? new Date(o.autoriseAt) : null;
    const serviAtDate = o.serviAt
      ? new Date(o.serviAt)
      : o.servedAt
        ? new Date(o.servedAt)
        : null;
    const annuleAtDate = o.annuleAt
      ? new Date(o.annuleAt)
      : o.cancelledAt
        ? new Date(o.cancelledAt)
        : null;
    const heureFinPrevueDate = o.heureFinPrevue
      ? new Date(o.heureFinPrevue)
      : priseEnChargeAtDate && o.tempsPreparationMinutes
        ? new Date(priseEnChargeAtDate.getTime() + o.tempsPreparationMinutes * 60 * 1000)
        : null;
    const isStaleOver12h =
      (normalizedStatus === 'PENDING' ||
        normalizedStatus === 'CONFIRMED' ||
        normalizedStatus === 'IN_PREPARATION') &&
      Date.now() - createdAtDate.getTime() > TWELVE_HOURS_MS;
    const hasUnavailableItems = (o.lines || []).some((l: any) => Boolean(l.isUnavailable));
    const readyLines = (o.lines || []).filter((l: any) => !l.isUnavailable);
    const linesForReadyMsg = readyLines.length > 0 ? readyLines : o.lines || [];
    const totalReadyQty = linesForReadyMsg.reduce((sum: number, l: any) => sum + (l.quantity || 1), 0);
    const readyDishesStr = linesForReadyMsg.map((l: any) => `${l.quantity} ${l.name}`).join(', ');
    const readyVerb = totalReadyQty > 1 ? 'prêts à servir' : 'prêt à servir';
    const fullDest = this.resolveDestinationLabel(o, true);
    const assistantReadyDetail = `Prête : ${readyDishesStr} ${readyVerb} à ${guestName}, ${fullDest}`;

    return {
      id: o.id,
      ticketNumber: o.ticketNumber,
      serverName: o.serverName,
      time: createdAtDate.toISOString(),
      createdAt: createdAtDate.toISOString(),
      updatedAt: new Date(o.updatedAt).toISOString(),
      destinationType: destType,
      destinationValue: destValue,
      destinationLabel: this.resolveDestinationLabel(o, hideAmounts),
      tableLabel: o.tableLabel || null,
      roomId: o.roomId || null,
      roomNumber: o.room?.number || null,
      status: normalizedStatus,
      statut: frenchStatut,
      envoyeeAt: envoyeeAtDate.toISOString(),
      envoyeeById: o.envoyeeById || null,
      preparingAt: priseEnChargeAtDate ? priseEnChargeAtDate.toISOString() : null,
      priseEnChargeAt: priseEnChargeAtDate ? priseEnChargeAtDate.toISOString() : null,
      priseEnChargeById: o.priseEnChargeById || null,
      priseEnChargeByName: o.priseEnChargeByName || null,
      tempsPreparationMinutes: o.tempsPreparationMinutes ?? null,
      heureFinPrevue: heureFinPrevueDate ? heureFinPrevueDate.toISOString() : null,
      readyAt: preteAtDate ? preteAtDate.toISOString() : null,
      preteAt: preteAtDate ? preteAtDate.toISOString() : null,
      preteById: o.preteById || null,
      autoriseAt: autoriseAtDate ? autoriseAtDate.toISOString() : null,
      autoriseById: o.autoriseById || null,
      autoriseByName: o.autoriseByName || null,
      servedAt: serviAtDate ? serviAtDate.toISOString() : null,
      serviAt: serviAtDate ? serviAtDate.toISOString() : null,
      serviById: o.serviById || null,
      cancelledAt: annuleAtDate ? annuleAtDate.toISOString() : null,
      annuleAt: annuleAtDate ? annuleAtDate.toISOString() : null,
      annuleById: o.annuleById || o.cancelledById || null,
      cancellationReason: o.cancellationReason || o.motifAnnulation || null,
      motifAnnulation: o.motifAnnulation || o.cancellationReason || null,
      cancelledByName: o.cancelledByName || null,
      isStaleOver12h,
      hasUnavailableItems,
      ...(hideAmounts
        ? {}
        : {
            reservationId: o.reservationId || null,
            invoiceId: o.invoiceId || null,
            guestName,
            paymentMethod: o.paymentMethod || null,
            subtotalHtFcfa: o.subtotalHtFcfa,
            vatRatePercent: 10,
            vatAmountFcfa: o.vatAmountFcfa,
            totalTtcFcfa: o.totalTtcFcfa,
          }),
      items: (o.lines || []).map((l: any) => ({
        id: l.id,
        dishId: l.productId || '',
        productId: l.productId || null,
        name: l.name,
        quantity: l.quantity,
        isUnavailable: Boolean(l.isUnavailable),
        unavailableReason: l.unavailableReason || null,
        ...(hideAmounts
          ? {}
          : {
              unitPriceFcfa: l.unitPriceFcfa,
              totalPriceFcfa: l.totalPriceFcfa,
            }),
        selectedOptions: l.selectedOptions || [],
        notes: l.notes || undefined,
        prepStation: l.prepStation || 'CUISINE',
      })),
      events: (o.events || []).map((ev: any) => ({
        id: ev.id,
        orderId: ev.orderId,
        type: ev.type,
        detail: !hideAmounts && ev.type === 'PRETE' ? assistantReadyDetail : ev.detail,
        userId: ev.userId || null,
        userName: ev.userName || null,
        addedMinutes: ev.addedMinutes ?? null,
        unavailableItems: ev.unavailableItems || [],
        reason: ev.reason || null,
        createdAt: new Date(ev.createdAt).toISOString(),
      })),
    };
  }

  redactFormattedOrder(rawOrder: any) {
    if (!rawOrder || typeof rawOrder !== 'object') return rawOrder;
    const redacted: Record<string, any> = { ...rawOrder };
    for (const key of [
      'reservationId',
      'invoiceId',
      'guestName',
      'guestPhone',
      'paymentMethod',
      'subtotalHtFcfa',
      'vatRatePercent',
      'vatAmountFcfa',
      'totalTtcFcfa',
    ]) {
      delete redacted[key];
    }
    redacted['items'] = Array.isArray(rawOrder.items)
      ? rawOrder.items.map((it: any) => {
          const cleanItem = { ...it };
          delete cleanItem.unitPriceFcfa;
          delete cleanItem.totalPriceFcfa;
          return cleanItem;
        })
      : [];
    return redacted;
  }

  async findAllCategories() {
    const cats = await this.prisma.restaurantCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return cats.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      displayOrder: c.displayOrder,
      isArchived: c.isArchived,
      itemCount: c._count.products,
    }));
  }

  async findAllProducts(includeOrderCounts = true, hideAmounts = false) {
    const products = await this.prisma.restaurantProduct.findMany({
      include: {
        category: true,
        ...(includeOrderCounts ? { _count: { select: { orderLines: true } } } : {}),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((p) => {
      const formatted = this.formatProduct(p);
      if (hideAmounts) {
        const withoutPrice = { ...(formatted as any) };
        delete withoutPrice.priceFcfa;
        return withoutPrice;
      }
      return formatted;
    });
  }

  async findRoomsInStay() {
    const stays = await this.prisma.reservation.findMany({
      where: { status: ReservationStatus.CHECKED_IN },
      include: {
        room: true,
        guest: { select: { fullName: true } },
      },
      orderBy: { room: { number: 'asc' } },
    });

    return stays.map((s) => ({
      roomId: s.roomId,
      roomNumber: s.room.number,
      roomCategory: s.room.category,
      reservationId: s.id,
      guestName: s.guest.fullName,
      checkInDate: s.checkInDate.toISOString(),
      checkOutDate: s.checkOutDate.toISOString(),
    }));
  }

  async getCatalog(
    actorRole?: string,
    options?: { hideAmounts?: boolean; kitchenOnly?: boolean },
  ) {
    const hideRooms = Boolean(options?.kitchenOnly) || this.isKitchenRole(actorRole);
    const hidePrices = Boolean(options?.hideAmounts) || hideRooms;
    const [categories, products, roomsInStay] = await Promise.all([
      this.findAllCategories(),
      this.findAllProducts(false, hidePrices),
      hideRooms ? Promise.resolve([]) : this.findRoomsInStay(),
    ]);
    return { categories, products, roomsInStay };
  }

  private async resolveOrCreateCategory(
    tx: Prisma.TransactionClient,
    categoryId?: string,
    categoryName?: string,
  ) {
    if (categoryId && /^[0-9a-f-]{36}$/i.test(categoryId)) {
      const existingById = await tx.restaurantCategory.findUnique({ where: { id: categoryId } });
      if (existingById) return existingById;
    }

    const cleanCatName = categoryName?.trim() || 'Plats sénégalais & Mer';
    const existingByName = await tx.restaurantCategory.findUnique({ where: { name: cleanCatName } });
    if (existingByName) return existingByName;

    const count = await tx.restaurantCategory.count();
    return tx.restaurantCategory.create({
      data: {
        name: cleanCatName,
        icon: 'dinner_dining',
        displayOrder: count + 1,
      },
    });
  }

  async createProduct(dto: CreateRestaurantProductDto, actor?: RestaurantActorContext) {
    const cleanName = dto.name.trim();
    const dup = await this.prisma.restaurantProduct.findUnique({ where: { name: cleanName } });
    if (dup) {
      throw new ConflictException(`Un produit nommé « ${cleanName} » existe déjà.`);
    }

    if (dto.photoUrl && dto.photoUrl.startsWith('data:image')) {
      throw new BadRequestException(
        'Les images encodées en base64 (data:image) ne sont pas autorisées en base.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const category = await this.resolveOrCreateCategory(tx, dto.categoryId, dto.categoryName);
      const p = await tx.restaurantProduct.create({
        data: {
          name: cleanName,
          description: dto.description?.trim() || '',
          categoryId: category.id,
          priceFcfa: Math.round(dto.priceFcfa),
          halfPortionPriceFcfa: dto.halfPortionPriceFcfa ? Math.round(dto.halfPortionPriceFcfa) : null,
          tags: dto.tags || [],
          allergens: dto.allergens || [],
          prepTimeMinutes: dto.prepTimeMinutes ?? 15,
          prepStation: dto.prepStation || 'CUISINE',
          availability: { type: 'ALWAYS' },
          options: [],
          vatRatePercent: 10,
          photoUrl: dto.photoUrl || null,
          status: dto.status || 'AVAILABLE',
        },
        include: { category: true, _count: { select: { orderLines: true } } },
      });

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'PRODUCT_CREATE',
        entity: 'RestaurantProduct',
        entityId: p.id,
        ip: actor?.ip || null,
        after: {
          id: p.id,
          name: p.name,
          category: category.name,
          priceFcfa: p.priceFcfa,
          status: p.status,
        },
      });

      return p;
    });

    return this.formatProduct(created);
  }

  async updateProduct(id: string, dto: UpdateRestaurantProductDto, actor?: RestaurantActorContext) {
    const existing = await this.prisma.restaurantProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Produit "${id}" introuvable.`);
    }

    if (dto.photoUrl && dto.photoUrl.startsWith('data:image')) {
      throw new BadRequestException(
        'Les images encodées en base64 (data:image) ne sont pas autorisées en base.',
      );
    }

    if (dto.name && dto.name.trim() !== existing.name) {
      const dup = await this.prisma.restaurantProduct.findUnique({ where: { name: dto.name.trim() } });
      if (dup && dup.id !== id) {
        throw new ConflictException(`Un produit nommé « ${dto.name.trim()} » existe déjà.`);
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      let nextCategoryId: string | undefined;
      if (dto.categoryName?.trim() || (dto.categoryId && /^[0-9a-f-]{36}$/i.test(dto.categoryId))) {
        const cat = await this.resolveOrCreateCategory(tx, dto.categoryId, dto.categoryName);
        nextCategoryId = cat.id;
      }

      const nextPrice = dto.priceFcfa !== undefined ? Math.round(dto.priceFcfa) : existing.priceFcfa;
      const nextStatus = dto.status !== undefined ? dto.status : existing.status;

      const p = await tx.restaurantProduct.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(nextCategoryId ? { categoryId: nextCategoryId } : {}),
          ...(dto.priceFcfa !== undefined ? { priceFcfa: nextPrice } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.allergens !== undefined ? { allergens: dto.allergens } : {}),
          ...(dto.prepTimeMinutes !== undefined ? { prepTimeMinutes: dto.prepTimeMinutes } : {}),
          ...(dto.prepStation !== undefined ? { prepStation: dto.prepStation } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl || null } : {}),
          ...(dto.status !== undefined ? { status: nextStatus } : {}),
        },
        include: { category: true, _count: { select: { orderLines: true } } },
      });

      const action =
        nextStatus !== existing.status && nextStatus === 'ARCHIVED'
          ? 'PRODUCT_DEACTIVATE'
          : nextPrice !== existing.priceFcfa
            ? 'PRODUCT_PRICE_CHANGE'
            : 'PRODUCT_UPDATE';

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action,
        entity: 'RestaurantProduct',
        entityId: p.id,
        ip: actor?.ip || null,
        before: { name: existing.name, priceFcfa: existing.priceFcfa, status: existing.status },
        after: { name: p.name, priceFcfa: p.priceFcfa, status: p.status },
      });

      return p;
    });

    return this.formatProduct(updated);
  }

  async uploadProductImage(id: string, buffer: Buffer, actor?: RestaurantActorContext) {
    const existing = await this.prisma.restaurantProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Produit "${id}" introuvable.`);
    }

    const saved = await saveProductImageAndThumb(buffer);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const p = await tx.restaurantProduct.update({
          where: { id },
          data: {
            photoUrl: saved.photoUrl,
            thumbnailUrl: saved.thumbnailUrl,
          },
          include: { category: true, _count: { select: { orderLines: true } } },
        });

        await appendChainedAuditLog(tx, {
          userId: actor?.userId || null,
          action: 'PRODUCT_IMAGE_UPDATE',
          entity: 'RestaurantProduct',
          entityId: p.id,
          ip: actor?.ip || null,
          after: { photoUrl: saved.photoUrl, thumbnailUrl: saved.thumbnailUrl },
        });

        return p;
      });

      // Supprimer l'ancienne photo et sa miniature après succès en base
      deleteProductImageFiles(existing.photoUrl, existing.thumbnailUrl);
      return this.formatProduct(updated);
    } catch (err) {
      deleteProductImageFiles(saved.photoUrl, saved.thumbnailUrl);
      throw err;
    }
  }

  async removeProductImage(id: string, actor?: RestaurantActorContext) {
    const existing = await this.prisma.restaurantProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Produit "${id}" introuvable.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.restaurantProduct.update({
        where: { id },
        data: { photoUrl: null, thumbnailUrl: null },
        include: { category: true, _count: { select: { orderLines: true } } },
      });
      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'PRODUCT_IMAGE_DELETE',
        entity: 'RestaurantProduct',
        entityId: p.id,
        ip: actor?.ip || null,
      });
      return p;
    });

    deleteProductImageFiles(existing.photoUrl, existing.thumbnailUrl);
    return this.formatProduct(updated);
  }

  /**
   * Supprime un produit sans historique ; refuse en 409 s'il figure dans des commandes passées.
   */
  async deleteOrArchiveProduct(id: string, actor?: RestaurantActorContext) {
    const existing = await this.prisma.restaurantProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Produit "${id}" introuvable.`);
    }

    const lineCount = await this.prisma.restaurantOrderLine.count({ where: { productId: id } });
    if (lineCount > 0) {
      throw new ConflictException(
        'Ce produit possède un historique de commandes et ne peut pas être supprimé. Utilisez « Désactiver » pour le retirer de la carte.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'PRODUCT_DELETE',
        entity: 'RestaurantProduct',
        entityId: existing.id,
        ip: actor?.ip || null,
        before: { id: existing.id, name: existing.name, priceFcfa: existing.priceFcfa },
      });
      await tx.restaurantProduct.delete({ where: { id } });
    });

    deleteProductImageFiles(existing.photoUrl, existing.thumbnailUrl);
    return { deleted: true, id };
  }

  async findAllOrders(actorRole?: string, explicitHideAmounts?: boolean) {
    const hideAmounts = Boolean(explicitHideAmounts) || this.isKitchenRole(actorRole);
    const now = new Date();
    const serviceStart = this.getServiceStart04hDakar(now);
    const twelveHoursAgo = new Date(now.getTime() - TWELVE_HOURS_MS);

    const where: Prisma.RestaurantOrderWhereInput = hideAmounts
      ? {
          OR: [
            { createdAt: { gte: serviceStart } },
            {
              createdAt: { gte: twelveHoursAgo },
              status: { in: ['PENDING', 'SENT_TO_KITCHEN', 'CONFIRMED', 'CONFIRMEE', 'IN_PREPARATION', 'EN_PREPARATION'] },
            },
          ],
        }
      : {};

    const orders = await this.prisma.restaurantOrder.findMany({
      where,
      include: this.standardOrderInclude,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const filtered = hideAmounts
      ? orders.filter((o) => {
          const normalized = this.normalizeOrderStatus(o.status);
          const isUnfinished =
            normalized === 'PENDING' || normalized === 'CONFIRMED' || normalized === 'IN_PREPARATION';
          const ageMs = now.getTime() - new Date(o.createdAt).getTime();
          if (isUnfinished && ageMs > TWELVE_HOURS_MS) {
            return false;
          }
          return true;
        })
      : orders;

    return filtered.map((o) => this.formatOrder(o, hideAmounts));
  }

  async findStaleOrders() {
    const twelveHoursAgo = new Date(Date.now() - TWELVE_HOURS_MS);
    const stale = await this.prisma.restaurantOrder.findMany({
      where: {
        createdAt: { lt: twelveHoursAgo },
        status: { in: ['PENDING', 'SENT_TO_KITCHEN', 'CONFIRMED', 'CONFIRMEE', 'IN_PREPARATION', 'EN_PREPARATION'] },
      },
      include: this.standardOrderInclude,
      orderBy: { createdAt: 'asc' },
    });
    return stale.map((o) => this.formatOrder(o, false));
  }

  async closeStaleOrder(
    id: string,
    dto: CancelRestaurantOrderDto,
    actor?: RestaurantActorContext,
  ) {
    if (actor?.actorRole && actor.actorRole !== 'DIRECTION' && actor.actorRole !== 'RECEPTION') {
      throw new ForbiddenException(
        'La clôture des anciennes commandes est réservée aux rôles DIRECTION et RECEPTION.',
      );
    }
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException("Un motif de clôture d'au moins 3 caractères est obligatoire.");
    }
    const existing = await this.prisma.restaurantOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);

    const normalized = this.normalizeOrderStatus(existing.status);
    if (normalized !== 'PENDING' && normalized !== 'IN_PREPARATION') {
      throw new ConflictException('Seules les commandes non terminées peuvent être clôturées.');
    }

    const now = new Date();
    const closed = await this.prisma.$transaction(async (tx) => {
      if (existing.invoiceId) {
        const linkedInv = await tx.invoice.findUnique({ where: { id: existing.invoiceId } });
        if (linkedInv && !linkedInv.isIssued) {
          await tx.invoiceLine.deleteMany({
            where: { invoiceId: linkedInv.id, sourceOrderId: existing.id },
          });
          await recalculateInvoiceTotalsInTx(tx, linkedInv.id);
        }
      }

      const saved = await tx.restaurantOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          statut: 'ANNULEE',
          cancellationReason: reason,
          motifAnnulation: reason,
          cancelledAt: now,
          annuleAt: now,
          cancelledById: actor?.userId || null,
          annuleById: actor?.userId || null,
          cancelledByName: actor?.actorName || actor?.actorRole || 'Direction',
        },
        include: {
          lines: true,
          room: true,
          reservation: { include: { guest: { select: { fullName: true } } } },
        },
      });

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'ORDER_CLOSE_STALE',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: actor?.ip || null,
        before: { status: normalized, statut: this.toFrenchStatut(normalized) },
        after: {
          status: 'CANCELLED',
          statut: 'ANNULEE',
          reason,
          annuleById: actor?.userId || null,
          annuleAt: now.toISOString(),
          ticketNumber: saved.ticketNumber,
        },
      });

      return saved;
    });

    this.emitOrderEvent('ORDER_CANCELLED', id, closed);
    return this.formatOrder(closed, false);
  }

  async findOrdersPage(
    query: RestaurantOrdersQueryDto,
    actorRole?: string,
    explicitHideAmounts?: boolean,
  ) {
    const offset = Math.max(0, Math.round(query.offset || 0));
    const limit = Math.min(50, Math.max(1, Math.round(query.limit || 50)));
    const hideAmounts = Boolean(explicitHideAmounts) || this.isKitchenRole(actorRole);

    const where: Prisma.RestaurantOrderWhereInput = {};
    if (query.destinationType) {
      where.destinationType = query.destinationType;
    }
    if (query.status) {
      const normalized = this.normalizeOrderStatus(query.status);
      where.status =
        normalized === 'PENDING' ? { in: ['PENDING', 'SENT_TO_KITCHEN'] } : normalized;
    }
    const q = query.search?.trim();
    if (q) {
      where.OR = [
        { ticketNumber: { contains: q, mode: 'insensitive' } },
        ...(hideAmounts ? [] : [{ guestName: { contains: q, mode: 'insensitive' as const } }]),
        { tableLabel: { contains: q, mode: 'insensitive' } },
        { room: { number: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.restaurantOrder.count({ where }),
      this.prisma.restaurantOrder.findMany({
        where,
        include: this.standardOrderInclude,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
    ]);

    return {
      items: items.map((o) => this.formatOrder(o, hideAmounts)),
      total,
      offset,
      limit,
      hasMore: offset + items.length < total,
    };
  }

  async createOrder(dto: CreateRestaurantOrderDto, ctx?: RestaurantActorContext) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La commande doit comporter au moins un article.');
    }

    this.assertNoCardPan(dto.paymentRef);

    const hideAmounts = Boolean(ctx?.hideAmounts) || this.isKitchenRole(ctx?.actorRole);
    const idempotencyKey = ctx?.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existingByKey = await this.prisma.restaurantOrder.findUnique({
        where: { idempotencyKey },
        include: this.standardOrderInclude,
      });
      if (existingByKey) {
        return this.formatOrder(existingByKey, hideAmounts);
      }
      const existingSync = await this.prisma.syncOperation.findUnique({
        where: { idempotencyKey },
      });
      if (existingSync) {
        if (!hideAmounts) return existingSync.result;
        const storedId = (existingSync.result as any)?.id;
        if (storedId) {
          const ord = await this.prisma.restaurantOrder.findUnique({
            where: { id: storedId },
            include: this.standardOrderInclude,
          });
          if (ord) return this.formatOrder(ord, true);
        }
        return this.redactFormattedOrder(existingSync.result);
      }
    }

    const destinationType: 'ROOM' | 'TABLE' | 'TAKEAWAY' =
      dto.destinationType || (dto.roomId || dto.roomNumber || dto.reservationId ? 'ROOM' : 'TABLE');

    // Vérification serveur des produits et capture des noms + prix en base au moment T
    const productIds = Array.from(
      new Set(
        dto.items
          .map((it) => it.productId || it.dishId)
          .filter((id): id is string => Boolean(id && /^[0-9a-f-]{36}$/i.test(id))),
      ),
    );
    const dbProducts =
      productIds.length > 0
        ? await this.prisma.restaurantProduct.findMany({ where: { id: { in: productIds } } })
        : [];
    const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

    const resolvedLines = dto.items.map((it) => {
      const pid =
        (it.productId || it.dishId) && /^[0-9a-f-]{36}$/i.test((it.productId || it.dishId)!)
          ? (it.productId || it.dishId)!
          : null;
      const qty = Math.max(1, Math.round(it.quantity));
      if (pid) {
        const dbProd = prodMap.get(pid);
        if (!dbProd) {
          throw new NotFoundException(`Produit "${pid}" introuvable.`);
        }
        if (dbProd.status === 'SOLD_OUT' || dbProd.status === 'ARCHIVED') {
          throw new BadRequestException(`Le produit « ${dbProd.name} » est actuellement indisponible.`);
        }
        const unit = dbProd.priceFcfa;
        return {
          productId: dbProd.id,
          name: dbProd.name,
          quantity: qty,
          unitPriceFcfa: unit,
          totalPriceFcfa: unit * qty,
          selectedOptions: it.selectedOptions || [],
          notes: it.notes?.trim() || null,
          prepStation: dbProd.prepStation || 'CUISINE',
        };
      }
      const cleanName = it.name?.trim();
      if (!cleanName) {
        throw new BadRequestException('Chaque ligne doit préciser un produit ou un libellé.');
      }
      const unit = Math.max(0, Math.round(it.unitPriceFcfa ?? 0));
      return {
        productId: null,
        name: cleanName,
        quantity: qty,
        unitPriceFcfa: unit,
        totalPriceFcfa: unit * qty,
        selectedOptions: it.selectedOptions || [],
        notes: it.notes?.trim() || null,
        prepStation: it.prepStation || 'CUISINE',
      };
    });

    const totalTtcFcfa = resolvedLines.reduce((sum, l) => sum + l.totalPriceFcfa, 0);
    const subtotalHtFcfa = Math.round(totalTtcFcfa / 1.1);
    const vatAmountFcfa = totalTtcFcfa - subtotalHtFcfa;
    const ticketNumber =
      dto.ticketNumber?.trim() ||
      `#CMD-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}-${Date.now().toString().slice(-3)}`;

    let resolvedRoomId: string | null = null;
    let resolvedRoomNumber: string | null = null;
    let resolvedReservationId: string | null = null;
    let resolvedGuestId: string | null = null;
    let resolvedGuestName = 'Client de passage';
    let resolvedTableLabel =
      destinationType === 'TAKEAWAY' ? 'À emporter' : dto.tableLabel?.trim() || 'Table 1';

    if (destinationType === 'ROOM') {
      if (dto.roomId && /^[0-9a-f-]{36}$/i.test(dto.roomId)) {
        const room = await this.prisma.room.findUnique({ where: { id: dto.roomId } });
        if (room) {
          resolvedRoomId = room.id;
          resolvedRoomNumber = room.number;
        }
      } else if (dto.roomNumber?.trim()) {
        const room = await this.prisma.room.findUnique({ where: { number: dto.roomNumber.trim() } });
        if (room) {
          resolvedRoomId = room.id;
          resolvedRoomNumber = room.number;
        }
      }

      const hasResId = Boolean(dto.reservationId && /^[0-9a-f-]{36}$/i.test(dto.reservationId));
      if (!hasResId && !resolvedRoomId) {
        throw new BadRequestException(
          'Séjour en cours introuvable (check-in requis) : impossible de facturer sur cette chambre.',
        );
      }

      const activeStay = await this.prisma.reservation.findFirst({
        where: {
          status: ReservationStatus.CHECKED_IN,
          ...(hasResId ? { id: dto.reservationId } : { roomId: resolvedRoomId! }),
        },
        include: { room: true, guest: { select: { id: true, fullName: true } } },
        orderBy: { checkInDate: 'desc' },
      });

      if (!activeStay) {
        throw new BadRequestException(
          'Séjour en cours introuvable (check-in requis) : impossible de facturer sur cette chambre.',
        );
      }

      resolvedRoomId = activeStay.roomId;
      resolvedRoomNumber = activeStay.room.number;
      resolvedReservationId = activeStay.id;
      resolvedGuestId = activeStay.guestId;
      resolvedGuestName = activeStay.guest.fullName;
      resolvedTableLabel = `Ch. ${resolvedRoomNumber}`;
    }

    const action =
      dto.action ||
      (destinationType === 'ROOM' && dto.paymentMethod === 'ROOM_CHARGE'
        ? 'ROOM_CHARGE'
        : destinationType !== 'ROOM' &&
            dto.paymentMethod &&
            ['CASH', 'ORANGE_MONEY', 'WAVE', 'CARD', 'BANK_TRANSFER'].includes(dto.paymentMethod)
          ? 'PAY'
          : 'SEND_TO_KITCHEN');

    if (action === 'ROOM_CHARGE' && destinationType !== 'ROOM') {
      throw new BadRequestException('L’imputation chambre exige une destination Chambre.');
    }
    if (action === 'PAY' && destinationType === 'ROOM') {
      throw new BadRequestException('Pour une chambre, utilisez « Mettre sur la chambre ».');
    }
    if (
      action === 'PAY' &&
      (!dto.paymentMethod ||
        !['CASH', 'ORANGE_MONEY', 'WAVE', 'CARD', 'BANK_TRANSFER'].includes(dto.paymentMethod))
    ) {
      throw new BadRequestException('Mode de paiement invalide ou manquant pour l’encaissement.');
    }

    try {
      const now = new Date();
      const { formatted, full } = await this.prisma.$transaction(
        async (tx) => {
          let linkedInvoiceId: string | null = null;
          const order = await tx.restaurantOrder.create({
            data: {
              ticketNumber,
              idempotencyKey: idempotencyKey || null,
              destinationType,
              tableLabel: resolvedTableLabel,
              roomId: resolvedRoomId,
              reservationId: resolvedReservationId,
              guestName: resolvedGuestName,
              serverName: dto.serverName?.trim() || ctx?.actorName || 'Service',
              status: 'PENDING',
              statut: 'ENVOYEE',
              envoyeeAt: now,
              envoyeeById: ctx?.userId || null,
              subtotalHtFcfa,
              vatAmountFcfa,
              totalTtcFcfa,
              paymentMethod:
                action === 'ROOM_CHARGE'
                  ? 'ROOM_CHARGE'
                  : action === 'PAY'
                    ? dto.paymentMethod || null
                    : null,
              lines: { create: resolvedLines },
              events: {
                create: {
                  type: 'ENVOYEE',
                  detail: 'Envoyée à la cuisine',
                  userId: ctx?.userId || null,
                  userName: ctx?.actorName || dto.serverName || 'Service',
                  createdAt: now,
                },
              },
            },
            include: this.standardOrderInclude,
          });

          if (action === 'ROOM_CHARGE' && resolvedReservationId && resolvedRoomId) {
            let openNote = await tx.invoice.findFirst({
              where: {
                isIssued: false,
                documentType: InvoiceDocumentType.INVOICE,
                status: { not: InvoiceStatus.CANCELLED },
                reservationId: resolvedReservationId,
              },
              orderBy: { createdAt: 'desc' },
            });

            if (!openNote) {
              const settings = await tx.hotelSetting.findUnique({ where: { id: 'default' } });
              openNote = await tx.invoice.create({
                data: {
                  invoiceNumber: null,
                  isIssued: false,
                  documentType: InvoiceDocumentType.INVOICE,
                  reservationId: resolvedReservationId,
                  guestId: resolvedGuestId,
                  roomId: resolvedRoomId,
                  vatRatePercent: settings?.vatRatePercent ?? 0,
                  serviceRatePercent: settings?.serviceRatePercent ?? 0,
                  status: InvoiceStatus.OPEN,
                },
              });
            }

            const alreadyLinked = await tx.invoiceLine.count({
              where: { invoiceId: openNote.id, sourceOrderId: order.id },
            });
            if (alreadyLinked === 0) {
              const dateLabel = new Date(order.createdAt).toLocaleDateString('fr-FR');
              for (const l of order.lines) {
                await tx.invoiceLine.create({
                  data: {
                    invoiceId: openNote.id,
                    dateLabel,
                    description: `${l.name} (${order.ticketNumber})`,
                    subDescription: `Restaurant • ${order.serverName}`,
                    category: 'RESTAURANT',
                    quantity: l.quantity,
                    quantityLabel: `${l.quantity}`,
                    unitPriceFcfa: l.unitPriceFcfa,
                    totalPriceFcfa: l.totalPriceFcfa,
                    isSystem: true,
                    sourceOrderId: order.id,
                  },
                });
              }
              await recalculateInvoiceTotalsInTx(tx, openNote.id);
            }

            linkedInvoiceId = openNote.id;
            await tx.restaurantOrder.update({
              where: { id: order.id },
              data: { invoiceId: openNote.id },
            });
          } else if (action === 'PAY' && dto.paymentMethod) {
            const settings = await tx.hotelSetting.findUnique({ where: { id: 'default' } });
            const dateLabel = new Date(order.createdAt).toLocaleDateString('fr-FR');
            const walkInNote = await tx.invoice.create({
              data: {
                invoiceNumber: null,
                isIssued: false,
                documentType: InvoiceDocumentType.INVOICE,
                billingCompanyName: 'Client de passage',
                vatRatePercent: settings?.vatRatePercent ?? 0,
                serviceRatePercent: settings?.serviceRatePercent ?? 0,
                status: InvoiceStatus.OPEN,
                lines: {
                  create: order.lines.map((l) => ({
                    dateLabel,
                    description: `${l.name} (${order.ticketNumber})`,
                    subDescription: `${resolvedTableLabel} • ${order.serverName}`,
                    category: 'RESTAURANT',
                    quantity: l.quantity,
                    quantityLabel: `${l.quantity}`,
                    unitPriceFcfa: l.unitPriceFcfa,
                    totalPriceFcfa: l.totalPriceFcfa,
                    isSystem: true,
                    sourceOrderId: order.id,
                  })),
                },
              },
            });

            await tx.payment.create({
              data: {
                invoiceId: walkInNote.id,
                method: dto.paymentMethod as PaymentMethod,
                amountFcfa: totalTtcFcfa,
                transactionRef: dto.paymentRef?.trim() || null,
                receivedById: ctx?.userId || null,
                receivedByName: ctx?.actorName || order.serverName,
                idempotencyKey: idempotencyKey ? `pay-${idempotencyKey}` : null,
              },
            });

            await recalculateInvoiceTotalsInTx(tx, walkInNote.id);
            linkedInvoiceId = walkInNote.id;
            await tx.restaurantOrder.update({
              where: { id: order.id },
              data: { invoiceId: walkInNote.id },
            });
          }

          await appendChainedAuditLog(tx, {
            userId: ctx?.userId || null,
            action: 'ORDER_CREATE',
            entity: 'RestaurantOrder',
            entityId: order.id,
            ip: ctx?.ip || null,
            after: {
              id: order.id,
              ticketNumber: order.ticketNumber,
              destinationType,
              roomNumber: resolvedRoomNumber,
              totalTtcFcfa: order.totalTtcFcfa,
              action,
              invoiceId: linkedInvoiceId,
              statut: 'ENVOYEE',
              envoyeeAt: now.toISOString(),
              envoyeeById: ctx?.userId || null,
            },
          });

          const fullRecord = await tx.restaurantOrder.findUniqueOrThrow({
            where: { id: order.id },
            include: this.standardOrderInclude,
          });

          const formattedOrder = this.formatOrder(fullRecord);
          if (idempotencyKey) {
            await tx.syncOperation.create({
              data: {
                idempotencyKey,
                userId: ctx?.userId || null,
                result: formattedOrder as any,
              },
            });
          }

          return { formatted: formattedOrder, full: fullRecord };
        },
        { timeout: 15000 },
      );

      this.emitOrderEvent('ORDER_CREATED', formatted.id, full);
      return hideAmounts ? this.formatOrder(full, true) : formatted;
    } catch (err: any) {
      if (idempotencyKey && err?.code === 'P2002') {
        const retry = await this.prisma.restaurantOrder.findUnique({
          where: { idempotencyKey },
          include: this.standardOrderInclude,
        });
        if (retry) return this.formatOrder(retry, hideAmounts);
      }
      throw err;
    }
  }

  async payExistingOrder(
    id: string,
    dto: PayRestaurantOrderDto,
    ctx?: RestaurantActorContext,
  ) {
    this.assertNoCardPan(dto.transactionRef);
    const idempotencyKey = ctx?.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existingSync = await this.prisma.syncOperation.findUnique({
        where: { idempotencyKey },
      });
      if (existingSync) {
        return existingSync.result;
      }
    }

    const existing = await this.prisma.restaurantOrder.findUnique({
      where: { id },
      include: { lines: true, room: true, reservation: { include: { guest: true } } },
    });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Impossible d’encaisser une commande annulée.');
    }
    if (existing.destinationType === 'ROOM') {
      throw new BadRequestException('Les commandes chambre sont imputées sur la note de séjour.');
    }
    if (existing.invoiceId) {
      return this.formatOrder(existing);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.hotelSetting.findUnique({ where: { id: 'default' } });
      const dateLabel = new Date(existing.createdAt).toLocaleDateString('fr-FR');
      const walkInNote = await tx.invoice.create({
        data: {
          invoiceNumber: null,
          isIssued: false,
          documentType: InvoiceDocumentType.INVOICE,
          billingCompanyName: 'Client de passage',
          vatRatePercent: settings?.vatRatePercent ?? 0,
          serviceRatePercent: settings?.serviceRatePercent ?? 0,
          status: InvoiceStatus.OPEN,
          lines: {
            create: existing.lines.map((l) => ({
              dateLabel,
              description: `${l.name} (${existing.ticketNumber})`,
              subDescription: `${this.resolveDestinationLabel(existing)} • ${existing.serverName}`,
              category: 'RESTAURANT',
              quantity: l.quantity,
              quantityLabel: `${l.quantity}`,
              unitPriceFcfa: l.unitPriceFcfa,
              totalPriceFcfa: l.totalPriceFcfa,
              isSystem: true,
              sourceOrderId: existing.id,
            })),
          },
        },
      });

      await tx.payment.create({
        data: {
          invoiceId: walkInNote.id,
          method: dto.paymentMethod as PaymentMethod,
          amountFcfa: existing.totalTtcFcfa,
          transactionRef: dto.transactionRef?.trim() || null,
          receivedById: ctx?.userId || null,
          receivedByName: ctx?.actorName || existing.serverName,
          idempotencyKey: idempotencyKey ? `pay-${idempotencyKey}` : null,
        },
      });

      await recalculateInvoiceTotalsInTx(tx, walkInNote.id);

      const saved = await tx.restaurantOrder.update({
        where: { id },
        data: {
          invoiceId: walkInNote.id,
          paymentMethod: dto.paymentMethod,
        },
        include: {
          lines: true,
          room: true,
          reservation: { include: { guest: { select: { fullName: true } } } },
        },
      });

      await appendChainedAuditLog(tx, {
        userId: ctx?.userId || null,
        action: 'ORDER_PAY',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: ctx?.ip || null,
        after: {
          ticketNumber: saved.ticketNumber,
          paymentMethod: dto.paymentMethod,
          totalTtcFcfa: saved.totalTtcFcfa,
          invoiceId: walkInNote.id,
        },
      });

      const formatted = this.formatOrder(saved);
      if (idempotencyKey) {
        await tx.syncOperation.create({
          data: {
            idempotencyKey,
            userId: ctx?.userId || null,
            result: formatted as any,
          },
        });
      }

      return formatted;
    });

    this.emitOrderEvent('ORDER_UPDATED', id);
    return updated;
  }

  async updateOrder(
    id: string,
    dto: UpdateRestaurantOrderDto,
    actor?: RestaurantActorContext,
  ) {
    const existing = await this.prisma.restaurantOrder.findUnique({
      where: { id },
      include: this.standardOrderInclude,
    });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);

    const currentStatus = this.normalizeOrderStatus(existing.status);
    const rawRequested = dto.status || dto.statut;
    const requestedStatus = rawRequested ? this.normalizeOrderStatus(rawRequested) : undefined;
    const isKitchen = Boolean(actor?.kitchenOnly) || this.isKitchenRole(actor?.actorRole);

    if (requestedStatus === 'CANCELLED') {
      if (isKitchen) {
        throw new ForbiddenException(
          "Le rôle cuisinier n'est pas autorisé à annuler une commande.",
        );
      }
      return this.cancelOrder(
        id,
        { reason: dto.cancellationReason || dto.motifAnnulation || '' },
        actor,
      );
    }

    if (
      isKitchen &&
      (requestedStatus === 'SERVED' ||
        requestedStatus === 'AUTHORIZED' ||
        dto.paymentMethod !== undefined)
    ) {
      throw new ForbiddenException(
        'Le rôle cuisinier peut uniquement confirmer, prendre en charge, signaler un plat indisponible, ajuster le temps de préparation ou marquer prête une commande.',
      );
    }

    if (existing.status === 'CANCELLED' || currentStatus === 'CANCELLED') {
      throw new ConflictException('Une commande annulée ne peut plus changer d’état.');
    }
    if (currentStatus === 'SERVED' && requestedStatus === 'SERVED') {
      throw new ConflictException('Cette commande est déjà servie.');
    }

    const now = new Date();
    const requestedPrepMin = dto.prepTimeMinutes ?? dto.tempsPreparationMinutes;
    const requestedAddMin = dto.addMinutes;
    const hasUnavailableUpdate =
      Array.isArray(dto.unavailableLineIds) && dto.unavailableLineIds.length > 0;

    // Ajustement de temps (+5 min ou changement de temps) sur une commande déjà En préparation ou Confirmée
    const isTimeAdjustmentOnly =
      (currentStatus === 'IN_PREPARATION' || currentStatus === 'CONFIRMED') &&
      (!requestedStatus ||
        requestedStatus === 'IN_PREPARATION' ||
        requestedStatus === 'CONFIRMED') &&
      (requestedAddMin !== undefined || requestedPrepMin !== undefined);

    const isUnavailableOnly =
      hasUnavailableUpdate &&
      (!requestedStatus || requestedStatus === currentStatus) &&
      (currentStatus === 'PENDING' ||
        currentStatus === 'CONFIRMED' ||
        currentStatus === 'IN_PREPARATION');

    if (requestedStatus && !isTimeAdjustmentOnly && !isUnavailableOnly) {
      const validTransition =
        (currentStatus === 'PENDING' && requestedStatus === 'CONFIRMED') ||
        (currentStatus === 'PENDING' && requestedStatus === 'IN_PREPARATION') ||
        (currentStatus === 'CONFIRMED' && requestedStatus === 'IN_PREPARATION') ||
        (currentStatus === 'IN_PREPARATION' && requestedStatus === 'READY') ||
        (currentStatus === 'READY' && requestedStatus === 'AUTHORIZED') ||
        (currentStatus === 'AUTHORIZED' && requestedStatus === 'SERVED') ||
        (currentStatus === 'READY' && requestedStatus === 'SERVED');

      if (!validTransition) {
        throw new ConflictException(
          `Transition d'état invalide de ${this.toFrenchStatut(currentStatus)} vers ${this.toFrenchStatut(requestedStatus)}.`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (hasUnavailableUpdate) {
        const targetLineIds = dto.unavailableLineIds || [];
        const reasonText = dto.unavailableReason?.trim() || 'rupture en cuisine';
        const matchingLines = existing.lines.filter(
          (l) => targetLineIds.includes(l.id) || (l.productId && targetLineIds.includes(l.productId)),
        );
        if (matchingLines.length === 0) {
          throw new BadRequestException('Aucun plat sélectionné ne correspond à cette commande.');
        }
        const lineIdsToMark = matchingLines.map((l) => l.id);
        const dishNames = matchingLines.map((l) => l.name);

        await tx.restaurantOrderLine.updateMany({
          where: { id: { in: lineIdsToMark } },
          data: {
            isUnavailable: true,
            unavailableReason: reasonText,
          },
        });

        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: 'PLAT_INDISPONIBLE',
            detail: `Plat indisponible : ${dishNames.join(', ')}. Motif : ${reasonText}`,
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Cuisine',
            unavailableItems: dishNames,
            reason: reasonText,
            createdAt: now,
          },
        });
      }

      if (currentStatus === 'PENDING' && requestedStatus === 'CONFIRMED') {
        const claim = await tx.restaurantOrder.updateMany({
          where: {
            id,
            status: { in: ['PENDING', 'SENT_TO_KITCHEN', 'ENVOYEE'] },
          },
          data: {
            status: 'CONFIRMED',
            statut: 'CONFIRMEE',
            priseEnChargeAt: now,
            priseEnChargeById: actor?.userId || null,
            priseEnChargeByName: actor?.actorName || 'Cuisinier',
          },
        });
        if (claim.count === 0) {
          throw new ConflictException(
            'Cette commande a déjà été prise en charge par un autre cuisinier.',
          );
        }
        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: 'CONFIRMEE',
            detail: 'La cuisine a confirmé : tous les plats existent',
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Cuisinier',
            createdAt: now,
          },
        });
      } else if (
        (currentStatus === 'PENDING' || currentStatus === 'CONFIRMED') &&
        requestedStatus === 'IN_PREPARATION'
      ) {
        const prepMinutes = Math.max(1, Math.round(requestedPrepMin ?? 15));
        const heureFinPrevue = new Date(now.getTime() + prepMinutes * 60 * 1000);
        const allowedFrom =
          currentStatus === 'CONFIRMED'
            ? ['CONFIRMED', 'CONFIRMEE']
            : ['PENDING', 'SENT_TO_KITCHEN', 'ENVOYEE'];
        const claim = await tx.restaurantOrder.updateMany({
          where: {
            id,
            status: { in: allowedFrom },
          },
          data: {
            status: 'IN_PREPARATION',
            statut: 'EN_PREPARATION',
            preparingAt: now,
            priseEnChargeAt: existing.priseEnChargeAt || now,
            priseEnChargeById: actor?.userId || existing.priseEnChargeById || null,
            priseEnChargeByName: actor?.actorName || existing.priseEnChargeByName || 'Cuisinier',
            tempsPreparationMinutes: prepMinutes,
            heureFinPrevue,
          },
        });

        if (claim.count === 0) {
          throw new ConflictException(
            'Cette commande a déjà été prise en charge par un autre cuisinier.',
          );
        }

        if (currentStatus === 'PENDING' && !hasUnavailableUpdate) {
          await tx.restaurantOrderEvent.create({
            data: {
              orderId: id,
              type: 'CONFIRMEE',
              detail: 'La cuisine a confirmé : tous les plats existent',
              userId: actor?.userId || null,
              userName: actor?.actorName || 'Cuisinier',
              createdAt: new Date(now.getTime() - 100),
            },
          });
        }

        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: 'TEMPS_PREPARATION',
            detail: `Temps de préparation : ${prepMinutes} min, prête vers ${this.formatHourMinute(heureFinPrevue)}`,
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Cuisinier',
            addedMinutes: prepMinutes,
            createdAt: now,
          },
        });
      } else if (isTimeAdjustmentOnly) {
        const basePrep = existing.tempsPreparationMinutes ?? 15;
        const nextPrepMinutes =
          requestedAddMin !== undefined
            ? basePrep + Math.round(requestedAddMin)
            : Math.max(1, Math.round(requestedPrepMin ?? basePrep));
        const baseStart = existing.priseEnChargeAt || existing.preparingAt || now;
        const nextFinPrevue =
          requestedAddMin !== undefined && existing.heureFinPrevue
            ? new Date(
                new Date(existing.heureFinPrevue).getTime() +
                  Math.round(requestedAddMin) * 60 * 1000,
              )
            : new Date(new Date(baseStart).getTime() + nextPrepMinutes * 60 * 1000);

        const adjust = await tx.restaurantOrder.updateMany({
          where: {
            id,
            status: { in: ['IN_PREPARATION', 'EN_PREPARATION', 'CONFIRMED', 'CONFIRMEE'] },
          },
          data: {
            status: 'IN_PREPARATION',
            statut: 'EN_PREPARATION',
            tempsPreparationMinutes: nextPrepMinutes,
            heureFinPrevue: nextFinPrevue,
          },
        });
        if (adjust.count === 0) {
          throw new ConflictException(
            'Impossible d’ajuster le temps : la commande n’est plus en préparation.',
          );
        }

        const addMinVal = requestedAddMin ?? nextPrepMinutes;
        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: requestedAddMin !== undefined ? 'TEMPS_AJOUTE' : 'TEMPS_PREPARATION',
            detail:
              requestedAddMin !== undefined
                ? `+${Math.round(requestedAddMin)} min ajoutées : prête vers ${this.formatHourMinute(nextFinPrevue)}`
                : `Temps de préparation : ${nextPrepMinutes} min, prête vers ${this.formatHourMinute(nextFinPrevue)}`,
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Cuisinier',
            addedMinutes: Math.round(addMinVal),
            createdAt: now,
          },
        });
      } else if (currentStatus === 'IN_PREPARATION' && requestedStatus === 'READY') {
        const readyRes = await tx.restaurantOrder.updateMany({
          where: { id, status: { in: ['IN_PREPARATION', 'EN_PREPARATION'] } },
          data: {
            status: 'READY',
            statut: 'PRETE',
            readyAt: now,
            preteAt: now,
            preteById: actor?.userId || null,
          },
        });
        if (readyRes.count === 0) {
          throw new ConflictException('Cette commande n’est plus en préparation.');
        }

        const activeLines = existing.lines.filter((l) => !l.isUnavailable);
        const linesForMsg = activeLines.length > 0 ? activeLines : existing.lines;
        const totalQty = linesForMsg.reduce((s, l) => s + (l.quantity || 1), 0);
        const dishesStr = linesForMsg.map((l) => `${l.quantity} ${l.name}`).join(', ');
        const destFull = this.resolveDestinationLabel(existing, true);
        const readyVerb = totalQty > 1 ? 'prêts à servir' : 'prêt à servir';

        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: 'PRETE',
            detail: `Prête : ${dishesStr} ${readyVerb}, ${destFull}`,
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Cuisinier',
            createdAt: now,
          },
        });
      } else if (currentStatus === 'READY' && requestedStatus === 'AUTHORIZED') {
        const authRes = await tx.restaurantOrder.updateMany({
          where: { id, status: { in: ['READY', 'PRETE'] } },
          data: {
            status: 'AUTHORIZED',
            statut: 'AUTORISEE',
            autoriseAt: now,
            autoriseById: actor?.userId || null,
            autoriseByName: actor?.actorName || 'Service',
          },
        });
        if (authRes.count === 0) {
          throw new ConflictException('Cette commande n’est plus à l’état Prête.');
        }

        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: 'AUTORISEE',
            detail: `Service autorisé par ${actor?.actorName || 'l’assistant'}`,
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Service',
            createdAt: now,
          },
        });
      } else if (
        (currentStatus === 'READY' || currentStatus === 'AUTHORIZED') &&
        requestedStatus === 'SERVED'
      ) {
        const servedRes = await tx.restaurantOrder.updateMany({
          where: { id, status: { in: ['READY', 'PRETE', 'AUTHORIZED', 'AUTORISEE'] } },
          data: {
            status: 'SERVED',
            statut: 'SERVIE',
            servedAt: now,
            serviAt: now,
            serviById: actor?.userId || null,
            ...(existing.autoriseAt ? {} : { autoriseAt: now, autoriseById: actor?.userId || null }),
            ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
          },
        });
        if (servedRes.count === 0) {
          throw new ConflictException('Cette commande ne peut plus être marquée servie.');
        }

        await tx.restaurantOrderEvent.create({
          data: {
            orderId: id,
            type: 'SERVIE',
            detail: `Servie par ${actor?.actorName || 'le service'}`,
            userId: actor?.userId || null,
            userName: actor?.actorName || 'Service',
            createdAt: now,
          },
        });
      } else if (dto.paymentMethod !== undefined) {
        await tx.restaurantOrder.update({
          where: { id },
          data: { paymentMethod: dto.paymentMethod },
        });
      }

      const saved = await tx.restaurantOrder.findUniqueOrThrow({
        where: { id },
        include: this.standardOrderInclude,
      });

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: hasUnavailableUpdate ? 'ORDER_UNAVAILABLE_REPORT' : 'ORDER_STATUS_UPDATE',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: actor?.ip || null,
        before: {
          status: currentStatus,
          statut: this.toFrenchStatut(currentStatus),
          tempsPreparationMinutes: existing.tempsPreparationMinutes ?? null,
        },
        after: {
          status: this.normalizeOrderStatus(saved.status),
          statut: saved.statut,
          tempsPreparationMinutes: saved.tempsPreparationMinutes ?? null,
          heureFinPrevue: saved.heureFinPrevue ? new Date(saved.heureFinPrevue).toISOString() : null,
          priseEnChargeById: saved.priseEnChargeById || null,
          preteById: saved.preteById || null,
          autoriseById: saved.autoriseById || null,
          serviById: saved.serviById || null,
        },
      });

      return saved;
    });

    const formatted = this.formatOrder(updated, isKitchen);
    this.emitOrderEvent('ORDER_UPDATED', id, updated);
    return formatted;
  }

  async modifyOrderItems(
    id: string,
    dto: ModifyRestaurantOrderItemsDto,
    actor?: RestaurantActorContext,
  ) {
    if (this.isKitchenRole(actor?.actorRole)) {
      throw new ForbiddenException("Le cuisinier ne peut pas modifier les lignes d'une commande.");
    }
    const existing = await this.prisma.restaurantOrder.findUnique({
      where: { id },
      include: this.standardOrderInclude,
    });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);

    const currentStatus = this.normalizeOrderStatus(existing.status);
    if (
      currentStatus !== 'PENDING' &&
      currentStatus !== 'CONFIRMED' &&
      currentStatus !== 'IN_PREPARATION'
    ) {
      throw new ConflictException(
        'Seules les commandes en attente ou en préparation peuvent être modifiées.',
      );
    }

    const productIds = Array.from(
      new Set(
        dto.items
          .map((it) => it.productId || it.dishId)
          .filter((pid): pid is string => Boolean(pid && /^[0-9a-f-]{36}$/i.test(pid))),
      ),
    );
    const dbProducts =
      productIds.length > 0
        ? await this.prisma.restaurantProduct.findMany({ where: { id: { in: productIds } } })
        : [];
    const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

    const resolvedLines = dto.items.map((it) => {
      const pid =
        (it.productId || it.dishId) && /^[0-9a-f-]{36}$/i.test((it.productId || it.dishId)!)
          ? (it.productId || it.dishId)!
          : null;
      const qty = Math.max(1, Math.round(it.quantity));
      if (pid && prodMap.has(pid)) {
        const dbProd = prodMap.get(pid)!;
        return {
          productId: dbProd.id,
          name: dbProd.name,
          quantity: qty,
          unitPriceFcfa: dbProd.priceFcfa,
          totalPriceFcfa: dbProd.priceFcfa * qty,
          selectedOptions: it.selectedOptions || [],
          notes: it.notes?.trim() || null,
          prepStation: dbProd.prepStation || 'CUISINE',
          isUnavailable: false,
          unavailableReason: null,
        };
      }
      const cleanName = it.name?.trim() || 'Article';
      const unit = Math.max(0, Math.round(it.unitPriceFcfa ?? 0));
      return {
        productId: null,
        name: cleanName,
        quantity: qty,
        unitPriceFcfa: unit,
        totalPriceFcfa: unit * qty,
        selectedOptions: it.selectedOptions || [],
        notes: it.notes?.trim() || null,
        prepStation: it.prepStation || 'CUISINE',
        isUnavailable: false,
        unavailableReason: null,
      };
    });

    const totalTtcFcfa = resolvedLines.reduce((sum, l) => sum + l.totalPriceFcfa, 0);
    const subtotalHtFcfa = Math.round(totalTtcFcfa / 1.1);
    const vatAmountFcfa = totalTtcFcfa - subtotalHtFcfa;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.restaurantOrderLine.deleteMany({ where: { orderId: id } });
      await tx.restaurantOrder.update({
        where: { id },
        data: {
          subtotalHtFcfa,
          vatAmountFcfa,
          totalTtcFcfa,
          lines: { create: resolvedLines },
        },
      });

      if (existing.invoiceId) {
        const linkedInv = await tx.invoice.findUnique({ where: { id: existing.invoiceId } });
        if (linkedInv && !linkedInv.isIssued) {
          await tx.invoiceLine.deleteMany({
            where: { invoiceId: linkedInv.id, sourceOrderId: existing.id },
          });
          const dateLabel = new Date(existing.createdAt).toLocaleDateString('fr-FR');
          for (const l of resolvedLines) {
            await tx.invoiceLine.create({
              data: {
                invoiceId: linkedInv.id,
                dateLabel,
                description: `${l.name} (${existing.ticketNumber})`,
                subDescription: `Restaurant • ${existing.serverName}`,
                category: 'RESTAURANT',
                quantity: l.quantity,
                quantityLabel: `${l.quantity}`,
                unitPriceFcfa: l.unitPriceFcfa,
                totalPriceFcfa: l.totalPriceFcfa,
                isSystem: true,
                sourceOrderId: existing.id,
              },
            });
          }
          await recalculateInvoiceTotalsInTx(tx, linkedInv.id);
        }
      }

      const summary = resolvedLines.map((l) => `${l.quantity} ${l.name}`).join(', ');
      await tx.restaurantOrderEvent.create({
        data: {
          orderId: id,
          type: 'COMMANDE_MODIFIEE',
          detail: `Commande modifiée : ${summary}`,
          userId: actor?.userId || null,
          userName: actor?.actorName || 'Service',
          createdAt: now,
        },
      });

      const saved = await tx.restaurantOrder.findUniqueOrThrow({
        where: { id },
        include: this.standardOrderInclude,
      });

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'ORDER_ITEMS_MODIFY',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: actor?.ip || null,
        before: { totalTtcFcfa: existing.totalTtcFcfa },
        after: { totalTtcFcfa: saved.totalTtcFcfa, items: summary },
      });

      return saved;
    });

    this.emitOrderEvent('ORDER_UPDATED', id, updated);
    return this.formatOrder(updated, false);
  }

  async cancelOrder(
    id: string,
    dto: CancelRestaurantOrderDto,
    actor?: RestaurantActorContext,
  ) {
    if (this.isKitchenRole(actor?.actorRole) || actor?.actorRole === 'COMPTABLE') {
      throw new ForbiddenException(
        "L'annulation d'une commande n'est pas autorisée pour ce rôle.",
      );
    }

    const existing = await this.prisma.restaurantOrder.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);

    const currentStatus = this.normalizeOrderStatus(existing.status);
    if (currentStatus === 'CANCELLED') {
      throw new ConflictException('Cette commande est déjà annulée.');
    }
    if (
      currentStatus !== 'PENDING' &&
      currentStatus !== 'CONFIRMED' &&
      currentStatus !== 'IN_PREPARATION'
    ) {
      throw new ConflictException(
        'Seules les commandes à l’état Envoyée, Confirmée ou En préparation peuvent être annulées.',
      );
    }

    const isDirOrRec =
      actor?.actorRole === 'DIRECTION' || actor?.actorRole === 'RECEPTION' || !actor?.actorRole;
    const hasUnavailable = (existing.lines || []).some((l) => Boolean(l.isUnavailable));
    if (!isDirOrRec && currentStatus !== 'PENDING' && !hasUnavailable) {
      throw new ForbiddenException(
        'Cette commande est déjà en préparation, demandez à la réception de l’annuler.',
      );
    }

    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException("Un motif d'annulation d'au moins 3 caractères est obligatoire.");
    }

    const now = new Date();
    const cancelled = await this.prisma.$transaction(async (tx) => {
      if (existing.invoiceId) {
        const linkedInv = await tx.invoice.findUnique({ where: { id: existing.invoiceId } });
        if (linkedInv?.isIssued) {
          throw new BadRequestException(
            "Impossible d'annuler une commande déjà portée sur une facture émise. Émettez un avoir depuis Facturation.",
          );
        }
        if (linkedInv) {
          await tx.invoiceLine.deleteMany({
            where: { invoiceId: linkedInv.id, sourceOrderId: existing.id },
          });
          await recalculateInvoiceTotalsInTx(tx, linkedInv.id);
        }
      }

      await tx.restaurantOrderEvent.create({
        data: {
          orderId: id,
          type: 'ANNULEE',
          detail: `Commande annulée. Motif : ${reason}`,
          userId: actor?.userId || null,
          userName: actor?.actorName || actor?.actorRole || 'Service',
          reason,
          createdAt: now,
        },
      });

      const saved = await tx.restaurantOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          statut: 'ANNULEE',
          cancellationReason: reason,
          motifAnnulation: reason,
          cancelledAt: now,
          annuleAt: now,
          cancelledById: actor?.userId || null,
          annuleById: actor?.userId || null,
          cancelledByName: actor?.actorName || actor?.actorRole || 'Direction',
        },
        include: this.standardOrderInclude,
      });

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'ORDER_CANCEL',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: actor?.ip || null,
        before: { status: currentStatus, statut: this.toFrenchStatut(currentStatus) },
        after: {
          status: 'CANCELLED',
          statut: 'ANNULEE',
          reason,
          annuleById: actor?.userId || null,
          annuleAt: now.toISOString(),
          ticketNumber: saved.ticketNumber,
        },
      });

      return saved;
    });

    this.emitOrderEvent('ORDER_CANCELLED', id, cancelled);
    return this.formatOrder(cancelled);
  }
}
