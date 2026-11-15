import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const createdEmails: string[] = [];
const capturesDir = path.resolve(__dirname, '../../../docs/design/captures/rapports');

function cleanupRapportsTestData(): void {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const orders = await p.restaurantOrder.findMany({
        where: { ticketNumber: { startsWith: '#CMD-E2E-RAP-' } },
        select: { id: true }
      });
      if (orders.length > 0) {
        const ids = orders.map(o => o.id);
        await p.restaurantOrderLine.deleteMany({ where: { orderId: { in: ids } } });
        await p.restaurantOrder.deleteMany({ where: { id: { in: ids } } });
      }
      const invs = await p.invoice.findMany({
        where: { invoiceNumber: { startsWith: 'FA-E2E-RAP-' } },
        select: { id: true }
      });
      if (invs.length > 0) {
        const ids = invs.map(i => i.id);
        await p.payment.deleteMany({ where: { invoiceId: { in: ids } } });
        await p.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
        await p.invoice.deleteMany({ where: { parentInvoiceId: { in: ids } } });
        await p.invoice.deleteMany({ where: { id: { in: ids } } });
      }
      const resas = await p.reservation.findMany({
        where: { reference: { startsWith: 'RES-E2E-RAP-' } },
        select: { id: true }
      });
      if (resas.length > 0) {
        await p.reservation.deleteMany({ where: { id: { in: resas.map(r => r.id) } } });
      }
      await p.$disconnect();
    })();
  `);
}

function seedRichRapportsData(): void {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const rooms = await p.room.findMany({ where: { isActive: true }, take: 3, orderBy: { number: 'asc' } });
      let guest = await p.guest.findFirst({ where: { phone: '+221770009988' } });
      if (!guest) {
        guest = await p.guest.create({
          data: {
            firstName: 'Mariama',
            lastName: 'Ndiaye',
            fullName: 'Mariama Ndiaye',
            phone: '+221770009988',
          }
        });
      }

      const now = new Date();
      const dStr = (offsetDays) => {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offsetDays));
        return d.toISOString().slice(0, 10);
      };

      const checkIn1 = new Date(dStr(-10) + 'T00:00:00.000Z');
      const checkOut1 = new Date(dStr(-7) + 'T00:00:00.000Z');
      const res1 = await p.reservation.create({
        data: {
          reference: 'RES-E2E-RAP-' + Date.now() + '-1',
          guestId: guest.id,
          roomId: rooms[0].id,
          checkInDate: checkIn1,
          checkOutDate: checkOut1,
          nights: 3,
          status: 'CHECKED_OUT',
          source: 'BOOKING',
          totalFcfa: 150000,
        }
      });

      const res2 = await p.reservation.create({
        data: {
          reference: 'RES-E2E-RAP-' + Date.now() + '-2',
          guestId: guest.id,
          roomId: rooms[1] ? rooms[1].id : rooms[0].id,
          checkInDate: new Date(dStr(-5) + 'T00:00:00.000Z'),
          checkOutDate: new Date(dStr(-3) + 'T00:00:00.000Z'),
          nights: 2,
          status: 'CHECKED_OUT',
          source: 'RECEPTION',
          totalFcfa: 110000,
        }
      });

      const ts = Date.now();
      // Facture période précédente (J-40) pour activer comparaison pointillée
      await p.invoice.create({
        data: {
          invoiceNumber: 'FA-E2E-RAP-PREV-' + ts,
          documentType: 'INVOICE',
          isIssued: true,
          roomId: rooms[0].id,
          subtotalHtFcfa: 80000,
          vatRatePercent: 10,
          vatAmountFcfa: 8000,
          totalFcfa: 88000,
          paidAmountFcfa: 88000,
          balanceFcfa: 0,
          status: 'PAID',
          issuedAt: new Date(dStr(-40) + 'T12:00:00.000Z'),
          lines: { create: [{ description: 'Nuitée précédente', category: 'HEBERGEMENT', quantity: 1, unitPriceFcfa: 88000, totalPriceFcfa: 88000 }] },
          payments: { create: [{ method: 'CASH', amountFcfa: 88000, paidAt: new Date(dStr(-40) + 'T12:30:00.000Z') }] }
        }
      });
      await p.invoice.create({
        data: {
          invoiceNumber: 'FA-E2E-RAP-PREV2-' + ts,
          documentType: 'INVOICE',
          isIssued: true,
          roomId: rooms[0].id,
          subtotalHtFcfa: 60000,
          vatRatePercent: 10,
          vatAmountFcfa: 6000,
          totalFcfa: 66000,
          paidAmountFcfa: 66000,
          balanceFcfa: 0,
          status: 'PAID',
          issuedAt: new Date(dStr(-35) + 'T12:00:00.000Z'),
          lines: { create: [{ description: 'Nuitée précédente 2', category: 'HEBERGEMENT', quantity: 1, unitPriceFcfa: 66000, totalPriceFcfa: 66000 }] },
          payments: { create: [{ method: 'WAVE', amountFcfa: 66000, paidAt: new Date(dStr(-35) + 'T12:30:00.000Z') }] }
        }
      });

      // 4 factures sur la période courante (jours distincts)
      const dayOffsets = [-12, -8, -4, -1];
      for (let i = 0; i < dayOffsets.length; i++) {
        const off = dayOffsets[i];
        await p.invoice.create({
          data: {
            invoiceNumber: 'FA-E2E-RAP-' + i + '-' + ts,
            documentType: 'INVOICE',
            isIssued: true,
            roomId: rooms[i % rooms.length].id,
            reservationId: i === 0 ? res1.id : i === 1 ? res2.id : null,
            guestId: guest.id,
            subtotalHtFcfa: 70000 + i * 25000,
            vatRatePercent: 10,
            vatAmountFcfa: 7000 + i * 2500,
            totalFcfa: 77000 + i * 27500,
            paidAmountFcfa: i === 3 ? 30000 : 77000 + i * 27500,
            balanceFcfa: i === 3 ? 77000 + i * 27500 - 30000 : 0,
            status: i === 3 ? 'PARTIAL' : 'PAID',
            issuedAt: new Date(dStr(off) + 'T14:00:00.000Z'),
            lines: {
              create: [
                { description: 'Séjour', category: 'HEBERGEMENT', quantity: 1, unitPriceFcfa: 55000 + i * 20000, totalPriceFcfa: 55000 + i * 20000 },
                { description: 'Dîner', category: 'RESTAURANT', quantity: 1, unitPriceFcfa: 15000 + i * 5000, totalPriceFcfa: 15000 + i * 5000 },
                { description: 'Accès Piscine', category: 'PISCINE', quantity: 1, unitPriceFcfa: 7000 + i * 2500, totalPriceFcfa: 7000 + i * 2500 },
              ]
            },
            payments: {
              create: [{
                method: i % 2 === 0 ? 'ORANGE_MONEY' : 'WAVE',
                amountFcfa: i === 3 ? 30000 : 77000 + i * 27500,
                paidAt: new Date(dStr(off) + 'T15:00:00.000Z')
              }]
            }
          }
        });
      }

      // Commandes restaurant
      await p.restaurantOrder.create({
        data: {
          ticketNumber: '#CMD-E2E-RAP-' + ts,
          destinationType: 'TABLE',
          tableLabel: 'Table 4',
          status: 'SERVED',
          subtotalHtFcfa: 24000,
          vatAmountFcfa: 2400,
          totalTtcFcfa: 26400,
          createdAt: new Date(dStr(-2) + 'T19:00:00.000Z'),
          lines: {
            create: [
              { name: 'Yassa Poulet', quantity: 2, unitPriceFcfa: 8800, totalPriceFcfa: 17600 },
              { name: 'Jus de Bissap', quantity: 4, unitPriceFcfa: 2200, totalPriceFcfa: 8800 },
            ]
          }
        }
      });

      await p.$disconnect();
    })();
  `);
}

