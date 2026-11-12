import { ReservationModalComponent } from './reservation-modal.component';
import { ReservationModalService } from '../../core/services/reservation-modal.service';
import { SCROLLBAR_SIDE } from '../../core/config/reservation-modal.config';

describe('ReservationModalComponent', () => {
  let service: ReservationModalService;

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        checkIn: '2026-11-12',
        checkOut: '2026-11-14',
        nights: 2,
        total: 2,
        rates: { tourismTaxPerNightPerPerson: 1000, vatRatePercent: 10 },
        items: [
          {
            id: 'r-101',
            number: '101',
            category: 'Standard',
            floor: 1,
            adultsCapacity: 2,
            childrenCapacity: 0,
            capacity: 2,
            pricePerNight: 35000,
            breakfastIncluded: true,
          },
          {
            id: 'r-201',
            number: '201',
            category: 'Deluxe',
            floor: 2,
            adultsCapacity: 2,
            childrenCapacity: 1,
            capacity: 3,
            pricePerNight: 55000,
            breakfastIncluded: true,
          },
        ],
      }),
    } as Response);

    service = new ReservationModalService();
    service.open({ roomNumber: '101' });
  });

  afterEach(() => {
    service.close();
    jest.restoreAllMocks();
  });

  it('devrait utiliser la constante SCROLLBAR_SIDE et calculer le total en FCFA entiers', async () => {
    const comp = new ReservationModalComponent(service);
    comp.ngOnInit();
    await new Promise((r) => setTimeout(r, 0));

    expect(comp.scrollbarSide).toBe(SCROLLBAR_SIDE);
    expect(comp.selectedRoom()?.number).toBe('101');
    expect(comp.nights()).toBe(2);
    expect(comp.subtotalFcfa()).toBe(70000);
    expect(comp.tourismTaxFcfa()).toBe(2000);
    expect(comp.totalFcfa()).toBe(72000);
    comp.ngOnDestroy();
  });

  it('devrait valider le format de téléphone sénégalais et interdire un PAN bancaire', () => {
    const comp = new ReservationModalComponent(service);

    comp.toggleQuickGuest();
    comp.onNewGuestNameChange('Awa Ndiaye');
    comp.onNewGuestPhoneChange('+221 77 123 45 67');
    expect(comp.isQuickPhoneValid()).toBe(true);

    comp.onNewGuestPhoneChange('0612345678');
    expect(comp.isQuickPhoneValid()).toBe(false);

    comp.onTransactionRefChange('4532 1111 2222 3333');
    expect(comp.hasCardPanRisk()).toBe(true);
    expect(comp.canSubmit()).toBe(false);
    comp.ngOnDestroy();
  });

  it('devrait pré-sélectionner un client quand ouvert avec guestId', () => {
    service.open({
      roomNumber: '101',
      guestId: 'guest-uuid-1',
      guestName: 'Moussa Kane',
      guestPhone: '+221 77 444 55 66',
    });
    const comp = new ReservationModalComponent(service);
    comp.ngOnInit();

    expect(comp.selectedGuest()?.id).toBe('guest-uuid-1');
    expect(comp.selectedGuest()?.fullName).toBe('Moussa Kane');
    comp.ngOnDestroy();
  });
});
