import { Role } from './roles';

export type ActiveModuleId =
  | 'dashboard'
  | 'planning'
  | 'rooms'
  | 'clients'
  | 'facturation'
  | 'restaurant'
  | 'pool'
  | 'exports';

export type DeferredModuleId =
  | 'housekeeping'
  | 'maintenance'
  | 'inventory'
  | 'parametres'
  | 'marketing_crm'
  | 'channel_manager'
  | 'accounting';

export type ModuleId = ActiveModuleId | DeferredModuleId;

export type DeferredFeatureId =
  | 'meteo'
  | 'actions_prioritaires'
  | 'graphique_hebdomadaire'
  | 'indicateurs_revpar_adr'
  | 'maintenance_complete'
  | 'housekeeping_detaille'
  | 'parametres_avances'
  | 'stocks'
  | 'notifications_auto'
  | 'scan_pieces_identite'
  | 'planning_drag_and_drop'
  | 'menu_gestion_avancee'
  | 'mobile_complete'
  | 'roles_avances';

export type FeatureId = ModuleId | DeferredFeatureId;

export interface ModuleConfig {
  id: string;
  name: string;
  route?: string;
  apiPrefix?: string;
  icon?: string;
  enabled: boolean;
  version: 'v1' | 'v2' | 'v3';
  status?: 'active' | 'deferred';
  dependencies?: string[];
  description?: string;
  config?: Record<string, any>;
}

export interface FeatureSwitch {
  id: string;
  name: string;
  version: 'v2' | 'v3';
  enabled: boolean;
  dependencies: string[];
  description: string;
}

export interface RoleModulePermission {
  allowedModules: string[];
  enabled?: boolean;
  version?: 'v1' | 'v2' | 'v3';
  description?: string;
  canExportClients?: boolean;
  canManageMenu?: boolean;
  kitchenScreenOnly?: boolean;
  [key: string]: any;
}

export interface AppModulesManifest {
  version: string;
  description?: string;
  hotel?: {
    name: string;
    location: string;
    roomCount: number;
  };
  modules: Record<string, ModuleConfig>;
  features?: Record<string, FeatureSwitch>;
  roles: Record<string, RoleModulePermission>;
}

/**
 * Rôles reportés en V2 / V3 non assignables tant que leur module n'est pas activé.
 */
export const DEFERRED_ROLES: Role[] = [
  Role.HOUSEKEEPING,
  Role.MAINTENANCE,
  Role.COMPTABLE,
];

/**
 * Vérifie si un rôle peut être légitimement attribué à un utilisateur selon les interrupteurs actifs.
 */
export function isRoleAssignable(role: Role | string, manifest?: AppModulesManifest): boolean {
  if (role === Role.HOUSEKEEPING || role === Role.MAINTENANCE || role === Role.COMPTABLE) {
    if (!manifest) return false;
    const roleConfig = manifest.roles?.[role];
    return roleConfig?.enabled === true;
  }
  return true;
}

/**
 * Vérifie si une route fait partie d'un module actif ou désactivé.
 */
export function isRouteModuleEnabled(route: string, manifest: AppModulesManifest): boolean {
  for (const mod of Object.values(manifest.modules)) {
    if (mod.route && (route === mod.route || route.startsWith(mod.route + '/'))) {
      return mod.enabled === true;
    }
  }
  return true;
}
