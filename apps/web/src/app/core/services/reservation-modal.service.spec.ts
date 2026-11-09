import { ReservationModalService } from './reservation-modal.service';
import { ReservationSubmitPayload } from '../models/reservation-modal.model';

describe('ReservationModalService', () => {
  let service: ReservationModalService;

  beforeEach(() => {
    service = new ReservationModalService();
  });

  it('devrait être initialisé avec modal fermée', () => {
    expect(service).toBeTruthy();
    expect(service.isOpen()).toBe(false);
    expect(service.currentParams()).toBeNull();
  });

  it('devrait ouvrir la modal avec ou sans paramètres', () => {
    service.open();
    expect(service.isOpen()).toBe(true);
    expect(service.currentParams()).toBeNull();

    service.close();
    expect(service.isOpen()).toBe(false);

    service.open({ roomNumber: '106', category: 'Standard' });
    expect(service.isOpen()).toBe(true);
    expect(service.currentParams()?.roomNumber).toBe('106');
    expect(service.currentParams()?.category).toBe('Standard');
  });

  it('devrait filtrer les chambres par catégorie', () => {
    const standards = service.getRoomsForCategory('Standard');
    expect(standards.length).toBe(6);
    expect(standards.every((r) => r.category === 'Standard')).toBe(true);

    const deluxes = service.getRoomsForCategory('Deluxe');
    expect(deluxes.length).toBe(4);
    expect(deluxes.every((r) => r.category === 'Deluxe')).toBe(true);

    const suites = service.getRoomsForCategory('Suite');
    expect(suites.length).toBe(2);
    expect(suites.every((r) => r.category === 'Suite')).toBe(true);
  });

  it('devrait retrouver une chambre spécifique par numéro', () => {
    const ch201 = service.getRoomByNumber('201');
    expect(ch201).toBeDefined();
    expect(ch201?.label).toContain('201');
    expect(ch201?.category).toBe('Deluxe');

    const unknown = service.getRoomByNumber('999');
    expect(unknown).toBeUndefined();
  });

  it('devrait confirmer une réservation et fermer la modal', async () => {
    service.open();
    const payload: ReservationSubmitPayload = {
      guestMode: 'REGULAR',
      regularGuestId: 'guest-ndiaye',
      checkInDate: '2024-05-30',
      checkOutDate: '2024-06-02',
      nights: 3,
      adultsCount: 2,
      childrenCount: 1,
      category: 'Deluxe',
      roomNumber: '201',
      depositAmountFcfa: 150000,
      paymentStatus: 'PERCU',
      paymentChannel: 'WAVE',
      airportShuttleIncluded: true,
      specialRequests: 'Arrivée tardive',
      breakdown: {
        nights: 3,
        ratePerNightFcfa: 130000,
        accommodationTotalFcfa: 390000,
        breakfastIncluded: true,
        extraChildBedFcfa: 25000,
        airportShuttleFcfa: 35000,
        cityTaxFcfa: 6000,
        totalStayTtcFcfa: 456000,
        depositAmountFcfa: 150000,
        depositPercentage: 33,
        remainingBalanceFcfa: 306000
      }
    };

    const res = await service.confirmReservation(payload);
    expect(res).toBe(true);
    expect(service.isOpen()).toBe(false);
    expect(service.lastSubmittedReservation()).toBe(payload);
    expect(service.feedbackMessage()).toContain('M. Ibrahima Ndiaye');
    expect(service.feedbackMessage()).toContain('201');
  });

  it('devrait enregistrer une option temporaire 48h', async () => {
    service.open();
    const payload: ReservationSubmitPayload = {
      guestMode: 'NEW',
      newGuest: {
        fullName: 'Abdoulaye Wade',
        phone: '+221 77 000 11 22',
        email: 'awade@gmail.com',
        city: 'Thiès'
      },
      checkInDate: '2024-06-05',
      checkOutDate: '2024-06-07',
      nights: 2,
      adultsCount: 1,
      childrenCount: 0,
      category: 'Standard',
      roomNumber: '101',
      depositAmountFcfa: 0,
      paymentStatus: 'EN_ATTENTE',
      paymentChannel: 'ESPECES',
      airportShuttleIncluded: false,
      specialRequests: '',
      breakdown: {
        nights: 2,
        ratePerNightFcfa: 85000,
        accommodationTotalFcfa: 170000,
        breakfastIncluded: true,
        extraChildBedFcfa: 0,
        airportShuttleFcfa: 0,
        cityTaxFcfa: 2000,
        totalStayTtcFcfa: 172000,
        depositAmountFcfa: 0,
        depositPercentage: 0,
        remainingBalanceFcfa: 172000
      }
    };

    const res = await service.saveDraftOption(payload);
    expect(res).toBe(true);
    expect(service.isOpen()).toBe(false);
    expect(service.feedbackMessage()).toContain('Option temporaire 48h');
  });
});
