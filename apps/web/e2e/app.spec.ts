import { test, expect } from '@playwright/test';

test.describe('Résidence Blue - Application Web Standalone', () => {
  test('doit afficher le titre de l’hôtel et l’état en ligne', async ({ page }) => {
    await page.goto('/');

    // Vérification du titre de marque
    await expect(page.locator('.brand-title')).toContainText('Résidence Blue');

    // Vérification de l'indicateur d'état réseau
    await expect(page.locator('.sync-status-indicator')).toBeVisible();

    // Vérification du catalogue des 12 chambres
    await expect(page.locator('.room-card')).toHaveCount(12);

    // Vérification de la devise FCFA en entiers
    const firstRoomPrice = page.locator('.price-value').first();
    await expect(firstRoomPrice).toContainText('FCFA');
  });
});
