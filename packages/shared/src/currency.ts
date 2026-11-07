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
