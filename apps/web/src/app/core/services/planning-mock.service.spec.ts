import { PlanningMockService } from './planning-mock.service';

describe('PlanningMockService', () => {
  let service: PlanningMockService;

  beforeEach(() => {
    service = new PlanningMockService();
  });

  it('devrait être initialisé correctement', () => {
    expect(service).toBeTruthy();
  });

  it('devrait retourner 7 jours pour la vue semaine (pas 14)', () => {
    const days = service.currentDays();
    expect(days.length).toBe(7);
    expect(days[0].number).toBe('10');
    expect(days[6].number).toBe('16');
    expect(service.periodLabel()).toBe('10 – 16 nov. 2026');
  });

  it('devrait calculer les 3 chiffres du jour exacts (Arrivées, Départs, Libres)', () => {
    const metrics = service.dailyMetrics();
    expect(metrics.arrivalsToday).toBe(3);
    expect(metrics.departuresToday).toBe(2);
    expect(metrics.freeRoomsToday).toBeGreaterThanOrEqual(1);
  });

  it('devrait naviguer de semaine (Précédent, Suivant, Aujourd\'hui)', () => {
    service.navigateNext();
    expect(service.weekOffset()).toBe(1);
    expect(service.currentDays()[0].number).toBe('17');

    service.navigatePrevious();
    expect(service.weekOffset()).toBe(0);
    expect(service.periodLabel()).toBe('10 – 16 nov. 2026');

    service.navigatePrevious();
    expect(service.weekOffset()).toBe(-1);

    service.navigateToday();
    expect(service.weekOffset()).toBe(0);
    expect(service.periodLabel()).toBe('10 – 16 nov. 2026');
  });

  it('devrait filtrer les chambres par nom de client ou numéro de chambre', () => {
    service.setSearchQuery('Diop');
    const filtered = service.filteredRooms();
    expect(filtered.length).toBe(1);
    expect(filtered[0].number).toBe('301');

    service.setSearchQuery('106');
    const freeRoom = service.filteredRooms();
    expect(freeRoom.length).toBe(1);
    expect(freeRoom[0].number).toBe('106');

    service.setSearchQuery('');
    expect(service.filteredRooms().length).toBe(12);
  });

  it('devrait filtrer les chambres par statut : Toutes, Libres, Occupées', () => {
    service.setFilterMode('FREE');
    const freeRooms = service.filteredRooms();
    expect(freeRooms.length).toBeGreaterThan(0);
    expect(freeRooms.every(r => r.reservations.length === 0)).toBe(true);

    service.setFilterMode('OCCUPIED');
    const occRooms = service.filteredRooms();
    expect(occRooms.length).toBeGreaterThan(0);
    expect(occRooms.every(r => r.reservations.length > 0)).toBe(true);

    service.setFilterMode('ALL');
    expect(service.filteredRooms().length).toBe(12);
  });

  it('devrait ouvrir et fermer le panneau de détail pour une réservation', () => {
    expect(service.selectedReservation()).toBeNull();

    service.openDetail('RB-2024-0894');
    expect(service.selectedReservation()).not.toBeNull();
    expect(service.selectedReservation()?.guestName).toBe('M. Mamadou Diop');
    expect(service.selectedReservation()?.roomNumber).toBe('301');

    service.closeDetail();
    expect(service.selectedReservation()).toBeNull();
  });

  it('devrait prolonger une réservation si la chambre est libre', () => {
    const res = service.allReservations().find(r => r.id === 'res-103-faye')!;
    const initialNights = res.nights;

    const result = service.extendReservation('res-103-faye', 1);
    expect(result.success).toBe(true);

    const updated = service.allReservations().find(r => r.id === 'res-103-faye')!;
    expect(updated.nights).toBe(initialNights + 1);
  });

  it('devrait effectuer le Check-in puis le Check-out sur une réservation', () => {
    // Karin Lindström est CONFIRME
    const checkInRes = service.toggleCheckInCheckOut('res-102-lindstrom');
    expect(checkInRes.success).toBe(true);
    expect(checkInRes.newStatus).toBe('EN_SEJOUR');

    // M. Faye est EN_SEJOUR -> Check-out
    const checkOutRes = service.toggleCheckInCheckOut('res-103-faye');
    expect(checkOutRes.success).toBe(true);
    expect(checkOutRes.newStatus).toBe('DEPART_AUJ');
  });

  it('devrait annuler une réservation et la retirer de la liste', () => {
    const countBefore = service.allReservations().length;
    const result = service.cancelReservation('res-204-sylla');
    expect(result.success).toBe(true);
    expect(service.allReservations().length).toBe(countBefore - 1);
    expect(service.allReservations().find(r => r.id === 'res-204-sylla')).toBeUndefined();
  });

  it('devrait détecter un conflit et refuser une réservation en doublon', () => {
    // Ch. 301 est occupée du 2026-11-10 au 2026-11-14 par Mamadou Diop
    const conflict = service.hasConflict('301', '2026-11-11', '2026-11-13');
    expect(conflict).toBe(true);

    const result = service.createReservation({
      guestName: 'Client Doublon',
      roomNumber: '301',
      checkInDate: '2026-11-11',
      checkOutDate: '2026-11-13',
      nights: 2,
      totalFcfa: 420000
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain('déjà réservée');
  });

  it('devrait accepter une réservation sans conflit', () => {
    // Ch. 106 est libre toute la semaine
    const result = service.createReservation({
      guestName: 'Nouveau Voyageur',
      roomNumber: '106',
      checkInDate: '2026-11-12',
      checkOutDate: '2026-11-15',
      nights: 3,
      totalFcfa: 255000,
      depositAmountFcfa: 100000
    });

    expect(result.success).toBe(true);
    expect(result.reservation).toBeDefined();
    expect(result.reservation?.roomNumber).toBe('106');
    expect(result.reservation?.remainingFcfa).toBe(155000);
  });
});
