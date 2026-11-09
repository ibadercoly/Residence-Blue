import { test, expect } from '@playwright/test';

test.describe('Écran Exports & Rapports Officiels V1', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/exports');
    await page.waitForLoadState('networkidle');
  });

  test('affiche l\'en-tête, le profil opérateur et la mention de sécurité', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Exports & Rapports Officiels');
    await expect(page.locator('text=Sécurité certifiée : neutralisation automatique des formules de tableur')).toBeVisible();
  });

  test('affiche les modèles de documents disponibles pour le rôle', async ({ page }) => {
    const docCards = page.locator('[data-testid^="doc-card-"]');
    const count = await docCards.count();
    expect(count).toBeGreaterThanOrEqual(5);

    // Vérifier présence des documents essentiels
    await expect(page.locator('text=Facture du séjour').first()).toBeVisible();
    await expect(page.locator('text=Arrivées et départs du jour').first()).toBeVisible();
    await expect(page.locator('text=État des chambres').first()).toBeVisible();
    await expect(page.locator('text=Clôture de caisse journalière').first()).toBeVisible();
  });

  test('la sélection d\'un document avec dates affiche les filtres de période', async ({ page }) => {
    // Sélectionner 'Ventes Restaurant & Piscine' (qui requiert une plage de dates)
    const salesCard = page.locator('[data-testid="doc-card-RESTAURANT_POOL_SALES_EXCEL"]');
    await salesCard.click();

    await expect(page.locator('text=Plage de dates (12 mois maximum)')).toBeVisible();
    await expect(page.locator('button:has-text("Aujourd\'hui")')).toBeVisible();
    await expect(page.locator('button:has-text("Ce mois")')).toBeVisible();
  });

  test('génère un export et ajoute une ligne dans le journal d\'audit', async ({ page }) => {
    // Sélectionner l'état des chambres (PDF)
    const roomStatusCard = page.locator('[data-testid="doc-card-ROOMS_STATUS_PDF"]');
    await roomStatusCard.click();

    const generateBtn = page.locator('[data-testid="btn-generate-export"]');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();

    // Attendre le message de succès
    await expect(page.locator('text=généré avec succès')).toBeVisible({ timeout: 10000 });

    // Vérifier l'ajout dans le journal d'audit
    const auditTable = page.locator('table');
    await expect(auditTable).toBeVisible();
    await expect(auditTable.locator('text=État des chambres').first()).toBeVisible();
  });
});
