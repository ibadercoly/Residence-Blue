import { Role } from './roles';

export type ScreenKey =
  | 'accueil'
  | 'planning'
  | 'chambres'
  | 'clients'
  | 'facturation'
  | 'restaurant'
  | 'cuisine'
  | 'rapports';

export type AccessLevel = 'AUCUN' | 'LECTURE' | 'ECRITURE';

export type SpecialPermissionKey =
  | 'voir_montants'
  | 'encaisser_paiement'
  | 'changer_etat_chambre'
  | 'annuler_commande_ou_reservation';

export type StarterProfileKey =
  | 'DIRECTEUR'
  | 'ASSISTANT_RECEPTION'
  | 'ASSISTANT_RESTAURANT'
  | 'CUISINIER'
  | 'MENAGE'
  | 'TECHNIQUE'
  | 'COMPTABLE';

export type ScreenAccessMap = Record<ScreenKey, AccessLevel>;
export type SpecialPermissionsMap = Record<SpecialPermissionKey, boolean>;

export interface UserAccessProfile {
  isPrimaryAdmin: boolean;
  mustChangePassword: boolean;
  starterProfile: StarterProfileKey | null;
  screenAccess: ScreenAccessMap;
  specialPermissions: SpecialPermissionsMap;
}

export interface ScreenDefinition {
  key: ScreenKey;
  label: string;
  route: string;
  icon: string;
  colorClass: string;
}

export interface SpecialPermissionDefinition {
  key: SpecialPermissionKey;
  label: string;
  description: string;
}

export interface StarterProfileDefinition {
  key: Exclude<StarterProfileKey, 'DIRECTEUR'>;
  label: string;
  description: string;
  role: Role;
  screenAccess: ScreenAccessMap;
  specialPermissions: SpecialPermissionsMap;
}

export const SCREEN_DEFINITIONS: readonly ScreenDefinition[] = [
  {
    key: 'accueil',
    label: 'Accueil',
    route: '/accueil',
    icon: 'home',
    colorClass: 'rb-menu-color-accueil',
  },
  {
    key: 'planning',
    label: 'Planning',
    route: '/planning',
    icon: 'calendar_month',
    colorClass: 'rb-menu-color-planning',
  },
  {
    key: 'chambres',
    label: 'Chambres',
    route: '/chambres',
    icon: 'bed',
    colorClass: 'rb-menu-color-chambres',
  },
  {
    key: 'clients',
    label: 'Clients',
    route: '/clients',
    icon: 'group',
    colorClass: 'rb-menu-color-clients',
  },
  {
    key: 'facturation',
    label: 'Facturation',
    route: '/facturation',
    icon: 'receipt_long',
    colorClass: 'rb-menu-color-facturation',
  },
  {
    key: 'restaurant',
    label: 'Restaurant',
    route: '/restaurant',
    icon: 'restaurant',
    colorClass: 'rb-menu-color-restaurant',
  },
  {
    key: 'cuisine',
    label: 'Cuisine',
    route: '/cuisine',
    icon: 'soup_kitchen',
    colorClass: 'rb-menu-color-cuisine',
  },
  {
    key: 'rapports',
    label: 'Rapports',
    route: '/rapports',
    icon: 'analytics',
    colorClass: 'rb-menu-color-rapports',
  },
] as const;

export const SPECIAL_PERMISSION_DEFINITIONS: readonly SpecialPermissionDefinition[] = [
  {
    key: 'voir_montants',
    label: 'Voir les montants',
    description: 'Afficher les prix, totaux, soldes et chiffres d’affaires.',
  },
  {
    key: 'encaisser_paiement',
    label: 'Encaisser un paiement',
    description: 'Enregistrer les règlements clients (chambre ou restaurant).',
  },
  {
    key: 'changer_etat_chambre',
    label: 'Changer l’état d’une chambre',
    description: 'Passer une chambre en nettoyage, prête ou maintenance.',
  },
  {
    key: 'annuler_commande_ou_reservation',
    label: 'Annuler une commande ou une réservation',
    description: 'Annuler une commande restaurant ou une réservation autorisée.',
  },
] as const;

export const DIRECTOR_EXCLUSIVE_ACTIONS: readonly string[] = [
  'Supprimer des fiches ou écritures',
  'Émettre des avoirs et annuler un paiement',
  'Forcer un départ (check-out forcé)',
  'Réinitialiser les données',
  'Gérer les comptes et accès',
  'Modifier la carte (plats et prix)',
  'Modifier l’apparence et les paramètres',
] as const;

