import { test, expect } from '@playwright/test';
import { loginViaUi } from './auth-e2e.helper';

test.describe('Suppression du mode démonstration et continuité du planning (E2E)', () => {
  test.setTimeout(90_000);

  test('la page d’accueil ne contient plus « Démonstration » ni « Réinitialiser » et le planning fonctionne', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page);

    await expect(page.locator('[data-testid="btn-reset-demo"]')).toHaveCount(0);
    const homeText = (await page.locator('body').textContent()) ?? '';
    expect(homeText).not.toMatch(/démonstration/i);
    expect(homeText).not.toMatch(/réinitialiser/i);

    await page.goto('/planning', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="planning-page"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="planning-desktop-grid"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-testid="day-header-0"]')).toBeVisible();
  });
});
