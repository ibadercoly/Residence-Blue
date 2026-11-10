import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DEFAULT_POOL_PRODUCT,
  EXPORT_DEFINITIONS,
  ExportAuditLogEntry,
  ExportDocumentType,
  Role
} from '@residence-blue/shared';
import { AuthMockService } from './auth-mock.service';
import { RoomsService } from './rooms.service';
import { FacturationMockService } from './facturation-mock.service';
import { GuestProfileService } from './guest-profile.service';

export interface ExportProgress {
  isGenerating: boolean;
  progressPercent: number;
  currentDocument?: string;
  error?: string;
  lastGeneratedFileUrl?: string;
  lastGeneratedFileName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ExportService {
  private readonly authService = inject(AuthMockService);
  private readonly roomsService = inject(RoomsService);
  private readonly facturationService = inject(FacturationMockService);
  private readonly guestService = inject(GuestProfileService);

  readonly definitions = EXPORT_DEFINITIONS;

  // Journal d'audit des exports
  private readonly _auditLogs = signal<ExportAuditLogEntry[]>([
    {
      id: 'audit-001',
      userId: 'usr-001-ba',
      userFullName: 'Aïssatou Ba',
      userRole: Role.DIRECTION,
      documentType: 'DAILY_SALES_CLOSURE_PDF',
      format: 'PDF',
      rowCount: 14,
      fileSizeBytes: 42560,
      fileName: 'cloture_caisse_2026-11-08.pdf',
      timestamp: '2026-11-08T22:30:00.000Z'
    },
    {
      id: 'audit-002',
      userId: 'usr-001-ba',
      userFullName: 'Aïssatou Ba',
      userRole: Role.DIRECTION,
      documentType: 'ROOMS_STATUS_PDF',
      format: 'PDF',
      rowCount: 12,
      fileSizeBytes: 28400,
      fileName: 'etat_chambres_2026-11-09.pdf',
      timestamp: '2026-11-09T08:00:00.000Z'
    }
  ]);

  readonly auditLogs = this._auditLogs.asReadonly();

  // État de génération
  readonly progress = signal<ExportProgress>({
    isGenerating: false,
    progressPercent: 0
  });

  /**
   * Retourne la liste des documents exportables autorisés pour le rôle courant.
   */
  readonly availableDocuments = computed(() => {
    const role = this.authService.currentUser()?.role || Role.DIRECTION;
    return Object.values(EXPORT_DEFINITIONS).filter(def => def.allowedRoles.includes(role));
  });

  /**
   * Neutralise les cellules de tableur sensibles à l'injection de formules (=, +, -, @).
   */
  sanitizeFormulaCell(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (/^[=+\-@]/.test(str)) {
      return "'" + str;
    }
    return str;
  }

  /**
   * Convertit un tableau d'objets en flux CSV / Excel UTF-8 avec neutralisation des formules.
   */
  generateCsvContent(headers: string[], rows: any[][]): string {
    const sanitizedRows = rows.map(r =>
      r.map(cell => {
        const sanitized = this.sanitizeFormulaCell(cell);
        return `"${sanitized.replace(/"/g, '""')}"`;
      }).join(';')
    );

    // BOM UTF-8 pour Excel
    return '\uFEFF' + [headers.map(h => `"${h}"`).join(';'), ...sanitizedRows].join('\r\n');
  }

  /**
   * Génère un document exportable selon son type et la période demandée.
   */
  async generateExport(
    documentType: ExportDocumentType,
    periodStart?: string,
    periodEnd?: string
  ): Promise<{ fileName: string; rowCount: number }> {
    const role = this.authService.currentUser()?.role || Role.DIRECTION;
    const def = EXPORT_DEFINITIONS[documentType];

    if (!def) {
      throw new Error('Type de document non reconnu.');
    }

    // 1. Contrôle RBAC strict
    if (!def.allowedRoles.includes(role)) {
      throw new Error(`Accès refusé : Le rôle ${role} n'est pas autorisé à générer cet export.`);
    }

    // 2. Contrôle de période (limite 12 mois)
    if (periodStart && periodEnd) {
      const dStart = new Date(periodStart);
      const dEnd = new Date(periodEnd);
      const monthsDiff = (dEnd.getFullYear() - dStart.getFullYear()) * 12 + (dEnd.getMonth() - dStart.getMonth());
      if (monthsDiff > 12) {
        throw new Error('La période demandée ne peut pas dépasser 12 mois consécutifs.');
      }
      if (dStart > dEnd) {
        throw new Error('La date de début doit être antérieure à la date de fin.');
      }
    }

    this.progress.set({
      isGenerating: true,
      progressPercent: 15,
      currentDocument: def.title
    });

    // Simulation de progression pour les gros flux
    await new Promise(r => setTimeout(r, 150));
    this.progress.update(p => ({ ...p, progressPercent: 45 }));

    const dateStr = new Date().toISOString().slice(0, 10);
    let fileName = '';
    let rowCount = 0;
    let blob: Blob;

    if (def.format === 'EXCEL') {
      const exportData = this.buildExcelData(documentType, periodStart, periodEnd);
      rowCount = exportData.rows.length;

      // Contrôle plafond 50 000 lignes
      if (rowCount > 50000) {
        throw new Error('Le volume de données dépasse la limite maximale de 50 000 lignes.');
      }

      const csv = this.generateCsvContent(exportData.headers, exportData.rows);
      blob = new Blob([csv], { type: 'application/vnd.ms-excel;charset=utf-8' });
      fileName = `${documentType.toLowerCase()}_${dateStr}.csv`;
    } else {
      // PDF natif A4
      const pdfHtml = this.buildPdfHtml(documentType, periodStart, periodEnd);
      rowCount = pdfHtml.rowCount;
      blob = new Blob([pdfHtml.content], { type: 'text/html;charset=utf-8' });
      fileName = `${documentType.toLowerCase()}_${dateStr}.html`;
    }

    this.progress.update(p => ({ ...p, progressPercent: 85 }));

    // Déclenchement du téléchargement local
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Enregistrement au Journal d'Audit
    const auditEntry: ExportAuditLogEntry = {
      id: `audit-${Date.now()}`,
      userId: this.authService.currentUser()?.id || 'usr-anonymous',
      userFullName: this.authService.currentUser()?.fullName || 'Utilisateur',
      userRole: role,
      documentType,
      format: def.format,
      periodStart,
      periodEnd,
      rowCount,
      fileSizeBytes: blob.size,
      fileName,
      timestamp: new Date().toISOString()
    };

    this._auditLogs.update(logs => [auditEntry, ...logs]);

    this.progress.set({
      isGenerating: false,
      progressPercent: 100,
      lastGeneratedFileUrl: url,
      lastGeneratedFileName: fileName
    });

    return { fileName, rowCount };
  }

  private buildExcelData(type: ExportDocumentType, _start?: string, _end?: string): { headers: string[]; rows: any[][] } {
    switch (type) {
      case 'CLIENTS_LIST_EXCEL': {
        const headers = ['ID Client', 'Nom complet', 'Email', 'Téléphone', 'Nationalité', 'Total séjours', 'Chiffre d’affaires FCFA'];
        const rows = [
          ['C-101', 'Mamadou Diop', 'mamadou.diop@orange.sn', '+221 77 638 92 10', 'Sénégalaise', 4, 960000],
          ['C-102', 'Awa Sene', 'awa.sene@ecobank.sn', '+221 78 450 12 34', 'Sénégalaise', 2, 420000],
          ['C-103', 'Jean-Paul Mercier', 'jp.mercier@airfrance.fr', '+33 6 12 34 56 78', 'Française', 6, 1850000],
          ['C-104', 'Fatou Kiné Ndiaye', 'kine.ndiaye@tigo.sn', '+221 70 890 23 45', 'Sénégalaise', 3, 610000],
          ['C-105', 'Ibrahim Traoré', 'ibrahim.traore@bceao.int', '+221 76 543 21 00', 'Malienne', 1, 180000]
        ];
        return { headers, rows };
      }

      case 'DAILY_SALES_CLOSURE_EXCEL': {
        const headers = ['Référence Folio', 'Client / Chambre', 'Montant TTC FCFA', 'TVA 10% FCFA', 'Mode de paiement', 'Heure clôture'];
        const rows = [
          ['#FOL-2024-0542', 'M. Mamadou Diop (Suite 301)', 128000, 11636, 'Carte Bancaire (TPE)', '18:30'],
          ['#FOL-2024-0543', 'Table 4 (Restaurant)', 18500, 1682, 'Wave', '14:20'],
          ['#FOL-2024-0544', 'Table 2 (Restaurant)', 12000, 1091, 'Espèces', '15:10'],
          ['#FOL-2024-0545', 'Pass Piscine (Visiteur ext.)', 10000, 909, 'Orange Money', '11:45']
        ];
        return { headers, rows };
      }

      case 'RESTAURANT_POOL_SALES_EXCEL': {
        const headers = ['Date', 'Point de vente', 'Article / Prestation', 'Quantité', 'Prix unitaire FCFA', 'Total TTC FCFA', 'Mode encaissement'];
        const rows = [
          ['2026-11-09', 'Restaurant La Teranga', 'Thiéboudienne Royale', 14, 5000, 70000, 'Mixte'],
          ['2026-11-09', 'Restaurant La Teranga', 'Yassa Poulet Fermier', 10, 4000, 40000, 'Mixte'],
          ['2026-11-09', 'Bar La Teranga', 'Jus de Bissap Maison', 22, 1500, 33000, 'Mixte'],
          ['2026-11-09', 'Piscine Résidence Blue', DEFAULT_POOL_PRODUCT.name, 6, DEFAULT_POOL_PRODUCT.priceFcfa, 30000, 'Mobile Money']
        ];
        return { headers, rows };
      }

      default:
        return { headers: ['Colonne 1'], rows: [['Donnée 1']] };
    }
  }

  private buildPdfHtml(type: ExportDocumentType, _start?: string, _end?: string): { content: string; rowCount: number } {
    const today = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let title = 'Document Officiel';
    let body = '';
    let rowCount = 0;

    const allRooms = this.roomsService ? this.roomsService.rooms() : [];
    const totalRoomsCount = allRooms.length > 0 ? allRooms.length : 12;

    if (type === 'ROOMS_STATUS_PDF') {
      const rooms = allRooms;
      title = `État des ${rooms.length} Chambres • Résidence Blue`;
      rowCount = rooms.length;
      body = `
        <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9; text-align:left; border-bottom:2px solid #cbd5e1;">
              <th style="padding:8px;">Chambre</th>
              <th style="padding:8px;">Type</th>
              <th style="padding:8px;">Statut</th>
              <th style="padding:8px;">Occupant</th>
              <th style="padding:8px; text-align:right;">Tarif nuit</th>
            </tr>
          </thead>
          <tbody>
            ${rooms.map(r => `
              <tr style="border-bottom:1px solid #e2e8f0;">
                <td style="padding:8px; font-weight:bold;">Chambre ${r.number}</td>
                <td style="padding:8px;">${r.type?.name || 'Standard'}</td>
                <td style="padding:8px;">${r.status}</td>
                <td style="padding:8px;">${r.status === 'OCCUPIED' ? 'Client en séjour' : 'Libre'}</td>
                <td style="padding:8px; text-align:right; font-family:monospace;">${r.type?.pricePerNight ? r.type.pricePerNight.toLocaleString('fr-FR') : '45 000'} FCFA</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (type === 'DAILY_ARRIVALS_DEPARTURES_PDF') {
      title = 'Feuille des Mouvements du Jour (Arrivées & Départs)';
      rowCount = 5;
      body = `
        <h3 style="font-size:14px; margin-top:16px;">Arrivées prévues (Check-in)</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px; margin-bottom:16px;">
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;"><th style="padding:6px;">Chambre</th><th style="padding:6px;">Client</th><th style="padding:6px;">Heure estimée</th><th style="padding:6px;">Solde</th></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px; font-weight:bold;">102</td><td>Awa Sene</td><td>14:30</td><td>45 000 FCFA</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px; font-weight:bold;">204</td><td>Cheikh Anta Diop</td><td>16:00</td><td>85 000 FCFA</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px; font-weight:bold;">301</td><td>Mamadou Diop</td><td>17:15</td><td>128 000 FCFA</td></tr>
        </table>
        <h3 style="font-size:14px; margin-top:16px;">Départs prévus (Check-out)</h3>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;"><th style="padding:6px;">Chambre</th><th style="padding:6px;">Client</th><th style="padding:6px;">Clôture</th><th style="padding:6px;">Statut</th></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px; font-weight:bold;">101</td><td>Jean-Paul Mercier</td><td>11:00</td><td>Soldé (CB)</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:6px; font-weight:bold;">202</td><td>Ibrahim Traoré</td><td>11:30</td><td>Soldé (Wave)</td></tr>
        </table>
      `;
    } else {
      title = 'Rapport de Clôture Journalière';
      rowCount = 4;
      body = `
        <table style="width:100%; border-collapse:collapse; margin-top:16px; font-size:12px;">
          <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;"><th style="padding:8px;">Mode de paiement</th><th style="padding:8px; text-align:right;">Total encaissé FCFA</th></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">Espèces (Caisse Réception & Resto)</td><td style="padding:8px; text-align:right; font-family:monospace;">85 000 FCFA</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">Wave Mobile Money</td><td style="padding:8px; text-align:right; font-family:monospace;">142 500 FCFA</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">Orange Money</td><td style="padding:8px; text-align:right; font-family:monospace subterranean;">35 000 FCFA</td></tr>
          <tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:8px;">Cartes Bancaires (TPE)</td><td style="padding:8px; text-align:right; font-family:monospace;">128 000 FCFA</td></tr>
          <tr style="background:#f8fafc; font-weight:bold;"><td style="padding:10px;">TOTAL RECETTES DU JOUR</td><td style="padding:10px; text-align:right; font-family:monospace; color:#135bec; font-size:14px;">390 500 FCFA</td></tr>
        </table>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; padding: 24px; line-height: 1.4; }
          .header { border-bottom: 2px solid #135bec; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          .title { font-size: 20px; font-weight: bold; color: #0f172a; margin: 0; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
          .footer { margin-top: 32px; border-top: 1px solid #cbd5e1; padding-top: 10px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">RÉSIDENCE BLUE • HÔTEL BOUTIQUE</h1>
            <div class="subtitle">${totalRoomsCount} Clés &bull; Quartier Grand Standing, Thiès, Sénégal &bull; NINEA: 009847291 &bull; RCCM: SN.THS.2023.A.1245</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:bold; font-size:12px;">${today}</div>
            <div class="subtitle">Document officiel d'exploitation</div>
          </div>
        </div>

        <h2 style="font-size:16px; margin: 16px 0 8px 0; color:#135bec;">${title}</h2>
        ${body}

        <div class="footer">
          <div>Résidence Blue — Imprimé par ${this.authService.currentUser()?.fullName || 'Direction'} (${this.authService.currentUser()?.role || 'DIRECTION'})</div>
          <div>Page 1 / 1 &bull; Document d'audit certifié</div>
        </div>
      </body>
      </html>
    `;

    return { content: html, rowCount };
  }
}
