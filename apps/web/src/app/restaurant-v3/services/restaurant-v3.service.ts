import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DishCategory,
  DishItem,
  OutboxItem,
  RestaurantDestinationType,
  RestaurantInStayRoom,
  RestaurantMenuCatalog,
  RestaurantOrderV3,
  RestaurantOrdersPage,
  Role,
  SyncStatus,
  isKitchenOnlyRole,
} from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { IdbService } from '../../core/offline/idb.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';

export interface AssistantNotificationBanner {
  id: string;
  orderId: string;
  type: string;
  title: string;
  message: string;
  createdAt: string;
}

export interface CreateOrderRequestPayload {
  ticketNumber: string;
  destinationType: RestaurantDestinationType;
  tableLabel?: string;
  roomId?: string;
  roomNumber?: string;
  reservationId?: string;
  action: 'SEND_TO_KITCHEN' | 'ROOM_CHARGE' | 'PAY';
  paymentMethod?: 'CASH' | 'ORANGE_MONEY' | 'WAVE' | 'CARD' | 'BANK_TRANSFER' | 'ROOM_CHARGE';
  paymentRef?: string;
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPriceFcfa: number;
    notes?: string;
    prepStation: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class RestaurantV3Service {
  private readonly authService = inject(AuthService, { optional: true });
  private readonly idb = inject(IdbService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });
  private readonly outbox = inject(OutboxService, { optional: true });

  private catalogAbort: AbortController | null = null;
  private ordersAbort: AbortController | null = null;
  private sseAbort: AbortController | null = null;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private syncingOutbox = false;
  private lastSseEventId: number | null = null;
  private userInteracted = false;
  private initialOrderEventsLoaded = false;
  private readonly seenOrderEventIds = new Set<string>();

  readonly categories = signal<DishCategory[]>([]);
  readonly products = signal<DishItem[]>([]);
  readonly roomsInStay = signal<RestaurantInStayRoom[]>([]);
  readonly ordersPage = signal<RestaurantOrdersPage>({
    items: [],
    total: 0,
    offset: 0,
    limit: 50,
    hasMore: false,
  });
  readonly kitchenOrders = signal<RestaurantOrderV3[]>([]);
  readonly staleOrders = signal<RestaurantOrderV3[]>([]);
  readonly pendingOfflineOrders = signal<RestaurantOrderV3[]>([]);

  readonly loadingCatalog = signal<boolean>(false);
  readonly loadingOrders = signal<boolean>(false);
  readonly loadingMoreOrders = signal<boolean>(false);
  readonly busyAction = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly sseConnected = signal<boolean>(false);
  readonly soundEnabled = signal<boolean>(true);
  readonly kitchenNewOrderNotice = signal<string | null>(null);
  readonly assistantNotifications = signal<AssistantNotificationBanner[]>([]);

  readonly currentRole = computed<string>(() => this.authService?.currentRole() || '');
  readonly isDirection = computed<boolean>(() => this.currentRole() === Role.DIRECTION);
  readonly isKitchenOnly = computed<boolean>(() => isKitchenOnlyRole(this.currentRole()));
  canCancelOrder(order?: RestaurantOrderV3): boolean {
    const role = this.currentRole();
    const isDirOrRec = role === Role.DIRECTION || role === Role.RECEPTION;
    if (!order) {
      return isDirOrRec;
    }
    if (order.syncPending) return false;
    const st = order.status;
    const isPending = st === 'PENDING' || st === 'SENT_TO_KITCHEN' || st === 'ENVOYEE';
    const isAccepted =
      st === 'CONFIRMED' ||
      st === 'CONFIRMEE' ||
      st === 'IN_PREPARATION' ||
      st === 'EN_PREPARATION';
    if (isPending) {
      return isDirOrRec || role === Role.RESTAURANT || role === Role.SERVEUR;
    }
    if (isAccepted) {
      return (
        isDirOrRec ||
        ((role === Role.RESTAURANT || role === Role.SERVEUR) && Boolean(order.hasUnavailableItems))
      );
    }
    return false;
  }
  readonly canReadOnly = computed<boolean>(() => this.currentRole() === Role.COMPTABLE);
  readonly canTakeOrders = computed<boolean>(() => {
    const role = this.currentRole();
    return (
      role === Role.DIRECTION ||
      role === Role.RECEPTION ||
      role === Role.RESTAURANT ||
      role === Role.SERVEUR
    );
  });
  readonly isOnline = computed<boolean>(() => (this.network ? this.network.isOnline() : true));

