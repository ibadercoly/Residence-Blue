import {
  RapportsEvolutionPoint,
  RapportsOccupancyDayPoint,
  RapportsSalesByTypeWeek,
  RapportsWeekdayAverageItem,
} from '@residence-blue/shared';

export interface SvgCoordPoint {
  x: number;
  y: number;
  key: string;
  label: string;
  shortLabel: string;
  amountFcfa: number;
  isTop: boolean;
  topRank?: number;
  isLowest: boolean;
}

export interface AxisTick {
  x: number;
  label: string;
}

export interface YAxisTick {
  y: number;
  value: number;
  label: string;
}

export interface ChartSizeOptions {
  width?: number;
  plotHeight?: number;
  isMobile?: boolean;
}

export function buildLinearPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length === 0) return '';
  return coords
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
    .join(' ');
}

export function buildAreaPath(
  coords: Array<{ x: number; y: number }>,
  baseY: number,
): string {
  if (coords.length === 0) return '';
  const line = buildLinearPath(coords);
  const last = coords[coords.length - 1];
  const first = coords[0];
  return `${line} L ${last.x.toFixed(1)},${baseY.toFixed(1)} L ${first.x.toFixed(1)},${baseY.toFixed(1)} Z`;
}

export function formatPlainNumber(amount: number): string {
  const safe = Math.round(Number(amount) || 0);
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(safe)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ');
}

export function formatAxisFcfa(amount: number, withUnit: boolean): string {
  const rounded = Math.round(Number(amount) || 0);
  if (rounded === 0) return '0';
  const base = formatPlainNumber(rounded);
  return withUnit ? `${base} F` : base;
}

export function formatShortDateLabel(raw: string): string {
  const trimmed = (raw || '').trim();
  return trimmed.replace(/^0(\d)\b/, '$1');
}

export function formatWeekSummaryLabel(raw: string): string {
  const trimmed = (raw || '').trim();
  const parts = trimmed.split(/\s*-\s*/);
  if (parts.length !== 2) {
    return `Semaine du ${formatShortDateLabel(trimmed)}`;
  }
  const start = formatShortDateLabel(parts[0]);
  const end = formatShortDateLabel(parts[1]);
  const startTokens = start.split(/\s+/);
  const endTokens = end.split(/\s+/);
  if (
    startTokens.length === 2 &&
    endTokens.length === 2 &&
    startTokens[1].toLowerCase() === endTokens[1].toLowerCase()
  ) {
    return `Semaine du ${startTokens[0]} au ${end}`;
  }
  return `Semaine du ${start} au ${end}`;
}

export function buildNiceMoneyScale(maxValue: number): { max: number; ticks: number[] } {
  const safeMax = Math.max(0, Math.round(maxValue));
  if (safeMax === 0) {
    return { max: 100000, ticks: [0, 50000, 100000] };
  }

  const roughStep = safeMax / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const fraction = roughStep / magnitude;
  let niceFraction = 10;
  if (fraction <= 1) niceFraction = 1;
  else if (fraction <= 2) niceFraction = 2;
  else if (fraction <= 2.5) niceFraction = 2.5;
  else if (fraction <= 5) niceFraction = 5;

  const step = Math.max(1, Math.round(niceFraction * magnitude));
  const stepsCount = Math.max(2, Math.ceil(safeMax / step));
  const ticks = Array.from({ length: stepsCount + 1 }, (_, i) => i * step);
  return { max: stepsCount * step, ticks };
}

export function buildRoomTicks(maxCap: number): number[] {
  const cap = Math.max(1, Math.round(maxCap));
  if (cap <= 5) {
    return Array.from({ length: cap + 1 }, (_, i) => i);
  }
  if (cap % 4 === 0) {
    const step = cap / 4;
    return [0, step, step * 2, step * 3, cap];
  }
  if (cap % 3 === 0) {
    const step = cap / 3;
    return [0, step, step * 2, cap];
  }
  const step = Math.max(1, Math.round(cap / 4));
  const ticks: number[] = [0];
  for (let v = step; v < cap; v += step) {
    if (cap - v >= Math.max(1, Math.floor(step / 2))) {
      ticks.push(v);
    }
  }
  ticks.push(cap);
  return ticks;
}

export function pickSpacedIndices(length: number, maxTicks: number): number[] {
  if (length <= 0) return [];
  if (length <= maxTicks) return Array.from({ length }, (_, i) => i);
  const safeMax = Math.max(2, maxTicks);
  const result = new Set<number>([0, length - 1]);
  const step = (length - 1) / (safeMax - 1);
  for (let i = 1; i < safeMax - 1; i++) {
    result.add(Math.round(i * step));
  }
  return Array.from(result).sort((a, b) => a - b);
}

