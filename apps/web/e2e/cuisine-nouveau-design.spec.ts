import { test, expect, APIRequestContext } from '@playwright/test';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders } from './auth-e2e.helper';

const COMP_DIR = path.resolve(__dirname, '../../../docs/design/comparaisons');

async function loginCookUi(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/connexion', { waitUntil: 'domcontentloaded' });
  await page.locator('#user-login').fill(email);
  await page.locator('#user-password').fill(password);
  await page.locator('#login-btn').click();
  await page.waitForURL('**/cuisine', { timeout: 25000 });
}

test.describe('Cuisine — Nouveau design tablette sans défilement', () => {
  const createdOrderIds: string[] = [];
  const createdEmails: string[] = [];
  let dirHeaders: Record<string, string> = {};
  let cookUser = { email: '', password: '' };
  let dish = { id: '', name: 'Spaghetti Bolognaise', priceFcfa: 4500, prepStation: 'CUISINE' };
  let inStayRoom: { roomId: string; roomNumber: string; reservationId: string } | null = null;
  let fallbackRoom = { id: '', number: '301' };

  test.beforeAll(async ({ request }) => {
    const dirUser = createE2eUser('DIRECTION');
    cookUser = createE2eUser('CUISINIER');
    createdEmails.push(dirUser.email, cookUser.email);

    dirHeaders = await getApiAuthHeaders(request, dirUser.email, dirUser.password);

    const dishesRes = await request.get('/api/restaurant/catalog', { headers: dirHeaders });
    expect(dishesRes.ok()).toBeTruthy();
    const menu = (await dishesRes.json()) as {
      products: Array<{
        id: string;
        name: string;
        priceFcfa: number;
        prepStation: string;
        availability: string;
      }>;
      roomsInStay: Array<{ roomId: string; roomNumber: string; reservationId: string }>;
    };
    const picked = menu.products.find((d) => d.availability === 'AVAILABLE') ?? menu.products[0];
    dish = {
      id: picked.id,
      name: picked.name,
      priceFcfa: picked.priceFcfa,
      prepStation: picked.prepStation || 'CUISINE',
    };

    if (menu.roomsInStay.length > 0) {
      inStayRoom = menu.roomsInStay[0];
    } else {
      const roomsRes = await request.get('/api/rooms', { headers: dirHeaders });
      expect(roomsRes.ok()).toBeTruthy();
      const rooms = (await roomsRes.json()) as Array<{ id: string; number: string }>;
      const r = rooms.find((x) => x.number === '301') ?? rooms[0];
      fallbackRoom = { id: r.id, number: r.number };
    }
  });

  test.afterAll(async ({ request }) => {
    for (const id of createdOrderIds) {
      await request
        .patch(`/api/restaurant/orders/${id}/cancel`, {
          headers: dirHeaders,
          data: { reason: 'Nettoyage E2E cuisine-nouveau-design' },
        })
        .catch(() => {});
    }
    if (createdEmails.length > 0) {
      deleteE2eUsers(createdEmails);
    }
  });

  async function createOrder(
    request: APIRequestContext,
    destinationType: 'ROOM' | 'TABLE' | 'TAKEAWAY',
    seq: number,
  ): Promise<string> {
    const ticketNumber = `#CMD-E2E-${Date.now()}-${seq}`;
    const roomPayload = inStayRoom
      ? {
          roomId: inStayRoom.roomId,
          roomNumber: inStayRoom.roomNumber,
          reservationId: inStayRoom.reservationId,
        }
      : { roomId: fallbackRoom.id, roomNumber: fallbackRoom.number };

    const res = await request.post('/api/restaurant/orders', {
      headers: {
        ...dirHeaders,
        'Idempotency-Key': `e2e-cuisine-design-${Date.now()}-${seq}`,
      },
      data: {
        ticketNumber,
        destinationType,
        action: 'SEND_TO_KITCHEN',
        ...(destinationType === 'ROOM' ? roomPayload : {}),
        ...(destinationType === 'TABLE' ? { tableLabel: 'Table 4' } : {}),
        items: [
          {
            productId: dish.id,
            name: dish.name,
            quantity: 2,
            unitPriceFcfa: dish.priceFcfa,
            notes: 'Sans piment',
            prepStation: dish.prepStation,
          },
        ],
      },
    });
    expect(res.ok()).toBeTruthy();
    const order = (await res.json()) as { id: string };
    createdOrderIds.push(order.id);
    return order.id;
  }

  test('affiche 3 états, 0 défilement à 1280x800, 1024x768, 800x1280, max 3 cartes + overflow, aucune donnée sensible', async ({
    page,
    request,
  }) => {
    // Créer 5 commandes pour tester le plafond à 3 cartes + "+ N autres commandes"
    const order1 = await createOrder(request, 'ROOM', 1);
    await createOrder(request, 'TABLE', 2);
    await createOrder(request, 'TAKEAWAY', 3);
    await createOrder(request, 'ROOM', 4);
    await createOrder(request, 'TABLE', 5);

    await page.setViewportSize({ width: 1280, height: 800 });
    await loginCookUi(page, cookUser.email, cookUser.password);

    // Vérifier API kitchen/orders sans prix ni nom client
    const cookHeaders = await getApiAuthHeaders(request, cookUser.email, cookUser.password);
    const kitchenApiRes = await request.get('/api/restaurant/kitchen/orders', {
      headers: cookHeaders,
    });
    expect(kitchenApiRes.ok()).toBeTruthy();
    const kitchenJson = await kitchenApiRes.text();
    expect(kitchenJson).not.toContain('totalTtcFcfa');
    expect(kitchenJson).not.toContain('unitPriceFcfa');
    expect(kitchenJson).not.toContain('guestName');

    // Barre du haut, aucun lien vers /restaurant, filtres, horloge, En direct, Son
    await expect(page.locator('[data-testid="cuisine-topbar"]')).toBeVisible();
    await expect(page.locator('[data-testid="cuisine-clock"]')).toBeVisible();
    await expect(page.locator('[data-testid="cuisine-sse-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="cuisine-sound-toggle"]')).toBeVisible();
    await expect(page.locator('[data-testid="cuisine-ecran-root"] a[href="/restaurant"]')).toHaveCount(0);

    // Colonne gauche : max 3 cartes + "+ N autres commandes"
    const queueCards = page.locator('[data-testid^="cuisine-queue-card-"]');
    await expect(queueCards).toHaveCount(3);
    await expect(page.locator('[data-testid="cuisine-queue-overflow"]')).toBeVisible();

    // Zéro défilement à 1280x800
    const noScroll1280 = await page.evaluate(() => ({
      v: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      h: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }));
    expect(noScroll1280).toEqual({ v: true, h: true });

    // Zéro prix affiché
    const rootText = await page.locator('[data-testid="cuisine-ecran-root"]').innerText();
    expect(rootText).not.toContain('FCFA');

    // État 1 : À accepter
    const card1 = page.locator(`[data-testid="cuisine-queue-card-${order1}"]`);
    if (await card1.isVisible()) {
      await card1.click();
    }
    await expect(page.locator('[data-testid="cuisine-btn-all-available"]')).toBeVisible();
    await expect(page.locator('[data-testid="cuisine-btn-missing-dish"]')).toBeVisible();
    await page.screenshot({
      path: path.join(COMP_DIR, 'actual_cuisine_a_accepter.png'),
      fullPage: false,
    });

    // Toucher "Oui, tout est là" -> vérifier boutons de durée sans débordement -> "15 min" -> En préparation
    await page.locator('[data-testid="cuisine-btn-all-available"]').click();
    const prepOverflow = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('[data-testid^="cuisine-prep-"]'));
      return btns.every((b) => b.scrollWidth <= b.clientWidth + 1);
    });
    expect(prepOverflow).toBe(true);
    await page.screenshot({
      path: path.join(COMP_DIR, 'actual_cuisine_durees.png'),
      fullPage: false,
    });
    await page.locator('[data-testid="cuisine-prep-15"]').click();
    await expect(page.locator('[data-testid="cuisine-countdown-box"]')).toBeVisible({ timeout: 8000 });
    await page.screenshot({
      path: path.join(COMP_DIR, 'actual_cuisine_en_preparation.png'),
      fullPage: false,
    });

    // "+5 min" puis "Marquer prête"
    await page.locator('[data-testid="cuisine-btn-plus-5"]').click();
    await page.locator('[data-testid="cuisine-btn-mark-ready"]').click();
    await expect(page.locator('[data-testid="cuisine-ready-banner"]')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('[data-testid="cuisine-ready-banner"]')).toContainText('Prête, en attente de service');
    await expect(page.locator('button:has-text("Servie")')).toHaveCount(0);
    await page.screenshot({
      path: path.join(COMP_DIR, 'actual_cuisine_prete.png'),
      fullPage: false,
    });

    // Vérifier 0 défilement à 1024x768
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(150);
    const noScroll1024 = await page.evaluate(() => ({
      v: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      h: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }));
    expect(noScroll1024).toEqual({ v: true, h: true });

    // Vérifier 0 défilement en portrait 800x1280
    await page.setViewportSize({ width: 800, height: 1280 });
    await page.waitForTimeout(150);
    const noScroll800 = await page.evaluate(() => ({
      v: document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      h: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    }));
    expect(noScroll800).toEqual({ v: true, h: true });
  });
});
