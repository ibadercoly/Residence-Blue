import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Chambres - Suppression et Remplacement d\'Image', () => {
  const capturesDir = path.resolve(__dirname, '../../../docs/design/captures/chambres');
  const modalScreenshotPath = path.join(capturesDir, 'confirmation-suppression.png');

  // Image PNG factice 1x1 pixel pour les tests d'upload
  const dummyPngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  test.beforeAll(() => {
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // 1. Initialiser la session utilisateur avec le rôle DIRECTION (requis pour modifier/supprimer)
    await page.addInitScript(() => {
      try {
        indexedDB.deleteDatabase('residence_blue_db');
      } catch {}

      const session = {
        user: {
          id: 'usr-001-ba',
          email: 'aissatou.ba@residenceblue.sn',
          fullName: 'Aïssatou Ba',
          role: 'DIRECTION',
          jobTitle: "Directrice d'Exploitation",
        },
        token: 'mock-jwt-token-direction',
        expiresAt: Date.now() + 86400000,
        stayConnected8h: true,
        lastActivityAt: Date.now(),
        isLocked: false,
      };
      localStorage.setItem('residence_blue_auth_session', JSON.stringify(session));
    });
  });

  test('Remplacer l\'image d\'une chambre : affichage immédiat puis persistance après rechargement', async ({
    page,
  }) => {
    let currentRoomImageUrl: string | null = null;
    const newImageUrl = '/api/rooms/images/test-uuid-photo-remplacee.webp';

    // Route d'interception API pour l'image et la mise à jour (sur le contexte pour inclure le Service Worker)
    await page.context().route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/images/')) {
        await route.fulfill({
          status: 200,
          contentType: 'image/webp',
          body: Buffer.from(dummyPngBase64, 'base64'),
        });
        return;
      }

      if (method === 'PATCH' && url.includes('room-102')) {
        currentRoomImageUrl = newImageUrl;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'room-102',
            number: '102',
            floor: 1,
            category: 'Standard',
            status: 'FREE',
            amenities: ['Climatisation', 'Wi-Fi Fibre'],
            imageUrl: newImageUrl,
            isActive: true,
            type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 },
          }),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'room-101',
              number: '101',
              floor: 1,
              category: 'Standard',
              status: 'FREE',
              amenities: ['Climatisation'],
              imageUrl: null,
              isActive: true,
              type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 },
            },
            {
              id: 'room-102',
              number: '102',
              floor: 1,
              category: 'Standard',
              status: 'FREE',
              amenities: ['Climatisation', 'Wi-Fi Fibre'],
              imageUrl: currentRoomImageUrl,
              isActive: true,
              type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 },
            },
          ]),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/chambres', { waitUntil: 'networkidle' });

    // Ouvrir le menu ⋯ de la chambre 102
    const menuBtn = page.locator('[data-testid="room-menu-btn-102"]');
    await menuBtn.waitFor({ state: 'visible' });
    await menuBtn.click();

    // Cliquer sur "Modifier"
    const editBtn = page.locator('[data-testid="menu-action-edit"]');
    await editBtn.waitFor({ state: 'visible' });
    await editBtn.click();

    // Le tiroir de modification s'ouvre
    const drawer = page.locator('[data-testid="room-drawer"]');
    await expect(drawer).toBeVisible();

    // Sélectionner un nouveau fichier image
    const fileInput = page.locator('[data-testid="input-room-photo"]');
    await fileInput.setInputFiles({
      name: 'nouvelle-facade.png',
      mimeType: 'image/png',
      buffer: Buffer.from(dummyPngBase64, 'base64'),
    });

    // L'aperçu immédiat apparaît
    const preview = page.locator('[data-testid="room-photo-preview"]');
    await expect(preview).toBeVisible();

    // Enregistrer les modifications
    const saveBtn = page.locator('[data-testid="btn-save-room"]');
    await saveBtn.click();

    // Le tiroir se ferme
    await expect(drawer).toBeHidden();

    // La carte 102 affiche immédiatement la nouvelle image
    const cardImg = page.locator('app-room-status-card').filter({ hasText: '102' }).locator('img');
    await expect(cardImg).toHaveAttribute('src', newImageUrl);

    // Recharger la page pour tester la persistance
    await page.reload({ waitUntil: 'networkidle' });

    const cardImgAfterReload = page.locator('app-room-status-card').filter({ hasText: '102' }).locator('img');
    await expect(cardImgAfterReload).toHaveAttribute('src', newImageUrl);
  });

  test('Supprimer une chambre vierge : décrémentation des compteurs à n-1 sans rechargement', async ({
    page,
  }) => {
    let roomsList = [
      {
        id: 'room-101',
        number: '101',
        floor: 1,
        category: 'Standard',
        status: 'FREE',
        amenities: [],
        isActive: true,
        type: { id: 't1', name: 'Standard', pricePerNight: 35000 },
      },
      {
        id: 'room-999',
        number: '999',
        floor: 9,
        category: 'Standard',
        status: 'FREE',
        amenities: [],
        isActive: true,
        type: { id: 't1', name: 'Standard', pricePerNight: 35000 },
      },
    ];

    await page.context().route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'DELETE' && url.includes('room-999')) {
        roomsList = roomsList.filter((r) => r.id !== 'room-999');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Chambre 999 supprimée avec succès.' }),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(roomsList),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/chambres', { waitUntil: 'networkidle' });

    // Compteur initial : 2 chambres
    const subtitle = page.locator('[data-testid="rooms-page-subtitle"]');
    await expect(subtitle).toContainText('2 chambres');

    // 2 cartes affichées
    const cards = page.locator('app-room-status-card');
    await expect(cards).toHaveCount(2);

    // Ouvrir le menu de la chambre 999
    const menuBtn = page.locator('[data-testid="room-menu-btn-999"]');
    await menuBtn.click();

    // Cliquer sur "Supprimer"
    const deleteBtn = page.locator('[data-testid="menu-action-delete"]');
    await deleteBtn.waitFor({ state: 'visible' });
    await deleteBtn.click();

    // Modale de confirmation
    const modal = page.locator('[data-testid="modal-confirm-delete"]');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('Supprimer la chambre 999 ?');

    // Capture de la modale de confirmation pour le résumé final
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });

    // Bouton de confirmation initialement désactivé
    const confirmBtn = page.locator('[data-testid="btn-confirm-delete"]');
    await expect(confirmBtn).toBeDisabled();

    // Saisie du mauvais numéro : reste désactivé
    const confirmInput = page.locator('[data-testid="input-confirm-room-number"]');
    await confirmInput.fill('123');
    await expect(confirmBtn).toBeDisabled();

    // Saisie du bon numéro : bouton activé
    await confirmInput.fill('999');
    await expect(confirmBtn).toBeEnabled();

    // Clic sur confirmation
    await confirmBtn.click();

    // La modale se ferme
    await expect(modal).toBeHidden();

    // Compteur immédiatement à 1 chambre (n - 1)
    await expect(subtitle).toContainText('1 chambres');
    await expect(cards).toHaveCount(1);
    await expect(page.locator('app-room-status-card').filter({ hasText: '999' })).toHaveCount(0);
  });

  test('Fermeture de la modale de confirmation avec la touche Échap', async ({ page }) => {
    await page.context().route(/\/api\/rooms(\/.*)?$/, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'room-999',
              number: '999',
              floor: 9,
              category: 'Standard',
              status: 'FREE',
              amenities: [],
              isActive: true,
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 },
            },
          ]),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto('/chambres', { waitUntil: 'networkidle' });

    // Ouvrir le menu puis la modale de suppression
    await page.locator('[data-testid="room-menu-btn-999"]').click();
    await page.locator('[data-testid="menu-action-delete"]').click();

    const modal = page.locator('[data-testid="modal-confirm-delete"]');
    await expect(modal).toBeVisible();

    // Appui sur la touche Échap
    await page.keyboard.press('Escape');

    // La modale est fermée
    await expect(modal).toBeHidden();
  });

  test('Tentative de suppression d\'une chambre avec historique : message 409 et bouton « Désactiver à la place »', async ({
    page,
  }) => {
    let isDeactivated = false;

    await page.context().route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === 'PATCH' && url.includes('room-101')) {
        isDeactivated = true;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'room-101',
            number: '101',
            floor: 1,
            category: 'Standard',
            status: 'FREE',
            isActive: false,
            amenities: [],
            type: { id: 't1', name: 'Standard', pricePerNight: 35000 },
          }),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'room-101',
              number: '101',
              floor: 1,
              category: 'Standard',
              status: 'FREE',
              isActive: !isDeactivated,
              amenities: [],
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 },
            },
          ]),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto('/chambres', { waitUntil: 'networkidle' });

    // Ouvrir le menu de la chambre 101
    await page.locator('[data-testid="room-menu-btn-101"]').click();
    await page.locator('[data-testid="menu-action-delete"]').click();

    const modal = page.locator('[data-testid="modal-confirm-delete"]');
    await expect(modal).toBeVisible();

    // L'alerte de conflit avec l'historique est affichée immédiatement
    const alert = page.locator('[data-testid="delete-conflict-alert"]');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('réservations');
    await expect(alert).toContainText('factures');

    // Le bouton "Désactiver à la place" est présent
    const deactivateInsteadBtn = page.locator('[data-testid="btn-deactivate-instead"]');
    await expect(deactivateInsteadBtn).toBeVisible();

    // Clic sur "Désactiver à la place"
    await deactivateInsteadBtn.click();

    // La modale se ferme
    await expect(modal).toBeHidden();

    // La chambre est retirée des chambres actives et le filtre "Désactivées (1)" apparaît
    const inactivePill = page.locator('[data-testid="filter-pill-inactive"]');
    await expect(inactivePill).toBeVisible();
    await expect(inactivePill).toContainText('1');

    // En cliquant sur le filtre "Désactivées", la carte 101 est bien affichée avec le badge Inactive
    await inactivePill.click();
    const card = page.locator('app-room-status-card').filter({ hasText: '101' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Inactive');
  });

  test('Aucun débordement horizontal à 360, 768, 1024 et 1440 px', async ({ page }) => {
    const viewports = [
      { width: 360, height: 740 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
      { width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/chambres', { waitUntil: 'networkidle' });

      const metrics = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
        };
      });

      expect(metrics.scrollWidth, `Débordement html à ${vp.width}px`).toBeLessThanOrEqual(
        metrics.clientWidth,
      );
      expect(metrics.bodyScrollWidth, `Débordement body à ${vp.width}px`).toBeLessThanOrEqual(
        metrics.bodyClientWidth,
      );
    }
  });
});
