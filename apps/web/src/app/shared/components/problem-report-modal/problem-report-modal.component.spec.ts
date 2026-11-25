import { ProblemReportModalComponent, PROBLEM_TYPE_CHOICES } from './problem-report-modal.component';
import { RoomsService, RoomUiItem } from '../../../core/services/rooms.service';
import { RoomStatus } from '@residence-blue/shared';

describe('ProblemReportModalComponent', () => {
  let component: ProblemReportModalComponent;
  let reportProblemMock: jest.Mock;

  const sampleFreeRoom: RoomUiItem = {
    id: 'room-free-1',
    number: '101',
    floor: 1,
    status: RoomStatus.FREE,
    isClean: true,
    amenities: [],
  };

  const sampleOccupiedRoom: RoomUiItem = {
    id: 'room-occ-1',
    number: '102',
    floor: 1,
    status: RoomStatus.OCCUPIED,
    isClean: true,
    amenities: [],
  };

  beforeEach(() => {
    reportProblemMock = jest.fn().mockResolvedValue(true);

    const mockRoomsService = {
      reportProblem: reportProblemMock,
    } as unknown as RoomsService;

    component = new ProblemReportModalComponent(mockRoomsService);
  });

  it('contient les 5 types de problèmes prescrits', () => {
    expect(PROBLEM_TYPE_CHOICES).toHaveLength(5);
    const types = PROBLEM_TYPE_CHOICES.map((c) => c.type);
    expect(types).toEqual([
      'CLIMATISATION',
      'FUITE_EAU',
      'ELECTRICITE',
      'AMPOULE',
      'AUTRE',
    ]);
  });

  it('distingue correctement une chambre libre d’une chambre occupée', () => {
    component.room = sampleFreeRoom;
    expect(component.isRoomOccupied()).toBe(false);

    component.room = sampleOccupiedRoom;
    expect(component.isRoomOccupied()).toBe(true);
  });

  it('appelle reportProblem avec type et description lors de la confirmation', async () => {
    component.room = sampleFreeRoom;
    component.selectedType.set('CLIMATISATION');
    component.description.set('Ne refroidit plus du tout');

    const reportedSpy = jest.spyOn(component.problemReported, 'emit');
    const closeSpy = jest.spyOn(component.close, 'emit');

    await component.onConfirm();

    expect(reportProblemMock).toHaveBeenCalledWith('room-free-1', {
      type: 'CLIMATISATION',
      description: 'Ne refroidit plus du tout',
    });
    expect(reportedSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
  });
});
