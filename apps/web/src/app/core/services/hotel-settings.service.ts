import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { IdbService } from '../offline/idb.service';
import { OutboxService } from '../offline/outbox.service';

export interface HotelSettings {
  hotelName: string;
  legalName: string;
  tagline: string;
  city: string;
  neighborhood: string;
  country: string;
  fullAddress: string;
  ninea: string;
  rccm: string;
  supportPhone: string;
  supportEmail: string;
  roomCount: number;
  restaurantName: string;
  currency: string;
  vatRatePercent: number; // 10% taux réduit hôtellerie au Sénégal
  serviceRatePercent?: number | null;
  tourismTaxPerNightPerPerson: number; // 1000 FCFA
  tourismTaxIncludesChildren: boolean;
  discountThresholdPercent?: number | null;
  invoiceLogoPath?: string | null;
}

interface CachedHotelSettings extends HotelSettings {
  id: 'default';
}

function optionalInject<T>(token: abstract new (...args: never[]) => T): T | null {
  try {
    return inject(token, { optional: true });
  } catch {
    return null;
  }
}

@Injectable({
  providedIn: 'root'
})
export class HotelSettingsService {
  private readonly authService: AuthService | null;
  private readonly idbService = optionalInject(IdbService);
  private readonly outboxService = optionalInject(OutboxService);
  // Paramètres par défaut de la Résidence Blue à Grand Standing, Thiès
  // Source de vérité paramétrable (AGENTS.md & ADAPTATION-THIES.md)
  private readonly _settings = signal<HotelSettings>({
    hotelName: 'Résidence Blue',
    legalName: 'Résidence Blue S.A.R.L.',
    tagline: 'Hôtel Boutique • Grand Standing, Thiès',
    city: 'Thiès',
    neighborhood: 'Grand Standing',
    country: 'Sénégal',
    fullAddress: 'Quartier Grand Standing • Thiès, Sénégal',
    ninea: '004819230',
    rccm: 'SN-THS-2021-B-114',
    supportPhone: '+221 33 957 00 00',
    supportEmail: 'support@residenceblue.sn',
    roomCount: 12,
    restaurantName: 'La Teranga',
    currency: 'XOF',
    vatRatePercent: 10,
    tourismTaxPerNightPerPerson: 1000,
    tourismTaxIncludesChildren: false
  });

  readonly settings = this._settings.asReadonly();

  constructor(authServiceOverride?: AuthService) {
    let injectedAuth: AuthService | null = null;
    try {
      injectedAuth = inject(AuthService, { optional: true });
    } catch {
      injectedAuth = null;
    }
    this.authService = authServiceOverride ?? injectedAuth;
    this.fetchFromServer();
    try {
      effect(() => {
        if (this.authService?.isAuthenticated()) {
          void this.fetchFromServer();
        }
      });
    } catch {
      // Hors contexte d'injection Angular (tests unitaires)
    }
  }

  async fetchFromServer(): Promise<void> {
    const cached = await this.idbService?.get<CachedHotelSettings>('hotelSettings', 'default').catch(() => undefined);
    if (cached) {
      const settings = { ...cached };
      delete (settings as Partial<CachedHotelSettings>).id;
      this._settings.update((current) => ({ ...current, ...settings }));
    }
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/hotel-settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.hotelName) {
          this._settings.update((curr) => ({ ...curr, ...data }));
          await this.cacheSettings(this._settings());
        }
      }
    } catch {}
  }

  get supportPhone(): string {
    return this._settings().supportPhone;
  }

  get supportPhoneLink(): string {
    return `tel:${this.supportPhone.replace(/\s+/g, '')}`;
  }

  async updateSettings(partial: Partial<HotelSettings>): Promise<{ settings: HotelSettings; syncPending: boolean }> {
    let response: Response;
    try {
      if (typeof fetch === 'undefined') throw new Error('Connexion indisponible');
      response = await fetch('/api/hotel-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          ...(this.authService ? this.authService.getAuthHeaders() : {}),
        },
        body: JSON.stringify(partial),
      });
    } catch {
      if (!this.idbService || !this.outboxService) {
        throw new Error('Enregistrement impossible : stockage hors ligne indisponible.');
      }
      this._settings.update((current) => ({ ...current, ...partial }));
      await this.cacheSettings(this._settings());
      await this.outboxService.enqueue('PATCH_HOTEL_SETTINGS', '/api/hotel-settings', partial);
      return { settings: this._settings(), syncPending: true };
    }

    if (!response.ok) {
      throw new Error(response.status === 403
        ? 'Cette action est réservée à la direction.'
        : 'Les paramètres n’ont pas pu être enregistrés. Réessayez.');
    }
    const saved = await response.json() as HotelSettings;
    this._settings.update((current) => ({ ...current, ...saved }));
    await this.cacheSettings(this._settings());
    return { settings: this._settings(), syncPending: false };
  }

  private async cacheSettings(settings: HotelSettings): Promise<void> {
    await this.idbService?.put('hotelSettings', { id: 'default', ...settings } satisfies CachedHotelSettings).catch(() => {});
  }
}
