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
        page: { items: [], total: 0, offset: 0, limit: 50, hasMore: false },
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
    expect(spy).toHaveBeenCalledWith({
      search: 'Diop',
      filter: 'TO_PROCESS',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: 50,
    });
  });

  it('devrait effacer la recherche, exposer les 4 filtres et permettre le tri', () => {
    const spy = jest.spyOn(service, 'loadCounter').mockResolvedValue();
    component.searchQuery.set('101');
    component.clearSearch();

    expect(component.searchQuery()).toBe('');
    expect(component.filterPills.map((f) => f.key)).toEqual([
      'TO_PROCESS',
      'DEPARTURES_TODAY',
      'OVERDUE_24H',
      'PAID_TODAY',
    ]);
    expect(spy).toHaveBeenCalledWith({
      search: '',
      filter: 'TO_PROCESS',
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      limit: 50,
    });

    component.toggleSort('balance');
    expect(component.sortBy()).toBe('balance');
    expect(component.sortOrder()).toBe('desc');
    component.toggleSort('balance');
    expect(component.sortOrder()).toBe('asc');
  });
});
