import { Role } from './roles';

/**
 * Statuts possibles d'une chambre à la Résidence Blue.
 * Conforme au cahier des charges : FREE, OCCUPIED, CLEANING, MAINTENANCE.
 */
export enum RoomStatus {
  FREE = 'FREE',
  OCCUPIED = 'OCCUPIED',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
}

export enum RoomInterventionStatus {
  PENDING_DIRECTOR = 'PENDING_DIRECTOR',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface RoomInterventionRequestDto {
  id: string;
  roomId: string;
  roomNumber?: string;
  roomFloor?: number;
  roomCategory?: string;
  reportedById: string;
  reportedByName?: string;
  reportedByRole?: string;
  issueDescription: string;
  status: RoomInterventionStatus;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  completedById?: string | null;
  completedByName?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoomInterventionDto {
  issueDescription: string;
}

export interface RejectRoomInterventionDto {
  reason?: string;
}

/**
 * Catégories de chambres à la Résidence Blue.
 * Catégories réelles du tarif public : Standard, Confort, Appartement.
 */
export enum RoomCategory {
  STANDARD = 'Standard',
  CONFORT = 'Confort',
  APPARTEMENT = 'Appartement',
  UNCLASSIFIED = 'À classer',
  /** @deprecated Ancienne catégorie de démonstration conservée uniquement pour compatibilité ascendante */
  DELUXE = 'Deluxe',
  /** @deprecated Ancienne catégorie de démonstration conservée uniquement pour compatibilité ascendante */
  SUITE = 'Suite',
}

export interface RoomTypeDto {
  id: string;
  name: string;
  pricePerNight: number | null; // ENTIER strict en FCFA (null si masqué ou non défini)
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RoomDto {
  id: string;
  number: string;
  typeId: string;
  type?: RoomTypeDto;
  category?: string;
  tariffCategoryId?: string | null;
  tariffCategory?: {
    id: string;
    code: string;
    name: string;
  } | null;
  isUnclassified?: boolean;
  minTariffFcfa?: number | null;
  floor: number;
  status: RoomStatus;
  amenities: string[];
  imageUrl?: string;
  imageAlt?: string;
  adultsCapacity?: number;
  childrenCapacity?: number;
  bedType?: string;
  bedsCount?: number;
  surfaceM2?: number | null;
  view?: string | null;
  smoking?: boolean;
  connectingRoom?: string;
  pricePerNight?: number | null;
  highSeasonPricePerNight?: number | null;
  corporatePricePerNight?: number | null;
  breakfastIncluded?: boolean;
  description?: string;
  internalNote?: string;
  maintenanceReason?: string | null;
  activeInterventions?: RoomInterventionRequestDto[];
  isActive?: boolean;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CreateRoomDto {
  number: string;
  floor: number;
  category: string;
  tariffCategoryId?: string | null;
  status?: RoomStatus;
  pricePerNight?: number | null; // FCFA (optionnel : issu de la grille tarifaire)
  adultsCapacity?: number;
  childrenCapacity?: number;
  bedType?: string;
  bedsCount?: number;
  surfaceM2?: number | null;
  view?: string | null;
  smoking?: boolean;
  connectingRoom?: string;
  amenities?: string[];
  highSeasonPricePerNight?: number;
  corporatePricePerNight?: number;
  breakfastIncluded?: boolean;
  imageUrl?: string;
  description?: string;
  internalNote?: string;
  maintenanceReason?: string | null;
}

export interface UpdateRoomDto extends Partial<CreateRoomDto> {
  isActive?: boolean;
  removeImage?: boolean;
}

export interface UpdateRoomStatusDto {
  status: RoomStatus;
  reason?: string;
}

export interface RoomStatusStreamEvent {
  eventId: number;
  type: 'ROOM_STATUS_UPDATED' | 'HEARTBEAT';
  roomId?: string;
  roomNumber?: string;
  status?: RoomStatus;
  previousStatus?: RoomStatus;
  reason?: string | null;
  timestamp: string;
}

export interface CreateRoomTypeDto {
  name: string;
  pricePerNight: number; // ENTIER strict en FCFA
}

export interface UpdateRoomTypeDto {
  name?: string;
  pricePerNight?: number; // ENTIER strict en FCFA
}

/**
 * Matrice de validation des transitions de statut d'une chambre.
 * Règle stricte (docs/roles.md) :
 * - OCCUPIED -> FREE est strictement interdit (passage obligatoire par CLEANING).
 * - Droits par rôle respectés (DIRECTION, RECEPTION, HOUSEKEEPING, MAINTENANCE).
 */
export function isRoomStatusTransitionAllowed(
  from: RoomStatus,
  to: RoomStatus,
  role: Role | string,
): { allowed: boolean; forbidden?: boolean; reason?: string } {
  // Même statut : opération neutre
  if (from === to) {
    return { allowed: true };
  }

  // DIRECTION a accès à toutes les transitions valides (sauf OCCUPIED -> FREE)
  if (from === RoomStatus.OCCUPIED && to === RoomStatus.FREE) {
    return {
      allowed: false,
      reason: 'Transition interdite : une chambre occupée doit impérativement passer par le nettoyage (CLEANING) avant d’être remise en vente (FREE).',
    };
  }

  // Interdiction d'occuper une chambre sale ou en panne
  if ((from === RoomStatus.CLEANING || from === RoomStatus.MAINTENANCE) && to === RoomStatus.OCCUPIED) {
    return {
      allowed: false,
      reason: `Transition interdite : impossible d’installer un client dans une chambre ayant le statut ${from}.`,
    };
  }

  // Validation par rôle
  switch (role) {
    case Role.DIRECTION:
    case 'ADMIN':
    case 'MANAGER':
      return { allowed: true };

    case Role.RECEPTION:
    case 'RECEPTIONIST':
      // Réception : Check-in (FREE -> OCCUPIED), Check-out (OCCUPIED -> CLEANING), ou mise en MAINTENANCE
      if (from === RoomStatus.FREE && to === RoomStatus.OCCUPIED) return { allowed: true };
      if (from === RoomStatus.OCCUPIED && to === RoomStatus.CLEANING) return { allowed: true };
      if (to === RoomStatus.MAINTENANCE) return { allowed: true };
      if (from === RoomStatus.CLEANING && to === RoomStatus.FREE) return { allowed: true };
      return {
        allowed: false,
        forbidden: true,
        reason: from === RoomStatus.MAINTENANCE && (to === RoomStatus.CLEANING || to === RoomStatus.FREE) ? 'Seul le directeur ou le service technique peut remettre cette chambre en service.' : `Rôle RECEPTION non habilité pour la transition ${from} -> ${to}.`,
      };

    case Role.HOUSEKEEPING:
      // Équipe d'étage : Nettoyage validé (CLEANING -> FREE), signalement panne (CLEANING/FREE -> MAINTENANCE), ou retour au nettoyage (FREE -> CLEANING)
      if (from === RoomStatus.CLEANING && to === RoomStatus.FREE) return { allowed: true };
      if (from === RoomStatus.FREE && to === RoomStatus.CLEANING) return { allowed: true };
      if (to === RoomStatus.MAINTENANCE) return { allowed: true };
      return {
        allowed: false,
        forbidden: true,
        reason: from === RoomStatus.MAINTENANCE ? 'Seul le directeur ou le service technique peut remettre cette chambre en service.' : `Rôle HOUSEKEEPING non habilité pour la transition ${from} -> ${to}.`,
      };

    case Role.MAINTENANCE:
      // Équipe technique : mise en maintenance (*) ou sortie de maintenance vers CLEANING ou FREE
      if (to === RoomStatus.MAINTENANCE) return { allowed: true };
      if (from === RoomStatus.MAINTENANCE && (to === RoomStatus.CLEANING || to === RoomStatus.FREE)) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: `Rôle MAINTENANCE non habilité pour la transition ${from} -> ${to}.`,
      };

    default:
      return {
        allowed: false,
        reason: `Rôle ${role} non autorisé à modifier le statut d’une chambre.`,
      };
  }
}

/**
 * Catégories de chambres de référence de la Résidence Blue (Grand Standing, Thiès).
 * Les tarifs réels dépendent du nombre de personnes et de la grille tarifaire (tariffs.ts) :
 * aucun tarif fixe de démonstration n'est codé en dur sur les types de chambres.
 */
export const SEED_ROOM_TYPES: Array<{ name: RoomCategory; pricePerNight: number | null }> = [
  { name: RoomCategory.STANDARD, pricePerNight: null },
  { name: RoomCategory.CONFORT, pricePerNight: null },
  { name: RoomCategory.APPARTEMENT, pricePerNight: null },
];

export const FALLBACK_ROOM_IMAGE = 'assets/images/chambres/chambre-fallback.jpg';
export const FALLBACK_ROOM_IMAGE_WEBP = 'assets/images/chambres/chambre-fallback.webp';

export interface SeedRoomDefinition {
  number: string;
  typeName: RoomCategory;
  floor: number;
  amenities: string[];
  imageUrl: string;
  imageAlt: string;
}

export const SEED_ROOMS: SeedRoomDefinition[] = [
  // 6 Chambres Standard - 35 000 FCFA (Étage 1)
  {
    number: '101',
    typeName: RoomCategory.STANDARD,
    floor: 1,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Salle de bain privée'],
    imageUrl: 'assets/images/chambres/chambre-101-standard.jpg',
    imageAlt: 'Chambre 101, Standard, lit double sobre et tons chauds',
  },
  {
    number: '102',
    typeName: RoomCategory.STANDARD,
    floor: 1,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Espace bureau'],
    imageUrl: 'assets/images/chambres/chambre-102-standard.jpg',
    imageAlt: 'Chambre 102, Standard, espace bureau et parquet en bois clair',
  },
  {
    number: '103',
    typeName: RoomCategory.STANDARD,
    floor: 1,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Vue patio arboré'],
    imageUrl: 'assets/images/chambres/chambre-103-standard.jpg',
    imageAlt: 'Chambre 103, Standard, lit en bois et vue sur patio intérieur',
  },
  {
    number: '104',
    typeName: RoomCategory.STANDARD,
    floor: 1,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Balcon privatif'],
    imageUrl: 'assets/images/chambres/chambre-104-standard.jpg',
    imageAlt: 'Chambre 104, Standard, balcon privatif et jardin arboré',
  },
  {
    number: '105',
    typeName: RoomCategory.STANDARD,
    floor: 1,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Télévision Smart TV'],
    imageUrl: 'assets/images/chambres/chambre-105-standard.jpg',
    imageAlt: 'Chambre 105, Standard, chambre ensoleillée avec vue sur la piscine',
  },
  {
    number: '106',
    typeName: RoomCategory.STANDARD,
    floor: 1,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Douche à l’italienne'],
    imageUrl: 'assets/images/chambres/chambre-106-standard.jpg',
    imageAlt: 'Chambre 106, Standard, literie blanche épurée et douche à l’italienne',
  },

  // 4 Chambres Deluxe - 55 000 FCFA (Étage 2)
  {
    number: '201',
    typeName: RoomCategory.DELUXE,
    floor: 2,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Terrasse vue piscine'],
    imageUrl: 'assets/images/chambres/chambre-201-deluxe.jpg',
    imageAlt: 'Chambre 201, Deluxe, lit King et tête de lit bleu nuit boutique',
  },
  {
    number: '202',
    typeName: RoomCategory.DELUXE,
    floor: 2,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Coin salon détente'],
    imageUrl: 'assets/images/chambres/chambre-202-deluxe.jpg',
    imageAlt: 'Chambre 202, Deluxe, grande baie vitrée et coin détente',
  },
  {
    number: '203',
    typeName: RoomCategory.DELUXE,
    floor: 2,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Machine à café Nespresso'],
    imageUrl: 'assets/images/chambres/chambre-203-bungalow-deluxe.jpg',
    imageAlt: 'Chambre 203, Bungalow Deluxe, lit à baldaquin et terrasse tropicale',
  },
  {
    number: '204',
    typeName: RoomCategory.DELUXE,
    floor: 2,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Douche XXL & Peignoirs'],
    imageUrl: 'assets/images/chambres/chambre-204-bungalow-deluxe.jpg',
    imageAlt: 'Chambre 204, Bungalow Deluxe, pavillon indépendant avec toit de chaume et végétation',
  },

  // 2 Suites Prestige - 95 000 FCFA (Étage 3)
  {
    number: '301',
    typeName: RoomCategory.SUITE,
    floor: 3,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Salon privé séparé', 'Baignoire balnéo', 'Terrasse panoramique', 'Service VIP'],
    imageUrl: 'assets/images/chambres/chambre-301-suite.jpg',
    imageAlt: 'Chambre 301, Suite Prestige, vaste salon privé et baies panoramiques',
  },
  {
    number: '302',
    typeName: RoomCategory.SUITE,
    floor: 3,
    amenities: ['Climatisation', 'Wi-Fi Fibre', 'Salon privé séparé', 'Baignoire balnéo', 'Dressing spacieux', 'Vue Grand Standing'],
    imageUrl: 'assets/images/chambres/chambre-302-suite.jpg',
    imageAlt: 'Chambre 302, Suite Prestige, salon luxueux et terrasse privative',
  },
];

export function getRoomImageUrl(roomNumber: string): string {
  const seed = SEED_ROOMS.find((r) => r.number === roomNumber);
  return seed ? seed.imageUrl : FALLBACK_ROOM_IMAGE;
}

export function getRoomImageAlt(roomNumber: string): string {
  const seed = SEED_ROOMS.find((r) => r.number === roomNumber);
  return seed ? seed.imageAlt : `Chambre ${roomNumber} - Résidence Blue`;
}
