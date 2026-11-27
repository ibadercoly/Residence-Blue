import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AppNotificationDto,
  InterventionNotificationType,
  NotificationSeverity,
  NotificationsListResponse,
  NotificationStreamEvent,
  RestaurantNotificationType,
  hasScreenAccess,
  hasSpecialPermission,
  isDirectorAccount,
  isKitchenAccount,
  normalizeLegacyRole,
} from '@residence-blue/shared';
import { Observable, Subject, concat, from, map } from 'rxjs';
import { filter } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationOrderItemInput {
  name: string;
  quantity: number;
  isUnavailable?: boolean;
}

export interface NotificationOrderContext {
  id: string;
  ticketNumber: string;
  destinationType?: string | null;
  roomNumber?: string | null;
  tableLabel?: string | null;
  guestName?: string | null;
  items: NotificationOrderItemInput[];
}

interface BufferedNotificationEvent {
  eventId: number;
  type: 'NOTIFICATION_CREATED' | 'NOTIFICATION_READ' | 'NOTIFICATIONS_READ_ALL';
  targetUserId?: string;
  rawMessage?: any;
  notificationId?: string;
  readAt?: string;
  timestamp: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PANEL_MESSAGES = 50;
const LATE_THRESHOLD_MS = 60 * 1000;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly events$ = new Subject<BufferedNotificationEvent>();
  private readonly recentEventsBuffer: BufferedNotificationEvent[] = [];
  private nextEventId = 1;
  private overdueCheckTimer: ReturnType<typeof setInterval> | null = null;
  private lastOverdueCheckAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Vérification périodique des retards de préparation (désactivée en tests unitaires purs sans timers)
    if (process.env.NODE_ENV !== 'test' && !this.overdueCheckTimer) {
      this.overdueCheckTimer = setInterval(() => {
        void this.checkOverdueOrders().catch(() => undefined);
      }, 20_000);
      this.overdueCheckTimer.unref?.();
    }
  }

  onModuleDestroy(): void {
    if (this.overdueCheckTimer) {
      clearInterval(this.overdueCheckTimer);
      this.overdueCheckTimer = null;
    }
  }

  canReceiveOrderNotifications(user: any): boolean {
    if (!user || isKitchenAccount(user)) return false;
    if (!hasScreenAccess(user, 'restaurant', 'LECTURE')) return false;
    if (isDirectorAccount(user)) return true;
    const normalizedRole = normalizeLegacyRole(user.role);
    return (
      normalizedRole === 'DIRECTION' ||
      normalizedRole === 'RECEPTION' ||
      normalizedRole === 'RESTAURANT'
    );
  }

  canSeeRoomGuestName(user: any): boolean {
    if (!this.canReceiveOrderNotifications(user)) return false;
    if (isDirectorAccount(user)) return true;
    return (
      hasSpecialPermission(user, 'voir_montants') ||
      hasScreenAccess(user, 'clients', 'LECTURE')
    );
  }

  assertCanAccessNotifications(user: any): void {
    if (!this.canReceiveOrderNotifications(user)) {
      throw new ForbiddenException(
        'Les notifications du service sont réservées aux comptes autorisés sur Restaurant.',
      );
    }
  }

  formatHourMinute(date: Date): string {
    return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  formatDishesWithQuantities(items: NotificationOrderItemInput[]): string {
    const clean = (items || []).filter((it) => Boolean(it?.name?.trim()));
    if (clean.length === 0) return '1 plat';
    const firstTwo = clean
      .slice(0, 2)
      .map((it) => `${Math.max(1, Math.round(it.quantity || 1))} ${it.name.trim()}`);
    if (clean.length <= 2) {
      return firstTwo.join(', ');
    }
    const rest = clean.length - 2;
    return `${firstTwo.join(', ')} et ${rest} autre${rest > 1 ? 's' : ''} plat${rest > 1 ? 's' : ''}`;
  }

  formatUnavailableDishNames(dishNames: string[]): string {
    const clean = (dishNames || []).map((n) => n.trim()).filter(Boolean);
    if (clean.length === 0) return 'Un plat';
    if (clean.length <= 2) {
      return clean.join(', ');
    }
    const rest = clean.length - 2;
    return `${clean[0]}, ${clean[1]} et ${rest} autre${rest > 1 ? 's' : ''} plat${rest > 1 ? 's' : ''}`;
  }

  resolveDestinationTarget(order: NotificationOrderContext): {
    destinationType: 'ROOM' | 'TABLE' | 'TAKEAWAY';
    roomNumber: string | null;
    destinationLabel: string;
    guestName: string | null;
  } {
    const dest = String(order.destinationType || 'TABLE').toUpperCase();
    if (dest === 'ROOM') {
      const roomNum =
        order.roomNumber?.trim() ||
        order.tableLabel?.replace(/^(Ch\.|Chambre)\s*/i, '').trim() ||
        null;
      const rawGuest = order.guestName?.trim() || '';
      const validGuest =
        rawGuest &&
        rawGuest !== 'Client de passage' &&
        rawGuest !== 'Client séjour'
          ? rawGuest
          : null;
      return {
        destinationType: 'ROOM',
        roomNumber: roomNum,
        destinationLabel: roomNum ? `Chambre ${roomNum}` : 'Chambre',
        guestName: validGuest,
      };
    }
    if (dest === 'TAKEAWAY') {
      const rawTicket = (order.ticketNumber || '').trim();
      const shortNum = rawTicket.replace(/^#?CMD-?/i, '').trim() || rawTicket || '1';
      return {
        destinationType: 'TAKEAWAY',
        roomNumber: null,
        destinationLabel: `À emporter N° ${shortNum}`,
        guestName: null,
      };
    }
    const rawTable = order.tableLabel?.trim() || '';
    const tableLabel = rawTable || 'Table 1';
    return {
      destinationType: 'TABLE',
      roomNumber: null,
      destinationLabel: tableLabel,
      guestName: null,
    };
  }

  private formatNotificationForUser(raw: any, user: any, readAtOverride?: Date | null): AppNotificationDto {
    const readAtDate =
      readAtOverride !== undefined
        ? readAtOverride
        : raw.reads?.[0]?.readAt
          ? new Date(raw.reads[0].readAt)
          : null;

    const showGuest =
      raw.destinationType === 'ROOM' &&
      Boolean(raw.guestName) &&
      this.canSeeRoomGuestName(user);
    const detail = showGuest ? `${raw.destinationLabel}, ${raw.guestName}` : raw.destinationLabel;

    return {
      id: raw.id,
      category:
        raw.category === 'MAINTENANCE'
          ? 'MAINTENANCE'
          : raw.category === 'HOUSEKEEPING'
            ? 'HOUSEKEEPING'
            : 'RESTAURANT',
      type: raw.type,
      severity: (raw.severity as NotificationSeverity) || 'INFO',
      title: raw.title,
      detail,
      orderId: raw.orderId || null,
      roomNumber: raw.roomNumber || null,
      targetRoles: Array.isArray(raw.targetRoles) ? raw.targetRoles : [],
      link: raw.link,
      importantAlert: Boolean(raw.importantAlert),
      read: Boolean(readAtDate),
      readAt: readAtDate ? readAtDate.toISOString() : null,
      createdAt: new Date(raw.createdAt).toISOString(),
    };
  }

  private emitBufferedEvent(evt: Omit<BufferedNotificationEvent, 'eventId' | 'timestamp'>): void {
    const full: BufferedNotificationEvent = {
      ...evt,
      eventId: this.nextEventId++,
      timestamp: new Date().toISOString(),
    };
    this.recentEventsBuffer.push(full);
    if (this.recentEventsBuffer.length > 100) {
      this.recentEventsBuffer.shift();
    }
    this.events$.next(full);
  }

  async createInterventionNotification(params: {
    targetRoles: string[];
    type: InterventionNotificationType;
    severity: NotificationSeverity;
    roomNumber: string;
    title: string;
    detail: string;
    link?: string;
    importantAlert?: boolean;
  }) {
    const normalizedTargets = Array.from(
      new Set((params.targetRoles || []).map((r) => String(r).toUpperCase())),
    );
    const created = await this.prisma.notificationMessage.create({
      data: {
        category: 'MAINTENANCE',
        type: params.type,
        severity: params.severity,
        destinationType: 'ROOM',
        roomNumber: params.roomNumber,
        destinationLabel: params.detail,
        guestName: null,
        title: params.title,
        link: params.link || '/chambres',
        importantAlert: Boolean(params.importantAlert),
        targetRoles: normalizedTargets,
      },
    });
    this.emitBufferedEvent({
      type: 'NOTIFICATION_CREATED',
      rawMessage: created,
    });
    return created;
  }

  async listInterventionNotificationsForRole(role: string): Promise<AppNotificationDto[]> {
    const normalizedRole = String(role || '').toUpperCase();
    const since = new Date(Date.now() - ONE_DAY_MS);
    const rows = await this.prisma.notificationMessage.findMany({
      where: {
        category: 'MAINTENANCE',
        createdAt: { gte: since },
        targetRoles: { has: normalizedRole },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_PANEL_MESSAGES,
    });
    return rows.map((row) =>
      this.formatNotificationForUser(row, { role: normalizedRole }, null),
    );
  }

  async createOrderNotification(params: {
    order: NotificationOrderContext;
    type: RestaurantNotificationType;
    severity: NotificationSeverity;
    title: string;
    importantAlert: boolean;
  }) {
    const target = this.resolveDestinationTarget(params.order);
    try {
      const created = await this.prisma.notificationMessage.create({
        data: {
          category: 'RESTAURANT',
          type: params.type,
          severity: params.severity,
          orderId: params.order.id,
          destinationType: target.destinationType,
          roomNumber: target.roomNumber,
          destinationLabel: target.destinationLabel,
          guestName: target.guestName,
          title: params.title,
          link: `/restaurant?highlightOrder=${params.order.id}`,
          importantAlert: params.importantAlert,
        },
      });
      this.emitBufferedEvent({
        type: 'NOTIFICATION_CREATED',
        rawMessage: created,
      });
      return created;
    } catch (err: any) {
      // Garantir l'unicité d'une seule notification RETARD par commande même en concurrence
      if (params.type === 'RETARD' && err?.code === 'P2002') {
        return null;
      }
      throw err;
    }
  }

  async notifyConfirmedWithPrepTime(
    order: NotificationOrderContext,
    prepMinutes: number,
    heureFinPrevue: Date,
  ) {
    const activeItems = (order.items || []).filter((it) => !it.isUnavailable);
    const dishes = this.formatDishesWithQuantities(
      activeItems.length > 0 ? activeItems : order.items,
    );
    const title = `La cuisine prépare ${dishes}. Prête vers ${this.formatHourMinute(heureFinPrevue)} (dans ${prepMinutes} min)`;
    return this.createOrderNotification({
      order,
      type: 'PLAT_CONFIRME_TEMPS',
      severity: 'INFO',
      title,
      importantAlert: false,
    });
  }

  async notifyAddedPrepTime(
    order: NotificationOrderContext,
    previousFinPrevue: Date | null,
    nextFinPrevue: Date,
  ) {
    const activeItems = (order.items || []).filter((it) => !it.isUnavailable);
    const usedItems = activeItems.length > 0 ? activeItems : order.items;
    const dishes = this.formatDishesWithQuantities(usedItems);
    const totalQty = usedItems.reduce((s, it) => s + Math.max(1, it.quantity || 1), 0);
    const verb = totalQty > 1 ? 'seront prêts' : 'sera prête';
    const nextHour = this.formatHourMinute(nextFinPrevue);
    const title = previousFinPrevue
      ? `Du temps en plus : ${dishes} ${verb} vers ${nextHour} au lieu de ${this.formatHourMinute(previousFinPrevue)}`
      : `Du temps en plus : ${dishes} ${verb} vers ${nextHour}`;
    return this.createOrderNotification({
      order,
      type: 'TEMPS_AJOUTE',
      severity: 'WARNING',
      title,
      importantAlert: false,
    });
  }

  async notifyUnavailableDishes(
    order: NotificationOrderContext,
    unavailableDishNames: string[],
    reason: string,
  ) {
    const cleanReason = reason.trim();
    const namesPart = this.formatUnavailableDishNames(unavailableDishNames);
    const verb =
      unavailableDishNames.length > 1
        ? 'ne sont plus disponibles'
        : "n'est plus disponible";
    const title = `Plat manquant : ${namesPart} ${verb}. Motif : ${cleanReason}. Que voulez-vous faire ?`;
    return this.createOrderNotification({
      order,
      type: 'PLAT_MANQUANT',
      severity: 'CRITICAL',
      title,
      importantAlert: true,
    });
  }

  async notifyOrderReady(order: NotificationOrderContext) {
    const activeItems = (order.items || []).filter((it) => !it.isUnavailable);
    const dishes = this.formatDishesWithQuantities(
      activeItems.length > 0 ? activeItems : order.items,
    );
    const title = `Prête à servir : ${dishes}`;
    return this.createOrderNotification({
      order,
      type: 'PRETE',
      severity: 'SUCCESS',
      title,
      importantAlert: true,
    });
  }

  async notifyOrderCancelled(order: NotificationOrderContext, reason: string) {
    const dishes = this.formatDishesWithQuantities(order.items);
    const title = `Commande annulée : ${dishes}. Motif : ${reason.trim()}`;
    return this.createOrderNotification({
      order,
      type: 'COMMANDE_ANNULEE',
      severity: 'CRITICAL',
      title,
      importantAlert: false,
    });
  }

  async checkOverdueOrders(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - LATE_THRESHOLD_MS);
    const staleWindowStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
    const overdueOrders = await this.prisma.restaurantOrder.findMany({
      where: {
        status: { in: ['IN_PREPARATION', 'EN_PREPARATION'] },
        heureFinPrevue: { not: null, lte: cutoff, gte: staleWindowStart },
      },
      include: {
        lines: true,
        room: { select: { number: true } },
        reservation: { include: { guest: { select: { fullName: true } } } },
      },
    });
    if (overdueOrders.length === 0) return 0;

    const existingRetards = await this.prisma.notificationMessage.findMany({
      where: {
        orderId: { in: overdueOrders.map((o) => o.id) },
        type: 'RETARD',
      },
      select: { orderId: true },
    });
    const alreadyNotified = new Set(existingRetards.map((r) => r.orderId).filter(Boolean));

    let createdCount = 0;
    for (const o of overdueOrders) {
      if (alreadyNotified.has(o.id) || !o.heureFinPrevue) continue;
      const dueDate = new Date(o.heureFinPrevue);
      const lateMinutes = Math.max(1, Math.floor((now.getTime() - dueDate.getTime()) / 60_000));
      const items = (o.lines || [])
        .filter((l) => !l.isUnavailable)
        .map((l) => ({ name: l.name, quantity: l.quantity }));
      const usedItems =
        items.length > 0
          ? items
          : (o.lines || []).map((l) => ({ name: l.name, quantity: l.quantity }));
      const dishes = this.formatDishesWithQuantities(usedItems);
      const title = `En retard de ${lateMinutes} min : ${dishes} devait être prêt à ${this.formatHourMinute(dueDate)}`;

      const inserted = await this.createOrderNotification({
        order: {
          id: o.id,
          ticketNumber: o.ticketNumber,
          destinationType: o.destinationType,
          roomNumber: o.room?.number || null,
          tableLabel: o.tableLabel || null,
          guestName: o.guestName || o.reservation?.guest?.fullName || null,
          items: usedItems,
        },
        type: 'RETARD',
        severity: 'WARNING',
        title,
        importantAlert: false,
      });
      if (inserted) createdCount += 1;
    }
    return createdCount;
  }

  async listForUser(user: any): Promise<NotificationsListResponse> {
    this.assertCanAccessNotifications(user);

    const nowMs = Date.now();
    if (nowMs - this.lastOverdueCheckAt > 4_000) {
      this.lastOverdueCheckAt = nowMs;
      await this.checkOverdueOrders(new Date(nowMs)).catch(() => 0);
    }

    const since = new Date(nowMs - ONE_DAY_MS);
    const userRole = String(normalizeLegacyRole(user?.role || '')).toUpperCase();
    const whereVisible: any =
      userRole === 'DIRECTION' || userRole === 'RECEPTION'
        ? {
            createdAt: { gte: since },
            OR: [
              { category: 'RESTAURANT' },
              { category: 'MAINTENANCE', targetRoles: { has: userRole } },
            ],
          }
        : {
            category: 'RESTAURANT',
            createdAt: { gte: since },
          };

    const [rows, totalLast24h, unreadCount] = await Promise.all([
      this.prisma.notificationMessage.findMany({
        where: whereVisible,
        orderBy: { createdAt: 'desc' },
        take: MAX_PANEL_MESSAGES,
        include: {
          reads: {
            where: { userId: user.id },
            select: { readAt: true },
          },
        },
      }),
      this.prisma.notificationMessage.count({
        where: whereVisible,
      }),
      this.prisma.notificationMessage.count({
        where: {
          ...whereVisible,
          reads: { none: { userId: user.id } },
        },
      }),
    ]);

    return {
      items: rows.map((row) => this.formatNotificationForUser(row, user)),
      unreadCount,
      totalLast24h,
    };
  }

  async markRead(notificationId: string, user: any): Promise<{ ok: true; id: string; readAt: string }> {
    this.assertCanAccessNotifications(user);
    const exists = await this.prisma.notificationMessage.findUnique({
      where: { id: notificationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Message de notification introuvable.');
    }

    const now = new Date();
    const record = await this.prisma.notificationRead.upsert({
      where: {
        notificationId_userId: {
          notificationId,
          userId: user.id,
        },
      },
      create: {
        notificationId,
        userId: user.id,
        readAt: now,
      },
      update: {
        readAt: now,
      },
    });

    const readAtIso = record.readAt.toISOString();
    this.emitBufferedEvent({
      type: 'NOTIFICATION_READ',
      targetUserId: user.id,
      notificationId,
      readAt: readAtIso,
    });

    return { ok: true, id: notificationId, readAt: readAtIso };
  }

  async markAllRead(user: any): Promise<{ ok: true; markedCount: number; readAt: string }> {
    this.assertCanAccessNotifications(user);
    const now = new Date();
    const since = new Date(now.getTime() - ONE_DAY_MS);
    const unread = await this.prisma.notificationMessage.findMany({
      where: {
        category: 'RESTAURANT',
        createdAt: { gte: since },
        reads: { none: { userId: user.id } },
      },
      select: { id: true },
    });

    if (unread.length > 0) {
      await this.prisma.notificationRead.createMany({
        data: unread.map((m) => ({
          notificationId: m.id,
          userId: user.id,
          readAt: now,
        })),
        skipDuplicates: true,
      });
    }

    const readAtIso = now.toISOString();
    this.emitBufferedEvent({
      type: 'NOTIFICATIONS_READ_ALL',
      targetUserId: user.id,
      readAt: readAtIso,
    });

    return { ok: true, markedCount: unread.length, readAt: readAtIso };
  }

  getUserStream(user: any, lastEventId?: number): Observable<NotificationStreamEvent> {
    this.assertCanAccessNotifications(user);

    const isRelevantForUser = (evt: BufferedNotificationEvent): boolean => {
      if (evt.type === 'NOTIFICATION_CREATED') {
        if (evt.rawMessage?.category === 'MAINTENANCE') {
          const targets: string[] = Array.isArray(evt.rawMessage.targetRoles)
            ? evt.rawMessage.targetRoles
            : [];
          const normalizedRole = String(normalizeLegacyRole(user?.role || '')).toUpperCase();
          return targets.includes(normalizedRole);
        }
        return true;
      }
      return evt.targetUserId === user.id;
    };

    const toClientEvent = (evt: BufferedNotificationEvent): NotificationStreamEvent => {
      if (evt.type === 'NOTIFICATION_CREATED' && evt.rawMessage) {
        return {
          eventId: evt.eventId,
          type: 'NOTIFICATION_CREATED',
          notification: this.formatNotificationForUser(evt.rawMessage, user, null),
          timestamp: evt.timestamp,
        };
      }
      return {
        eventId: evt.eventId,
        type: evt.type,
        notificationId: evt.notificationId,
        readAt: evt.readAt,
        timestamp: evt.timestamp,
      };
    };

    const replayEvents =
      typeof lastEventId === 'number' && !Number.isNaN(lastEventId)
        ? this.recentEventsBuffer.filter(
            (evt) => evt.eventId > lastEventId && isRelevantForUser(evt),
          )
        : [];

    const live$ = this.events$
      .asObservable()
      .pipe(filter(isRelevantForUser), map(toClientEvent));

    if (replayEvents.length > 0) {
      return concat(from(replayEvents.map(toClientEvent)), live$);
    }
    return live$;
  }
}
