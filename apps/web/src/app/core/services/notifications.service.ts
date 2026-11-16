import { Injectable, computed, effect, inject, signal } from '@angular/core';
import {
  AppNotificationDto,
  NotificationStreamEvent,
  NotificationsListResponse,
  hasScreenAccess,
  isDirectorAccount,
  isKitchenAccount,
  normalizeLegacyRole,
} from '@residence-blue/shared';
import { AuthService } from './auth.service';
import { RoomsService } from './rooms.service';
import { NetworkService } from '../offline/network.service';
import { OutboxService } from '../offline/outbox.service';

const SOUND_PREF_KEY = 'rb_room_alert_sound_enabled';
const NOTIFICATIONS_CACHE_DB = 'residence_blue_notifications_cache';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_MESSAGES = 50;
const IMPORTANT_POPUP_DURATION_MS = 8000;

interface CachedNotificationsPayload {
  key: string;
  items: AppNotificationDto[];
  unreadCount: number;
  updatedAt: number;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly authService = inject(AuthService, { optional: true });
  private readonly roomsService = inject(RoomsService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });
  private readonly outbox = inject(OutboxService, { optional: true });

  private sseAbort: AbortController | null = null;
  private sseStartTimer: ReturnType<typeof setTimeout> | null = null;
  private sseReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
  private popupTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEventId: number | null = null;
  private activeUserId: string | null = null;
  private initialLoaded = false;
  private readonly seenIds = new Set<string>();
  private readonly seenPopupIds = new Set<string>();

  readonly serverMessages = signal<AppNotificationDto[]>([]);
  readonly unreadServerCount = signal<number>(0);
  readonly sseConnected = signal<boolean>(false);
  readonly activeImportantAlert = signal<AppNotificationDto | null>(null);
  readonly userInteracted = signal<boolean>(false);
  readonly soundEnabled = signal<boolean>(this.readSoundPreference());
  readonly soundPlayedCount = signal<number>(0);
  readonly lastSoundPlayedType = signal<string | null>(null);
  readonly liveAnnouncement = signal<string>('');

  readonly canReceiveOrderNotifications = computed<boolean>(() => {
    const user = this.authService?.currentUser();
    if (!user || isKitchenAccount(user)) return false;
    if (!hasScreenAccess(user, 'restaurant', 'LECTURE')) return false;
    if (isDirectorAccount(user)) return true;
    const role = normalizeLegacyRole(user.role);
    return role === 'DIRECTION' || role === 'RECEPTION' || role === 'RESTAURANT';
  });

  readonly canReceiveRoomAlerts = computed<boolean>(() => {
    const user = this.authService?.currentUser();
    if (!user || isKitchenAccount(user)) return false;
    return Boolean(this.roomsService?.canReceiveRoomAlerts());
  });

  readonly canShowBell = computed<boolean>(
    () => this.canReceiveOrderNotifications() || this.canReceiveRoomAlerts(),
  );

  readonly allMessages = computed<AppNotificationDto[]>(() => {
    const cutoff = Date.now() - ONE_DAY_MS;
    const orderMsgs = this.canReceiveOrderNotifications()
      ? this.serverMessages().filter((m) => {
          const ts = new Date(m.createdAt).getTime();
          return !Number.isNaN(ts) && ts >= cutoff;
        })
      : [];

    const roomMsgs: AppNotificationDto[] = this.canReceiveRoomAlerts()
      ? (this.roomsService?.roomAlerts() ?? [])
          .filter((a) => {
            const ts = new Date(a.timestamp).getTime();
            return !Number.isNaN(ts) && ts >= cutoff;
          })
          .map((a) => ({
            id: `room-${a.id}`,
            category: 'HOUSEKEEPING',
            type: a.status === 'MAINTENANCE' ? 'CHAMBRE_PROBLEME' : 'CHAMBRE_PROPRE',
            severity: a.status === 'MAINTENANCE' ? 'WARNING' : 'SUCCESS',
            title: a.message,
            detail: `Chambre ${a.roomNumber}`,
            roomNumber: a.roomNumber,
            link: '/planning',
            importantAlert: false,
            read: a.read,
            readAt: a.read ? a.timestamp : null,
            createdAt: a.timestamp,
          }))
      : [];

    return [...orderMsgs, ...roomMsgs]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, MAX_MESSAGES);
  });

  readonly unreadMessages = computed<AppNotificationDto[]>(() =>
    this.allMessages().filter((m) => !m.read),
  );

  readonly olderMessages = computed<AppNotificationDto[]>(() =>
    this.allMessages().filter((m) => m.read),
  );

  readonly unreadCount = computed<number>(() => {
    const serverUnread = this.canReceiveOrderNotifications() ? this.unreadServerCount() : 0;
    const roomUnread = this.canReceiveRoomAlerts()
      ? (this.roomsService?.unreadAlertsCount() ?? 0)
      : 0;
    return Math.max(0, serverUnread + roomUnread);
  });

  readonly badgeLabel = computed<string>(() => {
    const count = this.unreadCount();
    if (count <= 0) return '';
    return count > 9 ? '9+' : String(count);
  });

  constructor() {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      const markInteracted = () => {
        this.userInteracted.set(true);
      };
      window.addEventListener('pointerdown', markInteracted, { once: true, passive: true });
      window.addEventListener('keydown', markInteracted, { once: true, passive: true });
      window.addEventListener('online', () => {
        if (this.canReceiveOrderNotifications()) {
          void this.loadNotifications();
        }
      });
    }

    effect(() => {
      const user = this.authService?.currentUser() ?? null;
      const canOrders = this.canReceiveOrderNotifications();
      const userId = user?.id ?? null;

      if (!user || !canOrders) {
        if (this.activeUserId !== null) {
          this.resetSessionState();
        }
        return;
      }

      if (this.activeUserId !== userId) {
        this.resetSessionState();
        this.activeUserId = userId;
        void this.bootstrapForAuthenticatedUser();
      }
    });
  }

  private readSoundPreference(): boolean {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(SOUND_PREF_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeSoundPreference(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SOUND_PREF_KEY, String(enabled));
    } catch {
      // Ignorer si le stockage local est indisponible
    }
  }

  toggleSound(): boolean {
    this.userInteracted.set(true);
    const next = !this.soundEnabled();
    this.soundEnabled.set(next);
    this.writeSoundPreference(next);
    if (this.roomsService && this.roomsService.soundEnabled() !== next) {
      this.roomsService.soundEnabled.set(next);
    }
    return next;
  }

  private isOnline(): boolean {
    return this.network ? this.network.isOnline() : true;
  }

  private authHeaders(): Record<string, string> {
    return this.authService ? this.authService.getAuthHeaders() : {};
  }

  private async apiFetch(input: string, init?: RequestInit): Promise<Response> {
    if (this.authService) {
      return this.authService.authenticatedFetch(input, init);
    }
    return fetch(input, { credentials: 'include', ...(init ?? {}) });
  }

  private async bootstrapForAuthenticatedUser(): Promise<void> {
    const cached = await this.readCache();
    if (cached) {
      this.serverMessages.set(cached.items);
      this.unreadServerCount.set(cached.unreadCount);
      for (const item of cached.items) {
        this.seenIds.add(item.id);
        this.seenPopupIds.add(item.id);
      }
    }

    await this.loadNotifications();

    if (typeof window !== 'undefined') {
      if (!this.sseStartTimer && !this.sseAbort) {
        this.sseStartTimer = setTimeout(() => {
          this.sseStartTimer = null;
          if (this.canReceiveOrderNotifications() && this.authService?.isAuthenticated()) {
            this.connectStream();
          }
        }, 4000);
      }
      if (!this.fallbackPollTimer) {
        this.fallbackPollTimer = setInterval(() => {
          if (!this.sseConnected() && this.isOnline() && this.canReceiveOrderNotifications()) {
            void this.loadNotifications();
          }
        }, 12_000);
      }
    }
  }

  resetSessionState(): void {
    this.activeUserId = null;
    this.initialLoaded = false;
    this.lastEventId = null;
    this.seenIds.clear();
    this.seenPopupIds.clear();
    this.serverMessages.set([]);
    this.unreadServerCount.set(0);
    this.liveAnnouncement.set('');
    this.dismissImportantAlert();
    this.stopRealtime();
  }

  stopRealtime(): void {
    if (this.sseStartTimer) {
      clearTimeout(this.sseStartTimer);
      this.sseStartTimer = null;
    }
    if (this.sseReconnectTimer) {
      clearTimeout(this.sseReconnectTimer);
      this.sseReconnectTimer = null;
    }
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
    this.sseAbort?.abort();
    this.sseAbort = null;
    this.sseConnected.set(false);
  }

  async loadNotifications(): Promise<void> {
    if (!this.canReceiveOrderNotifications()) return;
    if (!this.isOnline() || typeof fetch === 'undefined') return;

    try {
      const res = await this.apiFetch('/api/notifications', {
        method: 'GET',
        headers: this.authHeaders(),
      });
      if (!res.ok) return;
      const data = (await res.json()) as NotificationsListResponse;
      const items = Array.isArray(data.items) ? data.items.slice(0, MAX_MESSAGES) : [];

      if (!this.initialLoaded) {
        this.initialLoaded = true;
        for (const item of items) {
          this.seenIds.add(item.id);
          this.seenPopupIds.add(item.id);
        }
      } else {
        for (const item of items) {
          if (!this.seenIds.has(item.id)) {
            this.seenIds.add(item.id);
            this.handleNewNotificationEffects(item);
          }
        }
      }

      this.serverMessages.set(items);
      this.unreadServerCount.set(Math.max(0, Number(data.unreadCount) || 0));
      void this.writeCache(items, Math.max(0, Number(data.unreadCount) || 0));
    } catch {
      // Conservation du cache local hors ligne
    }
  }

  connectStream(): void {
    this.sseAbort?.abort();
    this.sseAbort = null;
    if (!this.canReceiveOrderNotifications() || !this.isOnline() || typeof fetch === 'undefined') {
      return;
    }
    if (this.authService && !this.authService.isAuthenticated()) return;

    const controller = new AbortController();
    this.sseAbort = controller;

    const connectLoop = async () => {
      if (controller.signal.aborted) return;
      try {
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
          ...this.authHeaders(),
        };
        if (this.lastEventId !== null) {
          headers['Last-Event-ID'] = String(this.lastEventId);
        }
        const res = await fetch('/api/notifications/stream', {
          method: 'GET',
          credentials: 'include',
          headers,
          signal: controller.signal,
        });
        if (res.status === 401 || res.status === 403) {
          this.sseConnected.set(false);
          return;
        }
        if (!res.ok || !res.body) {
          this.sseConnected.set(false);
          this.scheduleReconnect(controller, connectLoop);
          return;
        }

        this.sseConnected.set(true);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
          const frames = buffer.split('\n\n');
          buffer = frames.pop() || '';
          for (const frame of frames) {
            const idMatch = frame.match(/^id:\s*(\d+)/m);
            if (idMatch) {
              const parsedId = Number(idMatch[1]);
              if (!Number.isNaN(parsedId)) {
                this.lastEventId = parsedId;
              }
            }
            const dataMatch = frame.match(/^data:\s*(.+)$/m);
            if (!dataMatch) continue;
            try {
              const evt = JSON.parse(dataMatch[1]) as NotificationStreamEvent;
              if (typeof evt.eventId === 'number') {
                this.lastEventId = evt.eventId;
              }
              this.applyStreamEvent(evt);
            } catch {
              // Trame SSE ignorée
            }
          }
        }
      } catch {
        // Repli automatique sur polling
      } finally {
        if (this.sseAbort === controller && !controller.signal.aborted) {
          this.sseConnected.set(false);
          this.scheduleReconnect(controller, connectLoop);
        }
      }
    };

    void connectLoop();
  }

  private scheduleReconnect(controller: AbortController, retryFn: () => Promise<void>): void {
    if (controller.signal.aborted) return;
    if (this.sseReconnectTimer) clearTimeout(this.sseReconnectTimer);
    this.sseReconnectTimer = setTimeout(() => {
      if (!controller.signal.aborted && this.sseAbort === controller) {
        void retryFn();
      }
    }, 3000);
  }

  applyStreamEvent(evt: NotificationStreamEvent): void {
    if (evt.type === 'NOTIFICATION_CREATED' && evt.notification) {
      const notif = evt.notification;
      const isNew = !this.seenIds.has(notif.id);
      this.seenIds.add(notif.id);
      this.serverMessages.update((prev) => {
        const next = [notif, ...prev.filter((m) => m.id !== notif.id)];
        return next
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, MAX_MESSAGES);
      });
      if (isNew && !notif.read) {
        this.unreadServerCount.update((c) => c + 1);
      }
      if (isNew) {
        this.handleNewNotificationEffects(notif);
      }
      void this.writeCache(this.serverMessages(), this.unreadServerCount());
    } else if (evt.type === 'NOTIFICATION_READ' && evt.notificationId) {
      const readAt = evt.readAt || new Date().toISOString();
      let decremented = false;
      this.serverMessages.update((prev) =>
        prev.map((m) => {
          if (m.id !== evt.notificationId) return m;
          if (!m.read) decremented = true;
          return { ...m, read: true, readAt };
        }),
      );
      if (decremented) {
        this.unreadServerCount.update((c) => Math.max(0, c - 1));
      }
      void this.writeCache(this.serverMessages(), this.unreadServerCount());
    } else if (evt.type === 'NOTIFICATIONS_READ_ALL') {
      const readAt = evt.readAt || new Date().toISOString();
      this.serverMessages.update((prev) =>
        prev.map((m) => (m.read ? m : { ...m, read: true, readAt })),
      );
      this.unreadServerCount.set(0);
      void this.writeCache(this.serverMessages(), 0);
    }
  }

  private handleNewNotificationEffects(notif: AppNotificationDto): void {
    this.liveAnnouncement.set(`${notif.title} — ${notif.detail}`);
    if (!notif.importantAlert || this.seenPopupIds.has(notif.id)) return;
    this.seenPopupIds.add(notif.id);

    // Un seul encadré à la fois pendant 8 secondes : les suivants entrent uniquement dans la cloche
    if (!this.activeImportantAlert()) {
      this.activeImportantAlert.set(notif);
      if (this.popupTimer) clearTimeout(this.popupTimer);
      this.popupTimer = setTimeout(() => {
        this.popupTimer = null;
        this.activeImportantAlert.set(null);
      }, IMPORTANT_POPUP_DURATION_MS);
    }

    this.playImportantAlertTone(notif.type);
  }

  dismissImportantAlert(): void {
    if (this.popupTimer) {
      clearTimeout(this.popupTimer);
      this.popupTimer = null;
    }
    this.activeImportantAlert.set(null);
  }

  playImportantAlertTone(type: string): void {
    if (!this.soundEnabled() || !this.userInteracted()) return;
    this.soundPlayedCount.update((c) => c + 1);
    this.lastSoundPlayedType.set(type);

    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type === 'PLAT_MANQUANT' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(type === 'PLAT_MANQUANT' ? 540 : 880, now);
      osc.frequency.setValueAtTime(type === 'PLAT_MANQUANT' ? 420 : 1046, now + 0.14);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {
      // Ignorer si l'API audio est restreinte par le navigateur
    }
  }

  async markAsRead(notif: AppNotificationDto): Promise<void> {
    if (notif.category === 'HOUSEKEEPING') {
      const rawId = notif.id.replace(/^room-/, '');
      this.roomsService?.markAlertRead(rawId);
      return;
    }

    const readAt = new Date().toISOString();
    let wasUnread = false;
    this.serverMessages.update((prev) =>
      prev.map((m) => {
        if (m.id !== notif.id) return m;
        if (!m.read) wasUnread = true;
        return { ...m, read: true, readAt };
      }),
    );
    if (wasUnread) {
      this.unreadServerCount.update((c) => Math.max(0, c - 1));
    }
    void this.writeCache(this.serverMessages(), this.unreadServerCount());

    if (!this.canReceiveOrderNotifications()) return;

    if (!this.isOnline()) {
      await this.outbox?.enqueue('POST_NOTIFICATION_READ', `/api/notifications/${notif.id}/read`, {});
      return;
    }
    try {
      const res = await this.apiFetch(`/api/notifications/${notif.id}/read`, {
        method: 'POST',
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        await this.outbox?.enqueue('POST_NOTIFICATION_READ', `/api/notifications/${notif.id}/read`, {});
      }
    } catch {
      await this.outbox?.enqueue('POST_NOTIFICATION_READ', `/api/notifications/${notif.id}/read`, {});
    }
  }

  async markAllAsRead(): Promise<void> {
    this.roomsService?.markAllAlertsRead();

    if (!this.canReceiveOrderNotifications()) return;

    const readAt = new Date().toISOString();
    this.serverMessages.update((prev) =>
      prev.map((m) => (m.read ? m : { ...m, read: true, readAt })),
    );
    this.unreadServerCount.set(0);
    void this.writeCache(this.serverMessages(), 0);

    if (!this.isOnline()) {
      await this.outbox?.enqueue('POST_NOTIFICATION_READ_ALL', '/api/notifications/read-all', {});
      return;
    }
    try {
      const res = await this.apiFetch('/api/notifications/read-all', {
        method: 'POST',
        headers: this.authHeaders(),
      });
      if (!res.ok) {
        await this.outbox?.enqueue('POST_NOTIFICATION_READ_ALL', '/api/notifications/read-all', {});
      }
    } catch {
      await this.outbox?.enqueue('POST_NOTIFICATION_READ_ALL', '/api/notifications/read-all', {});
    }
  }

  private async openCacheDb(): Promise<IDBDatabase | null> {
    if (typeof indexedDB === 'undefined') return null;
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(NOTIFICATIONS_CACHE_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('inbox')) {
            db.createObjectStore('inbox', { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async readCache(): Promise<CachedNotificationsPayload | null> {
    const db = await this.openCacheDb();
    if (!db) return null;
    const cacheKey = `inbox_${this.activeUserId || 'anon'}`;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('inbox', 'readonly');
        const req = tx.objectStore('inbox').get(cacheKey);
        req.onsuccess = () => resolve((req.result as CachedNotificationsPayload) || null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async writeCache(items: AppNotificationDto[], unreadCount: number): Promise<void> {
    const db = await this.openCacheDb();
    if (!db) return;
    const cacheKey = `inbox_${this.activeUserId || 'anon'}`;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('inbox', 'readwrite');
        tx.objectStore('inbox').put({
          key: cacheKey,
          items,
          unreadCount,
          updatedAt: Date.now(),
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}
