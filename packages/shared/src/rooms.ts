/**
 * Modèles des chambres de Résidence Blue.
 * Hôtel de 12 chambres à Thiès (Grand Standing) : Standard, Deluxe, Suite.
 */

export enum RoomType {
  STANDARD = 'STANDARD',
  DELUXE = 'DELUXE',
  SUITE = 'SUITE',
}

export enum RoomStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  DIRTY = 'DIRTY',
  CLEANING = 'CLEANING',
  MAINTENANCE = 'MAINTENANCE',
}

export interface RoomDefinition {
  id: string;
  number: string;
  name: string;
  type: RoomType;
  floor: number;
  basePriceFcfa: number; // Entier strict
  capacity: number;
  description: string;
}

/**
 * Inventaire fixe des 12 chambres de la Résidence Blue (Thiès - Grand Standing, Sénégal).
 * Montants en entiers FCFA.
 */
export const HOTEL_ROOMS_CATALOG: RoomDefinition[] = [
  // 6 Chambres Standard (RDC et 1er étage)
  {
    id: 'room-101',
    number: '101',
    name: 'Chambre Mbour',
    type: RoomType.STANDARD,
    floor: 0,
    basePriceFcfa: 40000,
    capacity: 2,
    description: 'Chambre Standard côté jardin avec lit Queen, climatisation et salle d’eau.',
  },
  {
    id: 'room-102',
    number: '102',
    name: 'Chambre Somone',
    type: RoomType.STANDARD,
    floor: 0,
    basePriceFcfa: 40000,
    capacity: 2,
    description: 'Chambre Standard confortable au rez-de-chaussée avec vue patio.',
  },
  {
    id: 'room-103',
    number: '103',
    name: 'Chambre Popenguine',
    type: RoomType.STANDARD,
    floor: 0,
    basePriceFcfa: 40000,
    capacity: 2,
    description: 'Chambre Standard au calme, décorée avec touches d’artisanat local.',
  },
  {
    id: 'room-104',
    number: '104',
    name: 'Chambre Toubab Dialaw',
    type: RoomType.STANDARD,
    floor: 1,
    basePriceFcfa: 45000,
    capacity: 2,
    description: 'Chambre Standard au 1er étage avec balcon privatif.',
  },
  {
    id: 'room-105',
    number: '105',
    name: 'Chambre Nianing',
    type: RoomType.STANDARD,
    floor: 1,
    basePriceFcfa: 45000,
    capacity: 2,
    description: 'Chambre Standard lumineuse au 1er étage avec vue piscine.',
  },
  {
    id: 'room-106',
    number: '106',
    name: 'Chambre Joal',
    type: RoomType.STANDARD,
    floor: 1,
    basePriceFcfa: 45000,
    capacity: 2,
    description: 'Chambre Standard contemporaine avec espace bureau et Wi-Fi haut débit.',
  },

  // 4 Chambres Deluxe (Vue piscine / terrasse)
  {
    id: 'room-201',
    number: '201',
    name: 'Deluxe Lagune',
    type: RoomType.DELUXE,
    floor: 1,
    basePriceFcfa: 65000,
    capacity: 2,
    description: 'Chambre Deluxe spacieuse avec grand lit King, minibar et terrasse.',
  },
  {
    id: 'room-202',
    number: '202',
    name: 'Deluxe Baobab',
    type: RoomType.DELUXE,
    floor: 1,
    basePriceFcfa: 65000,
    capacity: 2,
    description: 'Chambre Deluxe avec coin salon et vue panoramique sur la piscine.',
  },
  {
    id: 'room-203',
    number: '203',
    name: 'Deluxe Almadies',
    type: RoomType.DELUXE,
    floor: 1,
    basePriceFcfa: 65000,
    capacity: 3,
    description: 'Chambre Deluxe familiale avec canapé convertible.',
  },
  {
    id: 'room-204',
    number: '204',
    name: 'Deluxe Gorée',
    type: RoomType.DELUXE,
    floor: 1,
    basePriceFcfa: 65000,
    capacity: 2,
    description: 'Chambre Deluxe romantique avec douche à l’italienne XXL.',
  },

  // 2 Suites Prestige
  {
    id: 'room-301',
    number: '301',
    name: 'Suite Teranga',
    type: RoomType.SUITE,
    floor: 2,
    basePriceFcfa: 110000,
    capacity: 4,
    description: 'Suite Prestige avec salon séparé, double terrasse et service VIP d’excellence.',
  },
  {
    id: 'room-302',
    number: '302',
    name: 'Suite Saloum',
    type: RoomType.SUITE,
    floor: 2,
    basePriceFcfa: 110000,
    capacity: 4,
    description: 'Suite d’exception avec baignoire balnéo, dressing et vue dégagée sur le quartier résidentiel de Grand Standing.',
  },
];
