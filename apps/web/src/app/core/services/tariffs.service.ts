import { Injectable, inject, signal } from '@angular/core';
import {
  ExtraServiceItemDto,
  ReservationPriceQuoteDto,
  RoomTariffDto,
  TariffCategoryDto,
  TariffGridResponseDto,
} from '@residence-blue/shared';
import { AuthService } from './auth.service';
import { NetworkService } from '../offline/network.service';

const TARIFFS_STORAGE_KEY = 'residence_blue_tariffs_grid_cache_v1';

@Injectable({
  providedIn: 'root',
})
export class TariffsService {
  private readonly authService = inject(AuthService, { optional: true });
  private readonly network = inject(NetworkService, { optional: true });

  readonly categories = signal<TariffCategoryDto[]>([]);
  readonly tariffs = signal<RoomTariffDto[]>([]);
  readonly extraServices = signal<ExtraServiceItemDto[]>([]);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  constructor() {
    this.restoreCache();
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    return {
      ...(this.authService ? this.authService.getAuthHeaders() : {}),
      ...(extra || {}),
    };
  }

  private persistCache(grid: TariffGridResponseDto): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(TARIFFS_STORAGE_KEY, JSON.stringify(grid));
      }
    } catch {
      // Ignorer les restrictions de stockage navigateur
    }
  }

  private restoreCache(): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(TARIFFS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TariffGridResponseDto>;
      if (Array.isArray(parsed.categories)) this.categories.set(parsed.categories);
      if (Array.isArray(parsed.tariffs)) this.tariffs.set(parsed.tariffs);
      if (Array.isArray(parsed.extraServices)) this.extraServices.set(parsed.extraServices);
    } catch {
      // Cache corrompu ignoré
    }
  }

  private async extractError(res: Response, fallback: string): Promise<string> {
    try {
      const body = await res.json();
      if (Array.isArray(body?.message)) return body.message.join(' • ');
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    } catch {
      // Ignorer
    }
    return fallback;
  }

  async fetchGrid(): Promise<TariffGridResponseDto | null> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      if (this.network && !this.network.isOnline()) {
        this.restoreCache();
        return {
          categories: this.categories(),
          tariffs: this.tariffs(),
          extraServices: this.extraServices(),
        };
      }
      const res = await fetch('/api/tariffs', {
        method: 'GET',
        credentials: 'include',
        headers: this.buildHeaders(),
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, 'Impossible de charger la grille des tarifs.'),
        );
        return null;
      }
      const data = (await res.json()) as TariffGridResponseDto;
      this.categories.set(Array.isArray(data.categories) ? data.categories : []);
      this.tariffs.set(Array.isArray(data.tariffs) ? data.tariffs : []);
      this.extraServices.set(Array.isArray(data.extraServices) ? data.extraServices : []);
      this.persistCache(data);
      return data;
    } catch {
      this.restoreCache();
      if (this.tariffs().length === 0) {
        this.errorMessage.set('Serveur inaccessible : impossible de charger les tarifs.');
      }
      return null;
    } finally {
      this.loading.set(false);
    }
  }

  async fetchActiveExtraServices(): Promise<ExtraServiceItemDto[]> {
    try {
      const res = await fetch('/api/tariffs/extra-services', {
        method: 'GET',
        credentials: 'include',
        headers: this.buildHeaders(),
      });
      if (!res.ok) return this.extraServices().filter((s) => s.isActive);
      const list = (await res.json()) as ExtraServiceItemDto[];
      if (Array.isArray(list)) {
        this.extraServices.set(list);
        return list;
      }
      return [];
    } catch {
      return this.extraServices().filter((s) => s.isActive);
    }
  }

  async fetchQuote(params: {
    roomId?: string;
    categoryCode?: string;
    guestsCount: number;
    roomsUsed?: number;
    nights: number;
    adultsCount?: number;
    childrenCount?: number;
    breakfastIncluded?: boolean;
  }): Promise<ReservationPriceQuoteDto | null> {
    const qs = new URLSearchParams();
    if (params.roomId) qs.set('roomId', params.roomId);
    if (params.categoryCode) qs.set('categoryCode', params.categoryCode);
    qs.set('guestsCount', String(Math.max(1, Math.round(params.guestsCount))));
    if (params.roomsUsed !== undefined) {
      qs.set('roomsUsed', String(Math.max(1, Math.round(params.roomsUsed))));
    }
    qs.set('nights', String(Math.max(1, Math.round(params.nights))));
    if (params.adultsCount !== undefined) qs.set('adultsCount', String(params.adultsCount));
    if (params.childrenCount !== undefined) qs.set('childrenCount', String(params.childrenCount));
    if (params.breakfastIncluded !== undefined) {
      qs.set('breakfastIncluded', params.breakfastIncluded ? 'true' : 'false');
    }

    try {
      const res = await fetch(`/api/tariffs/quote?${qs.toString()}`, {
        method: 'GET',
        credentials: 'include',
        headers: this.buildHeaders(),
      });
      if (!res.ok) return null;
      return (await res.json()) as ReservationPriceQuoteDto;
    } catch {
      return null;
    }
  }

  async saveTariffGrid(
    items: Array<{ id: string; pricePerNightFcfa: number | null; isActive?: boolean }>,
  ): Promise<boolean> {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const res = await fetch('/api/tariffs/grid', {
        method: 'PUT',
        credentials: 'include',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, "Impossible d'enregistrer les tarifs."),
        );
        return false;
      }
      const updated = (await res.json()) as TariffGridResponseDto;
      this.categories.set(updated.categories || []);
      this.tariffs.set(updated.tariffs || []);
      this.extraServices.set(updated.extraServices || []);
      this.persistCache(updated);
      this.successMessage.set(
        'Tarifs enregistrés. Ils s’appliqueront uniquement aux nouvelles réservations.',
      );
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors de l’enregistrement des tarifs.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async updateExtraService(
    id: string,
    payload: { name?: string; unit?: 'DAY' | 'PERSON'; priceFcfa?: number; isActive?: boolean },
  ): Promise<boolean> {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const res = await fetch(`/api/tariffs/extra-services/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, 'Impossible de modifier cette prestation.'),
        );
        return false;
      }
      const updated = (await res.json()) as ExtraServiceItemDto;
      this.extraServices.update((list) => list.map((s) => (s.id === id ? updated : s)));
      this.successMessage.set(`Prestation « ${updated.name} » enregistrée.`);
      return true;
    } catch {
      this.errorMessage.set('Erreur réseau lors de la modification de la prestation.');
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  async createExtraService(payload: {
    name: string;
    unit: 'DAY' | 'PERSON';
    priceFcfa: number;
  }): Promise<boolean> {
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const res = await fetch('/api/tariffs/extra-services', {
        method: 'POST',
        credentials: 'include',
        headers: this.buildHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        this.errorMessage.set(
          await this.extractError(res, "Impossible d'ajouter cette prestation."),
        );
        return false;
      }
      const created = (await res.json()) as ExtraServiceItemDto;
      this.extraServices.update((list) => [...list, created]);
      this.successMessage.set(`Prestation « ${created.name} » ajoutée au catalogue.`);
      return true;
    } catch {
      this.errorMessage.set("Erreur réseau lors de l'ajout de la prestation.");
      return false;
    } finally {
      this.saving.set(false);
    }
  }
}
