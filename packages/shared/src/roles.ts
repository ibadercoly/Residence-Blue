/**
 * Rôles utilisateurs du système Résidence Blue.
 * RÈGLE SÉCURITÉ : Accès refusé par défaut.
 */
export enum Role {
  DIRECTION = 'DIRECTION',
  RECEPTION = 'RECEPTION',
  RESTAURANT = 'RESTAURANT',
  HOUSEKEEPING = 'HOUSEKEEPING',
  MAINTENANCE = 'MAINTENANCE',
  COMPTABLE = 'COMPTABLE',
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
} as const;

export type UserRole = Role | (typeof UserRole)[keyof typeof UserRole];

export const ALL_ROLES = Object.values(Role);
