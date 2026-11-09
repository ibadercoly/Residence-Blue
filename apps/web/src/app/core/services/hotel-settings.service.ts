import { Injectable, signal } from '@angular/core';

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
  tourismTaxPerNightPerPerson: number; // 1000 FCFA
}

@Injectable({
  providedIn: 'root'
})
export class HotelSettingsService {
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

  get supportPhone(): string {
    return this._settings().supportPhone;
  }

  get supportPhoneLink(): string {
    return `tel:${this.supportPhone.replace(/\s+/g, '')}`;
  }

  updateSettings(partial: Partial<HotelSettings>): void {
    this._settings.update(curr => ({ ...curr, ...partial }));
  }
}