export function pickTopIndices(values: number[], limit = 3): Set<number> {
  const indexed = values
    .map((val, idx) => ({ val, idx }))
    .filter((entry) => entry.val > 0)
    .sort((a, b) => b.val - a.val || a.idx - b.idx);
  return new Set(indexed.slice(0, limit).map((e) => e.idx));
}

function computeMoneyPadLeft(ticks: YAxisTick[], isMobile: boolean): number {
  const maxChars = Math.max(...ticks.map((t) => t.label.length), 4);
  const charW = isMobile ? 7.6 : 9.2;
  const raw = Math.ceil(maxChars * charW) + (isMobile ? 14 : 18);
  return Math.max(isMobile ? 64 : 84, Math.min(isMobile ? 112 : 136, raw));
}

export function buildEvolutionSvgGeometry(params: {
  points: RapportsEvolutionPoint[];
  previousPoints?: RapportsEvolutionPoint[];
  topKeys: Array<{ key: string; rank: number }>;
  lowestKey: string;
  width?: number;
  plotHeight?: number;
  isMobile?: boolean;
}) {
  const isMobile = params.isMobile ?? false;
  const width = Math.max(260, Math.round(params.width ?? 900));
  const plotH = Math.max(isMobile ? 280 : 340, Math.round(params.plotHeight ?? (isMobile ? 290 : 350)));
  const padTop = isMobile ? 34 : 40;
  const padBottom = isMobile ? 36 : 42;
  const padRight = isMobile ? 18 : 28;
  const height = padTop + plotH + padBottom;
  const baseY = padTop + plotH;

  const prev = params.previousPoints || [];
  const allValues = [
    ...params.points.map((p) => p.amountFcfa),
    ...prev.map((p) => p.amountFcfa),
    0,
  ];
  const rawMax = Math.max(...allValues, 0);
  const scale = buildNiceMoneyScale(rawMax);
  const maxVal = scale.max;
  const minVal = 0;
  const span = Math.max(1, maxVal - minVal);

  const toY = (val: number) => padTop + ((maxVal - Math.max(0, val)) / span) * plotH;

  const yTicks: YAxisTick[] = scale.ticks.map((val, idx, arr) => ({
    y: toY(val),
    value: val,
    label: formatAxisFcfa(val, idx === arr.length - 1),
  }));

  const padLeft = computeMoneyPadLeft(yTicks, isMobile);
  const plotW = Math.max(120, width - padLeft - padRight);

  const n = Math.max(1, params.points.length);
  const toX = (idx: number) =>
    n === 1 ? padLeft + plotW / 2 : padLeft + (idx * plotW) / (n - 1);

  const topMap = new Map<string, number>(params.topKeys.map((t) => [t.key, t.rank]));

  const currentCoords: SvgCoordPoint[] = params.points.map((pt, idx) => ({
    x: toX(idx),
    y: toY(pt.amountFcfa),
    key: pt.key,
    label: formatShortDateLabel(pt.label),
    shortLabel: formatShortDateLabel(pt.label),
    amountFcfa: pt.amountFcfa,
    isTop: topMap.has(pt.key),
    topRank: topMap.get(pt.key),
    isLowest: pt.key === params.lowestKey,
  }));

  const prevCoords = prev.map((pt, idx) => {
    const pN = Math.max(1, prev.length);
    const x = pN === 1 ? padLeft + plotW / 2 : padLeft + (idx * plotW) / (pN - 1);
    return {
      x,
      y: toY(pt.amountFcfa),
      label: formatShortDateLabel(pt.label),
      amountFcfa: pt.amountFcfa,
    };
  });

  const maxTicks = Math.max(4, Math.min(7, Math.floor(plotW / (isMobile ? 74 : 105))));
  const tickIndices = pickSpacedIndices(params.points.length, maxTicks);
  const xTicks: AxisTick[] = tickIndices.map((i) => ({
    x: currentCoords[i].x,
    label: currentCoords[i].shortLabel,
  }));

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotW,
    plotH,
    baseY,
    zeroY: toY(0),
    linePath: buildLinearPath(currentCoords),
    areaPath: buildAreaPath(currentCoords, toY(0)),
    prevPath: buildLinearPath(prevCoords),
    currentCoords,
    prevCoords,
    xTicks,
    yTicks,
  };
}

