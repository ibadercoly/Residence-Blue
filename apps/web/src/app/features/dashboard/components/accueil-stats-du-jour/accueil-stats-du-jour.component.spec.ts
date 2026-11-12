import { AccueilStatsDuJourComponent, formatAccueilFcfa } from './accueil-stats-du-jour.component';

describe('AccueilStatsDuJourComponent helpers', () => {
  it('formate les montants en entiers FCFA lisibles', () => {
    expect(formatAccueilFcfa(15000)).toBe('15 000 FCFA');
    expect(formatAccueilFcfa(0)).toBe('0 FCFA');
    expect(formatAccueilFcfa(null)).toBe('0 FCFA');
  });

  it('calcule correctement les couleurs et largeurs des barres', () => {
    expect(AccueilStatsDuJourComponent.prototype.paymentColor('CASH')).toBe('#047857');
    expect(AccueilStatsDuJourComponent.prototype.topDishBarColor(0)).toBe('#c2410c');
    expect(
      AccueilStatsDuJourComponent.prototype.dishBarWidthPercent(5000, [
        { amountFcfa: 10000 },
        { amountFcfa: 5000 },
      ]),
    ).toBe(50);
    expect(
      AccueilStatsDuJourComponent.prototype.dishBarWidthPercent(0, [{ amountFcfa: 0 }]),
    ).toBe(0);
  });
});
