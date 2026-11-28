/**
 * Tarifs publics réels de la Résidence Blue (Grand Standing, Thiès) — côté location.
 * Tous les montants sont des ENTIERS stricts en FCFA (B&B : nuit avec petit-déjeuner).
 * RÈGLE STRICTE : ne jamais combler une case « non proposé » ou « tarif non défini » avec un prix inventé.
 */

export type TariffCategoryCode = 'STANDARD' | 'CONFORT' | 'APPARTEMENT';

export const UNCLASSIFIED_ROOM_CATEGORY = 'À classer';

export const HOTEL_TARIFF_CATEGORY_NAMES = ['Standard', 'Confort', 'Appartement'] as const;

export type ExtraServiceUnit = 'DAY' | 'PERSON';

export interface TariffCategoryDto {
  id: string;
  code: TariffCategoryCode | string;
  name: string;
  displayOrder: number;
  isActive: boolean;
}

export interface RoomTariffDto {
  id: string;
  categoryId: string;
  categoryCode: TariffCategoryCode | string;
  categoryName: string;
  guestsCount: number;
  /** Nombre de chambres utilisées (uniquement pour l'Appartement ; null pour 5-6 pers ou Standard/Confort) */
  roomsUsed: number | null;
  label: string;
  /** Prix par nuit en FCFA entier ; null = « Tarif non défini (À définir) » */
  pricePerNightFcfa: number | null;
  isActive: boolean;
  displayOrder: number;
}

export interface ExtraServiceItemDto {
  id: string;
  code: string;
  name: string;
  unit: ExtraServiceUnit | string;
  unitLabel: string;
  priceFcfa: number;
  category: 'AUTRES';
  isActive: boolean;
  displayOrder: number;
}

export interface TariffGridResponseDto {
  categories: TariffCategoryDto[];
  tariffs: RoomTariffDto[];
  extraServices: ExtraServiceItemDto[];
}

export interface ReservationPriceQuoteDto {
  available: boolean;
  categoryCode: string | null;
  categoryName: string;
  guestsCount: number;
  roomsUsed: number;
  nights: number;
  ratePerNightFcfa: number | null;
  accommodationTotalFcfa: number | null;
  tourismTaxFcfa: number;
  totalFcfa: number | null;
  tariffId: string | null;
  tariffLabel: string | null;
  summaryLine: string | null;
  errorMessage: string | null;
}

export interface RealTariffCategorySeed {
  code: TariffCategoryCode;
  name: string;
  displayOrder: number;
}

export interface RealRoomTariffSeed {
  categoryCode: TariffCategoryCode;
  guestsCount: number;
  roomsUsed: number | null;
  label: string;
  pricePerNightFcfa: number | null;
  displayOrder: number;
}

export interface RealExtraServiceSeed {
  code: string;
  name: string;
  unit: ExtraServiceUnit;
  unitLabel: string;
  priceFcfa: number;
  displayOrder: number;
}

export const REAL_TARIFF_CATEGORIES: readonly RealTariffCategorySeed[] = [
  { code: 'STANDARD', name: 'Standard', displayOrder: 1 },
  { code: 'CONFORT', name: 'Confort', displayOrder: 2 },
  { code: 'APPARTEMENT', name: 'Appartement', displayOrder: 3 },
] as const;

/**
 * Grille officielle « TARIF PUBLIC » (B&B, FCFA entiers, par nuit).
 * - Les cases « non proposé » n'ont PAS de ligne.
 * - Les cases « tarif non défini » ont pricePerNightFcfa = null.
 */
export const REAL_ROOM_TARIFFS: readonly RealRoomTariffSeed[] = [
  // Chambre Standard
  {
    categoryCode: 'STANDARD',
    guestsCount: 1,
    roomsUsed: null,
    label: '1 personne',
    pricePerNightFcfa: 30000,
    displayOrder: 1,
  },
  {
    categoryCode: 'STANDARD',
    guestsCount: 2,
    roomsUsed: null,
    label: '2 personnes',
    pricePerNightFcfa: 35000,
    displayOrder: 2,
  },

  // Chambre Confort
  {
    categoryCode: 'CONFORT',
    guestsCount: 1,
    roomsUsed: null,
    label: '1 personne',
    pricePerNightFcfa: 35000,
    displayOrder: 1,
  },
  {
    categoryCode: 'CONFORT',
    guestsCount: 2,
    roomsUsed: null,
    label: '2 personnes',
    pricePerNightFcfa: 40000,
    displayOrder: 2,
  },

  // Appartement
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 1,
    roomsUsed: 1,
    label: '1 personne (1 chambre)',
    pricePerNightFcfa: 50000,
    displayOrder: 1,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 2,
    roomsUsed: 1,
    label: '2 personnes (couple, 1 chambre)',
    pricePerNightFcfa: 55000,
    displayOrder: 2,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 2,
    roomsUsed: 2,
    label: '2 personnes (2 chambres)',
    pricePerNightFcfa: 65000,
    displayOrder: 3,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 3,
    roomsUsed: 2,
    label: '3 personnes, 2 chambres',
    pricePerNightFcfa: 75000,
    displayOrder: 4,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 3,
    roomsUsed: 3,
    label: '3 personnes, 3 chambres',
    pricePerNightFcfa: null, // Tarif non défini — à fixer par la direction
    displayOrder: 5,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 4,
    roomsUsed: 2,
    label: '4 personnes, 2 chambres',
    pricePerNightFcfa: 85000,
    displayOrder: 6,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 4,
    roomsUsed: 3,
    label: '4 personnes, 3 chambres',
    pricePerNightFcfa: null, // Tarif non défini — à fixer par la direction
    displayOrder: 7,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 5,
    roomsUsed: null,
    label: '5 personnes',
    pricePerNightFcfa: 95000,
    displayOrder: 8,
  },
  {
    categoryCode: 'APPARTEMENT',
    guestsCount: 6,
    roomsUsed: null,
    label: '6 personnes',
    pricePerNightFcfa: 105000,
    displayOrder: 9,
  },
] as const;

