import {
  RapportsEvolutionChangeMarker,
  RapportsEvolutionDetailedPoint,
  RapportsEvolutionInsight,
  RapportsEvolutionPoint,
  RapportsEvolutionSection,
  RapportsPeriodKey,
} from '@residence-blue/shared';
import {
  DakarPeriodWindow,
  dakarWeekdayIndex,
  dakarWeekMonday,
  enumerateDakarMonths,
  formatMonthYearFr,
  formatShortDakarDate,
  formatWeekdayShortDateFr,
} from './rapports-date.util';

/** Seuil de baisse (%) sur les 7 derniers jours vs 7 jours précédents déclenchant l'alerte. */
export const EVOLUTION_ALERT_DROP_PERCENT = 20;

/** Fenêtre (en jours) de la moyenne mobile en vue journalière et de l'alerte 7j vs 7j. */
export const EVOLUTION_TREND_WINDOW_DAYS = 7;

/** Nombre minimum de semaines (21 jours) requis pour la phrase d'habitude sur les jours de la semaine. */
export const EVOLUTION_HABIT_MIN_WEEKS = 3;

/** Nombre minimum de points non nuls pour afficher le diagramme et la phrase meilleur/pire. */
export const EVOLUTION_MIN_POINTS_BEST_WORST = 2;

/** Nombre minimum de périodes requis pour calculer la phrase de tendance (2e moitié vs 1re moitié). */
export const EVOLUTION_MIN_POINTS_TREND = 5;

const WEEKDAY_PLURAL_FR = [
  'lundis',
  'mardis',
  'mercredis',
  'jeudis',
  'vendredis',
  'samedis',
  'dimanches',
];

export interface DaySalesBucket {
  heb: number;
  rest: number;
  other: number;
  total: number;
}

