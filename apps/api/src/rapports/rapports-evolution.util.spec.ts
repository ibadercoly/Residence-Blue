import {
  buildEvolutionSection,
  DaySalesBucket,
  EVOLUTION_ALERT_DROP_PERCENT,
} from './rapports-evolution.util';
import { enumerateDakarDays, resolveDakarPeriodWindow } from './rapports-date.util';

const FORBIDDEN_CAUSAL_RE = /(à cause de|en raison de|parce que|grâce à|expliqué par)/i;

function makeBucket(total: number): DaySalesBucket {
  return { heb: total, rest: 0, other: 0, total };
}

describe('rapports-evolution.util', () => {
  it('compare le mois en cours avec les mêmes jours 1 à N du mois précédent (jamais le mois entier)', () => {
    const ref = new Date('2026-11-15T12:00:00.000Z');
    const win = resolveDakarPeriodWindow('mois', ref);
    expect(win.startIso).toBe('2026-11-01');
    expect(win.endInclusiveIso).toBe('2026-11-15');
    expect(win.prevStartIso).toBe('2026-10-01');
    expect(win.prevEndInclusiveIso).toBe('2026-10-15');

    // Cas fin de mois (31 mars -> 28 février en année non bissextile)
    const winMarch = resolveDakarPeriodWindow('mois', new Date('2026-03-31T12:00:00.000Z'));
    expect(winMarch.prevStartIso).toBe('2026-02-01');
    expect(winMarch.prevEndInclusiveIso).toBe('2026-02-28');
  });

  it('retourne undefined avec 1 seul jour non nul', () => {
    const win = resolveDakarPeriodWindow('30j', new Date('2026-11-15T12:00:00.000Z'));
    const currDays = enumerateDakarDays(win.startIso, win.endInclusiveIso);
    const prevDays = enumerateDakarDays(win.prevStartIso, win.prevEndInclusiveIso);
    const byDay = new Map<string, DaySalesBucket>([['2026-11-10', makeBucket(100000)]]);

    const evo = buildEvolutionSection({
      window: win,
      currDays,
      currByDay: byDay,
      currTotalRevenue: 100000,
      prevDays,
      prevByDay: new Map(),
      prevTotalRevenue: 0,
      previousPeriodHasData: false,
    });
    expect(evo).toBeUndefined();
  });

  it('omet les phrases dont les données manquent (période précédente vide, < 5 points, < 3 semaines)', () => {
    // 4 jours en début de mois (du 1er au 4 nov.) -> < 5 points (pas de tendance) et < 21 jours (pas d'habitude ni alerte)
    const win = resolveDakarPeriodWindow('mois', new Date('2026-11-04T12:00:00.000Z'));
    const currDays = enumerateDakarDays(win.startIso, win.endInclusiveIso);
    const prevDays = enumerateDakarDays(win.prevStartIso, win.prevEndInclusiveIso);
    const byDay = new Map<string, DaySalesBucket>([
      ['2026-11-01', makeBucket(50000)],
      ['2026-11-02', makeBucket(120000)],
      ['2026-11-03', makeBucket(90000)],
    ]);

    const evo = buildEvolutionSection({
      window: win,
      currDays,
      currByDay: byDay,
      currTotalRevenue: 260000,
      prevDays,
      prevByDay: new Map(),
      prevTotalRevenue: 0,
      previousPeriodHasData: false,
    });

    expect(evo).toBeDefined();
    expect(evo!.previousTotalFcfa).toBeUndefined();
    expect(evo!.deltaPercent).toBeUndefined();
    expect(evo!.insights.find((i) => i.type === 'total')?.text).not.toContain('période précédente');
    expect(evo!.insights.find((i) => i.type === 'trend')).toBeUndefined();
    expect(evo!.insights.find((i) => i.type === 'habit')).toBeUndefined();
    expect(evo!.insights.find((i) => i.type === 'alert')).toBeUndefined();
    expect(evo!.insights.find((i) => i.type === 'best_worst')).toBeDefined();
  });

  it('calcule exactement pics, plus bas, plus forte hausse/baisse, alerte >= 20 % et aucune phrase causale', () => {
    const win = resolveDakarPeriodWindow('30j', new Date('2026-11-15T12:00:00.000Z'));
    const currDays = enumerateDakarDays(win.startIso, win.endInclusiveIso);
    const prevDays = enumerateDakarDays(win.prevStartIso, win.prevEndInclusiveIso);
    const byDay = new Map<string, DaySalesBucket>();

    // Remplir 30 jours avec une baisse nette > 20 % sur les 7 derniers jours vs les 7 précédents
    currDays.forEach((dIso, idx) => {
      let amount = 100000;
      if (idx === 10) amount = 320000; // meilleur jour (+220 000 hausse)
      else if (idx === 11) amount = 120000; // plus forte baisse (-200 000)
      else if (idx === 5) amount = 45000; // jour le plus faible
      else if (idx >= 16 && idx < 23) amount = 150000; // 7 jours précédents = 1 050 000
      else if (idx >= 23) amount = 80000; // 7 derniers jours = 560 000 (-47 % >= 20 %)
      byDay.set(dIso, makeBucket(amount));
    });

    const total = Array.from(byDay.values()).reduce((s, b) => s + b.total, 0);
    const evo = buildEvolutionSection({
      window: win,
      currDays,
      currByDay: byDay,
      currTotalRevenue: total,
      prevDays,
      prevByDay: new Map(),
      prevTotalRevenue: 2000000,
      previousPeriodHasData: true,
    });

    expect(evo).toBeDefined();
    expect(evo!.trendLabel).toBe('Tendance sur 7 jours');
    expect(evo!.bestPoint.amountFcfa).toBe(320000);
    expect(evo!.lowestPoint.amountFcfa).toBe(45000);
    expect(evo!.biggestIncrease?.deltaFcfa).toBe(220000);
    expect(evo!.biggestDecrease?.deltaFcfa).toBe(-200000);

    // Alerte déclenchée car baisse >= 20 %
    const alert = evo!.insights.find((i) => i.type === 'alert');
    expect(alert).toBeDefined();
    expect(alert!.isAlert).toBe(true);
    expect(alert!.text).toContain('Attention');
    expect(EVOLUTION_ALERT_DROP_PERCENT).toBe(20);

    // Aucune phrase causale
    for (const ins of evo!.insights) {
      expect(ins.text).not.toMatch(FORBIDDEN_CAUSAL_RE);
    }
  });

  it('ne déclenche pas l’alerte quand la baisse des 7 derniers jours est inférieure à 20 % (ex. 19 %)', () => {
    const win = resolveDakarPeriodWindow('30j', new Date('2026-11-15T12:00:00.000Z'));
    const currDays = enumerateDakarDays(win.startIso, win.endInclusiveIso);
    const prevDays = enumerateDakarDays(win.prevStartIso, win.prevEndInclusiveIso);
    const byDay = new Map<string, DaySalesBucket>();

    currDays.forEach((dIso, idx) => {
      let amount = 100000;
      if (idx >= 16 && idx < 23) amount = 100000; // 700 000
      else if (idx >= 23) amount = 81000; // 567 000 -> baisse 19 % (< 20 %)
      byDay.set(dIso, makeBucket(amount));
    });

    const total = Array.from(byDay.values()).reduce((s, b) => s + b.total, 0);
    const evo = buildEvolutionSection({
      window: win,
      currDays,
      currByDay: byDay,
      currTotalRevenue: total,
      prevDays,
      prevByDay: new Map(),
      prevTotalRevenue: 0,
      previousPeriodHasData: false,
    });

    expect(evo).toBeDefined();
    expect(evo!.insights.find((i) => i.type === 'alert')).toBeUndefined();
  });
});
