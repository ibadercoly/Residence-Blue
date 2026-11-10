import { Injectable, computed, inject, signal } from '@angular/core';
import { AppModulesManifest, Role, isRoleAssignable } from '@residence-blue/shared';
import { AuthMockService } from './auth-mock.service';

export interface NavMenuItem {
  id: string;
  label: string;
  route: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class ModuleConfigService {
  private readonly authService = inject(AuthMockService);

  // Configuration déclarative issue de config/modules.json (garantit le fonctionnement hors-ligne immédiat)
  private readonly _manifest = signal<AppModulesManifest>({
    version: '1.1.0-modular',
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
        dependencies: [],
        description: "Vue d'accueil synthétique pour la directrice : 4 chiffres clés et 5 boutons d'action rapide.",
        config: {
          kpiCount: 4,
          actionButtonsCount: 5,
          enableDemoReset: true
        }
      },
      planning: {
        id: 'planning',
        name: 'Planning',
        route: '/planning',
        icon: 'calendar_month',
        enabled: true,
        version: 'v1',
        dependencies: ['rooms'],
        description: 'Calendrier des réservations sur fenêtre de 14 jours avec recherche par date.',
        config: { windowDays: 14, enableServerSearch: true }
      },
      rooms: {
        id: 'rooms',
        name: 'Chambres',
        route: '/chambres',
        icon: 'bed',
        enabled: true,
        version: 'v1',
        dependencies: [],
        description: "Grille d'état des 12 chambres de l'hôtel avec gestion des statuts libre/occupée/ménage.",
        config: { roomCount: 12, lazyImages: true }
      },
      clients: {
        id: 'clients',
        name: 'Clients',
        route: '/clients',
        icon: 'group',
        enabled: true,
        version: 'v1',
        dependencies: [],
        description: 'Gestion des profils clients, fiches de police et historique des séjours.',
        config: { pageSize: 25, maskSensitiveData: true }
      },
      facturation: {
        id: 'facturation',
        name: 'Facturation',
        route: '/facturation',
        icon: 'receipt_long',
        enabled: true,
        version: 'v1',
        dependencies: ['clients'],
        description: 'Folios en cours, encaissements multi-moyens et clôture Z de caisse.',
        config: { currency: 'FCFA', integerAmountsOnly: true }
      },
      restaurant: {
        id: 'restaurant',
        name: 'Restaurant & Bar',
        route: '/restaurant',
        icon: 'restaurant',
        enabled: true,
        version: 'v1',
        dependencies: [],
        description: 'Caisse enregistreuse tactile, commande en chambre et écran cuisine temps réel.',
        config: { enablePos: true, enableRoomService: true, enableKitchenScreen: true, kitchenRoute: '/cuisine' }
      },
      pool: {
        id: 'pool',
        name: 'Piscine',
        enabled: true,
        version: 'v1',
        dependencies: ['facturation'],
        description: 'Prestation journée piscine facturable au restaurant ou au folio de chambre.',
        config: { isBillableProduct: true, productCode: 'PASS-PISCINE', priceFcfa: 5000 }
      },
      exports: {
        id: 'exports',
        name: 'Exports',
        route: '/exports',
        icon: 'file_download',
        enabled: true,
        version: 'v1',
        dependencies: [],
        description: 'Génération certifiée en streaming de documents légaux et comptables PDF et Excel.',
        config: { maxPeriodMonths: 12, maxRowsPerExport: 50000 }
      },
      housekeeping: {
        id: 'housekeeping',
        name: 'Housekeeping détaillé',
        route: '/housekeeping',
        icon: 'cleaning_services',
        enabled: false,
        version: 'v2',
        status: 'deferred',
        dependencies: ['rooms'],
        description: "Gestion détaillée des plannings d'étage, contrôle des chambres blanches et rotation du linge."
      },
      maintenance: {
        id: 'maintenance',
        name: 'Maintenance complète',
        route: '/maintenance',
        icon: 'build',
        enabled: false,
        version: 'v2',
        status: 'deferred',
        dependencies: ['rooms'],
        description: "Carnet d'entretien technique des chambres et équipements (climatisation, plomberie, piscine)."
      },
      inventory: {
        id: 'inventory',
        name: 'Stocks & Économat',
        route: '/stocks',
        icon: 'inventory_2',
        enabled: false,
        version: 'v2',
        status: 'deferred',
        dependencies: ['restaurant'],
        description: "Gestion des stocks d'ingrédients, boissons du bar et économat avec alertes de réapprovisionnement."
      },
      parametres: {
        id: 'parametres',
        name: 'Paramètres avancés',
        route: '/parametres',
        icon: 'settings',
        enabled: false,
        version: 'v2',
        status: 'deferred',
        dependencies: [],
        description: 'Configuration avancée des taxes de séjour, passerelles de paiement et personnalisation hôtelière.'
      },
      marketing_crm: {
        id: 'marketing_crm',
        name: 'Fidélité & Marketing',
        route: '/marketing',
        icon: 'campaign',
        enabled: false,
        version: 'v3',
        status: 'deferred',
        dependencies: ['clients'],
        description: 'Programme de fidélisation clients, campagnes promotionnelles et segmentation.'
      },
      channel_manager: {
        id: 'channel_manager',
        name: 'Passerelle OTAs (Booking/Airbnb)',
        route: '/channel-manager',
        icon: 'sync_alt',
        enabled: false,
        version: 'v3',
        status: 'deferred',
        dependencies: ['planning', 'rooms'],
        description: 'Synchronisation automatique des disponibilités et tarifs avec Booking.com, Airbnb et Expedia.'
      },
      accounting: {
        id: 'accounting',
        name: 'Comptabilité SYSCOHADA',
        route: '/comptabilite',
        icon: 'account_balance',
        enabled: false,
        version: 'v3',
        status: 'deferred',
        dependencies: ['facturation'],
        description: 'Grand livre, écritures comptables conformes au référentiel SYSCOHADA et bilan.'
      }
    },
    features: {
      meteo: {
        id: 'meteo',
        name: 'Météo en direct',
        version: 'v2',
        enabled: false,
        dependencies: ['dashboard'],
        description: 'Widget météo en direct pour la ville de Thiès affiché sur le tableau de bord.'
      },
      actions_prioritaires: {
        id: 'actions_prioritaires',
        name: 'Actions prioritaires',
        version: 'v2',
        enabled: false,
        dependencies: ['dashboard'],
        description: 'Bloc des alertes opérationnelles et urgences du jour sur l’accueil.'
      },
      graphique_hebdomadaire: {
        id: 'graphique_hebdomadaire',
        name: 'Graphique hebdomadaire',
        version: 'v2',
        enabled: false,
        dependencies: ['dashboard', 'facturation'],
        description: 'Graphique d’évolution des recettes prévisionnelles et réelles sur 7 jours.'
      },
      indicateurs_revpar_adr: {
        id: 'indicateurs_revpar_adr',
        name: 'Indicateurs RevPAR et ADR',
        version: 'v2',
        enabled: false,
        dependencies: ['dashboard', 'rooms', 'facturation'],
        description: 'Calcul et affichage des indicateurs avancés de rentabilité hôtelière RevPAR et ADR.'
      },
      maintenance_complete: {
        id: 'maintenance_complete',
        name: 'Maintenance complète',
        version: 'v2',
        enabled: false,
        dependencies: ['rooms'],
        description: 'Système complet de suivi des pannes, ordres de travail et carnet d’entretien.'
      },
      housekeeping_detaille: {
        id: 'housekeeping_detaille',
        name: 'Housekeeping détaillé',
        version: 'v2',
        enabled: false,
        dependencies: ['rooms'],
        description: 'Fiches de chambre blanche, rotation du linge et affectation nominative des femmes de chambre.'
      },
      parametres_avances: {
        id: 'parametres_avances',
        name: 'Paramètres avancés',
        version: 'v2',
        enabled: false,
        dependencies: [],
        description: 'Écrans d’administration technique et personnalisation poussée de l’établissement.'
      },
      stocks: {
        id: 'stocks',
        name: 'Gestion des stocks',
        version: 'v2',
        enabled: false,
        dependencies: ['restaurant'],
        description: 'Suivi des fiches techniques de cuisine, inventaires et sorties d’économat.'
      },
      notifications_auto: {
        id: 'notifications_auto',
        name: 'WhatsApp et SMS automatiques',
        version: 'v2',
        enabled: false,
        dependencies: ['clients', 'facturation'],
        description: 'Envoi automatisé des confirmations de séjour et factures par WhatsApp et SMS.'
      },
      scan_pieces_identite: {
        id: 'scan_pieces_identite',
        name: 'Scan des pièces d’identité',
        version: 'v2',
        enabled: false,
        dependencies: ['clients'],
        description: 'Capture et reconnaissance automatique par caméra des passeports et CNI des clients.'
      },
      planning_drag_and_drop: {
        id: 'planning_drag_and_drop',
        name: 'Glisser-déposer du planning',
        version: 'v2',
        enabled: false,
        dependencies: ['planning'],
        description: 'Déplacement interactif et réattribution rapide des chambres par drag-and-drop.'
      },
      menu_gestion_avancee: {
        id: 'menu_gestion_avancee',
        name: 'Gestion avancée du menu',
        version: 'v2',
        enabled: false,
        dependencies: ['restaurant'],
        description: 'Recadrage photo haute définition, allergènes multiples, suppléments et import/export CSV.'
      },
      mobile_complete: {
        id: 'mobile_complete',
        name: 'Version mobile complète',
        version: 'v2',
        enabled: false,
        dependencies: ['dashboard'],
        description: 'Interface mobile native dédiée avec barre de navigation inférieure et gestes tactiles.'
      },
      roles_avances: {
        id: 'roles_avances',
        name: 'Rôles avancés (Housekeeping, Maintenance, Comptable)',
        version: 'v2',
        enabled: false,
        dependencies: ['housekeeping', 'maintenance', 'accounting'],
        description: 'Activation et attribution des rôles spécialisés HOUSEKEEPING, MAINTENANCE et COMPTABLE.'
      }
    },
    roles: {
      DIRECTION: {
        allowedModules: ['dashboard', 'planning', 'rooms', 'clients', 'facturation', 'restaurant', 'pool', 'exports'],
        enabled: true,
        version: 'v1',
        description: 'Direction générale de l’établissement : accès complet à tous les modules actifs.',
        canExportClients: true,
        canManageMenu: true
      },
      RECEPTION: {
        allowedModules: ['dashboard', 'planning', 'rooms', 'clients', 'facturation', 'restaurant', 'pool', 'exports'],
        enabled: true,
        version: 'v1',
        description: 'Accueil et réception : réservations, check-in, check-out, folios et exports de service.',
        canExportClients: false,
        canManageMenu: false
      },
      SERVEUR: {
        allowedModules: ['restaurant'],
        enabled: true,
        version: 'v1',
        description: 'Service en salle et room service : prise de commande et encaissements restaurant.',
        canExportClients: false,
        canManageMenu: false
      },
      CUISINE: {
        allowedModules: ['restaurant'],
        enabled: true,
        version: 'v1',
        kitchenScreenOnly: true,
        description: 'Chefs de cuisine et pâtissiers : consultation de l’écran des bons de commande en temps réel.',
        canExportClients: false,
        canManageMenu: false
      },
      HOUSEKEEPING: {
        allowedModules: ['housekeeping'],
        enabled: false,
        version: 'v2',
        description: 'Gouvernance d’étage et ménage : reporté en Version 2. Non assignable en V1.',
        canExportClients: false,
        canManageMenu: false
      },
      MAINTENANCE: {
        allowedModules: ['maintenance'],
        enabled: false,
        version: 'v2',
        description: 'Techniciens de maintenance des équipements : reporté en Version 2. Non assignable en V1.',
        canExportClients: false,
        canManageMenu: false
      },
      COMPTABLE: {
        allowedModules: ['accounting', 'facturation', 'exports'],
        enabled: false,
        version: 'v3',
        description: 'Comptabilité analytique et fiscale : reporté en Version 3. Non assignable en V1.',
        canExportClients: true,
        canManageMenu: false
      }
    }
  });

  readonly manifest = this._manifest.asReadonly();

  // Mode Démonstration (réinitialisation en un clic des données)
  readonly isDemoDataActive = signal<boolean>(true);
  readonly demoResetNotification = signal<string | null>(null);

  // Surcharges dynamiques pour les tests unitaires et la CI
  private readonly moduleOverrides = signal<Record<string, boolean>>({});
  private readonly featureOverrides = signal<Record<string, boolean>>({});

  /**
   * Vérifie si un module est activé globalement dans l'application.
   */
  isModuleEnabled(moduleId: string): boolean {
    const override = this.moduleOverrides()[moduleId];
    if (typeof override === 'boolean') {
      return override;
    }
    return this._manifest().modules[moduleId]?.enabled === true;
  }

  /**
   * Vérifie si une fonctionnalité fine est activée.
   */
  isFeatureEnabled(featureId: string): boolean {
    const override = this.featureOverrides()[featureId];
    if (typeof override === 'boolean') {
      return override;
    }
    const feat = this._manifest().features?.[featureId];
    return feat ? feat.enabled === true : false;
  }

  /**
   * RÈGLE STRICTE POINT 1 : Vérifie si un rôle peut être assigné à un utilisateur.
   * Les rôles reportés (HOUSEKEEPING, MAINTENANCE, COMPTABLE) sont non assignables tant que leur module est à false.
   */
  canAssignRole(role: Role | string): boolean {
    return isRoleAssignable(role, this._manifest());
  }

  /**
   * Vérifie si l'utilisateur actuel a le droit d'accéder au module.
   */
  canAccessModule(moduleId: string, targetRole?: Role): boolean {
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

    // Pour DIRECTION et RECEPTION : exactement les modules actifs
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
   * Surcharge dynamique pour les suites de tests CI (Point 4).
   */
  setModuleOverride(moduleId: string, enabled: boolean): void {
    this.moduleOverrides.update(current => ({ ...current, [moduleId]: enabled }));
  }

  setFeatureOverride(featureId: string, enabled: boolean): void {
    this.featureOverrides.update(current => ({ ...current, [featureId]: enabled }));
  }

  resetOverrides(): void {
    this.moduleOverrides.set({});
    this.featureOverrides.set({});
  }

  /**
   * Réinitialise les données en mode démonstration en 1 clic.
   */
  resetDemoData(): void {
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
