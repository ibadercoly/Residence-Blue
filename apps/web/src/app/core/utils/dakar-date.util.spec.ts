import {
  addDaysToIso,
  aujourdhuiDakar,
  aujourdhuiDakarIso,
  estAujourdhuiDakar,
  formatPlanningPeriodLabel,
  trouverIndexColonneAujourdhui,
} from './dakar-date.util';

describe('dakar-date.util (fuseau Africa/Dakar)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('calcule correctement un jour ordinaire en heure de Dakar', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T14:30:00.000Z'));

    expect(aujourdhuiDakar()).toEqual({ annee: 2026, mois: 6, jour: 15 });
    expect(aujourdhuiDakarIso()).toBe('2026-06-15');
  });

  it('gère correctement le dernier jour d’un mois et le passage au mois suivant', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-30T22:15:00.000Z'));

    expect(aujourdhuiDakarIso()).toBe('2026-04-30');
    expect(addDaysToIso('2026-04-30', 1)).toBe('2026-05-01');
  });

  it('gère le 28 février et le 29 février d’une année bissextile', () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-02-28T12:00:00.000Z'));
    expect(aujourdhuiDakarIso()).toBe('2024-02-28');
    expect(addDaysToIso('2024-02-28', 1)).toBe('2024-02-29');

    jest.setSystemTime(new Date('2024-02-29T12:00:00.000Z'));
    expect(aujourdhuiDakarIso()).toBe('2024-02-29');
    expect(addDaysToIso('2024-02-29', 1)).toBe('2024-03-01');

    // Année non bissextile
    expect(addDaysToIso('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('gère le 31 décembre à 23 h 59 et le 1er janvier à 00 h 01', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-12-31T23:59:00.000Z'));
    expect(aujourdhuiDakar()).toEqual({ annee: 2026, mois: 12, jour: 31 });
    expect(aujourdhuiDakarIso()).toBe('2026-12-31');

    jest.setSystemTime(new Date('2027-01-01T00:01:00.000Z'));
    expect(aujourdhuiDakar()).toEqual({ annee: 2027, mois: 1, jour: 1 });
    expect(aujourdhuiDakarIso()).toBe('2027-01-01');
  });

  it('retourne toujours la date de Dakar même si l’ordinateur est sur un autre fuseau', () => {
    // 23h30 UTC (Dakar = 31 déc.) correspond déjà au 1er janv. 00h30 à Paris (UTC+1) et 08h30 à Tokyo (UTC+9)
    const instantParisNextDay = new Date('2026-12-31T23:30:00.000Z');
    const getTimezoneOffsetSpy = jest
      .spyOn(Date.prototype, 'getTimezoneOffset')
      .mockReturnValue(-540); // Simule UTC+9 (Tokyo)

    try {
      expect(aujourdhuiDakarIso(instantParisNextDay)).toBe('2026-12-31');

      // 00h30 UTC (Dakar = 1er janv.) correspond encore au 31 déc. 19h30 à New York (UTC-5)
      getTimezoneOffsetSpy.mockReturnValue(300);
      const instantNewYorkPrevDay = new Date('2027-01-01T00:30:00.000Z');
      expect(aujourdhuiDakarIso(instantNewYorkPrevDay)).toBe('2027-01-01');
    } finally {
      getTimezoneOffsetSpy.mockRestore();
    }
  });

  it('trouve la colonne « Aujourd’hui » par comparaison de dates (et non par position)', () => {
    const days = [
      { dateIso: '2026-07-12' },
      { dateIso: '2026-07-13' },
      { dateIso: '2026-07-14' },
      { dateIso: '2026-07-15' },
      { dateIso: '2026-07-16' },
      { dateIso: '2026-07-17' },
      { dateIso: '2026-07-18' },
    ];

    expect(estAujourdhuiDakar('2026-07-15', '2026-07-15')).toBe(true);
    expect(estAujourdhuiDakar('2026-07-12', '2026-07-15')).toBe(false);
    expect(trouverIndexColonneAujourdhui(days, '2026-07-15')).toBe(3);
    expect(trouverIndexColonneAujourdhui(days, '2026-07-12')).toBe(0);
    expect(trouverIndexColonneAujourdhui(days, '2026-07-25')).toBe(-1);
  });

  it('formate correctement le libellé de période sur un mois, deux mois ou deux années', () => {
    expect(formatPlanningPeriodLabel('2026-11-10', '2026-11-16')).toBe('10 – 16 nov. 2026');
    expect(formatPlanningPeriodLabel('2026-11-28', '2026-12-04')).toBe('28 nov. – 04 déc. 2026');
    expect(formatPlanningPeriodLabel('2026-12-29', '2027-01-04')).toBe('29 déc. 2026 – 04 janv. 2027');
  });
});
