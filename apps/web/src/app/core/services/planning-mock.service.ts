import { Injectable, signal, computed } from '@angular/core';
import { Observable, of } from 'rxjs';
import {
  PlanningData,
  PlanningDay,
  PlanningRoom,
  SelectedReservationDetail,
  PlanningReservation
} from '../models/planning.model';

@Injectable({
  providedIn: 'root'
})
export class PlanningMockService {
  // TODO(API): Raccorder au backend NestJS et à la base de données PostgreSQL / Prisma

  private readonly initialDays: PlanningDay[] = [
    { name: 'Lun', number: '20', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 0 },
    { name: 'Mar', number: '21', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 1 },
    { name: 'Mer', number: '22', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 2 },
    { name: 'Jeu', number: '23', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 3 },
    { name: 'Ven', number: '24', month: 'Mai', isToday: true, isWeekend: false, dayIndex: 4 },
    { name: 'Sam', number: '25', month: 'Mai', isToday: false, isWeekend: true, dayIndex: 5 },
    { name: 'Dim', number: '26', month: 'Mai', isToday: false, isWeekend: true, dayIndex: 6 },
    { name: 'Lun', number: '27', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 7 },
    { name: 'Mar', number: '28', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 8 },
    { name: 'Mer', number: '29', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 9 },
    { name: 'Jeu', number: '30', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 10 },
    { name: 'Ven', number: '31', month: 'Mai', isToday: false, isWeekend: false, dayIndex: 11 },
    { name: 'Sam', number: '01', month: 'Juin', isToday: false, isWeekend: true, dayIndex: 12 },
    { name: 'Dim', number: '02', month: 'Juin', isToday: false, isWeekend: true, dayIndex: 13 }
  ];

