import { Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { GuestProfile, GuestNoteItem } from '@residence-blue/shared';

@Injectable({
  providedIn: 'root'
})
export class GuestProfileService {
  /**
   * Taux de conversion fixe officiel EUR -> FCFA lu depuis les paramètres de l'hôtel
   * 1 EUR = 655.957 FCFA (Banque Centrale des États de l'Afrique de l'Ouest)
   */
  readonly exchangeRateEurToFcfa = signal<number>(655.957);

  // Profil par défaut Mamadou Diop conforme à la maquette et adapté à Thiès (ADAPTATION-THIES.md)
  private readonly defaultProfile: GuestProfile = {
    id: 'c1',
    civility: 'M.',
    firstName: 'Mamadou',
    lastName: 'Diop',
    fullName: 'M. Mamadou Diop',
    vipTier: 'VIP Gold',
    avatarUrl: 'assets/images/clients/avatar-mamadou-diop.jpg',
    loyaltyStayCount: 4,
    totalNights: 18,
    totalSpentFcfa: 3850000,
    averageBasketFcfa: 962500,
    averageStayNights: 4.5,
    memberSinceDate: '12 Jan. 2023',
    memberSinceDuration: '1 an et 4 mois',
    lodgingRatioPercent: 78,
    fbRatioPercent: 22,
    nationality: 'Sénégalaise',
    phone: '+221 77 654 32 10',
    email: 'mamadou.diop@terangagroup.sn',
    affiliationCompany: 'Teranga Group',
    affiliationRole: 'Dir. Associé',
    residenceCity: 'Almadies, Dakar',
    passportNumber: 'SN-982341-B',
    passportExpiry: '14/09/2027',
    favoriteRoom: {
      name: 'Suite Panoramique (301)',
      number: '301',
      photoUrl: 'assets/images/clients/room-favorite-suite.jpg',
      reason: 'Choisie lors de 3 séjours consécutifs'
    },
    permanentInstructions: [
      {
        icon: 'airport_shuttle',
        text: 'Navette aéroport systématique',
        variant: 'secondary'
      },
      {
        icon: 'wine_bar',
        text: "Bouteille d'accueil",
        variant: 'surface'
      },
      {
        icon: 'deck',
        text: 'Table terrasse vue piscine & jardin',
        variant: 'surface'
      },
      {
        icon: 'bed',
        text: 'Oreillers duvet fermes',
        variant: 'primary'
      }
    ],
    dietaryPreferences: {
      diet: 'Sans porc',
      allergies: 'Aucune déclarée'
    },
    stays: [
      {
        id: 'stay-1',
        order: 1,
        periodTitle: '1. Mai 2024 (En cours)',
        status: 'ACTIVE',
        statusBadge: 'Actif • Ch. 301',
        roomNumber: '301',
        roomName: 'Suite Panoramique',
        reference: '#RB-2024-0894',
        datesLabel: 'Du 23 au 27 Mai 2024 (4 nuits)',
        nights: 4,
        adults: 2,
        extrasSummary: 'Extras : Restaurant La Teranga, Navette VIP DSS',
        totalFcfa: 780000,
        remainingFcfa: 280000,
        paymentInfo: 'Acompte de 500 000 FCFA reçu (Wave)',
        isCurrent: true
      },
      {
        id: 'stay-2',
        order: 2,
        periodTitle: '2. Février 2024',
        status: 'COMPLETED',
        statusBadge: 'Terminé • Ch. 204',
        roomNumber: '204',
        roomName: 'Standard Patio Baobab',
        reference: '#RB-2024-0211',
        datesLabel: 'Du 14 au 19 Fév. 2024 (5 nuits)',
        nights: 5,
        adults: 2,
        extrasSummary: 'Séjour Saint-Valentin / Détente',
        totalFcfa: 1125000,
        remainingFcfa: 0,
        paymentInfo: 'Payé Wave',
        isCurrent: false
      },
      {
        id: 'stay-3',
        order: 3,
        periodTitle: '3. Octobre 2023',
        status: 'COMPLETED',
        statusBadge: 'Terminé • Ch. 202',
        roomNumber: '202',
        roomName: 'Deluxe Balcon',
        reference: '#RB-2023-1102',
        datesLabel: 'Du 06 au 09 Oct. 2023 (3 nuits)',
        nights: 3,
        adults: 1,
        extrasSummary: 'Affaires / Séminaire Teranga',
        totalFcfa: 690000,
        remainingFcfa: 0,
        paymentInfo: 'Payé CB Visa',
        isCurrent: false
      },
      {
        id: 'stay-4',
        order: 4,
        periodTitle: '4. Janvier 2023 (Premier séjour)',
        status: 'COMPLETED',
        statusBadge: 'Terminé • Ch. 302',
        roomNumber: '302',
        roomName: 'Suite Prestige Filaos',
        reference: '#RB-2023-0145',
        datesLabel: 'Du 12 au 18 Jan. 2023 (6 nuits)',
        nights: 6,
        adults: 2,
        extrasSummary: 'Nouvel An & Repos',
        totalFcfa: 1255000,
        remainingFcfa: 0,
        paymentInfo: 'Payé Virement',
        isCurrent: false
      }
    ],
    preferences: [
      {
        id: 'pref-1',
        category: 'morning',
        icon: 'wb_twilight',
        title: 'Réveil & Matin',
        description: 'Café Touba traditionnel servi en terrasse à 08h00 pile. Journal Le Soleil déposé.'
      },
      {
        id: 'pref-2',
        category: 'bedding',
        icon: 'bedtime',
        title: 'Couchage & Confort',
        description: 'Double oreillers plumes fermes, climatisation réglée impérativement à 23°C.'
      },
      {
        id: 'pref-3',
        category: 'transfer',
        icon: 'directions_car',
        title: 'Transfert VIP',
        description: "Mercedes SUV de l'hôtel depuis/vers Aéroport Blaise Diagne (DSS). Chauffeur habituel : Moussa."
      }
    ],
    folios: [
      {
        id: 'folio-1',
        reference: '#RB-2024-0894',
        stayDate: 'Mai 2024',
        roomLabel: 'Ch. 301 - Suite Panoramique',
        totalAmountFcfa: 780000,
        paidAmountFcfa: 500000,
        balanceFcfa: 280000,
        paymentMethod: 'Wave (Acompte)',
        status: 'PARTIAL'
      },
      {
        id: 'folio-2',
        reference: '#RB-2024-0211',
        stayDate: 'Février 2024',
        roomLabel: 'Ch. 204 - Standard Patio',
        totalAmountFcfa: 1125000,
        paidAmountFcfa: 1125000,
        balanceFcfa: 0,
        paymentMethod: 'Wave Business',
        status: 'PAID'
      },
      {
        id: 'folio-3',
        reference: '#RB-2023-1102',
        stayDate: 'Octobre 2023',
        roomLabel: 'Ch. 202 - Deluxe Balcon',
        totalAmountFcfa: 690000,
        paidAmountFcfa: 690000,
        balanceFcfa: 0,
        paymentMethod: 'Carte Visa Pro',
        status: 'PAID'
      },
      {
        id: 'folio-4',
        reference: '#RB-2023-0145',
        stayDate: 'Janvier 2023',
        roomLabel: 'Ch. 302 - Suite Prestige',
        totalAmountFcfa: 1255000,
        paidAmountFcfa: 1255000,
        balanceFcfa: 0,
        paymentMethod: 'Virement bancaire CBAO',
        status: 'PAID'
      }
    ],
    notes: [
      {
        id: 'note-1',
        authorName: 'Aminata S.',
        department: 'Housekeeping',
        timeAgo: 'Hier, 14:20',
        content: 'Client particulièrement courtois. A demandé 2 draps de bain de piscine supplémentaires pour la terrasse. Déjà installés.'
      },
      {
        id: 'note-2',
        authorName: 'Cheikh N.',
        department: 'Conciergerie',
        timeAgo: '23 Mai, 10:15',
        content: "A sollicité la réservation excursion Réserve de Bandia & transfert AIBD (Diass) samedi matin. Prévenu le prestataire."
      }
    ]
  };

  private currentProfileState = signal<GuestProfile>(JSON.parse(JSON.stringify(this.defaultProfile)));

  /**
   * Récupère le profil client par identifiant
   */
  getGuestProfile(_id: string): Observable<GuestProfile> {
    // Dans ce mock, nous retournons le profil de Mamadou Diop
    return of(this.currentProfileState());
  }

  /**
   * Convertit un montant FCFA en Euros selon le taux fixe des paramètres.
   * Par défaut, arrondit à la dizaine la plus proche pour les estimations affichées (ex: 5 870 €).
   */
  convertFcfaToEuro(amountFcfa: number, roundToTen = true): number {
    const rate = this.exchangeRateEurToFcfa();
    if (!rate || rate <= 0) return 0;
    const exact = amountFcfa / rate;
    return roundToTen ? Math.round(exact / 10) * 10 : Math.round(exact);
  }

  /**
   * Vérifie si le rôle utilisateur connecté a l'autorisation de voir le numéro de pièce sensible
   */
  canRevealPassport(userRole: string): boolean {
    const allowedRoles = ['DIRECTRICE', 'RECEPTIONNISTE', 'ADMIN'];
    return allowedRoles.includes(userRole.toUpperCase());
  }

  /**
   * Ajoute une nouvelle consigne/note d'équipe
   */
  addNote(content: string, authorName = 'Aïssatou Ba', department = 'Direction'): void {
    if (!content || !content.trim()) return;

    const newNote: GuestNoteItem = {
      id: `note-${Date.now()}`,
      authorName,
      department,
      timeAgo: "À l'instant",
      content: content.trim()
    };

    const current = this.currentProfileState();
    const updated: GuestProfile = {
      ...current,
      notes: [newNote, ...current.notes]
    };
    this.currentProfileState.set(updated);
  }
}
