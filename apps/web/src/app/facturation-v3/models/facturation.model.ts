import {
  BillingLineCategory,
  BillingPaymentMethod,
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