function formatFcfaServer(amount: number): string {
  const safe = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(safe)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

function formatPeriodPhrase(period: RapportsPeriodKey): string {
  switch (period) {
    case 'mois':
      return 'ce mois';
    case '3m':
      return 'les 3 derniers mois';
    case '12m':
      return 'les 12 derniers mois';
    default:
      return 'les 30 derniers jours';
  }
}

function formatTransitionLabels(
  fromLabel: string,
  toLabel: string,
  granularity: 'day' | 'week' | 'month',
): string {
  if (granularity === 'day') {
    const fTokens = fromLabel.trim().split(/\s+/);
    const tTokens = toLabel.trim().split(/\s+/);
    if (
      fTokens.length === 2 &&
      tTokens.length === 2 &&
      fTokens[1].toLowerCase() === tTokens[1].toLowerCase()
    ) {
      return `du ${fTokens[0]} au ${toLabel}`;
    }
    return `du ${fromLabel} au ${toLabel}`;
  }
  return `de ${fromLabel} à ${toLabel}`;
}

function buildDetailedPoints(
  granularity: DakarPeriodWindow['granularity'],
  days: string[],
  byDay: Map<string, DaySalesBucket>,
): RapportsEvolutionDetailedPoint[] {
  if (days.length === 0) return [];

  if (granularity === 'day') {
    const raw = days.map((dIso) => {
      const b = byDay.get(dIso) || { heb: 0, rest: 0, other: 0, total: 0 };
      return {
        key: dIso,
        label: formatShortDakarDate(dIso),
        fullDateLabel: formatWeekdayShortDateFr(dIso),
        amountFcfa: b.total,
        accommodationFcfa: b.heb,
        restaurantFcfa: b.rest,
        otherFcfa: b.other,
      };
    });

    // Moyenne mobile sur 7 jours glissants, bornée >= 0
    return raw.map((pt, idx) => {
      const winStart = Math.max(0, idx - (EVOLUTION_TREND_WINDOW_DAYS - 1));
      let sum = 0;
      const len = idx - winStart + 1;
      for (let j = winStart; j <= idx; j++) {
        sum += Math.max(0, raw[j].amountFcfa);
      }
      return {
        ...pt,
        trendFcfa: Math.max(0, Math.round(sum / len)),
      };
    });
  }

  if (granularity === 'week') {
    const weekMap = new Map<string, DaySalesBucket>();
    const weekOrder: string[] = [];
    for (const dIso of days) {
      const wKey = dakarWeekMonday(dIso);
      if (!weekMap.has(wKey)) {
        weekMap.set(wKey, { heb: 0, rest: 0, other: 0, total: 0 });
        weekOrder.push(wKey);
      }
      const b = byDay.get(dIso);
      if (b) {
        const entry = weekMap.get(wKey)!;
        entry.heb += b.heb;
        entry.rest += b.rest;
        entry.other += b.other;
        entry.total += b.total;
      }
    }
    return weekOrder.map((wKey) => {
      const b = weekMap.get(wKey)!;
      const lbl = `Sem. ${formatShortDakarDate(wKey)}`;
      return {
        key: wKey,
        label: lbl,
        fullDateLabel: lbl,
        amountFcfa: b.total,
        accommodationFcfa: b.heb,
        restaurantFcfa: b.rest,
        otherFcfa: b.other,
        trendFcfa: Math.max(0, b.total),
      };
    });
  }

  const monthKeys = enumerateDakarMonths(days[0], days[days.length - 1]);
  const monthMap = new Map<string, DaySalesBucket>(
    monthKeys.map((m) => [m, { heb: 0, rest: 0, other: 0, total: 0 }]),
  );
  for (const dIso of days) {
    const ym = dIso.slice(0, 7);
    const b = byDay.get(dIso);
    const entry = monthMap.get(ym);
    if (b && entry) {
      entry.heb += b.heb;
      entry.rest += b.rest;
      entry.other += b.other;
      entry.total += b.total;
    }
  }
  return monthKeys.map((ym) => {
    const b = monthMap.get(ym)!;
    const lbl = formatMonthYearFr(ym);
    return {
      key: ym,
      label: lbl,
      fullDateLabel: lbl,
      amountFcfa: b.total,
      accommodationFcfa: b.heb,
      restaurantFcfa: b.rest,
      otherFcfa: b.other,
      trendFcfa: Math.max(0, b.total),
    };
  });
}

export function buildEvolutionSection(params: {
  window: DakarPeriodWindow;
  currDays: string[];
  currByDay: Map<string, DaySalesBucket>;
  currTotalRevenue: number;
  prevDays: string[];
  prevByDay: Map<string, DaySalesBucket>;
  prevTotalRevenue: number;
  previousPeriodHasData: boolean;
  previousPoints?: RapportsEvolutionPoint[];
}): RapportsEvolutionSection | undefined {
  const {
    window,
    currDays,
    currByDay,
    currTotalRevenue,
    prevTotalRevenue,
    previousPeriodHasData,
    previousPoints,
  } = params;

  const points = buildDetailedPoints(window.granularity, currDays, currByDay);
  const nonZero = points.filter((p) => p.amountFcfa !== 0);
  if (nonZero.length < EVOLUTION_MIN_POINTS_BEST_WORST) {
    return undefined;
  }

  const sortedDesc = [...nonZero].sort(
    (a, b) => b.amountFcfa - a.amountFcfa || a.key.localeCompare(b.key),
  );
  const sortedAsc = [...nonZero].sort(
    (a, b) => a.amountFcfa - b.amountFcfa || a.key.localeCompare(b.key),
  );

  const topPoints = sortedDesc.slice(0, 3).map((pt, idx) => ({
    key: pt.key,
    label: pt.label,
    amountFcfa: pt.amountFcfa,
    rank: (idx + 1) as 1 | 2 | 3,
  }));
  const best = sortedDesc[0];
  const lowest = sortedAsc[0];

  // Plus forte hausse et plus forte baisse entre deux périodes consécutives
  let biggestIncrease: RapportsEvolutionChangeMarker | undefined;
  let biggestDecrease: RapportsEvolutionChangeMarker | undefined;
  for (let i = 1; i < points.length; i++) {
    const prevPt = points[i - 1];
    const currPt = points[i];
    const diff = currPt.amountFcfa - prevPt.amountFcfa;
    if (diff > 0 && (!biggestIncrease || diff > biggestIncrease.deltaFcfa)) {
      biggestIncrease = {
        fromKey: prevPt.key,
        toKey: currPt.key,
        fromLabel: prevPt.label,
        toLabel: currPt.label,
        deltaFcfa: diff,
      };
    }
    if (diff < 0 && (!biggestDecrease || diff < biggestDecrease.deltaFcfa)) {
      biggestDecrease = {
        fromKey: prevPt.key,
        toKey: currPt.key,
        fromLabel: prevPt.label,
        toLabel: currPt.label,
        deltaFcfa: diff,
      };
    }
  }

  const averageFcfa = Math.round(currTotalRevenue / Math.max(1, points.length));
  const hasPrevComparison = previousPeriodHasData && prevTotalRevenue > 0;
  const deltaPercent = hasPrevComparison
    ? Math.round(((currTotalRevenue - prevTotalRevenue) * 100) / prevTotalRevenue)
    : undefined;

  // Construction déterministe des phrases « Ce que dit ce graphique » (sans jamais mentionner de cause)
  const insights: RapportsEvolutionInsight[] = [];

  // 1. Total de la période et comparaison
  const periodPhrase = formatPeriodPhrase(window.period);
  if (deltaPercent !== undefined) {
    if (deltaPercent > 0) {
      insights.push({
        type: 'total',
        direction: 'up',
        text: `Sur ${periodPhrase} : ${formatFcfaServer(currTotalRevenue)}, hausse de ${deltaPercent} % par rapport à la période précédente.`,
      });
    } else if (deltaPercent < 0) {
      insights.push({
        type: 'total',
        direction: 'down',
        text: `Sur ${periodPhrase} : ${formatFcfaServer(currTotalRevenue)}, baisse de ${Math.abs(deltaPercent)} % par rapport à la période précédente.`,
      });
    } else {
      insights.push({
        type: 'total',
        direction: 'flat',
        text: `Sur ${periodPhrase} : ${formatFcfaServer(currTotalRevenue)}, identique à la période précédente.`,
      });
    }
  } else {
    insights.push({
      type: 'total',
      text: `Sur ${periodPhrase} : ${formatFcfaServer(currTotalRevenue)}.`,
    });
  }

  // 2. Meilleur et pire jour (ou période)
  if (nonZero.length >= EVOLUTION_MIN_POINTS_BEST_WORST && best.key !== lowest.key) {
    if (window.granularity === 'day') {
      insights.push({
        type: 'best_worst',
        text: `Meilleur jour : ${best.fullDateLabel}, ${formatFcfaServer(best.amountFcfa)}. Jour le plus faible : ${lowest.fullDateLabel}, ${formatFcfaServer(lowest.amountFcfa)}.`,
      });
    } else {
      insights.push({
        type: 'best_worst',
        text: `Meilleure période : ${best.label}, ${formatFcfaServer(best.amountFcfa)}. Période la plus faible : ${lowest.label}, ${formatFcfaServer(lowest.amountFcfa)}.`,
      });
    }
  }

  // 3. Tendance : 2e moitié vs 1re moitié (minimum 5 points)
  if (points.length >= EVOLUTION_MIN_POINTS_TREND) {
    const mid = Math.floor(points.length / 2);
    const firstHalfSum = points.slice(0, mid).reduce((s, p) => s + p.amountFcfa, 0);
    const secondHalfSum = points.slice(points.length - mid).reduce((s, p) => s + p.amountFcfa, 0);
    if (firstHalfSum > 0) {
      const halfDelta = Math.round(((secondHalfSum - firstHalfSum) * 100) / firstHalfSum);
      const halfSubject =
        window.granularity === 'day' && points.length >= 14
          ? 'La deuxième quinzaine'
          : 'La seconde moitié de la période';
      if (halfDelta > 0) {
        insights.push({
          type: 'trend',
          direction: 'up',
          text: `${halfSubject} est en hausse de ${halfDelta} % par rapport à la première.`,
        });
      } else if (halfDelta < 0) {
        insights.push({
          type: 'trend',
          direction: 'down',
          text: `${halfSubject} est en baisse de ${Math.abs(halfDelta)} % par rapport à la première.`,
        });
      } else {
        insights.push({
          type: 'trend',
          direction: 'flat',
          text: `${halfSubject} est stable par rapport à la première.`,
        });
      }
    }
  }

  // 4. Plus forte hausse et plus forte baisse
  if (biggestIncrease || biggestDecrease) {
    const parts: string[] = [];
    if (biggestIncrease) {
      const spanTxt = formatTransitionLabels(
        biggestIncrease.fromLabel,
        biggestIncrease.toLabel,
        window.granularity,
      );
      parts.push(`Plus forte hausse : ${spanTxt} (+${formatFcfaServer(biggestIncrease.deltaFcfa)}).`);
    }
    if (biggestDecrease) {
      const spanTxt = formatTransitionLabels(
        biggestDecrease.fromLabel,
        biggestDecrease.toLabel,
        window.granularity,
      );
      parts.push(
        `Plus forte baisse : ${spanTxt} (\u2212${formatFcfaServer(Math.abs(biggestDecrease.deltaFcfa))}).`,
      );
    }
    insights.push({
      type: 'biggest_moves',
      text: parts.join(' '),
    });
  }

  // 5. Habitude : seulement si au moins 3 semaines de données (>= 21 jours)
  const minHabitDays = EVOLUTION_HABIT_MIN_WEEKS * 7;
  if (currDays.length >= minHabitDays) {
    const wdSum = new Array<number>(7).fill(0);
    const wdCnt = new Array<number>(7).fill(0);
    for (const dIso of currDays) {
      const idx = dakarWeekdayIndex(dIso);
      wdCnt[idx] += 1;
      wdSum[idx] += currByDay.get(dIso)?.total || 0;
    }
    const wdAvgs = wdSum.map((sum, idx) => (wdCnt[idx] > 0 ? Math.round(sum / wdCnt[idx]) : 0));
    const maxAvg = Math.max(...wdAvgs, 0);
    const bestIndices = wdAvgs
      .map((avg, idx) => ({ avg, idx }))
      .filter((entry) => entry.avg === maxAvg && entry.avg > 0);
    if (maxAvg > 0 && bestIndices.length === 1) {
      insights.push({
        type: 'habit',
        text: `Vos meilleurs jours sont les ${WEEKDAY_PLURAL_FR[bestIndices[0].idx]}.`,
      });
    }
  }

  // 6. Alerte neutre si les 7 derniers jours sont en baisse >= 20 % par rapport aux 7 jours précédents
  if (currDays.length >= EVOLUTION_TREND_WINDOW_DAYS * 2) {
    const n = currDays.length;
    const last7Days = currDays.slice(n - EVOLUTION_TREND_WINDOW_DAYS);
    const prev7Days = currDays.slice(
      n - EVOLUTION_TREND_WINDOW_DAYS * 2,
      n - EVOLUTION_TREND_WINDOW_DAYS,
    );
    const last7Sum = last7Days.reduce((s, d) => s + (currByDay.get(d)?.total || 0), 0);
    const prev7Sum = prev7Days.reduce((s, d) => s + (currByDay.get(d)?.total || 0), 0);
    if (prev7Sum > 0) {
      const dropPercent = Math.round(((prev7Sum - last7Sum) * 100) / prev7Sum);
      if (dropPercent >= EVOLUTION_ALERT_DROP_PERCENT) {
        insights.push({
          type: 'alert',
          direction: 'down',
          isAlert: true,
          text: `Attention : les ventes des 7 derniers jours sont en baisse de ${dropPercent} % par rapport aux 7 jours précédents.`,
        });
      }
    }
  }

  return {
    granularity: window.granularity,
    trendLabel: window.granularity === 'day' ? 'Tendance sur 7 jours' : 'Courbe de tendance',
    totalFcfa: currTotalRevenue,
    averageFcfa,
    ...(hasPrevComparison ? { previousTotalFcfa: prevTotalRevenue } : {}),
    ...(deltaPercent !== undefined ? { deltaPercent } : {}),
    points,
    ...(previousPoints ? { previousPoints } : {}),
    topPoints,
    lowestPoint: { key: lowest.key, label: lowest.label, amountFcfa: lowest.amountFcfa },
    bestPoint: { key: best.key, label: best.label, amountFcfa: best.amountFcfa },
    ...(biggestIncrease ? { biggestIncrease } : {}),
    ...(biggestDecrease ? { biggestDecrease } : {}),
    insights,
  };
}
