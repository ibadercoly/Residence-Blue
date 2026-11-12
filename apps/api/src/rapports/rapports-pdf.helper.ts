import PDFDocument from 'pdfkit';
import { RapportsResponse } from '@residence-blue/shared';

function fmtFcfa(amount: number | undefined | null): string {
  const safe = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(safe)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

function fmtDelta(delta: number): string {
  const abs = Math.abs(Math.round(delta));
  if (delta > 0) return `+${abs} % vs période précédente`;
  if (delta < 0) return `-${abs} % vs période précédente`;
  return 'Identique à la période précédente';
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight: number): number {
  const bottomLimit = doc.page.height - 56;
  if (doc.y + neededHeight > bottomLimit) {
    doc.addPage();
    return 44;
  }
  return doc.y;
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, subtitle?: string): void {
  ensureSpace(doc, 40);
  doc.fillColor('#004f56').font('Helvetica-Bold').fontSize(12).text(title, 40, doc.y);
  if (subtitle) {
    doc.fillColor('#3d494a').font('Helvetica').fontSize(8.5).text(subtitle, 40, doc.y + 2);
  }
  doc.moveDown(0.4);
}

/**
 * Génère un document PDF A4 100% vectoriel côté serveur à partir des données réelles du rapport.
 */
export async function generateRapportsPdfBuffer(params: {
  report: RapportsResponse;
  generatedDateLabel: string;
  comparePrevious: boolean;
}): Promise<Buffer> {
  const { report, generatedDateLabel, comparePrevious } = params;

  const doc = new PDFDocument({
    margin: 40,
    size: 'A4',
    bufferPages: true,
    compress: false,
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const pageWidth = doc.page.width - 80; // 515.28 pt

  // En-tête document
  doc.save();
  doc.roundedRect(40, 38, pageWidth, 62, 6).fill('#eef5f9');
  doc.restore();
  doc.fillColor('#004f56').font('Helvetica-Bold').fontSize(16).text(report.hotelName, 52, 48);
  doc
    .fillColor('#161d20')
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(`Rapport d'activité — ${report.periodLabel}`, 52, 69);
  doc
    .fillColor('#3d494a')
    .font('Helvetica')
    .fontSize(8.5)
    .text(
      `Période : du ${report.startDateIso} au ${report.endDateIso} • Généré le ${generatedDateLabel}`,
      52,
      84,
    );

  doc.y = 114;

  // Rappel en 3 lignes
  doc.fillColor('#3d494a').font('Helvetica').fontSize(8);
  doc.text('1. Ventes comptées le jour du service (nuit passée, repas servi).', 40, doc.y);
  doc.text('2. Annulations non comptées et avoirs déduits.', 40, doc.y + 1);
  doc.text('3. Montants hors taxes, exprimés en FCFA entiers.', 40, doc.y + 1);
  doc.moveDown(0.8);

  // Tuiles résumées (seulement celles ayant des données)
  if (report.tiles) {
    const cards: Array<{ label: string; value: string; note: string; accent: string }> = [];
    if (report.tiles.revenue) {
      cards.push({
        label: "Chiffre d'affaires",
        value: fmtFcfa(report.tiles.revenue.amountFcfa),
        note:
          comparePrevious && report.tiles.revenue.deltaPercent !== undefined
            ? fmtDelta(report.tiles.revenue.deltaPercent)
            : 'Total des ventes, avoirs déduits',
        accent: '#00666f',
      });
    }
    if (report.tiles.accommodation) {
      cards.push({
        label: 'Hébergement',
        value: fmtFcfa(report.tiles.accommodation.amountFcfa),
        note: `Part : ${report.tiles.accommodation.sharePercent} % du chiffre d'affaires`,
        accent: '#314865',
      });
    }
    if (report.tiles.restaurant) {
      cards.push({
        label: 'Restaurant et bar',
        value: fmtFcfa(report.tiles.restaurant.amountFcfa),
        note: `Part : ${report.tiles.restaurant.sharePercent} % du chiffre d'affaires`,
        accent: '#7e5700',
      });
    }
    if (report.tiles.occupancy) {
      cards.push({
        label: 'Chambres occupées',
        value: `${report.tiles.occupancy.averagePercent} %`,
        note: `${report.tiles.occupancy.occupiedRoomNights} / ${report.tiles.occupancy.capacityRoomNights} nuitées`,
        accent: '#00666f',
      });
    }
    if (report.tiles.collected) {
      cards.push({
        label: 'Argent encaissé',
        value: fmtFcfa(report.tiles.collected.amountFcfa),
        note:
          comparePrevious && report.tiles.collected.deltaPercent !== undefined
            ? fmtDelta(report.tiles.collected.deltaPercent)
            : 'Encaissements perçus sur la période',
        accent: '#004f56',
      });
    }
    if (report.tiles.remaining) {
      cards.push({
        label: 'Reste à encaisser',
        value: fmtFcfa(report.tiles.remaining.amountFcfa),
        note: 'Notes en attente de règlement',
        accent: '#93000a',
      });
    }

    if (cards.length > 0) {
      drawSectionHeader(doc, 'Chiffres clés de la période');
      const gap = 10;
      const colW = (pageWidth - gap * 2) / 3;
      const cardH = 58;
      for (let i = 0; i < cards.length; i += 3) {
        const y0 = ensureSpace(doc, cardH + 10);
        for (let c = 0; c < 3 && i + c < cards.length; c++) {
          const item = cards[i + c];
          const x = 40 + c * (colW + gap);
          doc.save();
          doc.roundedRect(x, y0, colW, cardH, 5).strokeColor(item.accent).lineWidth(1).stroke();
          doc.restore();
          doc.fillColor(item.accent).font('Helvetica-Bold').fontSize(8).text(item.label.toUpperCase(), x + 8, y0 + 8, {
            width: colW - 16,
          });
          doc.fillColor('#161d20').font('Helvetica-Bold').fontSize(12).text(item.value, x + 8, y0 + 22, {
            width: colW - 16,
          });
          doc.fillColor('#3d494a').font('Helvetica').fontSize(7.5).text(item.note, x + 8, y0 + 40, {
            width: colW - 16,
          });
        }
        doc.y = y0 + cardH + 10;
      }
      doc.moveDown(0.3);
    }
  }

  // Diagramme vectoriel 1 : Évolution du chiffre d'affaires
  if (report.revenueEvolution) {
    const evo = report.revenueEvolution;
    drawSectionHeader(
      doc,
      "Évolution du chiffre d'affaires",
      `Meilleur jour : ${evo.bestPoint.label} (${fmtFcfa(evo.bestPoint.amountFcfa)}) • Plus bas : ${evo.lowestPoint.label} (${fmtFcfa(evo.lowestPoint.amountFcfa)})`,
    );
    const chartH = 125;
    const y0 = ensureSpace(doc, chartH + 26);
    const padL = 56;
    const plotW = pageWidth - padL - 12;
    const plotH = chartH - 26;
    const baseY = y0 + plotH;

    const prevPts = comparePrevious && evo.previousPoints ? evo.previousPoints : [];
    const maxVal = Math.max(
      ...evo.points.map((p) => p.amountFcfa),
      ...prevPts.map((p) => p.amountFcfa),
      1,
    );
    const minVal = Math.min(...evo.points.map((p) => p.amountFcfa), 0);
    const span = Math.max(1, maxVal - minVal);
    const toY = (v: number) => y0 + ((maxVal - v) / span) * plotH;
    const toX = (idx: number, len: number) =>
      len <= 1 ? 40 + padL + plotW / 2 : 40 + padL + (idx * plotW) / (len - 1);

    // Grille horizontale vectorielle
    doc.save();
    for (const ratio of [0, 0.5, 1]) {
      const val = Math.round(minVal + ratio * span);
      const gy = toY(val);
      doc.strokeColor('#dce4e7').lineWidth(0.6).moveTo(40 + padL, gy).lineTo(40 + padL + plotW, gy).stroke();
      doc.fillColor('#3d494a').font('Helvetica').fontSize(7).text(fmtFcfa(val), 40, gy - 4, {
        width: padL - 6,
        align: 'right',
      });
    }

    // Courbe précédente en pointillé si présente
    if (prevPts.length >= 2) {
      doc.strokeColor('#465d7b').lineWidth(1.2).dash(4, { space: 3 });
      prevPts.forEach((pt, idx) => {
        const px = toX(idx, prevPts.length);
        const py = toY(pt.amountFcfa);
        if (idx === 0) doc.moveTo(px, py);
        else doc.lineTo(px, py);
      });
      doc.stroke().undash();
    }

    // Courbe courante vectorielle
    doc.strokeColor('#00666f').lineWidth(2);
    evo.points.forEach((pt, idx) => {
      const px = toX(idx, evo.points.length);
      const py = toY(pt.amountFcfa);
      if (idx === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.stroke();

    // Points records (Top 3)
    const topSet = new Set(evo.topPoints.map((t) => t.key));
    evo.points.forEach((pt, idx) => {
      const px = toX(idx, evo.points.length);
      const py = toY(pt.amountFcfa);
      if (topSet.has(pt.key)) {
        doc.circle(px, py, 3.2).fill('#7e5700');
      } else if (pt.key === evo.lowestPoint.key) {
        doc.circle(px, py, 2.8).fill('#93000a');
      }
    });

    // Étiquettes X espacées
    const step = Math.max(1, Math.floor((evo.points.length - 1) / 4));
    for (let i = 0; i < evo.points.length; i += step) {
      const px = toX(i, evo.points.length);
      doc.fillColor('#3d494a').font('Helvetica').fontSize(7).text(evo.points[i].label, px - 20, baseY + 5, {
        width: 40,
        align: 'center',
      });
    }
    doc.restore();
    doc.y = y0 + chartH + 6;
  }

  // Diagramme vectoriel 2 : Ventes par type et par semaine (barres empilées)
  if (report.salesByTypeByWeek?.length) {
    const weeks = report.salesByTypeByWeek;
    drawSectionHeader(
      doc,
      'Ventes par type et par semaine',
      'Vert : Hébergement • Doré : Restaurant et bar • Bleu ardoise : Autres',
    );
    const chartH = 110;
    const y0 = ensureSpace(doc, chartH + 20);
    const padL = 56;
    const plotW = pageWidth - padL - 12;
    const plotH = chartH - 22;
    const baseY = y0 + plotH;
    const maxTot = Math.max(...weeks.map((w) => w.totalFcfa), 1);
    const slotW = plotW / weeks.length;
    const barW = Math.min(28, Math.max(8, slotW * 0.6));

    doc.save();
    weeks.forEach((w, idx) => {
      const x = 40 + padL + idx * slotW + (slotW - barW) / 2;
      const hHeb = (Math.max(0, w.accommodationFcfa) / maxTot) * plotH;
      const hRest = (Math.max(0, w.restaurantFcfa) / maxTot) * plotH;
      const hOther = (Math.max(0, w.otherFcfa) / maxTot) * plotH;
      const yHeb = baseY - hHeb;
      const yRest = yHeb - hRest;
      const yOther = yRest - hOther;
      if (hHeb > 0) doc.rect(x, yHeb, barW, hHeb).fill('#00666f');
      if (hRest > 0) doc.rect(x, yRest, barW, hRest).fill('#d97706');
      if (hOther > 0) doc.rect(x, yOther, barW, hOther).fill('#465d7b');
    });
    doc.strokeColor('#6d797b').lineWidth(0.7).moveTo(40 + padL, baseY).lineTo(40 + padL + plotW, baseY).stroke();
    doc.restore();
    doc.y = y0 + chartH + 4;
  }

  // Diagramme vectoriel 3 : Chambres occupées par jour
  if (report.occupancyByDay) {
    const occ = report.occupancyByDay;
    drawSectionHeader(
      doc,
      'Chambres occupées par jour',
      `Moyenne : ${occ.averageRooms} sur ${occ.activeRoomsCount} chambres (${occ.averagePercent} %)`,
    );
    const chartH = 95;
    const y0 = ensureSpace(doc, chartH + 18);
    const padL = 40;
    const plotW = pageWidth - padL - 12;
    const plotH = chartH - 18;
    const baseY = y0 + plotH;
    const slotW = plotW / Math.max(1, occ.points.length);
    const barW = Math.min(18, Math.max(4, slotW * 0.65));
    const cap = Math.max(1, occ.activeRoomsCount);

    doc.save();
    occ.points.forEach((pt, idx) => {
      const x = 40 + padL + idx * slotW + (slotW - barW) / 2;
      const h = (pt.occupiedRooms / cap) * plotH;
      if (h > 0) doc.rect(x, baseY - h, barW, h).fill('#00666f');
    });
    const avgY = baseY - (Math.min(cap, occ.averageRooms) / cap) * plotH;
    doc.strokeColor('#93000a').lineWidth(1).dash(3, { space: 2 }).moveTo(40 + padL, avgY).lineTo(40 + padL + plotW, avgY).stroke().undash();
    doc.strokeColor('#6d797b').lineWidth(0.7).moveTo(40 + padL, baseY).lineTo(40 + padL + plotW, baseY).stroke();
    doc.restore();
    doc.y = y0 + chartH + 4;
  }

  // Diagrammes vectoriels à barres horizontales : Paiements, Sources, Catégories, Jours semaine, Top 10 plats
  const drawHorizontalBarsSection = (
    title: string,
    rows: Array<{ label: string; valueText: string; ratio: number; color: string }>,
  ) => {
    if (rows.length === 0) return;
    drawSectionHeader(doc, title);
    const barMaxW = 210;
    for (const r of rows) {
      const y0 = ensureSpace(doc, 20);
      doc.fillColor('#161d20').font('Helvetica-Bold').fontSize(8.5).text(r.label, 40, y0, { width: 170 });
      const bw = Math.max(4, Math.round(Math.max(0, Math.min(1, r.ratio)) * barMaxW));
      doc.save();
      doc.roundedRect(215, y0 + 2, barMaxW, 7, 3).fill('#e8eff3');
      doc.roundedRect(215, y0 + 2, bw, 7, 3).fill(r.color);
      doc.restore();
      doc.fillColor('#004f56').font('Helvetica-Bold').fontSize(8.5).text(r.valueText, 432, y0, {
        width: 123,
        align: 'right',
      });
      doc.y = y0 + 18;
    }
    doc.moveDown(0.3);
  };

  if (report.paymentsByMethod?.items.length) {
    const maxPay = Math.max(...report.paymentsByMethod.items.map((i) => i.amountFcfa), 1);
    drawHorizontalBarsSection(
      'Argent encaissé par mode de paiement',
      report.paymentsByMethod.items.map((i) => ({
        label: i.label,
        valueText: `${fmtFcfa(i.amountFcfa)} (${i.percent} %)`,
        ratio: i.amountFcfa / maxPay,
        color: '#00666f',
      })),
    );
  }

  if (report.reservationSources?.items.length) {
    const maxSrc = Math.max(...report.reservationSources.items.map((i) => i.count), 1);
    drawHorizontalBarsSection(
      "D'où viennent les réservations",
      report.reservationSources.items.map((i) => ({
        label: i.label,
        valueText: `${i.count} (${i.percent} %)`,
        ratio: i.count / maxSrc,
        color: '#314865',
      })),
    );
  }

  if (report.salesByRoomCategory?.items.length) {
    const maxCat = Math.max(...report.salesByRoomCategory.items.map((i) => i.amountFcfa), 1);
    drawHorizontalBarsSection(
      'Ventes par catégorie de chambre',
      report.salesByRoomCategory.items.map((i) => ({
        label: i.nightsCount > 0 ? `${i.category} (${i.nightsCount} nuitées)` : i.category,
        valueText: `${fmtFcfa(i.amountFcfa)} (${i.sharePercent} %)`,
        ratio: i.amountFcfa / maxCat,
        color: '#00666f',
      })),
    );
  }

  if (report.weekdayAverages?.length) {
    const maxWd = Math.max(...report.weekdayAverages.map((w) => w.averageFcfa), 1);
    drawHorizontalBarsSection(
      'Jours de la semaine (moyenne par jour)',
      report.weekdayAverages.map((w) => ({
        label: w.label,
        valueText: fmtFcfa(w.averageFcfa),
        ratio: w.averageFcfa / maxWd,
        color: w.averageFcfa === maxWd ? '#7e5700' : '#00666f',
      })),
    );
  }

  if (report.topDishes?.length) {
    const maxQty = Math.max(...report.topDishes.map((d) => d.quantity), 1);
    drawHorizontalBarsSection(
      'Les 10 plats les plus vendus',
      report.topDishes.map((d, idx) => ({
        label: `#${idx + 1} ${d.name}`,
        valueText: `${d.quantity} ventes • ${fmtFcfa(d.amountFcfa)}`,
        ratio: d.quantity / maxQty,
        color: '#b45309',
      })),
    );
  }

  // Tableau Jour par jour
  if (report.dailyTable) {
    const table = report.dailyTable;
    drawSectionHeader(doc, 'Tableau Jour par jour');

    const colWidths = [95, 78, 85, 92, 75, 90];
    const headers = ['Jour', 'Occupées', 'Hébergement', 'Resto & bar', 'Autres', 'Total'];

    const drawTableHeader = (yPos: number): number => {
      doc.save();
      doc.rect(40, yPos, pageWidth, 20).fill('#eef5f9');
      doc.restore();
      let cx = 44;
      headers.forEach((h, i) => {
        doc.fillColor('#161d20').font('Helvetica-Bold').fontSize(8).text(h, cx, yPos + 6, {
          width: colWidths[i] - 6,
          align: i >= 2 ? 'right' : 'left',
        });
        cx += colWidths[i];
      });
      return yPos + 20;
    };

    let yCursor = drawTableHeader(ensureSpace(doc, 46));
    for (const row of table.rows) {
      if (yCursor + 18 > doc.page.height - 62) {
        doc.addPage();
        yCursor = drawTableHeader(44);
      }
      const vals = [
        row.label,
        `${row.occupiedRooms} sur ${row.activeRooms}`,
        fmtFcfa(row.accommodationFcfa),
        fmtFcfa(row.restaurantFcfa),
        fmtFcfa(row.otherFcfa),
        fmtFcfa(row.totalFcfa),
      ];
      let cx = 44;
      vals.forEach((v, i) => {
        doc
          .fillColor(i === 5 ? '#004f56' : '#161d20')
          .font(i === 5 ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8)
          .text(v, cx, yCursor + 4, {
            width: colWidths[i] - 6,
            align: i >= 2 ? 'right' : 'left',
          });
        cx += colWidths[i];
      });
      doc.save();
      doc.strokeColor('#e8eff3').lineWidth(0.5).moveTo(40, yCursor + 17).lineTo(40 + pageWidth, yCursor + 17).stroke();
      doc.restore();
      yCursor += 18;
    }

    // Ligne Total finale
    if (yCursor + 24 > doc.page.height - 56) {
      doc.addPage();
      yCursor = drawTableHeader(44);
    }
    doc.save();
    doc.rect(40, yCursor, pageWidth, 22).fill('#e6f3f4');
    doc.restore();
    const totalVals = [
      'Total',
      `${table.totals.occupiedRoomNights}/${table.totals.capacityRoomNights}`,
      fmtFcfa(table.totals.accommodationFcfa),
      fmtFcfa(table.totals.restaurantFcfa),
      fmtFcfa(table.totals.otherFcfa),
      fmtFcfa(table.totals.totalFcfa),
    ];
    let tx = 44;
    totalVals.forEach((v, i) => {
      doc.fillColor('#004f56').font('Helvetica-Bold').fontSize(8.5).text(v, tx, yCursor + 6, {
        width: colWidths[i] - 6,
        align: i >= 2 ? 'right' : 'left',
      });
      tx += colWidths[i];
    });
  }

  // Numéros de page sur toutes les pages (annuler la marge basse le temps du pied de page pour éviter toute page blanche)
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const savedBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    const footerY = doc.page.height - 28;
    doc
      .fillColor('#3d494a')
      .font('Helvetica')
      .fontSize(8)
      .text(`${report.hotelName} — ${report.periodLabel}`, 40, footerY, {
        width: pageWidth / 2,
        align: 'left',
        lineBreak: false,
      });
    doc
      .fillColor('#3d494a')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(`Page ${i + 1} / ${range.count}`, 40 + pageWidth / 2, footerY, {
        width: pageWidth / 2,
        align: 'right',
        lineBreak: false,
      });
    doc.page.margins.bottom = savedBottomMargin;
  }

  doc.end();
  return finished;
}
