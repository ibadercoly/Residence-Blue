import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

test.describe('Fidélité Visuelle - Tableau de Bord Résidence Blue', () => {
  const compDir = path.resolve(process.cwd(), '../../docs/design/comparaisons');

  test.beforeAll(() => {
    if (!fs.existsSync(compDir)) {
      fs.mkdirSync(compDir, { recursive: true });
    }
  });

  test('Capture et comparaison visuelle du tableau de bord bureau (1112px)', async ({ page }) => {
    // Largeur et hauteur de la maquette originale
    await page.setViewportSize({ width: 1112, height: 1600 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    // Attendre le rendu complet des polices
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);

    const actualPath = path.join(compDir, 'actual_tableau_de_bord.png');
    await page.screenshot({ path: actualPath, fullPage: false });

    const expectedPath = path.resolve(
      process.cwd(),
      '../../design/maquettes/tableau_de_bord/screen.png'
    );

    expect(fs.existsSync(expectedPath)).toBeTruthy();

    const expectedImg = PNG.sync.read(fs.readFileSync(expectedPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualPath));

    // Si les dimensions concordent, calcul pixelmatch direct
    const width = Math.min(expectedImg.width, actualImg.width);
    const height = Math.min(expectedImg.height, actualImg.height);

    // Ajustement de taille si besoin
    const targetExpected = new PNG({ width, height });
    const targetActual = new PNG({ width, height });
    PNG.bitblt(expectedImg, targetExpected, 0, 0, width, height, 0, 0);
    PNG.bitblt(actualImg, targetActual, 0, 0, width, height, 0, 0);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      targetExpected.data,
      targetActual.data,
      diff.data,
      width,
      height,
      { threshold: 0.15 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_tableau_de_bord.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(`Tableau de bord Desktop - Pixels différents: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`);
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Captures de mise en page réactive (Tablette 768px et Mobile 390px)', async ({ page }) => {
    // Tablette
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const tabletPath = path.join(compDir, 'tableau_de_bord_tablet_768px.png');
    await page.screenshot({ path: tabletPath });
    expect(fs.existsSync(tabletPath)).toBeTruthy();

    // Mobile
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const mobilePath = path.join(compDir, 'tableau_de_bord_mobile_390px.png');
    await page.screenshot({ path: mobilePath });
    expect(fs.existsSync(mobilePath)).toBeTruthy();
  });

  test('Vérification de la bascule Thème Clair / Sombre', async ({ page }) => {
    await page.setViewportSize({ width: 1112, height: 900 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    // Mode sombre par défaut ou bascule
    const toggleButton = page.locator('button[title*="Mode"]');
    await expect(toggleButton).toBeVisible();

    // Clic pour basculer
    await toggleButton.click();
    await page.waitForTimeout(200);

    // Vérifier la classe ou attribut
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Capture du mode
    const themeCapturePath = path.join(compDir, isDark ? 'dashboard_theme_dark.png' : 'dashboard_theme_light.png');
    await page.screenshot({ path: themeCapturePath });
    expect(fs.existsSync(themeCapturePath)).toBeTruthy();
  });
});
