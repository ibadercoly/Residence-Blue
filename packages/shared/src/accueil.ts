export type AccueilBlocKey = 'CLIENTS' | 'BILLING' | 'RESTAURANT';

export type AccueilPaymentMethodCode =
  | 'CASH'
  | 'WAVE'
  | 'ORANGE_MONEY'
  | 'CARD'
  | 'BANK_TRANSFER';

export interface AccueilClientsStats {
  arrivalsDone: number;
  arrivalsExpected: number;
  departuresDone: number;
  departuresExpected: number;
  guestsInStay: number;
  newGuestsToday: number;
}

export interface AccueilPaymentMethodSlice {
  method: AccueilPaymentMethodCode;
  label: string;
  amountFcfa: number;
  percent: number;
}

export interface AccueilBillingStats {
  issuedInvoicesToday: number;
  notesToSettleCount: number;
  totalBilledTodayFcfa: number;
  totalCollectedTodayFcfa: number;
  remainingToCollectFcfa: number;
  collectedByMethod: AccueilPaymentMethodSlice[];
}

export interface AccueilTopDishItem {
  name: string;
  quantity: number;
  amountFcfa: number;
}

export interface AccueilRestaurantStats {
  ordersCount: number;
  revenueFcfa: number;
  topDish: AccueilTopDishItem | null;
  topDishes: AccueilTopDishItem[];
}

export interface AccueilJourResponse {
  dateDakarIso: string;
  timezone: 'Africa/Dakar';
  generatedAt: string;
  visibleBlocks: AccueilBlocKey[];
  clients?: AccueilClientsStats;
  billing?: AccueilBillingStats;
  restaurant?: AccueilRestaurantStats;
}
