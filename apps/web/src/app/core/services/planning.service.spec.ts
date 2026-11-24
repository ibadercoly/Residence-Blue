import { PlanningService } from './planning.service';

describe('PlanningService', () => {
  let service: PlanningService;

  beforeEach(() => {
    // Horloge simulée au 10 nov. 2026 (heure de Dakar) pour les jeux de données de test existants
    jest.useFakeTimers().setSystemTime(new Date('2026-11-10T10:00:00.000Z'));
    service = new PlanningService();
    service.testCatalogRooms.set([
      { number: '101', category: 'Standard', typeLabel: 'Standard Patio', description: 'RDC Jardin' },
      { number: '102', category: 'Standard', typeLabel: 'Standard Patio', description: 'RDC Jardin' },
      { number: '103', category: 'Standard', typeLabel: 'Standard Jardin', description: 'RDC Patio' },
      { number: '104', category: 'Standard', typeLabel: 'Standard Jardin', description: 'RDC Patio' },
      { number: '105', category: 'Standard', typeLabel: 'Standard Piscine', description: 'Vue Piscine' },
      { number: '106', category: 'Standard', typeLabel: 'Standard Piscine', description: 'Vue Piscine' },
      { number: '201', category: 'Deluxe', typeLabel: 'Deluxe Balcon', description: 'Étage Balcon' },
      { number: '202', category: 'Deluxe', typeLabel: 'Deluxe Balcon', description: 'Étage Balcon' },
      { number: '203', category: 'Deluxe', typeLabel: 'Bungalow Jardin', description: 'Bungalow RDC' },
      { number: '204', category: 'Deluxe', typeLabel: 'Bungalow Terrasse', description: 'Bungalow Terrasse' },
      { number: '301', category: 'Suite', typeLabel: 'Suite Panoramique', description: 'Panoramique VIP' },
      { number: '302', category: 'Suite', typeLabel: 'Suite Élysée', description: 'Prestige Rooftop' }
    ]);
    service.allReservations.set([
      {
        id: 'res-101-diallo',
        guestName: 'M. Diallo',
        roomNumber: '101',
        startDayIndex: 0,
        durationDays: 1,
        checkInDate: '2026-11-07',
        checkOutDate: '2026-11-10',
        status: 'DEPART_AUJ',
        statusLabel: "Départ aujourd'hui",
        nights: 3,
        totalFcfa: 255000,
        remainingFcfa: 0,
        contactPhone: '+221 77 123 45 67',
        contactEmail: 'diallo@teranga.sn'
      },
      {
        id: 'res-102-lindstrom',
        guestName: 'Karin Lindström',
        roomNumber: '102',
        startDayIndex: 3,
        durationDays: 3,
        checkInDate: '2026-11-13',
        checkOutDate: '2026-11-16',
        status: 'CONFIRME',
        statusLabel: 'Confirmée',
        nights: 3,
        totalFcfa: 255000,
        remainingFcfa: 155000,
        contactPhone: '+46 70 123 45 67',
        contactEmail: 'karin.lindstrom@stockholm.se'
      },
      {
        id: 'res-103-faye',
        guestName: 'Dr. Faye',
        roomNumber: '103',
        startDayIndex: 0,
        durationDays: 4,
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-14',
        status: 'EN_SEJOUR',
        statusLabel: 'En séjour',
        nights: 4,
        totalFcfa: 340000,
        remainingFcfa: 0,
        contactPhone: '+221 76 987 65 43',
        contactEmail: 'dr.faye@clinique-thies.sn'
      },
      {
        id: 'res-104-sow',
        guestName: 'M. Sow',
        roomNumber: '104',
        startDayIndex: 4,
        durationDays: 2,
        checkInDate: '2026-11-14',
        checkOutDate: '2026-11-16',
        status: 'CONFIRME',
        statusLabel: 'Confirmée',
        nights: 2,
        totalFcfa: 170000,
        remainingFcfa: 70000,
        contactPhone: '+221 77 456 78 90',
        contactEmail: 'a.sow@transport.sn'
      },
      {
        id: 'res-105-martin',
        guestName: 'Sophie Martin',
        roomNumber: '105',
        startDayIndex: 0,
        durationDays: 3,
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-13',
        status: 'EN_SEJOUR',
        statusLabel: 'En séjour',
        nights: 3,
        totalFcfa: 255000,
        remainingFcfa: 0,
        contactPhone: '+33 6 12 34 56 78',
        contactEmail: 'sophie.martin@paris.fr'
      },
      {
        id: 'res-201-moreau',
        guestName: 'Famille Moreau',
        roomNumber: '201',
        startDayIndex: 0,
        durationDays: 2,
        checkInDate: '2026-11-08',
        checkOutDate: '2026-11-12',
        status: 'EN_SEJOUR',
        statusLabel: 'En séjour',
        nights: 4,
        totalFcfa: 520000,
        remainingFcfa: 100000,
        contactPhone: '+33 6 98 76 54 32',
        contactEmail: 'famille.moreau@lyon.fr'
      },
      {
        id: 'res-202-lefevre',
        guestName: 'Mme Claire Lefèvre',
        roomNumber: '202',
        startDayIndex: 2,
        durationDays: 3,
        checkInDate: '2026-11-12',
        checkOutDate: '2026-11-15',
        status: 'CONFIRME',
        statusLabel: 'Confirmée',
        nights: 3,
        totalFcfa: 390000,
        remainingFcfa: 200000,
        contactPhone: '+33 6 45 67 89 01',
        contactEmail: 'claire.lefevre@avocat.fr'
      },
      {
        id: 'res-203-traore',
        guestName: 'M. Traoré',
        roomNumber: '203',
        startDayIndex: 0,
        durationDays: 1,
        checkInDate: '2026-11-07',
        checkOutDate: '2026-11-10',
        status: 'DEPART_AUJ',
        statusLabel: "Départ aujourd'hui",
        nights: 3,
        totalFcfa: 390000,
        remainingFcfa: 0,
        contactPhone: '+221 77 345 67 89',
        contactEmail: 'traore@invest.sn'
      },
      {
        id: 'res-204-sylla',
        guestName: 'Babacar Sylla',
        roomNumber: '204',
        startDayIndex: 1,
        durationDays: 3,
        checkInDate: '2026-11-11',
        checkOutDate: '2026-11-14',
        status: 'CONFIRME',
        statusLabel: 'Confirmée',
        nights: 3,
        totalFcfa: 390000,
        remainingFcfa: 190000,
        contactPhone: '+221 70 890 12 34',
        contactEmail: 'b.sylla@sylla-holding.sn'
      },
      {
        id: 'RB-2024-0894',
        guestName: 'M. Mamadou Diop',
        roomNumber: '301',
        startDayIndex: 0,
        durationDays: 4,
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-14',
        status: 'EN_SEJOUR',
        statusLabel: 'En séjour',
        nights: 4,
        totalFcfa: 840000,
        remainingFcfa: 280000,
        contactPhone: '+221 77 654 32 10',
        contactEmail: 'mamadou.diop@orange-sonatel.sn'
      }
    ]);
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

  afterEach(() => {
    service.ngOnDestroy();
    jest.useRealTimers();
  });

  it('trouve la colonne « Aujourd’hui » par comparaison de dates', () => {
    expect(service.todayIso()).toBe('2026-11-10');
    expect(service.todayColumnIndex()).toBe(0);
    expect(service.currentDays()[0].isToday).toBe(true);
    expect(service.currentDays().filter((d) => d.isToday).length).toBe(1);

    // En naviguant vers la semaine suivante, aucune colonne ne porte la date du jour
    service.navigateNext();
    expect(service.todayColumnIndex()).toBe(-1);
    expect(service.currentDays().some((d) => d.isToday)).toBe(false);

    // Retour sur Aujourd'hui
    service.navigateToday();
    expect(service.todayColumnIndex()).toBe(0);
    expect(service.currentDays()[0].dateIso).toBe('2026-11-10');
    expect(service.currentDays()[0].isToday).toBe(true);
  });

  it('met à jour la date de référence au changement de jour la nuit sans perdre la navigation ni la réservation ouverte', () => {
    service.ngOnDestroy();
    jest.setSystemTime(new Date('2026-12-31T23:59:00.000Z'));
    service = new PlanningService();

    expect(service.todayIso()).toBe('2026-12-31');
    expect(service.periodLabel()).toBe('31 déc. 2026 – 06 janv. 2027');

    // L'utilisateur ouvre une réservation et navigue d'une semaine
    service.allReservations.set([
      {
        id: 'res-nuit-1',
        guestName: 'Mme Ndiaye',
        roomNumber: '101',
        startDayIndex: 0,
        durationDays: 2,
        checkInDate: '2026-12-31',
        checkOutDate: '2027-01-02',
        status: 'EN_SEJOUR',
        statusLabel: 'En séjour',
        nights: 2,
        totalFcfa: 70000,
        remainingFcfa: 0,
        contactPhone: '+221 77 000 00 01',
        contactEmail: 'ndiaye@test.sn',
      },
    ]);
    service.openDetail('res-nuit-1');
    service.navigateNext();
    expect(service.weekOffset()).toBe(1);

    // Passage de minuit à Dakar (1er janv. 2027 00:01) + déclenchement du timer 1 minute
    jest.setSystemTime(new Date('2027-01-01T00:01:00.000Z'));
    jest.advanceTimersByTime(60_000);

    expect(service.todayIso()).toBe('2027-01-01');
    // La navigation en cours et la réservation ouverte sont préservées
    expect(service.weekOffset()).toBe(1);
    expect(service.selectedReservationId()).toBe('res-nuit-1');
    expect(service.currentDays()[0].dateIso).toBe('2027-01-08');
  });

  it('met aussi à jour la date au retour sur l’onglet (visibilitychange)', () => {
    const listeners = new Map<string, Array<() => void>>();
    const originalDoc = (globalThis as { document?: unknown }).document;
    const fakeDoc = {
      visibilityState: 'hidden',
      addEventListener: (event: string, cb: () => void) => {
        const list = listeners.get(event) ?? [];
        list.push(cb);
        listeners.set(event, list);
      },
      removeEventListener: (event: string, cb: () => void) => {
        const list = (listeners.get(event) ?? []).filter((fn) => fn !== cb);
        listeners.set(event, list);
      },
    };
    (globalThis as { document?: unknown }).document = fakeDoc;

    try {
      service.ngOnDestroy();
      jest.setSystemTime(new Date('2024-02-28T23:55:00.000Z'));
      service = new PlanningService();
      expect(service.todayIso()).toBe('2024-02-28');

      jest.setSystemTime(new Date('2024-02-29T00:05:00.000Z'));
      fakeDoc.visibilityState = 'visible';
      for (const cb of listeners.get('visibilitychange') ?? []) {
        cb();
      }

      expect(service.todayIso()).toBe('2024-02-29');
      expect(service.currentDays()[0].dateIso).toBe('2024-02-29');
    } finally {
      service.ngOnDestroy();
      if (originalDoc === undefined) {
        delete (globalThis as { document?: unknown }).document;
      } else {
        (globalThis as { document?: unknown }).document = originalDoc;
      }
    }
  });
});
