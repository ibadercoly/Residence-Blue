import { RapportsPeriodKey } from '@residence-blue/shared';

export interface DakarPeriodWindow {
  period: RapportsPeriodKey;
  periodLabel: string;
  startIso: string;
  endInclusiveIso: string;
  startDate: Date;
  endExclusiveDate: Date;
  prevStartIso: string;
  prevEndInclusiveIso: string;
  prevStartDate: Date;
  prevEndExclusiveDate: Date;
  granularity: 'day' | 'week' | 'month';
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
];

const FULL_MONTHS_FR = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const WEEKDAY_LABELS_FR = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

/**
 * Retourne la date YYYY-MM-DD exacte dans le fuseau Africa/Dakar (UTC+0 permanent).
 */
export function toDakarIsoDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function dakarStartOfDay(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function addDakarDays(isoDate: string, days: number): string {
  const dt = dakarStartOfDay(isoDate);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function addDakarMonthsFirstDay(isoDate: string, deltaMonths: number): string {
  const [yStr, mStr] = isoDate.split('-');
  const dt = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + deltaMonths, 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Lundi de la semaine Dakar contenant isoDate (semaine Lundi -> Dimanche).
 */
export function dakarWeekMonday(isoDate: string): string {
  const dt = dakarStartOfDay(isoDate);
  const utcDay = dt.getUTCDay(); // 0=Dim .. 6=Sam
  const offsetToMonday = utcDay === 0 ? -6 : 1 - utcDay;
  dt.setUTCDate(dt.getUTCDate() + offsetToMonday);
  return dt.toISOString().slice(0, 10);
}

/**
 * Index jour de semaine : 0 = Lundi .. 6 = Dimanche.
 */
export function dakarWeekdayIndex(isoDate: string): number {
  const utcDay = dakarStartOfDay(isoDate).getUTCDay();
  return utcDay === 0 ? 6 : utcDay - 1;
}

export function formatShortDakarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${SHORT_MONTHS_FR[(m || 1) - 1] || ''} ${y}`.replace(
    ` ${y}`,
    '',
  );
}

export function formatFullDakarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${SHORT_MONTHS_FR[(m || 1) - 1] || ''} ${y}`;
}

export function formatMonthYearFr(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  return `${FULL_MONTHS_FR[(m || 1) - 1] || ''} ${y}`;
}

export function enumerateDakarDays(startIso: string, endInclusiveIso: string): string[] {
  const out: string[] = [];
  let cursor = startIso;
  while (cursor <= endInclusiveIso) {
    out.push(cursor);
    cursor = addDakarDays(cursor, 1);
  }
  return out;
}

export function enumerateDakarMonths(startIso: string, endInclusiveIso: string): string[] {
  const out: string[] = [];
  let cursor = `${startIso.slice(0, 7)}-01`;
  const endMonth = `${endInclusiveIso.slice(0, 7)}-01`;
  while (cursor <= endMonth) {
    out.push(cursor.slice(0, 7));
    cursor = addDakarMonthsFirstDay(cursor, 1);
  }
  return out;
}

export function resolveDakarPeriodWindow(
  period: RapportsPeriodKey = '30j',
  referenceDate: Date = new Date(),
): DakarPeriodWindow {
  const todayIso = toDakarIsoDate(referenceDate);
  const tomorrowIso = addDakarDays(todayIso, 1);

  if (period === 'mois') {
    const startIso = `${todayIso.slice(0, 7)}-01`;
    const prevStartIso = addDakarMonthsFirstDay(startIso, -1);
    const prevEndInclusiveIso = addDakarDays(startIso, -1);
    return {
      period,
      periodLabel: `Mois en cours (${formatMonthYearFr(todayIso.slice(0, 7))})`,
      startIso,
      endInclusiveIso: todayIso,
      startDate: dakarStartOfDay(startIso),
      endExclusiveDate: dakarStartOfDay(tomorrowIso),
      prevStartIso,
      prevEndInclusiveIso,
      prevStartDate: dakarStartOfDay(prevStartIso),
      prevEndExclusiveDate: dakarStartOfDay(startIso),
      granularity: 'day',
    };
  }

  if (period === '3m') {
    const startIso = addDakarDays(todayIso, -89);
    const prevStartIso = addDakarDays(startIso, -90);
    const prevEndInclusiveIso = addDakarDays(startIso, -1);
    return {
      period,
      periodLabel: '3 derniers mois',
      startIso,
      endInclusiveIso: todayIso,
      startDate: dakarStartOfDay(startIso),
      endExclusiveDate: dakarStartOfDay(tomorrowIso),
      prevStartIso,
      prevEndInclusiveIso,
      prevStartDate: dakarStartOfDay(prevStartIso),
      prevEndExclusiveDate: dakarStartOfDay(startIso),
      granularity: 'week',
    };
  }

  if (period === '12m') {
    const thisMonthFirst = `${todayIso.slice(0, 7)}-01`;
    const startIso = addDakarMonthsFirstDay(thisMonthFirst, -11);
    const prevStartIso = addDakarMonthsFirstDay(thisMonthFirst, -23);
    const prevEndInclusiveIso = addDakarDays(startIso, -1);
    return {
      period,
      periodLabel: '12 derniers mois',
      startIso,
      endInclusiveIso: todayIso,
      startDate: dakarStartOfDay(startIso),
      endExclusiveDate: dakarStartOfDay(tomorrowIso),
      prevStartIso,
      prevEndInclusiveIso,
      prevStartDate: dakarStartOfDay(prevStartIso),
      prevEndExclusiveDate: dakarStartOfDay(startIso),
      granularity: 'month',
    };
  }

  // Défaut : 30 derniers jours
  const startIso = addDakarDays(todayIso, -29);
  const prevStartIso = addDakarDays(startIso, -30);
  const prevEndInclusiveIso = addDakarDays(startIso, -1);
  return {
    period: '30j',
    periodLabel: '30 derniers jours',
    startIso,
    endInclusiveIso: todayIso,
    startDate: dakarStartOfDay(startIso),
    endExclusiveDate: dakarStartOfDay(tomorrowIso),
    prevStartIso,
    prevEndInclusiveIso,
    prevStartDate: dakarStartOfDay(prevStartIso),
    prevEndExclusiveDate: dakarStartOfDay(startIso),
    granularity: 'day',
  };
}
