import { test, expect } from '@playwright/test';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

test.describe('Persistance de Bout en Bout (chore/audit-persistance)', () => {
  const dummyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  let dirUser = { email: '', password: '' };

  test.beforeAll(() => {
    dirUser = createE2eUser('DIRECTION');
  });

  test.afterAll(() => {
    if (dirUser.email) deleteE2eUsers([dirUser.email]);
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        indexedDB.deleteDatabase('residence_blue_db');
      } catch {}
    });
    await loginViaUi(page, dirUser.email, dirUser.password);
  });

  test('1. Connexion utilisateur, création et modification de chambre avec photo, persistance après rechargement et suppression', async ({
    page,
  }) => {
    // État persistant simulé côté serveur (survit aux rechargements de page et redémarrages)
    const dbRooms: any[] = [
      {
        id: 'room-101',
        number: '101',
        floor: 1,
        category: 'Standard',
        status: 'FREE',
        amenities: ['Climatisation', 'Wi-Fi Fibre'],
        imageUrl: 'assets/images/chambres/chambre-101-standard.jpg',
        isActive: true,
        type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 },
      },
    ];

    await page.context().route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/images/')) {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from(dummyPngBase64, 'base64'),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(dbRooms),
        });
        return;
      }

      if (method === 'POST') {
        const created = {
          id: 'room-404-persisted',
          number: '404',
          floor: 4,
          category: 'Deluxe',
          status: 'FREE',
          amenities: ['Climatisation', 'Wi-Fi Fibre'],
          imageUrl: '/api/rooms/images/uuid-404-initial.png',
          isActive: true,
          type: { id: 'type-dlx', name: 'Deluxe', pricePerNight: 55000 },
        };
        dbRooms.push(created);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(created),
        });
        return;
      }

      if (method === 'PATCH' && url.includes('room-404-persisted')) {
        const target = dbRooms.find((r) => r.id === 'room-404-persisted');
        if (target) {
          target.imageUrl = '/api/rooms/images/uuid-404-replaced.png';
          target.type.pricePerNight = 60000;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(target),
        });
        return;
      }

      if (method === 'DELETE' && url.includes('room-404-persisted')) {
        const idx = dbRooms.findIndex((r) => r.id === 'room-404-persisted');
        if (idx >= 0) dbRooms.splice(idx, 1);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Chambre 404 supprimée.' }),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/chambres', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('1 chambres');

    // 1. Créer la chambre 404 avec photo par l'interface
    await page.locator('[data-testid="btn-add-room"]').click();
    const drawer = page.locator('[data-testid="room-drawer"]');
    await expect(drawer).toBeVisible();

    await page.locator('[data-testid="input-room-number"]').fill('404');
    await page.locator('[data-testid="input-room-price"]').fill('55000');
    await page.locator('[data-testid="input-room-photo"]').setInputFiles({
      name: 'chambre-404.png',
      mimeType: 'image/png',
      buffer: Buffer.from(dummyPngBase64, 'base64'),
    });

    await page.locator('[data-testid="btn-save-room"]').click();
    await expect(drawer).toBeHidden();

    // Vérifier l'affichage immédiat
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('2 chambres');
    await expect(page.locator('app-room-status-card').filter({ hasText: '404' })).toBeVisible();

    // 2. Recharger la page et vérifier que la chambre 404 est toujours affichée
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('2 chambres');
    await expect(page.locator('app-room-status-card').filter({ hasText: '404' })).toBeVisible();

    // 3. Modifier la chambre 404 (remplacer la photo)
    await page.locator('[data-testid="room-menu-btn-404"]').click();
    await page.locator('[data-testid="menu-action-edit"]').click();
    await expect(drawer).toBeVisible();

    await page.locator('[data-testid="input-room-photo"]').setInputFiles({
      name: 'chambre-404-v2.png',
      mimeType: 'image/png',
      buffer: Buffer.from(dummyPngBase64, 'base64'),
    });
    await page.locator('[data-testid="btn-save-room"]').click();
    await expect(drawer).toBeHidden();

    const card404Img = page.locator('app-room-status-card').filter({ hasText: '404' }).locator('img');
    await expect(card404Img).toHaveAttribute('src', '/api/rooms/images/uuid-404-replaced.png');

    // 4. Supprimer la chambre 404 et vérifier la cohérence après rechargement
    await page.locator('[data-testid="room-menu-btn-404"]').click();
    await page.locator('[data-testid="menu-action-delete"]').click();
    const modal = page.locator('[data-testid="modal-confirm-delete"]');
    await expect(modal).toBeVisible();

    await page.locator('[data-testid="input-confirm-room-number"]').fill('404');
    await page.locator('[data-testid="btn-confirm-delete"]').click();
    await expect(modal).toBeHidden();

    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('1 chambres');
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('1 chambres');
  });

  test('2. Absence de toute donnée de démonstration quand la base de données est vide (écrans vides propres)', async ({
    page,
  }) => {
    // L'API renvoie des tableaux vides pour simuler une base de données vierge
    await page.context().route(/\/api\/(rooms|reservations|guests|invoices|restaurant\/.*)$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }
      await route.fallback();
    });

    // 1. Écran Chambres avec base vide : 0 chambres, aucune fausse carte affichée
    await page.goto('/chambres', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('0 chambres');
    await expect(page.locator('app-room-status-card')).toHaveCount(0);

    // 2. Écran Restaurant avec base vide : aucun faux plat affiché
    await page.goto('/restaurant', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid^="dish-card-"]')).toHaveCount(0);
  });
});
