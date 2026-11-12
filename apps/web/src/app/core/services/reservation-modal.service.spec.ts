import { ReservationModalService } from './reservation-modal.service';
import { CreateReservationPayload } from '../models/reservation-modal.model';

describe('ReservationModalService', () => {
  let service: ReservationModalService;

  beforeEach(() => {
    service = new ReservationModalService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('devrait être initialisé avec la fenêtre fermée', () => {
    expect(service).toBeTruthy();
    expect(service.isOpen()).toBe(false);
    expect(service.currentParams()).toBeNull();
  });

  it('devrait ouvrir et fermer avec paramètres préremplis', () => {
    service.open({ roomNumber: '101', category: 'Standard', guestId: 'g-1' });
    expect(service.isOpen()).toBe(true);
    expect(service.currentParams()?.roomNumber).toBe('101');
    expect(service.currentParams()?.guestId).toBe('g-1');

    service.close();
    expect(service.isOpen()).toBe(false);
    expect(service.currentParams()).toBeNull();
  });

  it('devrait mettre en cache les tarifs chargés lors de fetchAvailableRooms', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        checkIn: '2026-11-12',
        checkOut: '2026-11-14',
        nights: 2,
        total: 1,
        rates: { tourismTaxPerNightPerPerson: 1500, vatRatePercent: 10 },
        items: [
          {
            id: 'r-1',
            number: '101',
            category: 'Standard',
            floor: 1,
            adultsCapacity: 2,
            childrenCapacity: 0,
            capacity: 2,
            pricePerNight: 35000,
            breakfastIncluded: true,
          },
        ],
      }),
    } as Response);

    expect(service.hasValidRatesCache()).toBe(false);
    const data = await service.fetchAvailableRooms('2026-11-12', '2026-11-14');
    expect(data.items).toHaveLength(1);
    expect(service.hasValidRatesCache()).toBe(true);
    expect(service.getCachedRates().tourismTaxPerNightPerPerson).toBe(1500);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('devrait limiter searchGuests à 5 résultats maximum', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        items: Array.from({ length: 8 }, (_, idx) => ({
          id: `g-${idx}`,
          fullName: `Client ${idx}`,
          phone: `+221 77 000 00 0${idx}`,
        })),
      }),
    } as Response);

    const results = await service.searchGuests('Client');
    expect(results).toHaveLength(5);
  });

  it('devrait envoyer Idempotency-Key et retourner le conflit 409', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          message: "Cette chambre vient d'être réservée, choisissez-en une autre",
        }),
      } as Response);

    const payload: CreateReservationPayload = {
      roomId: 'r-1',
      guestId: 'g-1',
      checkInDate: '2026-11-12',
      checkOutDate: '2026-11-14',
      adultsCount: 1,
      childrenCount: 0,
      depositFcfa: 0,
      breakfastIncluded: true,
      source: 'RECEPTION',
    };

    const res = await service.confirmReservation(payload);
    expect(res.ok).toBe(false);
    expect(res.conflict).toBe(true);
    expect(res.message).toContain("vient d'être réservée");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBeTruthy();
  });

  it('devrait confirmer et afficher « Réservation enregistrée » après création API', async () => {
    service.open();
    jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        id: 'res-1',
        reference: 'RB-2026-1001',
        guestId: 'g-1',
        guestName: 'Aminata Diallo',
        roomId: 'r-1',
        roomNumber: '101',
        roomCategory: 'Standard',
        ratePerNightFcfa: 35000,
        startDayIndex: 0,
        durationDays: 2,
        checkInDate: '2026-11-12',
        checkOutDate: '2026-11-14',
        dbStatus: 'CONFIRMED',
        status: 'CONFIRME',
        statusLabel: 'Confirmée',
        adultsCount: 1,
        childrenCount: 0,
        nights: 2,
        source: 'RECEPTION',
        breakfastIncluded: true,
        subtotalFcfa: 70000,
        tourismTaxFcfa: 2000,
        discountFcfa: 0,
        totalFcfa: 72000,
        depositFcfa: 20000,
        paidFcfa: 20000,
        remainingFcfa: 52000,
      }),
    } as Response);

    const result = await service.confirmReservation({
      roomId: 'r-1',
      guestId: 'g-1',
      checkInDate: '2026-11-12',
      checkOutDate: '2026-11-14',
      adultsCount: 1,
      childrenCount: 0,
      depositFcfa: 20000,
      paymentMethod: 'WAVE',
      breakfastIncluded: true,
      source: 'RECEPTION',
    });

    expect(result.ok).toBe(true);
    expect(service.isOpen()).toBe(false);
    expect(service.feedbackMessage()).toBe('Réservation enregistrée');
    service.clearFeedback();
  });
});
