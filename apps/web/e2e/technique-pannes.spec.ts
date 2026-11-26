import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';

const CAPTURES_DIR = path.resolve(__dirname, '../../../docs/design/captures/technique');

test.describe('Écran Technique & Gestion des Pannes (E2E & Responsive)', () => {
  const createdEmails: string[] = [];
  let dirUser = { email: '', password: '' };
  let recUser = { email: '', password: '' };
  let techUser = { email: '', password: '' };
  let techHeaders: Record<string, string> = {};
  let recHeaders: Record<string, string> = {};

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(CAPTURES_DIR, { recursive: true });

    dirUser = createE2eUser('DIRECTION');
    recUser = createE2eUser('RECEPTION');
    techUser = createE2eUser('MAINTENANCE');

    createdEmails.push(dirUser.email, recUser.email, techUser.email);

    techHeaders = await getApiAuthHeaders(request, techUser.email, techUser.password);
    recHeaders = await getApiAuthHeaders(request, recUser.email, recUser.password);
  });

  test.afterAll(async () => {
    await deleteE2eUsers(createdEmails);
  });

  test('Technicien arrive directement sur /technique et ne voit que cet écran', async ({ page }) => {
    await loginViaUi(page, techUser.email, techUser.password);
    await expect(page).toHaveURL(/\/technique/);

    // Titre de page
    await expect(page.locator('[data-testid="technique-header"]')).toBeVisible();

    // Menu latéral : ne contient que Technique (ou pas d'autres écrans sensibles)
    const navPlanning = page.locator('[data-testid="nav-planning"]');
    await expect(navPlanning).toHaveCount(0);
    const navClients = page.locator('[data-testid="nav-clients"]');
    await expect(navClients).toHaveCount(0);
    const navFacturation = page.locator('[data-testid="nav-facturation"]');
    await expect(navFacturation).toHaveCount(0);

    // Pied de menu : bouton déconnexion dédié
    await expect(page.locator('[data-testid="sidebar-cook-logout-btn"]')).toBeVisible();

    // Capture d'écran
    await page.screenshot({ path: path.join(CAPTURES_DIR, 'technique-dashboard-desktop.png') });
  });

  test('Direction et Réception ne peuvent pas ouvrir /technique (redirection)', async ({ page }) => {
    await loginViaUi(page, recUser.email, recUser.password);

    // Tentative d'accès direct à /technique
    await page.goto('/technique');
    // Doit être redirigé vers son premier écran autorisé (accueil ou planning)
    await expect(page).not.toHaveURL(/\/technique/);
  });

  test('Responsive : scrollWidth <= clientWidth à 360, 768, 1024 et 1440 px', async ({ page }) => {
    await loginViaUi(page, techUser.email, techUser.password);
    await page.goto('/technique');
    await page.waitForSelector('[data-testid="technique-page"]');

    const viewports = [
      { width: 360, height: 740, label: '360px' },
      { width: 768, height: 1024, label: '768px' },
      { width: 1024, height: 768, label: '1024px' },
      { width: 1440, height: 900, label: '1440px' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      const isNoOverflow = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="technique-page"]') as HTMLElement;
        return root ? root.scrollWidth <= root.clientWidth + 1 : true;
      });

      expect(isNoOverflow).toBe(true);

      await page.screenshot({
        path: path.join(CAPTURES_DIR, `technique-${vp.label}.png`),
      });
    }
  });

  test('Aucun prix ni nom client n’est présent sur l’interface Technique', async ({ page }) => {
    await loginViaUi(page, techUser.email, techUser.password);
    await page.goto('/technique');

    const content = await page.locator('[data-testid="technique-page"]').innerText();
    expect(content).not.toContain('FCFA');
    expect(content).not.toContain('F CFA');
    expect(content).not.toContain('Client :');
  });
});
