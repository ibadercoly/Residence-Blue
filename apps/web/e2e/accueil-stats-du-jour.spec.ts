import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

function cleanupAccueilE2eData() {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const orders = await p.restaurantOrder.findMany({
        where: { ticketNumber: { startsWith: '#CMD-ACCE2E-' } },
        select: { id: true },
      });
      if (orders.length) {
        const ids = orders.map((o) => o.id);
        await p.restaurantOrderLine.deleteMany({ where: { orderId: { in: ids } } });
        await p.restaurantOrder.deleteMany({ where: { id: { in: ids } } });
      }
      const invs = await p.invoice.findMany({
        where: { invoiceNumber: { startsWith: 'FA-ACCE2E-' } },
        select: { id: true },
      });
      if (invs.length) {
        const ids = invs.map((i) => i.id);
        await p.payment.deleteMany({ where: { invoiceId: { in: ids } } });
        await p.invoiceLine.deleteMany({ where: { invoiceId: { in: ids } } });
        await p.invoice.deleteMany({ where: { id: { in: ids } } });
      }
      await p.$disconnect();
    })();
  `);
}

test.describe('Accueil — Statistiques du jour, RBAC, Offline & Responsive', () => {
  let dirUser: { email: string; password: string };
  let restoUser: { email: string; password: string };
  let hkUser: { email: string; password: string };
  const suffix = Date.now();

  test.beforeAll(() => {
    cleanupAccueilE2eData();
    dirUser = createE2eUser('DIRECTION');
    restoUser = createE2eUser('RESTAURANT');
    hkUser = createE2eUser('HOUSEKEEPING');

    // Injecter 1 facture du jour payée + 1 commande restaurant du jour avec tie-breaker CA
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      (async () => {
        const dIso = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Dakar',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date());
        const start = new Date(dIso + 'T00:00:00.000Z');
        const noon = new Date(start.getTime() + 12 * 3600 * 1000);

        const inv = await p.invoice.create({
          data: {
            invoiceNumber: 'FA-ACCE2E-${suffix}',
            documentType: 'INVOICE',
            isIssued: true,
            totalFcfa: 30000,
            paidAmountFcfa: 30000,
            balanceFcfa: 0,
            status: 'PAID',
            issuedAt: noon,
            settledAt: noon,
          },
        });
        await p.payment.create({
          data: {
            invoiceId: inv.id,
            method: 'ORANGE_MONEY',
            amountFcfa: 30000,
            paidAt: noon,
          },
        });

        await p.restaurantOrder.create({
          data: {
            ticketNumber: '#CMD-ACCE2E-${suffix}',
            destinationType: 'TABLE',
            tableLabel: 'Table 5',
            status: 'SERVED',
            totalTtcFcfa: 18000,
            createdAt: noon,
            lines: {
              create: [
                {
                  name: 'E2E Accueil Plat Tie B_${suffix}',
                  quantity: 2,
                  unitPriceFcfa: 2000,
                  totalPriceFcfa: 4000,
                },
                {
                  name: 'E2E Accueil Plat Tie Top_${suffix}',
                  quantity: 2,
                  unitPriceFcfa: 7000,
                  totalPriceFcfa: 14000,
                },
              ],
            },
          },
        });
        await p.$disconnect();
      })();
    `);
  });

  test.afterAll(() => {
    cleanupAccueilE2eData();
    const emails = [dirUser?.email, restoUser?.email, hkUser?.email].filter(Boolean) as string[];
    if (emails.length) deleteE2eUsers(emails);
  });

  test('DIRECTION voit les 3 blocs sous l existant, valeurs égales à l API, empilés < 900px, hors ligne & 0 overflow', async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(90000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dirUser.email, dirUser.password);
    await page.goto('/', { waitUntil: 'networkidle' });

    // Vérifier que les tuiles & boutons existants de l'Accueil sont intacts
    await expect(page.locator('[data-testid="kpis-section"]')).toBeVisible();
    await expect(page.locator('[data-testid="action-buttons-group"]')).toBeVisible();

    // Vérifier que la section Statistiques du jour est en dessous et affiche les 3 blocs colorés
    const section = page.locator('[data-testid="accueil-stats-du-jour"]');
    await expect(section).toBeVisible();

    const kpiBox = await page.locator('[data-testid="action-buttons-group"]').boundingBox();
    const statsBox = await section.boundingBox();
    expect(kpiBox).not.toBeNull();
    expect(statsBox).not.toBeNull();
    expect(statsBox!.y).toBeGreaterThan(kpiBox!.y);

    const blockClients = page.locator('[data-testid="accueil-block-clients"]');
    const blockBilling = page.locator('[data-testid="accueil-block-billing"]');
    const blockRestaurant = page.locator('[data-testid="accueil-block-restaurant"]');
    await expect(blockClients).toBeVisible();
    await expect(blockBilling).toBeVisible();
    await expect(blockRestaurant).toBeVisible();

    // À 1440px : les 3 blocs sont côte à côte (même rangée Y)
    const cBox = (await blockClients.boundingBox())!;
    const bBox = (await blockBilling.boundingBox())!;
    const rBox = (await blockRestaurant.boundingBox())!;
    expect(Math.abs(cBox.y - bBox.y)).toBeLessThanOrEqual(5);
    expect(Math.abs(bBox.y - rBox.y)).toBeLessThanOrEqual(5);

    // Cohérence API réelle (< 300ms) -> valeurs UI identiques
    const headers = await getApiAuthHeaders(request, dirUser.email, dirUser.password);
    const t0 = Date.now();
    const apiRes = await request.get('/api/accueil/jour', { headers });
    expect(apiRes.status()).toBe(200);
    expect(Date.now() - t0).toBeLessThan(300);
    const apiBody = await apiRes.json();

    await expect(page.locator('[data-testid="stat-clients-arrivals"]')).toContainText(
      `${apiBody.clients.arrivalsDone} / ${apiBody.clients.arrivalsExpected}`,
    );
    await expect(page.locator('[data-testid="stat-clients-departures"]')).toContainText(
      `${apiBody.clients.departuresDone} / ${apiBody.clients.departuresExpected}`,
    );
    await expect(page.locator('[data-testid="stat-clients-instay"]')).toContainText(
      String(apiBody.clients.guestsInStay),
    );
    await expect(page.locator('[data-testid="stat-clients-new"]')).toContainText(
      String(apiBody.clients.newGuestsToday),
    );
    await expect(page.locator('[data-testid="stat-billing-issued"]')).toContainText(
      String(apiBody.billing.issuedInvoicesToday),
    );
    await expect(page.locator('[data-testid="stat-billing-pending"]')).toContainText(
      String(apiBody.billing.notesToSettleCount),
    );
    await expect(page.locator('[data-testid="accueil-billing-stacked-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="accueil-billing-legend"]')).toContainText('Orange Money');

    await expect(page.locator('[data-testid="stat-restaurant-top-dish-name"]')).toContainText(
      apiBody.restaurant.topDish.name,
    );
    await expect(page.locator('[data-testid="accueil-top-5-bars"]')).toBeVisible();

    await fs.promises.mkdir(compDir, { recursive: true });
    await page.screenshot({
      path: path.join(compDir, 'actual_accueil_stats_desktop.png'),
      fullPage: true,
    });

    // Responsive : sous 900px (360, 768) empilés verticalement ; >= 900px (1024, 1440) côte à côte ; 0 scroll horizontal
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(150);
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(ov.sw, `Débordement horizontal à ${width}px`).toBeLessThanOrEqual(ov.cw);

      const box1 = (await blockClients.boundingBox())!;
      const box2 = (await blockBilling.boundingBox())!;
      if (width < 900) {
        expect(box2.y).toBeGreaterThan(box1.y + 50);
      } else {
        expect(Math.abs(box2.y - box1.y)).toBeLessThanOrEqual(5);
      }
      if (width === 360) {
        await page.screenshot({
          path: path.join(compDir, 'actual_accueil_stats_mobile.png'),
          fullPage: true,
        });
      }
    }

    // Mode hors ligne : basculer hors ligne et déclencher retour d'onglet/rafraîchissement -> dernières valeurs + bandeau
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('[data-testid="accueil-offline-banner"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('[data-testid="stat-restaurant-top-dish-name"]')).toContainText(
      apiBody.restaurant.topDish.name,
    );
    await context.setOffline(false);
  });

  test('RBAC UI : RESTAURANT ne voit que le bloc Restaurant, HOUSEKEEPING ne voit que Clients sans montants', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 850 });

    // RESTAURANT
    await loginViaUi(page, restoUser.email, restoUser.password);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="accueil-block-restaurant"]')).toBeVisible();
    await expect(page.locator('[data-testid="accueil-block-clients"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="accueil-block-billing"]')).toHaveCount(0);

    // HOUSEKEEPING (GOUVERNANTE)
    await loginViaUi(page, hkUser.email, hkUser.password);
    await page.goto('/', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="accueil-block-clients"]')).toBeVisible();
    await expect(page.locator('[data-testid="accueil-block-billing"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="accueil-block-restaurant"]')).toHaveCount(0);
    const blockText = await page.locator('[data-testid="accueil-block-clients"]').innerText();
    expect(blockText).not.toContain('FCFA');
  });

  test.describe('État vide restaurant (sans Service Worker pour interception HTTP déterministe)', () => {
    test.use({ serviceWorkers: 'block' });

    test('état vide restaurant : affiche 0 et « Aucune vente aujourd\'hui »', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 850 });

      await page.route('**/api/accueil/jour', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            dateDakarIso: '2026-11-12',
            timezone: 'Africa/Dakar',
            generatedAt: new Date().toISOString(),
            visibleBlocks: ['RESTAURANT'],
            restaurant: {
              ordersCount: 0,
              revenueFcfa: 0,
              topDish: null,
              topDishes: [],
            },
          }),
        });
      });

      await loginViaUi(page, restoUser.email, restoUser.password);
      await expect(page.locator('[data-testid="stat-restaurant-orders"]')).toHaveText('0');
      await expect(page.locator('[data-testid="stat-restaurant-revenue"]')).toHaveText('0 FCFA');
      await expect(page.locator('[data-testid="accueil-restaurant-empty"]')).toContainText(
        "Aucune vente aujourd'hui",
      );
    });
  });
});
