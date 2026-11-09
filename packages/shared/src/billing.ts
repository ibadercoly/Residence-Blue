/**
 * Types et interfaces pour la facturation, les folios et la caisse (Z de caisse).
 * RÈGLE ABSOLUE AGENTS.MD : Les montants sont TOUJOURS stockés en ENTIERS (jamais de décimaux).
 */

export type InvoiceLineCategory = 'ROOM' | 'RESTAURANT' | 'CONCIERGE' | 'HOUSEKEEPING' | 'TAX';

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

export interface PaymentSplit {
  wave: number;
  waveRef: string;
  cash: number;
  cashReceived: number;
  orangeMoney: number;
  orangeMoneyRef: string;
  card: number;
}

export interface BillingEntity {
  companyName: string;
  ninea: string;
  address: string;
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
  vipTier?: string;
  passportNumber?: string;
  phone: string;
  staySummary: string;
  billingEntity: BillingEntity;
  items: InvoiceLineItem[];
  subtotalHtFcfa: number;
  vatRatePercent: number; // 10%
  vatAmountFcfa: number;
  tourismTaxAmountFcfa: number;
  totalTtcFcfa: number;
  depositAmountFcfa: number;
  depositLabel: string;
  targetDueFcfa: number;
  isPaid: boolean;
}

export interface ClosedFolioTransaction {
  id: string;
  invoiceNumber: string;
  roomNumber: string;
  guestName: string;
  amountFcfa: number;
  method: string;
  reference?: string;
  time: string;
}

export interface CashierShiftZReport {
  shiftId: string;
  date: string;
  operatorName: string;
  operatorRole: string;
  openingFloatFcfa: number;
  totalCollectedTodayFcfa: number;
  collectedByMethod: {
    wave: number;
    cash: number;
    orangeMoney: number;
    card: number;
  };
  transactionsCount: number;
  closedFolios: ClosedFolioTransaction[];
}
