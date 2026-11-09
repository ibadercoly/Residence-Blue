/**
 * Types et interfaces pour le Point de Vente (POS) Restaurant & Bar « La Teranga »
 * et la gestion du menu.
 * RÈGLE ABSOLUE AGENTS.MD : Les montants sont TOUJOURS stockés en ENTIERS (jamais de décimaux).
 */

export type DishCategoryCode =
  | 'PLATS_MER'
  | 'BOISSONS_BAR'
  | 'DESSERTS'
  | 'PETIT_DEJEUNER'
  | 'ENTREES_TAPAS';

export interface DishCategory {
  id: string;
  code?: DishCategoryCode | string;
  name: string;
  icon?: string;
  displayOrder: number;
  isArchived: boolean;
  itemCount?: number;
}

export type DishTag =
  | 'LOCAL_SPECIALTY'
  | 'POPULAR'
  | 'DISH_OF_DAY'
  | 'VEGETARIAN'
  | 'SPICY'
  | 'SIGNATURE_BAR'
  | 'NEW';

export type Allergen =
  | 'PEANUT'
  | 'GLUTEN'
  | 'MILK'
  | 'EGG'
  | 'FISH'
  | 'CRUSTACEAN'
  | 'SOY'
  | 'NUTS'
  | 'CELERY'
  | 'MUSTARD'
  | 'SESAME';

export type PrepStation = 'CUISINE' | 'BAR' | 'PATISSERIE';

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER';

export interface DishAvailability {
  type: 'ALWAYS' | 'SLOTS';
  slots?: MealSlot[];
  days?: number[]; // 0 = Dimanche, 1 = Lundi...
}

export interface DishOption {
  id: string;
  name: string;
  priceFcfa: number; // 0 ou supplément
}

export type DishStatus = 'AVAILABLE' | 'SOLD_OUT' | 'ARCHIVED';

export interface DishItem {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  priceFcfa: number;
  halfPortionPriceFcfa?: number;
  tags: DishTag[];
  allergens: Allergen[];
  prepTimeMinutes: number;
  prepStation: PrepStation;
  availability: DishAvailability;
  options: DishOption[];
  vatRatePercent: number;
  displayOrder: number;
  photoUrl?: string;
  status: DishStatus;
}

export interface OrderTicketItem {
  id: string;
  dishId: string;
  name: string;
  quantity: number;
  unitPriceFcfa: number;
  totalPriceFcfa: number;
  selectedOptions?: string[];
  notes?: string;
  prepStation?: PrepStation;
}

export interface RestaurantTicket {
  id: string;
  ticketNumber: string;
  serverName: string;
  time: string;
  destinationType: 'TABLE' | 'ROOM';
  destinationValue: string; // Ex: 'T4 (Piscine)' ou '301'
  guestInfo?: {
    roomNumber: string;
    roomName: string;
    guestName: string;
    vipTier?: string;
  };
  items: OrderTicketItem[];
  subtotalHtFcfa: number;
  vatRatePercent: number;
  vatAmountFcfa: number;
  totalTtcFcfa: number;
  status: 'OPEN' | 'SENT_TO_KITCHEN' | 'PAID' | 'TRANSFERRED_TO_ROOM';
}
