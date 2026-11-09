import { PlanningMockService } from './planning-mock.service';

describe('PlanningMockService', () => {
  let service: PlanningMockService;

  beforeEach(() => {
    service = new PlanningMockService();
  });

  it('devrait être initialisé correctement', () => {
    expect(service).toBeTruthy();
  });

  it('devrait retourner les données initiales avec 12 chambres et 14 jours', (done) => {
    service.getPlanningData().subscribe((data) => {
      expect(data.rooms.length).toBe(12);
      expect(data.days.length).toBe(14);
      expect(data.occupancyStats.ratePercent).toBe('83,3%');
      expect(data.occupancyStats.occupiedRooms).toBe(10);
      expect(data.occupancyStats.totalRooms).toBe(12);
      expect(data.conflictAlert.roomNumber).toBe('202');
      done();
    });
  });

  it('devrait filtrer les chambres par catégorie correctement', () => {
    service.setCategoryFilter('STANDARD');
    expect(service.filteredRooms().length).toBe(6);

    service.setCategoryFilter('DELUXE');
    expect(service.filteredRooms().length).toBe(4);

    service.setCategoryFilter('SUITE');
    expect(service.filteredRooms().length).toBe(2);

    service.setCategoryFilter('ALL');
    expect(service.filteredRooms().length).toBe(12);
  });

  it('devrait filtrer les chambres par statut de conflit', () => {
    service.setStatusFilter('CONFLICT');
    const rooms = service.filteredRooms();
    expect(rooms.length).toBe(1);
    expect(rooms[0].number).toBe('202');

    service.setStatusFilter('ALL');
    expect(service.filteredRooms().length).toBe(12);
  });

  it('devrait basculer la visibilité du bandeau de conflit', () => {
    expect(service.conflictBannerVisible()).toBe(true);
    service.dismissConflictBanner();
    expect(service.conflictBannerVisible()).toBe(false);
    service.showConflictBanner();
    expect(service.conflictBannerVisible()).toBe(true);
  });

  it('devrait sélectionner une réservation et mettre à jour le détail', () => {
    const resSophie = service
      .roomsState()
      .find((r) => r.number === '105')
      ?.reservations[0];
    expect(resSophie).toBeDefined();

    if (resSophie) {
      service.selectReservation(resSophie);
      expect(service.selectedReservationId()).toBe(resSophie.id);
      expect(service.selectedDetail().guestName).toBe('Sophie Martin');
      expect(service.selectedDetail().roomNumber).toBe('105');
    }
  });

  it('devrait reloger le conflit de la chambre 202 vers la chambre 203', () => {
    expect(service.conflictBannerVisible()).toBe(true);
    const room202Before = service.roomsState().find((r) => r.number === '202');
    expect(room202Before?.isConflict).toBe(true);

    service.reallocateConflict();

    expect(service.conflictBannerVisible()).toBe(false);
    const room202After = service.roomsState().find((r) => r.number === '202');
    expect(room202After?.isConflict).toBe(false);

    const room203After = service.roomsState().find((r) => r.number === '203');
    expect(room203After?.isRelocationTarget).toBe(false);
    expect(room203After?.reservations.length).toBe(1);
    expect(room203After?.reservations[0].statusLabel).toBe('Relogé Ch. 203');
  });

  it('devrait gérer la navigation temporelle (Précédent, Suivant, Aujourd\'hui)', () => {
    service.navigatePrevious();
    expect(service.periodLabel()).toBe('6 Mai – 19 Mai 2024');
    expect(service.weeksLabel()).toBe('S19 & S20');

    service.navigateNext();
    expect(service.periodLabel()).toBe('3 Juin – 16 Juin 2024');
    expect(service.weeksLabel()).toBe('S23 & S24');

    service.navigateToday();
    expect(service.periodLabel()).toBe('20 Mai – 2 Juin 2024');
    expect(service.weeksLabel()).toBe('S21 & S22');
  });

  it('devrait enregistrer les événements de glisser-déposer sans altérer les données', () => {
    const resMamadou = service.roomsState().find((r) => r.number === '301')?.reservations[0]!;
    service.handleDragStart(resMamadou);
    expect(service.lastDragEventMessage()).toContain('M. Mamadou Diop');

    service.handleDrop('201', resMamadou.id);
    expect(service.lastDragEventMessage()).toContain('Chambre 201');
  });
});