export function buildStackedWeeksGeometry(
  weeks: RapportsSalesByTypeWeek[],
  options: ChartSizeOptions = {},
) {
  const isMobile = options.isMobile ?? false;
  const width = Math.max(260, Math.round(options.width ?? 900));
  const plotH = Math.max(isMobile ? 280 : 340, Math.round(options.plotHeight ?? (isMobile ? 290 : 350)));
  const padTop = isMobile ? 34 : 40;
  const padBottom = isMobile ? 36 : 42;
  const padRight = isMobile ? 16 : 24;
  const height = padTop + plotH + padBottom;
  const baseY = padTop + plotH;

  const totals = weeks.map(
    (w) =>
      Math.max(0, w.accommodationFcfa) +
      Math.max(0, w.restaurantFcfa) +
      Math.max(0, w.otherFcfa),
  );
  const rawMax = Math.max(...totals, 0);
  const scale = buildNiceMoneyScale(rawMax);
  const maxTotal = scale.max;

  const yTicks: YAxisTick[] = scale.ticks.map((val, idx, arr) => ({
    y: baseY - (val / maxTotal) * plotH,
    value: val,
    label: formatAxisFcfa(val, idx === arr.length - 1),
  }));

  const padLeft = computeMoneyPadLeft(yTicks, isMobile);
  const plotW = Math.max(120, width - padLeft - padRight);

  const count = Math.max(1, weeks.length);
  const slotW = plotW / count;
  const gap = Math.max(2, Math.min(20, slotW * 0.26));
  const barW = Math.max(6, Math.min(slotW - 2, slotW - gap));

  const top3 = pickTopIndices(totals, 3);
  const showAllValues = weeks.length <= 12;

  const bars = weeks.map((w, idx) => {
    const heb = Math.max(0, w.accommodationFcfa);
    const rest = Math.max(0, w.restaurantFcfa);
    const other = Math.max(0, w.otherFcfa);
    const total = heb + rest + other;
    const x = padLeft + idx * slotW + (slotW - barW) / 2;

    const hHeb = (heb / maxTotal) * plotH;
    const hRest = (rest / maxTotal) * plotH;
    const hOther = (other / maxTotal) * plotH;

    const yHeb = baseY - hHeb;
    const yRest = yHeb - hRest;
    const yOther = yRest - hOther;

    const startLabel = formatShortDateLabel(w.label.split(' - ')[0] || w.label);

    return {
      weekKey: w.weekKey,
      label: w.label,
      summaryLabel: formatWeekSummaryLabel(w.label),
      shortLabel: startLabel,
      x,
      barW,
      heb,
      rest,
      other,
      total: w.totalFcfa || total,
      yHeb,
      hHeb,
      yRest,
      hRest,
      yOther,
      hOther,
      topY: yOther,
      showValue: (w.totalFcfa || total) > 0 && (showAllValues || top3.has(idx)),
      valueLabel: formatAxisFcfa(w.totalFcfa || total, true),
    };
  });

  const maxTicks = Math.max(4, Math.min(8, Math.floor(plotW / (isMobile ? 74 : 105))));
  const tickIndices = new Set(pickSpacedIndices(weeks.length, maxTicks));

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotW,
    plotH,
    baseY,
    bars,
    tickIndices,
    yTicks,
  };
}

