import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';
import {
  ExportAuditLogEntry,
  ExportDocumentType,
  EXPORT_DEFINITIONS,
  Role,
} from '@residence-blue/shared';
import { ExportQueryDto } from './dto/export-query.dto';

export function sanitizeSpreadsheetCell(value: any): any {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (['=', '+', '-', '@'].includes(trimmed.charAt(0))) {
      return `'${trimmed}`;
    }
  }
  return value;
}

@Injectable()
export class ExportsService {
  private readonly auditLogs: ExportAuditLogEntry[] = [];

  getAuditLogs(): ExportAuditLogEntry[] {
    return [...this.auditLogs];
  }

  recordAudit(log: Omit<ExportAuditLogEntry, 'id' | 'timestamp'>): ExportAuditLogEntry {
    const entry: ExportAuditLogEntry = {
      ...log,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(entry);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return entry;
  }

  validateParams(query: ExportQueryDto, userRole: string): void {
    const def = EXPORT_DEFINITIONS[query.type];
    if (!def) {
      throw new BadRequestException(`Type de document inconnu: ${query.type}`);
    }

    // Contrôle d'habilitation spécifique par document
    if (!def.allowedRoles.includes(userRole as any)) {
      throw new ForbiddenException(
        `Rôle non autorisé pour cet export (${userRole}). Réservé à : ${def.allowedRoles.join(', ')}`
      );
    }

    // Contrôle de la plage de dates (max 12 mois)
    if (def.requiresDateRange) {
      if (!query.startDate || !query.endDate) {
        throw new BadRequestException(
          'Les dates de début et de fin sont obligatoires pour ce document.'
        );
      }

      const start = new Date(query.startDate);
      const end = new Date(query.endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new BadRequestException('Format de date invalide (AAAA-MM-JJ attendu).');
      }

      if (start.getTime() > end.getTime()) {
        throw new BadRequestException('La date de début ne peut pas être postérieure à la date de fin.');
      }

      const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays > 366) {
        throw new BadRequestException(
          'La période demandée dépasse la limite stricte de 12 mois (366 jours maximum).'
        );
      }
    }
  }

  async streamExport(
    query: ExportQueryDto,
    user: { id?: string; fullName?: string; role: Role },
    res: Response
  ): Promise<void> {
    this.validateParams(query, user.role);
    const def = EXPORT_DEFINITIONS[query.type];

    if (def.format === 'PDF') {
      await this.streamPdf(query.type, query, user, res);
    } else {
      await this.streamExcel(query.type, query, user, res);
    }
  }

