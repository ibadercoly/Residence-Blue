import { ComptoirPageComponent } from './comptoir-page.component';
import { FacturationService } from '../services/facturation.service';

describe('ComptoirPageComponent (Facturation V3)', () => {
  let component: ComptoirPageComponent;
  let service: FacturationService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        kpis: {
          toCollectFcfa: 0,
          collectedTodayFcfa: 0,
          unpaidCount: 0,
          departuresTodayToSettleCount: 0,
        },
        dailyCash: {
          dateIso: '2026-11-12',
          totalTodayFcfa: 0,
          byMethod: {
            CASH: 0,
            ORANGE_MONEY: 0,
            WAVE: 0,
            CARD: 0,
            BANK_TRANSFER: 0,
          },
        },
        columns: {
          toPay: { items: [], total: 0, hasMore: false },
          partial: { items: [], total: 0, hasMore: false },
          paid: { items: [], total: 0, hasMore: false },
        },
      }),
    } as Response);

    component = new ComptoirPageComponent();
    service = component.service;
  });

  afterEach(() => {
    component.ngOnDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('devrait débouncer la recherche serveur de 200 ms sans requêtes prématurées', () => {
    const spy = jest.spyOn(service, 'loadCounter').mockResolvedValue();

    component.onSearchInput({ target: { value: 'D' } } as unknown as Event);
    component.onSearchInput({ target: { value: 'Di' } } as unknown as Event);
    component.onSearchInput({ target: { value: 'Diop' } } as unknown as Event);

    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(199);
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ search: 'Diop' });
  });

  it('devrait effacer la recherche et exposer les trois colonnes fixes', () => {
    const spy = jest.spyOn(service, 'loadCounter').mockResolvedValue();
    component.searchQuery.set('101');
    component.clearSearch();

    expect(component.searchQuery()).toBe('');
    expect(spy).toHaveBeenCalledWith({ search: '' });
    expect(component.columnsMeta().map((c) => c.key)).toEqual([
      'toPay',
      'partial',
      'paid',
    ]);
  });
});
