/**
 * Types et interfaces partagés pour la facturation V3, la caisse du jour et les avoirs.
 * RÈGLE ABSOLUE : Les montants sont TOUJOURS stockés en ENTIERS FCFA (jamais de décimaux).
 */

export type BillingLineCategory =
  | 'HEBERGEMENT'
  | 'RESTAURANT'
  | 'PISCINE'
  | 'BLANCHISSERIE'
  | 'AUTRES';

export type InvoiceLineCategory =
  | BillingLineCategory
  | 'ROOM'
  | 'CONCIERGE'
  | 'HOUSEKEEPING'
  | 'TAX';

export type BillingPaymentMethod =
  | 'CASH'
  | 'ORANGE_MONEY'
  | 'WAVE'
  | 'CARD'
  | 'BANK_TRANSFER';

export type BillingDocumentType = 'INVOICE' | 'CREDIT_NOTE';

export interface BillingCounterKpis {
  toCollectFcfa: number;
  collectedTodayFcfa: number;
  unpaidCount: number;
  departuresTodayToSettleCount: number;
}

export interface DailyCashByMethod {
  CASH: number;
  ORANGE_MONEY: number;
  WAVE: number;
  CARD: number;
  BANK_TRANSFER: number;
}

export interface BillingDailyCash {
  dateIso: string;
  totalTodayFcfa: number;
  byMethod: DailyCashByMethod;
}

export interface BillingSummaryCard {
  id: string;
  invoiceNumber: string | null;
  displayNumber: string;
  documentType: BillingDocumentType;
  isIssued: boolean;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  guestId: string | null;
  guestName: string;
  roomNumber: string;
  stayStartDate: string | null;
  stayEndDate: string | null;
  stayLabel: string;
  totalFcfa: number;
  paidTotalFcfa: number;
  balanceFcfa: number;
  progressPercent: number;
  isDepartureToday: boolean;
  parentInvoiceId: string | null;
  updatedAt: string;
}

export interface BillingColumnPage {
  items: BillingSummaryCard[];
  total: number;
  hasMore: boolean;
}

export interface BillingCounterResponse {
  kpis: BillingCounterKpis;
  dailyCash: BillingDailyCash;
  columns: {
    toPay: BillingColumnPage;
    partial: BillingColumnPage;
    paid: BillingColumnPage;
  };
}

export interface BillingLineDetail {
  id: string;
  dateLabel: string;
  description: string;
  subDescription: string;
  category: BillingLineCategory;
  rawCategory: string;
  quantity: number;
  unitPriceFcfa: number;
  totalPriceFcfa: number;
  isSystem: boolean;
}

export interface BillingPaymentDetail {
  id: string;
  method: BillingPaymentMethod;
  methodLabel: string;
  amountFcfa: number;
  transactionRef: string | null;
  receivedByName: string;
  paidAt: string;
  isReversal: boolean;
  reversedPaymentId: string | null;
  reversalReason: string | null;
  alreadyReversed?: boolean;
}

export interface BillingCreditNoteLink {
  id: string;
  invoiceNumber: string | null;
  totalFcfa: number;
  reason: string | null;
  issuedAt: string;
}

export interface BillingSettingsSnapshot {
  vatRatePercent: number | null;
  serviceRatePercent: number | null;
  tourismTaxPerNightPerPerson: number | null;
  discountThresholdPercent: number | null;
}

export interface BillingNoteDetail {
  id: string;
  invoiceNumber: string | null;
  displayNumber: string;
  documentType: BillingDocumentType;
  isIssued: boolean;
  status: 'OPEN' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  reservationId: string | null;
  reservationStatus: string | null;
  guestId: string | null;
  guestName: string;
  phone: string;
  roomId: string | null;
  roomNumber: string;
  roomCategory: string;
  stayStartDate: string | null;
  stayEndDate: string | null;
  stayLabel: string;
  nights: number;
  adultsCount: number;
  lines: BillingLineDetail[];
  subtotalHtFcfa: number;
  discountFcfa: number;
  serviceRatePercent: number;
  serviceAmountFcfa: number;
  vatRatePercent: number;
  vatAmountFcfa: number;
  tourismTaxFcfa: number;
  totalFcfa: number;
  depositFcfa: number;
  paidAmountFcfa: number;
  balanceFcfa: number;
  totalInWordsFr: string;
  payments: BillingPaymentDetail[];
  parentInvoiceId: string | null;
  parentInvoiceNumber: string | null;
  creditNotes: BillingCreditNoteLink[];
  reason: string | null;
  forcedCheckout: boolean;
  forcedCheckoutReason: string | null;
  settings: BillingSettingsSnapshot;
  canCheckout: boolean;
  issuedAt: string;
  settledAt: string | null;
}

export interface InvoiceLineItem {
  id: string;
  date: string;
  description: string;
  subDescription: string;
  category: InvoiceLineCategory;
  icon?: string;
  quantity: string | number;
  unitPriceFcfa: number;
  totalPriceFcfa: number;
}

export interface InvoiceFolio {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  issueTime: string;
  roomNumber: string;
  roomCategory: string;
  roomName: string;
  guestName: string;
  phone: string;
  staySummary: string;
  items: InvoiceLineItem[];
  subtotalHtFcfa: number;
  vatRatePercent: number;
  vatAmountFcfa: number;
  tourismTaxAmountFcfa: number;
  totalTtcFcfa: number;
  depositAmountFcfa: number;
  targetDueFcfa: number;
  isPaid: boolean;
}
