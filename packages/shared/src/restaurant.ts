/**
 * Types et interfaces pour la refonte Restaurant & Bar, Cuisine et Carte (« La Teranga »).
 * RÈGLE ABSOLUE AGENTS.MD : Les montants sont TOUJOURS stockés en ENTIERS FCFA (jamais de décimaux).
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

export const DISH_TAG_LABELS: Record<DishTag, string> = {
  LOCAL_SPECIALTY: 'Spécialité locale',
  POPULAR: 'Populaire',
  DISH_OF_DAY: 'Plat du jour',
  VEGETARIAN: 'Végétarien',
  SPICY: 'Épicé',
  SIGNATURE_BAR: 'Signature Bar',
  NEW: 'Nouveau',
};

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

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  PEANUT: 'Arachide',
  GLUTEN: 'Gluten',
  MILK: 'Lait',
  EGG: 'Œufs',
  FISH: 'Poisson',
  CRUSTACEAN: 'Crustacés',
  SOY: 'Soja',
  NUTS: 'Fruits à coque',
  CELERY: 'Céleri',
  MUSTARD: 'Moutarde',
  SESAME: 'Sésame',
};

export type PrepStation = 'CUISINE' | 'BAR' | 'PATISSERIE';

export const PREP_STATION_LABELS: Record<PrepStation, string> = {
  CUISINE: 'Cuisine',
  BAR: 'Bar',
  PATISSERIE: 'Pâtisserie',
};

export type MealSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER';

export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  BREAKFAST: 'Petit-déjeuner',
  LUNCH: 'Déjeuner',
  DINNER: 'Dîner',
};

export interface DishAvailability {
  type: 'ALWAYS' | 'SLOTS';
  slots?: MealSlot[];
  days?: number[];
}

export interface DishOption {
  id: string;
  name: string;
  priceFcfa: number;
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
  prepStation: PrepStation | string;
  availability: DishAvailability;
  options: DishOption[];
  vatRatePercent: number;
  displayOrder: number;
  photoUrl?: string;
  thumbnailUrl?: string;
  status: DishStatus;
  orderLinesCount?: number;
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
  prepStation?: PrepStation | string;
}

export interface RestaurantTicket {
  id: string;
  ticketNumber: string;
  serverName: string;
  time: string;
  destinationType: 'TABLE' | 'ROOM' | 'TAKEAWAY';
  destinationValue: string;
  guestInfo?: {
    roomNumber: string;
    roomName: string;
    guestName?: string;
    vipTier?: string;
  };
  items: OrderTicketItem[];
  subtotalHtFcfa: number;
  vatRatePercent: number;
  vatAmountFcfa: number;
  totalTtcFcfa: number;
  status: 'OPEN' | 'SENT_TO_KITCHEN' | 'PENDING' | 'CONFIRMED' | 'IN_PREPARATION' | 'READY' | 'AUTHORIZED' | 'SERVED' | 'CANCELLED' | 'PAID' | 'TRANSFERRED_TO_ROOM';
}

export type RestaurantDestinationType = 'ROOM' | 'TABLE' | 'TAKEAWAY';

export type RestaurantOrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'IN_PREPARATION'
  | 'READY'
  | 'AUTHORIZED'
  | 'SERVED'
  | 'CANCELLED';

export const RESTAURANT_ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Envoyée',
  SENT_TO_KITCHEN: 'Envoyée',
  ENVOYEE: 'Envoyée',
  CONFIRMED: 'Confirmée',
  CONFIRMEE: 'Confirmée',
  IN_PREPARATION: 'En préparation',
  EN_PREPARATION: 'En préparation',
  READY: 'Prête à servir',
  PRETE: 'Prête à servir',
  AUTHORIZED: 'Autorisée',
  AUTORISEE: 'Autorisée',
  SERVED: 'Servie',
  SERVIE: 'Servie',
  CANCELLED: 'Annulée',
  ANNULEE: 'Annulée',
};

export type RestaurantOrderEventType =
  | 'ENVOYEE'
  | 'CONFIRMEE'
  | 'TEMPS_PREPARATION'
  | 'TEMPS_AJOUTE'
  | 'PLAT_INDISPONIBLE'
  | 'COMMANDE_MODIFIEE'
  | 'PRETE'
  | 'AUTORISEE'
  | 'SERVIE'
  | 'ANNULEE';

export interface RestaurantOrderEventV3 {
  id: string;
  orderId: string;
  type: RestaurantOrderEventType | string;
  detail: string;
  userId?: string | null;
  userName?: string | null;
  addedMinutes?: number | null;
  unavailableItems?: string[];
  reason?: string | null;
  createdAt: string;
}

export interface RestaurantInStayRoom {
  roomId: string;
  roomNumber: string;
  roomCategory: string;
  reservationId: string;
  guestName?: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface RestaurantOrderLineV3 {
  id: string;
  dishId: string;
  productId?: string | null;
  name: string;
  quantity: number;
  unitPriceFcfa?: number;
  totalPriceFcfa?: number;
  notes?: string;
  prepStation: string;
  isUnavailable?: boolean;
  unavailableReason?: string | null;
}

export interface RestaurantOrderV3 {
  id: string;
  ticketNumber: string;
  serverName: string;
  time: string;
  createdAt: string;
  updatedAt: string;
  destinationType: RestaurantDestinationType;
  destinationValue: string;
  destinationLabel: string;
  tableLabel?: string | null;
  roomId?: string | null;
  roomNumber?: string | null;
  reservationId?: string | null;
  invoiceId?: string | null;
  guestName?: string;
  status: RestaurantOrderStatus | string;
  paymentMethod?: string | null;
  cancellationReason?: string | null;
  cancelledByName?: string | null;
  preparingAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  cancelledAt?: string | null;
  statut?: string;
  envoyeeAt?: string | null;
  envoyeeById?: string | null;
  priseEnChargeAt?: string | null;
  priseEnChargeById?: string | null;
  priseEnChargeByName?: string | null;
  tempsPreparationMinutes?: number | null;
  heureFinPrevue?: string | null;
  preteAt?: string | null;
  preteById?: string | null;
  autoriseAt?: string | null;
  autoriseById?: string | null;
  autoriseByName?: string | null;
  serviAt?: string | null;
  serviById?: string | null;
  annuleAt?: string | null;
  annuleById?: string | null;
  motifAnnulation?: string | null;
  isStaleOver12h?: boolean;
  hasUnavailableItems?: boolean;
  subtotalHtFcfa?: number;
  vatRatePercent?: number;
  vatAmountFcfa?: number;
  totalTtcFcfa?: number;
  items: RestaurantOrderLineV3[];
  events?: RestaurantOrderEventV3[];
  syncPending?: boolean;
}

export interface RestaurantOrdersPage {
  items: RestaurantOrderV3[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface RestaurantMenuCatalog {
  categories: DishCategory[];
  products: DishItem[];
  roomsInStay: RestaurantInStayRoom[];
  activeCooksCount?: number;
}