  private async streamPdf(
    type: ExportDocumentType,
    query: ExportQueryDto,
    user: { id?: string; fullName?: string; role: Role },
    res: Response
  ): Promise<void> {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const filename = `${type.toLowerCase()}-${Date.now()}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // En-tête officiel Résidence Blue
    doc.fontSize(18).text('RÉSIDENCE BLUE - GRAND STANDING, THIÈS', { align: 'center' });
    doc.fontSize(10).fillColor('#64748b').text('Hôtel de charme 12 chambres • Restaurant & Bar', { align: 'center' });
    doc.moveDown(0.5);
    doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(1);

    let rowCount = 0;

    if (type === 'STAY_INVOICE_PDF') {
      rowCount = 4;
      doc.fillColor('#0f172a').fontSize(14).text('FACTURE DE SÉJOUR #INV-2024-0542');
      doc.fontSize(10).text(`Date : ${new Date().toLocaleDateString('fr-FR')}`);
      doc.text('Client : M. Mamadou Diop');
      doc.text('Chambre : 301 (Suite Prestige) - 3 Nuits');
      doc.moveDown(1);

      doc.fontSize(11).text('Détail des prestations :');
      doc.fontSize(10).text('- 3x Nuitée Suite Prestige : 285 000 FCFA');
      doc.text('- 1x Petit-déjeuner Thiès complet : 6 500 FCFA');
      doc.text('- 1x Dîner Restaurant : 18 500 FCFA');
      doc.text('- 1x Pass Accès Piscine : 5 000 FCFA');
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#135bec').text('Total TTC : 315 000 FCFA (TVA 18% incluse)', { align: 'right' });
      doc.fillColor('#16a34a').text('Statut : Soldé par Carte Bancaire', { align: 'right' });
    } else if (type === 'DAILY_ARRIVALS_DEPARTURES_PDF') {
      rowCount = 5;
      doc.fillColor('#0f172a').fontSize(14).text('MOUVEMENTS DU JOUR (ARRIVÉES & DÉPARTS)');
      doc.fontSize(10).text(`Date : ${new Date().toLocaleDateString('fr-FR')}`);
      doc.moveDown(1);

      doc.fontSize(11).text('Arrivées prévues :');
      doc.fontSize(10).text('• Ch. 102 - Awa Sene (Arrivée estimée : 14h30) - Solde : 45 000 FCFA');
      doc.text('• Ch. 204 - Cheikh Anta Diop (Arrivée estimée : 16h00) - Solde : 85 000 FCFA');
      doc.text('• Ch. 301 - Mamadou Diop (Arrivée estimée : 17h15) - Solde : 128 000 FCFA');
      doc.moveDown(1);

      doc.fontSize(11).text('Départs prévus :');
      doc.fontSize(10).text('• Ch. 101 - Jean-Paul Mercier (11h00) - Soldé (CB)');
      doc.text('• Ch. 202 - Ibrahim Traoré (11h30) - Soldé (Wave)');
    } else if (type === 'ROOMS_STATUS_PDF') {
      rowCount = 12;
      doc.fillColor('#0f172a').fontSize(14).text('ÉTAT D\'EXPLOITATION DES 12 CHAMBRES');
      doc.fontSize(10).text(`Généré le : ${new Date().toLocaleString('fr-FR')}`);
      doc.moveDown(1);

      const sampleRooms = [
        { num: '101', type: 'Standard', status: 'Libre', floor: 1 },
        { num: '102', type: 'Standard', status: 'Occupée', floor: 1 },
        { num: '103', type: 'Standard', status: 'Nettoyage en cours', floor: 1 },
        { num: '104', type: 'Standard', status: 'Libre', floor: 1 },
        { num: '105', type: 'Standard', status: 'Libre', floor: 1 },
        { num: '106', type: 'Standard', status: 'Maintenance', floor: 1 },
        { num: '201', type: 'Deluxe', status: 'Libre', floor: 2 },
        { num: '202', type: 'Deluxe', status: 'Occupée', floor: 2 },
        { num: '203', type: 'Bungalow Deluxe', status: 'Libre', floor: 2 },
        { num: '204', type: 'Bungalow Deluxe', status: 'Occupée', floor: 2 },
        { num: '301', type: 'Suite Prestige', status: 'Occupée', floor: 3 },
        { num: '302', type: 'Suite Prestige', status: 'Libre', floor: 3 },
      ];

      sampleRooms.forEach((r) => {
        doc.fontSize(10).text(`Chambre ${r.num} (${r.type}, Étage ${r.floor}) : ${r.status}`);
      });
    } else {
      rowCount = 4;
      doc.fillColor('#0f172a').fontSize(14).text('CLÔTURE DE CAISSE DU JOUR (Z DE CAISSE)');
      doc.fontSize(10).text(`Date : ${new Date().toLocaleDateString('fr-FR')}`);
      doc.moveDown(1);
      doc.fontSize(10).text('Recettes Hébergement : 370 000 FCFA');
      doc.text('Recettes Restaurant & Bar : 142 500 FCFA');
      doc.text('Recettes Accès Piscine : 15 000 FCFA (3 entrées)');
      doc.moveDown(0.5);
      doc.fontSize(12).fillColor('#135bec').text('Total Général : 527 500 FCFA', { align: 'right' });
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#94a3b8').text(`Document certifié Résidence Blue. Opérateur: ${user.fullName || user.role} • ${new Date().toISOString()}`, { align: 'center' });

    doc.end();

    this.recordAudit({
      documentType: type,
      format: 'PDF',
      userId: user.id || 'usr-default',
      userFullName: user.fullName || 'Opérateur',
      userRole: user.role,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      rowCount,
      fileSizeBytes: 15400,
      fileName: filename,
    });
  }

  private async streamExcel(
    type: ExportDocumentType,
    query: ExportQueryDto,
    user: { id?: string; fullName?: string; role: Role },
    res: Response
  ): Promise<void> {
    const filename = `${type.toLowerCase()}-${Date.now()}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Utilisation de WorkbookWriter pour un streaming mémoire minimal (flux continu)
    const ExcelJSClass: any = (ExcelJS as any).default || ExcelJS;
    const workbook = new ExcelJSClass.stream.xlsx.WorkbookWriter({
      stream: res,
      useStyles: true,
      useSharedStrings: true,
    });

    const worksheet = workbook.addWorksheet('Export');
    let rowCount = 0;

    if (type === 'CLIENTS_LIST_EXCEL') {
      worksheet.columns = [
        { header: 'ID Client', key: 'id', width: 12 },
        { header: 'Nom & Prénom', key: 'name', width: 25 },
        { header: 'Téléphone', key: 'phone', width: 18 },
        { header: 'Séjours', key: 'stays', width: 10 },
        { header: 'Total Dépensé (FCFA)', key: 'spent', width: 22 },
        { header: 'Dernier Séjour', key: 'lastStay', width: 16 },
      ];

      const sampleClients = [
        { id: 'CLI-001', name: 'Mamadou Diop', phone: '+221 77 123 45 67', stays: 5, spent: 1450000, lastStay: '2026-11-08' },
        { id: 'CLI-002', name: 'Awa Sene', phone: '+221 76 987 65 43', stays: 2, spent: 320000, lastStay: '2026-10-15' },
        { id: 'CLI-003', name: 'Jean-Paul Mercier', phone: '+33 6 12 34 56 78', stays: 8, spent: 2890000, lastStay: '2026-11-01' },
        { id: 'CLI-004', name: 'Cheikh Anta Diop', phone: '+221 70 555 44 33', stays: 3, spent: 510000, lastStay: '2026-09-20' },
        { id: 'CLI-005', name: 'Ibrahim Traoré', phone: '+226 70 00 11 22', stays: 1, spent: 110000, lastStay: '2026-11-05' },
      ];

      sampleClients.forEach((c) => {
        rowCount++;
        worksheet.addRow({
          id: sanitizeSpreadsheetCell(c.id),
          name: sanitizeSpreadsheetCell(c.name),
          phone: sanitizeSpreadsheetCell(c.phone),
          stays: c.stays,
          spent: c.spent,
          lastStay: sanitizeSpreadsheetCell(c.lastStay),
        }).commit();
      });
    } else if (type === 'RESTAURANT_POOL_SALES_EXCEL') {
      worksheet.columns = [
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Référence', key: 'ref', width: 16 },
        { header: 'Catégorie', key: 'cat', width: 16 },
        { header: 'Article / Prestation', key: 'item', width: 30 },
        { header: 'Qté', key: 'qty', width: 8 },
        { header: 'Prix Unitaire (FCFA)', key: 'price', width: 22 },
        { header: 'Total (FCFA)', key: 'total', width: 18 },
      ];

      const sampleSales = [
        { date: '2026-11-09', ref: 'CMD-1042', cat: 'Restaurant', item: 'Thieboudienne Penda Mbaye', qty: 2, price: 6500, total: 13000 },
        { date: '2026-11-09', ref: 'CMD-1043', cat: 'Bar', item: 'Jus de Bissap Maison', qty: 4, price: 1500, total: 6000 },
        { date: '2026-11-09', ref: 'CMD-1044', cat: 'Piscine', item: 'Accès Piscine Journée (PASS-PISCINE)', qty: 3, price: 5000, total: 15000 },
        { date: '2026-11-09', ref: 'CMD-1045', cat: 'Restaurant', item: 'Yassa Poulet Fermier', qty: 1, price: 7000, total: 7000 },
        { date: '2026-11-09', ref: 'CMD-1046', cat: 'Bar', item: 'Cocktail Thiès Sunset', qty: 2, price: 4500, total: 9000 },
      ];

      sampleSales.forEach((s) => {
        rowCount++;
        worksheet.addRow({
          date: sanitizeSpreadsheetCell(s.date),
          ref: sanitizeSpreadsheetCell(s.ref),
          cat: sanitizeSpreadsheetCell(s.cat),
          item: sanitizeSpreadsheetCell(s.item),
          qty: s.qty,
          price: s.price,
          total: s.total,
        }).commit();
      });
    } else {
      worksheet.columns = [
        { header: 'Poste de Recette', key: 'post', width: 25 },
        { header: 'Mode de Règlement', key: 'method', width: 20 },
        { header: 'Montant (FCFA)', key: 'amount', width: 18 },
      ];

      const closureData = [
        { post: 'Hébergement (Chambres)', method: 'Carte Bancaire', amount: 245000 },
        { post: 'Hébergement (Chambres)', method: 'Wave / Orange Money', amount: 125000 },
        { post: 'Restaurant & Bar', method: 'Espèces', amount: 62500 },
        { post: 'Restaurant & Bar', method: 'Carte Bancaire', amount: 80000 },
        { post: 'Accès Piscine', method: 'Wave / Orange Money', amount: 15000 },
      ];

      closureData.forEach((row) => {
        rowCount++;
        worksheet.addRow({
          post: sanitizeSpreadsheetCell(row.post),
          method: sanitizeSpreadsheetCell(row.method),
          amount: row.amount,
        }).commit();
      });
    }

    worksheet.commit();
    await workbook.commit();

    this.recordAudit({
      documentType: type,
      format: 'EXCEL',
      userId: user.id || 'usr-default',
      userFullName: user.fullName || 'Opérateur',
      userRole: user.role,
      periodStart: query.startDate,
      periodEnd: query.endDate,
      rowCount,
      fileSizeBytes: 12800,
      fileName: filename,
    });
  }
}
