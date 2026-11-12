import { Injectable, Type, inject, signal } from '@angular/core';
import {
  AvailableRoomItem,
  AvailableRoomsResponse,
  CreatedReservationResponse,
  CreateReservationPayload,
  GuestQuickSearchItem,
  HotelRatesConfig,
  ReservationModalParams,
} from '../models/reservation-modal.model';
import { PlanningMockService } from './planning-mock.service';
import { RoomsService } from './rooms.service';
import { ClientsService } from './clients.service';
import { OutboxService } from '../offline/outbox.service';

export interface SubmitReservationResult {
  ok: boolean;
  conflict?: boolean;
  offlineQueued?: boolean;
  message?: string;
  reservation?: CreatedReservationResponse;
}

const RATES_CACHE_TTL_MS = 5 * 60 * 1000;

function safeInject<T>(token: Type<T>): T | null {
  try {
    return inject(token, { optional: true });
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root',
})
export class ReservationModalService {
  private readonly planningService = safeInject(PlanningMockService);
  private readonly roomsService = safeInject(RoomsService);
  private readonly clientsService = safeInject(ClientsService);
  private readonly outboxService = safeInject(OutboxService);

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

  getCurrentRole(): string {
    try {
      const raw =
        typeof localStorage !== 'undefined'
          ? localStorage.getItem('residence_blue_auth_session')
          : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.user?.role) return String(parsed.user.role);
      }
    } catch {
      // Fallback démo Direction
    }
    return 'DIRECTION';
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
        headers: { 'x-user-role': this.getCurrentRole() },
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
      // Fallback hors ligne depuis le cache mémoire des services si réseau indisponible
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

  private buildOfflineAvailableRooms(
    checkIn: string,
    checkOut: string,
    category?: string,
  ): AvailableRoomsResponse {
    const rooms = this.roomsService?.activeRooms() ?? [];
    const reservations = this.planningService?.allReservations() ?? [];
    const items: AvailableRoomItem[] = rooms
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
        headers: { 'x-user-role': this.getCurrentRole() },
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
        headers: { 'x-user-role': this.getCurrentRole() },
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
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': this.getCurrentRole(),
          'Idempotency-Key': idempotencyKey,
        },
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

      // Mise à jour immédiate du Planning, des Chambres et du Tableau de bord
      this.planningService?.upsertReservationFromApi(created as any);
      void this.roomsService?.fetchFromServer?.();
      if (payload.newGuest && this.clientsService) {
        void this.clientsService.loadDirectory?.(true);
      }

      this.close();
      this.showFeedback('Réservation enregistrée');
      return { ok: true, reservation: created };
    } catch {
      if (typeof navigator !== 'undefined' && !navigator.onLine && this.outboxService) {
        await this.outboxService.enqueue('RESERVATION_CREATE', '/api/reservations', {
          ...payload,
          idempotencyKey,
        });
        this.close();
        this.showFeedback('Réservation mise en attente de synchronisation');
        return { ok: true, offlineQueued: true };
      }
      const msg = 'Erreur réseau lors de l’enregistrement de la réservation.';
      this.errorMessage.set(msg);
      return { ok: false, message: msg };
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
