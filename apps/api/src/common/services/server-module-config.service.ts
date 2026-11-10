import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppModulesManifest } from '@residence-blue/shared';

@Injectable()
export class ServerModuleConfigService {
  private readonly logger = new Logger(ServerModuleConfigService.name);
  private manifest: AppModulesManifest;
  private overrides: Map<string, boolean> = new Map();

  constructor() {
    this.manifest = this.loadManifest();
  }

  private loadManifest(): AppModulesManifest {
    const candidatePaths = [
      path.resolve(process.cwd(), 'config/modules.json'),
      path.resolve(process.cwd(), '../../config/modules.json'),
      path.resolve(process.cwd(), '../config/modules.json'),
      path.resolve(process.cwd(), 'apps/api/config/modules.json'),
    ];

    for (const p of candidatePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8');
          const data = JSON.parse(raw);
          return data as AppModulesManifest;
        }
      } catch {
        // Continuer vers le chemin suivant
      }
    }

    this.logger.warn('Fichier config/modules.json introuvable, utilisation du manifeste par défaut');
    return {
      version: '1.1.0-default',
      modules: {
        dashboard: { id: 'dashboard', name: 'Accueil', enabled: true, version: 'v1' },
        planning: { id: 'planning', name: 'Planning', enabled: true, version: 'v1' },
        rooms: { id: 'rooms', name: 'Chambres', enabled: true, version: 'v1' },
        clients: { id: 'clients', name: 'Clients', enabled: true, version: 'v1' },
        facturation: { id: 'facturation', name: 'Facturation', enabled: true, version: 'v1' },
        restaurant: { id: 'restaurant', name: 'Restaurant', enabled: true, version: 'v1' },
        pool: { id: 'pool', name: 'Piscine', enabled: true, version: 'v1' },
        exports: { id: 'exports', name: 'Exports', enabled: true, version: 'v1' },
        housekeeping: { id: 'housekeeping', name: 'Housekeeping', enabled: false, version: 'v2', status: 'deferred' },
        maintenance: { id: 'maintenance', name: 'Maintenance', enabled: false, version: 'v2', status: 'deferred' },
        inventory: { id: 'inventory', name: 'Stocks', enabled: false, version: 'v2', status: 'deferred' },
        parametres: { id: 'parametres', name: 'Paramètres', enabled: false, version: 'v2', status: 'deferred' },
        marketing_crm: { id: 'marketing_crm', name: 'Marketing', enabled: false, version: 'v3', status: 'deferred' },
        channel_manager: { id: 'channel_manager', name: 'Channel Manager', enabled: false, version: 'v3', status: 'deferred' },
        accounting: { id: 'accounting', name: 'Comptabilité', enabled: false, version: 'v3', status: 'deferred' },
      },
      roles: {
        DIRECTION: { allowedModules: ['dashboard', 'planning', 'rooms', 'clients', 'facturation', 'restaurant', 'pool', 'exports'] },
        RECEPTION: { allowedModules: ['dashboard', 'planning', 'rooms', 'clients', 'facturation', 'restaurant', 'pool', 'exports'] },
        SERVEUR: { allowedModules: ['restaurant'] },
        CUISINE: { allowedModules: ['restaurant'] },
        HOUSEKEEPING: { allowedModules: ['housekeeping'], enabled: false },
        MAINTENANCE: { allowedModules: ['maintenance'], enabled: false },
        COMPTABLE: { allowedModules: ['accounting', 'facturation', 'exports'], enabled: false },
      },
    };
  }

  isModuleEnabled(moduleId: string): boolean {
    if (this.overrides.has(moduleId)) {
      return this.overrides.get(moduleId)!;
    }
    const mod = this.manifest.modules[moduleId];
    return mod ? mod.enabled === true : true;
  }

  isRoleEnabled(role: string): boolean {
    if (this.overrides.has(`role:${role}`)) {
      return this.overrides.get(`role:${role}`)!;
    }
    const roleConfig = this.manifest.roles?.[role];
    if (roleConfig && roleConfig.enabled === false) {
      if (role === 'HOUSEKEEPING') return this.isModuleEnabled('housekeeping');
      if (role === 'MAINTENANCE') return this.isModuleEnabled('maintenance');
      if (role === 'COMPTABLE') return this.isModuleEnabled('accounting');
      return false;
    }
    return true;
  }

  isRouteEnabled(urlPath: string): boolean {
    const cleanPath = urlPath.split('?')[0].toLowerCase();

    // Vérifier les correspondances avec les préfixes ou routes des modules
    for (const [id, mod] of Object.entries(this.manifest.modules)) {
      if (mod.apiPrefix && cleanPath.startsWith(mod.apiPrefix.toLowerCase())) {
        return this.isModuleEnabled(id);
      }
    }

    // Détections spécifiques par convention d'URL d'API
    const deferredPathMap: Record<string, string> = {
      '/api/housekeeping': 'housekeeping',
      '/api/maintenance': 'maintenance',
      '/api/inventory': 'inventory',
      '/api/stocks': 'inventory',
      '/api/settings': 'parametres',
      '/api/parametres': 'parametres',
      '/api/marketing': 'marketing_crm',
      '/api/channel-manager': 'channel_manager',
      '/api/accounting': 'accounting',
      '/api/comptabilite': 'accounting',
    };

    for (const [prefix, modId] of Object.entries(deferredPathMap)) {
      if (cleanPath.startsWith(prefix)) {
        return this.isModuleEnabled(modId);
      }
    }

    return true;
  }

  /**
   * Surcharge dynamique d'état d'un module pour les tests unitaires et d'intégration CI.
   */
  setModuleOverride(moduleId: string, enabled: boolean): void {
    this.overrides.set(moduleId, enabled);
  }

  setRoleOverride(role: string, enabled: boolean): void {
    this.overrides.set(`role:${role}`, enabled);
  }

  resetOverrides(): void {
    this.overrides.clear();
  }

  getManifest(): AppModulesManifest {
    return this.manifest;
  }
}
