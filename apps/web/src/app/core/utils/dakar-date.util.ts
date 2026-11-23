/** Fuseau horaire officiel du Sénégal (UTC+0 permanent, sans changement d'heure). */
export const DAKAR_TIMEZONE = 'Africa/Dakar';

export interface DakarDateParts {
  annee: number;
  mois: number;
  jour: number;
}

const SHORT_MONTHS_FR = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const;

const dakarDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: DAKAR_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Calcule la date du jour (année, mois 1-12, jour 1-31) dans le fuseau Africa/Dakar,
 * indépendamment du fuseau horaire configuré sur le navigateur ou l'ordinateur.
 */
export function aujourdhuiDakar(reference: Date = new Date()): DakarDateParts {
  const parts = dakarDateFormatter.formatToParts(reference);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { annee: year, mois: month, jour: day };
}

/** Formate { annee, mois, jour } au format ISO AAAA-MM-JJ. */
export function formatDakarDateIso(parts: DakarDateParts): string {
  const yyyy = String(parts.annee).padStart(4, '0');
  const mm = String(parts.mois).padStart(2, '0');
  const dd = String(parts.jour).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Retourne la date du jour au format ISO AAAA-MM-JJ dans le fuseau Africa/Dakar. */
export function aujourdhuiDakarIso(reference: Date = new Date()): string {
  return formatDakarDateIso(aujourdhuiDakar(reference));
}

/** Découpe une date ISO AAAA-MM-JJ en { annee, mois, jour }. */
export function parseIsoParts(dateIso: string): DakarDateParts {
  const [y, m, d] = dateIso.split('-').map(Number);
  return { annee: y, mois: m, jour: d };
}

/** Ajoute ou retranche un nombre entier de jours à une date ISO AAAA-MM-JJ (calcul UTC exact). */
export function addDaysToIso(dateIso: string, deltaDays: number): string {
  const { annee, mois, jour } = parseIsoParts(dateIso);
  const utcDate = new Date(Date.UTC(annee, mois - 1, jour + deltaDays));
  return formatDakarDateIso({
    annee: utcDate.getUTCFullYear(),
    mois: utcDate.getUTCMonth() + 1,
    jour: utcDate.getUTCDate(),
  });
}

/** Retourne le jour de la semaine (0 = Dim, ..., 6 = Sam) pour une date ISO AAAA-MM-JJ. */
export function getDayOfWeekFromIso(dateIso: string): number {
  const { annee, mois, jour } = parseIsoParts(dateIso);
  return new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay();
}

/** Compare deux dates ISO AAAA-MM-JJ pour savoir si une colonne correspond à aujourd'hui. */
export function estAujourdhuiDakar(dateIso: string, todayIso: string): boolean {
  return dateIso === todayIso;
}

/** Trouve l'index de la colonne « Aujourd'hui » par comparaison de dates (-1 si absente). */
export function trouverIndexColonneAujourdhui(
  days: ReadonlyArray<{ dateIso: string }>,
  todayIso: string,
): number {
  return days.findIndex((day) => estAujourdhuiDakar(day.dateIso, todayIso));
}

/**
 * Formate le libellé d'une période du planning sur une seule ligne.
 * Exemples : « 10 – 16 nov. 2026 », « 28 nov. – 04 déc. 2026 », « 29 déc. 2026 – 04 janv. 2027 ».
 */
export function formatPlanningPeriodLabel(firstIso: string, lastIso: string): string {
  const first = parseIsoParts(firstIso);
  const last = parseIsoParts(lastIso);
  const firstDay = String(first.jour).padStart(2, '0');
  const lastDay = String(last.jour).padStart(2, '0');
  const firstMonth = SHORT_MONTHS_FR[first.mois - 1] ?? '';
  const lastMonth = SHORT_MONTHS_FR[last.mois - 1] ?? '';

  if (first.annee === last.annee && first.mois === last.mois) {
    return `${firstDay} – ${lastDay} ${lastMonth} ${last.annee}`;
  }
  if (first.annee === last.annee) {
    return `${firstDay} ${firstMonth} – ${lastDay} ${lastMonth} ${last.annee}`;
  }
  return `${firstDay} ${firstMonth} ${first.annee} – ${lastDay} ${lastMonth} ${last.annee}`;
}
