import { test, expect } from '@playwright/test';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c4944415408d763f8ffff3f0005fe02fea7d651340000000049454e44ae426082',
  'hex',
);

function cleanupRestaurantE2eData() {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const orders = await p.restaurantOrder.findMany({
        where: { ticketNumber: { startsWith: '#CMD-E2E-' } },
        select: { id: true, invoiceId: true },
      });
      const oIds = orders.map((o) => o.id);
      if (oIds.length) {
        await p.restaurantOrderLine.deleteMany({ where: { orderId: { in: oIds } } });
        await p.restaurantOrder.deleteMany({ where: { id: { in: oIds } } });
      }
      const guests = await p.guest.findMany({
        where: { lastName: { startsWith: 'RestoE2E_' } },
        select: { id: true },
      });
      const gIds = guests.map((g) => g.id);
      if (gIds.length) {
        const invs = await p.invoice.findMany({
          where: { guestId: { in: gIds } },
          select: { id: true },
        });
        const invIds = invs.map((i) => i.id);
        if (invIds.length) {
          await p.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
          await p.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
          await p.invoice.deleteMany({ where: { id: { in: invIds } } });
        }
        await p.reservation.deleteMany({ where: { guestId: { in: gIds } } });
        await p.guest.deleteMany({ where: { id: { in: gIds } } });
      }
      const prods = await p.restaurantProduct.findMany({
        where: { name: { startsWith: 'E2E Plat ' } },
        select: { id: true },
      });
      if (prods.length) {
        const pIds = prods.map((x) => x.id);
        await p.restaurantOrderLine.deleteMany({ where: { productId: { in: pIds } } });
        await p.restaurantProduct.deleteMany({ where: { id: { in: pIds } } });
      }
      await p.$disconnect();
    })();
  `);
}

function seedCheckedInStayAndOrders(): { roomNumber: string } {
  let resultRoom = '103';
  const out = execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const rooms = await p.room.findMany({ orderBy: { number: 'asc' } });
      const targetRoom = rooms.find((r) => r.number === '104') || rooms[2] || rooms[0];
      const today = new Date();
      const checkIn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
      const checkOut = new Date(checkIn.getTime() + 4 * 86400000);
      const guest = await p.guest.create({
        data: {
          civility: 'Mme',
          firstName: 'Awa',
          lastName: 'RestoE2E_' + Date.now(),
          fullName: 'Awa RestoE2E_' + Date.now(),
          phone: '+221778889900',
        },
      });
      await p.reservation.create({
        data: {
          reference: 'RES-RE2E-' + Date.now(),
          guestId: guest.id,
          roomId: targetRoom.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          nights: 4,
          status: 'CHECKED_IN',
          totalFcfa: 140000,
        },
      });
      for (let i = 1; i <= 12; i++) {
        await p.restaurantOrder.create({
          data: {
            ticketNumber: '#CMD-E2E-' + String(i).padStart(3, '0') + '-' + Date.now().toString().slice(-4),
            destinationType: 'TABLE',
            tableLabel: 'T' + ((i % 6) + 1),
            guestName: 'Client de passage',
            serverName: 'Moussa Fall',
            status: i <= 4 ? 'PENDING' : i <= 8 ? 'IN_PREPARATION' : 'SERVED',
            subtotalHtFcfa: 4091,
            vatAmountFcfa: 409,
            totalTtcFcfa: 4500,
            lines: {
              create: [{
                name: 'Thiéboudienne Royale',
                quantity: 1,
                unitPriceFcfa: 4500,
                totalPriceFcfa: 4500,
                prepStation: 'CUISINE',
              }],
            },
          },
        });
      }
      console.log('SEED_ROOM=' + targetRoom.number);
      await p.$disconnect();
    })();
  `);
  const m = /SEED_ROOM=([^\s]+)/.exec(out);
  if (m) resultRoom = m[1];
  return { roomNumber: resultRoom };
}

