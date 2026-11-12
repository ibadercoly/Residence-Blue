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
  amountFcfa: number;
  isTop: boolean;
  topRank?: number;
  isLowest: boolean;
}

export interface AxisTick {
  x: number;
  label: string;
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

export function pickSpacedIndices(length: number, maxTicks: number): number[] {
  if (length <= 0) return [];
  if (length <= maxTicks) return Array.from({ length }, (_, i) => i);
  const result = new Set<number>([0, length - 1]);
  const step = (length - 1) / (maxTicks - 1);
  for (let i = 1; i < maxTicks - 1; i++) {
    result.add(Math.round(i * step));
  }
  return Array.from(result).sort((a, b) => a - b);
}

export function buildEvolutionSvgGeometry(params: {
  points: RapportsEvolutionPoint[];
  previousPoints?: RapportsEvolutionPoint[];
  topKeys: Array<{ key: string; rank: number }>;
  lowestKey: string;
  width?: number;
  height?: number;
}) {
  const width = params.width ?? 760;
  const height = params.height ?? 240;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 34;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;

  const prev = params.previousPoints || [];
  const allValues = [
    ...params.points.map((p) => p.amountFcfa),
    ...prev.map((p) => p.amountFcfa),
    0,
  ];
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const span = Math.max(1, maxVal - minVal);

  const toY = (val: number) => padTop + ((maxVal - val) / span) * plotH;
  const n = Math.max(1, params.points.length);
  const toX = (idx: number) =>
    n === 1 ? padLeft + plotW / 2 : padLeft + (idx * plotW) / (n - 1);

  const topMap = new Map<string, number>(params.topKeys.map((t) => [t.key, t.rank]));

  const currentCoords: SvgCoordPoint[] = params.points.map((pt, idx) => ({
    x: toX(idx),
    y: toY(pt.amountFcfa),
    key: pt.key,
    label: pt.label,
    amountFcfa: pt.amountFcfa,
    isTop: topMap.has(pt.key),
    topRank: topMap.get(pt.key),
    isLowest: pt.key === params.lowestKey,
  }));

  const prevCoords = prev.map((pt, idx) => {
    const pN = Math.max(1, prev.length);
    const x = pN === 1 ? padLeft + plotW / 2 : padLeft + (idx * plotW) / (pN - 1);
    return { x, y: toY(pt.amountFcfa), label: pt.label, amountFcfa: pt.amountFcfa };
  });

  const tickIndices = pickSpacedIndices(params.points.length, 6);
  const xTicks: AxisTick[] = tickIndices.map((i) => ({
    x: currentCoords[i].x,
    label: currentCoords[i].label,
  }));

  const yTicks = [0, 0.5, 1].map((ratio) => {
    const val = Math.round(minVal + ratio * span);
    return { y: toY(val), value: val };
  });

  return {
    width,
    height,
    padLeft,
    padRight,
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

export function buildStackedWeeksGeometry(weeks: RapportsSalesByTypeWeek[]) {
  const width = 720;
  const height = 240;
  const padLeft = 64;
  const padRight = 18;
  const padTop = 26;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;

  const maxTotal = Math.max(
    ...weeks.map(
      (w) =>
        Math.max(0, w.accommodationFcfa) +
        Math.max(0, w.restaurantFcfa) +
        Math.max(0, w.otherFcfa),
    ),
    1,
  );
  const count = Math.max(1, weeks.length);
  const slotW = plotW / count;
  const barW = Math.min(44, Math.max(12, slotW * 0.62));

  const bars = weeks.map((w, idx) => {
    const heb = Math.max(0, w.accommodationFcfa);
    const rest = Math.max(0, w.restaurantFcfa);
    const other = Math.max(0, w.otherFcfa);
    const x = padLeft + idx * slotW + (slotW - barW) / 2;

    const hHeb = (heb / maxTotal) * plotH;
    const hRest = (rest / maxTotal) * plotH;
    const hOther = (other / maxTotal) * plotH;

    const yHeb = baseY - hHeb;
    const yRest = yHeb - hRest;
    const yOther = yRest - hOther;

    return {
      weekKey: w.weekKey,
      label: w.label,
      shortLabel: w.label.split(' - ')[0] || w.label,
      x,
      barW,
      heb,
      rest,
      other,
      total: w.totalFcfa,
      yHeb,
      hHeb,
      yRest,
      hRest,
      yOther,
      hOther,
      topY: yOther,
    };
  });

  const tickIndices = new Set(pickSpacedIndices(weeks.length, 6));
  const yTicks = [0, 0.5, 1].map((r) => {
    const val = Math.round(r * maxTotal);
    return { y: baseY - r * plotH, value: val };
  });

  return { width, height, padLeft, padRight, baseY, bars, tickIndices, yTicks };
}

export function buildOccupancyBarsGeometry(
  points: RapportsOccupancyDayPoint[],
  averageRooms: number,
  activeRoomsCount: number,
) {
  const width = 720;
  const height = 225;
  const padLeft = 48;
  const padRight = 18;
  const padTop = 26;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;

  const maxCap = Math.max(1, activeRoomsCount, ...points.map((p) => p.occupiedRooms));
  const count = Math.max(1, points.length);
  const slotW = plotW / count;
  const barW = Math.min(34, Math.max(5, slotW * 0.68));

  const bars = points.map((p, idx) => {
    const h = (p.occupiedRooms / maxCap) * plotH;
    return {
      ...p,
      x: padLeft + idx * slotW + (slotW - barW) / 2,
      y: baseY - h,
      barW,
      h,
    };
  });

  const avgY = baseY - (Math.min(maxCap, averageRooms) / maxCap) * plotH;
  const tickIndices = new Set(pickSpacedIndices(points.length, 6));
  const yTicks = [0, Math.round(maxCap / 2), maxCap];

  return {
    width,
    height,
    padLeft,
    padRight,
    baseY,
    plotH,
    maxCap,
    avgY,
    bars,
    tickIndices,
    yTicks: yTicks.map((v) => ({ value: v, y: baseY - (v / maxCap) * plotH })),
  };
}

export function buildWeekdayGeometry(items: RapportsWeekdayAverageItem[]) {
  const width = 640;
  const height = 220;
  const padLeft = 58;
  const padRight = 18;
  const padTop = 28;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const baseY = padTop + plotH;

  const maxVal = Math.max(...items.map((i) => Math.max(0, i.averageFcfa)), 1);
  const bestIdx = items.reduce(
    (best, curr, idx, arr) => (curr.averageFcfa > arr[best].averageFcfa ? idx : best),
    0,
  );
  const count = Math.max(1, items.length);
  const slotW = plotW / count;
  const barW = Math.min(48, slotW * 0.56);

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
    };
  });

  return { width, height, padLeft, padRight, baseY, bars };
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