  private readonly initialRooms: PlanningRoom[] = [
    {
      number: '101',
      category: 'Standard',
      typeLabel: 'Standard',
      description: 'RDC Jardin',
      reservations: [
        {
          id: 'res-101-diallo',
          guestName: 'M. Diallo (Check-out)',
          roomNumber: '101',
          startDayIndex: 0,
          durationDays: 3,
          leftPercent: 1,
          widthPercent: 20,
          status: 'CHECKOUT',
          statusLabel: 'Check-out',
          nights: 3,
          icon: 'done_all'
        }
      ]
    },
    {
      number: '102',
      category: 'Standard',
      typeLabel: 'Standard',
      description: 'RDC Jardin',
      reservations: [
        {
          id: 'res-102-lindstrom',
          guestName: 'Karin Lindström',
          roomNumber: '102',
          startDayIndex: 7,
          durationDays: 4,
          leftPercent: 50.5,
          widthPercent: 28,
          status: 'CONFIRME',
          statusLabel: '4n',
          nights: 4,
          icon: 'schedule'
        }
      ]
    },
    {
      number: '103',
      category: 'Standard',
      typeLabel: 'Standard',
      description: 'RDC Patio',
      reservations: [
        {
          id: 'res-103-faye',
          guestName: 'Dr. Faye',
          roomNumber: '103',
          startDayIndex: 2,
          durationDays: 4,
          leftPercent: 14.5,
          widthPercent: 28,
          status: 'EN_SEJOUR',
          statusLabel: 'En séjour',
          nights: 4
        }
      ]
    },
    {
      number: '104',
      category: 'Standard',
      typeLabel: 'Standard',
      description: 'RDC Patio',
      reservations: [
        {
          id: 'res-104-sow',
          guestName: 'M. Sow',
          roomNumber: '104',
          startDayIndex: 8,
          durationDays: 5,
          leftPercent: 57.5,
          widthPercent: 35,
          status: 'CONFIRME',
          statusLabel: '5n',
          nights: 5,
          icon: 'flight_land'
        }
      ]
    },
    {
      number: '105',
      category: 'Standard',
      typeLabel: 'Standard',
      description: 'Vue Piscine',
      reservations: [
        {
          id: 'res-105-martin',
          guestName: 'Sophie Martin',
          roomNumber: '105',
          startDayIndex: 4,
          durationDays: 4,
          leftPercent: 28.5,
          widthPercent: 28.5,
          status: 'ARRIVEE_AUJ',
          statusLabel: 'Arrivée auj.',
          nights: 4,
          icon: 'key'
        }
      ]
    },
    {
      number: '106',
      category: 'Standard',
      typeLabel: 'Standard',
      description: 'Vue Piscine',
      reservations: [],
      freeSlot: {
        leftPercent: 29,
        rightPercent: 10,
        label: "Libre à l'attribution"
      }
    },
    {
      number: '201',
      category: 'Deluxe',
      typeLabel: 'Deluxe Balcon',
      description: 'Étage Balcon',
      reservations: [
        {
          id: 'res-201-moreau',
          guestName: 'Famille Moreau',
          roomNumber: '201',
          startDayIndex: 1,
          durationDays: 4,
          leftPercent: 7.2,
          widthPercent: 28.5,
          status: 'EN_SEJOUR',
          statusLabel: 'Départ Demain',
          nights: 4
        }
      ]
    },
    {
      number: '202',
      category: 'Deluxe',
      typeLabel: 'Deluxe Balcon',
      description: 'Conflit détecté',
      isConflict: true,
      reservations: [
        {
          id: 'res-202-lefevre',
          guestName: 'Mme Claire Lefèvre',
          roomNumber: '202',
          startDayIndex: 6,
          durationDays: 4,
          leftPercent: 43,
          widthPercent: 28.5,
          status: 'CONFIRME',
          statusLabel: 'Arrivée 26',
          nights: 4
        },
        {
          id: 'res-202-conflict-alert',
          guestName: 'Chevauchement',
          roomNumber: '202',
          startDayIndex: 5,
          durationDays: 2,
          leftPercent: 35.5,
          widthPercent: 15,
          status: 'CONFLIT',
          statusLabel: 'Chevauchement',
          nights: 2,
          isConflict: true,
          icon: 'warning'
        }
      ]
    },
    {
      number: '203',
      category: 'Deluxe',
      typeLabel: 'Bungalow',
      description: 'Deluxe Jardin • Rez-de-jardin',
      isRelocationTarget: true,
      reservations: [],
      relocationSlot: {
        leftPercent: 30,
        widthPercent: 35,
        label: 'Disponible relogement Ch. 202',
        actionLabel: 'Reloger ici'
      }
    },
    {
      number: '204',
      category: 'Deluxe',
      typeLabel: 'Bungalow',
      description: 'Deluxe Jardin • Terrasse',
      reservations: [
        {
          id: 'res-204-sylla',
          guestName: 'Babacar Sylla',
          roomNumber: '204',
          startDayIndex: 5,
          durationDays: 4,
          leftPercent: 36,
          widthPercent: 28.5,
          status: 'CONFIRME',
          statusLabel: '4 nuits',
          nights: 4,
          icon: 'calendar_today'
        }
      ]
    },
    {
      number: '301',
      category: 'Suite',
      typeLabel: 'Suite Panoramique',
      description: 'Panoramique VIP',
      isHighlighted: true,
      reservations: [
        {
          id: 'RB-2024-0894',
          guestName: 'M. Mamadou Diop',
          roomNumber: '301',
          startDayIndex: 3,
          durationDays: 4,
          leftPercent: 21.5,
          widthPercent: 28.5,
          status: 'EN_SEJOUR',
          statusLabel: 'Sélectionné',
          subtitle: 'VIP Gold • 4 nuits (23 – 27 Mai)',
          nights: 4,
          isVip: true,
          vipLabel: 'VIP Gold',
          isSelected: true,
          icon: 'verified'
        }
      ]
    },
    {
      number: '302',
      category: 'Suite',
      typeLabel: 'Suite Filaos',
      description: 'Prestige Rooftop',
      reservations: [
        {
          id: 'res-302-diallo',
          guestName: 'M. Ibrahima Diallo',
          roomNumber: '302',
          startDayIndex: 5,
          durationDays: 7,
          leftPercent: 36,
          widthPercent: 50,
          status: 'CONFIRME',
          statusLabel: '7 nuits (Semaine Prestige)',
          nights: 7,
          icon: 'stars'
        }
      ]
    }
  ];

