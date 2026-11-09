import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Photos des 12 Chambres - Affichage, Unicité, Poids et Mode Hors Ligne', () => {
  const imagesChambresDir = path.resolve(
    __dirname,
    '../public/assets/images/chambres'
  );

  test('Vérification stricte du poids des images (< 250 Ko par fichier)', async () => {
    expect(fs.existsSync(imagesChambresDir)).toBe(true);

    const files = fs.readdirSync(imagesChambresDir);
    expect(files.length).toBeGreaterThanOrEqual(12);

    const MAX_ALLOWED_BYTES = 250 * 1024; // 250 Ko strict

    for (const file of files) {
      const fullPath = path.join(imagesChambresDir, file);
      const stats = fs.statSync(fullPath);
      const sizeKo = stats.size / 1024;

      expect(
        stats.size,
        `Le fichier ${file} pèse ${sizeKo.toFixed(1)} Ko, ce qui dépasse le plafond de 250 Ko`,
      ).toBeLessThan(MAX_ALLOWED_BYTES);
    }
  });

  test('Écran /chambres : les 12 cartes affichent 12 photos DIFFÉRENTES, chargées et sans erreur', async ({
    page,
  }) => {
    // Écouter les requêtes externes pour prouver qu'aucune ressource distante n'est appelée
    const externalRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (
        !url.startsWith('http://localhost') &&
        !url.startsWith('data:') &&
        !url.startsWith('file:')
      ) {
        externalRequests.push(url);
      }
    });

    await page.goto('/chambres', { waitUntil: 'networkidle' });

    // Aucune requête vers des domaines externes
    expect(externalRequests).toEqual([]);

    const cards = page.locator('app-room-status-card');
    await expect(cards).toHaveCount(12);

    const loadedSrcs = new Set<string>();

    for (let i = 0; i < 12; i++) {
      const card = cards.nth(i);
      await card.scrollIntoViewIfNeeded();
      const img = card.locator('img');
      await expect(img).toBeVisible();

      // Vérification du texte alternatif
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
      expect(alt!.length).toBeGreaterThan(10);

      // Vérification que l'image est réellement décodée et affichée (pas d'image cassée)
      await expect.poll(async () => {
        return await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0 && el.naturalHeight > 0);
      }, { timeout: 5000 }).toBe(true);

      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      loadedSrcs.add(src!);
    }

    // Règle absolue : 12 photos TOUTES DIFFÉRENTES
    expect(loadedSrcs.size).toBe(12);
  });

  test('Écran /chambres : affichage hors ligne complet sans réseau', async ({
    page,
    context,
  }) => {
    // 1. Premier chargement en ligne pour charger toutes les photos dans le cache du navigateur
    await page.goto('/chambres', { waitUntil: 'networkidle' });
    const cards = page.locator('app-room-status-card');
    await expect(cards).toHaveCount(12);

    for (let i = 0; i < 12; i++) {
      await cards.nth(i).scrollIntoViewIfNeeded();
    }
    await page.waitForTimeout(500);

    // 2. Coupure réseau totale
    await context.setOffline(true);
    await page.waitForTimeout(300);

    // 3. Navigation et interactions hors ligne (filtrage des chambres alimenté par IndexedDB)
    const libreBtn = page.locator('button', { hasText: 'Libre' }).first();
    if (await libreBtn.isVisible()) {
      await libreBtn.click();
      await page.waitForTimeout(300);
      const allBtn = page.locator('button', { hasText: 'Toutes' }).first();
      if (await allBtn.isVisible()) {
        await allBtn.click();
        await page.waitForTimeout(300);
      }
    }

    const offlineCards = page.locator('app-room-status-card');
    await expect(offlineCards).toHaveCount(12);

    for (let i = 0; i < 12; i++) {
      const card = offlineCards.nth(i);
      await card.scrollIntoViewIfNeeded();
      const img = card.locator('img');
      await expect(img).toBeVisible();
      await expect.poll(async () => {
        return await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
      }, { timeout: 5000 }).toBe(true);
    }

    // Rétablissement réseau
    await context.setOffline(false);
  });

  test('Tableau de bord mobile : le bloc « État des 12 chambres » affiche les photos des chambres', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    const matrixCards = page.locator('#roomsMatrix > div');
    await expect(matrixCards).toHaveCount(12);

    const mobilePhotos = new Set<string>();

    for (let i = 0; i < 12; i++) {
      const card = matrixCards.nth(i);
      await card.scrollIntoViewIfNeeded();
      const img = card.locator('img');
      await expect(img).toBeVisible();

      await expect.poll(async () => {
        return await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0);
      }, { timeout: 5000 }).toBe(true);

      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
      mobilePhotos.add(src!);
    }

    // 12 photos distinctes sur mobile
    expect(mobilePhotos.size).toBe(12);
  });
});
