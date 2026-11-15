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

function drawMonotoneCubicPdf(
  doc: PDFKit.PDFDocument,
  coords: Array<{ x: number; y: number }>,
): void {
  const n = coords.length;
  if (n === 0) return;
  doc.moveTo(coords[0].x, coords[0].y);
  if (n === 1) return;
  if (n === 2) {
    doc.lineTo(coords[1].x, coords[1].y);
    return;
  }

  const deltas: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = Math.max(0.0001, coords[i + 1].x - coords[i].x);
    deltas.push((coords[i + 1].y - coords[i].y) / dx);
  }
  const m = new Array<number>(n).fill(0);
  m[0] = deltas[0];
  m[n - 1] = deltas[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = deltas[i - 1] * deltas[i] <= 0 ? 0 : (deltas[i - 1] + deltas[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (deltas[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / deltas[i];
      const b = m[i + 1] / deltas[i];
      if (a < 0) m[i] = 0;
      if (b < 0) m[i + 1] = 0;
      const hyp = Math.hypot(a, b);
      if (hyp > 3) {
        const tau = 3 / hyp;
        m[i] = tau * a * deltas[i];
        m[i + 1] = tau * b * deltas[i];
      }
    }
  }

  for (let i = 0; i < n - 1; i++) {
    const h = coords[i + 1].x - coords[i].x;
    const cx1 = coords[i].x + h / 3;
    const cy1 = coords[i].y + (m[i] * h) / 3;
    const cx2 = coords[i + 1].x - h / 3;
    const cy2 = coords[i + 1].y - (m[i + 1] * h) / 3;
    doc.bezierCurveTo(cx1, cy1, cx2, cy2, coords[i + 1].x, coords[i + 1].y);
  }
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

  // Diagramme vectoriel 1 : Évolution du chiffre d'affaires (barres + courbe de tendance monotone + phrases)
  if (report.evolution || report.revenueEvolution) {
    const richEvo = report.evolution;
    const fallbackEvo = report.revenueEvolution!;
    const evoPoints = richEvo
      ? richEvo.points
      : fallbackEvo.points.map((p) => ({
          ...p,
          fullDateLabel: p.label,
          accommodationFcfa: 0,
          restaurantFcfa: 0,
          otherFcfa: 0,
          trendFcfa: Math.max(0, p.amountFcfa),
        }));
    const prevPts =
      comparePrevious && (richEvo?.previousPoints || fallbackEvo.previousPoints)
        ? (richEvo?.previousPoints || fallbackEvo.previousPoints)!
        : [];
    const bestPt = richEvo ? richEvo.bestPoint : fallbackEvo.bestPoint;
    const lowestPt = richEvo ? richEvo.lowestPoint : fallbackEvo.lowestPoint;
    const topPoints = richEvo ? richEvo.topPoints : fallbackEvo.topPoints;
    const avgFcfa = richEvo
      ? richEvo.averageFcfa
      : Math.round(
          evoPoints.reduce((s, p) => s + p.amountFcfa, 0) / Math.max(1, evoPoints.length),
        );

    drawSectionHeader(
      doc,
      "Évolution du chiffre d'affaires",
      `Barres : ventes réelles • Courbe : ${richEvo?.trendLabel || 'Tendance'} • Meilleur : ${bestPt.label} (${fmtFcfa(bestPt.amountFcfa)})`,
    );
    const chartH = 148;
    const y0 = ensureSpace(doc, chartH + 34);
    const padL = 62;
    const padR = 54;
    const plotW = pageWidth - padL - padR;
    const plotH = chartH - 28;
    const baseY = y0 + plotH;

    const maxVal = Math.max(
      ...evoPoints.map((p) => Math.max(p.amountFcfa, p.trendFcfa)),
      ...prevPts.map((p) => p.amountFcfa),
      avgFcfa,
      1,
    );
    const toY = (v: number) => y0 + ((maxVal - Math.max(0, v)) / maxVal) * plotH;
    const count = Math.max(1, evoPoints.length);
    const slotW = plotW / count;
    const barW = Math.max(3, Math.min(slotW - 1.5, slotW * 0.68));
    const centerX = (idx: number, len: number) => {
      const sW = plotW / Math.max(1, len);
      return 40 + padL + idx * sW + sW / 2;
    };

    // Grille horizontale vectorielle
    doc.save();
    for (const ratio of [0, 0.5, 1]) {
      const val = Math.round(ratio * maxVal);
      const gy = toY(val);
      doc
        .strokeColor('#dce4e7')
        .lineWidth(0.6)
        .moveTo(40 + padL, gy)
        .lineTo(40 + padL + plotW, gy)
        .stroke();
      doc.fillColor('#2b3638').font('Helvetica-Bold').fontSize(7).text(fmtFcfa(val), 40, gy - 4, {
        width: padL - 6,
        align: 'right',
      });
    }

    // Barres réelles (couleur chaude ambre)
    evoPoints.forEach((pt, idx) => {
      const val = Math.max(0, pt.amountFcfa);
      const h = (val / maxVal) * plotH;
      if (h > 0) {
        const bx = 40 + padL + idx * slotW + (slotW - barW) / 2;
        doc.rect(bx, baseY - h, barW, h).fillOpacity(0.75).fill('#d97706').fillOpacity(1);
      }
    });

    // Période précédente en pointillé (monotone)
    if (prevPts.length >= 2) {
      const prevCoords = prevPts.map((pt, idx) => ({
        x: centerX(idx, prevPts.length),
        y: toY(pt.amountFcfa),
      }));
      doc.strokeColor('#465d7b').lineWidth(1.2).dash(4, { space: 3 });
      drawMonotoneCubicPdf(doc, prevCoords);
      doc.stroke().undash();
    }

    // Courbe de tendance monotone vectorielle
    const trendCoords = evoPoints.map((pt, idx) => ({
      x: centerX(idx, evoPoints.length),
      y: toY(pt.trendFcfa),
    }));
    doc.strokeColor('#00666f').lineWidth(2);
    drawMonotoneCubicPdf(doc, trendCoords);
    doc.stroke();

    // Ligne de moyenne en pointillé + étiquette à droite hors barres
    const avgY = toY(avgFcfa);
    doc
      .strokeColor('#93000a')
      .lineWidth(1)
      .dash(3, { space: 2 })
      .moveTo(40 + padL, avgY)
      .lineTo(40 + padL + plotW, avgY)
      .stroke()
      .undash();
    doc
      .fillColor('#93000a')
      .font('Helvetica-Bold')
      .fontSize(6.5)
      .text(`Moy. ${Math.round(avgFcfa / 1000) > 0 ? new Intl.NumberFormat('fr-FR').format(avgFcfa).replace(/[\u202f\u00a0]/g, ' ') : avgFcfa} F`, 40 + padL + plotW + 4, avgY - 4, {
        width: padR - 4,
        align: 'left',
      });

    // Points records (Top 3) et plus bas
    const topSet = new Set(topPoints.map((t) => t.key));
    evoPoints.forEach((pt, idx) => {
      const px = centerX(idx, evoPoints.length);
      const py = toY(pt.amountFcfa);
      if (topSet.has(pt.key)) {
        doc.circle(px, py, 3.2).fill('#7e5700');
      } else if (pt.key === lowestPt.key) {
        doc.circle(px, py, 2.8).fill('#93000a');
      }
    });

    // Axe X et étiquettes espacées
    doc
      .strokeColor('#4a585a')
      .lineWidth(0.8)
      .moveTo(40 + padL, baseY)
      .lineTo(40 + padL + plotW, baseY)
      .stroke();
    const step = Math.max(1, Math.floor((evoPoints.length - 1) / 4));
    for (let i = 0; i < evoPoints.length; i += step) {
      const px = centerX(i, evoPoints.length);
      doc
        .fillColor('#2b3638')
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(evoPoints[i].label, px - 22, baseY + 5, {
          width: 44,
          align: 'center',
        });
    }
    doc.restore();
    doc.y = y0 + chartH + 4;

    // Bloc « Ce que dit ce graphique »
    if (richEvo?.insights?.length) {
      const boxY = ensureSpace(doc, 22 + richEvo.insights.length * 14);
      doc.fillColor('#004f56').font('Helvetica-Bold').fontSize(9.5).text('Ce que dit ce graphique', 40, boxY);
      doc.y = boxY + 14;
      for (const ins of richEvo.insights) {
        const yLine = ensureSpace(doc, 18);
        if (ins.isAlert) {
          doc.save();
          doc.roundedRect(40, yLine - 2, pageWidth, 16, 3).fill('#fff7ed').stroke('#d97706');
          doc.restore();
          doc.fillColor('#7c2d12').font('Helvetica-Bold').fontSize(8).text(ins.text, 46, yLine + 2, {
            width: pageWidth - 12,
          });
          doc.y = yLine + 18;
        } else {
          const prefix = ins.direction === 'up' ? '▲ ' : ins.direction === 'down' ? '▼ ' : '• ';
          const col = ins.direction === 'up' ? '#047857' : ins.direction === 'down' ? '#93000a' : '#161d20';
          doc.fillColor(col).font('Helvetica-Bold').fontSize(8).text(prefix, 42, yLine, { continued: true });
          doc.fillColor('#161d20').font('Helvetica').fontSize(8).text(ins.text, { width: pageWidth - 14 });
          doc.y += 2;
        }
      }
      doc.moveDown(0.5);
    }
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