test.describe('Écran Rapports (/rapports) — Diagrammes, Tableau, Responsive & Sans données fictives', () => {
  test.beforeAll(() => {
    fs.mkdirSync(capturesDir, { recursive: true });
    cleanupRapportsTestData();
    seedRichRapportsData();
  });

  test.afterAll(() => {
    cleanupRapportsTestData();
    deleteE2eUsers(createdEmails);
  });

  test('DIRECTION accède au menu Rapports après Facturation, voit les 6 tuiles, 8 diagrammes, comparaison, tableau défilant et 0 overflow', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir.email, dir.password);

    // Vérifier la présence et la position du lien Rapports juste après Facturation
    const navHrefs = await page.locator('aside nav a').evaluateAll((els) =>
      els.map((el) => el.getAttribute('href')),
    );
    const factIdx = navHrefs.indexOf('/facturation');
    const rapIdx = navHrefs.indexOf('/rapports');
    expect(factIdx).toBeGreaterThanOrEqual(0);
    expect(rapIdx).toBe(factIdx + 1);

    await page.locator('aside nav a[href="/rapports"]').click();
    await expect(page).toHaveURL(/.*\/rapports/);
    await expect(page.getByTestId('rapports-title')).toHaveText('Rapports');

    // Aucune chaîne fictive ni terme technique interdit dans le DOM
    const bodyText = await page.locator('main').innerText();
    for (const forbidden of ['Teranga', '2024', 'RevPAR', 'ADR', 'ALOS', 'OHADA', 'certifié']) {
      expect(bodyText.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }

    // Les 6 tuiles et les 8 diagrammes sont rendus avec données réelles
    await expect(page.getByTestId('tile-revenue')).toBeVisible();
    await expect(page.getByTestId('tile-accommodation')).toBeVisible();
    await expect(page.getByTestId('tile-restaurant')).toBeVisible();
    await expect(page.getByTestId('tile-occupancy')).toBeVisible();
    await expect(page.getByTestId('tile-collected')).toBeVisible();
    await expect(page.getByTestId('tile-remaining')).toBeVisible();

    await expect(page.getByTestId('chart-revenue-evolution')).toBeVisible();
    await expect(page.getByTestId('card-best-day')).toBeVisible();
    await expect(page.getByTestId('svg-previous-dashed-line')).toBeVisible();
    await expect(page.getByTestId('chart-sales-by-week')).toBeVisible();
    await expect(page.getByTestId('chart-occupancy-by-day')).toBeVisible();
    await expect(page.getByTestId('chart-payments-by-method')).toBeVisible();
    await expect(page.getByTestId('chart-reservation-sources')).toBeVisible();
    await expect(page.getByTestId('chart-sales-by-room-category')).toBeVisible();
    await expect(page.getByTestId('chart-weekday-averages')).toBeVisible();
    await expect(page.getByTestId('chart-top-dishes')).toBeVisible();

    // 1. Disposition : les 4 diagrammes de dates en pleine largeur, les 4 compacts en 2 colonnes
    const gridBox = await page.getByTestId('rapports-charts-grid').boundingBox();
    expect(gridBox).not.toBeNull();
    for (const wideId of [
      'chart-revenue-evolution',
      'chart-sales-by-week',
      'chart-occupancy-by-day',
      'chart-weekday-averages',
    ]) {
      const box = await page.getByTestId(wideId).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(gridBox!.width * 0.95);
    }
    for (const halfId of [
      'chart-payments-by-method',
      'chart-reservation-sources',
      'chart-sales-by-room-category',
      'chart-top-dishes',
    ]) {
      const box = await page.getByTestId(halfId).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeLessThan(gridBox!.width * 0.6);
    }

    // 2. Hauteur de la zone de tracé >= 360 px pour l'évolution, >= 340 px pour les autres sur ordinateur
    const evoPlotBox = await page.getByTestId('plot-area-revenue-evolution').boundingBox();
    expect(evoPlotBox).not.toBeNull();
    expect(evoPlotBox!.height).toBeGreaterThanOrEqual(360);

    for (const plotId of [
      'plot-area-sales-by-week',
      'plot-area-occupancy-by-day',
      'plot-area-weekday-averages',
    ]) {
      const plotBox = await page.getByTestId(plotId).boundingBox();
      expect(plotBox).not.toBeNull();
      expect(plotBox!.height).toBeGreaterThanOrEqual(340);
    }

    // 2b. Diagramme Évolution : légende « Tendance sur 7 jours », courbe monotone, moyenne hors barres, infobulle dans le cadre sur 1re et dernière barre
    await expect(page.getByTestId('legend-trend-label')).toContainText('Tendance sur 7 jours');
    await expect(page.getByTestId('svg-trend-monotone-line')).toBeVisible();
    const evoAvgBox = await page.getByTestId('evolution-avg-label').boundingBox();
    expect(evoAvgBox).not.toBeNull();
    expect(evoAvgBox!.x).toBeGreaterThanOrEqual(evoPlotBox!.x + evoPlotBox!.width - 1);

    const svgHostBox = await page.getByTestId('evolution-svg-host').boundingBox();
    expect(svgHostBox).not.toBeNull();
    const evoBars = page.locator('[data-testid^="evo-bar-"]');
    const evoBarCount = await evoBars.count();
    expect(evoBarCount).toBeGreaterThanOrEqual(2);

    // Première barre : infobulle entièrement à l'intérieur du diagramme
    await evoBars.first().click();
    const firstHostBox = await page.getByTestId('evolution-svg-host').boundingBox();
    const firstTipBox = await page.getByTestId('tooltip-evolution').boundingBox();
    expect(firstHostBox).not.toBeNull();
    expect(firstTipBox).not.toBeNull();
    expect(firstTipBox!.x).toBeGreaterThanOrEqual(firstHostBox!.x - 1);
    expect(firstTipBox!.x + firstTipBox!.width).toBeLessThanOrEqual(firstHostBox!.x + firstHostBox!.width + 1);
    expect(firstTipBox!.y).toBeGreaterThanOrEqual(firstHostBox!.y - 1);
    expect(firstTipBox!.y + firstTipBox!.height).toBeLessThanOrEqual(firstHostBox!.y + firstHostBox!.height + 1);

    // Dernière barre : infobulle entièrement à l'intérieur du diagramme
    await evoBars.last().click();
    const lastHostBox = await page.getByTestId('evolution-svg-host').boundingBox();
    const lastTipBox = await page.getByTestId('tooltip-evolution').boundingBox();
    expect(lastHostBox).not.toBeNull();
    expect(lastTipBox).not.toBeNull();
    expect(lastTipBox!.x).toBeGreaterThanOrEqual(lastHostBox!.x - 1);
    expect(lastTipBox!.x + lastTipBox!.width).toBeLessThanOrEqual(lastHostBox!.x + lastHostBox!.width + 1);
    expect(lastTipBox!.y).toBeGreaterThanOrEqual(lastHostBox!.y - 1);
    expect(lastTipBox!.y + lastTipBox!.height).toBeLessThanOrEqual(lastHostBox!.y + lastHostBox!.height + 1);

    // Bloc « Ce que dit ce graphique » présent et sans causalité
    const insightsBox = page.getByTestId('evolution-insights');
    await expect(insightsBox).toBeVisible();
    const insightsText = await insightsBox.innerText();
    expect(insightsText).toContain('Ce que dit ce graphique');
    expect(insightsText).not.toMatch(/(à cause de|en raison de|parce que|grâce à)/i);
    const insightItemsCount = await insightsBox.locator('li').count();
    expect(insightItemsCount).toBeGreaterThanOrEqual(3);

    const desktopSvgCheck = await page.locator('[data-testid="rapports-charts-grid"] svg').evaluateAll((svgs) => {
      const badPreserve = svgs.some((s) => s.getAttribute('preserveAspectRatio') === 'none');
      const texts = svgs.flatMap((s) => Array.from(s.querySelectorAll('text')));
      const minFontSize = texts.reduce((min, t) => {
        const fs = parseFloat(window.getComputedStyle(t).fontSize);
        return Math.min(min, fs);
      }, 999);
      const minWeight = texts.reduce((min, t) => {
        const fw = parseInt(window.getComputedStyle(t).fontWeight, 10) || 400;
        return Math.min(min, fw);
      }, 999);
      const hasKAbbrev = texts.some((t) => /\d+\s*k\b/i.test(t.textContent || ''));
      return { badPreserve, textCount: texts.length, minFontSize, minWeight, hasKAbbrev };
    });
    expect(desktopSvgCheck.badPreserve).toBe(false);
    expect(desktopSvgCheck.textCount).toBeGreaterThan(0);
    expect(desktopSvgCheck.minFontSize).toBeGreaterThanOrEqual(14);
    expect(desktopSvgCheck.minWeight).toBeGreaterThanOrEqual(700);
    expect(desktopSvgCheck.hasKAbbrev).toBe(false);

    // 3. Diagramme des chambres occupées : phrase d'aide sans décimales, étiquette moyenne hors barres, infobulle au clic
    await expect(page.getByTestId('occupancy-help-text')).toHaveText(
      /^\s*En moyenne \d+ % des chambres occupées \(\d+ chambres? sur \d+ en moyenne, arrondi à l'unité\)\s*$/,
    );
    const occPlotBox = await page.getByTestId('plot-area-occupancy-by-day').boundingBox();
    const avgLabelBox = await page.getByTestId('occupancy-avg-label').boundingBox();
    expect(occPlotBox).not.toBeNull();
    expect(avgLabelBox).not.toBeNull();
    expect(avgLabelBox!.x).toBeGreaterThanOrEqual(occPlotBox!.x + occPlotBox!.width - 1);

    await page.locator('[data-testid="chart-occupancy-by-day"] svg g').first().click();
    await expect(page.getByTestId('tooltip-occupancy')).toContainText(/chambres? sur \d+/);

    // 4. Phrases de résumé calculées sous les autres diagrammes
    for (const summaryId of [
      'summary-sales-by-week',
      'summary-occupancy-by-day',
      'summary-weekday-averages',
      'summary-payments-by-method',
      'summary-reservation-sources',
      'summary-sales-by-room-category',
      'summary-top-dishes',
    ]) {
      const txt = (await page.getByTestId(summaryId).innerText()).trim();
      expect(txt.length).toBeGreaterThan(10);
    }

    // Décocher la comparaison masque la courbe pointillée
    await page.getByTestId('compare-previous-checkbox').uncheck();
    await expect(page.getByTestId('svg-previous-dashed-line')).toHaveCount(0);
    await page.getByTestId('compare-previous-checkbox').check();
    await expect(page.getByTestId('svg-previous-dashed-line')).toBeVisible();

    // Changer de période (3m, 12m, mois, puis retour 30j)
    await page.getByTestId('period-btn-3m').click();
    await expect(page.getByTestId('rapports-subtitle')).toContainText('3 derniers mois');
    await page.getByTestId('period-btn-12m').click();
    await expect(page.getByTestId('rapports-subtitle')).toContainText('12 derniers mois');
    await page.getByTestId('period-btn-mois').click();
    await expect(page.getByTestId('rapports-subtitle')).toContainText('Mois en cours');
    await page.getByTestId('period-btn-30j').click();
    await expect(page.getByTestId('rapports-subtitle')).toContainText('30 derniers jours');

    // Tableau Jour par jour : barre de défilement visible et ligne Total fixe
    const tableScroll = page.getByTestId('daily-table-scroll');
    await expect(tableScroll).toBeVisible();
    const scrollMetrics = await tableScroll.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        overflowY: style.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollbarWidthPx: el.offsetWidth - el.clientWidth,
      };
    });
    expect(scrollMetrics.overflowY).toBe('scroll');
    expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
    expect(scrollMetrics.scrollbarWidthPx).toBeGreaterThan(0);
    await expect(page.getByTestId('daily-table-total-row')).toBeVisible();

    await page.screenshot({ path: path.join(capturesDir, 'rapports-desktop-1440.png'), fullPage: true });

    // Exports PDF & Excel réels par téléchargement blob
    const [pdfDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-pdf-btn').click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/^rapport-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(await pdfDownload.failure()).toBeNull();
    const tmpPdf = path.join(capturesDir, 'tmp-e2e-export.pdf');
    await pdfDownload.saveAs(tmpPdf);
    const pdfHead = fs.readFileSync(tmpPdf, 'latin1');
    fs.unlinkSync(tmpPdf);
    expect(pdfHead.slice(0, 5)).toBe('%PDF-');
    expect(pdfHead.trimEnd().endsWith('%%EOF')).toBe(true);

    const [excelDownload] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-excel-btn').click(),
    ]);
    expect(excelDownload.suggestedFilename()).toMatch(/^rapport-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(await excelDownload.failure()).toBeNull();
    const tmpXlsx = path.join(capturesDir, 'tmp-e2e-export.xlsx');
    await excelDownload.saveAs(tmpXlsx);
    const xlBuf = fs.readFileSync(tmpXlsx);
    fs.unlinkSync(tmpXlsx);
    expect(xlBuf.slice(0, 2).toString('latin1')).toBe('PK');

    // Vérifier scrollWidth <= clientWidth aux 4 largeurs obligatoires
    for (const width of [1440, 1024, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(200);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    }

    // À 360 px (mobile) : hauteur de la zone de tracé >= 280 px et textes >= 12 px en gras
    for (const plotId of [
      'plot-area-revenue-evolution',
      'plot-area-sales-by-week',
      'plot-area-occupancy-by-day',
      'plot-area-weekday-averages',
    ]) {
      const plotBox = await page.getByTestId(plotId).boundingBox();
      expect(plotBox).not.toBeNull();
      expect(plotBox!.height).toBeGreaterThanOrEqual(280);
    }
    const mobileSvgCheck = await page.locator('[data-testid="rapports-charts-grid"] svg text').evaluateAll((texts) => ({
      minFontSize: texts.reduce((min, t) => Math.min(min, parseFloat(window.getComputedStyle(t).fontSize)), 999),
      minWeight: texts.reduce((min, t) => Math.min(min, parseInt(window.getComputedStyle(t).fontWeight, 10) || 400), 999),
    }));
    expect(mobileSvgCheck.minFontSize).toBeGreaterThanOrEqual(12);
    expect(mobileSvgCheck.minWeight).toBeGreaterThanOrEqual(700);

    await page.screenshot({ path: path.join(capturesDir, 'rapports-mobile-360.png'), fullPage: true });
  });

  test('RECEPTION ne voit pas Rapports dans le menu et l’API renvoie 403', async ({
    page,
    request,
  }) => {
    await loginViaUi(page, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
    await expect(page.locator('aside nav a[href="/rapports"]')).toHaveCount(0);

    const headers = await getApiAuthHeaders(request, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
    const apiForbidden = await request.get('/api/rapports?periode=30j', { headers });
    expect(apiForbidden.status()).toBe(403);
  });

  test.describe('État vide déterministe (Service Worker bloqué pour interception HTTP)', () => {
    test.use({ serviceWorkers: 'block' });

    test('état vide sans données affiche le message d’aide et grise les exports', async ({ page }) => {
      const dir = createE2eUser('DIRECTION');
      createdEmails.push(dir.email);
      await loginViaUi(page, dir.email, dir.password);
      await page.route('**/api/rapports*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            period: 'mois',
            periodLabel: 'Mois en cours',
            startDateIso: '2026-11-01',
            endDateIso: '2026-11-12',
            timezone: 'Africa/Dakar',
            generatedAt: '2026-11-12T10:00:00.000Z',
            hotelName: 'Résidence Blue',
            activeRoomsCount: 12,
            hasData: false,
            previousPeriodHasData: false,
          }),
        });
      });

      await page.locator('aside nav a[href="/rapports"]').click();
      await expect(page).toHaveURL(/.*\/rapports/);
      await expect(page.getByTestId('rapports-empty-title')).toHaveText('Aucune donnée sur cette période');
      await expect(page.getByTestId('rapports-empty-help')).toContainText(
        'Changez de période ou commencez à enregistrer des séjours et des ventes',
      );
      await expect(page.getByTestId('rapports-tiles-grid')).toHaveCount(0);
      await expect(page.getByTestId('rapports-charts-grid')).toHaveCount(0);
      await expect(page.getByTestId('rapports-daily-table-section')).toHaveCount(0);
      await expect(page.getByTestId('export-pdf-btn')).toBeDisabled();
      await expect(page.getByTestId('export-excel-btn')).toBeDisabled();
    });
  });

  test('aucune chaîne fictive dans les chunks compilés de /rapports', async () => {
    const distDir = path.resolve(__dirname, '../dist/residence-blue-web/browser');
    if (!fs.existsSync(distDir)) return;
    const files = fs.readdirSync(distDir).filter((f) => f.endsWith('.js'));
    const rapportsChunks = files.filter((f) => {
      const content = fs.readFileSync(path.join(distDir, f), 'utf8');
      return content.includes('Aucune donnée sur cette période') || content.includes('Meilleur jour');
    });
    expect(rapportsChunks.length).toBeGreaterThan(0);
    for (const chunk of rapportsChunks) {
      const content = fs.readFileSync(path.join(distDir, chunk), 'utf8');
      expect(content).not.toMatch(/Teranga/i);
      expect(content).not.toMatch(/Mai 2024/i);
      expect(content).not.toMatch(/\bRevPAR\b|\bALOS\b|\bOHADA\b/);
    }
  });
});


