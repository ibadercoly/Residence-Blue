/**
 * Modèles de données pour le modal Nouvelle Réservation.
 * Conforme à AGENTS.md (FCFA entiers stricts) et ADAPTATION-THIES.md.
 */

export type GuestMode = 'REGULAR' | 'NEW';

export type RoomCategoryType = 'Standard' | 'Deluxe' | 'Suite';

export type PaymentStatusType = 'PERCU' | 'EN_ATTENTE';

export type PaymentChannelType = 'WAVE' | 'ORANGE_MONEY' | 'CARTE_TPE' | 'ESPECES';

export interface RegularGuest {
  id: string;
  name: string;
  initials: string;
  vipBadge?: string;
  vipIcon?: string;
  phone: string;
  email: string;
  city: string;
}

export interface NewGuestData {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  isVip?: boolean;
}

export interface CategoryCardOption {
  id: RoomCategoryType;
  title: string;
  subtitle: string;
  ratePerNightFcfa: number; // Entier strict
  badge?: string;
  badgeType?: 'primary' | 'secondary' | 'neutral';
  availableCountLabel: string;
  recommended?: boolean;
}

export interface SpecificRoomOption {
  number: string;
  category: RoomCategoryType;
  label: string;
  floor: string;
  details: string;
  imageFileName: string;
}

export interface ReservationModalParams {
  roomNumber?: string;
  category?: RoomCategoryType;
  checkInDate?: string;
  checkOutDate?: string;
  guestId?: string;
}

export interface ReservationCostBreakdown {
  nights: number;
  ratePerNightFcfa: number;
  accommodationTotalFcfa: number;
  breakfastIncluded: boolean;
  extraChildBedFcfa: number;
  airportShuttleFcfa: number;
  cityTaxFcfa: number; // 1000 FCFA par adulte par nuit
  totalStayTtcFcfa: number;
  depositAmountFcfa: number;
  depositPercentage: number;
  remainingBalanceFcfa: number;
}

export interface ReservationSubmitPayload {
  guestMode: GuestMode;
  regularGuestId?: string;
  newGuest?: NewGuestData;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  adultsCount: number;
  childrenCount: number;
  category: RoomCategoryType;
  roomNumber: string;
  depositAmountFcfa: number;
  paymentStatus: PaymentStatusType;
  paymentChannel: PaymentChannelType;
  airportShuttleIncluded: boolean;
  specialRequests: string;
  breakdown: ReservationCostBreakdown;
}
