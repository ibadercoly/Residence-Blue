import { Injectable, Injector, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import {
  AvailableRoomItem,
  AvailableRoomsResponse,
  CreatedReservationResponse,
  CreateReservationPayload,
  GuestQuickSearchItem,
  HotelRatesConfig,
  ReservationModalParams,
} from '../models/reservation-modal.model';

export interface SubmitReservationResult {
  ok: boolean;
  conflict?: boolean;
  offlineQueued?: boolean;
  message?: string;
  reservation?: CreatedReservationResponse;
}

const RATES_CACHE_TTL_MS = 5 * 60 * 1000;

function safeInjectInjector(): Injector | null {
  try {
    return inject(Injector);
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class ReservationModalService {
  private readonly injector = safeInjectInjector();

  readonly isOpen = signal<boolean>(false);
  readonly currentParams = signal<ReservationModalParams | null>(null);
  readonly isSubmitting = signal<boolean>(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly lastCreatedReservation = signal<CreatedReservationResponse | null>(null);

  /** Cache court des tarifs hôteliers (chargés une fois avec la première requête) */
  private ratesCache: { data: HotelRatesConfig; ts: number } | null = null;
  private roomsAbort: AbortController | null = null;
  private guestAbort: AbortController | null = null;
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;

  private get authService(): AuthService | null {
    return this.injector ? this.injector.get(AuthService, null) : null;
  }

  getCurrentRole(): string {
    return this.authService?.currentRole() || '';
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      ...(this.authService ? this.authService.getAuthHeaders() : {}),
      ...(extra || {}),
    };
  }

  getCachedRates(): HotelRatesConfig {
    if (this.ratesCache && Date.now() - this.ratesCache.ts < RATES_CACHE_TTL_MS) {
      return this.ratesCache.data;
    }
    return { tourismTaxPerNightPerPerson: 1000, vatRatePercent: 10 };
  }

  hasValidRatesCache(): boolean {
    return Boolean(
      this.ratesCache && Date.now() - this.ratesCache.ts < RATES_CACHE_TTL_MS,
    );
  }

  open(params?: ReservationModalParams): void {
    this.errorMessage.set(null);
    this.currentParams.set(params ?? null);
    this.isOpen.set(true);
  }

  close(): void {
    this.abortPendingRequests();
    this.isOpen.set(false);
    this.errorMessage.set(null);
    this.currentParams.set(null);
  }

  abortPendingRequests(): void {
    if (this.roomsAbort) {
      this.roomsAbort.abort();
      this.roomsAbort = null;
    }
    if (this.guestAbort) {
      this.guestAbort.abort();
      this.guestAbort = null;
    }
  }

  clearFeedback(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.feedbackMessage.set(null);
  }

  private showFeedback(msg: string): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
    this.feedbackMessage.set(msg);
    this.feedbackTimer = setTimeout(() => {
      this.feedbackMessage.set(null);
      this.feedbackTimer = null;
    }, 5000);
  }

  async fetchAvailableRooms(
    checkIn: string,
    checkOut: string,
    category?: string,
  ): Promise<AvailableRoomsResponse> {
    if (this.roomsAbort) {
      this.roomsAbort.abort();
    }
    const controller = new AbortController();
    this.roomsAbort = controller;

    const params = new URLSearchParams({ checkIn, checkOut });
    if (category && category !== 'ALL') {
      params.set('category', category);
    }

    try {
      const res = await fetch(`/api/rooms/available?${params.toString()}`, {
        credentials: 'include',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Erreur lors du chargement des chambres libres.');
      }
      const data: AvailableRoomsResponse = await res.json();
      if (data?.rates) {
        this.ratesCache = { data: data.rates, ts: Date.now() };
      }
      return data;
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return this.buildOfflineAvailableRooms(checkIn, checkOut, category);
      }
      throw err;
    } finally {
      if (this.roomsAbort === controller) {
        this.roomsAbort = null;
      }
    }
  }

  private async buildOfflineAvailableRooms(
    checkIn: string,
    checkOut: string,
    category?: string,
  ): Promise<AvailableRoomsResponse> {
    let items: AvailableRoomItem[] = [];
    if (this.injector) {
      try {
        const [{ RoomsService }, { PlanningMockService }] = await Promise.all([
          import('./rooms.service'),
          import('./planning-mock.service'),
        ]);
        const roomsService = this.injector.get(RoomsService, null);
        const planningService = this.injector.get(PlanningMockService, null);
        const rooms = roomsService?.activeRooms() ?? [];
        const reservations = planningService?.allReservations() ?? [];
        items = rooms
          .filter((r) => r.status !== 'MAINTENANCE')
          .filter((r) => !category || category === 'ALL' || r.category === category)
          .filter(
            (r) =>
              !reservations.some(
                (res) =>
                  res.roomNumber === r.number &&
                  String(res.status) !== 'ANNULE' &&
                  checkIn < res.checkOutDate &&
                  res.checkInDate < checkOut,
              ),
          )
          .map((r) => ({
            id: r.id,
            number: r.number,
            category: r.category || r.type?.name || 'Standard',
            floor: r.floor,
            adultsCapacity: r.adultsCapacity ?? 2,
            childrenCapacity: r.childrenCapacity ?? 0,
            capacity: (r.adultsCapacity ?? 2) + (r.childrenCapacity ?? 0),
            pricePerNight: r.type?.pricePerNight ?? 35000,
            breakfastIncluded: r.breakfastIncluded ?? true,
          }));
      } catch {
        items = [];
      }
    }

    const nights = Math.max(
      1,
      Math.round(
        (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000,
      ),
    );
    return {
      checkIn,
      checkOut,
      nights,
      total: items.length,
      rates: this.getCachedRates(),
      items,
    };
  }

  async searchGuests(query: string): Promise<GuestQuickSearchItem[]> {
    if (this.guestAbort) {
      this.guestAbort.abort();
    }
    const controller = new AbortController();
    this.guestAbort = controller;

    const params = new URLSearchParams({ limit: '5' });
    if (query.trim()) {
      params.set('q', query.trim());
    }

    try {
      const res = await fetch(`/api/guests/search?${params.toString()}`, {
        credentials: 'include',
        headers: this.buildHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.items) ? data.items.slice(0, 5) : [];
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        throw err;
      }
      return [];
    } finally {
      if (this.guestAbort === controller) {
        this.guestAbort = null;
      }
    }
  }

  async fetchGuestById(guestId: string): Promise<GuestQuickSearchItem | null> {
    try {
      const res = await fetch(`/api/guests/${encodeURIComponent(guestId)}`, {
        credentials: 'include',
        headers: this.buildHeaders(),
      });
      if (!res.ok) return null;
      const g = await res.json();
      return g?.id ? { id: g.id, fullName: g.fullName, phone: g.phone } : null;
    } catch {
      return null;
    }
  }

  async confirmReservation(
    payload: CreateReservationPayload,
  ): Promise<SubmitReservationResult> {
    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `res-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        credentials: 'include',
        headers: this.buildHeaders({
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        }),
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);

      if (res.status === 409) {
        const msg =
          body?.message ||
          "Cette chambre vient d'être réservée, choisissez-en une autre";
        this.errorMessage.set(msg);
        return { ok: false, conflict: true, message: msg };
      }

      if (!res.ok) {
        const rawMsg = body?.message;
        const msg = Array.isArray(rawMsg)
          ? rawMsg.join(' • ')
          : rawMsg || 'Impossible d’enregistrer la réservation.';
        this.errorMessage.set(msg);
        return { ok: false, message: msg };
      }

      const created: CreatedReservationResponse = body;
      this.lastCreatedReservation.set(created);
      void this.syncRelatedStores(created, Boolean(payload.newGuest));

      this.close();
      this.showFeedback('Réservation enregistrée');
      return { ok: true, reservation: created };
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine && this.injector) {
        try {
          const { OutboxService } = await import('../offline/outbox.service');
          const outboxService = this.injector.get(OutboxService, null);
          if (outboxService) {
            await outboxService.enqueue('RESERVATION_CREATE', '/api/reservations', {
              ...payload,
              idempotencyKey,
            });
            this.close();
            this.showFeedback('Réservation mise en attente de synchronisation');
            return { ok: true, offlineQueued: true };
          }
        } catch {
          // fallback ci-dessous
        }
      }
      const msg = 'Erreur réseau lors de l’enregistrement de la réservation.';
      this.errorMessage.set(msg);
      return { ok: false, message: msg };
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private async syncRelatedStores(
    created: CreatedReservationResponse,
    hasNewGuest: boolean,
  ): Promise<void> {
    if (!this.injector) return;
    try {
      const [{ PlanningMockService }, { RoomsService }] = await Promise.all([
        import('./planning-mock.service'),
        import('./rooms.service'),
      ]);
      this.injector.get(PlanningMockService, null)?.upsertReservationFromApi(created as any);
      void this.injector.get(RoomsService, null)?.fetchFromServer?.();
      if (hasNewGuest) {
        const { ClientsService } = await import('./clients.service');
        void this.injector.get(ClientsService, null)?.loadDirectory?.(true);
      }
    } catch {
      // Silencieux si module non encore chargé
    }
  }
}