export const REAL_EXTRA_SERVICES: readonly RealExtraServiceSeed[] = [
  {
    code: 'SALLE_SEMINAIRE',
    name: 'Salle de séminaire',
    unit: 'DAY',
    unitLabel: 'journée',
    priceFcfa: 100000,
    displayOrder: 1,
  },
  {
    code: 'PAUSE_CAFE',
    name: 'Pause-café',
    unit: 'PERSON',
    unitLabel: 'personne',
    priceFcfa: 3000,
    displayOrder: 2,
  },
  {
    code: 'PAUSE_DEJEUNER_MENU_1_PLAT',
    name: 'Pause déjeuner (1 plat au menu)',
    unit: 'PERSON',
    unitLabel: 'personne',
    priceFcfa: 7000,
    displayOrder: 3,
  },
  {
    code: 'PAUSE_DEJEUNER_BUFFET_2_PLATS',
    name: 'Pause déjeuner (2 plats en buffet)',
    unit: 'PERSON',
    unitLabel: 'personne',
    priceFcfa: 10000,
    displayOrder: 4,
  },
] as const;

/**
 * Coordonnées issues du pied de page du document « TARIF PUBLIC » (à compléter
 * uniquement si les champs correspondants sont vides, sans jamais écraser).
 * NINEA 006927349 2F2 : lu sur photo, À VÉRIFIER sur le document officiel.
 */
export const REAL_HOTEL_IDENTITY = {
  hotelName: 'Résidence Blue',
  fullAddress: 'Rue 47 Grand Standing, derrière station EDK, Thiès, 21000, Sénégal',
  neighborhood: 'Grand Standing',
  city: 'Thiès',
  postalCode: '21000',
  country: 'Sénégal',
  ninea: '006927349 2F2',
  supportPhone: '+221 33 954 18 68',
  secondaryPhones: '+221 78 426 64 56 / +221 77 541 69 11',
  supportEmail: 'info@residencesblue.com',
  website: 'www.residencesblue.com',
} as const;

/**
 * Lignes canoniques de la grille papier « TARIF PUBLIC » pour l'affichage et l'édition.
 */
export interface TariffGridRowDefinition {
  key: string;
  label: string;
  guestsCount: number;
  apartmentRoomsUsed: number | null;
  standardSupported: boolean;
  confortSupported: boolean;
  appartementSupported: boolean;
}

export const TARIFF_GRID_ROWS: readonly TariffGridRowDefinition[] = [
  {
    key: '1p',
    label: '1 personne',
    guestsCount: 1,
    apartmentRoomsUsed: 1,
    standardSupported: true,
    confortSupported: true,
    appartementSupported: true,
  },
  {
    key: '2p-1c',
    label: '2 personnes (couple, 1 chambre)',
    guestsCount: 2,
    apartmentRoomsUsed: 1,
    standardSupported: true,
    confortSupported: true,
    appartementSupported: true,
  },
  {
    key: '2p-2c',
    label: '2 personnes (2 chambres)',
    guestsCount: 2,
    apartmentRoomsUsed: 2,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
  {
    key: '3p-2c',
    label: '3 personnes, 2 chambres',
    guestsCount: 3,
    apartmentRoomsUsed: 2,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
  {
    key: '3p-3c',
    label: '3 personnes, 3 chambres',
    guestsCount: 3,
    apartmentRoomsUsed: 3,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
  {
    key: '4p-2c',
    label: '4 personnes, 2 chambres',
    guestsCount: 4,
    apartmentRoomsUsed: 2,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
  {
    key: '4p-3c',
    label: '4 personnes, 3 chambres',
    guestsCount: 4,
    apartmentRoomsUsed: 3,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
  {
    key: '5p',
    label: '5 personnes',
    guestsCount: 5,
    apartmentRoomsUsed: null,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
  {
    key: '6p',
    label: '6 personnes',
    guestsCount: 6,
    apartmentRoomsUsed: null,
    standardSupported: false,
    confortSupported: false,
    appartementSupported: true,
  },
] as const;

export function normalizeTariffCategoryCode(raw?: string | null): TariffCategoryCode | null {
  const clean = (raw || '').trim().toUpperCase();
  if (clean === 'STANDARD') return 'STANDARD';
  if (clean === 'CONFORT') return 'CONFORT';
  if (clean === 'APPARTEMENT') return 'APPARTEMENT';
  return null;
}

export function getTariffCategoryDisplayName(code?: string | null): string {
  const normalized = normalizeTariffCategoryCode(code);
  if (normalized === 'STANDARD') return 'Standard';
  if (normalized === 'CONFORT') return 'Confort';
  if (normalized === 'APPARTEMENT') return 'Appartement';
  return UNCLASSIFIED_ROOM_CATEGORY;
}
