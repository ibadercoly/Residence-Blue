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

  test('Capture et comparaison visuelle du tableau de bord (1112x1600)', async ({ page }) => {
    // Largeur et hauteur exactes de la maquette design/maquettes/tableau_de_bord/screen.png
    await page.setViewportSize({ width: 1112, height: 1600 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const actualPath = path.join(compDir, 'actual_tableau_de_bord.png');
    await page.screenshot({ path: actualPath, animations: 'disabled', fullPage: false });

    const expectedPath = path.resolve(
      process.cwd(),
      '../../design/maquettes/tableau_de_bord/screen.png'
    );

    expect(fs.existsSync(expectedPath)).toBeTruthy();

    const expectedImg = PNG.sync.read(fs.readFileSync(expectedPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualPath));

    expect(actualImg.width).toBe(expectedImg.width);
    expect(actualImg.height).toBe(expectedImg.height);

    const { width, height } = expectedImg;
    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      expectedImg.data,
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
      `Tableau de bord (1112x1600) - Pixels différents: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Capture et comparaison visuelle de tableau_de_bord_mode_clair (292x1600)', async ({ browser }) => {
    // La maquette mobile (292x1600) est un export haute densité 390x2137 réduit à 292x1600
    const context = await browser.newContext({
      viewport: { width: 292, height: 1600 },
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.goto('http://localhost:4200/tableau-de-bord', { waitUntil: 'networkidle' });

    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const rawShot = PNG.sync.read(await page.screenshot({ animations: 'disabled', fullPage: false }));
    await context.close();

    // Sous-échantillonnage 2x2 vers 292x1600
    const width = 292;
    const height = 1600;
    const actualImg = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const di = (y * width + x) * 4;
        const i00 = (y * 2 * (width * 2) + x * 2) * 4;
        const i10 = (y * 2 * (width * 2) + (x * 2 + 1)) * 4;
        const i01 = ((y * 2 + 1) * (width * 2) + x * 2) * 4;
        const i11 = ((y * 2 + 1) * (width * 2) + (x * 2 + 1)) * 4;
        for (let c = 0; c < 3; c++) {
          actualImg.data[di + c] = Math.round(
            (rawShot.data[i00 + c] +
              rawShot.data[i10 + c] +
              rawShot.data[i01 + c] +
              rawShot.data[i11 + c]) /
              4
          );
        }
        actualImg.data[di + 3] = 255;
      }
    }

    const actualPath = path.join(compDir, 'actual_tableau_de_bord_mode_clair.png');
    fs.writeFileSync(actualPath, PNG.sync.write(actualImg));

    const expectedPath = path.resolve(
      process.cwd(),
      '../../design/maquettes/tableau_de_bord_mode_clair/screen.png'
    );
    expect(fs.existsSync(expectedPath)).toBeTruthy();

    const expectedImg = PNG.sync.read(fs.readFileSync(expectedPath));
    expect(actualImg.width).toBe(expectedImg.width);
    expect(actualImg.height).toBe(expectedImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      expectedImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.28 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_tableau_de_bord_mode_clair.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Tableau de bord mode clair (292x1600) - Pixels différents: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Captures de mise en page réactive (Tablette 768px et Mobile 390px)', async ({ page }) => {
    // Tablette 768px
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);

    // Vérifier que la mise en page reste propre sans débordement horizontal
    const tabletOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(tabletOverflow).toBe(false);

    const tabletPath = path.join(compDir, 'tableau_de_bord_tablette_768px.png');
    await page.screenshot({ path: tabletPath, animations: 'disabled' });
    expect(fs.existsSync(tabletPath)).toBeTruthy();

    // Mobile 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(200);

    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(mobileOverflow).toBe(false);

    const mobilePath = path.join(compDir, 'tableau_de_bord_mobile_390px.png');
    await page.screenshot({ path: mobilePath, animations: 'disabled' });
    expect(fs.existsSync(mobilePath)).toBeTruthy();
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
