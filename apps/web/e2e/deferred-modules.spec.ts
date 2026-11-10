import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Isolation et Exclusion des Modules Reportés (V2 / V3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
  });

  test('aucun code ou symbole des modules reportés n\'est présent dans le bundle initial', () => {
    const distBrowserDir = path.resolve(process.cwd(), 'apps/web/dist/residence-blue-web/browser');
    if (!fs.existsSync(distBrowserDir)) {
      test.skip();
      return;
    }

    const files = fs.readdirSync(distBrowserDir);
    const mainJs = files.find(f => f.startsWith('main-') && f.endsWith('.js'));
    expect(mainJs).toBeDefined();

    const mainContent = fs.readFileSync(path.join(distBrowserDir, mainJs!), 'utf8');

    // Mots-clés / composants de modules reportés qui ne doivent JAMAIS fuiter dans le bundle initial
    const deferredSignatures = [
      'HousekeepingPageComponent',
      'MaintenancePageComponent',
      'InventoryPageComponent',
      'MarketingPageComponent',
      'ChannelManagerComponent',
      'AccountingPageComponent',
      'syscohada-ledger',
      'chambres-blanches',
    ];

    for (const sig of deferredSignatures) {
      expect(mainContent).not.toContain(sig);
    }
  });

  test('les entrées de menu des modules reportés ne sont pas affichées dans la barre latérale', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*tableau-de-bord/);
    await page.waitForLoadState('networkidle');

    // Vérifier l'absence formelle de tout lien de navigation vers les modules reportés
    const deferredRoutes = ['/housekeeping', '/maintenance', '/stocks', '/parametres', '/marketing', '/comptabilite'];
    for (const route of deferredRoutes) {
      const link = page.locator(`aside a[href="${route}"]`);
      await expect(link).toHaveCount(0);
    }

    // Le nombre de liens du menu principal est <= 7
    const navLinks = page.locator('aside nav a');
    const count = await navLinks.count();
    expect(count).toBeLessThanOrEqual(7);
  });

  test('la navigation directe vers un module reporté est rejetée (canMatch) et redirigée', async ({ page }) => {
    // Navigation directe vers une route protégée par canMatch
    await page.goto('/housekeeping');
    await expect(page).toHaveURL(/.*tableau-de-bord/);
  });
});
