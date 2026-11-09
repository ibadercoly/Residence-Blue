import { Injectable, computed, inject, signal } from '@angular/core';
import { AppModulesManifest, ModuleId, Role } from '@residence-blue/shared';
import { AuthMockService } from './auth-mock.service';

export interface NavMenuItem {
  id: ModuleId;
  label: string;
  route: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModuleConfigService {
  private readonly authService = inject(AuthMockService);

  // Configuration par défaut issue de config/modules.json (garantit le fonctionnement hors-ligne immédiat)
  private readonly _manifest = signal<AppModulesManifest>({
    version: '1.0.0-minimal',
    hotel: {
      name: 'Résidence Blue',
      location: 'Grand Standing, Thiès, Sénégal',
      roomCount: 12
    },
    modules: {
      dashboard: {
        id: 'dashboard',
        name: 'Accueil',
        route: '/tableau-de-bord',
        icon: 'dashboard',
        enabled: true,
        version: 'v1',
        config: {
          showWeatherWidget: false,
          showPriorityAlerts: false,
          showRevenueChart: false,
          showAdvancedKpis: false,
          kpiCount: 4,
          actionButtonsCount: 5
        }
      },
      planning: {
        id: 'planning',
        name: 'Planning',
        route: '/planning',
        icon: 'calendar_month',
        enabled: true,
        version: 'v1',
        config: { windowDays: 14 }
      },
      rooms: {
        id: 'rooms',
        name: 'Chambres',
        route: '/chambres',
        icon: 'bed',
        enabled: true,
        version: 'v1',
        config: { roomCount: 12 }
      },
      clients: {
        id: 'clients',
        name: 'Clients',
        route: '/clients',
        icon: 'group',
        enabled: true,
        version: 'v1',
        config: { pageSize: 25 }
      },
      facturation: {
        id: 'facturation',
        name: 'Facturation',
        route: '/facturation',
        icon: 'receipt_long',
        enabled: true,
        version: 'v1',
        config: { currency: 'FCFA' }
      },
      restaurant: {
        id: 'restaurant',
        name: 'Restaurant & Bar',
        route: '/restaurant',
        icon: 'restaurant',
        enabled: true,
        version: 'v1',
        config: { enablePos: true, enableRoomService: true, enableKitchenScreen: true }
      },
      pool: {
        id: 'pool',
        name: 'Piscine',
        enabled: true,
        version: 'v1',
        config: { isBillableProduct: true, productCode: 'PASS-PISCINE', priceFcfa: 5000 }
      },
      exports: {
        id: 'exports',
        name: 'Exports',
        route: '/exports',
        icon: 'file_download',
        enabled: true,
        version: 'v1',
        config: { maxPeriodMonths: 12, maxRowsPerExport: 50000 }
      },
      housekeeping: {
        id: 'housekeeping',
        name: 'Gouvernance & Ménage',
        route: '/housekeeping',
        icon: 'cleaning_services',
        enabled: false,
        version: 'v2',
        status: 'deferred'
      },
      maintenance: {
        id: 'maintenance',
        name: 'Maintenance',
        route: '/maintenance',
        icon: 'build',
        enabled: false,
        version: 'v2',
        status: 'deferred'
      },
      inventory: {
        id: 'inventory',
        name: 'Stocks & Économat',
        route: '/stocks',
        icon: 'inventory_2',
        enabled: false,
        version: 'v2',
        status: 'deferred'
      },
      marketing_crm: {
        id: 'marketing_crm',
        name: 'Fidélité & Marketing',
        route: '/marketing',
        icon: 'campaign',
        enabled: false,
        version: 'v3',
        status: 'deferred'
      },
      channel_manager: {
        id: 'channel_manager',
        name: 'Passerelle OTAs',
        route: '/channel-manager',
        icon: 'sync_alt',
        enabled: false,
        version: 'v3',
        status: 'deferred'
      }
    },
    roles: {
      DIRECTION: {
        allowedModules: ['dashboard', 'planning', 'rooms', 'clients', 'facturation', 'restaurant', 'pool', 'exports'],
        canExportClients: true,
        canManageMenu: true
      },
      RECEPTION: {
        allowedModules: ['dashboard', 'planning', 'rooms', 'clients', 'facturation', 'restaurant', 'pool', 'exports'],
        canExportClients: false,
        canManageMenu: false
      },
      SERVEUR: {
        allowedModules: ['restaurant'],
        canExportClients: false,
        canManageMenu: false
      },
      CUISINE: {
        allowedModules: ['restaurant'],
        kitchenScreenOnly: true,
        canExportClients: false,
        canManageMenu: false
      }
    }
  });

  readonly manifest = this._manifest.asReadonly();

  // Mode Démonstration (réinitialisation en un clic des données)
  readonly isDemoDataActive = signal<boolean>(true);
  readonly demoResetNotification = signal<string | null>(null);

  /**
   * Vérifie si un module est activé globalement dans la V1.
   */
  isModuleEnabled(moduleId: ModuleId): boolean {
    return this._manifest().modules[moduleId]?.enabled === true;
  }

  /**
   * Vérifie si l'utilisateur actuel a le droit d'accéder au module.
   */
  canAccessModule(moduleId: ModuleId, targetRole?: Role): boolean {
    if (!this.isModuleEnabled(moduleId)) return false;

    const role = targetRole || this.authService.currentUser()?.role;
    if (!role) return false;

    // Rôles SERVEUR et CUISINE : accès restreint uniquement au restaurant / cuisine
    if (role === Role.SERVEUR || role === Role.RESTAURANT) {
      return moduleId === 'restaurant';
    }
    if (role === Role.CUISINE) {
      return moduleId === 'restaurant';
    }

    // DIRECTION et RECEPTION
    const roleConfig = this._manifest().roles?.[role];
    if (!roleConfig) {
      // Par défaut DIRECTION a accès
      return role === Role.DIRECTION;
    }

    return roleConfig.allowedModules.includes(moduleId);
  }

  /**
   * Liste épurée des entrées de menu (7 entrées maximum, conforme à l'exigence de simplicité pour une directrice).
   */
  readonly menuItems = computed<NavMenuItem[]>(() => {
    const role = this.authService.currentUser()?.role || Role.DIRECTION;

    if (role === Role.CUISINE) {
      return [
        { id: 'restaurant', label: 'Écran Cuisine', route: '/cuisine', icon: 'soup_kitchen' }
      ];
    }

    if (role === Role.SERVEUR) {
      return [
        { id: 'restaurant', label: 'Caisse Restaurant', route: '/restaurant', icon: 'restaurant' }
      ];
    }

    // Pour DIRECTION et RECEPTION : exactement 7 entrées
    const items: NavMenuItem[] = [
      { id: 'dashboard', label: 'Accueil', route: '/tableau-de-bord', icon: 'dashboard' },
      { id: 'planning', label: 'Planning', route: '/planning', icon: 'calendar_month' },
      { id: 'rooms', label: 'Chambres', route: '/chambres', icon: 'bed' },
      { id: 'clients', label: 'Clients', route: '/clients', icon: 'group' },
      { id: 'facturation', label: 'Facturation', route: '/facturation', icon: 'receipt_long' },
      { id: 'restaurant', label: 'Restaurant & Bar', route: '/restaurant', icon: 'restaurant' },
      { id: 'exports', label: 'Exports', route: '/exports', icon: 'file_download' }
    ];

    return items.filter(item => this.canAccessModule(item.id, role));
  });

  /**
   * Réinitialise les données en mode démonstration en 1 clic.
   */
  resetDemoData(): void {
    // Effacer caches ou états locaux modifiés
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('residence_blue_ticket_storage');
      }
    } catch {
      // Ignorer
    }

    this.isDemoDataActive.set(true);
    this.demoResetNotification.set('Données de démonstration réinitialisées avec succès.');
    setTimeout(() => {
      this.demoResetNotification.set(null);
    }, 4000);
  }
}
