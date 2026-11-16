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
        await p.restaurantOrderEvent.deleteMany({ where: { orderId: { in: oIds } } });
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
      await p.$disconnect();
    })();
  `);
}

function seedCheckedInRoom301AndSpaghetti(): { roomNumber: string; guestName: string } {
  let roomNumber = '301';
  let guestName = 'Ousmane Diallo';
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
      const last = 'FluxE2E_' + Date.now();
      const full = 'M. Diallo ' + last;
      const guest = await p.guest.create({
        data: {
          civility: 'M.',
          firstName: 'Mamadou',
          lastName: last,
          fullName: full,
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
      console.log('SEED_GUEST=' + encodeURIComponent(full));
      await p.$disconnect();
    })();
  `);
  const mRoom = /SEED_ROOM=([^\s]+)/.exec(out);
  if (mRoom) roomNumber = mRoom[1];
  const mGuest = /SEED_GUEST=([^\s]+)/.exec(out);
  if (mGuest) guestName = decodeURIComponent(mGuest[1]);
  return { roomNumber, guestName };
}

test.describe('Flux Restaurant <-> Cuisine, Carte d’information, Notifications & Rôle CUISINIER', () => {
  let assistantUser = { email: '', password: '' };
  let cookUser = { email: '', password: '' };
  let cook2User = { email: '', password: '' };
  let receptionUser = { email: '', password: '' };
  let directionUser = { email: '', password: '' };
  let roomNumber = '301';
  let guestName = 'M. Diallo';

  test.beforeAll(() => {
    cleanupFluxE2eData();
    assistantUser = createE2eUser('RESTAURANT');
    cookUser = createE2eUser('CUISINIER');
    cook2User = createE2eUser('CUISINIER');
    receptionUser = createE2eUser('RECEPTION');
    directionUser = createE2eUser('DIRECTION');
    const seeded = seedCheckedInRoom301AndSpaghetti();
    roomNumber = seeded.roomNumber;
    guestName = seeded.guestName;
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

  test('1 à 7 : accès par rôle, carte info temps réel + frise, indisponibilité, autorisation service, concurrence, hors ligne et responsive', async ({
    browser,
    request,
  }) => {
    test.setTimeout(180000);

    const assistantContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cookContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const assistantPage = await assistantContext.newPage();
    const cookPage = await cookContext.newPage();

    try {
      // TEST 6a : RESTAURANT n'a aucune entrée Cuisine, /cuisine redirige vers /restaurant, /api/cuisine/* en 403
      await loginViaUi(assistantPage, assistantUser.email, assistantUser.password);
      await assistantPage.goto('/restaurant', { waitUntil: 'domcontentloaded' });
      await expect(assistantPage.locator('[data-testid="restaurant-pos-page"]')).toBeVisible();
      await expect(assistantPage.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);
      await expect(assistantPage.locator('[data-testid="link-kitchen"]')).toHaveCount(0);
      await expect(assistantPage.locator('[data-testid="nav-restaurant"]')).toBeVisible();

      await assistantPage.goto('/cuisine', { waitUntil: 'domcontentloaded' });
      await assistantPage.waitForURL('**/restaurant', { timeout: 10000 });
      await expect(assistantPage).toHaveURL(/\/restaurant$/);

      const assistantHeaders = await getApiAuthHeaders(
        request,
        assistantUser.email,
        assistantUser.password,
      );
      const restCuisineApi = await request.get('/api/cuisine/orders', { headers: assistantHeaders });
      expect(restCuisineApi.status()).toBe(403);

      // TEST 6b : RECEPTION n'a aucune entrée Cuisine, /cuisine redirige vers /restaurant, /api/cuisine/* en 403
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
      const recCuisineApi = await request.get('/api/cuisine/orders', { headers: receptionHeaders });
      expect(recCuisineApi.status()).toBe(403);

      // TEST 6c : DIRECTION ne voit pas l'entrée Cuisine, /cuisine redirige vers /tableau-de-bord, /api/cuisine/* en 403
      const dirContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const dirPage = await dirContext.newPage();
      try {
        await loginViaUi(dirPage, directionUser.email, directionUser.password);
        await expect(dirPage.locator('[data-testid="nav-restaurant"]')).toBeVisible();
        await expect(dirPage.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);
        await dirPage.goto('/cuisine', { waitUntil: 'domcontentloaded' });
        await dirPage.waitForURL('**/tableau-de-bord', { timeout: 10000 });
        await expect(dirPage).toHaveURL(/\/tableau-de-bord$/);
      } finally {
        await dirContext.close();
      }
      const dirHeaders = await getApiAuthHeaders(request, directionUser.email, directionUser.password);
      const dirCuisineApi = await request.get('/api/cuisine/orders', { headers: dirHeaders });
      expect(dirCuisineApi.status()).toBe(403);

      // TEST 6d : CUISINIER arrive sur /cuisine avec barre latérale réduite (logo, Cuisine, nom, déconnexion)
      await cookPage.goto('/connexion');
      await cookPage.locator('#user-login').fill(cookUser.email);
      await cookPage.locator('#user-password').fill(cookUser.password);
      await cookPage.locator('#login-btn').click();
      await cookPage.waitForURL('**/cuisine', { timeout: 25000 });
      await expect(cookPage.locator('[data-testid="kitchen-board-page"]')).toBeVisible();
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

      await expect(cookPage.locator('[data-testid="kitchen-sync-indicator"]')).toContainText(
        'Temps réel actif',
        { timeout: 10000 },
      );

      // TEST 1 : L'assistant envoie 4 spaghettis, Chambre 301 : le cuisinier les voit en moins de 2 s
      await assistantPage.waitForTimeout(1600);
      const spagTile = assistantPage.locator('[data-product-name="Spaghetti Bolognaise"]').first();
      await expect(spagTile).toBeVisible();
      for (let i = 0; i < 4; i++) await spagTile.click();

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

      const firstRoomCard = assistantPage
        .locator('[data-testid^="pos-order-card-"]', { hasText: guestName })
        .first();
      await expect(firstRoomCard).toBeVisible({ timeout: 8000 });
      await expect(firstRoomCard).toContainText(`Chambre ${roomNumber}`);
      await expect(firstRoomCard).toContainText('4× Spaghetti Bolognaise');
      const orderId = (await firstRoomCard.getAttribute('data-testid'))!.replace(
        'pos-order-card-',
        '',
      );
      const orderCard = assistantPage.locator(`[data-testid="pos-order-card-${orderId}"]`);

      const cookPendingCard = cookPage
        .locator('[data-testid="kitchen-col-PENDING"]')
        .locator(`[data-testid="kitchen-card-${orderId}"]`);
      await expect(cookPendingCard).toBeVisible({ timeout: 2500 });
      await expect(cookPendingCard).toContainText(`Chambre ${roomNumber}`);
      await expect(cookPendingCard).toContainText('4×');
      await expect(cookPendingCard).toContainText('Spaghetti Bolognaise');
      await expect(cookPendingCard).not.toContainText('FCFA');
      await expect(cookPendingCard).not.toContainText('FluxE2E_');

      // Vérifier côté API que le JSON renvoyé au CUISINIER ne contient ni prix ni nom client
      const cookHeaders = await getApiAuthHeaders(request, cookUser.email, cookUser.password);
      const cookOrdersRes = await request.get('/api/cuisine/orders', { headers: cookHeaders });
      expect(cookOrdersRes.status()).toBe(200);
      const cookOrdersBody = await cookOrdersRes.json();
      const rawCookOrder = cookOrdersBody.find((o: any) => o.id === orderId);
      expect(rawCookOrder).toBeTruthy();
      expect(rawCookOrder.totalTtcFcfa).toBeUndefined();
      expect(rawCookOrder.guestName).toBeUndefined();
      expect(rawCookOrder.items[0].unitPriceFcfa).toBeUndefined();

      // TEST 2 : Le cuisinier touche « 15 min » -> l'assistant reçoit la notification persistante et la frise affiche l'heure de fin
      await cookPage.locator(`[data-testid="kitchen-prep-15-${orderId}"]`).click();
      const cookPrepCard = cookPage
        .locator('[data-testid="kitchen-col-IN_PREPARATION"]')
        .locator(`[data-testid="kitchen-card-${orderId}"]`);
      await expect(cookPrepCard).toBeVisible({ timeout: 8000 });

      await expect(
        assistantPage.locator('[data-testid="pos-assistant-notifications"]'),
      ).toContainText('Temps de préparation : 15 min', { timeout: 8000 });
      await expect(
        orderCard.locator(`[data-testid="card-event-${orderId}-TEMPS_PREPARATION"]`),
      ).toContainText('Temps de préparation : 15 min, prête vers');
      await expect(orderCard.locator(`[data-testid="card-status-${orderId}"]`)).toContainText(
        'En préparation',
      );

      // TEST 3 : Le cuisinier touche « +5 min » -> notification et heure de fin mises à jour
      await cookPage.locator(`[data-testid="kitchen-add5-${orderId}"]`).click();
      await expect(
        assistantPage.locator('[data-testid="pos-assistant-notifications"]'),
      ).toContainText('+5 min ajoutées', { timeout: 8000 });
      await expect(
        orderCard.locator(`[data-testid="card-event-${orderId}-TEMPS_AJOUTE"]`),
      ).toContainText('+5 min ajoutées : prête vers');

      await assistantPage.screenshot({
        path: path.join(compDir, 'actual_carte_info_frise_assistant.png'),
        fullPage: false,
      });

      // TEST 4 : Le cuisinier signale un plat indisponible sur une 2e commande -> notification + motif + boutons de modification
      await spagTile.click();
      await assistantPage.locator('[data-testid="dest-btn-TAKEAWAY"]').click();
      await assistantPage.locator('[data-testid="btn-send-kitchen"]').click();
      const firstTakeawayCard = assistantPage
        .locator('[data-testid^="pos-order-card-"]', { hasText: 'À emporter' })
        .first();
      await expect(firstTakeawayCard).toBeVisible({ timeout: 10000 });
      const unavailOrderId = (await firstTakeawayCard.getAttribute('data-testid'))!.replace(
        'pos-order-card-',
        '',
      );
      const unavailOrderCard = assistantPage.locator(
        `[data-testid="pos-order-card-${unavailOrderId}"]`,
      );

      const unavailCookCard = cookPage.locator(`[data-testid="kitchen-card-${unavailOrderId}"]`);
      await expect(unavailCookCard).toBeVisible({ timeout: 5000 });
      await unavailCookCard
        .locator(`[data-testid="kitchen-btn-unavailable-${unavailOrderId}"]`)
        .click();
      await unavailCookCard
        .locator(`[data-testid^="kitchen-unavail-check-${unavailOrderId}-"]`)
        .first()
        .check();
      await unavailCookCard
        .locator(`[data-testid="kitchen-unavail-reason-${unavailOrderId}"]`)
        .fill('plus de pâtes');
      await unavailCookCard
        .locator(`[data-testid="kitchen-unavail-submit-${unavailOrderId}"]`)
        .click();

      await expect(
        assistantPage.locator('[data-testid="pos-assistant-notifications"]'),
      ).toContainText('plus de pâtes', { timeout: 8000 });
      await expect(
        unavailOrderCard.locator(`[data-testid="card-event-${unavailOrderId}-PLAT_INDISPONIBLE"]`),
      ).toContainText('plus de pâtes');
      await expect(
        unavailOrderCard.locator(`[data-testid="btn-modify-order-${unavailOrderId}"]`),
      ).toBeVisible();
      await expect(
        unavailOrderCard.locator(`[data-testid="btn-card-cancel-order-${unavailOrderId}"]`),
      ).toBeVisible();

      // Annuler avec motif cette commande indisponible pour garder la démo propre
      await unavailOrderCard.locator(`[data-testid="btn-card-cancel-order-${unavailOrderId}"]`).click();
      await assistantPage.locator('[data-testid="cancel-reason-input"]').fill('Rupture pâtes confirmée');
      await assistantPage.locator('[data-testid="btn-confirm-cancel"]').click();

      // TEST 5 : Le cuisinier marque la commande principale Prête -> notification avec nom du client, carte verte, compteur sur le menu ; l'assistant clique « J'autorise le service » puis « Servie »
      await cookPage.locator(`[data-testid="kitchen-next-${orderId}"]`).click();
      const cookReadyCard = cookPage
        .locator('[data-testid="kitchen-col-READY"]')
        .locator(`[data-testid="kitchen-card-${orderId}"]`);
      await expect(cookReadyCard).toBeVisible({ timeout: 8000 });

      await expect(
        assistantPage.locator('[data-testid="pos-assistant-notifications"]'),
      ).toContainText(guestName, { timeout: 8000 });
      await expect(orderCard.locator(`[data-testid="card-status-${orderId}"]`)).toContainText(
        'Prête à servir',
      );
      await expect(assistantPage.locator('[data-testid="nav-restaurant-ready-badge"]')).toBeVisible();

      await cookPage.screenshot({
        path: path.join(compDir, 'actual_flux_cuisine_3_colonnes.png'),
        fullPage: false,
      });
      await assistantPage.screenshot({
        path: path.join(compDir, 'actual_flux_assistant_prets_a_servir_badge.png'),
        fullPage: false,
      });

      // Cliquer « J'autorise le service » -> le compteur rouge disparaît, puis « Servie »
      await orderCard.locator(`[data-testid="btn-authorize-service-${orderId}"]`).click();
      await expect(orderCard.locator(`[data-testid="card-status-${orderId}"]`)).toContainText(
        'Autorisée',
        { timeout: 8000 },
      );
      await orderCard.locator(`[data-testid="btn-card-serve-${orderId}"]`).click();
      await expect(orderCard.locator(`[data-testid="card-status-${orderId}"]`)).toContainText(
        'Servie',
        { timeout: 8000 },
      );
      await expect(
        orderCard.locator(`[data-testid="card-event-${orderId}-SERVIE"]`),
      ).toBeVisible();

      // Cliquer « Compris » sur les bandeaux de notification
      const dismissBtns = assistantPage.locator('[data-testid^="btn-notif-understood-"]');
      while ((await dismissBtns.count()) > 0) {
        await dismissBtns.first().click();
      }
      await expect(assistantPage.locator('[data-testid="pos-assistant-notifications"]')).toHaveCount(0);

      // TEST 7a : Transitions invalides (409) & Deux cuisiniers en concurrence (1 seul 200, second 409)
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

      // Transition invalide Envoyée -> Prête = 409
      const invalid409 = await request.patch(`/api/restaurant/orders/${concOrder.id}/status`, {
        headers: cookHeaders,
        data: { status: 'READY' },
      });
      expect(invalid409.status()).toBe(409);

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

      // TEST 7b : Coupure puis reprise du flux SSE
      await cookContext.setOffline(true);
      await cookPage.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(cookPage.locator('[data-testid="kitchen-sync-indicator"]')).toContainText(
        'Connexion perdue',
        { timeout: 5000 },
      );
      await cookContext.setOffline(false);
      await cookPage.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(cookPage.locator('[data-testid="kitchen-sync-indicator"]')).toContainText(
        'Temps réel actif',
        { timeout: 10000 },
      );

      // TEST 7c : Hors ligne chez l'assistant -> « En attente de synchronisation, la cuisine ne l'a pas encore reçue »
      await assistantContext.setOffline(true);
      await assistantPage.evaluate(() => window.dispatchEvent(new Event('offline')));
      await expect(assistantPage.locator('[data-testid="pos-offline-banner"]')).toBeVisible();

      await spagTile.click();
      await assistantPage.locator('[data-testid="dest-btn-TAKEAWAY"]').click();
      await assistantPage.locator('[data-testid="btn-send-kitchen"]').click();

      const offlineCardStatus = assistantPage.locator('[data-testid^="card-status-"]').first();
      await expect(offlineCardStatus).toContainText(
        "En attente de synchronisation, la cuisine ne l'a pas encore reçue",
      );

      await assistantContext.setOffline(false);
      await assistantPage.evaluate(() => window.dispatchEvent(new Event('online')));
      await expect(assistantPage.locator('[data-testid="pos-offline-pending-badge"]')).toHaveCount(0, {
        timeout: 12000,
      });

      // TEST 7d : Aucun scroll horizontal aux 4 largeurs (360, 768, 1024, 1440 px) sur /restaurant et /cuisine
      for (const w of [360, 768, 1024, 1440]) {
        await assistantPage.setViewportSize({ width: w, height: 800 });
        await cookPage.setViewportSize({ width: w, height: 800 });
        await assistantPage.waitForTimeout(100);
        const ovAss = await assistantPage.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        const ovCook = await cookPage.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(ovAss.sw, `Overflow sur /restaurant à ${w}px`).toBeLessThanOrEqual(ovAss.cw);
        expect(ovCook.sw, `Overflow sur /cuisine à ${w}px`).toBeLessThanOrEqual(ovCook.cw);
      }
    } finally {
      await assistantContext.close();
      await cookContext.close();
    }
  });
});