export function createEmptyScreenAccess(): ScreenAccessMap {
  return {
    accueil: 'AUCUN',
    planning: 'AUCUN',
    chambres: 'AUCUN',
    clients: 'AUCUN',
    facturation: 'AUCUN',
    restaurant: 'AUCUN',
    cuisine: 'AUCUN',
    rapports: 'AUCUN',
  };
}

export function createFullScreenAccess(): ScreenAccessMap {
  return {
    accueil: 'ECRITURE',
    planning: 'ECRITURE',
    chambres: 'ECRITURE',
    clients: 'ECRITURE',
    facturation: 'ECRITURE',
    restaurant: 'ECRITURE',
    cuisine: 'ECRITURE',
    rapports: 'ECRITURE',
  };
}

export function createEmptySpecialPermissions(): SpecialPermissionsMap {
  return {
    voir_montants: false,
    encaisser_paiement: false,
    changer_etat_chambre: false,
    annuler_commande_ou_reservation: false,
  };
}

export function createFullSpecialPermissions(): SpecialPermissionsMap {
  return {
    voir_montants: true,
    encaisser_paiement: true,
    changer_etat_chambre: true,
    annuler_commande_ou_reservation: true,
  };
}

export const STARTER_PROFILES: readonly StarterProfileDefinition[] = [
  {
    key: 'ASSISTANT_RECEPTION',
    label: 'Assistant(e) de réception',
    description: 'Accueil, planning, chambres, clients, facturation et commandes.',
    role: Role.RECEPTION,
    screenAccess: {
      accueil: 'ECRITURE',
      planning: 'ECRITURE',
      chambres: 'ECRITURE',
      clients: 'ECRITURE',
      facturation: 'ECRITURE',
      restaurant: 'ECRITURE',
      cuisine: 'AUCUN',
      rapports: 'AUCUN',
    },
    specialPermissions: {
      voir_montants: true,
      encaisser_paiement: true,
      changer_etat_chambre: true,
      annuler_commande_ou_reservation: true,
    },
  },
  {
    key: 'ASSISTANT_RESTAURANT',
    label: 'Assistant(e) du restaurant',
    description: 'Prise de commande, encaissement et annulation. Sans accès Cuisine.',
    role: Role.RESTAURANT,
    screenAccess: {
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'AUCUN',
      clients: 'AUCUN',
      facturation: 'AUCUN',
      restaurant: 'ECRITURE',
      cuisine: 'AUCUN',
      rapports: 'AUCUN',
    },
    specialPermissions: {
      voir_montants: true,
      encaisser_paiement: true,
      changer_etat_chambre: false,
      annuler_commande_ou_reservation: true,
    },
  },
  {
    key: 'CUISINIER',
    label: 'Cuisinier',
    description: 'Écran Cuisine uniquement, sans prix ni nom de client.',
    role: Role.CUISINIER,
    screenAccess: {
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'AUCUN',
      clients: 'AUCUN',
      facturation: 'AUCUN',
      restaurant: 'AUCUN',
      cuisine: 'ECRITURE',
      rapports: 'AUCUN',
    },
    specialPermissions: createEmptySpecialPermissions(),
  },
  {
    key: 'MENAGE',
    label: 'Ménage',
    description: 'Chambres en lecture et mise à jour de l’état de propreté.',
    role: Role.HOUSEKEEPING,
    screenAccess: {
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'LECTURE',
      clients: 'AUCUN',
      facturation: 'AUCUN',
      restaurant: 'AUCUN',
      cuisine: 'AUCUN',
      rapports: 'AUCUN',
    },
    specialPermissions: {
      voir_montants: false,
      encaisser_paiement: false,
      changer_etat_chambre: true,
      annuler_commande_ou_reservation: false,
    },
  },
  {
    key: 'TECHNIQUE',
    label: 'Technique',
    description: 'Consultation de l’état des chambres.',
    role: Role.MAINTENANCE,
    screenAccess: {
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'LECTURE',
      clients: 'AUCUN',
      facturation: 'AUCUN',
      restaurant: 'AUCUN',
      cuisine: 'AUCUN',
      rapports: 'AUCUN',
    },
    specialPermissions: createEmptySpecialPermissions(),
  },
  {
    key: 'COMPTABLE',
    label: 'Comptable',
    description: 'Facturation et Rapports en lecture avec affichage des montants.',
    role: Role.COMPTABLE,
    screenAccess: {
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'AUCUN',
      clients: 'AUCUN',
      facturation: 'LECTURE',
      restaurant: 'AUCUN',
      cuisine: 'AUCUN',
      rapports: 'LECTURE',
    },
    specialPermissions: {
      voir_montants: true,
      encaisser_paiement: false,
      changer_etat_chambre: false,
      annuler_commande_ou_reservation: false,
    },
  },
] as const;

