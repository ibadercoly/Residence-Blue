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

/**
 * Catégories de chambres à la Résidence Blue.
 */
export enum RoomCategory {
  STANDARD = 'Standard',
  DELUXE = 'Deluxe',
  SUITE = 'Suite',
}

export interface RoomTypeDto {
  id: string;
  name: string;
  pricePerNight: number; // ENTIER strict en FCFA
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface RoomDto {
  id: string;
  number: string;
  typeId: string;
  type?: RoomTypeDto;
  floor: number;
  status: RoomStatus;
  amenities: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface UpdateRoomStatusDto {
  status: RoomStatus;
  reason?: string;
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
): { allowed: boolean; reason?: string } {
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
        reason: `Rôle RECEPTION non habilité pour la transition ${from} -> ${to}.`,
      };

    case Role.HOUSEKEEPING:
      // Équipe d'étage : Nettoyage validé (CLEANING -> FREE), signalement panne (CLEANING/FREE -> MAINTENANCE), ou retour au nettoyage (FREE -> CLEANING)
      if (from === RoomStatus.CLEANING && to === RoomStatus.FREE) return { allowed: true };
      if (from === RoomStatus.FREE && to === RoomStatus.CLEANING) return { allowed: true };
      if (to === RoomStatus.MAINTENANCE) return { allowed: true };
      return {
        allowed: false,
        reason: `Rôle HOUSEKEEPING non habilité pour la transition ${from} -> ${to}.`,
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
 * Données initiales des 12 chambres de la Résidence Blue (Grand Standing, Thiès) :
 * - 6 Standard (101 à 106) : 35 000 FCFA
 * - 4 Deluxe (201 à 204) : 55 000 FCFA
 * - 2 Suites (301 et 302) : 95 000 FCFA
 */
export const SEED_ROOM_TYPES = [
  { name: RoomCategory.STANDARD, pricePerNight: 35000 },
  { name: RoomCategory.DELUXE, pricePerNight: 55000 },
  { name: RoomCategory.SUITE, pricePerNight: 95000 },
];

export const SEED_ROOMS = [
  // 6 Chambres Standard - 35 000 FCFA (Étage 1)
  { number: '101', typeName: RoomCategory.STANDARD, floor: 1, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Salle de bain privée'] },
  { number: '102', typeName: RoomCategory.STANDARD, floor: 1, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Espace bureau'] },
  { number: '103', typeName: RoomCategory.STANDARD, floor: 1, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Vue patio arboré'] },
  { number: '104', typeName: RoomCategory.STANDARD, floor: 1, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Balcon privatif'] },
  { number: '105', typeName: RoomCategory.STANDARD, floor: 1, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Télévision Smart TV'] },
  { number: '106', typeName: RoomCategory.STANDARD, floor: 1, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit Queen Size', 'Douche à l’italienne'] },

  // 4 Chambres Deluxe - 55 000 FCFA (Étage 2)
  { number: '201', typeName: RoomCategory.DELUXE, floor: 2, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Terrasse vue piscine'] },
  { number: '202', typeName: RoomCategory.DELUXE, floor: 2, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Coin salon détente'] },
  { number: '203', typeName: RoomCategory.DELUXE, floor: 2, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Machine à café Nespresso'] },
  { number: '204', typeName: RoomCategory.DELUXE, floor: 2, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Lit King Size', 'Minibar', 'Douche XXL & Peignoirs'] },

  // 2 Suites Prestige - 95 000 FCFA (Étage 3)
  { number: '301', typeName: RoomCategory.SUITE, floor: 3, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Salon privé séparé', 'Baignoire balnéo', 'Terrasse panoramique', 'Service VIP'] },
  { number: '302', typeName: RoomCategory.SUITE, floor: 3, amenities: ['Climatisation', 'Wi-Fi Fibre', 'Salon privé séparé', 'Baignoire balnéo', 'Dressing spacieux', 'Vue Grand Standing'] },
];
