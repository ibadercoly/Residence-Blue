/**
 * Modèles de données pour le Tape Chart et Planning des réservations.
 * Tous les montants sont en FCFA entiers stricts (AGENTS.md).
 * Les textes et dénominations sont conformes à ADAPTATION-THIES.md.
 */

export interface PlanningDay {
  name: string; // 'Lun', 'Mar', etc.
  number: string; // '20', '21', '01'
  month: string; // 'Mai', 'Juin'
  isToday: boolean;
  isWeekend: boolean;
  dayIndex: number;
}

export type ReservationStatusType = 'CHECKOUT' | 'EN_SEJOUR' | 'CONFIRME' | 'ARRIVEE_AUJ' | 'CONFLIT';

export interface PlanningReservation {
  id: string;
  guestName: string;
  roomNumber: string;
  startDayIndex: number;
  durationDays: number;
  leftPercent: number;
  widthPercent: number;
  status: ReservationStatusType;
  statusLabel: string;
  icon?: string;
  nights: number;
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
  roomNumber: string;
  roomCategory: string;
  roomDescription: string;
  checkInDate: string;
  checkInDetails: string;
  checkOutDate: string;
  checkOutDetails: string;
  adultsCount: number;
  breakfastLabel: string;
  shuttleLabel: string;
  folio: FolioSummary;
  contact: {
    phone: string;
    email: string;
  };
  conciergeNote: string;
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
