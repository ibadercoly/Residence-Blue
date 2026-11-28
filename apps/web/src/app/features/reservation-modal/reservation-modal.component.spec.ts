import { signal } from '@angular/core';
import { REAL_ROOM_TARIFFS, RoomTariffDto } from '@residence-blue/shared';
import { ReservationModalComponent } from './reservation-modal.component';
import { ReservationModalService } from '../../core/services/reservation-modal.service';
import { SCROLLBAR_SIDE } from '../../core/config/reservation-modal.config';
import { TariffsService } from '../../core/services/tariffs.service';

function createMockTariffsService(): TariffsService {
  const rows: RoomTariffDto[] = REAL_ROOM_TARIFFS.map((r, idx) => ({
    id: `t-${idx}`,
    categoryId: `cat-${r.categoryCode}`,
    categoryCode: r.categoryCode,
    categoryName:
      r.categoryCode === 'STANDARD'
        ? 'Standard'
        : r.categoryCode === 'CONFORT'
          ? 'Confort'
          : 'Appartement',
    guestsCount: r.guestsCount,
    roomsUsed: r.roomsUsed,
    label: r.label,
    pricePerNightFcfa: r.pricePerNightFcfa,
    isActive: true,
    sortOrder: r.sortOrder,
  }));

  return {
    tariffs: signal(rows),
    fetchGrid: jest.fn().mockResolvedValue(null),
    fetchQuote: jest.fn().mockResolvedValue(null),
  } as unknown as TariffsService;
}

describe('ReservationModalComponent', () => {
  let service: ReservationModalService;
  let tariffsService: TariffsService;

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        checkIn: '2026-11-12',
        checkOut: '2026-11-15',
        nights: 3,
        total: 2,
        rates: { tourismTaxPerNightPerPerson: 1000, vatRatePercent: 10 },
        items: [
          {
            id: 'r-101',
            number: '101',
            category: 'Standard',
            tariffCategoryCode: 'STANDARD',
            floor: 1,
            adultsCapacity: 2,
            childrenCapacity: 0,
            capacity: 2,
            pricePerNight: null,
            breakfastIncluded: true,
          },
          {
            id: 'r-301',
            number: '301',
            category: 'Appartement',
            tariffCategoryCode: 'APPARTEMENT',
            floor: 3,
            adultsCapacity: 6,
            childrenCapacity: 2,
            capacity: 6,
            pricePerNight: null,
            breakfastIncluded: true,
          },
        ],
      }),
    } as Response);

    service = new ReservationModalService();
    tariffsService = createMockTariffsService();
    service.open({ roomNumber: '101' });
  });

  afterEach(() => {
    service.close();
    jest.restoreAllMocks();
  });

  it('devrait afficher la ligne de tarif réelle (Standard 2 pers. x 3 nuits = 105 000 FCFA)', async () => {
    const comp = new ReservationModalComponent(service, tariffsService);
    comp.ngOnInit();
    await new Promise((r) => setTimeout(r, 0));

    comp.applyDuration(3);
    await new Promise((r) => setTimeout(r, 0));
    comp.changeAdults(1); // passe de 1 à 2 adultes

    expect(comp.scrollbarSide).toBe(SCROLLBAR_SIDE);
    expect(comp.selectedRoom()?.number).toBe('101');
    expect(comp.nights()).toBe(3);
    expect(comp.ratePerNight()).toBe(35000);
    expect(comp.subtotalFcfa()).toBe(105000);
    expect(comp.tourismTaxFcfa()).toBe(6000);
    expect(comp.totalFcfa()).toBe(111000);
    expect(comp.tariffSummaryLine()).toBe(
      'Chambre Standard, 2 personnes, petit-déjeuner inclus : 35 000 FCFA par nuit, total 105 000 FCFA pour 3 nuits',
    );
    comp.ngOnDestroy();
  });

  it('devrait bloquer la validation et afficher une erreur claire pour 3 personnes en Standard', async () => {
    service.open({
      roomNumber: '101',
      guestId: 'guest-uuid-1',
      guestName: 'Moussa Kane',
      guestPhone: '+221 77 444 55 66',
    });
    const comp = new ReservationModalComponent(service, tariffsService);
    comp.ngOnInit();
    await new Promise((r) => setTimeout(r, 0));

    comp.changeAdults(2); // passe à 3 adultes
    expect(comp.hasValidTariff()).toBe(false);
    expect(comp.canSubmit()).toBe(false);
    expect(comp.tariffErrorMessage()).toContain('Pas de tarif pour 3 personnes en chambre Standard');
    comp.ngOnDestroy();
  });

  it("devrait gérer l'appartement avec 1, 2 et 3 chambres (tarif non défini bloque l'envoi)", async () => {
    service.open({
      roomNumber: '301',
      guestId: 'guest-uuid-1',
      guestName: 'Moussa Kane',
      guestPhone: '+221 77 444 55 66',
    });
    const comp = new ReservationModalComponent(service, tariffsService);
    comp.ngOnInit();
    await new Promise((r) => setTimeout(r, 0));

    expect(comp.isSelectedApartment()).toBe(true);
    comp.changeAdults(1); // 2 personnes
    comp.setRoomsUsed(1);
    expect(comp.ratePerNight()).toBe(55000);
    expect(comp.hasValidTariff()).toBe(true);

    comp.setRoomsUsed(2);
    expect(comp.ratePerNight()).toBe(65000);

    comp.changeAdults(1); // 3 personnes
    comp.setRoomsUsed(3); // 3 personnes, 3 chambres => tarif non défini
    expect(comp.hasValidTariff()).toBe(false);
    expect(comp.canSubmit()).toBe(false);
    expect(comp.tariffErrorMessage()).toContain('Tarif non défini');
    comp.ngOnDestroy();
  });

  it('devrait valider le format de téléphone sénégalais et interdire un PAN bancaire', () => {
    const comp = new ReservationModalComponent(service, tariffsService);

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
    const comp = new ReservationModalComponent(service, tariffsService);
    comp.ngOnInit();

    expect(comp.selectedGuest()?.id).toBe('guest-uuid-1');
    expect(comp.selectedGuest()?.fullName).toBe('Moussa Kane');
    comp.ngOnDestroy();
  });
});
