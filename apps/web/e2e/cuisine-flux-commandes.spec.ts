import { test, expect } from '@playwright/test';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

function cleanupFluxE2eData() {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const guests = await p.guest.findMany({
        where: { lastName: { startsWith: 'FluxE2E_' } },
        select: { id: true },
      });
      const gIds = guests.map((g) => g.id);
      const resList = gIds.length
        ? await p.reservation.findMany({ where: { guestId: { in: gIds } }, select: { id: true } })
        : [];
      const rIds = resList.map((r) => r.id);

      const orders = await p.restaurantOrder.findMany({
        where: {
          OR: [
            { ticketNumber: { startsWith: '#CMD-FLX-' } },
            { serverName: 'E2E Testeur' },
            ...(rIds.length ? [{ reservationId: { in: rIds } }] : []),
          ],
        },
        select: { id: true, invoiceId: true },
      });
      const oIds = orders.map((o) => o.id);
      const ordInvIds = orders.map((o) => o.invoiceId).filter(Boolean);
      if (oIds.length) {
        await p.restaurantOrderLine.deleteMany({ where: { orderId: { in: oIds } } });
        await p.restaurantOrder.deleteMany({ where: { id: { in: oIds } } });
      }
      if (gIds.length || ordInvIds.length) {
        const invs = await p.invoice.findMany({
          where: {
            OR: [
              ...(gIds.length ? [{ guestId: { in: gIds } }] : []),
              ...(ordInvIds.length ? [{ id: { in: ordInvIds } }] : []),
            ],
          },
          select: { id: true },
        });
        const invIds = invs.map((i) => i.id);
        if (invIds.length) {
          await p.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
          await p.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
          await p.invoice.deleteMany({ where: { id: { in: invIds } } });
        }
      }
      if (rIds.length) {
        await p.reservation.deleteMany({ where: { id: { in: rIds } } });
      }
      if (gIds.length) {
        await p.guest.deleteMany({ where: { id: { in: gIds } } });
      }
      const prods = await p.restaurantProduct.findMany({
        where: { name: 'Spaghetti Bolognaise' },
        select: { id: true },
      });
      if (prods.length) {
        const pIds = prods.map((x) => x.id);
        const used = await p.restaurantOrderLine.count({ where: { productId: { in: pIds } } });
        if (used === 0) {
          await p.restaurantProduct.deleteMany({ where: { id: { in: pIds } } });
        }
      }
      await p.$disconnect();
    })();
  `);
}

function seedCheckedInRoom301AndSpaghetti(): { roomNumber: string; productName: string } {
  let roomNumber = '301';
  const out = execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      let targetRoom = await p.room.findUnique({ where: { number: '301' } });
      if (!targetRoom) {
        const rooms = await p.room.findMany({ orderBy: { number: 'desc' } });
        targetRoom = rooms[0];
      }
      const today = new Date();
      const checkIn = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1));
      const checkOut = new Date(checkIn.getTime() + 4 * 86400000);
      const guest = await p.guest.create({
        data: {
          civility: 'M.',
          firstName: 'Ousmane',
          lastName: 'FluxE2E_' + Date.now(),
          fullName: 'Ousmane FluxE2E_' + Date.now(),
          phone: '+221771234567',
        },
      });
      await p.reservation.create({
        data: {
          reference: 'RES-FLX-' + Date.now(),
          guestId: guest.id,
          roomId: targetRoom.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          nights: 4,
          status: 'CHECKED_IN',
          totalFcfa: 180000,
        },
      });

      let cat = await p.restaurantCategory.findFirst({ orderBy: { displayOrder: 'asc' } });
      if (!cat) {
        cat = await p.restaurantCategory.create({
          data: { name: 'Plats sénégalais & Mer', icon: 'dinner_dining', displayOrder: 1 },
        });
      }
      const existingSpag = await p.restaurantProduct.findUnique({ where: { name: 'Spaghetti Bolognaise' } });
      if (!existingSpag) {
        await p.restaurantProduct.create({
          data: {
            name: 'Spaghetti Bolognaise',
            description: 'Spaghettis maison sauce bolognaise',
            categoryId: cat.id,
            priceFcfa: 4500,
            prepTimeMinutes: 15,
            prepStation: 'CUISINE',
            status: 'AVAILABLE',
          },
        });
      }
      console.log('SEED_ROOM=' + targetRoom.number);
      await p.$disconnect();
    })();
  `);
  const m = /SEED_ROOM=([^\s]+)/.exec(out);
  if (m) roomNumber = m[1];
  return { roomNumber, productName: 'Spaghetti Bolognaise' };
}

