import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Résidence Blue - Écran Chambres, Nouvel En-tête & Gestion Dynamique', () => {
  const screenshotsDir = path.resolve(__dirname, '../../../docs/design/captures/chambres');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    // Interception de toutes les requêtes API chambres
    await page.route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'room-101', number: '101', floor: 1, category: 'Standard', status: 'FREE', amenities: ['Climatisation', 'Wi-Fi Fibre'], type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 } },
            { id: 'room-102', number: '102', floor: 1, category: 'Standard', status: 'FREE', amenities: ['Climatisation', 'Wi-Fi Fibre'], type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 } },
            { id: 'room-103', number: '103', floor: 1, category: 'Standard', status: 'FREE', amenities: ['Climatisation', 'Wi-Fi Fibre'], type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 } },
            { id: 'room-104', number: '104', floor: 1, category: 'Standard', status: 'FREE', amenities: ['Climatisation', 'Wi-Fi Fibre'], type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 } },
            { id: 'room-105', number: '105', floor: 1, category: 'Standard', status: 'FREE', amenities: ['Climatisation', 'Wi-Fi Fibre'], type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 } },
            { id: 'room-106', number: '106', floor: 1, category: 'Standard', status: 'FREE', amenities: ['Climatisation', 'Wi-Fi Fibre'], type: { id: 'type-std', name: 'Standard', pricePerNight: 35000 } },
            { id: 'room-201', number: '201', floor: 2, category: 'Deluxe', status: 'FREE', amenities: ['Climatisation', 'Balcon', 'Wi-Fi Fibre'], type: { id: 'type-dlx', name: 'Deluxe', pricePerNight: 55000 } },
            { id: 'room-202', number: '202', floor: 2, category: 'Deluxe', status: 'FREE', amenities: ['Climatisation', 'Balcon', 'Wi-Fi Fibre'], type: { id: 'type-dlx', name: 'Deluxe', pricePerNight: 55000 } },
            { id: 'room-203', number: '203', floor: 2, category: 'Deluxe', status: 'FREE', amenities: ['Climatisation', 'Balcon', 'Wi-Fi Fibre'], type: { id: 'type-dlx', name: 'Deluxe', pricePerNight: 55000 } },
            { id: 'room-204', number: '204', floor: 2, category: 'Deluxe', status: 'FREE', amenities: ['Climatisation', 'Balcon', 'Wi-Fi Fibre'], type: { id: 'type-dlx', name: 'Deluxe', pricePerNight: 55000 } },
            { id: 'room-301', number: '301', floor: 3, category: 'Suite', status: 'OCCUPIED', amenities: ['Climatisation', 'Baignoire', 'Wi-Fi Fibre'], type: { id: 'type-ste', name: 'Suite', pricePerNight: 95000 } },
            { id: 'room-302', number: '302', floor: 3, category: 'Suite', status: 'FREE', amenities: ['Climatisation', 'Baignoire', 'Wi-Fi Fibre'], type: { id: 'type-ste', name: 'Suite', pricePerNight: 95000 } }
          ])
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });
  });

  test('Aucun débordement horizontal à 360, 768, 1024 et 1440 px + captures en-tête', async ({ page }) => {
    const viewports = [
      { width: 360, height: 740, name: '360px_mobile' },
      { width: 768, height: 1024, name: '768px_tablet' },
      { width: 1024, height: 768, name: '1024px_laptop' },
      { width: 1440, height: 900, name: '1440px_desktop' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/chambres');
      await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });

      // Vérification stricte de l'absence de scroll horizontal
      const metrics = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth
        };
      });
      expect(metrics.scrollWidth, `Débordement html à ${vp.width}px`).toBeLessThanOrEqual(metrics.clientWidth);
      expect(metrics.bodyScrollWidth, `Débordement body à ${vp.width}px`).toBeLessThanOrEqual(metrics.bodyClientWidth);

      // Vérification que le header est visible et aligné
      const header = page.locator('[data-testid="rooms-header"]');
      await expect(header).toBeVisible();

      // Capture d'écran de l'en-tête
      await header.screenshot({
        path: path.join(screenshotsDir, `header_${vp.name}.png`),
      });
    }
  });

  test('Parcours complet : Ajout, unicité, modification, conflits de désactivation et RBAC Réception', async ({ page }) => {
    // Gestion automatique des dialogues window.confirm
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/chambres');
    await page.locator('[data-testid="rooms-page-title"]').waitFor({ state: 'visible' });

    // Vérification initiale : Titre Chambres, sous-titre 12 chambres
    await expect(page.locator('[data-testid="rooms-page-title"]')).toContainText('Chambres');
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('12 chambres · Grand Standing, Thiès');
    await expect(page.locator('[data-testid="btn-add-room"]')).toBeVisible();

    // Pastille En ligne
    await expect(page.locator('[data-testid="network-online-indicator"]')).toBeVisible();

    // 1. Ajoute une chambre (401, 4e étage, Suite, 110 000 FCFA)
    await page.locator('[data-testid="btn-add-room"]').click();
    await expect(page.locator('[data-testid="room-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-title"]')).toContainText('Ajouter une chambre');

    await page.locator('[data-testid="input-room-number"]').fill('401');
    await page.locator('[data-testid="input-room-floor"]').fill('4');
    await page.locator('[data-testid="select-room-category"]').selectOption('Suite');
    await page.locator('[data-testid="input-room-price"]').fill('110000');
    await page.locator('[data-testid="input-room-description"]').fill('Suite grand confort avec vue piscine et balcon panoramique.');

    // Enregistrement
    await expect(page.locator('[data-testid="btn-save-room"]')).toBeEnabled();
    await page.locator('[data-testid="btn-save-room"]').click();

    // 2. Vérifie qu'elle apparaît dans la grille et que le titre affiche « 13 chambres »
    await expect(page.locator('[data-testid="room-drawer"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="rooms-page-subtitle"]')).toContainText('13 chambres · Grand Standing, Thiès');

    const card401 = page.locator('.room-card[data-room-number="401"]');
    await expect(card401).toBeVisible();
    await expect(card401).toContainText('110 000 FCFA');
    await expect(card401).toContainText('Suite');
    await expect(card401).toContainText('Étage 4');

    // Vérifier que la chambre 401 est disponible dans Nouvelle réservation
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    await page.waitForTimeout(300);
    await page.locator('label', { hasText: 'Suite' }).first().click();
    const selectRoomModal = page.locator('[data-testid="select-room"]');
    await expect(selectRoomModal).toBeVisible();
    await expect(selectRoomModal.locator('option', { hasText: '401' })).toBeAttached();
    // Fermer la modale
    await page.locator('[data-testid="btn-close-modal"]').click();

    // 3. Tente d'ajouter une chambre avec le même numéro : vérifie le message d'erreur
    await page.locator('[data-testid="btn-add-room"]').click();
    await page.locator('[data-testid="input-room-number"]').fill('401');
    await expect(page.locator('[data-testid="error-room-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-room-number"]')).toContainText('existe déjà');
    await expect(page.locator('[data-testid="btn-save-room"]')).toBeDisabled();
    await page.locator('[data-testid="btn-cancel-room"]').click();

    // 4. Modifie son tarif à 115 000 FCFA
    const menuBtn401 = page.locator('[data-testid="room-menu-btn-401"]');
    await menuBtn401.click();
    await page.locator('[data-testid="menu-action-edit"]').click();

    await expect(page.locator('[data-testid="room-drawer"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-title"]')).toContainText('Modifier la chambre 401');
    await expect(page.locator('[data-testid="input-room-price"]')).toHaveValue('110000');

    await page.locator('[data-testid="input-room-price"]').fill('115000');
    await page.locator('[data-testid="btn-save-room"]').click();

    // Vérifie le nouveau tarif sur la carte
    await expect(card401).toContainText('115 000 FCFA');

    // 5. Tente de désactiver une chambre occupée (301) : vérifie le refus et le message
    const menuBtn301 = page.locator('[data-testid="room-menu-btn-301"]');
    await menuBtn301.click();
    await page.locator('[data-testid="menu-action-deactivate"]').click();

    await expect(page.locator('[data-testid="room-alert-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="room-alert-error"]')).toContainText('Impossible de désactiver la chambre 301');

    // 6. Désactive la chambre 401 : vérifie qu'elle disparaît de Toutes et apparaît dans Inactives
    await menuBtn401.click();
    await page.locator('[data-testid="menu-action-deactivate"]').click();

    // La chambre 401 disparaît de la vue Toutes
    await expect(page.locator('.room-card[data-room-number="401"]')).not.toBeVisible();

    // La pastille « Inactives » apparaît dans la barre de filtres
    const inactiveFilterPill = page.locator('[data-testid="filter-pill-inactive"]');
    await expect(inactiveFilterPill).toBeVisible();
    await expect(inactiveFilterPill).toContainText('Inactives');
    await expect(inactiveFilterPill).toContainText('(1)');

    // Cliquer sur le filtre « Inactives » pour voir la chambre désactivée
    await inactiveFilterPill.click();
    await expect(page.locator('.room-card[data-room-number="401"]')).toBeVisible();
    await expect(page.locator('.room-card[data-room-number="401"]')).toContainText('Inactive');

    // 7. Change de profil pour « Réception » : vérifie que le bouton « + Ajouter » et le menu Modifier/Désactiver ont disparu
    // Retourner sur Toutes d'abord
    await page.locator('[data-testid="filter-pill-all"]').click();

    // Ouvrir le menu profil dans le header en haut à droite
    await page.locator('[data-testid="demo-profile-dropdown-btn"]').click();
    await expect(page.locator('[data-testid="demo-profile-dropdown"]')).toBeVisible();

    // Basculer sur Réception (via dropdown desktop)
    await page.locator('[data-testid="demo-profile-dropdown"] [data-testid="demo-role-reception"]').click();

    // Vérifier la mise à jour du profil utilisateur dans l'en-tête
    await expect(page.locator('[data-testid="header-user-name"]')).toContainText('Fatou Sow');
    await expect(page.locator('[data-testid="header-user-role"]')).toContainText('Chef de Réception');

    // Vérifier la disparition du bouton « + Ajouter une chambre »
    await expect(page.locator('[data-testid="btn-add-room"]')).not.toBeVisible();

    // Vérifier sur une carte de chambre que Modifier et Désactiver ne sont plus affichés
    const menuBtn101 = page.locator('[data-testid="room-menu-btn-101"]');
    await menuBtn101.click();
    await expect(page.locator('[data-testid="menu-action-details"]')).toBeVisible();
    await expect(page.locator('[data-testid="menu-action-edit"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="menu-action-deactivate"]')).not.toBeVisible();
  });
});
