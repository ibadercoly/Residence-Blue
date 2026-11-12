import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { appendChainedAuditLog } from '../common/audit/audit.service';
import {
  CreateRestaurantOrderDto,
  CreateRestaurantProductDto,
  UpdateRestaurantOrderDto,
  UpdateRestaurantProductDto,
} from './dto/restaurant.dto';

@Injectable()
export class RestaurantService {
  constructor(private readonly prisma: PrismaService) {}

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
      status: p.status || 'AVAILABLE',
    };
  }

  private formatOrder(o: any) {
    return {
      id: o.id,
      ticketNumber: o.ticketNumber,
      serverName: o.serverName,
      time: new Date(o.createdAt).toISOString(),
      destinationType: o.destinationType,
      destinationValue: o.destinationType === 'ROOM' ? o.room?.number || '' : o.tableLabel || 'T1',
      roomId: o.roomId,
      roomNumber: o.room?.number || null,
      reservationId: o.reservationId,
      subtotalHtFcfa: o.subtotalHtFcfa,
      vatRatePercent: 10,
      vatAmountFcfa: o.vatAmountFcfa,
      totalTtcFcfa: o.totalTtcFcfa,
      status: o.status,
      paymentMethod: o.paymentMethod,
      items: (o.lines || []).map((l: any) => ({
        id: l.id,
        dishId: l.productId || '',
        name: l.name,
        quantity: l.quantity,
        unitPriceFcfa: l.unitPriceFcfa,
        totalPriceFcfa: l.totalPriceFcfa,
        selectedOptions: l.selectedOptions || [],
        notes: l.notes || undefined,
        prepStation: l.prepStation || 'CUISINE',
      })),
    };
  }

  async findAllCategories() {
    const cats = await this.prisma.restaurantCategory.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { displayOrder: 'asc' },
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
      include: { category: true },
      orderBy: { displayOrder: 'asc' },
    });
    return products.map((p) => this.formatProduct(p));
  }

  async createProduct(dto: CreateRestaurantProductDto) {
    const cleanName = dto.name.trim();
    const dup = await this.prisma.restaurantProduct.findUnique({ where: { name: cleanName } });
    if (dup) {
      throw new ConflictException(`Un plat nommé « ${cleanName} » existe déjà.`);
    }

    if (dto.photoUrl && dto.photoUrl.startsWith('data:image')) {
      throw new BadRequestException('Les images encodées en base64 (data:image) ne sont pas autorisées en base.');
    }

    let category = dto.categoryId && /^[0-9a-f-]{36}$/i.test(dto.categoryId)
      ? await this.prisma.restaurantCategory.findUnique({ where: { id: dto.categoryId } })
      : null;

    if (!category) {
      const catName = dto.categoryName?.trim() || 'Plats sénégalais & Mer';
      category = await this.prisma.restaurantCategory.findUnique({ where: { name: catName } });
      if (!category) {
        category = await this.prisma.restaurantCategory.create({
          data: { name: catName, icon: 'dinner_dining', displayOrder: 1 },
        });
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const p = await tx.restaurantProduct.create({
        data: {
          name: cleanName,
          description: dto.description?.trim() || '',
          categoryId: category!.id,
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
        include: { category: true },
      });

      await appendChainedAuditLog(tx, {
        action: 'PRODUCT_CREATE',
        entity: 'RestaurantProduct',
        entityId: p.id,
        after: { id: p.id, name: p.name, priceFcfa: p.priceFcfa },
      });

      return p;
    });

    return this.formatProduct(created);
  }

  async updateProduct(id: string, dto: UpdateRestaurantProductDto) {
    const existing = await this.prisma.restaurantProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Plat "${id}" introuvable.`);
    }

    if (dto.photoUrl && dto.photoUrl.startsWith('data:image')) {
      throw new BadRequestException('Les images encodées en base64 (data:image) ne sont pas autorisées en base.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const p = await tx.restaurantProduct.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
          ...(dto.categoryId && /^[0-9a-f-]{36}$/i.test(dto.categoryId) ? { categoryId: dto.categoryId } : {}),
          ...(dto.priceFcfa !== undefined ? { priceFcfa: Math.round(dto.priceFcfa) } : {}),
          ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
          ...(dto.allergens !== undefined ? { allergens: dto.allergens } : {}),
          ...(dto.prepTimeMinutes !== undefined ? { prepTimeMinutes: dto.prepTimeMinutes } : {}),
          ...(dto.prepStation !== undefined ? { prepStation: dto.prepStation } : {}),
          ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl || null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
        },
        include: { category: true },
      });

      await appendChainedAuditLog(tx, {
        action: 'PRODUCT_UPDATE',
        entity: 'RestaurantProduct',
        entityId: p.id,
        before: { name: existing.name, priceFcfa: existing.priceFcfa, status: existing.status },
        after: { name: p.name, priceFcfa: p.priceFcfa, status: p.status },
      });

      return p;
    });

    return this.formatProduct(updated);
  }

  async deleteOrArchiveProduct(id: string) {
    const existing = await this.prisma.restaurantProduct.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Plat "${id}" introuvable.`);
    }

    const lineCount = await this.prisma.restaurantOrderLine.count({ where: { productId: id } });
    if (lineCount > 0) {
      const archived = await this.prisma.restaurantProduct.update({
        where: { id },
        data: { status: 'ARCHIVED' },
        include: { category: true },
      });
      return { deleted: false, archived: true, product: this.formatProduct(archived) };
    }

    await this.prisma.$transaction(async (tx) => {
      await appendChainedAuditLog(tx, {
        action: 'PRODUCT_DELETE',
        entity: 'RestaurantProduct',
        entityId: existing.id,
        before: { id: existing.id, name: existing.name, priceFcfa: existing.priceFcfa },
      });
      await tx.restaurantProduct.delete({ where: { id } });
    });

    return { deleted: true, archived: false, id };
  }

  async findAllOrders() {
    const orders = await this.prisma.restaurantOrder.findMany({
      include: { lines: true, room: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o) => this.formatOrder(o));
  }

  async createOrder(
    dto: CreateRestaurantOrderDto,
    ctx?: { idempotencyKey?: string; userId?: string; actorName?: string; ip?: string },
  ) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('La commande doit comporter au moins un article.');
    }

    const idempotencyKey = ctx?.idempotencyKey?.trim() || undefined;
    if (idempotencyKey) {
      const existingByKey = await this.prisma.restaurantOrder.findUnique({
        where: { idempotencyKey },
        include: { lines: true, room: true },
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

    let resolvedRoomId = dto.roomId && /^[0-9a-f-]{36}$/i.test(dto.roomId) ? dto.roomId : null;
    if (!resolvedRoomId && dto.roomNumber) {
      const r = await this.prisma.room.findUnique({ where: { number: dto.roomNumber.trim() } });
      if (r) resolvedRoomId = r.id;
    }

    let resolvedReservationId =
      dto.reservationId && /^[0-9a-f-]{36}$/i.test(dto.reservationId) ? dto.reservationId : null;
    if (!resolvedReservationId && resolvedRoomId && (dto.destinationType === 'ROOM' || resolvedRoomId)) {
      const activeStay = await this.prisma.reservation.findFirst({
        where: {
          roomId: resolvedRoomId,
          status: { in: ['CHECKED_IN', 'CONFIRMED'] },
        },
        orderBy: [{ status: 'asc' }, { checkIn: 'desc' }],
        select: { id: true },
      });
      if (activeStay) resolvedReservationId = activeStay.id;
    }

    const totalTtcFcfa = dto.items.reduce(
      (sum, it) => sum + (it.totalPriceFcfa !== undefined ? Math.round(it.totalPriceFcfa) : Math.round(it.unitPriceFcfa) * Math.round(it.quantity)),
      0,
    );
    const subtotalHtFcfa = Math.round(totalTtcFcfa / 1.1);
    const vatAmountFcfa = totalTtcFcfa - subtotalHtFcfa;
    const ticketNumber =
      dto.ticketNumber?.trim() || `#CMD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const order = await tx.restaurantOrder.create({
          data: {
            ticketNumber,
            idempotencyKey: idempotencyKey || null,
            destinationType: dto.destinationType || (resolvedRoomId ? 'ROOM' : 'TABLE'),
            tableLabel: dto.tableLabel || 'T1',
            roomId: resolvedRoomId,
            reservationId: resolvedReservationId,
            serverName: dto.serverName || ctx?.actorName || 'Service',
            status: dto.status || 'SENT_TO_KITCHEN',
            subtotalHtFcfa,
            vatAmountFcfa,
            totalTtcFcfa,
            paymentMethod: dto.paymentMethod || null,
            lines: {
              create: dto.items.map((it) => {
                const prodId = (it.productId || it.dishId) && /^[0-9a-f-]{36}$/i.test((it.productId || it.dishId)!)
                  ? (it.productId || it.dishId)!
                  : null;
                return {
                  productId: prodId,
                  name: it.name,
                  quantity: Math.round(it.quantity),
                  unitPriceFcfa: Math.round(it.unitPriceFcfa),
                  totalPriceFcfa:
                    it.totalPriceFcfa !== undefined
                      ? Math.round(it.totalPriceFcfa)
                      : Math.round(it.unitPriceFcfa) * Math.round(it.quantity),
                  selectedOptions: it.selectedOptions || [],
                  notes: it.notes || null,
                  prepStation: it.prepStation || 'CUISINE',
                };
              }),
            },
          },
          include: { lines: true, room: true },
        });

        await appendChainedAuditLog(tx, {
          userId: ctx?.userId || null,
          action: 'ORDER_CREATE',
          entity: 'RestaurantOrder',
          entityId: order.id,
          ip: ctx?.ip || null,
          after: {
            id: order.id,
            ticketNumber: order.ticketNumber,
            totalTtcFcfa: order.totalTtcFcfa,
            roomId: order.roomId,
          },
        });

        const formatted = this.formatOrder(order);
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
      }, { timeout: 15000 });

      return created;
    } catch (err: any) {
      if (idempotencyKey && err?.code === 'P2002') {
        const retry = await this.prisma.restaurantOrder.findUnique({
          where: { idempotencyKey },
          include: { lines: true, room: true },
        });
        if (retry) return this.formatOrder(retry);
      }
      throw err;
    }
  }

  async updateOrder(id: string, dto: UpdateRestaurantOrderDto) {
    const existing = await this.prisma.restaurantOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Commande "${id}" introuvable.`);

    const updated = await this.prisma.restaurantOrder.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
      },
      include: { lines: true, room: true },
    });

    return this.formatOrder(updated);
  }
}
