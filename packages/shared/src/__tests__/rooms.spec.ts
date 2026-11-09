import {
  RoomStatus,
  isRoomStatusTransitionAllowed,
  SEED_ROOMS,
  SEED_ROOM_TYPES,
  Role,
  getRoomImageUrl,
  getRoomImageAlt,
  FALLBACK_ROOM_IMAGE,
} from '../index';

describe('Règles métier des chambres & Machine à états', () => {
  describe('1. Règle absolue : interdiction de transition directe OCCUPIED -> FREE', () => {
    it('doit STRICTEMENT interdire la transition OCCUPIED vers FREE, même pour la DIRECTION', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.OCCUPIED,
        RoomStatus.FREE,
        Role.DIRECTION,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/passer par le nettoyage/i);
    });

    it('doit interdire la transition OCCUPIED vers FREE pour la RECEPTION', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.OCCUPIED,
        RoomStatus.FREE,
        Role.RECEPTION,
      );

      expect(result.allowed).toBe(false);
    });
  });

  describe('2. Transitions autorisées pour RECEPTION', () => {
    it('doit autoriser le check-in : FREE -> OCCUPIED', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.FREE,
        RoomStatus.OCCUPIED,
        Role.RECEPTION,
      );
      expect(result.allowed).toBe(true);
    });

    it('doit autoriser le check-out : OCCUPIED -> CLEANING', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.OCCUPIED,
        RoomStatus.CLEANING,
        Role.RECEPTION,
      );
      expect(result.allowed).toBe(true);
    });

    it('doit autoriser le signalement de maintenance : FREE -> MAINTENANCE', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.FREE,
        RoomStatus.MAINTENANCE,
        Role.RECEPTION,
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('3. Transitions autorisées pour HOUSEKEEPING', () => {
    it('doit autoriser la remise en état libre après ménage : CLEANING -> FREE', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.CLEANING,
        RoomStatus.FREE,
        Role.HOUSEKEEPING,
      );
      expect(result.allowed).toBe(true);
    });

    it('doit interdire le check-in à HOUSEKEEPING (FREE -> OCCUPIED)', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.FREE,
        RoomStatus.OCCUPIED,
        Role.HOUSEKEEPING,
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/non habilité/i);
    });
  });

  describe('4. Transitions autorisées pour MAINTENANCE', () => {
    it('doit autoriser le passage en MAINTENANCE depuis n’importe quel état', () => {
      expect(
        isRoomStatusTransitionAllowed(RoomStatus.FREE, RoomStatus.MAINTENANCE, Role.MAINTENANCE).allowed,
      ).toBe(true);
      expect(
        isRoomStatusTransitionAllowed(RoomStatus.OCCUPIED, RoomStatus.MAINTENANCE, Role.MAINTENANCE).allowed,
      ).toBe(true);
      expect(
        isRoomStatusTransitionAllowed(RoomStatus.CLEANING, RoomStatus.MAINTENANCE, Role.MAINTENANCE).allowed,
      ).toBe(true);
    });

    it('doit autoriser la sortie de maintenance vers CLEANING ou FREE', () => {
      expect(
        isRoomStatusTransitionAllowed(RoomStatus.MAINTENANCE, RoomStatus.CLEANING, Role.MAINTENANCE).allowed,
      ).toBe(true);
      expect(
        isRoomStatusTransitionAllowed(RoomStatus.MAINTENANCE, RoomStatus.FREE, Role.MAINTENANCE).allowed,
      ).toBe(true);
    });

    it('doit interdire l’installation d’un client en chambre en maintenance (MAINTENANCE -> OCCUPIED)', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.MAINTENANCE,
        RoomStatus.OCCUPIED,
        Role.MAINTENANCE,
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('5. Rôles non habilités (RESTAURANT, COMPTABLE)', () => {
    it('doit refuser toute modification de statut au personnel RESTAURANT', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.FREE,
        RoomStatus.OCCUPIED,
        Role.RESTAURANT,
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/non autorisé/i);
    });

    it('doit refuser toute modification de statut au rôle COMPTABLE', () => {
      const result = isRoomStatusTransitionAllowed(
        RoomStatus.CLEANING,
        RoomStatus.FREE,
        Role.COMPTABLE,
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('6. Données de référence Seed (12 chambres)', () => {
    it('doit comporter exactement 12 chambres et 3 catégories de prix entiers', () => {
      expect(SEED_ROOMS).toHaveLength(12);
      expect(SEED_ROOM_TYPES).toHaveLength(3);

      const standardType = SEED_ROOM_TYPES.find((t) => t.name === 'Standard');
      const deluxeType = SEED_ROOM_TYPES.find((t) => t.name === 'Deluxe');
      const suiteType = SEED_ROOM_TYPES.find((t) => t.name === 'Suite');

      expect(standardType?.pricePerNight).toBe(35000);
      expect(deluxeType?.pricePerNight).toBe(55000);
      expect(suiteType?.pricePerNight).toBe(95000);

      const standardRooms = SEED_ROOMS.filter((r) => r.typeName === 'Standard');
      const deluxeRooms = SEED_ROOMS.filter((r) => r.typeName === 'Deluxe');
      const suites = SEED_ROOMS.filter((r) => r.typeName === 'Suite');

      expect(standardRooms).toHaveLength(6);
      expect(deluxeRooms).toHaveLength(4);
      expect(suites).toHaveLength(2);

      // Vérification des numéros exacts
      expect(standardRooms.map((r) => r.number)).toEqual(['101', '102', '103', '104', '105', '106']);
      expect(deluxeRooms.map((r) => r.number)).toEqual(['201', '202', '203', '204']);
      expect(suites.map((r) => r.number)).toEqual(['301', '302']);
    });
  });

  describe('7. Photos des 12 chambres (Unicité, traçabilité & repli)', () => {
    it('doit associer une image locale valide à chaque numéro de chambre', () => {
      expect(SEED_ROOMS).toHaveLength(12);
      for (const room of SEED_ROOMS) {
        expect(room.imageUrl).toBeDefined();
        expect(room.imageUrl).toMatch(/^assets\/images\/chambres\/chambre-\d{3}-[\w-]+\.jpg$/);
        expect(room.imageAlt).toBeDefined();
        expect(room.imageAlt.length).toBeGreaterThan(10);
      }
    });

    it('doit avoir 12 images TOUTES DIFFÉRENTES (aucune répétition d’URL)', () => {
      const urls = SEED_ROOMS.map((r) => r.imageUrl);
      const uniqueUrls = new Set(urls);
      expect(uniqueUrls.size).toBe(12);
    });

    it('doit retourner l’image spécifique via getRoomImageUrl ou le fallback', () => {
      expect(getRoomImageUrl('101')).toBe('assets/images/chambres/chambre-101-standard.jpg');
      expect(getRoomImageUrl('302')).toBe('assets/images/chambres/chambre-302-suite.jpg');
      expect(getRoomImageUrl('999')).toBe(FALLBACK_ROOM_IMAGE);

      expect(getRoomImageAlt('101')).toContain('Chambre 101');
      expect(getRoomImageAlt('999')).toContain('Chambre 999');
    });
  });
});
