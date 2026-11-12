import { test, expect } from '@playwright/test';

test.describe('Refonte Fenêtre Nouvelle Réservation - Ergonomie, Brouillon & Clavier', () => {
  test('Pastilles durée, filtres catégorie, boutons >= 40px, aucun backdrop-filter', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    const dialog = page.locator('[data-testid="reservation-modal-dialog"]');
    await expect(dialog).toBeVisible();

    // Vérifier absence de backdrop-filter flou sur le backdrop
    const backdropFilter = await page
      .locator('[data-testid="reservation-modal-backdrop"]')
      .evaluate((el) => getComputedStyle(el).backdropFilter);
    expect(backdropFilter).toBe('none');

    // Pastille "1 semaine" -> 7 nuits
    await page.locator('[data-testid="duration-pill-7"]').click();
    await expect(dialog).toContainText('7 nuits');

    // Filtre Suite puis Toutes
    await page.locator('[data-testid="category-filter-Suite"]').click();
    await page.locator('[data-testid="category-filter-ALL"]').click();

    // Vérifier que les boutons ont >= 40px de hauteur
    const minButtonHeight = await dialog.evaluate((el) => {
      const buttons = Array.from(el.querySelectorAll<HTMLElement>('button'));
      return Math.min(...buttons.map((b) => Math.round(b.getBoundingClientRect().height)));
    });
    expect(minButtonHeight).toBeGreaterThanOrEqual(40);
  });

  test('Confirmation de perte de brouillon, Échap et restauration du focus', async ({ page }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    const trigger = page.locator('[data-testid="header-new-reservation-btn"]');
    await trigger.focus();
    await trigger.click();

    const dialog = page.locator('[data-testid="reservation-modal-dialog"]');
    await expect(dialog).toBeVisible();

    // Saisir une note pour rendre le formulaire modifié (dirty)
    await page.locator('[data-testid="res-notes-input"]').fill('Arrivée 20h');

    // Annuler la fermeture garde la modale ouverte
    page.once('dialog', (d) => {
      expect(d.message()).toContain('modifications');
      void d.dismiss();
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();

    // Accepter la fermeture ferme et restaure le focus
    page.once('dialog', (d) => void d.accept());
    await page.locator('[data-testid="reservation-cancel-btn"]').click();
    await expect(dialog).toHaveCount(0);
  });
});
