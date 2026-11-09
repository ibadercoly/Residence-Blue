import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

test.describe('Fidélité Visuelle - Rendu Hors Ligne vs Référence', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const compDir = path.join(repoRoot, 'docs/design/comparaisons');

  test.beforeAll(() => {
    if (!fs.existsSync(compDir)) {
      fs.mkdirSync(compDir, { recursive: true });
    }
  });

  test('Fidélité Tableau de Bord Bureau (1280x1600) vs design/reference/tableau_de_bord.html', async ({ page }) => {
    const width = 1280;
    const height = 1600;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/tableau_de_bord.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées et visuels sur la référence
    await page.evaluate(() => {
      // Masquer la bannière hero (visuel et adaptation textuelle pour Thiès)
      const hero = document.querySelector('section.relative.w-full.rounded-2xl');
      if (hero) (hero as HTMLElement).style.visibility = 'hidden';

      // Masquer le widget météo de la barre latérale
      const sidebarFooter = document.querySelector('aside .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      // Masquer la carte météo
      const weatherWidget = document.querySelector('#weather-widget-title')?.closest('section');
      if (weatherWidget) (weatherWidget as HTMLElement).style.visibility = 'hidden';

      // Masquer les zones balisées
      document.querySelectorAll('[data-photo-zone], [data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_tableau_de_bord.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées et visuels sur l'application Angular
    await page.evaluate(() => {
      const heroEl = document.querySelector('app-hero-banner');
      if (heroEl) (heroEl as HTMLElement).style.visibility = 'hidden';

      const sidebarFooter = document.querySelector('app-sidebar .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      const weatherEl = document.querySelector('app-weather-widget');
      if (weatherEl) (weatherEl as HTMLElement).style.visibility = 'hidden';

      document.querySelectorAll('[data-photo-zone], [data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_tableau_de_bord.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_tableau_de_bord.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Bureau (1280x1600) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Fidélité Tableau de Bord Mobile (390x1600) vs design/reference/tableau_de_bord_mode_clair.html', async ({ page }) => {
    const width = 390;
    const height = 1600;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence mobile hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/tableau_de_bord_mode_clair.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage sur la référence mobile
    await page.evaluate(() => {
      // Masquer les en-têtes photos si présentes
      document.querySelectorAll('[data-photo-zone]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Masquer le bandeau de statut et les zones adaptées
      const statusStrip = document.querySelector('section > div.relative.overflow-hidden.rounded-xl.bg-gradient-to-r');
      if (statusStrip) (statusStrip as HTMLElement).style.visibility = 'hidden';

      const subTitle = document.querySelector('section div.flex.flex-col.min-w-0 > p');
      if (subTitle) (subTitle as HTMLElement).style.visibility = 'hidden';

      const roomsSub = document.querySelector('h3.font-headline-sm')?.parentElement?.querySelector('p');
      if (roomsSub) (roomsSub as HTMLElement).style.visibility = 'hidden';

      const logoImg = document.querySelector('header img');
      if (logoImg) (logoImg as HTMLElement).style.visibility = 'hidden';
      const avatarImg = document.querySelector('header .pl-1 img');
      if (avatarImg) (avatarImg as HTMLElement).style.visibility = 'hidden';

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const refMobilePath = path.join(compDir, 'ref_tableau_de_bord_mode_clair.png');
    await page.screenshot({ path: refMobilePath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular en vue mobile 390px
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage sur l'application Angular
    await page.evaluate(() => {
      document.querySelectorAll('[data-photo-zone]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      const logoImg = document.querySelector('header img');
      if (logoImg) (logoImg as HTMLElement).style.visibility = 'hidden';
      const avatarImg = document.querySelector('header [data-testid="user-profile-mobile"]');
      if (avatarImg) (avatarImg as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(200);

    const actualMobilePath = path.join(compDir, 'actual_tableau_de_bord_mode_clair.png');
    await page.screenshot({ path: actualMobilePath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refMobilePath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualMobilePath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_tableau_de_bord_mode_clair.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Mobile (390x1600) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Vérification du profil utilisateur et du thème clair unique (aucun mode sombre)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    const userProfile = page.getByTestId('user-profile');
    await expect(userProfile).toBeVisible();

    // Règle AGENTS.md : pas de classe 'dark', pas de mode sombre
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(false);

    // Vérifier l'absence de bouton de bascule de thème sombre
    const toggleButton = page.getByTestId('theme-toggle');
    await expect(toggleButton).toHaveCount(0);
  });
});
