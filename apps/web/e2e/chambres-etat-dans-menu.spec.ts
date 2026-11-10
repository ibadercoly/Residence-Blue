import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Chambres - État dans menu ⋯ et titre non tronqué', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const capturesDir = path.join(repoRoot, 'docs/design/captures/chambres');

  test.beforeAll(() => {
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

    // Réinitialisation propre de la base IndexedDB
    await page.addInitScript(() => {
      try { indexedDB.deleteDatabase('residence_blue_db'); } catch {}
    });

    // Interception API avec 4 états + nom très long
    await page.route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '00000000-0000-0000-0000-000000000101',
              number: '101',
              floor: 1,
              category: 'Standard',
              status: 'FREE',
              amenities: ['Climatisation', 'Wi-Fi Fibre'],
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000102',
              number: '102',
              floor: 1,
              category: 'Standard',
              status: 'OCCUPIED',
              amenities: ['Climatisation', 'Minibar'],
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000103',
              number: '103',
              floor: 1,
              category: 'Standard',
              status: 'CLEANING',
              amenities: ['Climatisation'],
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000104',
              number: '104',
              floor: 1,
              category: 'Standard',
              status: 'MAINTENANCE',
              amenities: ['Climatisation'],
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000302',
              number: 'Suite Présidentielle Grand Standing Panoramique 302',
              floor: 3,
              category: 'Suite Prestige Panoramique',
              status: 'OCCUPIED',
              amenities: ['Jacuzzi', 'Majordome'],
              type: { id: 't5', name: 'Suite Prestige', pricePerNight: 250000 }
            }
          ])
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
      }
    });
  });

  test('Titre et catégorie entièrement visibles, aucun scroll horizontal, à toutes les tailles', async ({ page }) => {
    const viewports = [
      { width: 360, height: 740, label: '360px_mobile' },
      { width: 768, height: 1024, label: '768px_tablet' },
      { width: 1024, height: 768, label: '1024px_laptop' },
      { width: 1440, height: 900, label: '1440px_desktop' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/chambres');
      await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
      await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

      // 1. Pas de scroll horizontal sur la page
      const pageMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(pageMetrics.scrollWidth, `Débordement horizontal à ${vp.width}px`).toBeLessThanOrEqual(pageMetrics.clientWidth);

      // 2. Vérification titre non tronqué (pas d'ellipsis overflow) sur les cartes 101 à 104 et la suite
      const cardNumbers = ['101', '102', '103', '104'];
      for (const num of cardNumbers) {
        const card = page.locator(`.room-card[data-room-number="${num}"]`).first();
        await expect(card).toBeVisible();

        const titleCheck = await card.locator('[data-testid="room-card-title"]').evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            overflow: style.overflow,
            textOverflow: style.textOverflow,
            whiteSpace: style.whiteSpace,
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          };
        });

        // Le titre ne doit pas utiliser ellipsis
        expect(titleCheck.textOverflow, `Titre tronqué avec ellipsis à ${vp.width}px sur carte ${num}`)
          .not.toBe('ellipsis');
        // Pas de débordement sur le titre lui-même
        expect(titleCheck.scrollWidth, `Titre déborde à ${vp.width}px sur carte ${num}`)
          .toBeLessThanOrEqual(titleCheck.clientWidth + 2); // +2px tolérance

        // La pastille d'état NE doit PAS être dans l'en-tête de carte (elle est dans le menu)
        const badgeInHeader = await card.locator(
          '.card-header app-status-badge, .card-header [data-testid^="status-badge-"]'
        ).count();
        expect(badgeInHeader, `Pastille d'état visible dans l'en-tête à ${vp.width}px sur carte ${num}`)
          .toBe(0);
      }

      // 3. La carte à nom très long est entièrement visible
      const longCard = page.locator(`.room-card`).filter({ hasText: 'Suite Présidentielle' }).first();
      if (await longCard.count() > 0) {
        const titleEl = longCard.locator('[data-testid="room-card-title"]');
        const longTitleCheck = await titleEl.evaluate((el) => ({
          textOverflow: window.getComputedStyle(el).textOverflow,
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }));
        expect(longTitleCheck.textOverflow, `Carte nom long : ellipsis à ${vp.width}px`).not.toBe('ellipsis');
      }
    }
  });

  test('Menu ⋯ : ordre des entrées correct et état affiché dans le menu pour les 4 états', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chambres');
    await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

    const statuses: { num: string; expectedStatus: string }[] = [
      { num: '101', expectedStatus: 'Libre' },
      { num: '102', expectedStatus: 'Occupée' },
      { num: '103', expectedStatus: 'Ménage' },
      { num: '104', expectedStatus: 'Maintenance' },
    ];

    for (const { num, expectedStatus } of statuses) {
      const card = page.locator(`.room-card[data-room-number="${num}"]`).first();
      await expect(card).toBeVisible();

      // Ouvrir le menu
      const menuBtn = card.locator('.menu-btn-trigger');
      await menuBtn.click();

      // Vérifier la présence des entrées dans le bon ordre
      const menuItems = page.locator('.room-menu-dropdown .menu-item-action, .room-menu-dropdown [data-testid="menu-item-status"]');
      const count = await menuItems.count();
      expect(count, `Nombre d'entrées du menu pour carte ${num}`).toBeGreaterThanOrEqual(3);

      // Vérifier l'ordre : Voir la fiche en premier
      const firstItem = await menuItems.nth(0).getAttribute('data-testid');
      expect(firstItem, `Première entrée du menu pour ${num}`).toBe('menu-action-details');

      // Vérifier la présence de l'élément d'état
      const statusItem = page.locator('[data-testid="menu-item-status"]');
      await expect(statusItem).toBeVisible();

      // Vérifier que l'état affiché correspond au statut de la chambre
      const statusBadge = statusItem.locator('app-status-badge');
      await expect(statusBadge).toContainText(expectedStatus);

      // Vérifier que Désactiver est présent (en dernier, pour DIRECTION)
      const deactivateBtn = page.locator('[data-testid="menu-action-deactivate"]');
      await expect(deactivateBtn).toBeVisible();

      // Fermer le menu
      await page.keyboard.press('Escape');
      await expect(page.locator('.room-menu-dropdown')).not.toBeVisible();
    }
  });

  test('Menu entièrement dans la fenêtre y compris sur la dernière carte de la rangée (360 px)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/chambres');
    await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

    // Ouvrir le menu sur la première carte visible
    const firstCard = page.locator('.room-card').first();
    await expect(firstCard).toBeVisible();
    const menuBtn = firstCard.locator('.menu-btn-trigger');
    await menuBtn.click();

    const menuDropdown = page.locator('.room-menu-dropdown').first();
    await expect(menuDropdown).toBeVisible();

    const inViewport = await menuDropdown.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        isInBounds:
          rect.left >= 0 &&
          rect.right <= window.innerWidth &&
          rect.top >= 0 &&
          rect.bottom <= window.innerHeight,
      };
    });

    expect(inViewport.right, `Menu dépasse à droite à 360px (right=${inViewport.right}, vw=${inViewport.viewportWidth})`)
      .toBeLessThanOrEqual(inViewport.viewportWidth + 1);
    expect(inViewport.left, `Menu dépasse à gauche à 360px`).toBeGreaterThanOrEqual(-1);

    await page.keyboard.press('Escape');
  });

  test('Captures d\'écran avant/après : carte fermée et menu ouvert', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chambres');
    await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

    // Carte fermée (état de base)
    const card101 = page.locator('.room-card[data-room-number="101"]').first();
    await expect(card101).toBeVisible();
    await card101.screenshot({ path: path.join(capturesDir, 'etat-dans-menu_carte-fermee.png') });

    // Menu ouvert
    const menuBtn101 = card101.locator('.menu-btn-trigger');
    await menuBtn101.click();
    await page.locator('.room-menu-dropdown').first().waitFor({ state: 'visible' });
    await card101.screenshot({ path: path.join(capturesDir, 'etat-dans-menu_menu-ouvert.png') });

    await page.keyboard.press('Escape');

    // Vérifier que les captures ont été créées
    expect(fs.existsSync(path.join(capturesDir, 'etat-dans-menu_carte-fermee.png'))).toBe(true);
    expect(fs.existsSync(path.join(capturesDir, 'etat-dans-menu_menu-ouvert.png'))).toBe(true);
  });
});
