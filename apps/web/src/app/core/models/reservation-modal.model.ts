export type RoomCategoryType = 'Standard' | 'Deluxe' | 'Suite';

export type PaymentMethodType =
  | 'CASH'
  | 'ORANGE_MONEY'
  | 'WAVE'
  | 'CARD'
  | 'BANK_TRANSFER';

export type ReservationSourceType =
  | 'RECEPTION'
  | 'TELEPHONE'
  | 'WHATSAPP'
  | 'EN_LIGNE'
  | 'ENTREPRISE';

export interface AvailableRoomItem {
  id: string;
  number: string;
  category: string;
  floor: number;
  adultsCapacity: number;
  childrenCapacity: number;
  capacity: number;
  pricePerNight: number;
  breakfastIncluded: boolean;
}

export interface HotelRatesConfig {
  tourismTaxPerNightPerPerson: number;
  vatRatePercent: number;
}

export interface AvailableRoomsResponse {
  checkIn: string;
  checkOut: string;
  nights: number;
  total: number;
  rates: HotelRatesConfig;
  items: AvailableRoomItem[];
}

export interface GuestQuickSearchItem {
  id: string;
  fullName: string;
  phone: string;
}

export interface ReservationModalParams {
  roomId?: string;
  roomNumber?: string;
  category?: RoomCategoryType;
  checkInDate?: string;
  checkOutDate?: string;
  guestId?: string;
  guestName?: string;
  guestPhone?: string;
}

export interface CreateReservationPayload {
  roomId: string;
  roomNumber?: string;
  guestId?: string;
  newGuest?: {
    fullName: string;
    phone: string;
  };
  checkInDate: string;
  checkOutDate: string;
  adultsCount: number;
  childrenCount: number;
  depositFcfa: number;
  discountFcfa?: number;
  paymentMethod?: PaymentMethodType;
  transactionRef?: string;
  breakfastIncluded: boolean;
  source: ReservationSourceType;
  notes?: string;
}

export interface CreatedReservationResponse {
  id: string;
  reference: string;
  guestId: string;
  guestName: string;
  roomId: string;
  roomNumber: string;
  roomCategory: string;
  ratePerNightFcfa: number;
  startDayIndex: number;
  durationDays: number;
  checkInDate: string;
  checkOutDate: string;
  dbStatus: string;
  status: string;
  statusLabel: string;
  adultsCount: number;
  childrenCount: number;
  nights: number;
  source: ReservationSourceType;
  breakfastIncluded: boolean;
  discountFcfa: number;
  tourismTaxFcfa: number;
  depositFcfa: number;
  totalFcfa: number;
  remainingFcfa: number;
  contactPhone: string;
  contactEmail: string;
  notes: string;
  paymentId?: string;
}
