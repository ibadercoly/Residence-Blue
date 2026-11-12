import {
  BillingLineCategory,
  BillingPaymentMethod,
  BillingSortField,
  BillingSortOrder,
  BillingSummaryCard,
} from '@residence-blue/shared';

export interface CategoryOption {
  value: BillingLineCategory;
  label: string;
}

export interface PaymentMethodOption {
  value: BillingPaymentMethod;
  label: string;
  needsRef: boolean;
}

export interface StatusBadgeStyle {
  label: string;
  bg: string;
  text: string;
  border: string;
}

export const BILLING_CATEGORY_OPTIONS: readonly CategoryOption[] = [
  { value: 'HEBERGEMENT', label: 'Hébergement' },
  { value: 'RESTAURANT', label: 'Restaurant' },
  { value: 'PISCINE', label: 'Piscine' },
  { value: 'BLANCHISSERIE', label: 'Blanchisserie' },
  { value: 'AUTRES', label: 'Autres' },
] as const;

export const BILLING_PAYMENT_METHOD_OPTIONS: readonly PaymentMethodOption[] = [
  { value: 'CASH', label: 'Espèces', needsRef: false },
  { value: 'ORANGE_MONEY', label: 'Orange Money', needsRef: true },
  { value: 'WAVE', label: 'Wave', needsRef: true },
  { value: 'CARD', label: 'Carte', needsRef: false },
  { value: 'BANK_TRANSFER', label: 'Virement', needsRef: true },
] as const;

export function hasPotentialCardPan(raw?: string | null): boolean {
  if (!raw) return false;
  const compact = raw.replace(/[\s-]/g, '');
  return /^\d{13,19}$/.test(compact);
}

export function formatFcfaPlain(amount: number): string {
  const safe = Math.round(amount || 0);
  return `${safe.toLocaleString('fr-FR')} FCFA`;
}

export function billingStatusBadge(
  row: Pick<BillingSummaryCard, 'status' | 'documentType' | 'isIssued' | 'balanceFcfa'>,
): StatusBadgeStyle {
  if (row.documentType === 'CREDIT_NOTE') {
    return { label: 'Avoir', bg: '#ffdad6', text: '#93000a', border: '#f4b4ae' };
  }
  if (row.status === 'CANCELLED') {
    return { label: 'Annulée', bg: '#e3ecee', text: '#3d494a', border: '#bdc9ca' };
  }
  if (row.status === 'PAID' || row.balanceFcfa <= 0) {
    return row.isIssued
      ? { label: 'Émise', bg: '#d8f0f2', text: '#004f56', border: '#9fd0d4' }
      : { label: 'Soldée à clôturer', bg: '#d8f0f2', text: '#004f56', border: '#00666f' };
  }
  if (row.status === 'PARTIAL') {
    return { label: 'Partielle', bg: '#fef3c7', text: '#78350f', border: '#fcd34d' };
  }
  return { label: 'À régler', bg: '#ffdad6', text: '#93000a', border: '#f4b4ae' };
}

export function nextSortState(
  currentField: BillingSortField,
  currentOrder: BillingSortOrder,
  clickedField: BillingSortField,
): { sortBy: BillingSortField; sortOrder: BillingSortOrder } {
  if (currentField === clickedField) {
    return { sortBy: clickedField, sortOrder: currentOrder === 'asc' ? 'desc' : 'asc' };
  }
  return {
    sortBy: clickedField,
    sortOrder: clickedField === 'balance' ? 'desc' : 'asc',
  };
}

export const BILLING_SHARED_TABLE_STYLES = `
  :host {
    display: block;
    width: 100%;
    min-width: 0;
    background-color: #f3fafe;
    color: #161d20;
    font-family: 'Manrope', sans-serif;
  }

  .rb-wrap {
    width: 100%;
    max-width: 1380px;
    margin: 0 auto;
    padding: 16px;
    box-sizing: border-box;
  }

  @media (min-width: 768px) {
    .rb-wrap {
      padding: 24px 28px;
    }
  }

  .rb-title {
    font-family: 'Newsreader', serif;
    color: #161d20;
    letter-spacing: -0.01em;
  }

  .rb-card {
    background-color: #ffffff;
    border: 1px solid #bdc9ca;
    border-radius: 12px;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .rb-btn {
    min-height: 42px;
    padding: 8px 14px;
    border-radius: 8px;
    font-weight: 700;
    font-size: 13px;
    line-height: 1.2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
    transition: background-color 150ms ease, border-color 150ms ease;
  }

  .rb-btn-sm {
    min-height: 32px;
    padding: 4px 10px;
    border-radius: 7px;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.2;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
    text-decoration: none;
    box-sizing: border-box;
    white-space: nowrap;
  }

  .rb-btn-primary {
    background-color: #00666f;
    color: #ffffff;
    border: 1px solid #00666f;
  }

  .rb-btn-primary:hover {
    background-color: #005158;
  }

  .rb-btn-outline {
    background-color: #ffffff;
    color: #00666f;
    border: 1px solid #00666f;
  }

  .rb-btn-outline:hover {
    background-color: #e6f3f4;
  }

  .rb-pill {
    min-height: 36px;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    border: 1px solid #bdc9ca;
    background-color: #ffffff;
    color: #161d20;
    cursor: pointer;
    transition: background-color 150ms ease, color 150ms ease, border-color 150ms ease;
  }

  .rb-pill-active {
    background-color: #00666f;
    color: #ffffff;
    border-color: #00666f;
  }

  .rb-table-scroll {
    width: 100%;
    max-height: min(764px, calc(100dvh - 180px));
    overflow-y: scroll;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: auto;
    scrollbar-color: #4f6264 #e6f0f2;
    background-color: #ffffff;
  }

  .rb-table-scroll::-webkit-scrollbar {
    width: 12px;
  }

  .rb-table-scroll::-webkit-scrollbar-track {
    background-color: #e6f0f2;
    border-left: 1px solid #d6e2e4;
  }

  .rb-table-scroll::-webkit-scrollbar-thumb {
    background-color: #4f6264;
    border-radius: 6px;
    border: 2px solid #e6f0f2;
  }

  .rb-table-scroll::-webkit-scrollbar-thumb:hover {
    background-color: #00666f;
  }

  .rb-table-head {
    position: sticky;
    top: 0;
    z-index: 10;
    min-height: 44px;
    background-color: #eef6f8;
    border-bottom: 2px solid #bdc9ca;
  }

  .rb-table-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(0, 0.65fr) minmax(0, 1.25fr) minmax(0, 0.9fr) minmax(0, 0.95fr) minmax(0, 1.05fr) minmax(0, 1.6fr);
    gap: 8px;
    align-items: center;
    padding: 4px 12px;
    box-sizing: border-box;
    min-width: 0;
  }

  .rb-table-row {
    min-height: 48px;
    border-bottom: 1px solid #e3ecee;
    cursor: pointer;
    transition: background-color 120ms ease;
  }

  .rb-table-row:hover {
    background-color: #f3fafe;
  }

  .rb-cell {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .rb-sort-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #161d20;
    background: transparent;
    border: none;
    padding: 4px 0;
    cursor: pointer;
    text-align: left;
  }

  .rb-sort-btn:hover {
    color: #00666f;
  }

  .rb-skeleton {
    background-color: #e2ecef;
    border-radius: 8px;
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      transition: none !important;
      animation: none !important;
    }
  }
`;
