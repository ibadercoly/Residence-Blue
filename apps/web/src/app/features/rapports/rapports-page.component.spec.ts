import { signal } from '@angular/core';
import {
  formatRapportsDeltaPhrase,
  formatRapportsFcfa,
  RapportsPageComponent,
} from './rapports-page.component';
import { RapportsService } from './rapports.service';

describe('RapportsPageComponent & RapportsService (Commit 1)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formate les montants FCFA entiers et les phrases de variation sans jargon interdit', () => {
    expect(formatRapportsFcfa(125000)).toBe('125 000 FCFA');
    expect(formatRapportsDeltaPhrase(12)).toBe('▲ 12 % de plus que la période précédente');
    expect(formatRapportsDeltaPhrase(-8)).toBe('▼ 8 % de moins que la période précédente');
    expect(formatRapportsDeltaPhrase(0)).toBe('Identique à la période précédente');
  });

  it('désactive les exports quand hasData=false et active quand hasData=true en ligne', async () => {
    const online = signal<boolean>(true);
    const service = new RapportsService(
      { getAccessToken: () => 'fake-jwt-token' } as any,
      { isOnline: online.asReadonly() } as any,
    );
    const component = new RapportsPageComponent(service);

    const fetchSpy = jest.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        period: '30j',
        periodLabel: '30 derniers jours',
        startDateIso: '2026-10-14',
        endDateIso: '2026-11-12',
        timezone: 'Africa/Dakar',
        generatedAt: '2026-11-12T10:00:00.000Z',
        hotelName: 'Résidence Blue',
        activeRoomsCount: 12,
        hasData: false,
        previousPeriodHasData: false,
      }),
    } as any);

    await service.load('30j');
    expect(service.report()?.hasData).toBe(false);
    expect(component.canExport()).toBe(false);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        period: '30j',
        periodLabel: '30 derniers jours',
        startDateIso: '2026-10-14',
        endDateIso: '2026-11-12',
        timezone: 'Africa/Dakar',
        generatedAt: '2026-11-12T10:00:00.000Z',
        hotelName: 'Résidence Blue',
        activeRoomsCount: 12,
        hasData: true,
        previousPeriodHasData: false,
        tiles: { revenue: { amountFcfa: 50000 } },
      }),
    } as any);

    await service.load('30j');
    expect(component.canExport()).toBe(true);
  });

  it('bloque l’écran hors ligne sans jamais conserver de données financières', async () => {
    const online = signal<boolean>(false);
    const service = new RapportsService(
      { getAccessToken: () => 'fake-jwt-token' } as any,
      { isOnline: online.asReadonly() } as any,
    );
    const component = new RapportsPageComponent(service);

    await service.load('30j');
    expect(service.offlineBlocked()).toBe(true);
    expect(service.report()).toBeNull();
    expect(component.canExport()).toBe(false);
  });

  it('gère le 403 et le basculement de la comparaison', async () => {
    const online = signal<boolean>(true);
    const service = new RapportsService(
      { getAccessToken: () => 'fake-jwt-token' } as any,
      { isOnline: online.asReadonly() } as any,
    );
    const component = new RapportsPageComponent(service);

    jest.spyOn(globalThis as any, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 403,
    } as any);

    await service.load('30j');
    expect(service.forbiddenMessage()).toContain('Direction et à la Comptabilité');
    expect(service.report()).toBeNull();

    expect(service.comparePrevious()).toBe(true);
    component.onCompareToggle({ target: { checked: false } } as unknown as Event);
    expect(service.comparePrevious()).toBe(false);
  });
});