export function normalizeLegacyRole(role: Role | string): Role {
  if (role === Role.CUISINE || role === 'CUISINE') return Role.CUISINIER;
  if (role === Role.SERVEUR || role === 'SERVEUR') return Role.RESTAURANT;
  return role as Role;
}

export function getStarterProfileByKey(
  key: StarterProfileKey | string | null | undefined,
): StarterProfileDefinition | undefined {
  if (!key || key === 'DIRECTEUR') return undefined;
  return STARTER_PROFILES.find((p) => p.key === key);
}

export function getStarterProfileLabel(
  profile: StarterProfileKey | string | null | undefined,
  role?: Role | string,
): string {
  if (profile === 'DIRECTEUR' || role === Role.DIRECTION) {
    return 'Directeur';
  }
  const found = getStarterProfileByKey(profile);
  if (found) return found.label;
  const normalized = role ? normalizeLegacyRole(role) : undefined;
  switch (normalized) {
    case Role.RECEPTION:
      return 'Assistant(e) de réception';
    case Role.RESTAURANT:
      return 'Assistant(e) du restaurant';
    case Role.CUISINIER:
      return 'Cuisinier';
    case Role.HOUSEKEEPING:
      return 'Ménage';
    case Role.MAINTENANCE:
      return 'Technique';
    case Role.COMPTABLE:
      return 'Comptable';
    default:
      return 'Profil personnalisé';
  }
}

export function mapRoleToStarterProfile(role: Role | string): StarterProfileKey {
  const normalized = normalizeLegacyRole(role);
  switch (normalized) {
    case Role.DIRECTION:
      return 'DIRECTEUR';
    case Role.RECEPTION:
      return 'ASSISTANT_RECEPTION';
    case Role.RESTAURANT:
      return 'ASSISTANT_RESTAURANT';
    case Role.CUISINIER:
      return 'CUISINIER';
    case Role.HOUSEKEEPING:
      return 'MENAGE';
    case Role.MAINTENANCE:
      return 'TECHNIQUE';
    case Role.COMPTABLE:
      return 'COMPTABLE';
    default:
      return 'ASSISTANT_RECEPTION';
  }
}

export function inferRoleFromScreenAccess(
  screenAccess: ScreenAccessMap,
  starterProfile?: StarterProfileKey | null,
): Role {
  const byStarter = getStarterProfileByKey(starterProfile);
  if (byStarter) {
    return byStarter.role;
  }
  if (screenAccess.cuisine !== 'AUCUN' && screenAccess.restaurant === 'AUCUN') {
    return Role.CUISINIER;
  }
  if (
    screenAccess.restaurant !== 'AUCUN' &&
    screenAccess.planning === 'AUCUN' &&
    screenAccess.facturation === 'AUCUN'
  ) {
    return Role.RESTAURANT;
  }
  if (screenAccess.facturation !== 'AUCUN' || screenAccess.rapports !== 'AUCUN') {
    return screenAccess.planning !== 'AUCUN' ? Role.RECEPTION : Role.COMPTABLE;
  }
  if (screenAccess.chambres !== 'AUCUN') {
    return Role.HOUSEKEEPING;
  }
  return Role.RECEPTION;
}

export function sanitizeScreenAccess(
  input: Partial<Record<string, unknown>> | null | undefined,
  fallback?: ScreenAccessMap,
): ScreenAccessMap {
  const base = fallback ? { ...fallback } : createEmptyScreenAccess();
  if (!input || typeof input !== 'object') return base;
  for (const def of SCREEN_DEFINITIONS) {
    const val = input[def.key];
    if (val === 'AUCUN' || val === 'LECTURE' || val === 'ECRITURE') {
      base[def.key] = val;
    }
  }
  return base;
}

export function sanitizeSpecialPermissions(
  input: Partial<Record<string, unknown>> | null | undefined,
  fallback?: SpecialPermissionsMap,
): SpecialPermissionsMap {
  const base = fallback ? { ...fallback } : createEmptySpecialPermissions();
  if (!input || typeof input !== 'object') return base;
  for (const def of SPECIAL_PERMISSION_DEFINITIONS) {
    if (typeof input[def.key] === 'boolean') {
      base[def.key] = input[def.key] as boolean;
    }
  }
  return base;
}

/**
 * Compatibilité des comptes créés sans profil JSON explicite (ex. helpers de test historiques).
 */