  private readonly initialSelectedDetail: SelectedReservationDetail = {
    id: 'RB-2024-0894',
    guestName: 'M. Mamadou Diop',
    vipBadge: 'VIP Gold',
    statusBadge: 'En séjour',
    roomNumber: '301',
    roomCategory: 'Suite 301',
    roomDescription: 'Suite Panoramique (Étage 3)',
    checkInDate: 'Jeu 23 Mai',
    checkInDetails: '15:00 • Effectué',
    checkOutDate: 'Lun 27 Mai',
    checkOutDetails: '12:00 (4 nuits)',
    adultsCount: 2,
    breakfastLabel: 'P-Déj. Inclus',
    shuttleLabel: 'Navette Aéroport AIBD ⇄ Résidence (Effectuée)',
    folio: {
      totalFcfa: 780000,
      paidFcfa: 500000,
      remainingFcfa: 280000,
      depositBadge: 'Acompte perçu',
      preferredPayment: 'Mode paiement préféré : Carte Bancaire / Wave'
    },
    contact: {
      phone: '+221 77 654 32 10',
      email: 'mamadou.diop@teranga.sn'
    },
    conciergeNote:
      '« Préférence étage supérieur avec vue sur les jardins, bouteille de bienvenue Teranga bien fraîche livrée à l\'arrivée. »'
  };

  // État réactif
  readonly conflictBannerVisible = signal<boolean>(true);
  readonly selectedReservationId = signal<string>('RB-2024-0894');
  readonly selectedDetail = signal<SelectedReservationDetail>(this.initialSelectedDetail);
  readonly roomsState = signal<PlanningRoom[]>(this.initialRooms);
  readonly periodLabel = signal<string>('20 Mai – 2 Juin 2024');
  readonly weeksLabel = signal<string>('S21 & S22');
  readonly activeHorizon = signal<string>('14d');
  readonly activeCategoryFilter = signal<string>('ALL');
  readonly activeStatusFilter = signal<string>('ALL');
  readonly lastDragEventMessage = signal<string | null>(null);

  // Chambres filtrées
  readonly filteredRooms = computed(() => {
    const rooms = this.roomsState();
    const cat = this.activeCategoryFilter();
    const status = this.activeStatusFilter();

    return rooms.filter(room => {
      // Filtre catégorie
      if (cat === 'STANDARD' && room.category !== 'Standard') return false;
      if (cat === 'DELUXE' && room.category !== 'Deluxe') return false;
      if (cat === 'SUITE' && room.category !== 'Suite') return false;

      // Filtre statut
      if (status === 'OCCUPIED') {
        const hasStay = room.reservations.some(r => r.status === 'EN_SEJOUR' || r.status === 'ARRIVEE_AUJ');
        if (!hasStay) return false;
      }
      if (status === 'CONFIRMED') {
        const hasConfirmed = room.reservations.some(r => r.status === 'CONFIRME');
        if (!hasConfirmed) return false;
      }
      if (status === 'CONFLICT') {
        if (!room.isConflict) return false;
      }

      return true;
    });
  });

  getPlanningData(): Observable<PlanningData> {
    return of({
      periodLabel: this.periodLabel(),
      weeksLabel: this.weeksLabel(),
      days: this.initialDays,
      occupancyStats: {
        ratePercent: '83,3%',
        occupiedRooms: 10,
        totalRooms: 12,
        arrivalsCount: 3,
        departuresCount: 2,
        realtimeLabel: 'Données en temps réel PMS Thiès'
      },
      conflictAlert: {
        title: 'Chambre déjà réservée sur cette période',
        badge: 'Conflit Tape Chart',
        roomNumber: '202',
        roomName: 'Chambre 202 (Deluxe Balcon)',
        period: '25 – 27 Mai 2024',
        message:
          'Conflit d\'attribution détecté sur Chambre 202 (Deluxe Balcon) pour la prolongation demandée (25 – 27 Mai 2024).',
        suggestionText: 'Chambre 203 (Deluxe Jardin) disponible en équivalence',
        targetRoomNumber: '203',
        targetRoomName: 'Chambre 203 (Deluxe Jardin)'
      },
      rooms: this.roomsState(),
      selectedReservation: this.selectedDetail(),
      housekeeping: {
        title: 'Gouvernante Générale',
        detail: '11 chambres prêtes • 1 en recouche'
      }
    });
  }

  dismissConflictBanner(): void {
    this.conflictBannerVisible.set(false);
  }

  showConflictBanner(): void {
    this.conflictBannerVisible.set(true);
  }