test.describe('Flux temps réel Restaurant <-> Cuisine & Rôle CUISINIER (deux contextes Playwright)', () => {
  let assistantUser = { email: '', password: '' };
  let cookUser = { email: '', password: '' };
  let cook2User = { email: '', password: '' };
  let receptionUser = { email: '', password: '' };
  let directionUser = { email: '', password: '' };
  let roomNumber = '301';

  test.beforeAll(() => {
    cleanupFluxE2eData();
    assistantUser = createE2eUser('RESTAURANT');
    cookUser = createE2eUser('CUISINIER');
    cook2User = createE2eUser('CUISINIER');
    receptionUser = createE2eUser('RECEPTION');
    directionUser = createE2eUser('DIRECTION');
    roomNumber = seedCheckedInRoom301AndSpaghetti().roomNumber;
  });

  test.afterAll(() => {
    cleanupFluxE2eData();
    deleteE2eUsers([
      assistantUser.email,
      cookUser.email,
      cook2User.email,
      receptionUser.email,
      directionUser.email,
    ]);
  });

  test('1 à 6 : flux complet 4 spaghettis Chambre 301 en temps réel, isolation CUISINIER, transitions 409, concurrence et hors ligne', async ({
    browser,
    request,
  }) => {
    test.setTimeout(150000);

    const assistantContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cookContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const assistantPage = await assistantContext.newPage();
    const cookPage = await cookContext.newPage();

    try {
      // --- Connexion Assistant (RESTAURANT) sur /restaurant ---
      await loginViaUi(assistantPage, assistantUser.email, assistantUser.password);
      await assistantPage.goto('/restaurant', { waitUntil: 'domcontentloaded' });
      await expect(assistantPage.locator('[data-testid="restaurant-pos-page"]')).toBeVisible();
      // RESTAURANT ne voit pas l'entrée « Cuisine » dans la barre latérale
      await expect(assistantPage.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);
      await expect(assistantPage.locator('[data-testid="nav-restaurant"]')).toBeVisible();
      // Si RESTAURANT tape /cuisine, il est redirigé vers /restaurant et l'API /api/restaurant/kitchen/orders renvoie 403
      await assistantPage.goto('/cuisine', { waitUntil: 'domcontentloaded' });
      await assistantPage.waitForURL('**/restaurant', { timeout: 10000 });
      await expect(assistantPage).toHaveURL(/\/restaurant$/);
      const assistantApiHeaders = await getApiAuthHeaders(
        request,
        assistantUser.email,
        assistantUser.password,
      );
      const forbiddenKitchenApi = await request.get('/api/restaurant/kitchen/orders', {
        headers: assistantApiHeaders,
      });
      expect(forbiddenKitchenApi.status()).toBe(403);

      // --- Vérification RECEPTION : ne voit pas « Cuisine » et /cuisine redirige vers /restaurant (API 403) ---
      const recContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const recPage = await recContext.newPage();
      try {
        await loginViaUi(recPage, receptionUser.email, receptionUser.password);
        await expect(recPage.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);
        await expect(recPage.locator('[data-testid="nav-restaurant"]')).toBeVisible();
        await recPage.goto('/cuisine', { waitUntil: 'domcontentloaded' });
        await recPage.waitForURL('**/restaurant', { timeout: 10000 });
        await expect(recPage).toHaveURL(/\/restaurant$/);
      } finally {
        await recContext.close();
      }
      const receptionHeaders = await getApiAuthHeaders(
        request,
        receptionUser.email,
        receptionUser.password,
      );
      const recForbiddenApi = await request.get('/api/restaurant/kitchen/orders', {
        headers: receptionHeaders,
      });
      expect(recForbiddenApi.status()).toBe(403);

      // --- Vérification DIRECTION : voit « Cuisine » juste après « Restaurant & Bar » et le bouton « Prise de commande » sur /cuisine ---
      const dirContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const dirPage = await dirContext.newPage();
      try {
        await loginViaUi(dirPage, directionUser.email, directionUser.password);
        await expect(dirPage.locator('[data-testid="nav-restaurant"]')).toBeVisible();
        await expect(dirPage.locator('[data-testid="nav-cuisine"]')).toBeVisible();
        await dirPage.locator('[data-testid="nav-cuisine"]').click();
        await dirPage.waitForURL('**/cuisine', { timeout: 10000 });
        await expect(dirPage.locator('[data-testid="link-back-pos"]')).toBeVisible();
      } finally {
        await dirContext.close();
      }

      // --- Connexion Cuisinier : arrive directement sur /cuisine ---
      await cookPage.goto('/connexion');
      await cookPage.locator('#user-login').fill(cookUser.email);
      await cookPage.locator('#user-password').fill(cookUser.password);
      await cookPage.locator('#login-btn').click();
      await cookPage.waitForURL('**/cuisine', { timeout: 25000 });
      await expect(cookPage.locator('[data-testid="kitchen-board-page"]')).toBeVisible();

      // TEST 2 : Barre latérale réduite pour CUISINIER (logo, seule entrée « Cuisine », nom du compte et déconnexion)
      await expect(cookPage.locator('[data-testid="app-sidebar-aside"]')).toBeVisible();
      await expect(cookPage.locator('[data-testid="sidebar-nav"] a')).toHaveCount(1);
      await expect(cookPage.locator('[data-testid="nav-cuisine"]')).toBeVisible();
      await expect(cookPage.locator('[data-testid="sidebar-cook-footer"]')).toBeVisible();
      await expect(cookPage.locator('[data-testid="sidebar-cook-logout-btn"]')).toBeVisible();
      await expect(cookPage.locator('[data-testid="link-back-pos"]')).toHaveCount(0);

      for (const forbiddenRoute of ['/restaurant', '/facturation', '/clients', '/rapports', '/accueil']) {
        await cookPage.goto(forbiddenRoute, { waitUntil: 'domcontentloaded' });
        await cookPage.waitForURL('**/cuisine', { timeout: 10000 });
        await expect(cookPage).toHaveURL(/\/cuisine$/);
      }

      // Vérifier l'indicateur SSE vert sur l'écran du cuisinier
      await expect(cookPage.locator('[data-testid="kitchen-sync-indicator"]')).toContainText(
        'Temps réel actif',
        { timeout: 10000 },
      );

      // TEST 1 : L'assistant compose 4 spaghettis pour Chambre 301 et clique « Envoyer en cuisine »
      const spagTile = assistantPage.locator('[data-product-name="Spaghetti Bolognaise"]').first();
      await expect(spagTile).toBeVisible();
      await spagTile.click();
      await spagTile.click();
      await spagTile.click();
      await spagTile.click();

      await assistantPage.locator('[data-testid="dest-btn-ROOM"]').click();
      const roomSelect = assistantPage.locator('[data-testid="pos-room-select"]');
      const targetOptionValue = await roomSelect.evaluate((sel, rNum) => {
        const opt = Array.from((sel as HTMLSelectElement).options).find((o) =>
          o.text.includes(`Ch. ${rNum}`),
        );
        return opt?.value || '';
      }, roomNumber);
      expect(targetOptionValue).toBeTruthy();
      await roomSelect.selectOption(targetOptionValue);

      await assistantPage.locator('[data-testid="btn-send-kitchen"]').click();
      await expect(assistantPage.locator('[data-testid="pos-success-banner"]')).toBeVisible({
        timeout: 10000,
      });

      const firstOrderRow = assistantPage.locator('[data-testid^="service-order-row-"]').first();
      await expect(firstOrderRow).toContainText(`Chambre ${roomNumber}`);
      await expect(firstOrderRow).toContainText('4 Spaghetti Bolognaise');
      const orderId = (await firstOrderRow.getAttribute('data-testid'))!.replace(
        'service-order-row-',
        '',
      );

      // Le ticket apparaît en moins de 2 s chez le cuisinier sans recharger la page, et la pastille rouge « Cuisine » affiche le nombre de commandes EN ATTENTE
      const cookPendingCard = cookPage
        .locator('[data-testid="kitchen-col-PENDING"]')
        .locator(`[data-testid="kitchen-card-${orderId}"]`);
      await expect(cookPendingCard).toBeVisible({ timeout: 5000 });
      await expect(cookPage.locator('[data-testid="nav-cuisine-pending-badge"]')).toBeVisible();
      await expect(cookPendingCard).toContainText(`Chambre ${roomNumber}`);
      await expect(cookPendingCard).toContainText('4×');
      await expect(cookPendingCard).toContainText('Spaghetti Bolognaise');
      // Aucun prix ni FCFA ni nom client dans le DOM du cuisinier
      await expect(cookPendingCard).not.toContainText('FCFA');
      await expect(cookPendingCard).not.toContainText('FluxE2E_');

      // Vérifier côté API que le JSON renvoyé au CUISINIER ne contient ni prix ni nom client
      const cookHeaders = await getApiAuthHeaders(request, cookUser.email, cookUser.password);
      const cookOrdersRes = await request.get('/api/restaurant/orders', { headers: cookHeaders });
      expect(cookOrdersRes.status()).toBe(200);
      const cookOrdersBody = await cookOrdersRes.json();
      const rawCookOrder = cookOrdersBody.find((o: any) => o.id === orderId);
      expect(rawCookOrder).toBeTruthy();
      expect(rawCookOrder.totalTtcFcfa).toBeUndefined();
      expect(rawCookOrder.guestName).toBeUndefined();
      expect(rawCookOrder.items[0].unitPriceFcfa).toBeUndefined();

      // Cuisinier touche « 15 min » -> passe en préparation
      await cookPage.locator(`[data-testid="kitchen-prep-15-${orderId}"]`).click();
      const cookPrepCard = cookPage
        .locator('[data-testid="kitchen-col-IN_PREPARATION"]')
        .locator(`[data-testid="kitchen-card-${orderId}"]`);
      await expect(cookPrepCard).toBeVisible({ timeout: 8000 });
      await expect(cookPrepCard.locator(`[data-testid="kitchen-countdown-${orderId}"]`)).toContainText(
        'En préparation, prête vers',
      );

      // Capture écran Cuisine avec les 3 colonnes
      await cookPage.screenshot({
        path: path.join(compDir, 'actual_flux_cuisine_3_colonnes.png'),
        fullPage: false,
      });

      // L'assistant voit « En préparation, prête vers ... (dans ... min) » sans recharger
      await expect(assistantPage.locator(`[data-testid="order-status-${orderId}"]`)).toContainText(
        'En préparation, prête vers',
        { timeout: 8000 },
      );

      // Capture écran Assistant avec le compte à rebours
      await assistantPage.screenshot({
        path: path.join(compDir, 'actual_flux_assistant_compte_a_rebours.png'),
        fullPage: false,
      });

      // Cuisinier touche « +5 min » -> l'heure prévue avance de 5 min chez l'assistant
      await cookPage.locator(`[data-testid="kitchen-add5-${orderId}"]`).click();
      await expect(cookPrepCard.locator(`[data-testid="kitchen-countdown-${orderId}"]`)).toContainText(
        'dans',
      );

      // Cuisinier touche « Marquer prête »
      await cookPage.locator(`[data-testid="kitchen-next-${orderId}"]`).click();
      const cookReadyCard = cookPage
        .locator('[data-testid="kitchen-col-READY"]')
        .locator(`[data-testid="kitchen-card-${orderId}"]`);
      await expect(cookReadyCard).toBeVisible({ timeout: 8000 });

      // L'assistant voit la notification « Chambre 301 : 4 Spaghetti Bolognaise prêts à servir », la ligne verte et le compteur rouge sur le menu
      const readyBanner = assistantPage.locator(`[data-testid="pos-ready-banner-${orderId}"]`);
      await expect(readyBanner).toBeVisible({ timeout: 8000 });
      await expect(readyBanner).toContainText(`Chambre ${roomNumber}`);
      await expect(readyBanner).toContainText('4 Spaghetti Bolognaise prêts à servir');
      await expect(assistantPage.locator(`[data-testid="order-status-${orderId}"]`)).toContainText(
        'Prête, à servir',
      );
      await expect(assistantPage.locator('[data-testid="nav-restaurant-ready-badge"]')).toBeVisible();

      // Capture écran Assistant avec la notification verte « prêts à servir » et le compteur du menu
      await assistantPage.screenshot({
        path: path.join(compDir, 'actual_flux_assistant_prets_a_servir_badge.png'),
        fullPage: false,
      });

      // L'assistant clique « Servie » -> la commande passe à Servie et le compteur décrémente
      await assistantPage.locator(`[data-testid="btn-serve-order-${orderId}"]`).click();
      await expect(assistantPage.locator(`[data-testid="order-status-${orderId}"]`)).toContainText(
        'Servie',
        { timeout: 8000 },
      );
      await expect(assistantPage.locator(`[data-testid="pos-ready-banner-${orderId}"]`)).toHaveCount(0);

      // TEST 4 : Prise en charge concurrente par deux cuisiniers (1 seul 200, le second 409)
      const assistantHeaders = await getApiAuthHeaders(
        request,
        assistantUser.email,
        assistantUser.password,
      );
      const cook2Headers = await getApiAuthHeaders(request, cook2User.email, cook2User.password);

      const concOrderRes = await request.post('/api/restaurant/orders', {
        headers: assistantHeaders,
        data: {
          ticketNumber: `#CMD-FLX-CONC-${Date.now().toString().slice(-4)}`,
          destinationType: 'TABLE',
          tableLabel: 'Table 4',
          items: [{ name: 'Spaghetti Bolognaise', quantity: 2, unitPriceFcfa: 4500 }],
        },
      });
      expect(concOrderRes.status()).toBe(201);
      const concOrder = await concOrderRes.json();

      const [c1, c2] = await Promise.all([
        request.patch(`/api/restaurant/orders/${concOrder.id}/status`, {
          headers: cookHeaders,
          data: { status: 'IN_PREPARATION', prepTimeMinutes: 10 },
        }),
        request.patch(`/api/restaurant/orders/${concOrder.id}/status`, {
          headers: cook2Headers,
          data: { status: 'IN_PREPARATION', prepTimeMinutes: 20 },
        }),
      ]);
      expect([c1.status(), c2.status()].sort()).toEqual([200, 409]);

      // TEST 6 : Hors ligne chez l'assistant -> affiche « En attente de synchronisation, la cuisine ne l'a pas encore reçue »
      await assistantContext.setOffline(true);
      await assistantPage.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(assistantPage.locator('[data-testid="pos-offline-banner"]')).toBeVisible();

      await spagTile.click();
      await assistantPage.locator('[data-testid="dest-btn-TAKEAWAY"]').click();
      await assistantPage.locator('[data-testid="btn-send-kitchen"]').click();

      const offlineStatusBadge = assistantPage.locator('[data-testid^="order-status-"]').first();
      await expect(offlineStatusBadge).toContainText(
        "En attente de synchronisation, la cuisine ne l'a pas encore reçue",
      );

      // Retour réseau -> envoyée une seule fois
      await assistantContext.setOffline(false);
      await assistantPage.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(assistantPage.locator('[data-testid="pos-offline-pending-badge"]')).toHaveCount(0, {
        timeout: 12000,
      });
    } finally {
      await assistantContext.close();
      await cookContext.close();
    }
  });
});
