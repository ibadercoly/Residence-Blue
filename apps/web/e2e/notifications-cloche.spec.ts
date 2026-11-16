import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

function cleanupNotifE2eData(): void {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const guests = await p.guest.findMany({
        where: { lastName: { startsWith: 'ClocheE2E_' } },
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
            { ticketNumber: { startsWith: '#CMD-CLO-' } },
            ...(rIds.length ? [{ reservationId: { in: rIds } }] : []),
          ],
        },
        select: { id: true, invoiceId: true },
      });
      const oIds = orders.map((o) => o.id);
      const ordInvIds = orders.map((o) => o.invoiceId).filter(Boolean);

      if (oIds.length) {
        await p.notificationMessage.deleteMany({ where: { orderId: { in: oIds } } });
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

function seedRoomAndProducts(): { roomNumber: string; guestName: string } {
  let roomNumber = '301';
  let guestName = 'M. Diop';
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
      const last = 'ClocheE2E_' + Date.now();
      const full = 'M. Diop ' + last;
      const guest = await p.guest.create({
        data: {
          civility: 'M.',
          firstName: 'Ibrahima',
          lastName: last,
          fullName: full,
          phone: '+221771112233',
        },
      });
      await p.reservation.create({
        data: {
          reference: 'RES-CLO-' + Date.now(),
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
      for (const prod of [
        { name: 'Thiéboudienne royale', priceFcfa: 4500, desc: 'Riz au poisson royal' },
        { name: 'Omelette nature', priceFcfa: 2000, desc: 'Omelette maison' },
      ]) {
        const existing = await p.restaurantProduct.findUnique({ where: { name: prod.name } });
        if (!existing) {
          await p.restaurantProduct.create({
            data: {
              name: prod.name,
              description: prod.desc,
              categoryId: cat.id,
              priceFcfa: prod.priceFcfa,
              prepTimeMinutes: 15,
              prepStation: 'CUISINE',
              status: 'AVAILABLE',
            },
          });
        }
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

async function selectOrderInCookScreen(
  cookPage: Page,
  orderId: string,
  expectedDestSubstring: string,
): Promise<void> {
  const queueCard = cookPage.getByTestId(`cuisine-queue-card-${orderId}`);
  const viewNewBtn = cookPage.getByTestId('cuisine-new-order-view-btn');

  await expect(async () => {
    const hasQueueCard = (await queueCard.count()) > 0 && (await queueCard.isVisible());
    if (hasQueueCard) {
      await queueCard.click();
    } else if ((await viewNewBtn.count()) > 0 && (await viewNewBtn.isVisible())) {
      await viewNewBtn.click();
    }
    await expect(cookPage.getByTestId('cuisine-active-destination')).toContainText(
      expectedDestSubstring,
      { timeout: 1000 },
    );
  }).toPass({ timeout: 12000 });
}

test.describe('Notifications dans la cloche (deux navigateurs, temps réel, accessibilité & responsive)', () => {
  let assistantUser = { email: '', password: '' };
  let cookUser = { email: '', password: '' };
  let roomNumber = '301';
  let guestName = 'M. Diop';

  test.beforeAll(() => {
    fs.mkdirSync(compDir, { recursive: true });
    cleanupNotifE2eData();
    assistantUser = createE2eUser('RESTAURANT');
    cookUser = createE2eUser('CUISINIER');
    const seeded = seedRoomAndProducts();
    roomNumber = seeded.roomNumber;
    guestName = seeded.guestName;
  });

  test.afterAll(() => {
    cleanupNotifE2eData();
    deleteE2eUsers([assistantUser.email, cookUser.email]);
  });

  test('flux complet cloche, 9+, alertes 8s + son, sync 2 appareils, passing sans nom, cuisine isolée et responsive', async ({
    browser,
    request,
  }) => {
    test.setTimeout(240000);

    const assistantCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const device2Ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const cookCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

    const assistantPage = await assistantCtx.newPage();
    const device2Page = await device2Ctx.newPage();
    const cookPage = await cookCtx.newPage();

    try {
      const assistantHeaders = await getApiAuthHeaders(
        request,
        assistantUser.email,
        assistantUser.password,
      );
      const cookHeaders = await getApiAuthHeaders(request, cookUser.email, cookUser.password);

      // 0. Sécurité : le cuisinier ne reçoit rien dans la cloche (403 sur API)
      const cookNotifRes = await request.get('/api/notifications', { headers: cookHeaders });
      expect(cookNotifRes.status()).toBe(403);

      // Connecter Assistant (Navigateur 1), Device 2 (Navigateur 2 même compte), Cuisinier (Navigateur 3)
      await loginViaUi(assistantPage, assistantUser.email, assistantUser.password);
      const streamPromise1 = assistantPage.waitForResponse(
        (r) => r.url().includes('/api/notifications/stream') && r.status() === 200,
        { timeout: 15000 },
      );
      await assistantPage.goto('/restaurant', { waitUntil: 'domcontentloaded' });
      await expect(assistantPage.getByTestId('restaurant-pos-page')).toBeVisible({ timeout: 15000 });
      await streamPromise1;

      await loginViaUi(device2Page, assistantUser.email, assistantUser.password);
      const streamPromise2 = device2Page.waitForResponse(
        (r) => r.url().includes('/api/notifications/stream') && r.status() === 200,
        { timeout: 15000 },
      );
      await device2Page.goto('/restaurant', { waitUntil: 'domcontentloaded' });
      await expect(device2Page.getByTestId('restaurant-pos-page')).toBeVisible({ timeout: 15000 });
      await streamPromise2;

      // Remettre le compteur à 0 pour ce compte avant les actions
      await request.post('/api/notifications/read-all', { headers: assistantHeaders });
      await assistantPage.reload({ waitUntil: 'domcontentloaded' });
      await device2Page.reload({ waitUntil: 'domcontentloaded' });
      await expect(assistantPage.getByTestId('header-notifications-btn')).toBeVisible({
        timeout: 10000,
      });
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveCount(0);

      // Capture cloche fermée + page Restaurant sans aucun bandeau
      await expect(assistantPage.locator('[data-testid="pos-assistant-notifications"]')).toHaveCount(0);
      await assistantPage.screenshot({
        path: path.join(compDir, 'notifications-cloche-fermee.png'),
        fullPage: false,
      });
      await assistantPage.screenshot({
        path: path.join(compDir, 'restaurant-sans-bandeaux.png'),
        fullPage: false,
      });

      // Cuisinier se connecte sur /cuisine (sans cloche)
      await cookPage.goto('/connexion');
      await cookPage.locator('#user-login').fill(cookUser.email);
      await cookPage.locator('#user-password').fill(cookUser.password);
      await cookPage.locator('#login-btn').click();
      await cookPage.waitForURL('**/cuisine', { timeout: 25000 });
      await expect(cookPage.getByTestId('cuisine-ecran-root')).toBeVisible({ timeout: 15000 });
      await expect(cookPage.getByTestId('header-notifications-btn')).toHaveCount(0);

      // 1. Créer une commande CHAMBRE via API pour Chambre 301 (Thiéboudienne royale)
      const orderRoomRes = await request.post('/api/restaurant/orders', {
        headers: assistantHeaders,
        data: {
          ticketNumber: `#CMD-CLO-R-${Date.now().toString().slice(-4)}`,
          destinationType: 'ROOM',
          roomNumber,
          items: [{ name: 'Thiéboudienne royale', quantity: 1, unitPriceFcfa: 4500 }],
        },
      });
      expect(orderRoomRes.status()).toBe(201);
      const roomOrder = await orderRoomRes.json();

      // Le cuisinier sélectionne la commande et accepte avec 15 min
      await selectOrderInCookScreen(cookPage, roomOrder.id, `Chambre ${roomNumber}`);
      await cookPage.getByTestId('cuisine-btn-all-available').click();
      await cookPage.getByTestId('cuisine-prep-15').click();

      // Pastille = 1, aucun bandeau sur /restaurant, aucune popup importante (silencieuse)
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveText('1', {
        timeout: 8000,
      });
      await expect(assistantPage.locator('[data-testid="pos-assistant-notifications"]')).toHaveCount(0);
      await expect(assistantPage.getByTestId('header-important-alert')).toHaveCount(0);

      // Ouvrir la cloche et vérifier : 1 seul message avec nom du plat + heure, sans "tous les plats existent", sans prix
      await assistantPage.getByTestId('header-notifications-btn').click();
      const dropdown = assistantPage.getByTestId('header-notifications-dropdown');
      await expect(dropdown).toBeVisible();
      await expect(dropdown).toContainText('La cuisine prépare 1 Thiéboudienne royale');
      await expect(dropdown).toContainText('(dans 15 min)');
      await expect(dropdown).toContainText(`Chambre ${roomNumber}`);
      await expect(dropdown).toContainText(guestName);
      await expect(dropdown).not.toContainText('tous les plats existent');
      await expect(dropdown).not.toContainText('FCFA');
      await expect(dropdown).not.toContainText('4 500');

      // Activer le son via l'interrupteur dans la cloche (interagit avec la page et active le son)
      const soundBtn = assistantPage.getByTestId('notifications-sound-toggle');
      await expect(soundBtn).toHaveAttribute('aria-checked', 'false');
      await soundBtn.click();
      await expect(soundBtn).toHaveAttribute('aria-checked', 'true');

      // Fermer la cloche avec la touche Échap
      await assistantPage.keyboard.press('Escape');
      await expect(dropdown).toHaveCount(0);

      // 2. Le cuisinier clique « +5 min » -> message « Du temps en plus » (pastille = 2, silencieux)
      await cookPage.getByTestId('cuisine-btn-plus-5').click();
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveText('2', {
        timeout: 8000,
      });
      await expect(assistantPage.getByTestId('header-important-alert')).toHaveCount(0);

      // 3. Le cuisinier marque la commande Chambre Prête -> alerte importante Prête à servir + son (pastille = 3)
      await cookPage.getByTestId('cuisine-btn-mark-ready').click();
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveText('3', {
        timeout: 8000,
      });
      const readyPopup = assistantPage.getByTestId('header-important-alert');
      await expect(readyPopup).toBeVisible({ timeout: 8000 });
      await expect(readyPopup).toContainText('Prête à servir : 1 Thiéboudienne royale');
      await expect(readyPopup).toContainText(`Chambre ${roomNumber}`);
      const soundCountAfterReady = Number(
        (await readyPopup.getAttribute('data-sound-played-count')) || '0',
      );
      expect(soundCountAfterReady).toBeGreaterThanOrEqual(1);
      await assistantPage.getByTestId('header-important-alert-close').click();
      await expect(readyPopup).toHaveCount(0);

      // 4. Commande Table 4 (client de passage) -> le cuisinier signale Plat manquant avec motif (pastille = 4)
      const orderTableRes = await request.post('/api/restaurant/orders', {
        headers: assistantHeaders,
        data: {
          ticketNumber: `#CMD-CLO-T-${Date.now().toString().slice(-4)}`,
          destinationType: 'TABLE',
          tableLabel: 'Table 4',
          items: [{ name: 'Omelette nature', quantity: 1, unitPriceFcfa: 2000 }],
        },
      });
      expect(orderTableRes.status()).toBe(201);
      const tableOrder = await orderTableRes.json();

      await selectOrderInCookScreen(cookPage, tableOrder.id, 'Table 4');
      await cookPage.getByTestId('cuisine-btn-missing-dish').click();
      await cookPage.locator('[data-testid^="cuisine-missing-line-"]').first().click();
      await cookPage.getByTestId('cuisine-missing-reason-Autre').click();
      await cookPage.getByTestId('cuisine-missing-custom-input').fill("plus d'œufs");
      await cookPage.getByTestId('cuisine-missing-submit').click();

      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveText('4', {
        timeout: 8000,
      });
      const missingPopup = assistantPage.getByTestId('header-important-alert');
      await expect(missingPopup).toBeVisible({ timeout: 8000 });
      await expect(missingPopup).toContainText('Plat manquant : Omelette nature');
      await expect(missingPopup).toContainText("plus d'œufs");
      await expect(missingPopup).toContainText('Table 4');
      await expect(missingPopup).not.toContainText('Client de passage');
      await expect(missingPopup).not.toContainText('FCFA');
      await assistantPage.getByTestId('header-important-alert-close').click();

      // 5. Commande À emporter N° CLO-12 -> aucune mention de nom de client (pastille = 5)
      const takeawayRes = await request.post('/api/restaurant/orders', {
        headers: assistantHeaders,
        data: {
          ticketNumber: '#CMD-CLO-12',
          destinationType: 'TAKEAWAY',
          items: [{ name: 'Thiéboudienne royale', quantity: 2, unitPriceFcfa: 4500 }],
        },
      });
      expect(takeawayRes.status()).toBe(201);
      const takeawayOrder = await takeawayRes.json();

      await selectOrderInCookScreen(cookPage, takeawayOrder.id, 'À emporter');
      await cookPage.getByTestId('cuisine-btn-all-available').click();
      await cookPage.getByTestId('cuisine-prep-10').click();
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveText('5', {
        timeout: 8000,
      });

      // Ouvrir le panneau : vérifier les groupes, le texte complet + À emporter N° CLO-12 + Du temps en plus + Prête
      await assistantPage.getByTestId('header-notifications-btn').click();
      await expect(dropdown).toBeVisible();
      await expect(dropdown.getByTestId('notifications-group-new')).toBeVisible();
      await expect(dropdown).toContainText('Du temps en plus : 1 Thiéboudienne royale');
      await expect(dropdown).toContainText('À emporter N° CLO-12');
      await expect(dropdown).not.toContainText('Client de passage');
      await expect(dropdown).not.toContainText('FCFA');

      // Capture cloche ouverte
      await assistantPage.screenshot({
        path: path.join(compDir, 'notifications-cloche-ouverte.png'),
        fullPage: false,
      });
      await assistantPage.getByTestId('notifications-close-btn').click();

      // 6. Cliquer sur la carte « Prête à servir » : la marque lue sur Appareil 1 ET Appareil 2, et met la commande en évidence sur /restaurant
      await assistantPage.goto('/planning', { waitUntil: 'domcontentloaded' });
      await assistantPage.getByTestId('header-notifications-btn').click();
      const readyCard = assistantPage
        .locator('[data-testid^="notification-card-"][data-notification-type="PRETE"]')
        .first();
      await expect(readyCard).toBeVisible();
      await readyCard.click();

      await assistantPage.waitForURL(new RegExp(`/restaurant\\?highlightOrder=${roomOrder.id}`), {
        timeout: 10000,
      });
      const highlightedRow = assistantPage.getByTestId(`service-order-row-${roomOrder.id}`);
      await expect(highlightedRow).toBeVisible({ timeout: 10000 });
      await expect(highlightedRow).toHaveAttribute('data-highlighted', 'true');

      // Vérifier la synchro multi-appareils : Appareil 2 passe de 5 à 4 sans recharger
      await expect(device2Page.getByTestId('header-notifications-badge')).toHaveText('4', {
        timeout: 8000,
      });
      await device2Page.getByTestId('header-notifications-btn').click();
      await expect(device2Page.getByTestId('notifications-group-older')).toBeVisible();
      await device2Page.getByTestId('notifications-close-btn').click();

      // 7. Tester « 9+ » quand > 9 messages non lus + « Tout marquer comme lu » remet à 0 partout
      for (let i = 0; i < 6; i++) {
        const res = await request.post('/api/restaurant/orders', {
          headers: assistantHeaders,
          data: {
            ticketNumber: `#CMD-CLO-9P-${i}-${Date.now().toString().slice(-3)}`,
            destinationType: 'TABLE',
            tableLabel: `Table ${i + 1}`,
            items: [{ name: 'Omelette nature', quantity: 1, unitPriceFcfa: 2000 }],
          },
        });
        const ord = await res.json();
        await request.patch(`/api/restaurant/orders/${ord.id}/status`, {
          headers: cookHeaders,
          data: { status: 'IN_PREPARATION', tempsPreparationMinutes: 10 },
        });
      }
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveText('9+', {
        timeout: 10000,
      });

      await assistantPage.getByTestId('header-notifications-btn').click();
      await assistantPage.getByTestId('notifications-mark-read-btn').click();
      await expect(assistantPage.getByTestId('header-notifications-badge')).toHaveCount(0, {
        timeout: 8000,
      });
      await expect(device2Page.getByTestId('header-notifications-badge')).toHaveCount(0, {
        timeout: 8000,
      });
      await assistantPage.getByTestId('notifications-close-btn').click();

      // 8. Responsive & non-coupure du panneau à 360, 768, 1024 et 1440 px
      for (const width of [360, 768, 1024, 1440]) {
        await assistantPage.setViewportSize({ width, height: 800 });
        await assistantPage.waitForTimeout(150);

        const docOverflowClosed = await assistantPage.evaluate(() => ({
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
        }));
        expect(docOverflowClosed.scrollW).toBeLessThanOrEqual(docOverflowClosed.clientW);

        const bellTestId = width < 768 ? 'header-notifications-mobile-btn' : 'header-notifications-btn';
        await assistantPage.getByTestId(bellTestId).click();
        const panel = assistantPage.getByTestId('header-notifications-dropdown');
        await expect(panel).toBeVisible();

        const metrics = await panel.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const scroller = el.querySelector('[data-testid="notifications-scroll-list"]') as HTMLElement | null;
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            vw: window.innerWidth,
            vh: window.innerHeight,
            docScrollW: document.documentElement.scrollWidth,
            docClientW: document.documentElement.clientWidth,
            listScrollW: scroller ? scroller.scrollWidth : 0,
            listClientW: scroller ? scroller.clientWidth : 0,
          };
        });
        expect(metrics.left).toBeGreaterThanOrEqual(0);
        expect(metrics.top).toBeGreaterThanOrEqual(0);
        expect(metrics.right).toBeLessThanOrEqual(metrics.vw + 1);
        expect(metrics.bottom).toBeLessThanOrEqual(metrics.vh + 1);
        expect(metrics.docScrollW).toBeLessThanOrEqual(metrics.docClientW);
        expect(metrics.listScrollW).toBeLessThanOrEqual(metrics.listClientW + 1);

        if (width < 600) {
          expect(metrics.width).toBeGreaterThanOrEqual(width - 2);
        } else {
          expect(metrics.width).toBeCloseTo(420, -1);
        }

        await assistantPage.getByTestId('notifications-close-btn').click();
        await expect(panel).toHaveCount(0);
      }
    } finally {
      await assistantCtx.close();
      await device2Ctx.close();
      await cookCtx.close();
    }
  });
});
