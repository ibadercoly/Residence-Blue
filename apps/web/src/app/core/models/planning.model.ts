/**
 * Modèles de données pour le Planning des réservations (Résidence Blue).
 * Tous les montants sont en FCFA entiers stricts (AGENTS.md).
 * Semaine de 7 jours, sans scroll horizontal, 3 chiffres clés du jour.
 */

export interface PlanningDay {
  name: string; // 'Mar', 'Mer', etc.
  number: string; // '10', '11', '16'
  month: string; // 'Nov.', 'Déc.'
  isToday: boolean;
  isWeekend: boolean;
  dayIndex: number; // 0 à 6
  dateIso: string; // '2026-11-10'
}

export type ReservationStatusType = 'CHECKOUT' | 'EN_SEJOUR' | 'CONFIRME' | 'ARRIVEE_AUJ' | 'CONFLIT' | 'DEPART_AUJ';

export interface PlanningReservation {
  id: string;
  guestName: string;
  roomNumber: string;
  startDayIndex: number;
  durationDays: number;
  status: ReservationStatusType;
  statusLabel?: string;
  nights: number;
  checkInDate: string;
  checkOutDate: string;
  totalFcfa: number;
  remainingFcfa: number;
  contactPhone?: string;
  contactEmail?: string;
  leftPercent?: number;
  widthPercent?: number;
  icon?: string;
  isVip?: boolean;
  vipLabel?: string;
  subtitle?: string;
  isConflict?: boolean;
  isSelected?: boolean;
}

export interface FreeSlot {
  leftPercent: number;
  rightPercent: number;
  label: string;
}

export interface RelocationSlot {
  leftPercent: number;
  widthPercent: number;
  label: string;
  actionLabel: string;
}

export interface PlanningRoom {
  number: string;
  category: 'Standard' | 'Deluxe' | 'Suite';
  typeLabel: string;
  description: string;
  isConflict?: boolean;
  isHighlighted?: boolean;
  isSelected?: boolean;
  isRelocationTarget?: boolean;
  reservations: PlanningReservation[];
  freeSlot?: FreeSlot;
  relocationSlot?: RelocationSlot;
}

export interface FolioSummary {
  totalFcfa: number; // Entier strict
  paidFcfa: number; // Entier strict
  remainingFcfa: number; // Entier strict
  depositBadge: string;
  preferredPayment: string;
}

export interface SelectedReservationDetail {
  id: string;
  guestName: string;
  vipBadge?: string;
  statusBadge: string;
  status: ReservationStatusType;
  roomNumber: string;
  roomCategory: string;
  roomDescription: string;
  checkInDate: string;
  checkInDetails?: string;
  checkOutDate: string;
  checkOutDetails?: string;
  nights: number;
  adultsCount?: number;
  breakfastLabel?: string;
  shuttleLabel?: string;
  folio: FolioSummary;
  contact: {
    phone: string;
    email: string;
  };
  conciergeNote?: string;
}

export interface OccupancyStats {
  ratePercent: string;
  occupiedRooms: number;
  totalRooms: number;
  arrivalsCount: number;
  departuresCount: number;
  realtimeLabel: string;
}

export interface ConflictAlert {
  title: string;
  badge: string;
  roomNumber: string;
  roomName: string;
  period: string;
  message: string;
  suggestionText: string;
  targetRoomNumber: string;
  targetRoomName: string;
}

export interface HousekeepingOverview {
  title: string;
  detail: string;
}

export interface PlanningData {
  periodLabel: string;
  weeksLabel: string;
  days: PlanningDay[];
  occupancyStats: OccupancyStats;
  conflictAlert: ConflictAlert;
  rooms: PlanningRoom[];
  selectedReservation: SelectedReservationDetail;
  housekeeping: HousekeepingOverview;
}

export interface PlanningDailyMetrics {
  arrivalsToday: number;
  departuresToday: number;
  freeRoomsToday: number;
}

export type PlanningFilterType = 'ALL' | 'FREE' | 'OCCUPIED';
