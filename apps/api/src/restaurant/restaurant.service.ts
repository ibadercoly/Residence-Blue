import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceDocumentType, InvoiceStatus, PaymentMethod, Prisma, ReservationStatus } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import { recalculateInvoiceTotalsInTx } from '../billing/billing-totals.helper';
import {
  CancelRestaurantOrderDto,
  CreateRestaurantOrderDto,
  CreateRestaurantProductDto,
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
  ip?: string;
}

export interface RestaurantOrderStreamEvent {
  type: 'ORDER_CREATED' | 'ORDER_UPDATED' | 'ORDER_CANCELLED' | 'HEARTBEAT';
  orderId?: string;
  timestamp: string;
}

const CARD_PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/;

@Injectable()
export class RestaurantService {
  private readonly orderEvents$ = new Subject<RestaurantOrderStreamEvent>();

  constructor(private readonly prisma: PrismaService) {}

  getOrderEventStream(): Observable<RestaurantOrderStreamEvent> {
    return this.orderEvents$.asObservable();
  }

  private emitOrderEvent(type: RestaurantOrderStreamEvent['type'], orderId?: string): void {
    this.orderEvents$.next({
      type,
      orderId,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeOrderStatus(status?: string | null): string {
    if (!status || status === 'SENT_TO_KITCHEN') return 'PENDING';
    return status;
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

  private resolveDestinationLabel(o: any): string {
    if (o.destinationType === 'ROOM') {
      const num = o.room?.number || o.tableLabel?.replace(/^Ch\.\s*/i, '') || '';
      return num ? `Ch. ${num}` : 'Chambre';
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

    return {
      id: o.id,
      ticketNumber: o.ticketNumber,
      serverName: o.serverName,
      time: new Date(o.createdAt).toISOString(),
      createdAt: new Date(o.createdAt).toISOString(),
      updatedAt: new Date(o.updatedAt).toISOString(),
      destinationType: destType,
      destinationValue: destValue,
      destinationLabel: this.resolveDestinationLabel(o),
      tableLabel: o.tableLabel || null,
      roomId: o.roomId || null,
      roomNumber: o.room?.number || null,
      reservationId: o.reservationId || null,
      invoiceId: o.invoiceId || null,
      guestName,
      status: this.normalizeOrderStatus(o.status),
      paymentMethod: o.paymentMethod || null,
      cancellationReason: o.cancellationReason || null,
      cancelledByName: o.cancelledByName || null,
      preparingAt: o.preparingAt ? new Date(o.preparingAt).toISOString() : null,
      readyAt: o.readyAt ? new Date(o.readyAt).toISOString() : null,
      servedAt: o.servedAt ? new Date(o.servedAt).toISOString() : null,
      cancelledAt: o.cancelledAt ? new Date(o.cancelledAt).toISOString() : null,
      ...(hideAmounts
        ? {}
        : {
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
    };
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

  async findAllProducts() {
    const products = await this.prisma.restaurantProduct.findMany({
      include: {
        category: true,
        _count: { select: { orderLines: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    return products.map((p) => this.formatProduct(p));
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

  async getCatalog(actorRole?: string) {
    const [categories, products, roomsInStay] = await Promise.all([
      this.findAllCategories(),
      this.findAllProducts(),
      actorRole === 'CUISINE' ? Promise.resolve([]) : this.findRoomsInStay(),
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

  async findAllOrders(actorRole?: string) {
    const hideAmounts = actorRole === 'CUISINE';
    const orders = await this.prisma.restaurantOrder.findMany({
      include: {
        lines: true,
        room: true,
        reservation: { include: { guest: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return orders.map((o) => this.formatOrder(o, hideAmounts));
  }

  async findOrdersPage(query: RestaurantOrdersQueryDto, actorRole?: string) {
    const offset = Math.max(0, Math.round(query.offset || 0));
    const limit = Math.min(50, Math.max(1, Math.round(query.limit || 50)));
    const hideAmounts = actorRole === 'CUISINE';

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
        { guestName: { contains: q, mode: 'insensitive' } },
        { tableLabel: { contains: q, mode: 'insensitive' } },
        { room: { number: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [total, items] = await Promise.all([
      this.prisma.restaurantOrder.count({ where }),
      this.prisma.restaurantOrder.findMany({
        where,
        include: {
          lines: true,
          room: true,
          reservation: { include: { guest: { select: { fullName: true } } } },
        },
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

    const idempotencyKey = ctx?.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existingByKey = await this.prisma.restaurantOrder.findUnique({
        where: { idempotencyKey },
        include: {
          lines: true,
          room: true,
          reservation: { include: { guest: { select: { fullName: true } } } },
        },
      });
      if (existingByKey) {
        return this.formatOrder(existingByKey);
      }
      const existingSync = await this.prisma.syncOperation.findUnique({
        where: { idempotencyKey },
      });
      if (existingSync) {
        return existingSync.result;
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
      const created = await this.prisma.$transaction(
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
            },
            include: {
              lines: true,
              room: true,
              reservation: { include: { guest: { select: { fullName: true } } } },
            },
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
            },
          });

          const full = await tx.restaurantOrder.findUniqueOrThrow({
            where: { id: order.id },
            include: {
              lines: true,
              room: true,
              reservation: { include: { guest: { select: { fullName: true } } } },
            },
          });

          const formatted = this.formatOrder(full);
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
        },
        { timeout: 15000 },
      );

      this.emitOrderEvent('ORDER_CREATED', created.id);
      return created;
    } catch (err: any) {
      if (idempotencyKey && err?.code === 'P2002') {
        const retry = await this.prisma.restaurantOrder.findUnique({
          where: { idempotencyKey },
          include: {
            lines: true,
            room: true,
            reservation: { include: { guest: { select: { fullName: true } } } },
          },
        });
        if (retry) return this.formatOrder(retry);
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
    const existing = await this.prisma.restaurantOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);

    const requestedStatus = dto.status ? this.normalizeOrderStatus(dto.status) : undefined;
    if (requestedStatus === 'CANCELLED') {
      if (actor?.actorRole !== 'DIRECTION' && actor?.actorRole !== 'RECEPTION') {
        throw new ForbiddenException(
          "L'annulation d'une commande est réservée aux rôles DIRECTION et RECEPTION.",
        );
      }
      return this.cancelOrder(id, { reason: dto.cancellationReason || '' }, actor);
    }

    if (existing.status === 'CANCELLED' && requestedStatus) {
      throw new BadRequestException('Une commande annulée ne peut plus changer d’état.');
    }

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.restaurantOrder.update({
        where: { id },
        data: {
          ...(requestedStatus ? { status: requestedStatus } : {}),
          ...(requestedStatus === 'IN_PREPARATION' && !existing.preparingAt ? { preparingAt: now } : {}),
          ...(requestedStatus === 'READY' && !existing.readyAt ? { readyAt: now } : {}),
          ...(requestedStatus === 'SERVED' && !existing.servedAt ? { servedAt: now } : {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        },
        include: {
          lines: true,
          room: true,
          reservation: { include: { guest: { select: { fullName: true } } } },
        },
      });

      await appendChainedAuditLog(tx, {
        userId: actor?.userId || null,
        action: 'ORDER_STATUS_UPDATE',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: actor?.ip || null,
        before: { status: this.normalizeOrderStatus(existing.status) },
        after: { status: this.normalizeOrderStatus(saved.status) },
      });

      return saved;
    });

    const formatted = this.formatOrder(updated, actor?.actorRole === 'CUISINE');
    this.emitOrderEvent('ORDER_UPDATED', id);
    return formatted;
  }

  async cancelOrder(
    id: string,
    dto: CancelRestaurantOrderDto,
    actor?: RestaurantActorContext,
  ) {
    if (actor?.actorRole && actor.actorRole !== 'DIRECTION' && actor.actorRole !== 'RECEPTION') {
      throw new ForbiddenException(
        "L'annulation d'une commande est réservée aux rôles DIRECTION et RECEPTION.",
      );
    }

    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3) {
      throw new BadRequestException("Un motif d'annulation d'au moins 3 caractères est obligatoire.");
    }

    const existing = await this.prisma.restaurantOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cette commande est déjà annulée.');
    }

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

      const saved = await tx.restaurantOrder.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancellationReason: reason,
          cancelledAt: new Date(),
          cancelledById: actor?.userId || null,
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
        action: 'ORDER_CANCEL',
        entity: 'RestaurantOrder',
        entityId: saved.id,
        ip: actor?.ip || null,
        before: { status: this.normalizeOrderStatus(existing.status) },
        after: { status: 'CANCELLED', reason, ticketNumber: saved.ticketNumber },
      });

      return saved;
    });

    this.emitOrderEvent('ORDER_CANCELLED', id);
    return this.formatOrder(cancelled);
  }
}
