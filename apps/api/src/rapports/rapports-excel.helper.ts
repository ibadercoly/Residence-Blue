import * as ExcelJS from 'exceljs';
import { RapportsResponse } from '@residence-blue/shared';
import { sanitizeSpreadsheetCell } from '../exports/exports.service';

const FCFA_NUM_FMT = '#,##0 "FCFA"';

function styleHeaderRow(row: ExcelJS.Row): void {
  row.font = { bold: true, color: { argb: 'FF161D20' } };
  row.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEEF5F9' },
  };
}

/**
 * Génère le classeur Excel (.xlsx) avec les 4 feuilles demandées, formules de totaux et en-têtes figés.
 */
export async function generateRapportsExcelBuffer(params: {
  report: RapportsResponse;
  generatedDateLabel: string;
}): Promise<Buffer> {
  const { report, generatedDateLabel } = params;
  const ExcelJSClass: any = (ExcelJS as any).default || ExcelJS;
  const workbook: ExcelJS.Workbook = new ExcelJSClass.Workbook();
  workbook.creator = report.hotelName;
  workbook.created = new Date();

  // 1. Feuille Résumé
  const wsSummary = workbook.addWorksheet('Résumé', {
    views: [{ state: 'frozen', ySplit: 4 }],
  });
  wsSummary.columns = [
    { width: 34 },
    { width: 22 },
    { width: 20 },
    { width: 42 },
  ];

  wsSummary.addRow([sanitizeSpreadsheetCell(report.hotelName), `Rapport — ${report.periodLabel}`]).font = {
    bold: true,
    size: 13,
  };
  wsSummary.addRow([
    `Période : du ${report.startDateIso} au ${report.endDateIso}`,
    `Généré le ${generatedDateLabel}`,
  ]);
  wsSummary.addRow(['Montants hors taxes en FCFA entiers, annulations exclues et avoirs déduits.']);

  const summaryHeader = wsSummary.addRow(['Indicateur', 'Valeur', 'Variation / Part', 'Explication']);
  styleHeaderRow(summaryHeader);

  if (report.tiles?.revenue) {
    const r = wsSummary.addRow([
      "Chiffre d'affaires",
      report.tiles.revenue.amountFcfa,
      report.tiles.revenue.deltaPercent !== undefined
        ? `${report.tiles.revenue.deltaPercent > 0 ? '+' : ''}${report.tiles.revenue.deltaPercent} % vs période précédente`
        : '',
      "Total des ventes de l'hôtel sur la période, avoirs déduits.",
    ]);
    r.getCell(2).numFmt = FCFA_NUM_FMT;
  }
  if (report.tiles?.accommodation) {
    const r = wsSummary.addRow([
      'Hébergement',
      report.tiles.accommodation.amountFcfa,
      `${report.tiles.accommodation.sharePercent} %`,
      'Ventes liées aux chambres occupées.',
    ]);
    r.getCell(2).numFmt = FCFA_NUM_FMT;
  }
  if (report.tiles?.restaurant) {
    const r = wsSummary.addRow([
      'Restaurant et bar',
      report.tiles.restaurant.amountFcfa,
      `${report.tiles.restaurant.sharePercent} %`,
      'Repas et boissons servis en salle ou en chambre.',
    ]);
    r.getCell(2).numFmt = FCFA_NUM_FMT;
  }
  if (report.tiles?.occupancy) {
    wsSummary.addRow([
      'Chambres occupées',
      report.tiles.occupancy.occupiedRoomNights,
      `${report.tiles.occupancy.averagePercent} %`,
      `${report.tiles.occupancy.occupiedRoomNights} nuitées sur ${report.tiles.occupancy.capacityRoomNights} possibles.`,
    ]);
  }
  if (report.tiles?.collected) {
    const r = wsSummary.addRow([
      'Argent encaissé',
      report.tiles.collected.amountFcfa,
      report.tiles.collected.deltaPercent !== undefined
        ? `${report.tiles.collected.deltaPercent > 0 ? '+' : ''}${report.tiles.collected.deltaPercent} % vs période précédente`
        : '',
      'Encaissements perçus sur la période.',
    ]);
    r.getCell(2).numFmt = FCFA_NUM_FMT;
  }
  if (report.tiles?.remaining) {
    const r = wsSummary.addRow([
      'Reste à encaisser',
      report.tiles.remaining.amountFcfa,
      '',
      'Notes de la période encore en attente de règlement.',
    ]);
    r.getCell(2).numFmt = FCFA_NUM_FMT;
  }

  // Phrases « Ce que dit ce graphique » (évolution du chiffre d'affaires)
  if (report.evolution?.insights?.length) {
    wsSummary.addRow([]);
    const evoHead = wsSummary.addRow([
      'Ce que dit le graphique — Évolution du chiffre d’affaires',
      '',
      '',
      '',
    ]);
    styleHeaderRow(evoHead);
    for (const ins of report.evolution.insights) {
      const label = ins.isAlert ? 'Alerte' : 'Constat';
      wsSummary.addRow([label, '', '', sanitizeSpreadsheetCell(ins.text)]);
    }
  }

  // 2. Feuille Jour par jour
  const wsDaily = workbook.addWorksheet('Jour par jour', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  wsDaily.columns = [
    { header: 'Jour', key: 'dateIso', width: 16 },
    { header: 'Chambres occupées', key: 'occupied', width: 18 },
    { header: 'Chambres actives', key: 'active', width: 18 },
    { header: 'Hébergement (FCFA)', key: 'heb', width: 20 },
    { header: 'Restaurant et bar (FCFA)', key: 'rest', width: 24 },
    { header: 'Autres (FCFA)', key: 'other', width: 18 },
    { header: 'Total (FCFA)', key: 'total', width: 20 },
  ];
  styleHeaderRow(wsDaily.getRow(1));

  const dailyRows = report.dailyTable?.rows || [];
  dailyRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const xlRow = wsDaily.addRow([
      sanitizeSpreadsheetCell(row.dateIso),
      row.occupiedRooms,
      row.activeRooms,
      row.accommodationFcfa,
      row.restaurantFcfa,
      row.otherFcfa,
      { formula: `SUM(D${rowNum}:F${rowNum})`, result: row.totalFcfa },
    ]);
    for (const colIdx of [4, 5, 6, 7]) {
      xlRow.getCell(colIdx).numFmt = FCFA_NUM_FMT;
    }
  });

  if (dailyRows.length > 0) {
    const lastRow = dailyRows.length + 1;
    const totalRow = wsDaily.addRow([
      'Total',
      { formula: `SUM(B2:B${lastRow})`, result: report.dailyTable?.totals.occupiedRoomNights ?? 0 },
      { formula: `SUM(C2:C${lastRow})`, result: report.dailyTable?.totals.capacityRoomNights ?? 0 },
      { formula: `SUM(D2:D${lastRow})`, result: report.dailyTable?.totals.accommodationFcfa ?? 0 },
      { formula: `SUM(E2:E${lastRow})`, result: report.dailyTable?.totals.restaurantFcfa ?? 0 },
      { formula: `SUM(F2:F${lastRow})`, result: report.dailyTable?.totals.otherFcfa ?? 0 },
      { formula: `SUM(G2:G${lastRow})`, result: report.dailyTable?.totals.totalFcfa ?? 0 },
    ]);
    totalRow.font = { bold: true };
    for (const colIdx of [4, 5, 6, 7]) {
      totalRow.getCell(colIdx).numFmt = FCFA_NUM_FMT;
    }
  }

  // 3. Feuille Par type et paiement
  const wsBreakdown = workbook.addWorksheet('Par type et paiement', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  wsBreakdown.columns = [
    { width: 28 },
    { width: 20 },
    { width: 22 },
    { width: 18 },
    { width: 20 },
  ];

  const weekHead = wsBreakdown.addRow([
    'Semaine',
    'Hébergement (FCFA)',
    'Restaurant et bar (FCFA)',
    'Autres (FCFA)',
    'Total (FCFA)',
  ]);
  styleHeaderRow(weekHead);

  const weeks = report.salesByTypeByWeek || [];
  const weekStartRow = 2;
  weeks.forEach((w, idx) => {
    const rNum = weekStartRow + idx;
    const xlRow = wsBreakdown.addRow([
      sanitizeSpreadsheetCell(w.label),
      w.accommodationFcfa,
      w.restaurantFcfa,
      w.otherFcfa,
      { formula: `SUM(B${rNum}:D${rNum})`, result: w.totalFcfa },
    ]);
    for (const colIdx of [2, 3, 4, 5]) {
      xlRow.getCell(colIdx).numFmt = FCFA_NUM_FMT;
    }
  });
  if (weeks.length > 0) {
    const wLast = weekStartRow + weeks.length - 1;
    const wTot = wsBreakdown.addRow([
      'Total semaines',
      { formula: `SUM(B${weekStartRow}:B${wLast})` },
      { formula: `SUM(C${weekStartRow}:C${wLast})` },
      { formula: `SUM(D${weekStartRow}:D${wLast})` },
      { formula: `SUM(E${weekStartRow}:E${wLast})` },
    ]);
    wTot.font = { bold: true };
    for (const colIdx of [2, 3, 4, 5]) {
      wTot.getCell(colIdx).numFmt = FCFA_NUM_FMT;
    }
  }

  wsBreakdown.addRow([]);
  const payHead = wsBreakdown.addRow(['Mode de paiement', 'Montant encaissé (FCFA)', 'Part (%)']);
  styleHeaderRow(payHead);
  const payItems = report.paymentsByMethod?.items || [];
  const payStartRow = wsBreakdown.rowCount + 1;
  payItems.forEach((p) => {
    const xlRow = wsBreakdown.addRow([
      sanitizeSpreadsheetCell(p.label),
      p.amountFcfa,
      `${p.percent} %`,
    ]);
    xlRow.getCell(2).numFmt = FCFA_NUM_FMT;
  });
  if (payItems.length > 0) {
    const pLast = payStartRow + payItems.length - 1;
    const pTot = wsBreakdown.addRow([
      'Total encaissé',
      { formula: `SUM(B${payStartRow}:B${pLast})`, result: report.paymentsByMethod?.totalFcfa ?? 0 },
      '100 %',
    ]);
    pTot.font = { bold: true };
    pTot.getCell(2).numFmt = FCFA_NUM_FMT;
  }

  // 4. Feuille Restaurant
  const wsResto = workbook.addWorksheet('Restaurant', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  wsResto.columns = [
    { header: 'Rang', key: 'rank', width: 10 },
    { header: 'Plat ou boisson', key: 'name', width: 36 },
    { header: 'Quantité vendue', key: 'qty', width: 18 },
    { header: 'Montant HT (FCFA)', key: 'amount', width: 22 },
  ];
  styleHeaderRow(wsResto.getRow(1));

  const dishes = report.topDishes || [];
  if (dishes.length === 0) {
    wsResto.addRow(['', 'Aucune vente restaurant sur cette période', 0, 0]);
  } else {
    dishes.forEach((d, idx) => {
      const xlRow = wsResto.addRow([
        idx + 1,
        sanitizeSpreadsheetCell(d.name),
        d.quantity,
        d.amountFcfa,
      ]);
      xlRow.getCell(4).numFmt = FCFA_NUM_FMT;
    });
    const lastDishRow = dishes.length + 1;
    const dishTot = wsResto.addRow([
      '',
      'Total Top 10',
      { formula: `SUM(C2:C${lastDishRow})` },
      { formula: `SUM(D2:D${lastDishRow})` },
    ]);
    dishTot.font = { bold: true };
    dishTot.getCell(4).numFmt = FCFA_NUM_FMT;
  }

  const out = await workbook.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}
