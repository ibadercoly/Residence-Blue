import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const CAPTURES_DIR = path.resolve(__dirname, '../../../docs/design/captures/cuisine-reservee');

test.describe('Cuisine strictement réservée au Cuisinier (UI, API, SSE & Administration)', () => {
  const createdEmails: string[] = [];
  const createdOrderIds: string[] = [];
  let dirUser = { email: '', password: '' };
  let recUser = { email: '', password: '' };
  let restoUser = { email: '', password: '' };
  let comptaUser = { email: '', password: '' };
  let hkUser = { email: '', password: '' };
  let techUser = { email: '', password: '' };
  let cookUser = { email: '', password: '' };
  let dirHeaders: Record<string, string> = {};
  let restoHeaders: Record<string, string> = {};
  let cookHeaders: Record<string, string> = {};
  let probeOrderId = '';

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });

    dirUser = createE2eUser('DIRECTION');
    recUser = createE2eUser('RECEPTION');
    restoUser = createE2eUser('RESTAURANT');
    comptaUser = createE2eUser('COMPTABLE');
    hkUser = createE2eUser('HOUSEKEEPING');
    techUser = createE2eUser('MAINTENANCE');
    cookUser = createE2eUser('CUISINIER');
    createdEmails.push(
      dirUser.email,
      recUser.email,
      restoUser.email,
      comptaUser.email,
      hkUser.email,
      techUser.email,
      cookUser.email,
    );

    dirHeaders = await getApiAuthHeaders(request, dirUser.email, dirUser.password);
    restoHeaders = await getApiAuthHeaders(request, restoUser.email, restoUser.password);
    cookHeaders = await getApiAuthHeaders(request, cookUser.email, cookUser.password);

    const catRes = await request.get('/api/restaurant/catalog', { headers: restoHeaders });
    expect(catRes.status()).toBe(200);
    const cat = await catRes.json();
    const dish = cat.products[0];
    const ordRes = await request.post('/api/restaurant/orders', {
      headers: restoHeaders,
      data: {
        destinationType: 'TABLE',
        tableLabel: 'Table Cuisine Secu',
        items: [{ productId: dish.id, quantity: 1 }],
      },
    });
    expect(ordRes.status()).toBe(201);
    const ordBody = await ordRes.json();
    probeOrderId = ordBody.id;
    createdOrderIds.push(probeOrderId);
  });

  test.afterAll(async ({ request }) => {
    // Réactiver d'éventuels comptes cuisiniers de seed avant suppression des éphémères
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      (async () => {
        const p = new PrismaClient();
        await p.user.updateMany({
          where: { role: { in: ['CUISINIER', 'CUISINE'] }, deletedAt: null },
          data: { isActive: true },
        });
        await p.$disconnect();
      })();
    `);
    for (const id of createdOrderIds) {
      await request
        .post(`/api/restaurant/orders/${id}/cancel`, {
          headers: dirHeaders,
          data: { reason: 'Nettoyage E2E cuisine-reservee-cuisinier' },
        })
        .catch(() => {});
    }
    deleteE2eUsers(createdEmails);
  });

  test('refuse Cuisine à tous les non-cuisiniers (UI + API + SSE) et verrouille Cuisinier sur /cuisine sans fuite', async ({
    browser,
    request,
  }) => {
    test.setTimeout(180000);

    const nonCookCases = [
      { label: 'DIRECTION', user: dirUser, expectedRedirect: /\/tableau-de-bord$/ },
      { label: 'RECEPTION', user: recUser, expectedRedirect: /\/tableau-de-bord$/ },
      { label: 'RESTAURANT', user: restoUser, expectedRedirect: /\/(tableau-de-bord|restaurant)$/ },
      { label: 'COMPTABLE', user: comptaUser, expectedRedirect: /\/(tableau-de-bord|accueil|facturation)$/ },
      { label: 'HOUSEKEEPING', user: hkUser, expectedRedirect: /\/chambres$/ },
      { label: 'MAINTENANCE', user: techUser, expectedRedirect: /\/(tableau-de-bord|chambres)$/ },
    ];

    for (const nc of nonCookCases) {
      const headers = await getApiAuthHeaders(request, nc.user.email, nc.user.password);

      // 1) Appels API directs refusés en 403 avec le message dédié
      for (const apiPath of [
        '/api/cuisine/orders',
        '/api/cuisine/stream',
        '/api/restaurant/kitchen/orders',
      ]) {
        const res = await request.get(apiPath, { headers });
        expect(res.status(), `${nc.label} sur ${apiPath}`).toBe(403);
        const body = await res.json().catch(() => ({}));
        expect(String(body?.message || '')).toContain('Cet écran est réservé au cuisinier');
      }

      const prepDenied = await request.patch(`/api/restaurant/orders/${probeOrderId}/status`, {
        headers,
        data: { status: 'IN_PREPARATION', prepTimeMinutes: 15 },
      });
      expect(prepDenied.status(), `${nc.label} IN_PREPARATION`).toBe(403);

      // 2) UI : pas d'entrée Cuisine et /cuisine redirige hors de /cuisine
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      try {
        const p = await ctx.newPage();
        await p.goto('/connexion');
        await p.locator('#user-login').fill(nc.user.email);
        await p.locator('#user-password').fill(nc.user.password);
        await p.locator('#login-btn').click();
        await expect(p).not.toHaveURL(/\/connexion/, { timeout: 25000 });
        await expect(p.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);
        await expect(p.locator('[data-testid="nav-cuisine-pending-badge"]')).toHaveCount(0);

        if (nc.label === 'DIRECTION') {
          await p.locator('[data-testid="app-sidebar-aside"]').screenshot({
            path: path.join(CAPTURES_DIR, 'sidebar-direction.png'),
          });
        }

        await p.goto('/cuisine', { waitUntil: 'domcontentloaded' });
        await expect(p).not.toHaveURL(/\/cuisine$/, { timeout: 10000 });
        await expect(p).toHaveURL(nc.expectedRedirect);
      } finally {
        await ctx.close();
      }
    }

    // 3) Compte CUISINIER : /cuisine uniquement, aucune fuite de prix/client, responsive + capture barre latérale
    const cookCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const cookPage = await cookCtx.newPage();
      await cookPage.goto('/connexion');
      await cookPage.locator('#user-login').fill(cookUser.email);
      await cookPage.locator('#user-password').fill(cookUser.password);
      await cookPage.locator('#login-btn').click();
      await expect(cookPage).toHaveURL(/\/cuisine$/, { timeout: 25000 });
      await expect(cookPage.locator('[data-testid="cuisine-ecran-root"]')).toBeVisible();

      // Barre latérale réduite (logo, Cuisine, nom, déconnexion) + aucun lien Prise de commande
      await expect(cookPage.locator('[data-testid="sidebar-nav"] a')).toHaveCount(1);
      await expect(cookPage.locator('[data-testid="nav-cuisine"]')).toBeVisible();
      await expect(cookPage.locator('[data-testid="sidebar-cook-name"]')).toBeVisible();
      await expect(cookPage.locator('[data-testid="sidebar-cook-logout-btn"]')).toBeVisible();
      const bodyText = await cookPage.locator('[data-testid="cuisine-ecran-root"]').innerText();
      expect(bodyText).not.toContain('Prise de commande');
      expect(bodyText).not.toContain('FCFA');

      await cookPage.locator('[data-testid="app-sidebar-aside"]').screenshot({
        path: path.join(CAPTURES_DIR, 'sidebar-cuisinier.png'),
      });

      // Toute autre adresse redirige vers /cuisine
      for (const otherUrl of [
        '/tableau-de-bord',
        '/accueil',
        '/planning',
        '/chambres',
        '/clients',
        '/facturation',
        '/restaurant',
        '/rapports',
        '/administration',
      ]) {
        await cookPage.goto(otherUrl, { waitUntil: 'domcontentloaded' });
        await expect(cookPage).toHaveURL(/\/cuisine$/, { timeout: 10000 });
      }

      // 4 largeurs sans débordement + pas de barre du bas sur téléphone (360px)
      for (const w of [360, 768, 1024, 1440]) {
        await cookPage.setViewportSize({ width: w, height: 840 });
        await cookPage.waitForTimeout(150);
        if (w === 360) {
          await expect(cookPage.locator('nav[aria-label="Navigation mobile"]')).toHaveCount(0);
        }
        const ov = await cookPage.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        expect(ov.sw, `Overflow sur /cuisine à ${w}px`).toBeLessThanOrEqual(ov.cw);
      }

      // Appels API CUISINIER : 403 sur Restaurant, 200 sans prix/nom client sur Cuisine + SSE Cuisine
      const cookRestPage = await request.get('/api/restaurant/orders/page', { headers: cookHeaders });
      expect(cookRestPage.status()).toBe(403);
      const cookRestSse = await cookPage.evaluate(async (tok) => {
        const res = await fetch('/api/restaurant/orders/stream', {
          headers: { Authorization: `Bearer ${tok}` },
        });
        return res.status;
      }, cookHeaders['Authorization'].replace('Bearer ', ''));
      expect(cookRestSse).toBe(403);

      const cookApiRes = await request.get('/api/cuisine/orders', { headers: cookHeaders });
      expect(cookApiRes.status()).toBe(200);
      const cookApiRaw = JSON.stringify(await cookApiRes.json());
      expect(cookApiRaw).not.toContain('totalTtcFcfa');
      expect(cookApiRaw).not.toContain('unitPriceFcfa');
      expect(cookApiRaw).not.toContain('guestName');
    } finally {
      await cookCtx.close();
    }
  });

  test('Administration verrouille Cuisine au Cuisinier, alerte aucun cuisinier pour DIRECTION, et flux complet fonctionne', async ({
    browser,
    request,
  }) => {
    test.setTimeout(150000);

    // 1) Administration : carte Cuisine grisée pour les autres profils + aperçu en direct + refus API
    const dirCtx = await browser.newContext({ viewport: { width: 1280, height: 850 } });
    try {
      const dirPage = await dirCtx.newPage();
      await loginViaUi(dirPage, dirUser.email, dirUser.password);
      await dirPage.goto('/administration/comptes/nouveau');
      await expect(dirPage.getByTestId('profile-card-ASSISTANT_RECEPTION')).toBeVisible({
        timeout: 15000,
      });

      for (const prof of ['ASSISTANT_RECEPTION', 'ASSISTANT_RESTAURANT', 'COMPTABLE', 'TECHNIQUE']) {
        await dirPage.getByTestId(`profile-card-${prof}`).click();
        await expect(dirPage.getByTestId('cuisine-locked-hint')).toContainText(
          'Seul le cuisinier voit la cuisine',
        );
        await expect(dirPage.getByTestId('screen-cuisine-LECTURE')).toBeDisabled();
        await expect(dirPage.getByTestId('screen-cuisine-ECRITURE')).toBeDisabled();
        await expect(dirPage.getByTestId('preview-menu-cuisine')).toHaveCount(0);
      }

      // Profil Cuisinier : uniquement Cuisine en modification dans l'aperçu
      await dirPage.getByTestId('profile-card-CUISINIER').click();
      await expect(dirPage.getByTestId('preview-menu-cuisine')).toBeVisible();
      await expect(dirPage.locator('[data-testid^="preview-menu-"]')).toHaveCount(1);

      // 2) Alerte « Aucun compte cuisinier actif » visible pour DIRECTION seulement quand 0 cuisinier actif
      const restoCtx = await browser.newContext({ viewport: { width: 1280, height: 850 } });
      const activeCookIdsJson = execE2eNodeScript(`
        const { PrismaClient } = require('@prisma/client');
        (async () => {
          const p = new PrismaClient();
          const cooks = await p.user.findMany({
            where: { role: { in: ['CUISINIER', 'CUISINE'] }, isActive: true, deletedAt: null },
            select: { id: true },
          });
          console.log(JSON.stringify(cooks.map((c) => c.id)));
          await p.$disconnect();
        })();
      `);
      const activeCookIds = JSON.parse(activeCookIdsJson) as string[];
      try {
        execE2eNodeScript(`
          const { PrismaClient } = require('@prisma/client');
          (async () => {
            const p = new PrismaClient();
            await p.user.updateMany({
              where: { role: { in: ['CUISINIER', 'CUISINE'] } },
              data: { isActive: false },
            });
            await p.$disconnect();
          })();
        `);

        const catZeroRes = await request.get('/api/restaurant/catalog', { headers: dirHeaders });
        expect(catZeroRes.status()).toBe(200);
        expect((await catZeroRes.json()).activeCooksCount).toBe(0);

        await dirPage.goto('/restaurant', { waitUntil: 'networkidle' });
        const noCookWarning = dirPage.getByTestId('pos-no-active-cook-warning');
        await expect(noCookWarning).toBeVisible({ timeout: 10000 });
        await expect(noCookWarning).toContainText(
          'Aucun compte cuisinier actif : les commandes ne seront pas préparées',
        );
        await expect(dirPage.getByTestId('link-create-cook-account')).toHaveAttribute(
          'href',
          '/administration/comptes/nouveau',
        );

        const restoPageOnly = await restoCtx.newPage();
        await restoPageOnly.goto('/connexion');
        await restoPageOnly.locator('#user-login').fill(restoUser.email);
        await restoPageOnly.locator('#user-password').fill(restoUser.password);
        await restoPageOnly.locator('#login-btn').click();
        await expect(restoPageOnly).toHaveURL(/\/(tableau-de-bord|restaurant)$/, { timeout: 25000 });
        await restoPageOnly.goto('/restaurant', { waitUntil: 'networkidle' });
        await expect(restoPageOnly.getByTestId('restaurant-pos-page')).toBeVisible();
        await expect(restoPageOnly.getByTestId('pos-no-active-cook-warning')).toHaveCount(0);
      } finally {
        execE2eNodeScript(`
          const { PrismaClient } = require('@prisma/client');
          (async () => {
            const p = new PrismaClient();
            await p.user.updateMany({
              where: { id: { in: ${JSON.stringify(activeCookIds)} } },
              data: { isActive: true },
            });
            await p.$disconnect();
          })();
        `);
        await restoCtx.close();
      }
    } finally {
      await dirCtx.close();
    }

    // 3) Flux complet : assistant envoie -> cuisinier accepte & marque prête -> assistant sert
    if (probeOrderId) {
      await request
        .post(`/api/restaurant/orders/${probeOrderId}/cancel`, {
          headers: dirHeaders,
          data: { reason: 'Fin sonde sécurité' },
        })
        .catch(() => {});
    }
    const assistantCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const cookCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const assistantPage = await assistantCtx.newPage();
      const cookPage = await cookCtx.newPage();

      await assistantPage.goto('/connexion');
      await assistantPage.locator('#user-login').fill(restoUser.email);
      await assistantPage.locator('#user-password').fill(restoUser.password);
      await assistantPage.locator('#login-btn').click();
      await expect(assistantPage).toHaveURL(/\/(tableau-de-bord|restaurant)$/, { timeout: 25000 });
      const assistantStreamPromise = assistantPage.waitForResponse(
        (res) => res.url().includes('/api/restaurant/orders/stream') && res.status() === 200,
        { timeout: 20000 },
      );
      await assistantPage.goto('/restaurant', { waitUntil: 'domcontentloaded' });
      await expect(assistantPage.getByTestId('restaurant-pos-page')).toBeVisible();
      await assistantStreamPromise;

      await cookPage.goto('/connexion');
      await cookPage.locator('#user-login').fill(cookUser.email);
      await cookPage.locator('#user-password').fill(cookUser.password);
      await cookPage.locator('#login-btn').click();
      const cookStreamPromise = cookPage.waitForResponse(
        (res) => res.url().includes('/api/cuisine/stream') && res.status() === 200,
        { timeout: 20000 },
      );
      await expect(cookPage).toHaveURL(/\/cuisine$/, { timeout: 25000 });
      await cookStreamPromise;
      await cookPage.waitForTimeout(250);

      // L'assistant envoie une commande Table
      await assistantPage.locator('[data-testid^="product-tile-"]').first().click();
      await assistantPage.getByTestId('dest-btn-TABLE').click();
      const orderCreatePromise = assistantPage.waitForResponse(
        (res) => res.url().includes('/api/restaurant/orders') && res.request().method() === 'POST',
      );
      await assistantPage.getByTestId('btn-send-kitchen').click();
      const createdRes = await orderCreatePromise;
      expect(createdRes.status()).toBe(201);
      const createdOrder = await createdRes.json();
      createdOrderIds.push(createdOrder.id);

      // Le cuisinier ouvre directement la nouvelle commande reçue en SSE via « Voir » ou la file, puis « Oui, tout est là » -> « 15 min » -> « Marquer prête »
      const newOrderBannerBtn = cookPage.getByTestId('cuisine-new-order-view-btn');
      await newOrderBannerBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
      if (await newOrderBannerBtn.isVisible()) {
        await newOrderBannerBtn.click();
      } else {
        const queueBtn = cookPage.getByTestId(`cuisine-queue-card-${createdOrder.id}`);
        if (await queueBtn.isVisible().catch(() => false)) {
          await queueBtn.click();
        }
      }
      await expect(cookPage.getByTestId('cuisine-btn-all-available')).toBeVisible({ timeout: 10000 });
      await cookPage.getByTestId('cuisine-btn-all-available').click();
      await cookPage.getByTestId('cuisine-prep-15').click();
      await expect(cookPage.getByTestId('cuisine-btn-mark-ready')).toBeVisible({ timeout: 10000 });
      await cookPage.getByTestId('cuisine-btn-mark-ready').click();
      await expect(cookPage.getByTestId('cuisine-ready-banner')).toBeVisible({ timeout: 10000 });

      // L'assistant voit Prête à servir, autorise le service puis clique Servie
      const orderRow = assistantPage.getByTestId(`service-order-row-${createdOrder.id}`);
      await expect(orderRow.getByTestId(`order-status-${createdOrder.id}`)).toContainText(
        'Prête, à servir',
        { timeout: 10000 },
      );
      await orderRow.getByTestId(`btn-row-authorize-${createdOrder.id}`).click();
      await expect(orderRow.getByTestId(`btn-serve-order-${createdOrder.id}`)).toBeVisible({
        timeout: 10000,
      });
      await orderRow.getByTestId(`btn-serve-order-${createdOrder.id}`).click();
      await expect(orderRow.getByTestId(`order-status-${createdOrder.id}`)).toContainText('Servie', {
        timeout: 10000,
      });
    } finally {
      await assistantCtx.close();
      await cookCtx.close();
    }
  });
});
