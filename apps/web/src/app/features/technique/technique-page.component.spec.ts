import { signal } from '@angular/core';
import { TechniquePageComponent } from './technique-page.component';
import { TechniqueService } from '../../core/services/technique.service';
import { RoomProblemDto } from '@residence-blue/shared';

describe('TechniquePageComponent', () => {
  let component: TechniquePageComponent;

  const toTreatProblem: RoomProblemDto = {
    id: 'p-1',
    roomId: 'r-108',
    roomNumber: '108',
    type: 'CLIMATISATION',
    reportedByRole: 'HOUSEKEEPING',
    reportedByName: 'Fatou',
    reportedAt: new Date(Date.now() - 7200000).toISOString(), // il y a 2 h
    description: 'Ne refroidit plus du tout',
    wasOccupied: true,
    blocksRental: true,
    status: 'REPORTED',
    isCurrentlyOccupied: true,
  };

  const emptyRoomProblem: RoomProblemDto = {
    id: 'p-2',
    roomId: 'r-102',
    roomNumber: '102',
    type: 'FUITE_EAU',
    reportedByRole: 'RECEPTION',
    reportedByName: 'Moussa',
    reportedAt: new Date(Date.now() - 3600000).toISOString(), // il y a 1 h
    description: 'Fuite sous le lavabo',
    wasOccupied: false,
    blocksRental: true,
    status: 'REPORTED',
    isCurrentlyOccupied: false,
  };

  const inProgressProblem: RoomProblemDto = {
    id: 'p-3',
    roomId: 'r-104',
    roomNumber: '104',
    type: 'ELECTRICITE',
    reportedByRole: 'HOUSEKEEPING',
    reportedByName: 'Awa',
    reportedAt: new Date().toISOString(),
    acknowledgedAt: new Date().toISOString(),
    assignedToName: 'Technicien Ousmane',
    wasOccupied: false,
    blocksRental: true,
    status: 'IN_PROGRESS',
    isCurrentlyOccupied: false,
  };

  let mockTechniqueService: any;

  beforeEach(() => {
    mockTechniqueService = {
      toTreat: signal<RoomProblemDto[]>([toTreatProblem, emptyRoomProblem]),
      inProgress: signal<RoomProblemDto[]>([inProgressProblem]),
      resolvedToday: signal<RoomProblemDto[]>([]),
      totalToTreat: signal<number>(2),
      isLoading: signal<boolean>(false),
      errorMessage: signal<string | null>(null),
      successMessage: signal<string | null>(null),
      soundEnabled: signal<boolean>(true),
      sseConnected: signal<boolean>(true),
      newProblemAlert: signal<string | null>(null),
      fetchDashboard: jest.fn(),
      takeProblem: jest.fn().mockResolvedValue(true),
      resolveProblem: jest.fn().mockResolvedValue(true),
      toggleSound: jest.fn(),
      startSse: jest.fn(),
      stopSse: jest.fn(),
    };

    component = new TechniquePageComponent(mockTechniqueService as unknown as TechniqueService);
  });

  it('initialise le composant et lance le flux SSE', () => {
    component.ngOnInit();
    expect(mockTechniqueService.fetchDashboard).toHaveBeenCalled();
    expect(mockTechniqueService.startSse).toHaveBeenCalled();
  });

  it('arrête le flux SSE lors de la destruction', () => {
    component.ngOnDestroy();
    expect(mockTechniqueService.stopSse).toHaveBeenCalled();
  });

  it('calcule correctement les libellés et icônes des types de pannes', () => {
    expect(component.getProblemIcon('CLIMATISATION')).toBe('ac_unit');
    expect(component.getProblemLabel('CLIMATISATION')).toBe('Climatisation');
    expect(component.getProblemIcon('FUITE_EAU')).toBe('water_drop');
    expect(component.getProblemLabel('FUITE_EAU')).toBe("Fuite d'eau");
  });

  it('calcule correctement le temps relatif écoulé', () => {
    const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
    expect(component.getRelativeTime(twoHoursAgo)).toBe('il y a 2 h');

    const justNow = new Date().toISOString();
    expect(component.getRelativeTime(justNow)).toBe("à l'instant");
  });

  it('appelle takeProblem lors du clic sur « Je m’en occupe »', async () => {
    await component.onTakeProblem('p-1');
    expect(mockTechniqueService.takeProblem).toHaveBeenCalledWith('p-1');
  });

  it('ouvre la modale de résolution, saisit la note et valide (« C’est réparé »)', async () => {
    component.openResolveModal(inProgressProblem);
    expect(component.resolvingProblem()).toEqual(inProgressProblem);

    component.resolveNoteInput = 'Disjoncteur réarmé et prise changée';
    await component.confirmResolve();

    expect(mockTechniqueService.resolveProblem).toHaveBeenCalledWith('p-3', 'Disjoncteur réarmé et prise changée');
    expect(component.resolvingProblem()).toBeNull();
  });
});
