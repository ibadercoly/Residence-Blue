import { test, expect } from '@playwright/test';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

test.describe('Restaurant POS — sans carte d information de suivi', () => {
  const emails: string[] = [];

  test.afterAll(() => {
    if (emails.length > 0) {
      deleteE2eUsers(emails);
    }
  });

  test('affiche directement les categories et la prise de commande sans section Suivi des commandes envoyees', async ({
    page,
  }) => {
    const dir = createE2eUser('DIRECTION');
    emails.push(dir.email);

    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaUi(page, dir.email, dir.password);
    await page.goto('/restaurant', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('[data-testid="restaurant-pos-page"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="link-kitchen"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="pos-tracking-cards-section"]')).toHaveCount(0);
    await expect(page.locator('[data-testid^="pos-order-card-"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="pos-categories-bar"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-orders-scroll"]')).toBeVisible();
  });
});
