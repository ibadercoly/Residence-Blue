import {
  STARTER_PROFILES,
  getFirstAuthorizedRoute,
  hasScreenAccess,
  hasSpecialPermission,
  normalizeLegacyRole,
  resolveDefaultAccessForRole,
} from '../access';
import { Role } from '../roles';

describe('access model (@residence-blue/shared)', () => {
  it('regroupe CUISINE -> CUISINIER et SERVEUR -> RESTAURANT', () => {
    expect(normalizeLegacyRole(Role.CUISINE)).toBe(Role.CUISINIER);
    expect(normalizeLegacyRole(Role.SERVEUR)).toBe(Role.RESTAURANT);
    expect(normalizeLegacyRole(Role.RECEPTION)).toBe(Role.RECEPTION);
  });

  it('garantit que le profil Assistant(e) du restaurant n’a jamais Cuisine', () => {
    const restoProfile = STARTER_PROFILES.find(
      (p) => p.key === 'ASSISTANT_RESTAURANT',
    );
    expect(restoProfile).toBeDefined();
    expect(restoProfile!.screenAccess.restaurant).toBe('ECRITURE');
    expect(restoProfile!.screenAccess.cuisine).toBe('AUCUN');
    expect(restoProfile!.specialPermissions.encaisser_paiement).toBe(true);
    expect(restoProfile!.specialPermissions.annuler_commande_ou_reservation).toBe(
      true,
    );
  });

  it('garantit que Cuisinier n’a que Cuisine sans montants', () => {
    const cook = resolveDefaultAccessForRole(Role.CUISINIER);
    expect(cook.screenAccess.cuisine).toBe('ECRITURE');
    expect(cook.screenAccess.restaurant).toBe('AUCUN');
    expect(cook.specialPermissions.voir_montants).toBe(false);
    expect(
      getFirstAuthorizedRoute({
        role: Role.CUISINIER,
        screenAccess: cook.screenAccess,
      }),
    ).toBe('/cuisine');
  });

  it('évalue correctement hasScreenAccess et hasSpecialPermission', () => {
    const menage = STARTER_PROFILES.find((p) => p.key === 'MENAGE')!;
    const user = {
      role: Role.HOUSEKEEPING,
      isPrimaryAdmin: false,
      screenAccess: menage.screenAccess,
      specialPermissions: menage.specialPermissions,
    };
    expect(hasScreenAccess(user, 'chambres', 'LECTURE')).toBe(true);
    expect(hasScreenAccess(user, 'chambres', 'ECRITURE')).toBe(false);
    expect(hasScreenAccess(user, 'planning', 'LECTURE')).toBe(false);
    expect(hasSpecialPermission(user, 'changer_etat_chambre')).toBe(true);
    expect(hasSpecialPermission(user, 'voir_montants')).toBe(false);
    expect(getFirstAuthorizedRoute(user)).toBe('/chambres');
  });

  it('refuse toujours rapports pour tout profil autre que Directeur ou Comptable même avec JSON périmé ou voir_montants', () => {
    for (const role of [
      Role.RECEPTION,
      Role.RESTAURANT,
      Role.CUISINIER,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
    ]) {
      const stale = {
        role,
        isPrimaryAdmin: false,
        screenAccess: {
          accueil: 'ECRITURE' as const,
          planning: 'ECRITURE' as const,
          chambres: 'ECRITURE' as const,
          clients: 'ECRITURE' as const,
          facturation: 'ECRITURE' as const,
          restaurant: 'ECRITURE' as const,
          cuisine: 'AUCUN' as const,
          rapports: 'ECRITURE' as const,
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: true,
        },
      };
      expect(hasScreenAccess(stale, 'rapports', 'LECTURE')).toBe(false);
    }

    const comptable = resolveDefaultAccessForRole(Role.COMPTABLE);
    expect(
      hasScreenAccess(
        {
          role: Role.COMPTABLE,
          isPrimaryAdmin: false,
          starterProfile: 'COMPTABLE',
          screenAccess: comptable.screenAccess,
        },
        'rapports',
        'LECTURE',
      ),
    ).toBe(true);
  });
});