export function buildOccupancyBarsGeometry(
  points: RapportsOccupancyDayPoint[],
  averageRooms: number,
  activeRoomsCount: number,
  options: ChartSizeOptions = {},
) {
  const isMobile = options.isMobile ?? false;
  const width = Math.max(260, Math.round(options.width ?? 900));
  const plotH = Math.max(isMobile ? 280 : 340, Math.round(options.plotHeight ?? (isMobile ? 290 : 350)));
  const padTop = isMobile ? 34 : 40;
  const padBottom = isMobile ? 36 : 42;
  const padLeft = isMobile ? 42 : 52;
  // Marge droite réservée à l'étiquette de la ligne de moyenne, hors des barres
  const padRight = isMobile ? 86 : 112;
  const height = padTop + plotH + padBottom;
  const baseY = padTop + plotH;
  const plotW = Math.max(120, width - padLeft - padRight);
  const plotRight = padLeft + plotW;

  const maxCap = Math.max(1, Math.round(activeRoomsCount), ...points.map((p) => p.occupiedRooms));
  const count = Math.max(1, points.length);
  const slotW = plotW / count;
  const gap = Math.max(1.5, Math.min(14, slotW * 0.28));
  const barW = Math.max(3, Math.min(slotW - 1.5, slotW - gap));

  const top3 = pickTopIndices(
    points.map((p) => p.occupiedRooms),
    3,
  );
  const showAllValues = points.length <= 12;

  const bars = points.map((p, idx) => {
    const h = (p.occupiedRooms / maxCap) * plotH;
    const cleanLabel = formatShortDateLabel(p.label);
    return {
      ...p,
      cleanLabel,
      x: padLeft + idx * slotW + (slotW - barW) / 2,
      y: baseY - h,
      barW,
      h,
      showValue: p.occupiedRooms > 0 && (showAllValues || top3.has(idx)),
    };
  });

  const avgY = baseY - (Math.min(maxCap, Math.max(0, averageRooms)) / maxCap) * plotH;
  const maxTicks = Math.max(4, Math.min(7, Math.floor(plotW / (isMobile ? 74 : 105))));
  const tickIndices = new Set(pickSpacedIndices(points.length, maxTicks));
  const roomTicks = buildRoomTicks(maxCap);

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotW,
    plotH,
    plotRight,
    baseY,
    maxCap,
    avgY,
    bars,
    tickIndices,
    yTicks: roomTicks.map((v) => ({
      value: v,
      label: String(v),
      y: baseY - (v / maxCap) * plotH,
    })),
  };
}

export function buildWeekdayGeometry(
  items: RapportsWeekdayAverageItem[],
  options: ChartSizeOptions = {},
) {
  const isMobile = options.isMobile ?? false;
  const width = Math.max(260, Math.round(options.width ?? 900));
  const plotH = Math.max(isMobile ? 280 : 340, Math.round(options.plotHeight ?? (isMobile ? 290 : 350)));
  const padTop = isMobile ? 34 : 40;
  const padBottom = isMobile ? 36 : 42;
  const padRight = isMobile ? 16 : 24;
  const height = padTop + plotH + padBottom;
  const baseY = padTop + plotH;

  const rawMax = Math.max(...items.map((i) => Math.max(0, i.averageFcfa)), 0);
  const scale = buildNiceMoneyScale(rawMax);
  const maxVal = scale.max;

  const yTicks: YAxisTick[] = scale.ticks.map((val, idx, arr) => ({
    y: baseY - (val / maxVal) * plotH,
    value: val,
    label: formatAxisFcfa(val, idx === arr.length - 1),
  }));

  const padLeft = computeMoneyPadLeft(yTicks, isMobile);
  const plotW = Math.max(120, width - padLeft - padRight);

  const bestIdx = items.reduce(
    (best, curr, idx, arr) => (curr.averageFcfa > arr[best].averageFcfa ? idx : best),
    0,
  );
  const count = Math.max(1, items.length);
  const slotW = plotW / count;
  const gap = Math.max(4, Math.min(20, slotW * 0.28));
  const barW = Math.max(12, Math.min(slotW - 4, slotW - gap));

  const bars = items.map((item, idx) => {
    const val = Math.max(0, item.averageFcfa);
    const h = (val / maxVal) * plotH;
    return {
      ...item,
      x: padLeft + idx * slotW + (slotW - barW) / 2,
      y: baseY - h,
      barW,
      h,
      isBest: val > 0 && idx === bestIdx,
      showValue: val > 0,
      valueLabel: formatAxisFcfa(val, !isMobile),
    };
  });

  return {
    width,
    height,
    padLeft,
    padRight,
    padTop,
    padBottom,
    plotW,
    plotH,
    baseY,
    yTicks,
    bars,
  };
}

export function buildDonutSegments(
  items: Array<{ label: string; amountFcfa: number; percent: number; color: string }>,
) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const total = items.reduce((s, i) => s + Math.max(0, i.amountFcfa), 0);
  let offset = 0;

  return items.map((it) => {
    const ratio = total > 0 ? Math.max(0, it.amountFcfa) / total : 0;
    const length = ratio * circumference;
    const seg = {
      ...it,
      dasharray: `${length.toFixed(2)} ${circumference.toFixed(2)}`,
      dashoffset: (-offset).toFixed(2),
    };
    offset += length;
    return seg;
  });
}

export function formatShortFcfa(amount: number): string {
  const abs = Math.abs(Math.round(amount));
  if (abs >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace('.0', '')} M`;
  }
  if (abs >= 1_000) {
    return `${Math.round(amount / 1_000)} k`;
  }
  return String(Math.round(amount));
}
