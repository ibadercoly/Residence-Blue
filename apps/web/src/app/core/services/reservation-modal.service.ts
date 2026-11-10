import { Injectable, inject, signal } from '@angular/core';
import {
  CategoryCardOption,
  RegularGuest,
  ReservationModalParams,
  ReservationSubmitPayload,
  RoomCategoryType,
  SpecificRoomOption
} from '../models/reservation-modal.model';
import { PlanningMockService } from './planning-mock.service';

@Injectable({
  providedIn: 'root'
})
export class ReservationModalService {
  private readonly planningService = inject(PlanningMockService, { optional: true });

  /** État d'ouverture de la modal */
  readonly isOpen = signal<boolean>(false);

  /** Paramètres optionnels passés lors de l'ouverture (ex: depuis une case libre du planning) */
  readonly currentParams = signal<ReservationModalParams | null>(null);

  /** Dernière réservation confirmée ou option enregistrée */
  readonly lastSubmittedReservation = signal<ReservationSubmitPayload | null>(null);

  /** Message de feedback opérateur */
  readonly feedbackMessage = signal<string | null>(null);

  /** Message d'erreur de validation ou conflit */
  readonly errorMessage = signal<string | null>(null);

  /** Liste des clients réguliers de démonstration (Cardex) */
  readonly regularGuests: RegularGuest[] = [
    {
      id: 'guest-ndiaye',
      name: 'M. Ibrahima Ndiaye',
      initials: 'IN',
      vipBadge: 'VIP Prestige',
      vipIcon: 'star',
      phone: '+221 77 123 45 67',
      email: 'i.ndiaye@terangagroup.sn',
      city: 'Dakar (Sénégal)'
    },
    {
      id: 'guest-diop',
      name: 'M. Mamadou Diop',
      initials: 'MD',
      vipBadge: 'VIP Gold',
      vipIcon: 'verified',
      phone: '+221 77 654 32 10',
      email: 'm.diop@orange-sonatel.sn',
      city: 'Thiès (Grand Standing)'
    },
    {
      id: 'guest-jenkins',
      name: 'Mme Sarah Jenkins',
      initials: 'SJ',
      vipBadge: 'VIP Business',
      vipIcon: 'workspace_premium',
      phone: '+33 6 12 34 56 78',
      email: 's.jenkins@diplomatie.gouv.fr',
      city: 'Paris (France)'
    },
    {
      id: 'guest-sylla',
      name: 'M. Babacar Sylla',
      initials: 'BS',
      vipBadge: 'Client Fidèle',
      vipIcon: 'military_tech',
      phone: '+221 70 890 12 34',
      email: 'b.sylla@sylla-holding.sn',
      city: 'Saint-Louis (Sénégal)'
    }
  ];

  /** Grille tarifaire de démonstration issue de la maquette Stitch */
  readonly categoryOptions: CategoryCardOption[] = [
    {
      id: 'Standard',
      title: 'Standard',
      subtitle: 'Jardin tropical • Patio',
      ratePerNightFcfa: 85000,
      availableCountLabel: '2 dispo',
      badgeType: 'neutral',
      recommended: false
    },
    {
      id: 'Deluxe',
      title: 'Deluxe Balcon',
      subtitle: 'Balcon privé • Vue Patio arboré',
      ratePerNightFcfa: 130000,
      badge: 'Recommandé',
      badgeType: 'primary',
      availableCountLabel: 'Recommandé',
      recommended: true
    },
    {
      id: 'Suite',
      title: 'Suite Panoramique',
      subtitle: 'Terrasse privée rooftop',
      ratePerNightFcfa: 210000,
      badge: 'Dernière clé',
      badgeType: 'secondary',
      availableCountLabel: 'Dernière clé',
      recommended: false
    }
  ];

