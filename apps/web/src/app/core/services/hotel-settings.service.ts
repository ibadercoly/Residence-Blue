import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

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
  discountThresholdPercent?: number | null;
  invoiceLogoPath?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class HotelSettingsService {
  private readonly authService = inject(AuthService, { optional: true });
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
    tourismTaxPerNightPerPerson: 1000
  });

  readonly settings = this._settings.asReadonly();

  constructor() {
    this.fetchFromServer();
  }

  async fetchFromServer(): Promise<void> {
    if (typeof fetch === 'undefined') return;
    try {
      const res = await fetch('/api/hotel-settings');
      if (res.ok) {
        const data = await res.json();
        if (data && data.hotelName) {
          this._settings.update((curr) => ({ ...curr, ...data }));
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

  updateSettings(partial: Partial<HotelSettings>): void {
    this._settings.update(curr => ({ ...curr, ...partial }));
    if (typeof fetch !== 'undefined') {
      fetch('/api/hotel-settings', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(this.authService ? this.authService.getAuthHeaders() : {}),
        },
        body: JSON.stringify(partial),
      })
        .then(async (res) => {
          if (res.ok) {
            const saved = await res.json();
            if (saved && saved.hotelName) {
              this._settings.update((curr) => ({ ...curr, ...saved }));
            }
          }
        })
        .catch(() => {});
    }
  }
}
