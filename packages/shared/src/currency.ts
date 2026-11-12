/**
 * Utilitaires pour la devise FCFA (Franc CFA BCEAO).
 * RÈGLE ABSOLUE AGENTS.MD : Les montants sont TOUJOURS stockés en ENTIERS (jamais de décimaux).
 */

export function assertFcfaInteger(amount: number, allowNegative = false): void {
  if (!Number.isInteger(amount)) {
    throw new Error(`Le montant FCFA doit obligatoirement être un entier. Valeur reçue: ${amount}`);
  }
  if (!allowNegative && amount < 0) {
    throw new Error(`Le montant FCFA ne peut pas être négatif. Valeur reçue: ${amount}`);
  }
}

/**
 * Formate un montant en FCFA avec séparateurs de milliers.
 * Ex: 45000 -> "45 000 FCFA"
 */
export function formatFcfa(amount: number): string {
  assertFcfaInteger(amount, true);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);

  return `${formatted} FCFA`;
}

/**
 * Convertit une chaîne de caractères en entier FCFA.
 */
export function parseFcfa(value: string | number): number {
  if (typeof value === 'number') {
    assertFcfaInteger(value, true);
    return value;
  }

  // Nettoyage des espaces insécables et caractères non numériques (garder signe - éventuel)
  const cleaned = value.replace(/FCFA/gi, '').replace(/\s+/g, '').replace(/\u00a0/g, '').trim();
  const parsed = Number(cleaned);

  if (isNaN(parsed) || !Number.isInteger(parsed)) {
    throw new Error(`Impossible de convertir la valeur "${value}" en entier FCFA valide.`);
  }

  return parsed;
}

const FR_UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];

const FR_TENS = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

function under1000ToWords(n: number): string {
  if (n === 0) return '';
  if (n < 20) return FR_UNITS[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (ten === 7 || ten === 9) {
      const base = FR_TENS[ten];
      const sub = 10 + unit;
      if (ten === 7 && unit === 1) return 'soixante et onze';
      return `${base}-${FR_UNITS[sub]}`;
    }
    if (ten === 8) {
      if (unit === 0) return 'quatre-vingts';
      return `quatre-vingt-${FR_UNITS[unit]}`;
    }
    if (unit === 0) return FR_TENS[ten];
    if (unit === 1) return `${FR_TENS[ten]} et un`;
    return `${FR_TENS[ten]}-${FR_UNITS[unit]}`;
  }

  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  let prefix = '';
  if (hundreds === 1) {
    prefix = 'cent';
  } else {
    prefix = rem === 0 ? `${FR_UNITS[hundreds]} cents` : `${FR_UNITS[hundreds]} cent`;
  }
  return rem === 0 ? prefix : `${prefix} ${under1000ToWords(rem)}`;
}

/**
 * Convertit un montant entier FCFA en toutes lettres en français.
 */
export function numberToFrenchWordsFcfa(amount: number): string {
  assertFcfaInteger(amount, true);
  if (amount === 0) return 'Zéro franc CFA';

  const isNegative = amount < 0;
  let remaining = Math.abs(amount);
  const parts: string[] = [];

  const billions = Math.floor(remaining / 1_000_000_000);
  remaining %= 1_000_000_000;
  if (billions > 0) {
    parts.push(`${under1000ToWords(billions)} milliard${billions > 1 ? 's' : ''}`);
  }

  const millions = Math.floor(remaining / 1_000_000);
  remaining %= 1_000_000;
  if (millions > 0) {
    parts.push(`${under1000ToWords(millions)} million${millions > 1 ? 's' : ''}`);
  }

  const thousands = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${under1000ToWords(thousands)} mille`);
  }

  if (remaining > 0) {
    parts.push(under1000ToWords(remaining));
  }

  const absNum = Math.abs(amount);
  const unitWord = absNum <= 1 ? 'franc CFA' : 'francs CFA';
  const sentence = `${isNegative ? 'moins ' : ''}${parts.join(' ')} ${unitWord}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
