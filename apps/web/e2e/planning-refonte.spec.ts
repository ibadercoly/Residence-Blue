import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Refonte Écran Planning - Zero Scroll Horizontal & Ergonomie', () => {
  const screenshotsDir = path.resolve(process.cwd(), 'docs/design/comparaisons');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  const viewports = [
    { width: 360, height: 740, label: 'mobile-small' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 1024, height: 768, label: 'desktop-compact' },
    { width: 1440, height: 900, label: 'desktop-wide' }
  ];

  for (const vp of viewports) {
    test(`Vérification stricte de non-débordement horizontal à ${vp.width}px (${vp.label})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/planning');
      await page.waitForLoadState('networkidle');

      // Vérifier que scrollWidth <= clientWidth
      const metrics = await page.evaluate(() => {
        return {
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth
        };
      });

      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
      expect(metrics.bodyScrollWidth).toBeLessThanOrEqual(metrics.bodyClientWidth);

      // Capture d'écran de vérification
      const shotPath = path.join(screenshotsDir, `planning_noscroll_${vp.width}px.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      expect(fs.existsSync(shotPath)).toBe(true);
    });
  }

  test('Structure complète : En-tête, 3 chiffres du jour, barre d\'outils, grille 7 jours et légende', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/planning');
    await page.waitForLoadState('networkidle');

    // 1. En-tête
    await expect(page.locator('h1')).toContainText('Planning');
    await expect(page.locator('[data-testid="header-new-reservation-btn"]')).toBeVisible();

    // 2. Bande de 3 chiffres du jour (rien d'autre)
    const metricsSection = page.locator('[data-testid="planning-daily-metrics"]');
    await expect(metricsSection).toBeVisible();
    await expect(page.locator('[data-testid="metric-arrivals"]')).toHaveText('3');
    await expect(page.locator('[data-testid="metric-departures"]')).toHaveText('2');
    await expect(page.locator('[data-testid="metric-free"]')).toBeVisible();

    // 3. Barre d'outils
    const toolbar = page.locator('[data-testid="planning-toolbar"]');
    await expect(toolbar).toBeVisible();
    await expect(page.locator('[data-testid="planning-period-label"]')).toContainText('10 – 16 nov. 2026');

    // Navigation de période
    await page.locator('[data-testid="btn-next-week"]').click();
    await expect(page.locator('[data-testid="planning-period-label"]')).toContainText('17 – 23 nov. 2026');

    await page.locator('[data-testid="btn-today"]').click();
    await expect(page.locator('[data-testid="planning-period-label"]')).toContainText('10 – 16 nov. 2026');

    // Recherche par nom de client
    const searchInput = page.locator('[data-testid="planning-search-input"]');
    await searchInput.fill('Diop');
    await expect(page.locator('[data-testid="room-row-301"]')).toBeVisible();
    await expect(page.locator('[data-testid="room-row-101"]')).toHaveCount(0);

    // Effacer recherche
    await searchInput.fill('');
    await expect(page.locator('[data-testid="room-row-101"]')).toBeVisible();

    // Filtre unique Toutes / Libres / Occupées
    await page.locator('[data-testid="filter-free"]').click();
    await expect(page.locator('[data-testid="room-row-106"]')).toBeVisible();

    await page.locator('[data-testid="filter-all"]').click();
    await expect(page.locator('[data-testid="grid-body"] > div')).toHaveCount(12);

    // 4. Grille 7 jours et colonnes de jours
    const gridHeader = page.locator('[data-testid="grid-header"]');
    await expect(gridHeader).toBeVisible();
    for (let i = 0; i < 7; i++) {
      await expect(page.locator(`[data-testid="day-header-${i}"]`)).toBeVisible();
    }

    // Jour actuel surligné (jour 0 = Mardi 10 nov)
    await expect(page.locator('[data-testid="day-header-0"]')).toHaveClass(/bg-primary-container/);

    // Légende sous la grille (3 couleurs seulement)
    const legend = page.locator('[data-testid="planning-legend"]');
    await expect(legend).toBeVisible();
    await expect(legend).toContainText('Confirmée');
    await expect(legend).toContainText('En séjour');
    await expect(legend).toContainText('Départ aujourd\'hui');
  });

  test('Parcours réservation : ouverture sur case vide, refus doublon sur chambre occupée', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/planning');
    await page.waitForLoadState('networkidle');

    // 1. Clic sur une case vide (Ch. 106, jour 2) -> ouvre Nouvelle réservation
    await page.locator('[data-testid="slot-106-2"]').click();
    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    // La chambre 106 est sélectionnée
    await expect(page.locator('#select-room-number')).toHaveValue('106');

    // Fermer la modale
    await page.locator('[data-testid="modal-close-btn"]').click();
    await expect(modal).not.toBeVisible();

    // 2. Tentative de réservation en doublon (conflit strict)
    // Ouvrir la modale et forcer la chambre 301 pour la période du 10 au 14 nov (occupée par Mamadou Diop)
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    await expect(modal).toBeVisible();

    // Sélectionner la catégorie Suite et chambre 301
    await page.locator('[data-testid="category-card-Suite"]').click();
    await page.locator('#select-room-number').selectOption('301');

    // Dates 2026-11-10 au 2026-11-14
    await page.locator('#input-date-checkin').fill('2026-11-10');
    await page.locator('#input-date-checkout').fill('2026-11-14');

    // Soumettre la réservation
    await page.locator('[data-testid="btn-confirm-reservation"]').click();

    // Doit être REFUSÉE avec un message d'erreur clair
    const conflictAlert = page.locator('[data-testid="reservation-conflict-error"]');
    await expect(conflictAlert).toBeVisible();
    await expect(conflictAlert).toContainText('déjà réservée');

    // Fermer
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });

  test('Panneau de détail : 6 champs stricts, 4 boutons d\'action et accessibilité Échap', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/planning');
    await page.waitForLoadState('networkidle');

    // Clic sur la barre de Mamadou Diop en chambre 301
    await page.locator('[data-testid="res-bar-RB-2024-0894"]').click();

    // Le tiroir s'ouvre
    const drawer = page.locator('[data-testid="planning-detail-drawer"]');
    await expect(drawer).toBeVisible();

    // Vérification des 6 champs
    await expect(page.locator('[data-testid="drawer-client-name"]')).toHaveText('M. Mamadou Diop');
    await expect(page.locator('[data-testid="drawer-room-number"]')).toContainText('301');
    await expect(page.locator('[data-testid="drawer-dates"]')).toContainText('2026-11-10');
    await expect(page.locator('[data-testid="drawer-nights"]')).toContainText('4 nuits');
    await expect(page.locator('[data-testid="drawer-total"]')).toContainText('840 000 FCFA');
    await expect(page.locator('[data-testid="drawer-remaining"]')).toContainText('280 000 FCFA');

    // Vérification des 4 boutons d'action
    await expect(page.locator('[data-testid="drawer-btn-modifier"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-btn-prolonger"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-btn-checkin-checkout"]')).toBeVisible();
    await expect(page.locator('[data-testid="drawer-btn-annuler"]')).toBeVisible();

    // Prolonger (+1 nuit)
    await page.locator('[data-testid="drawer-btn-prolonger"]').click();
    await expect(page.locator('[data-testid="drawer-nights"]')).toContainText('5 nuits');

    // Fermeture avec la touche Échap
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('Version mobile (< 768 px) : disparition grille, sélecteur 7 pastilles, 3 sections, bouton flottant', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/planning');
    await page.waitForLoadState('networkidle');

    // La grille bureau est masquée
    await expect(page.locator('[data-testid="planning-desktop-grid"]')).toBeHidden();

    // La vue mobile est visible
    const mobileView = page.locator('[data-testid="planning-mobile-view"]');
    await expect(mobileView).toBeVisible();

    // Sélecteur 7 pastilles
    const pills = page.locator('[data-testid="mobile-day-selector"] button');
    await expect(pills).toHaveCount(7);

    // 3 sections présentes : Arrivées, Départs, En séjour
    await expect(mobileView).toContainText('Arrivées');
    await expect(mobileView).toContainText('Départs');
    await expect(mobileView).toContainText('En séjour');

    // Clic sur une carte mobile -> ouvre le panneau de détail en bas
    const firstMobileCard = page.locator('[data-testid^="mobile-card-"]').first();
    await firstMobileCard.click();

    const drawer = page.locator('[data-testid="planning-detail-drawer"]');
    await expect(drawer).toBeVisible();

    // Fermer le tiroir via le bouton close
    await page.locator('[data-testid="drawer-close-btn"]').click();
    await expect(drawer).not.toBeVisible();

    // Le bouton "+ Nouvelle réservation" reste fixé en bas
    const floatingBtn = page.locator('[data-testid="mobile-floating-new-btn"]');
    await expect(floatingBtn).toBeVisible();
  });
});