  selectReservation(reservation: PlanningReservation): void {
    this.selectedReservationId.set(reservation.id);

    // Mettre à jour l'indicateur isSelected sur toutes les chambres
    const updated = this.roomsState().map(room => {
      const isRoomSelected = room.number === reservation.roomNumber;
      return {
        ...room,
        isHighlighted: isRoomSelected,
        reservations: room.reservations.map(res => ({
          ...res,
          isSelected: res.id === reservation.id
        }))
      };
    });
    this.roomsState.set(updated);

    // Si on sélectionne Mamadou Diop, restaurer la fiche complète originale
    if (reservation.id === 'RB-2024-0894') {
      this.selectedDetail.set(this.initialSelectedDetail);
      return;
    }

    // Sinon créer une fiche contextuelle
    this.selectedDetail.set({
      id: reservation.id,
      guestName: reservation.guestName,
      vipBadge: reservation.isVip ? reservation.vipLabel : undefined,
      statusBadge: reservation.statusLabel,
      roomNumber: reservation.roomNumber,
      roomCategory: `Chambre ${reservation.roomNumber}`,
      roomDescription: `Chambre ${reservation.roomNumber} • ${reservation.nights} nuits`,
      checkInDate: '24 Mai 2024',
      checkInDetails: '15:00',
      checkOutDate: '28 Mai 2024',
      checkOutDetails: `12:00 (${reservation.nights} nuits)`,
      adultsCount: 2,
      breakfastLabel: 'P-Déj. Inclus',
      shuttleLabel: 'Transfert Standard Résidence Blue',
      folio: {
        totalFcfa: reservation.nights * 55000,
        paidFcfa: reservation.nights * 55000,
        remainingFcfa: 0,
        depositBadge: 'Réglé intégralement',
        preferredPayment: 'Mode paiement : Espèces / Wave'
      },
      contact: {
        phone: '+221 77 000 00 00',
        email: 'reservation@residenceblue.sn'
      },
      conciergeNote: '« Séjour enregistré au PMS Résidence Blue Thiès. »'
    });
  }

  /**
   * Action de relogement : Déplace le conflit ou propose la confirmation de relogement
   */
  reallocateConflict(): void {
    // Reloger le conflit de la 202 vers la 203
    const currentRooms = this.roomsState();
    const updated = currentRooms.map(room => {
      if (room.number === '202') {
        // Enlever le conflit
        return {
          ...room,
          isConflict: false,
          description: 'Étage Balcon',
          reservations: room.reservations.filter(r => !r.isConflict)
        };
      }
      if (room.number === '203') {
        // Ajouter la réservation relogée
        return {
          ...room,
          isRelocationTarget: false,
          relocationSlot: undefined,
          reservations: [
            {
              id: 'res-203-relogee',
              guestName: 'Mme Lefèvre (Relogée)',
              roomNumber: '203',
              startDayIndex: 5,
              durationDays: 4,
              leftPercent: 35.5,
              widthPercent: 28.5,
              status: 'CONFIRME' as const,
              statusLabel: 'Relogé Ch. 203',
              nights: 4,
              icon: 'swap_horiz'
            }
          ]
        };
      }
      return room;
    });

    this.roomsState.set(updated);
    this.dismissConflictBanner();
    this.lastDragEventMessage.set('Relogement effectué avec succès vers Chambre 203');
  }

  setCategoryFilter(category: string): void {
    this.activeCategoryFilter.set(category);
  }

  setStatusFilter(status: string): void {
    this.activeStatusFilter.set(status);
  }

  setHorizon(horizon: string): void {
    this.activeHorizon.set(horizon);
  }

  navigatePrevious(): void {
    this.periodLabel.set('6 Mai – 19 Mai 2024');
    this.weeksLabel.set('S19 & S20');
  }

  navigateNext(): void {
    this.periodLabel.set('3 Juin – 16 Juin 2024');
    this.weeksLabel.set('S23 & S24');
  }

  navigateToday(): void {
    this.periodLabel.set('20 Mai – 2 Juin 2024');
    this.weeksLabel.set('S21 & S22');
  }

  /**
   * Événement de glisser-déposer prévu mais inactif pour l'instant (TODO(API)).
   */
  handleDragStart(reservation: PlanningReservation): void {
    this.lastDragEventMessage.set(
      `Début de déplacement pour la réservation ${reservation.guestName} (${reservation.id})`
    );
  }

  handleDrop(targetRoomNumber: string, reservationId: string): void {
    // Événement capturé mais inactif : notifier l'opérateur
    this.lastDragEventMessage.set(
      `Glisser-déposer de la réservation ${reservationId} vers la Chambre ${targetRoomNumber} (Raccordement API en cours)`
    );
  }
}
