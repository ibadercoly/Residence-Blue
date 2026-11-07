/**
 * Types et interfaces de réservation pour Résidence Blue.
 */

export enum ReservationStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CHECKED_IN = 'CHECKED_IN',
  CHECKED_OUT = 'CHECKED_OUT',
  CANCELLED = 'CANCELLED',
  NO_SHOW = 'NO_SHOW',
}

export enum PaymentMethod {
  CASH = 'CASH',
  WAVE = 'WAVE',
  ORANGE_MONEY = 'ORANGE_MONEY',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export interface GuestDto {
  id: string; // UUID généré côté client
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  nationality?: string;
  identityDocumentNumber?: string; // Sera chiffré côté serveur en AES-256-GCM
}

export interface ReservationCreateDto {
  id: string; // UUID généré côté client
  idempotencyKey: string; // Idempotency-Key pour rejeu sans duplication
  roomId: string;
  guest: GuestDto;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  adultsCount: number;
  childrenCount: number;
  totalPriceFcfa: number; // Entier strict en FCFA
  notes?: string;
}

export interface PaymentDto {
  id: string; // UUID
  idempotencyKey: string;
  reservationId: string;
  amountFcfa: number; // Entier strict
  method: PaymentMethod;
  notes?: string;
  receivedAt: string;
}
