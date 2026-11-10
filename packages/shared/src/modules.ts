export type ModuleId =
  | 'dashboard'
  | 'planning'
  | 'rooms'
  | 'clients'
  | 'facturation'
  | 'restaurant'
  | 'pool'
  | 'exports'
  | 'housekeeping'
  | 'maintenance'
  | 'inventory'
  | 'marketing_crm'
  | 'channel_manager';

export interface ModuleConfig {
  id: ModuleId;
  name: string;
  route?: string;
  icon?: string;
  enabled: boolean;
  version: 'v1' | 'v2' | 'v3';
  status?: 'active' | 'deferred';
  config?: Record<string, any>;
}

export interface RoleModulePermission {
  allowedModules: ModuleId[];
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
  roles: Record<string, RoleModulePermission | any>;
}
