import { test, expect } from '@playwright/test';

test.describe('Modal Nouvelle Réservation (Fidélité & Interaction PMS)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
  });

  test('devrait ouvrir le modal depuis le bouton En-tête "+ Nouvelle réservation"', async ({ page }) => {
    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).not.toBeVisible();

    // Clic sur le bouton de l'en-tête
    const headerBtn = page.locator('[data-testid="header-new-reservation-btn"]');
    await expect(headerBtn).toBeVisible();
    await headerBtn.click();

    // Vérifier visibilité du modal et de son titre
    await expect(modal).toBeVisible();
    await expect(modal.locator('h2')).toContainText('Nouvelle réservation');
    await expect(modal).toContainText('Boutique 12 Clés');
    await expect(modal).toContainText('Thiès Grand Standing');
  });

  test('devrait ouvrir le modal pré-rempli depuis une case libre du planning', async ({ page }) => {
    await page.goto('/planning', { waitUntil: 'networkidle' });

    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).not.toBeVisible();

    // Clic sur l'emplacement libre de la Chambre 106
    const slot106 = page.locator('[data-testid="planning-empty-slot-106"]');
    await expect(slot106).toBeVisible();
    await slot106.click();

    await expect(modal).toBeVisible();
    // La catégorie Standard et la chambre 106 doivent être sélectionnées
    const roomSelect = page.locator('[data-testid="select-room"]');
    await expect(roomSelect).toBeVisible();
    await expect(roomSelect).toHaveValue('106');
  });

  test('devrait afficher les données tarifaires par défaut conformes à la maquette', async ({ page }) => {
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    // Client par défaut : M. Ibrahima Ndiaye (reproduction fidèle du Cardex)
    await expect(modal).toContainText('M. Ibrahima Ndiaye');
    await expect(modal).toContainText('VIP Prestige');

    // Catégorie Deluxe sélectionnée par défaut (130 000 FCFA)
    const deluxeCard = page.locator('[data-testid="category-card-Deluxe"]');
    await expect(deluxeCard).toContainText('130 000');
    await expect(deluxeCard).toContainText('Recommandé');

    // Récapitulatif tarifaire (3 nuits, 2 adultes, 1 enfant)
    // Hébergement : 390 000 FCFA
    // Lit supp enfant : 25 000 FCFA
    // Navette AIBD : 35 000 FCFA
    // Taxe de séjour : 6 000 FCFA
    // Total TTC : 456 000 FCFA
    // Acompte perçu Wave : 150 000 FCFA
    // Solde restant dû : 306 000 FCFA
    const totalTtc = page.locator('[data-testid="total-ttc-amount"]');
    await expect(totalTtc).toContainText('456');
    await expect(totalTtc).toContainText('FCFA');

    const soldeDu = page.locator('[data-testid="remaining-balance-amount"]');
    await expect(soldeDu).toContainText('306');
    await expect(soldeDu).toContainText('FCFA');
  });

  test('devrait recalculer le montant en direct lors du changement de catégorie', async ({ page }) => {
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    // Passer à Standard (85 000 FCFA/nuit * 3 = 255 000 + extras 66 000 = 321 000 TTC)
    await page.locator('[data-testid="category-card-Standard"]').click();
    const totalTtc = page.locator('[data-testid="total-ttc-amount"]');
    await expect(totalTtc).toContainText('321');
    await expect(totalTtc).toContainText('FCFA');

    // Passer à Suite (210 000 FCFA/nuit * 3 = 630 000 + extras 66 000 = 696 000 TTC)
    await page.locator('[data-testid="category-card-Suite"]').click();
    await expect(totalTtc).toContainText('696');
    await expect(totalTtc).toContainText('FCFA');
  });

  test('devrait basculer entre Client régulier et Nouveau client avec validation', async ({ page }) => {
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    const submitBtn = page.locator('[data-testid="btn-submit-reservation"]');

    // Mode régulier : valide par défaut
    await expect(submitBtn).toBeEnabled();

    // Basculer en nouveau client
    await page.locator('[data-testid="guest-mode-new"]').click();

    // Formulaire vide au départ -> bouton désactivé
    await expect(submitBtn).toBeDisabled();

    // Remplir le nom et téléphone
    await page.locator('#new-guest-name').fill('Aminata Fall');
    await page.locator('#new-guest-phone').fill('+221 77 123 45 67');

    // Le bouton doit redevenir actif
    await expect(submitBtn).toBeEnabled();

    // Rebasculer en régulier
    await page.locator('[data-testid="guest-mode-regular"]').click();
    await expect(submitBtn).toBeEnabled();
    await expect(page.locator('[data-testid="modal-nouvelle-reservation"]')).toContainText('M. Ibrahima Ndiaye');
  });

  test('devrait fermer le modal avec la touche Échap et le clic sur la croix', async ({ page }) => {
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    // Échap pour fermer
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();

    // Rouvrir et fermer avec la croix
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    await expect(modal).toBeVisible();
    await page.locator('[data-testid="btn-close-modal"]').click();
    await expect(modal).not.toBeVisible();
  });

  test('devrait soumettre la réservation et afficher le toast de confirmation', async ({ page }) => {
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    // Clic sur "Confirmer & Émettre la réservation"
    const submitBtn = page.locator('[data-testid="btn-submit-reservation"]');
    await submitBtn.click();

    // Modal fermé
    await expect(modal).not.toBeVisible();

    // Toast de succès visible
    const toast = page.locator('[data-testid="toast-reservation-success"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Réservation confirmée avec succès !');
    await expect(toast).toContainText('Bon émis avec succès');
  });
});