  /** Les 12 chambres de l'hôtel réparties sur les 3 catégories physiques */
  readonly roomsCatalog: SpecificRoomOption[] = [
    // Standard (101 à 106)
    {
      number: '101',
      category: 'Standard',
      label: 'Chambre 101 - Standard Patio',
      floor: 'Rez-de-jardin',
      details: 'Lit King, Douche Italienne, Patio arboré',
      imageFileName: 'chambre-101-standard'
    },
    {
      number: '102',
      category: 'Standard',
      label: 'Chambre 102 - Standard Patio',
      floor: 'Rez-de-jardin',
      details: 'Lit King, Bureau, Patio privatif',
      imageFileName: 'chambre-102-standard'
    },
    {
      number: '103',
      category: 'Standard',
      label: 'Chambre 103 - Standard Jardin',
      floor: '1er Étage',
      details: 'Lit Queen, Vue Jardin fleuri',
      imageFileName: 'chambre-103-standard'
    },
    {
      number: '104',
      category: 'Standard',
      label: 'Chambre 104 - Standard Jardin',
      floor: '1er Étage',
      details: 'Lit Queen, Calme côté cour',
      imageFileName: 'chambre-104-standard'
    },
    {
      number: '105',
      category: 'Standard',
      label: 'Chambre 105 - Standard Piscine',
      floor: '1er Étage',
      details: 'Lit King, Vue Bassin de détente',
      imageFileName: 'chambre-105-standard'
    },
    {
      number: '106',
      category: 'Standard',
      label: 'Chambre 106 - Standard Piscine',
      floor: '1er Étage',
      details: 'Lit King, Proche solarium',
      imageFileName: 'chambre-106-standard'
    },
    // Deluxe (201 à 204)
    {
      number: '201',
      category: 'Deluxe',
      label: 'Chambre 201 - Deluxe Balcon',
      floor: '1er Étage, Balcon Large',
      details: 'Grande baie vitrée, Balcon sur patio',
      imageFileName: 'chambre-201-deluxe'
    },
    {
      number: '202',
      category: 'Deluxe',
      label: 'Chambre 202 - Deluxe Balcon',
      floor: '1er Étage, Balcon',
      details: 'Espace salon, Balcon ombragé',
      imageFileName: 'chambre-202-deluxe'
    },
    {
      number: '203',
      category: 'Deluxe',
      label: 'Chambre 203 - Bungalow Deluxe Jardin',
      floor: 'Rez-de-jardin indépendant',
      details: 'Terrasse privée, Végétation tropicale',
      imageFileName: 'chambre-203-deluxe'
    },
    {
      number: '204',
      category: 'Deluxe',
      label: 'Chambre 204 - Bungalow Deluxe Terrasse',
      floor: 'Rez-de-jardin indépendant',
      details: 'Terrasse pergola, Accès direct piscine',
      imageFileName: 'chambre-204-deluxe'
    },
    // Suites (301 et 302)
    {
      number: '301',
      category: 'Suite',
      label: 'Chambre 301 - Suite Panoramique VIP',
      floor: '3e Étage Rooftop',
      details: 'Salon séparé, Terrasse panoramique 40m²',
      imageFileName: 'chambre-301-suite'
    },
    {
      number: '302',
      category: 'Suite',
      label: 'Chambre 302 - Suite Élysée Thiès',
      floor: '3e Étage Rooftop',
      details: 'Suite présidentielle, Bain balnéo',
      imageFileName: 'chambre-302-suite'
    }
  ];

  /** Ouvre la modal avec paramètres initiaux optionnels */
  open(params?: ReservationModalParams): void {
    this.errorMessage.set(null);
    this.currentParams.set(params ?? null);
    this.isOpen.set(true);
  }

  /** Ferme la modal */
  close(): void {
    this.isOpen.set(false);
    this.errorMessage.set(null);
    this.currentParams.set(null);
  }

  /** Confirme et enregistre la réservation */
  async confirmReservation(payload: ReservationSubmitPayload): Promise<boolean> {
    const guestLabel =
      payload.guestMode === 'REGULAR'
        ? this.regularGuests.find((g) => g.id === payload.regularGuestId)?.name || 'Client régulier'
        : payload.newGuest?.fullName || 'Nouveau client';

    // Contrôle strict de chevauchement sur la chambre demandée
    if (this.planningService?.hasConflict(payload.roomNumber, payload.checkInDate, payload.checkOutDate)) {
      const conflictMsg = `La chambre ${payload.roomNumber} est déjà réservée sur cette période (du ${payload.checkInDate} au ${payload.checkOutDate}). Réservation refusée.`;
      this.errorMessage.set(conflictMsg);
      this.feedbackMessage.set(conflictMsg);
      return false;
    }

    this.lastSubmittedReservation.set(payload);
    this.errorMessage.set(null);

    // Enregistrement dans le planning mock
    this.planningService?.createReservation({
      guestName: guestLabel,
      roomNumber: payload.roomNumber,
      checkInDate: payload.checkInDate,
      checkOutDate: payload.checkOutDate,
      nights: payload.nights,
      totalFcfa: payload.breakdown.totalStayTtcFcfa,
      depositAmountFcfa: payload.depositAmountFcfa,
      contactPhone: payload.guestMode === 'NEW' ? payload.newGuest?.phone : undefined,
      contactEmail: payload.guestMode === 'NEW' ? payload.newGuest?.email : undefined
    });

    this.feedbackMessage.set(
      `Réservation confirmée pour ${guestLabel} en Ch. ${payload.roomNumber} (${payload.nights} nuits, Total : ${payload.breakdown.totalStayTtcFcfa} FCFA). Bon émis avec succès.`
    );
    this.close();
    return true;
  }

  /** Enregistre un devis ou une option temporaire 48h */
  async saveDraftOption(payload: ReservationSubmitPayload): Promise<boolean> {
    this.lastSubmittedReservation.set(payload);
    this.feedbackMessage.set(
      `Option temporaire 48h réservée pour la Chambre ${payload.roomNumber} (${payload.nights} nuits).`
    );
    this.close();
    return true;
  }

  /** Récupère les chambres spécifiques pour une catégorie donnée */
  getRoomsForCategory(category: RoomCategoryType): SpecificRoomOption[] {
    return this.roomsCatalog.filter((r) => r.category === category);
  }

  /** Trouve une chambre par son numéro */
  getRoomByNumber(roomNumber: string): SpecificRoomOption | undefined {
    return this.roomsCatalog.find((r) => r.number === roomNumber);
  }
}
