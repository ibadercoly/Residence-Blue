import { test, expect } from '@playwright/test';

test.describe('Accueil V1 Minimale & Actions Rapides', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('affiche les 4 chiffres clés et exclut météo, graphiques et indicateurs avancés', async ({ page }) => {
    // Vérification des 4 KPI
    const kpisSection = page.locator('[data-testid="kpis-section"]');
    await expect(kpisSection).toBeVisible();
    await expect(page.locator('text=Taux d\'occupation')).toBeVisible();
    await expect(page.locator('text=Arrivées prévues')).toBeVisible();
    await expect(page.locator('text=Départs prévus')).toBeVisible();
    await expect(page.locator('text=Recette du jour')).toBeVisible();

    // Vérification de l'absence des widgets lourds retirés
    await expect(page.locator('app-weather-widget')).toHaveCount(0);
    await expect(page.locator('app-weekly-revenue-chart')).toHaveCount(0);
    await expect(page.locator('app-priority-alerts')).toHaveCount(0);
  });

  test('les 5 boutons d\'action ont une hauteur >= 44px (accessibilité et confort)', async ({ page }) => {
    const buttons = [
      '[data-testid="btn-action-reservation"]',
      '[data-testid="btn-action-arrival"]',
      '[data-testid="btn-action-departure"]',
      '[data-testid="btn-action-room-service"]',
      '[data-testid="btn-action-encaissement"]',
    ];

    for (const selector of buttons) {
      const btn = page.locator(selector);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('action « Nouvelle réservation » ouvre la modale de réservation sans rechargement', async ({ page }) => {
    const btn = page.locator('[data-testid="btn-action-reservation"]');
    await btn.click();

    // La modale doit s'ouvrir
    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();
  });

  test('action « Arrivée » ouvre le dialogue d\'arrivée et confirme le check-in', async ({ page }) => {
    const btn = page.locator('[data-testid="btn-action-arrival"]');
    await btn.click();

    const actionModal = page.locator('[data-testid="dashboard-action-modal"]');
    await expect(actionModal).toBeVisible();
    await expect(page.locator('[data-testid="modal-title"]')).toContainText('Enregistrer une arrivée');

    // Valider le check-in
    await page.locator('[data-testid="btn-modal-confirm"]').click();
    await expect(actionModal).not.toBeVisible();

    // Toast de confirmation affiché
    const toast = page.locator('[data-testid="dashboard-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Arrivée confirmée');
  });

  test('action « Départ » ouvre le dialogue de départ et confirme le check-out', async ({ page }) => {
    const btn = page.locator('[data-testid="btn-action-departure"]');
    await btn.click();

    const actionModal = page.locator('[data-testid="dashboard-action-modal"]');
    await expect(actionModal).toBeVisible();
    await expect(page.locator('[data-testid="modal-title"]')).toContainText('Enregistrer un départ');

    // Fermeture propre par annulation
    await page.locator('[data-testid="btn-modal-cancel"]').click();
    await expect(actionModal).not.toBeVisible();
  });

  test('action « Commande en chambre » redirige vers le restaurant sans recharger', async ({ page }) => {
    const btn = page.locator('[data-testid="btn-action-room-service"]');
    await btn.click();
    await page.waitForURL('**/restaurant');
    expect(page.url()).toContain('restaurant');
  });

  test('action « Encaisser » redirige vers la facturation sans recharger', async ({ page }) => {
    const btn = page.locator('[data-testid="btn-action-encaissement"]');
    await btn.click();
    await page.waitForURL('**/facturation');
    expect(page.url()).toContain('facturation');
  });

  test('bouton de réinitialisation mode démo fonctionne avec confirmation', async ({ page }) => {
    const resetBtn = page.locator('[data-testid="btn-reset-demo"]');
    await expect(resetBtn).toBeVisible();
    await resetBtn.click();

    // Modale d'action de confirmation
    const actionModal = page.locator('[data-testid="dashboard-action-modal"]');
    await expect(actionModal).toBeVisible();
    await expect(page.locator('[data-testid="modal-title"]')).toContainText('données de démo');

    // Valider la réinitialisation
    await page.locator('[data-testid="btn-modal-confirm"]').click();

    // Toast de confirmation affiché
    const toast = page.locator('[data-testid="dashboard-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Données de démonstration réinitialisées avec succès');
  });
});
