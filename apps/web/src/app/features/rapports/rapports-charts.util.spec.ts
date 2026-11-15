import {
  buildDonutSegments,
  buildEvolutionSvgGeometry,
  buildNiceMoneyScale,
  buildOccupancyBarsGeometry,
  buildRoomTicks,
  buildStackedWeeksGeometry,
  buildWeekdayGeometry,
  formatAxisFcfa,
  formatShortDateLabel,
  formatShortFcfa,
  formatWeekSummaryLabel,
  pickSpacedIndices,
  pickTopIndices,
} from './rapports-charts.util';

describe('rapports-charts.util', () => {
  it('espace régulièrement les étiquettes pour éviter tout chevauchement sur 30 jours', () => {
    const indices = pickSpacedIndices(30, 6);
    expect(indices).toHaveLength(6);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(29);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] - indices[i - 1]).toBeGreaterThanOrEqual(4);
    }
  });

  it('produit des graduations monétaires arrondies en clair sans abréviation k', () => {
    const scale = buildNiceMoneyScale(764000);
    expect(scale.ticks).toEqual([0, 200000, 400000, 600000, 800000]);
    expect(formatAxisFcfa(0, false)).toBe('0');
    expect(formatAxisFcfa(200000, false)).toBe('200 000');
    expect(formatAxisFcfa(600000, true)).toBe('600 000 F');
    expect(formatAxisFcfa(764000, true)).not.toContain('k');
  });

  it('produit des graduations entières de 0 à 12 pour les chambres actives', () => {
    expect(buildRoomTicks(12)).toEqual([0, 3, 6, 9, 12]);
    expect(buildRoomTicks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(buildRoomTicks(12).every((v) => Number.isInteger(v))).toBe(true);
  });

  it('formate les dates courtes et les libellés de semaine', () => {
    expect(formatShortDateLabel('09 nov.')).toBe('9 nov.');
    expect(formatShortDateLabel('12 oct.')).toBe('12 oct.');
    expect(formatWeekSummaryLabel('09 nov. - 15 nov.')).toBe('Semaine du 9 au 15 nov.');
    expect(formatWeekSummaryLabel('28 oct. - 03 nov.')).toBe('Semaine du 28 oct. au 3 nov.');
  });

  it('sélectionne les 3 plus hautes barres quand il y a plus de 12 barres', () => {
    const values = [1, 4, 2, 0, 9, 3, 1, 7, 2, 0, 5, 1, 8, 2, 1];
    const top3 = pickTopIndices(values, 3);
    expect(Array.from(top3).sort((a, b) => a - b)).toEqual([4, 7, 12]);
  });

  it('construit la géométrie SVG de la courbe avec comparatif, top 3, point bas et hauteur >= 340 desktop / >= 280 mobile', () => {
    const geoDesktop = buildEvolutionSvgGeometry({
      points: [
        { key: '2026-11-01', label: '01 nov.', amountFcfa: 50000 },
        { key: '2026-11-02', label: '02 nov.', amountFcfa: 120000 },
        { key: '2026-11-03', label: '03 nov.', amountFcfa: 20000 },
        { key: '2026-11-04', label: '04 nov.', amountFcfa: 90000 },
      ],
      previousPoints: [
        { key: '2026-10-01', label: '01 oct.', amountFcfa: 40000 },
        { key: '2026-10-02', label: '02 oct.', amountFcfa: 80000 },
      ],
      topKeys: [
        { key: '2026-11-02', rank: 1 },
        { key: '2026-11-04', rank: 2 },
        { key: '2026-11-01', rank: 3 },
      ],
      lowestKey: '2026-11-03',
      width: 1000,
      isMobile: false,
    });

    expect(geoDesktop.linePath.startsWith('M ')).toBe(true);
    expect(geoDesktop.prevPath.startsWith('M ')).toBe(true);
    expect(geoDesktop.currentCoords[1].isTop).toBe(true);
    expect(geoDesktop.currentCoords[2].isLowest).toBe(true);
    expect(geoDesktop.plotH).toBeGreaterThanOrEqual(340);
    expect(geoDesktop.yTicks.every((t) => !t.label.includes('k'))).toBe(true);

    const geoMobile = buildEvolutionSvgGeometry({
      points: [{ key: '2026-11-01', label: '01 nov.', amountFcfa: 50000 }],
      topKeys: [{ key: '2026-11-01', rank: 1 }],
      lowestKey: '2026-11-01',
      width: 320,
      isMobile: true,
    });
    expect(geoMobile.plotH).toBeGreaterThanOrEqual(280);
  });

  it('calcule les géométries des barres empilées, occupation (>= 60 % largeur), jours et donut', () => {
    const weeks = buildStackedWeeksGeometry(
      [
        {
          weekKey: '2026-11-02',
          label: '02 nov. - 08 nov.',
          accommodationFcfa: 80000,
          restaurantFcfa: 20000,
          otherFcfa: 10000,
          totalFcfa: 110000,
        },
        {
          weekKey: '2026-11-09',
          label: '09 nov. - 15 nov.',
          accommodationFcfa: 600000,
          restaurantFcfa: 120000,
          otherFcfa: 44000,
          totalFcfa: 764000,
        },
      ],
      { width: 960, isMobile: false },
    );
    expect(weeks.bars[0].hHeb).toBeGreaterThan(weeks.bars[0].hRest);
    expect(weeks.plotH).toBeGreaterThanOrEqual(340);
    expect(weeks.bars[0].showValue).toBe(true);
    expect(weeks.bars[0].barW / (weeks.plotW / 2)).toBeGreaterThanOrEqual(0.6);

    const occ = buildOccupancyBarsGeometry(
      Array.from({ length: 30 }, (_, idx) => ({
        dateIso: `2026-10-${String(idx + 1).padStart(2, '0')}`,
        label: `${idx + 1} oct.`,
        occupiedRooms: idx === 10 ? 8 : idx === 15 ? 6 : idx === 20 ? 5 : 2,
        activeRooms: 12,
        percent: 50,
      })),
      3.4,
      12,
      { width: 960, isMobile: false },
    );
    expect(occ.yTicks.map((t) => t.value)).toEqual([0, 3, 6, 9, 12]);
    expect(occ.plotRight).toBeLessThan(occ.width - 80);
    expect(occ.bars.filter((b) => b.showValue)).toHaveLength(3);
    expect(occ.bars[0].barW / (occ.plotW / 30)).toBeGreaterThanOrEqual(0.6);

    const wd = buildWeekdayGeometry(
      [
        { weekdayIndex: 0, label: 'Lundi', averageFcfa: 30000, totalFcfa: 60000, daysCount: 2 },
        { weekdayIndex: 5, label: 'Samedi', averageFcfa: 90000, totalFcfa: 180000, daysCount: 2 },
      ],
      { width: 960, isMobile: false },
    );
    expect(wd.bars[1].isBest).toBe(true);
    expect(wd.bars[0].isBest).toBe(false);
    expect(wd.plotH).toBeGreaterThanOrEqual(340);

    const donut = buildDonutSegments([
      { label: 'Espèces', amountFcfa: 50000, percent: 50, color: '#00666f' },
      { label: 'Wave', amountFcfa: 50000, percent: 50, color: '#b45309' },
    ]);
    expect(donut).toHaveLength(2);
    expect(formatShortFcfa(1500000)).toBe('1.5 M');
  });
});
