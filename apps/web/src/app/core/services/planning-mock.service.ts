import { Injectable, signal, computed, inject, Injector } from '@angular/core';
import { RoomsService } from './rooms.service';
import { Observable, of } from 'rxjs';
import {
  PlanningData,
  PlanningDay,
  PlanningRoom,
  SelectedReservationDetail,
  PlanningReservation,
  PlanningFilterType,
  PlanningDailyMetrics,
  ReservationStatusType
} from '../models/planning.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningMockService {
  private readonly injector = inject(Injector);

  /**
   * Résolution paresseuse de RoomsService : l'injection directe créerait une
   * dépendance circulaire (RoomsService dépend déjà de PlanningMockService).
   */
  private get roomsService(): RoomsService | null {
    return this.injector.get(RoomsService, null);
  }
  // TODO(API): Raccorder au backend NestJS et à la base de données PostgreSQL / Prisma
  // Voir docs/performance/A-FAIRE-API.md pour la spécification des routes d'exploitation.

  /** Décalage de semaine (-1 = semaine précédente, 0 = semaine courante, +1 = semaine suivante) */
  readonly weekOffset = signal<number>(0);

  /** Recherche par nom de client ou numéro de chambre */
  readonly searchQuery = signal<string>('');

  /** Filtre unique : 'ALL' (Toutes), 'FREE' (Libres), 'OCCUPIED' (Occupées) */
  readonly filterMode = signal<PlanningFilterType>('ALL');

  /** Identifiant de la réservation sélectionnée pour le panneau de détail */
  readonly selectedReservationId = signal<string | null>(null);

  /** Message de feedback opérateur pour les actions rapides */
  readonly feedbackMessage = signal<string | null>(null);

  /** Base des réservations de démonstration pour la Résidence Blue (12 chambres) */
  private readonly initialReservations: PlanningReservation[] = [
    {
      id: 'res-101-diallo',
      guestName: 'M. Diallo',
      roomNumber: '101',
      startDayIndex: 0,
      durationDays: 1,
      checkInDate: '2026-11-07',
      checkOutDate: '2026-11-10',
      status: 'DEPART_AUJ',
      statusLabel: 'Départ aujourd\'hui',
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
    // Ch. 106 est libre toute la semaine
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
      statusLabel: 'Départ aujourd\'hui',
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
    // Ch. 302 est libre toute la semaine
  ];

  /** État réactif de toutes les réservations */
  readonly allReservations = signal<PlanningReservation[]>(this.initialReservations);

  /** Définition statique des 12 chambres de l'hôtel */
  get catalogRooms(): Omit<PlanningRoom, 'reservations'>[] {
    if (this.roomsService) {
      const active = this.roomsService.activeRooms();
      if (active.length > 0) {
        return active.map((r) => ({
          number: r.number,
          category: (r.category || r.type?.name || 'Standard') as any,
          typeLabel: `${r.category || r.type?.name || 'Standard'} ${r.view || ''}`.trim(),
          description: r.description || `Étage ${r.floor}`,
        }));
      }
    }
    return [
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
  ];
  }

  /** Date de référence fixe pour la démo : Mardi 10 Novembre 2026 */
  private readonly baseDate = new Date(2026, 10, 10); // 10 nov 2026

  /** Calcul dynamique des 7 jours affichés */
  readonly currentDays = computed<PlanningDay[]>(() => {
    const offset = this.weekOffset();
    const startDate = new Date(this.baseDate);
    startDate.setDate(this.baseDate.getDate() + offset * 7);

    const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const monthNames = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];

    const days: PlanningDay[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);

      const dayOfWeek = d.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Samedi ou Dimanche
      const isToday = offset === 0 && i === 0; // Mardi 10 nov est le jour 0 quand offset = 0

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      days.push({
        name: dayNames[dayOfWeek],
        number: dd,
        month: monthNames[d.getMonth()],
        isToday,
        isWeekend,
        dayIndex: i,
        dateIso: `${yyyy}-${mm}-${dd}`
      });
    }

    return days;
  });

  /** Libellé de période sur une seule ligne (ex: « 10 – 16 nov. 2026 ») */
  readonly periodLabel = computed<string>(() => {
    const days = this.currentDays();
    if (days.length === 0) return '';
    const first = days[0];
    const last = days[days.length - 1];
    return `${first.number} – ${last.number} nov. 2026`;
  });

  /** 3 chiffres clés du jour (Arrivées aujourd'hui, Départs aujourd'hui, Chambres libres) */
  readonly dailyMetrics = computed<PlanningDailyMetrics>(() => {
    const todayIso = '2026-11-10';
    const all = this.allReservations();

    // Arrivées aujourd'hui : checkInDate === today
    const arrivalsToday = all.filter(r => r.checkInDate === todayIso).length;

    // Départs aujourd'hui : checkOutDate === today ou status === 'DEPART_AUJ'
    const departuresToday = all.filter(r => r.checkOutDate === todayIso || r.status === 'DEPART_AUJ').length;

    // Chambres occupées aujourd'hui (hors départs déjà libérés)
    const occupiedTodaySet = new Set(
      all
        .filter(r => {
          if (r.status === 'DEPART_AUJ' || r.status === 'CHECKOUT') return false;
          return r.checkInDate <= todayIso && r.checkOutDate > todayIso;
        })
        .map(r => r.roomNumber)
    );

    const freeRoomsToday = Math.max(0, this.catalogRooms.length - occupiedTodaySet.size);

    return {
      arrivalsToday,
      departuresToday,
      freeRoomsToday
    };
  });

  /** Chambres avec leurs réservations positionnées sur les 7 jours de la semaine courante */
  readonly roomsWithWeekReservations = computed<PlanningRoom[]>(() => {
    const days = this.currentDays();
    if (days.length === 0) return [];

    const weekStartIso = days[0].dateIso;
    const weekEndIso = days[days.length - 1].dateIso;
    const all = this.allReservations();

    return this.catalogRooms.map(room => {
      // Trouver les réservations qui intersectent la semaine courante
      const roomReservations = all
        .filter(r => r.roomNumber === room.number)
        .filter(r => !(r.checkOutDate <= weekStartIso || r.checkInDate > weekEndIso))
        .map(r => {
          // Calculer les colonnes de début et fin dans la grille 7 jours
          const startIndex = days.findIndex(d => d.dateIso >= r.checkInDate);
          const startDayIndex = startIndex === -1 ? 0 : startIndex;

          // Date de fin
          const endIndex = days.findIndex(d => d.dateIso >= r.checkOutDate);
          const endDayIndex = endIndex === -1 ? 6 : Math.max(startDayIndex, endIndex - 1);
          const durationDays = Math.max(1, endDayIndex - startDayIndex + 1);

          return {
            ...r,
            startDayIndex,
            durationDays
          };
        });

      return {
        ...room,
        reservations: roomReservations
      };
    });
  });

  /** Liste des chambres filtrées selon la recherche et le filtre Toutes / Libres / Occupées */
  readonly filteredRooms = computed<PlanningRoom[]>(() => {
    const rooms = this.roomsWithWeekReservations();
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.filterMode();

    return rooms.filter(room => {
      // Filtre statut
      if (filter === 'FREE' && room.reservations.length > 0) {
        return false;
      }
      if (filter === 'OCCUPIED' && room.reservations.length === 0) {
        return false;
      }

      // Recherche par numéro de chambre ou nom de client
      if (query) {
        const matchRoom = room.number.toLowerCase().includes(query) || room.category.toLowerCase().includes(query);
        const matchGuest = room.reservations.some(r => r.guestName.toLowerCase().includes(query));
        if (!matchRoom && !matchGuest) return false;
      }

      return true;
    });
  });

  /** Réservation activement inspectée pour le panneau de détail */
  readonly selectedReservation = computed<SelectedReservationDetail | null>(() => {
    const id = this.selectedReservationId();
    if (!id) return null;

    const res = this.allReservations().find(r => r.id === id);
    if (!res) return null;

    const room = this.catalogRooms.find(r => r.number === res.roomNumber);

    return {
      id: res.id,
      guestName: res.guestName,
      status: res.status,
      statusBadge: res.statusLabel || (res.status === 'EN_SEJOUR' ? 'En séjour' : res.status === 'CONFIRME' ? 'Confirmée' : 'Départ aujourd\'hui'),
      roomNumber: res.roomNumber,
      roomCategory: room ? `Chambre ${room.number} • ${room.category}` : `Chambre ${res.roomNumber}`,
      roomDescription: room?.description || '',
      checkInDate: res.checkInDate,
      checkInDetails: '15:00',
      checkOutDate: res.checkOutDate,
      checkOutDetails: '12:00',
      nights: res.nights,
      folio: {
        totalFcfa: res.totalFcfa,
        paidFcfa: res.totalFcfa - res.remainingFcfa,
        remainingFcfa: res.remainingFcfa,
        depositBadge: res.remainingFcfa === 0 ? 'Réglé' : 'Acompte versé',
        preferredPayment: 'Espèces / Wave'
      },
      contact: {
        phone: res.contactPhone || '+221 77 000 00 00',
        email: res.contactEmail || 'client@residenceblue.sn'
      }
    };
  });

  // --- Actions de Navigation ---

  navigatePrevious(): void {
    this.weekOffset.update(v => v - 1);
  }

  navigateNext(): void {
    this.weekOffset.update(v => v + 1);
  }

  navigateToday(): void {
    this.weekOffset.set(0);
  }

  // --- Actions de Recherche & Filtre ---

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  setFilterMode(filter: PlanningFilterType): void {
    this.filterMode.set(filter);
  }

  // --- Sélection et Panneau de détail ---

  openDetail(reservationId: string): void {
    this.selectedReservationId.set(reservationId);
  }

  closeDetail(): void {
    this.selectedReservationId.set(null);
  }

  // --- 4 Boutons d'Action du Panneau de Détail ---

  /** 1. Modifier : déclenche la modification */
  modifyReservation(id: string): PlanningReservation | undefined {
    return this.allReservations().find(r => r.id === id);
  }

  /** 2. Prolonger : ajoute 1 nuit si la chambre est disponible */
  extendReservation(id: string, additionalNights = 1): { success: boolean; message: string } {
    const res = this.allReservations().find(r => r.id === id);
    if (!res) {
      return { success: false, message: 'Réservation introuvable.' };
    }

    // Calculer la nouvelle date de départ
    const currentEnd = new Date(res.checkOutDate);
    const newEnd = new Date(currentEnd);
    newEnd.setDate(currentEnd.getDate() + additionalNights);
    const newEndIso = newEnd.toISOString().split('T')[0];

    // Vérifier si la prolongation chevauche une autre réservation sur la même chambre
    const hasOverlap = this.hasConflict(res.roomNumber, res.checkOutDate, newEndIso, res.id);
    if (hasOverlap) {
      const msg = `Impossible de prolonger : la chambre ${res.roomNumber} est déjà réservée à partir du ${res.checkOutDate}.`;
      this.feedbackMessage.set(msg);
      return { success: false, message: msg };
    }

    // Appliquer la prolongation
    const newNights = res.nights + additionalNights;
    const nightRate = res.nights > 0 ? Math.round(res.totalFcfa / res.nights) : 85000;
    const additionalTotal = nightRate * additionalNights;

    this.allReservations.update(list =>
      list.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          checkOutDate: newEndIso,
          nights: newNights,
          durationDays: r.durationDays + additionalNights,
          totalFcfa: r.totalFcfa + additionalTotal,
          remainingFcfa: r.remainingFcfa + additionalTotal
        };
      })
    );

    const successMsg = `Séjour de ${res.guestName} prolongé de ${additionalNights} nuit(s) jusqu'au ${newEndIso}.`;
    this.feedbackMessage.set(successMsg);
    return { success: true, message: successMsg };
  }

  /** 3. Check-in ou Check-out selon l'état actuel */
  toggleCheckInCheckOut(id: string): { success: boolean; newStatus: ReservationStatusType; message: string } {
    const res = this.allReservations().find(r => r.id === id);
    if (!res) {
      return { success: false, newStatus: 'CONFIRME', message: 'Réservation introuvable.' };
    }

    let nextStatus: ReservationStatusType = 'EN_SEJOUR';
    let nextLabel = 'En séjour';
    let msg = '';

    if (res.status === 'CONFIRME' || res.status === 'ARRIVEE_AUJ') {
      nextStatus = 'EN_SEJOUR';
      nextLabel = 'En séjour';
      msg = `Check-in validé pour ${res.guestName} (Chambre ${res.roomNumber}). Clé remise.`;
    } else if (res.status === 'EN_SEJOUR') {
      nextStatus = 'DEPART_AUJ';
      nextLabel = 'Départ aujourd\'hui';
      msg = `Check-out validé pour ${res.guestName} (Chambre ${res.roomNumber}). Chambre libérée.`;
    } else {
      nextStatus = 'EN_SEJOUR';
      nextLabel = 'En séjour';
      msg = `Statut réinitialisé en séjour pour ${res.guestName}.`;
    }

    this.allReservations.update(list =>
      list.map(r => {
        if (r.id !== id) return r;
        return {
          ...r,
          status: nextStatus,
          statusLabel: nextLabel
        };
      })
    );

    this.feedbackMessage.set(msg);
    return { success: true, newStatus: nextStatus, message: msg };
  }

  /** 4. Annuler : retire la réservation */
  cancelReservation(id: string): { success: boolean; message: string } {
    const res = this.allReservations().find(r => r.id === id);
    if (!res) {
      return { success: false, message: 'Réservation introuvable.' };
    }

    this.allReservations.update(list => list.filter(r => r.id !== id));
    this.closeDetail();

    const msg = `Réservation de ${res.guestName} en Chambre ${res.roomNumber} annulée.`;
    this.feedbackMessage.set(msg);
    return { success: true, message: msg };
  }

  // --- Contrôle des Conflits & Nouvelle Réservation ---

  /** Vérifie si une chambre est déjà occupée sur la période demandée [checkIn, checkOut[ */
  hasConflict(roomNumber: string, checkInIso: string, checkOutIso: string, excludeResId?: string): boolean {
    const existing = this.allReservations().filter(r => r.roomNumber === roomNumber && r.id !== excludeResId);

    return existing.some(r => {
      // Deux intervalles [A, B[ et [C, D[ se chevauchent si A < D et C < B
      return checkInIso < r.checkOutDate && r.checkInDate < checkOutIso;
    });
  }

  /** Création d'une nouvelle réservation avec refus strict en cas de chevauchement */
  createReservation(payload: {
    guestName: string;
    roomNumber: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    totalFcfa: number;
    depositAmountFcfa?: number;
    contactPhone?: string;
    contactEmail?: string;
  }): { success: boolean; errorMessage?: string; reservation?: PlanningReservation } {
    // Vérification du conflit
    if (this.hasConflict(payload.roomNumber, payload.checkInDate, payload.checkOutDate)) {
      const error = `La chambre ${payload.roomNumber} est déjà réservée sur cette période (du ${payload.checkInDate} au ${payload.checkOutDate}). Réservation refusée.`;
      this.feedbackMessage.set(error);
      return { success: false, errorMessage: error };
    }

    const newRes: PlanningReservation = {
      id: `res-${payload.roomNumber}-${Date.now().toString(36)}`,
      guestName: payload.guestName,
      roomNumber: payload.roomNumber,
      startDayIndex: 0,
      durationDays: payload.nights,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      status: 'CONFIRME',
      statusLabel: 'Confirmée',
      nights: payload.nights,
      totalFcfa: payload.totalFcfa,
      remainingFcfa: Math.max(0, payload.totalFcfa - (payload.depositAmountFcfa || 0)),
      contactPhone: payload.contactPhone,
      contactEmail: payload.contactEmail
    };

    this.allReservations.update(list => [...list, newRes]);
    this.feedbackMessage.set(`Réservation confirmée pour ${payload.guestName} en Chambre ${payload.roomNumber}.`);
    return { success: true, reservation: newRes };
  }

  /** Données de compatibilité pour getPlanningData */
  getPlanningData(): Observable<PlanningData> {
    const days = this.currentDays();
    const rooms = this.roomsWithWeekReservations();
    const metrics = this.dailyMetrics();

    return of({
      periodLabel: this.periodLabel(),
      weeksLabel: 'Semaine en cours',
      days,
      occupancyStats: {
        ratePercent: '75%',
        occupiedRooms: 9,
        totalRooms: 12,
        arrivalsCount: metrics.arrivalsToday,
        departuresCount: metrics.departuresToday,
        realtimeLabel: 'Données en direct Résidence Blue'
      },
      conflictAlert: {
        title: 'Chambre occupée',
        badge: 'Disponibilité',
        roomNumber: '202',
        roomName: 'Chambre 202',
        period: '12 – 15 Nov. 2026',
        message: 'Conflit évité grâce au contrôle d\'attribution.',
        suggestionText: '',
        targetRoomNumber: '',
        targetRoomName: ''
      },
      rooms,
      selectedReservation: this.selectedReservation() || {
        id: 'RB-2024-0894',
        guestName: 'M. Mamadou Diop',
        status: 'EN_SEJOUR',
        statusBadge: 'En séjour',
        roomNumber: '301',
        roomCategory: 'Chambre 301 • Suite',
        roomDescription: 'Suite Panoramique VIP',
        checkInDate: '2026-11-10',
        checkOutDate: '2026-11-14',
        nights: 4,
        folio: {
          totalFcfa: 840000,
          paidFcfa: 560000,
          remainingFcfa: 280000,
          depositBadge: 'Acompte versé',
          preferredPayment: 'Espèces / Wave'
        },
        contact: {
          phone: '+221 77 654 32 10',
          email: 'mamadou.diop@orange-sonatel.sn'
        }
      },
      housekeeping: {
        title: 'Gouvernante',
        detail: '12 chambres suivies'
      }
    });
  }
}