test.describe('Restaurant V3 — POS, Cuisine SSE/10s, Carte, Hors ligne & Facturation (base E2E)', () => {
  let dirUser = { email: '', password: '' };
  let seededRoomNumber = '104';

  test.beforeAll(() => {
    cleanupRestaurantE2eData();
    dirUser = createE2eUser('DIRECTION');
    seededRoomNumber = seedCheckedInStayAndOrders().roomNumber;
  });

  test.afterAll(() => {
    cleanupRestaurantE2eData();
    if (dirUser.email) deleteE2eUsers([dirUser.email]);
  });

  test('parcours complet POS -> Chambre -> Cuisine -> Facturation -> Carte 409 -> Responsive -> Hors ligne', async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dirUser.email, dirUser.password);

    // 1. Chargement du menu < 500 ms côté API
    const headers = await getApiAuthHeaders(request, dirUser.email, dirUser.password);
    const t0 = Date.now();
    const catRes = await request.get('/api/restaurant/catalog', { headers });
    const elapsed = Date.now() - t0;
    expect(catRes.status()).toBe(200);
    expect(elapsed, `Chargement menu a pris ${elapsed}ms (> 500ms)`).toBeLessThan(500);

    // 2. Écran 1 (/restaurant) : structure, 0 menu caché, scrollbar > 10 lignes
    await page.goto('/restaurant', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="restaurant-pos-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="pos-categories-bar"]')).toBeVisible();

    const scrollCheck = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="service-orders-scroll"]') as HTMLElement;
      return {
        offsetWidth: box.offsetWidth,
        clientWidth: box.clientWidth,
        rowCount: document.querySelectorAll('[data-testid^="service-order-row-"]').length,
      };
    });
    expect(scrollCheck.rowCount).toBeGreaterThan(10);
    expect(scrollCheck.offsetWidth).toBeGreaterThan(scrollCheck.clientWidth);

    // Capture desktop POS
    await page.screenshot({
      path: path.join(compDir, 'actual_restaurant_v3_pos_desktop.png'),
      fullPage: false,
    });

    // 3. Prendre commande sur chambre et mettre sur la chambre
    const thiebTile = page.locator('[data-product-name="Thiéboudienne Royale"]').first();
    await expect(thiebTile).toBeVisible();
    await thiebTile.click();
    await thiebTile.click();
    await expect(page.locator('[data-testid="pos-ticket-total"]')).toContainText('9 000 FCFA');

    await page.locator('[data-testid="dest-btn-ROOM"]').click();
    const roomSelect = page.locator('[data-testid="pos-room-select"]');
    const targetOptionValue = await roomSelect.evaluate((sel, roomNum) => {
      const opt = Array.from((sel as HTMLSelectElement).options).find((o) =>
        o.text.includes(`Ch. ${roomNum}`),
      );
      return opt?.value || '';
    }, seededRoomNumber);
    expect(targetOptionValue).toBeTruthy();
    await roomSelect.selectOption(targetOptionValue);

    await page.locator('[data-testid="btn-room-charge"]').click();
    await expect(page.locator('[data-testid="pos-success-banner"]')).toBeVisible({ timeout: 10000 });

    // Rechargement /restaurant : persistance PostgreSQL réelle
    await page.reload({ waitUntil: 'networkidle' });
    const latestOrderRow = page.locator('[data-testid^="service-order-row-"]').first();
    await expect(latestOrderRow).toContainText(`Ch. ${seededRoomNumber}`);
    await expect(latestOrderRow).toContainText('9 000 FCFA');

    const latestOrderId = (await latestOrderRow.getAttribute('data-testid'))!.replace(
      'service-order-row-',
      '',
    );

    // 4. Écran 2 (/cuisine) : 3 colonnes, 0 montant affiché, progression vers Prête puis Servie
    await page.goto('/cuisine', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="kitchen-col-PENDING"]')).toBeVisible();
    await expect(page.locator('[data-testid="kitchen-col-IN_PREPARATION"]')).toBeVisible();
    await expect(page.locator('[data-testid="kitchen-col-READY"]')).toBeVisible();

    const kitchenCard = page.locator(`[data-testid="kitchen-card-${latestOrderId}"]`);
    await expect(kitchenCard).toBeVisible();
    await expect(kitchenCard).not.toContainText('FCFA');

    await page.screenshot({
      path: path.join(compDir, 'actual_restaurant_v3_cuisine_desktop.png'),
      fullPage: false,
    });

    await page.locator(`[data-testid="kitchen-next-${latestOrderId}"]`).click();
    await expect(
      page.locator('[data-testid="kitchen-col-IN_PREPARATION"]').locator(`[data-testid="kitchen-card-${latestOrderId}"]`),
    ).toBeVisible({ timeout: 8000 });

    await page.locator(`[data-testid="kitchen-next-${latestOrderId}"]`).click();
    await expect(
      page.locator('[data-testid="kitchen-col-READY"]').locator(`[data-testid="kitchen-card-${latestOrderId}"]`),
    ).toBeVisible({ timeout: 8000 });

    // 5. Vérifier que la ligne apparaît sur la note de facturation de la chambre
    await page.goto('/facturation', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="comptoir-search-input"]').fill('RestoE2E');
    await page.waitForTimeout(350);
    const openLink = page.locator('[data-testid^="open-note-"]').first();
    await expect(openLink).toBeVisible();
    await openLink.click();
    await page.waitForURL('**/facturation/*');
    await expect(page.locator('[data-testid="category-group-RESTAURANT"]')).toContainText(
      'Thiéboudienne Royale',
    );

    // 6. Écran 3 (/restaurant/carte) : création produit + image + 409 sur produit utilisé
    await page.goto('/restaurant/carte', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="carte-admin-page"]')).toBeVisible();
    await page.locator('[data-testid="btn-new-product"]').click();
    const newProdName = `E2E Plat ${Date.now()}`;
    await page.locator('[data-testid="input-prod-name"]').fill(newProdName);
    await page.locator('[data-testid="input-prod-price"]').fill('3200');
    await page.locator('[data-testid="input-prod-photo"]').setInputFiles({
      name: 'plat.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await page.locator('[data-testid="btn-save-product"]').click();
    await expect(page.locator('[data-testid="carte-success-banner"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="carte-rows"]')).toContainText(newProdName);

    // Tenter de supprimer Thiéboudienne Royale (utilisé dans commandes) -> 409 + proposition Désactiver
    const thiebRow = page.locator('[data-testid^="carte-row-"]', { hasText: 'Thiéboudienne Royale' }).first();
    await thiebRow.locator('button', { hasText: 'Supprimer' }).click();
    await expect(page.locator('[data-testid="carte-error-banner"]')).toContainText('Désactiver');

    // 7. Zéro scroll horizontal à 360, 768, 1024, 1440 px sur les 3 écrans
    for (const route of ['/restaurant', '/cuisine', '/restaurant/carte']) {
      await page.goto(route, { waitUntil: 'networkidle' });
      for (const w of [360, 768, 1024, 1440]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(120);
        const ov = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(ov.sw, `Overflow détecté sur ${route} à ${w}px`).toBeLessThanOrEqual(ov.cw);
        if (route === '/restaurant' && w === 360) {
          await page.screenshot({
            path: path.join(compDir, 'actual_restaurant_v3_pos_mobile.png'),
            fullPage: false,
          });
        }
      }
    }

    // 8. Hors ligne : commande À emporter mise en file + rejouée une seule fois au retour réseau
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/restaurant', { waitUntil: 'networkidle' });
    const beforeOrdersCount = await request
      .get('/api/restaurant/orders/page?offset=0&limit=50', { headers })
      .then((r) => r.json())
      .then((j) => j.total as number);

    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await expect(page.locator('[data-testid="pos-offline-banner"]')).toBeVisible();

    await page.locator('[data-product-name="Jus de Bissap Maison"]').first().click();
    await page.locator('[data-testid="dest-btn-TAKEAWAY"]').click();
    await page.locator('[data-testid="btn-send-kitchen"]').click();
    await expect(page.locator('[data-testid="pos-offline-pending-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="badge-sync-pending"]').first()).toBeVisible();

    // Retour en ligne -> synchronisation unique
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await expect(page.locator('[data-testid="pos-offline-pending-badge"]')).toHaveCount(0, {
      timeout: 10000,
    });

    const afterOrdersCount = await request
      .get('/api/restaurant/orders/page?offset=0&limit=50', { headers })
      .then((r) => r.json())
      .then((j) => j.total as number);
    expect(afterOrdersCount).toBe(beforeOrdersCount + 1);
  });
});
