import { signal } from '@angular/core';
import { Role, RoomStatus } from '@residence-blue/shared';
import { MenageChambresComponent } from './menage-chambres.component';
import { RoomsService, RoomUiItem } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';

describe('MenageChambresComponent (Tests Unitaires Parcours Ménage & Pannes)', () => {
  let component: MenageChambresComponent;
  let roomsSig: ReturnType<typeof signal<RoomUiItem[]>>;
  let updateCleanlinessMock: jest.Mock;
  let reportProblemMock: jest.Mock;

  beforeEach(() => {
    roomsSig = signal<RoomUiItem[]>([
      {
        id: 'r-101',
        number: '101',
        typeId: 't-std',
        floor: 1,
        category: 'Standard',
        status: RoomStatus.CLEANING,
        isClean: false,
        amenities: [],
        isActive: true,
        type: { id: 't-std', name: 'Standard', pricePerNight: null },
      },
      {
        id: 'r-102',
        number: '102',
        typeId: 't-std',
        floor: 1,
        category: 'Standard',
        status: RoomStatus.OCCUPIED,
        isClean: false, // Client présent mais chambre sale -> doit être à nettoyer maintenant
        amenities: [],
        isActive: true,
        type: { id: 't-std', name: 'Standard', pricePerNight: null },
      },
      {
        id: 'r-103',
        number: '103',
        typeId: 't-std',
        floor: 1,
        category: 'Standard',
        status: RoomStatus.FREE,
        isClean: true,
        amenities: [],
        isActive: true,
        type: { id: 't-std', name: 'Standard', pricePerNight: null },
      },
      {
        id: 'r-104',
        number: '104',
        typeId: 't-std',
        floor: 1,
        category: 'Standard',
        status: RoomStatus.OCCUPIED,
        isClean: true, // Client présent et propre -> Autres chambres
        amenities: [],
        isActive: true,
        type: { id: 't-std', name: 'Standard', pricePerNight: null },
      },
    ]);

    updateCleanlinessMock = jest.fn().mockImplementation(async (roomId: string, isClean: boolean) => {
      roomsSig.update((list) =>
        list.map((r) => (r.id === roomId ? { ...r, isClean } : r)),
      );
      return true;
    });

    reportProblemMock = jest.fn().mockResolvedValue(true);

    const mockRoomsService = {
      activeRooms: () => roomsSig().filter((r) => r.isActive !== false),
      errorMessage: signal<string | null>(null),
      successMessage: signal<string | null>(null),
      currentRole: () => Role.HOUSEKEEPING,
      updateCleanliness: updateCleanlinessMock,
      reportProblem: reportProblemMock,
      syncOutbox: jest.fn(),
    } as unknown as RoomsService;

    component = new MenageChambresComponent(
      mockRoomsService,
      { isOnline: signal(true) } as unknown as NetworkService,
      { pendingCount: signal(0), isSyncing: signal(false) } as unknown as OutboxService,
    );
  });

  it('classe les chambres dans les 2 groupes : À nettoyer maintenant et Autres chambres', () => {
    // 101 (libre sale) et 102 (occupée sale) doivent être dans roomsToCleanNow
    expect(component.roomsToCleanNow().map((r) => r.number)).toEqual(['101', '102']);

    // 103 (libre propre) et 104 (occupée propre) doivent être dans otherRooms
    expect(component.otherRooms().map((r) => r.number)).toEqual(['103', '104']);
  });

  it('identifie correctement si une chambre est occupée', () => {
    expect(component.isOccupied(roomsSig()[0])).toBe(false); // 101 FREE/CLEANING
    expect(component.isOccupied(roomsSig()[1])).toBe(true);  // 102 OCCUPIED
  });

  it('passe une chambre À nettoyer -> Propre (J’ai nettoyé) via updateCleanliness', async () => {
    const dirtyOccupied = component.roomsToCleanNow().find((r) => r.number === '102')!;
    await component.markCleaned(dirtyOccupied);

    expect(updateCleanlinessMock).toHaveBeenCalledWith('r-102', true);
    // Maintenant propre, elle passe dans otherRooms
    expect(component.roomsToCleanNow().map((r) => r.number)).toEqual(['101']);
    expect(component.otherRooms().map((r) => r.number)).toContain('102');
  });

  it('passe une chambre Propre -> À nettoyer via updateCleanliness', async () => {
    const cleanRoom = component.otherRooms().find((r) => r.number === '103')!;
    await component.markNeedsCleaning(cleanRoom);

    expect(updateCleanlinessMock).toHaveBeenCalledWith('r-103', false);
    expect(component.roomsToCleanNow().map((r) => r.number)).toContain('103');
  });

  it('ouvre et ferme la modale de signalement de problème', () => {
    const room = roomsSig()[1];
    component.openProblemModal(room);
    expect(component.problemModalRoom()).toBe(room);

    component.closeProblemModal();
    expect(component.problemModalRoom()).toBeNull();
  });
});