  readonly readyOrdersList = computed<RestaurantOrderV3[]>(() => {
    const byId = new Map<string, RestaurantOrderV3>();
    for (const o of this.ordersPage().items) {
      if (o.status === 'READY' || o.statut === 'PRETE') byId.set(o.id, o);
    }
    for (const o of this.kitchenOrders()) {
      if (o.status === 'READY' || o.statut === 'PRETE') byId.set(o.id, o);
    }
    return Array.from(byId.values());
  });

  readonly readyOrdersCount = computed<number>(() => this.readyOrdersList().length);

  readonly pendingKitchenOrdersCount = computed<number>(() => {
    const byId = new Map<string, RestaurantOrderV3>();
    for (const o of this.ordersPage().items) {
      if (!o.syncPending && (o.status === 'PENDING' || o.status === 'SENT_TO_KITCHEN' || o.statut === 'ENVOYEE')) {
        byId.set(o.id, o);
      }
    }
    for (const o of this.kitchenOrders()) {
      if (o.status === 'PENDING' || o.status === 'SENT_TO_KITCHEN' || o.statut === 'ENVOYEE') {
        byId.set(o.id, o);
      }
    }
    return byId.size;
  });

  constructor() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', () => {
        setTimeout(() => {
          void this.syncOfflineOrders();
        }, 50);
      });
      const markInteracted = () => {
        this.userInteracted = true;
      };
      window.addEventListener('pointerdown', markInteracted, { once: true });
      window.addEventListener('keydown', markInteracted, { once: true });
    }
  }

  toggleSound(): void {
    this.userInteracted = true;
    this.soundEnabled.update((v) => !v);
  }

  dismissAssistantNotification(id: string): void {
    this.assistantNotifications.update((list) => list.filter((n) => n.id !== id));
  }

  private pushAssistantNotificationsForOrder(order?: RestaurantOrderV3): void {
    if (!order || this.isKitchenOnly()) return;
    const events = order.events || [];
    if (events.length === 0) return;

    const dest =
      order.destinationType === 'ROOM' && order.roomNumber
        ? `Chambre ${order.roomNumber}`
        : order.destinationLabel || 'Table 1';
    const guest = order.guestName || '';
    const targetTitle = guest ? `${dest}, ${guest}` : dest;

    const notifiableTypes = new Set([
      'CONFIRMEE',
      'TEMPS_PREPARATION',
      'TEMPS_AJOUTE',
      'PLAT_INDISPONIBLE',
      'PRETE',
    ]);

    const newBanners: AssistantNotificationBanner[] = [];
    for (const ev of events) {
      if (!ev.id || this.seenOrderEventIds.has(ev.id)) continue;
      this.seenOrderEventIds.add(ev.id);
      if (!notifiableTypes.has(ev.type)) continue;

      let message = ev.detail;
      if (ev.type === 'PRETE') {
        const activeItems = (order.items || []).filter((i) => !i.isUnavailable);
        const itemsForMsg = activeItems.length > 0 ? activeItems : order.items || [];
        const dishes = itemsForMsg.map((i) => `${i.quantity} ${i.name}`).join(', ');
        const totalQty = itemsForMsg.reduce((s, i) => s + (i.quantity || 1), 0);
        const verb = totalQty > 1 ? 'prêts à servir' : 'prêt à servir';
        message = `${dishes} ${verb} : ${targetTitle}`;
      }

      newBanners.push({
        id: ev.id,
        orderId: order.id,
        type: ev.type,
        title: targetTitle,
        message,
        createdAt: ev.createdAt,
      });
    }

    if (newBanners.length > 0) {
      this.assistantNotifications.update((prev) => [...newBanners, ...prev].slice(0, 15));
      const hasReady = newBanners.some((b) => b.type === 'PRETE');
      this.playNotificationTone(hasReady ? 'ORDER_READY' : 'NEW_ORDER');
    }
  }

  playNotificationTone(kind: 'NEW_ORDER' | 'ORDER_READY' = 'NEW_ORDER'): void {
    if (!this.soundEnabled() || !this.userInteracted || typeof window === 'undefined') return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(kind === 'ORDER_READY' ? 880 : 660, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Ignorer si AudioContext est bloqué
    }
  }

  private async openRestaurantCacheDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open('residence_blue_restaurant_cache', 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async putCache<T extends { id: string }>(value: T): Promise<void> {
    const db = await this.openRestaurantCacheDb();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction('cache', 'readwrite');
        tx.objectStore('cache').put(value);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  private async getCache<T>(id: string): Promise<T | undefined> {
    const db = await this.openRestaurantCacheDb();
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve) => {
      try {
        const tx = db.transaction('cache', 'readonly');
        const req = tx.objectStore('cache').get(id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  }

  private authHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      ...(this.authService ? this.authService.getAuthHeaders() : {}),
      ...(extra || {}),
    };
  }

  private async apiFetch(url: string, init: RequestInit): Promise<Response> {
    if (this.authService) {
      return this.authService.authenticatedFetch(url, init);
    }
    return fetch(url, { credentials: 'include', ...init });
  }

  private async extractError(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      if (Array.isArray(body?.message)) {
        return body.message.join(' • ');
      }
      if (typeof body?.message === 'string' && body.message.trim()) {
        return body.message;
      }
    } catch {
      // Ignorer
    }
    return fallback;
  }

  generateUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  async refreshPendingOfflineOrders(): Promise<void> {
    if (!this.idb) return;
    try {
      const items = await this.idb.getAll<OutboxItem<CreateOrderRequestPayload>>('outbox');
      const pending = items
        .filter(
          (i) =>
            i.type === 'RESTAURANT_ORDER' &&
            (i.status === SyncStatus.PENDING || i.status === SyncStatus.FAILED),
        )
        .map((i): RestaurantOrderV3 => {
          const p = i.payload;
          const total = p.items.reduce((s, it) => s + it.unitPriceFcfa * it.quantity, 0);
          return {
            id: i.id,
            ticketNumber: p.ticketNumber,
            serverName: 'Hors ligne',
            time: new Date(i.createdAt).toISOString(),
            createdAt: new Date(i.createdAt).toISOString(),
            updatedAt: new Date(i.createdAt).toISOString(),
            destinationType: p.destinationType,
            destinationValue: p.roomNumber || p.tableLabel || 'À emporter',
            destinationLabel:
              p.destinationType === 'ROOM'
                ? `Ch. ${p.roomNumber || ''}`
                : p.destinationType === 'TAKEAWAY'
                  ? 'À emporter'
                  : p.tableLabel || 'Table 1',
            roomNumber: p.roomNumber || null,
            guestName: p.destinationType === 'ROOM' ? 'Client séjour' : 'Client de passage',
            status: 'PENDING',
            paymentMethod: p.paymentMethod || null,
            totalTtcFcfa: total,
            items: p.items.map((it, idx) => ({
              id: `${i.id}-${idx}`,
              dishId: it.productId,
              productId: it.productId,
              name: it.name,
              quantity: it.quantity,
              unitPriceFcfa: it.unitPriceFcfa,
              totalPriceFcfa: it.unitPriceFcfa * it.quantity,
              notes: it.notes,
              prepStation: it.prepStation,
            })),
            syncPending: true,
          };
        });
      this.pendingOfflineOrders.set(pending);
    } catch {
      this.pendingOfflineOrders.set([]);
    }
  }

  async loadCatalog(): Promise<void> {
    this.catalogAbort?.abort();
    const controller = new AbortController();
    this.catalogAbort = controller;
    this.loadingCatalog.set(true);

    try {
      if (!this.isOnline()) {
        throw new Error('offline');
      }
      const res = await this.apiFetch('/api/restaurant/catalog', {
        method: 'GET',
        headers: this.authHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Impossible de charger la carte.'));
        return;
      }
      const data = (await res.json()) as RestaurantMenuCatalog;
      this.categories.set(data.categories || []);
      this.products.set(data.products || []);
      this.roomsInStay.set(data.roomsInStay || []);
      void this.putCache({ id: 'catalog', ...data });
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const cached = await this.getCache<RestaurantMenuCatalog & { id: string }>('catalog');
      if (cached) {
        this.categories.set(cached.categories || []);
        this.products.set(cached.products || []);
        this.roomsInStay.set(cached.roomsInStay || []);
      } else {
        this.errorMessage.set('Carte indisponible hors ligne sans cache préalable.');
      }
    } finally {
      if (this.catalogAbort === controller) {
        this.loadingCatalog.set(false);
      }
    }
  }

  async loadOrdersPage(params: {
    status?: string;
    destinationType?: string;
    search?: string;
    offset?: number;
    limit?: number;
  } = {}): Promise<void> {
    this.ordersAbort?.abort();
    const controller = new AbortController();
    this.ordersAbort = controller;
    this.loadingOrders.set(true);

    await this.refreshPendingOfflineOrders();

    try {
      if (!this.isOnline()) {
        throw new Error('offline');
      }
      const qs = new URLSearchParams();
      qs.set('offset', String(Math.max(0, params.offset ?? 0)));
      qs.set('limit', String(Math.min(50, Math.max(1, params.limit ?? 50))));
      if (params.status) qs.set('status', params.status);
      if (params.destinationType) qs.set('destinationType', params.destinationType);
      if (params.search?.trim()) qs.set('search', params.search.trim());

      const res = await this.apiFetch(`/api/restaurant/orders/page?${qs.toString()}`, {
        method: 'GET',
        headers: this.authHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, 'Impossible de charger les commandes du service.'),
        );
        return;
      }
      const data = (await res.json()) as RestaurantOrdersPage;
      if (!this.initialOrderEventsLoaded) {
        this.initialOrderEventsLoaded = true;
        for (const ord of data.items || []) {
          for (const ev of ord.events || []) {
            if (ev.id) this.seenOrderEventIds.add(ev.id);
          }
        }
      } else {
        for (const ord of data.items || []) {
          this.pushAssistantNotificationsForOrder(ord);
        }
      }
      this.ordersPage.set(data);
      if ((params.offset ?? 0) === 0 && !params.search && !params.status && !params.destinationType) {
        void this.putCache({ id: 'orders-page', ...data });
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      const cached = await this.getCache<RestaurantOrdersPage & { id: string }>('orders-page');
      if (cached) {
        this.ordersPage.set(cached);
      }
    } finally {
      if (this.ordersAbort === controller) {
        this.loadingOrders.set(false);
      }
    }
  }

  async loadMoreOrders(params: {
    status?: string;
    destinationType?: string;
    search?: string;
  } = {}): Promise<void> {
    const current = this.ordersPage();
    if (!current.hasMore || this.loadingMoreOrders() || this.loadingOrders()) return;

    this.loadingMoreOrders.set(true);
    try {
      const qs = new URLSearchParams();
      qs.set('offset', String(current.items.length));
      qs.set('limit', '50');
      if (params.status) qs.set('status', params.status);
      if (params.destinationType) qs.set('destinationType', params.destinationType);
      if (params.search?.trim()) qs.set('search', params.search.trim());

      const res = await this.apiFetch(`/api/restaurant/orders/page?${qs.toString()}`, {
        method: 'GET',
        headers: this.authHeaders(),
      });
      if (!res.ok) return;
      const next = (await res.json()) as RestaurantOrdersPage;
      const merged = [...current.items, ...next.items].filter(
        (item, idx, arr) => arr.findIndex((x) => x.id === item.id) === idx,
      );
      this.ordersPage.set({
        items: merged,
        total: next.total,
        offset: next.offset,
        limit: next.limit,
        hasMore: next.hasMore,
      });
    } finally {
      this.loadingMoreOrders.set(false);
    }
  }

  async submitOrder(payload: CreateOrderRequestPayload): Promise<boolean> {
    this.clearMessages();
    if (payload.paymentMethod === 'CARD' && !this.isOnline()) {
      this.errorMessage.set("L'encaissement par carte est indisponible hors ligne.");
      return false;
    }

    const idempotencyKey = this.generateUuid();
    this.busyAction.set(true);
    try {
      if (!this.isOnline()) {
        if (!this.outbox) {
          this.errorMessage.set('Service hors ligne indisponible.');
          return false;
        }
        await this.outbox.enqueue('RESTAURANT_ORDER', '/api/restaurant/orders', payload);
        await this.refreshPendingOfflineOrders();
        this.successMessage.set(
          'Hors ligne : commande enregistrée localement (En attente de synchronisation).',
        );
        return true;
      }

      const res = await this.apiFetch('/api/restaurant/orders', {
        method: 'POST',
        headers: this.authHeaders({
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, "Impossible d'enregistrer la commande."),
        );
        return false;
      }

      const created = (await res.json()) as RestaurantOrderV3;
      this.successMessage.set(
        payload.action === 'ROOM_CHARGE'
          ? `Commande ${created.ticketNumber} ajoutée à la note de la chambre et envoyée en cuisine.`
          : payload.action === 'PAY'
            ? `Commande ${created.ticketNumber} encaissée (« Client de passage »).`
            : `Commande ${created.ticketNumber} envoyée en cuisine.`,
      );
      await this.loadOrdersPage();
      return true;
    } catch {
      // Fallback hors ligne si coupure réseau pendant la requête
      if (this.outbox && payload.paymentMethod !== 'CARD') {
        await this.outbox.enqueue('RESTAURANT_ORDER', '/api/restaurant/orders', payload);
        await this.refreshPendingOfflineOrders();
        this.successMessage.set(
          'Connexion interrompue : commande placée en file locale (En attente de synchronisation).',
        );
        return true;
      }
      this.errorMessage.set(
        payload.paymentMethod === 'CARD'
          ? "L'encaissement par carte est indisponible hors ligne."
          : 'Erreur réseau lors de la création de commande.',
      );
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async syncOfflineOrders(): Promise<void> {
    if (this.syncingOutbox || !this.outbox || !this.isOnline()) return;
    this.syncingOutbox = true;
    try {
      await this.outbox.syncOutbox();
      await this.refreshPendingOfflineOrders();
      await this.loadOrdersPage();
    } finally {
      this.syncingOutbox = false;
    }
  }

  async updateOrderStatus(
    orderId: string,
    status?: string,
    extra?: {
      prepTimeMinutes?: number;
      addMinutes?: number;
      unavailableLineIds?: string[];
      unavailableReason?: string;
    },
  ): Promise<boolean> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const payload: {
        status?: string;
        prepTimeMinutes?: number;
        addMinutes?: number;
        unavailableLineIds?: string[];
        unavailableReason?: string;
      } = {};
      if (status) payload.status = status;
      if (extra?.prepTimeMinutes !== undefined) payload.prepTimeMinutes = extra.prepTimeMinutes;
      if (extra?.addMinutes !== undefined) payload.addMinutes = extra.addMinutes;
      if (extra?.unavailableLineIds !== undefined) {
        payload.unavailableLineIds = extra.unavailableLineIds;
      }
      if (extra?.unavailableReason !== undefined) {
        payload.unavailableReason = extra.unavailableReason;
      }

      const res = await this.apiFetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}/status`, {
        method: 'PATCH',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Impossible de modifier le statut.'));
        await this.loadKitchenOrders();
        return false;
      }
      if (this.isKitchenOnly()) {
        await this.loadKitchenOrders();
      } else {
        await Promise.all([this.loadOrdersPage(), this.loadKitchenOrders()]);
      }
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors du changement de statut.');
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async modifyOrderItems(
    orderId: string,
    items: Array<{
      productId?: string | null;
      name: string;
      quantity: number;
      unitPriceFcfa?: number;
      notes?: string;
      prepStation?: string;
    }>,
  ): Promise<boolean> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const res = await this.apiFetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}/items`, {
        method: 'PATCH',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, 'Impossible de modifier les plats de la commande.'),
        );
        return false;
      }
      this.successMessage.set('Commande modifiée et transmise à la cuisine.');
      await this.loadOrdersPage();
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la modification de la commande.');
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async loadStaleOrders(): Promise<void> {
    if (!this.isOnline() || !this.canCancelOrder()) return;
    try {
      const res = await this.apiFetch('/api/restaurant/orders/stale', {
        method: 'GET',
        headers: this.authHeaders(),
      });
      if (!res.ok) return;
      const list = (await res.json()) as RestaurantOrderV3[];
      this.staleOrders.set(list || []);
    } catch {
      // Ignorer
    }
  }

  async closeStaleOrder(orderId: string, reason: string): Promise<boolean> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const res = await this.apiFetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}/close-stale`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Clôture refusée.'));
        return false;
      }
      this.successMessage.set('Ancienne commande clôturée et journalisée.');
      await Promise.all([this.loadStaleOrders(), this.loadOrdersPage()]);
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la clôture.');
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async cancelOrder(orderId: string, reason: string): Promise<boolean> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const res = await this.apiFetch(`/api/restaurant/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Annulation refusée.'));
        return false;
      }
      this.successMessage.set('Commande annulée et journalisée.');
      await this.loadOrdersPage();
      return true;
    } catch {
      this.errorMessage.set("Erreur réseau lors de l'annulation.");
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async loadKitchenOrders(): Promise<void> {
    if (!this.isOnline()) return;
    if (!this.isDirection() && !this.isKitchenOnly()) return;
    try {
      const res = await this.apiFetch('/api/restaurant/kitchen/orders', {
        method: 'GET',
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Cuisine inaccessible.'));
        return;
      }
      const list = (await res.json()) as RestaurantOrderV3[];
      this.kitchenOrders.set(
        (list || []).filter(
          (o) =>
            o.status === 'PENDING' ||
            o.status === 'SENT_TO_KITCHEN' ||
            o.status === 'CONFIRMED' ||
            o.status === 'IN_PREPARATION' ||
            o.status === 'READY' ||
            o.status === 'AUTHORIZED',
        ),
      );
    } catch {
      // Secours silencieux : le timer 10 s retente
    }
  }

  /**
   * Flux temps réel SSE via fetch + ReadableStream (en-tête Authorization Bearer, reprise Last-Event-ID).
   */
  connectKitchenStream(
    onEvent?: (evt?: { type?: string; orderId?: string; order?: RestaurantOrderV3 }) => void,
  ): void {
    this.disconnectKitchenStream();
    if (!this.isOnline() || typeof fetch === 'undefined') return;

    const controller = new AbortController();
    this.sseAbort = controller;

    const connectLoop = async () => {
      if (controller.signal.aborted) return;
      try {
        const headers: Record<string, string> = { Accept: 'text/event-stream' };
        if (this.lastSseEventId !== null) {
          headers['Last-Event-ID'] = String(this.lastSseEventId);
        }
        const res = await this.apiFetch('/api/restaurant/orders/stream', {
          method: 'GET',
          headers: this.authHeaders(headers),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          this.sseConnected.set(false);
          this.scheduleSseReconnect(controller, connectLoop);
          return;
        }
        this.sseConnected.set(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const idMatch = frame.match(/^id:\s*(\d+)/m);
            if (idMatch) {
              const parsedId = Number(idMatch[1]);
              if (!Number.isNaN(parsedId)) {
                this.lastSseEventId = parsedId;
              }
            }
            const dataMatch = frame.match(/^data:\s*(.+)$/m);
            let parsedEvt: any = undefined;
            if (dataMatch) {
              try {
                parsedEvt = JSON.parse(dataMatch[1]);
                if (typeof parsedEvt?.eventId === 'number') {
                  this.lastSseEventId = parsedEvt.eventId;
                }
              } catch {
                // Ignorer
              }
            }
            if (frame.includes('ORDER_')) {
              if (parsedEvt?.type === 'ORDER_CREATED') {
                const dest = parsedEvt?.order?.destinationLabel || 'Nouveau ticket';
                this.kitchenNewOrderNotice.set(`Nouvelle commande • ${dest}`);
                this.playNotificationTone('NEW_ORDER');
              } else if (parsedEvt?.type === 'ORDER_UPDATED' && parsedEvt?.order) {
                this.pushAssistantNotificationsForOrder(parsedEvt.order);
              }
              onEvent?.(parsedEvt);
            }
          }
        }
      } catch {
        // Baisse propre sur le polling de secours 10 s et reconnexion auto
      } finally {
        if (this.sseAbort === controller && !controller.signal.aborted) {
          this.sseConnected.set(false);
          this.scheduleSseReconnect(controller, connectLoop);
        }
      }
    };

    void connectLoop();
  }

  private scheduleSseReconnect(controller: AbortController, retryFn: () => Promise<void>): void {
    if (controller.signal.aborted) return;
    if (this.sseReconnectTimer) clearTimeout(this.sseReconnectTimer);
    this.sseReconnectTimer = setTimeout(() => {
      if (!controller.signal.aborted && this.sseAbort === controller) {
        void retryFn();
      }
    }, 3000);
  }

  disconnectKitchenStream(): void {
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    this.sseAbort?.abort();
    this.sseAbort = null;
    this.sseConnected.set(false);
  }

  // --- CARTE (réservée DIRECTION) ---

  async saveProduct(
    productId: string | null,
    payload: {
      name: string;
      categoryId?: string;
      categoryName?: string;
      priceFcfa: number;
      prepStation?: string;
      status?: string;
      description?: string;
    },
    imageFile?: File | null,
  ): Promise<DishItem | null> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const url = productId
        ? `/api/restaurant/products/${encodeURIComponent(productId)}`
        : '/api/restaurant/products';
      const method = productId ? 'PATCH' : 'POST';

      const res = await this.apiFetch(url, {
        method,
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Impossible d’enregistrer le produit.'));
        return null;
      }

      let saved = (await res.json()) as DishItem;

      if (imageFile) {
        const fd = new FormData();
        fd.append('image', imageFile);
        const imgRes = await this.apiFetch(
          `/api/restaurant/products/${encodeURIComponent(saved.id)}/image`,
          {
            method: 'POST',
            headers: this.authHeaders(),
            body: fd,
          },
        );
        if (!imgRes.ok) {
          this.errorMessage.set(
            await this.extractError(
              imgRes,
              'Produit enregistré mais la photo a été rejetée (JPEG/PNG/WebP ≤ 2 Mo requis).',
            ),
          );
          await this.loadCatalog();
          return saved;
        }
        saved = (await imgRes.json()) as DishItem;
      }

      this.successMessage.set(
        productId ? `Produit « ${saved.name} » mis à jour.` : `Produit « ${saved.name} » ajouté à la carte.`,
      );
      await this.loadCatalog();
      return saved;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la sauvegarde du produit.');
      return null;
    } finally {
      this.busyAction.set(false);
    }
  }

  async toggleProductStatus(product: DishItem, nextStatus: 'AVAILABLE' | 'SOLD_OUT' | 'ARCHIVED'): Promise<boolean> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const res = await this.apiFetch(`/api/restaurant/products/${encodeURIComponent(product.id)}`, {
        method: 'PATCH',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Mise à jour impossible.'));
        return false;
      }
      await this.loadCatalog();
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la mise à jour du produit.');
      return false;
    } finally {
      this.busyAction.set(false);
    }
  }

  async deleteProductImage(productId: string): Promise<boolean> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const res = await this.apiFetch(`/api/restaurant/products/${encodeURIComponent(productId)}/image`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Suppression photo impossible.'));
        return false;
      }
      await this.loadCatalog();
      return true;
    } finally {
      this.busyAction.set(false);
    }
  }

  async deleteProduct(productId: string): Promise<{ ok: boolean; conflict409: boolean }> {
    this.clearMessages();
    this.busyAction.set(true);
    try {
      const res = await this.apiFetch(`/api/restaurant/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      if (res.status === 409) {
        this.errorMessage.set(
          await this.extractError(
            res,
            'Ce produit a un historique de commandes : cliquez sur « Désactiver » pour le retirer.',
          ),
        );
        return { ok: false, conflict409: true };
      }
      if (!res.ok) {
        this.errorMessage.set(await this.extractError(res, 'Suppression impossible.'));
        return { ok: false, conflict409: false };
      }
      this.successMessage.set('Produit supprimé de la carte.');
      await this.loadCatalog();
      return { ok: true, conflict409: false };
    } catch {
      this.errorMessage.set('Erreur réseau lors de la suppression.');
      return { ok: false, conflict409: false };
    } finally {
      this.busyAction.set(false);
    }
  }
}
