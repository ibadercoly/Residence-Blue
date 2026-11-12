import {
  buildDonutSegments,
  buildEvolutionSvgGeometry,
  buildOccupancyBarsGeometry,
  buildStackedWeeksGeometry,
  buildWeekdayGeometry,
  formatShortFcfa,
  pickSpacedIndices,
} from './rapports-charts.util';

describe('rapports-charts.util (Commit 2)', () => {
  it('espace régulièrement les étiquettes pour éviter tout chevauchement sur 30 jours', () => {
    const indices = pickSpacedIndices(30, 6);
    expect(indices).toHaveLength(6);
    expect(indices[0]).toBe(0);
    expect(indices[indices.length - 1]).toBe(29);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i] - indices[i - 1]).toBeGreaterThanOrEqual(4);
    }
  });

  it('construit la géométrie SVG de la courbe avec comparatif, top 3 et point bas', () => {
    const geo = buildEvolutionSvgGeometry({
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
    });

    expect(geo.linePath.startsWith('M ')).toBe(true);
    expect(geo.prevPath.startsWith('M ')).toBe(true);
    expect(geo.currentCoords[1].isTop).toBe(true);
    expect(geo.currentCoords[2].isLowest).toBe(true);
  });

  it('calcule les géométries des barres empilées, occupation, jours et donut', () => {
    const weeks = buildStackedWeeksGeometry([
      {
        weekKey: '2026-11-02',
        label: '02 nov. - 08 nov.',
        accommodationFcfa: 80000,
        restaurantFcfa: 20000,
        otherFcfa: 10000,
        totalFcfa: 110000,
      },
    ]);
    expect(weeks.bars[0].hHeb).toBeGreaterThan(weeks.bars[0].hRest);

    const occ = buildOccupancyBarsGeometry(
      [{ dateIso: '2026-11-10', label: '10 nov.', occupiedRooms: 6, activeRooms: 12, percent: 50 }],
      6,
      12,
    );
    expect(occ.bars[0].occupiedRooms).toBe(6);

    const wd = buildWeekdayGeometry([
      { weekdayIndex: 0, label: 'Lundi', averageFcfa: 30000, totalFcfa: 60000, daysCount: 2 },
      { weekdayIndex: 5, label: 'Samedi', averageFcfa: 90000, totalFcfa: 180000, daysCount: 2 },
    ]);
    expect(wd.bars[1].isBest).toBe(true);
    expect(wd.bars[0].isBest).toBe(false);

    const donut = buildDonutSegments([
      { label: 'Espèces', amountFcfa: 50000, percent: 50, color: '#00666f' },
      { label: 'Wave', amountFcfa: 50000, percent: 50, color: '#b45309' },
    ]);
    expect(donut).toHaveLength(2);
    expect(formatShortFcfa(1500000)).toBe('1.5 M');
  });
});
