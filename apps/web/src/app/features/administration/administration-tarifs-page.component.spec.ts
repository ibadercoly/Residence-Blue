import { signal } from '@angular/core';
import { REAL_EXTRA_SERVICES, REAL_ROOM_TARIFFS } from '@residence-blue/shared';
import { AdministrationTarifsPageComponent } from './administration-tarifs-page.component';
import { AuthService } from '../../core/services/auth.service';
import { TariffsService } from '../../core/services/tariffs.service';

describe('AdministrationTarifsPageComponent', () => {
  const buildTariffsList = () =>
    REAL_ROOM_TARIFFS.map((row, idx) => ({
      id: `tariff-${idx + 1}`,
      categoryId: `cat-${row.categoryCode}`,
      categoryCode: row.categoryCode,
      categoryName:
        row.categoryCode === 'STANDARD'
          ? 'Standard'
          : row.categoryCode === 'CONFORT'
            ? 'Confort'
            : 'Appartement',
      guestsCount: row.guestsCount,
      roomsUsed: row.roomsUsed,
      label: row.label,
      pricePerNightFcfa: row.pricePerNightFcfa,
      isActive: true,
      displayOrder: row.displayOrder,
    }));

  const buildExtrasList = () =>
    REAL_EXTRA_SERVICES.map((s, idx) => ({
      id: `extra-${idx + 1}`,
      code: s.code,
      name: s.name,
      unit: s.unit,
      unitLabel: s.unitLabel,
      priceFcfa: s.priceFcfa,
      category: 'AUTRES' as const,
      isActive: true,
      displayOrder: s.displayOrder,
    }));

  it('bloque le chargement pour un compte non-DIRECTION (403)', async () => {
    const mockAuth = {
      isDirector: () => false,
      getFirstAuthorizedRoute: () => '/planning',
    } as unknown as AuthService;
    const mockTariffs = {
      categories: signal([]),
      tariffs: signal([]),
      extraServices: signal([]),
      loading: signal(false),
      saving: signal(false),
      errorMessage: signal<string | null>(null),
      successMessage: signal<string | null>(null),
      fetchGrid: jest.fn(),
    } as unknown as TariffsService;

    const comp = new AdministrationTarifsPageComponent(mockAuth, mockTariffs);
    await comp.ngOnInit();

    expect(comp.isDirector()).toBe(false);
    expect(mockTariffs.fetchGrid).not.toHaveBeenCalled();
  });

  it('mappe chaque case (prix, Non proposé, À définir), détecte les changements et enregistre', async () => {
    const tariffsSig = signal(buildTariffsList());
    const extrasSig = signal(buildExtrasList());
    const saveGridSpy = jest.fn().mockResolvedValue(true);

    const mockAuth = {
      isDirector: () => true,
      getFirstAuthorizedRoute: () => '/tableau-de-bord',
    } as unknown as AuthService;
    const mockTariffs = {
      categories: signal([]),
      tariffs: tariffsSig,
      extraServices: extrasSig,
      loading: signal(false),
      saving: signal(false),
      errorMessage: signal<string | null>(null),
      successMessage: signal<string | null>(null),
      fetchGrid: jest.fn().mockResolvedValue({
        categories: [],
        tariffs: tariffsSig(),
        extraServices: extrasSig(),
      }),
      saveTariffGrid: saveGridSpy,
      updateExtraService: jest.fn().mockResolvedValue(true),
      createExtraService: jest.fn().mockResolvedValue(true),
    } as unknown as TariffsService;

    const comp = new AdministrationTarifsPageComponent(mockAuth, mockTariffs);
    await comp.ngOnInit();

    const row3p2c = comp.gridRows.find((r) => r.key === '3p-2c')!;
    const row3p3c = comp.gridRows.find((r) => r.key === '3p-3c')!;

    // Standard 3 pers = Non proposé (null)
    expect(comp.findCellTariff(row3p2c, 'STANDARD')).toBeNull();
    // Appartement 3 pers 2 ch = 75 000 FCFA
    expect(comp.findCellTariff(row3p2c, 'APPARTEMENT')?.pricePerNightFcfa).toBe(75000);
    // Appartement 3 pers 3 ch = À définir (pricePerNightFcfa: null)
    const cellUndefined = comp.findCellTariff(row3p3c, 'APPARTEMENT');
    expect(cellUndefined).not.toBeNull();
    expect(cellUndefined?.pricePerNightFcfa).toBeNull();

    // Modification + annulation
    comp.setDraftPrice('tariff-1', '32000');
    expect(comp.hasGridChanges()).toBe(true);
    comp.cancelGridChanges();
    expect(comp.hasGridChanges()).toBe(false);

    // Modification + enregistrement
    comp.setDraftPrice('tariff-1', '32000');
    await comp.saveGridChanges();
    expect(saveGridSpy).toHaveBeenCalledWith([{ id: 'tariff-1', pricePerNightFcfa: 32000 }]);
  });
});
