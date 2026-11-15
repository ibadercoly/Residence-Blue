/**
 * Rôles utilisateurs du système Résidence Blue.
 * RÈGLE SÉCURITÉ : Accès refusé par défaut.
 */
export enum Role {
  DIRECTION = 'DIRECTION',
  RECEPTION = 'RECEPTION',
  RESTAURANT = 'RESTAURANT',
  SERVEUR = 'SERVEUR',
  CUISINE = 'CUISINE',
  CUISINIER = 'CUISINIER',
  HOUSEKEEPING = 'HOUSEKEEPING',
  MAINTENANCE = 'MAINTENANCE',
  COMPTABLE = 'COMPTABLE',
}

export function isKitchenOnlyRole(role?: string | null): boolean {
  return role === Role.CUISINIER || role === Role.CUISINE;
}

/**
 * Alias de compatibilité descendante pour les modules existants.
 */
export const UserRole = {
  ...Role,
  ADMIN: Role.DIRECTION,
  MANAGER: Role.DIRECTION,
  RECEPTIONIST: Role.RECEPTION,
  RESTAURANT_STAFF: Role.RESTAURANT,
  SERVEUR: Role.SERVEUR,
  CUISINE: Role.CUISINE,
  CUISINIER: Role.CUISINIER,
} as const;

export type UserRole = Role | (typeof UserRole)[keyof typeof UserRole];

export const ALL_ROLES = Object.values(Role);
