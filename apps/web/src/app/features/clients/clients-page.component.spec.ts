import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientsPageComponent } from './clients-page.component';
import { ClientsService } from '../../core/services/clients.service';

describe('ClientsPageComponent (V2 Fluide)', () => {
  let component: ClientsPageComponent;
  let clientsService: ClientsService;
  let mockRouter: { navigate: jest.Mock };
  let mockLocation: { path: jest.Mock };

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
        nextCursor: null,
        total: 0,
        stats: { inStayCount: 0, expectedTodayCount: 0, newThisMonthCount: 0 },
      }),
    }) as unknown as typeof fetch;

    clientsService = new ClientsService();
    mockRouter = { navigate: jest.fn() };
    mockLocation = { path: jest.fn().mockReturnValue('/clients') };
    const mockRoute = {
      snapshot: { paramMap: { get: () => null } },
    } as unknown as ActivatedRoute;

    component = new ClientsPageComponent(
      clientsService,
      mockRoute,
      mockRouter as unknown as Router,
      mockLocation as unknown as Location,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('devrait charger l’annuaire au démarrage et grouper les clients par lettre', () => {
    const loadSpy = jest.spyOn(clientsService, 'loadDirectory').mockResolvedValue();
    component.ngOnInit();
    expect(loadSpy).toHaveBeenCalledWith(true);

    clientsService.items.set([
      {
        id: 'g-1',
        civility: 'Mme',
        firstName: 'Aminata',
        lastName: 'Diagne',
        fullName: 'Aminata Diagne',
        phone: '+221 77 410 20 30',
        email: '',
        birthDate: '',
        nationality: 'Sénégalaise',
        address: '',
        idDocumentType: 'CNI',
        idDocumentMasked: '****1234',
        hasIdDocument: true,
        internalNote: '',
        state: 'IN_STAY',
        version: 1,
        updatedAt: '2026-11-11T10:00:00.000Z',
      },
      {
        id: 'g-2',
        civility: 'M.',
        firstName: 'Babacar',
        lastName: 'Sylla',
        fullName: 'Babacar Sylla',
        phone: '+221 78 123 45 67',
        email: '',
        birthDate: '',
        nationality: 'Sénégalaise',
        address: '',
        idDocumentType: 'CNI',
        idDocumentMasked: '',
        hasIdDocument: false,
        internalNote: '',
        state: 'NONE',
        version: 1,
        updatedAt: '2026-11-11T10:00:00.000Z',
      },
    ]);

    const groups = component.groupedItems();
    expect(groups.map((g) => g.letter)).toEqual(['A', 'B']);
  });

  it('devrait appliquer un debounce de 200 ms sur la recherche côté serveur', () => {
    jest.useFakeTimers();
    const loadSpy = jest.spyOn(clientsService, 'loadDirectory').mockResolvedValue();

    component.onSearchChange('Diop');
    expect(loadSpy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(200);
    expect(loadSpy).toHaveBeenCalledWith(true);
    jest.useRealTimers();
  });

  it('devrait activer le mode création rapide dans la colonne droite sans fenêtre modale', () => {
    component.startQuickCreate();
    expect(component.quickCreateMode()).toBe(true);
    expect(component.mobileDetailOpen()).toBe(true);
  });

  it('devrait naviguer au clavier dans l’annuaire avec ArrowDown et ArrowUp', () => {
    clientsService.items.set([
      {
        id: 'g-1',
        civility: 'Mme',
        firstName: 'Aminata',
        lastName: 'Diagne',
        fullName: 'Aminata Diagne',
        phone: '+221 77 410 20 30',
        email: '',
        birthDate: '',
        nationality: 'Sénégalaise',
        address: '',
        idDocumentType: 'CNI',
        idDocumentMasked: '',
        hasIdDocument: false,
        internalNote: '',
        state: 'NONE',
        version: 1,
        updatedAt: '2026-11-11T10:00:00.000Z',
      },
      {
        id: 'g-2',
        civility: 'M.',
        firstName: 'Babacar',
        lastName: 'Sylla',
        fullName: 'Babacar Sylla',
        phone: '+221 78 123 45 67',
        email: '',
        birthDate: '',
        nationality: 'Sénégalaise',
        address: '',
        idDocumentType: 'CNI',
        idDocumentMasked: '',
        hasIdDocument: false,
        internalNote: '',
        state: 'NONE',
        version: 1,
        updatedAt: '2026-11-11T10:00:00.000Z',
      },
    ]);

    const openSpy = jest.spyOn(component, 'openGuest');
    component.onDirectoryKeydown({
      key: 'ArrowDown',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent);
    expect(openSpy).toHaveBeenCalledWith('g-1');
  });
});
