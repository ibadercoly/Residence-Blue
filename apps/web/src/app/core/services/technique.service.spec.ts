import { TechniqueService } from './technique.service';
import { AuthService } from './auth.service';
import { NetworkService } from '../offline/network.service';
import { RoomProblemDto } from '@residence-blue/shared';

describe('TechniqueService', () => {
  let service: TechniqueService;
  let authFetchMock: jest.Mock;

  const mockProblem: RoomProblemDto = {
    id: 'prob-1',
    roomId: 'room-101',
    roomNumber: '101',
    type: 'CLIMATISATION',
    reportedByRole: 'HOUSEKEEPING',
    reportedByName: 'Awa',
    reportedAt: new Date().toISOString(),
    wasOccupied: false,
    blocksRental: true,
    status: 'REPORTED',
    isCurrentlyOccupied: false,
  };

  beforeEach(() => {
    authFetchMock = jest.fn();

    const mockAuthService = {
      authenticatedFetch: authFetchMock,
      currentUser: jest.fn().mockReturnValue({ id: 'u1', fullName: 'Moussa Tech' }),
    } as unknown as AuthService;

    const mockNetwork = {
      isOnline: jest.fn().mockReturnValue(true),
    } as unknown as NetworkService;

    service = new TechniqueService(mockAuthService, mockNetwork);
  });

  it('charge le tableau de bord technique avec succès', async () => {
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        toTreat: [mockProblem],
        inProgress: [],
        resolvedToday: [],
        totalToTreat: 1,
      }),
    });

    await service.fetchDashboard();

    expect(authFetchMock).toHaveBeenCalledWith('/api/technique/problems');
    expect(service.toTreat()).toHaveLength(1);
    expect(service.totalToTreat()).toBe(1);
    expect(service.inProgress()).toHaveLength(0);
    expect(service.resolvedToday()).toHaveLength(0);
  });

  it('prend en charge un problème (« Je m’en occupe »)', async () => {
    service.toTreat.set([mockProblem]);

    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockProblem, status: 'IN_PROGRESS' }),
    });
    // for subsequent fetchDashboard call
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        toTreat: [],
        inProgress: [{ ...mockProblem, status: 'IN_PROGRESS' }],
        resolvedToday: [],
        totalToTreat: 0,
      }),
    });

    const success = await service.takeProblem('prob-1');

    expect(success).toBe(true);
    expect(authFetchMock).toHaveBeenCalledWith('/api/technique/problems/prob-1/take', {
      method: 'PATCH',
    });
  });

  it('résout un problème (« C’est réparé »)', async () => {
    const inProgressProb: RoomProblemDto = {
      ...mockProblem,
      status: 'IN_PROGRESS',
    };
    service.inProgress.set([inProgressProb]);

    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...inProgressProb, status: 'RESOLVED', resolutionNote: 'Gaz rechargé' }),
    });
    authFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        toTreat: [],
        inProgress: [],
        resolvedToday: [{ ...inProgressProb, status: 'RESOLVED', resolutionNote: 'Gaz rechargé' }],
        totalToTreat: 0,
      }),
    });

    const success = await service.resolveProblem('prob-1', 'Gaz rechargé');

    expect(success).toBe(true);
    expect(authFetchMock).toHaveBeenCalledWith('/api/technique/problems/prob-1/resolve', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutionNote: 'Gaz rechargé' }),
    });
  });

  it('bascule le son activé / désactivé', () => {
    expect(service.soundEnabled()).toBe(true);
    service.toggleSound();
    expect(service.soundEnabled()).toBe(false);
    service.toggleSound();
    expect(service.soundEnabled()).toBe(true);
  });
});