export function resolveDefaultAccessForRole(
  role: Role | string,
  isPrimaryAdmin = false,
): {
  screenAccess: ScreenAccessMap;
  specialPermissions: SpecialPermissionsMap;
  starterProfile: StarterProfileKey;
} {
  const normalized = normalizeLegacyRole(role);
  if (isPrimaryAdmin || normalized === Role.DIRECTION) {
    return {
      starterProfile: 'DIRECTEUR',
      screenAccess: createFullScreenAccess(),
      specialPermissions: createFullSpecialPermissions(),
    };
  }
  switch (normalized) {
    case Role.RECEPTION:
      return {
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: { ...STARTER_PROFILES[0].screenAccess },
        specialPermissions: { ...STARTER_PROFILES[0].specialPermissions },
      };
    case Role.RESTAURANT:
      return {
        starterProfile: 'ASSISTANT_RESTAURANT',
        screenAccess: {
          ...STARTER_PROFILES[1].screenAccess,
          accueil: 'LECTURE',
        },
        specialPermissions: { ...STARTER_PROFILES[1].specialPermissions },
      };
    case Role.CUISINIER:
      return {
        starterProfile: 'CUISINIER',
        screenAccess: { ...STARTER_PROFILES[2].screenAccess },
        specialPermissions: { ...STARTER_PROFILES[2].specialPermissions },
      };
    case Role.HOUSEKEEPING:
      return {
        starterProfile: 'MENAGE',
        screenAccess: {
          ...STARTER_PROFILES[3].screenAccess,
          accueil: 'LECTURE',
        },
        specialPermissions: { ...STARTER_PROFILES[3].specialPermissions },
      };
    case Role.MAINTENANCE:
      return {
        starterProfile: 'TECHNIQUE',
        screenAccess: {
          ...STARTER_PROFILES[4].screenAccess,
          accueil: 'LECTURE',
        },
        specialPermissions: { ...STARTER_PROFILES[4].specialPermissions },
      };
    case Role.COMPTABLE:
      return {
        starterProfile: 'COMPTABLE',
        screenAccess: {
          ...STARTER_PROFILES[5].screenAccess,
          accueil: 'LECTURE',
        },
        specialPermissions: { ...STARTER_PROFILES[5].specialPermissions },
      };
    default:
      return {
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: createEmptyScreenAccess(),
        specialPermissions: createEmptySpecialPermissions(),
      };
  }
}

export function isDirectorAccount(user: {
  role?: Role | string | null;
  isPrimaryAdmin?: boolean | null;
}): boolean {
  return Boolean(user.isPrimaryAdmin) || user.role === Role.DIRECTION;
}

export function hasScreenAccess(
  user: {
    role?: Role | string | null;
    isPrimaryAdmin?: boolean | null;
    screenAccess?: ScreenAccessMap | null;
  } | null | undefined,
  screen: ScreenKey,
  required: Exclude<AccessLevel, 'AUCUN'> = 'LECTURE',
): boolean {
  if (!user) return false;
  if (isDirectorAccount(user)) return true;
  const map = user.screenAccess ?? resolveDefaultAccessForRole(user.role ?? '').screenAccess;
  const current = map[screen] ?? 'AUCUN';
  if (required === 'LECTURE') {
    return current === 'LECTURE' || current === 'ECRITURE';
  }
  return current === 'ECRITURE';
}

export function hasSpecialPermission(
  user: {
    role?: Role | string | null;
    isPrimaryAdmin?: boolean | null;
    specialPermissions?: SpecialPermissionsMap | null;
  } | null | undefined,
  permission: SpecialPermissionKey,
): boolean {
  if (!user) return false;
  if (isDirectorAccount(user)) return true;
  const perms =
    user.specialPermissions ?? resolveDefaultAccessForRole(user.role ?? '').specialPermissions;
  return Boolean(perms[permission]);
}

export function getAuthorizedScreens(user: {
  role?: Role | string | null;
  isPrimaryAdmin?: boolean | null;
  screenAccess?: ScreenAccessMap | null;
} | null | undefined): ScreenDefinition[] {
  if (!user) return [];
  if (isDirectorAccount(user)) return [...SCREEN_DEFINITIONS];
  return SCREEN_DEFINITIONS.filter((def) => hasScreenAccess(user, def.key, 'LECTURE'));
}

export function getFirstAuthorizedRoute(user: {
  role?: Role | string | null;
  isPrimaryAdmin?: boolean | null;
  screenAccess?: ScreenAccessMap | null;
  mustChangePassword?: boolean | null;
} | null | undefined): string {
  if (!user) return '/connexion';
  if (user.mustChangePassword) return '/changer-mot-de-passe';
  const screens = getAuthorizedScreens(user);
  return screens[0]?.route ?? '/connexion';
}
