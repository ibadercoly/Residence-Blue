import { signal } from '@angular/core';
import { Role, RoomStatus } from '@residence-blue/shared';
import { MenageChambresComponent, MENAGE_PROBLEM_CHOICES } from './menage-chambres.component';
import { RoomsService, RoomUiItem } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';

describe('MenageChambresComponent', () => {
  let component: MenageChambresComponent;
  let roomsSig: ReturnType<typeof signal<RoomUiItem[]>>;
  let changeRoomStatusMock: jest.Mock;

  beforeEach(() => {
    roomsSig = signal<RoomUiItem[]>([
      {
        id: 'r-101',
        number: '101',
        typeId: 't-std',
        floor: 1,
        category: 'Standard',
        status: RoomStatus.CLEANING,
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
        status: RoomStatus.MAINTENANCE,
        maintenanceReason: "Fuite d'eau",
        amenities: [],
        isActive: true,
        type: { id: 't-std', name: 'Standard', pricePerNight: null },
      },
    ]);

    changeRoomStatusMock = jest.fn().mockImplementation(async (roomId: string, nextStatus: RoomStatus, reason?: string) => {
      roomsSig.update((list) =>
        list.map((r) =>
          r.id === roomId
            ? {
                ...r,
                status: nextStatus,
                maintenanceReason: nextStatus === RoomStatus.MAINTENANCE ? reason || 'Problème signalé' : null,
              }
            : r,
        ),
      );
      return true;
    });

    const mockRoomsService = {
      activeRooms: () => roomsSig().filter((r) => r.isActive !== false),
      errorMessage: signal<string | null>(null),
      successMessage: signal<string | null>(null),
      currentRole: () => Role.HOUSEKEEPING,
      changeRoomStatus: changeRoomStatusMock,
      syncOutbox: jest.fn(),
    } as unknown as RoomsService;

    component = new MenageChambresComponent(
      mockRoomsService,
      { isOnline: signal(true) } as unknown as NetworkService,
      { pendingCount: signal(0), isSyncing: signal(false) } as unknown as OutboxService,
    );
  });

  it('classe les chambres dans les 3 groupes + pannes déjà signalées', () => {
    expect(component.cleaningRooms().map((r) => r.number)).toEqual(['101']);
    expect(component.occupiedRooms().map((r) => r.number)).toEqual(['102']);
    expect(component.freeRooms().map((r) => r.number)).toEqual(['103']);
    expect(component.maintenanceRooms().map((r) => r.number)).toEqual(['104']);
    expect(MENAGE_PROBLEM_CHOICES.map((c) => c.label)).toEqual([
      "Fuite d'eau",
      'Ampoule ou électricité',
      'Climatisation',
      'Autre',
    ]);
  });

  it('passe une chambre À nettoyer -> Propre (J’ai nettoyé) puis la retire du groupe À nettoyer', async () => {
    await component.markCleaned(component.cleaningRooms()[0]);

    expect(changeRoomStatusMock).toHaveBeenCalledWith('r-101', RoomStatus.FREE, 'Chambre nettoyée et prête');
    expect(component.cleaningRooms()).toHaveLength(0);
    expect(component.freeRooms().map((r) => r.number)).toEqual(['101', '103']);
  });

  it('passe une chambre Propre -> À nettoyer', async () => {
    await component.markNeedsCleaning(component.freeRooms()[0]);

    expect(changeRoomStatusMock).toHaveBeenCalledWith('r-103', RoomStatus.CLEANING, 'Chambre marquée à nettoyer');
    expect(component.cleaningRooms().map((r) => r.number)).toEqual(['101', '103']);
  });

  it('envoie un signalement de problème avec choix + note vers PATCH status MAINTENANCE', async () => {
    const occupiedRoom = component.occupiedRooms()[0];
    component.openProblemModal(occupiedRoom);
    component.selectedProblemChoice.set('Climatisation');
    component.problemDetails.set('Souffle chaud');
    await component.submitProblem();

    expect(changeRoomStatusMock).toHaveBeenCalledWith(
      occupiedRoom.id,
      RoomStatus.MAINTENANCE,
      'Climatisation — Souffle chaud',
    );
    expect(component.problemModalRoom()).toBeNull();
    expect(component.maintenanceRooms().map((r) => r.number)).toEqual(['102', '104']);
  });
});
