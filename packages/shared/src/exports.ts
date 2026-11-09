import { Role } from './roles';

/**
 * Types de documents exportables dans la Version 1 Minimale.
 */
export type ExportDocumentType =
  | 'STAY_INVOICE_PDF'                 // Facture du séjour (PDF)
  | 'DAILY_ARRIVALS_DEPARTURES_PDF'    // Arrivées et départs du jour (PDF)
  | 'ROOMS_STATUS_PDF'                 // État des chambres (PDF)
  | 'DAILY_SALES_CLOSURE_PDF'          // Ventes de la journée avec clôture de caisse (PDF)
  | 'DAILY_SALES_CLOSURE_EXCEL'        // Ventes de la journée avec clôture de caisse (Excel)
  | 'CLIENTS_LIST_EXCEL'               // Liste des clients (Excel - DIRECTION seulement)
  | 'RESTAURANT_POOL_SALES_EXCEL';     // Ventes du restaurant et de la piscine sur une période (Excel)

export type ExportFormat = 'PDF' | 'EXCEL';

export interface ExportDocumentDefinition {
  type: ExportDocumentType;
  title: string;
  description: string;
  format: ExportFormat;
  icon: string;
  allowedRoles: Role[];
  requiresDateRange: boolean;
  maxPeriodMonths: number;
}

export const EXPORT_DEFINITIONS: Record<ExportDocumentType, ExportDocumentDefinition> = {
  STAY_INVOICE_PDF: {
    type: 'STAY_INVOICE_PDF',
    title: 'Facture du séjour',
    description: 'Facture officielle nominative avec ventilation HT, TVA 10% et détail des prestations.',
    format: 'PDF',
    icon: 'receipt',
    allowedRoles: [Role.DIRECTION, Role.RECEPTION],
    requiresDateRange: false,
    maxPeriodMonths: 12
  },
  DAILY_ARRIVALS_DEPARTURES_PDF: {
    type: 'DAILY_ARRIVALS_DEPARTURES_PDF',
    title: 'Arrivées et départs du jour',
    description: 'Feuille de service de la réception pour les check-in et check-out du jour.',
    format: 'PDF',
    icon: 'checklist',
    allowedRoles: [Role.DIRECTION, Role.RECEPTION],
    requiresDateRange: false,
    maxPeriodMonths: 1
  },
  ROOMS_STATUS_PDF: {
    type: 'ROOMS_STATUS_PDF',
    title: 'État des chambres',
    description: 'Rapport synthétique des 12 chambres (occupée, libre, en recouche, maintenance).',
    format: 'PDF',
    icon: 'bed',
    allowedRoles: [Role.DIRECTION, Role.RECEPTION],
    requiresDateRange: false,
    maxPeriodMonths: 1
  },
  DAILY_SALES_CLOSURE_PDF: {
    type: 'DAILY_SALES_CLOSURE_PDF',
    title: 'Clôture de caisse journalière (Z de caisse)',
    description: 'Bilan comptable PDF des encaissements de la journée par mode de paiement.',
    format: 'PDF',
    icon: 'point_of_sale',
    allowedRoles: [Role.DIRECTION, Role.RECEPTION],
    requiresDateRange: false,
    maxPeriodMonths: 1
  },
  DAILY_SALES_CLOSURE_EXCEL: {
    type: 'DAILY_SALES_CLOSURE_EXCEL',
    title: 'Clôture de caisse journalière (Tableur)',
    description: 'Fichier tableur avec ventilation des règlements, sous-totaux et TVA pour la comptabilité.',
    format: 'EXCEL',
    icon: 'table_view',
    allowedRoles: [Role.DIRECTION, Role.RECEPTION],
    requiresDateRange: false,
    maxPeriodMonths: 1
  },
  CLIENTS_LIST_EXCEL: {
    type: 'CLIENTS_LIST_EXCEL',
    title: 'Fichier clients complet',
    description: 'Extraction Excel du répertoire clients (sécurisé, réservé à la Direction).',
    format: 'EXCEL',
    icon: 'group',
    allowedRoles: [Role.DIRECTION], // Strictement DIRECTION
    requiresDateRange: false,
    maxPeriodMonths: 12
  },
  RESTAURANT_POOL_SALES_EXCEL: {
    type: 'RESTAURANT_POOL_SALES_EXCEL',
    title: 'Ventes Restaurant & Piscine',
    description: 'Journal des ventes détaillé de La Teranga et des accès piscine sur une période choisie.',
    format: 'EXCEL',
    icon: 'pool',
    allowedRoles: [Role.DIRECTION, Role.RECEPTION],
    requiresDateRange: true,
    maxPeriodMonths: 12
  }
};

/**
 * Entrée du journal d'audit des exports.
 */
export interface ExportAuditLogEntry {
  id: string;
  userId: string;
  userFullName: string;
  userRole: Role;
  documentType: ExportDocumentType;
  format: ExportFormat;
  periodStart?: string;
  periodEnd?: string;
  rowCount: number;
  fileSizeBytes: number;
  fileName: string;
  timestamp: string;
  ipAddress?: string;
}

/**
 * Produit Piscine facturable V1.
 */
export interface PoolProductItem {
  id: string;
  code: string;
  name: string;
  priceFcfa: number;
  vatRatePercent: number;
  unit: string;
}

export const DEFAULT_POOL_PRODUCT: PoolProductItem = {
  id: 'prod-pool-01',
  code: 'PASS-PISCINE',
  name: 'Accès Piscine Journée',
  priceFcfa: 5000,
  vatRatePercent: 10,
  unit: 'Pass / Personne'
};
