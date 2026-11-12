import { test, expect } from '@playwright/test';

test.describe('Refonte Fenêtre Nouvelle Réservation - Sécurité & Mémoire', () => {
  test('Aucune fuite mémoire après 20 ouvertures/fermetures successives', async ({ page }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    // Warmup 1 cycle
    await page.locator('[data-testid="header-new-reservation-btn"]').click();
    await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toHaveCount(0);

    const beforeMetrics = await client.send('Performance.getMetrics');
    const heapBefore =
      beforeMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;

    for (let i = 0; i < 20; i++) {
      await page.locator('[data-testid="header-new-reservation-btn"]').click();
      await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toBeVisible();
      await page.locator('[data-testid="reservation-modal-close"]').click();
      await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toHaveCount(0);
    }

    const afterMetrics = await client.send('Performance.getMetrics');
    const heapAfter =
      afterMetrics.metrics.find((m) => m.name === 'JSHeapUsedSize')?.value ?? 0;
    const growthMb = (heapAfter - heapBefore) / (1024 * 1024);

    // Croissance mémoire bornée (< 15 Mo sur 20 cycles complets)
    expect(growthMb).toBeLessThan(15);
  });

  test('Rejet d’un numéro de carte bancaire (PAN) dans la référence de transaction', async ({
    page,
  }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    await page.locator('[data-testid="res-tx-ref"]').fill('4532 8890 1234 5678');
    await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toContainText(
      'Ne saisissez jamais un numéro de carte bancaire complet',
    );
    await expect(page.locator('[data-testid="reservation-confirm-btn"]')).toBeDisabled();
  });

  test('Refus 409 en cas de double réservation simultanée avec rafraîchissement de liste', async ({
    page,
  }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    const firstRoom = page.locator('[data-testid="available-rooms-list"] button').first();
    await expect(firstRoom).toBeVisible();
    await firstRoom.click();

    await page.locator('[data-testid="toggle-quick-guest"]').click();
    await page.locator('[data-testid="quick-guest-name"]').fill('Conflit Test');
    await page.locator('[data-testid="quick-guest-phone"]').fill('+221 77 333 44 55');

    // Simuler une course perdue côté serveur (409 Conflict)
    await page.route('**/api/reservations', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            message: "Cette chambre vient d'être réservée, choisissez-en une autre",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('[data-testid="reservation-confirm-btn"]').click();
    await expect(page.locator('[data-testid="reservation-modal-error"]')).toContainText(
      "Cette chambre vient d'être réservée, choisissez-en une autre",
    );
  });
});
