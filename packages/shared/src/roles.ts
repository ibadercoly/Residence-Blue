/**
 * Rôles utilisateurs du système Résidence Blue.
 * RÈGLE SÉCURITÉ : Accès refusé par défaut.
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  RECEPTIONIST = 'RECEPTIONIST',
  RESTAURANT_STAFF = 'RESTAURANT_STAFF',
  HOUSEKEEPING = 'HOUSEKEEPING',
}

export const ALL_ROLES = Object.values(UserRole);
