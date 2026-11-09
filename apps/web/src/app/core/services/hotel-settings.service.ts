import { Injectable, signal } from '@angular/core';

export interface HotelSettings {
  hotelName: string;
  tagline: string;
  city: string;
  neighborhood: string;
  country: string;
  supportPhone: string;
  supportEmail: string;
  roomCount: number;
  restaurantName: string;
  currency: string;
}

@Injectable({
  providedIn: 'root'
})
export class HotelSettingsService {
  // Paramètres par défaut de la Résidence Blue à Grand Standing, Thiès
  // TODO(API): Charger dynamiquement ces paramètres depuis GET /api/settings
  private readonly _settings = signal<HotelSettings>({
    hotelName: 'Résidence Blue',
    tagline: 'Hôtel Boutique • Grand Standing, Thiès',
    city: 'Thiès',
    neighborhood: 'Grand Standing',
    country: 'Sénégal',
    supportPhone: '+221 33 957 00 00',
    supportEmail: 'support@residenceblue.sn',
    roomCount: 12,
    restaurantName: 'La Teranga',
    currency: 'XOF'
  });

  readonly settings = this._settings.asReadonly();

  get supportPhone(): string {
    return this._settings().supportPhone;
  }

  get supportPhoneLink(): string {
    return `tel:${this.supportPhone.replace(/\s+/g, '')}`;
  }
}
