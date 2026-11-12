import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

const TINY_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000004000000040802000000269309290000000970485973000003e8000003e801b57b526b0000000f4944415408996360c8284520e2380060130dd11622e1ad0000000049454e44ae426082',
  'hex',
);

const PREFIX = 'CI_E2E_';

function cleanupCartesImagesE2eData() {
  execE2eNodeScript(`
    const fs = require('fs');
    const path = require('path');
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const prods = await p.restaurantProduct.findMany({
        where: { name: { startsWith: '${PREFIX}' } },
        select: { id: true, photoUrl: true, thumbnailUrl: true },
      });
      const uploadsDir = path.resolve('uploads/restaurant');
      for (const prod of prods) {
        for (const u of [prod.photoUrl, prod.thumbnailUrl]) {
          if (!u) continue;
          const file = u.split('/').pop();
          if (file) {
            const full = path.join(uploadsDir, file);
            if (fs.existsSync(full)) fs.unlinkSync(full);
          }
        }
      }
      if (prods.length) {
        const ids = prods.map((x) => x.id);
        await p.restaurantOrderLine.deleteMany({ where: { productId: { in: ids } } });
        await p.restaurantProduct.deleteMany({ where: { id: { in: ids } } });
      }
      await p.restaurantCategory.deleteMany({
        where: { name: { startsWith: '${PREFIX}' } },
      });
      await p.$disconnect();
    })();
  `);
}

function seed60Products(withImageId: string, uploadedThumbUrl: string) {
  return execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const cat = await p.restaurantCategory.upsert({
        where: { name: '${PREFIX}Carte 60' },
        update: { isArchived: false },
        create: { name: '${PREFIX}Carte 60', displayOrder: 99, isArchived: false },
      });
      const batch = [];
      for (let i = 1; i <= 56; i++) {
        batch.push({
          categoryId: cat.id,
          name: '${PREFIX}Plat Perf ' + String(i).padStart(2, '0'),
          priceFcfa: 2500 + i * 100,
          status: 'AVAILABLE',
          prepStation: 'CUISINE',
          displayOrder: 100 + i,
          thumbnailUrl: i <= 10 ? ${JSON.stringify(uploadedThumbUrl)} : null,
        });
      }
      await p.restaurantProduct.createMany({ data: batch });
      console.log(JSON.stringify({ catId: cat.id, withImageId: ${JSON.stringify(withImageId)} }));
      await p.$disconnect();
    })();
  `);
}

test.describe('Restaurant V3 — Cartes images 4/3, SVG défaut, Épuisé, 60 produits & Responsive', () => {
  let dirUser: { email: string; password: string };
  let prodWithImgId = '';
  let prodNoImgId = '';
  let prodBrokenImgId = '';
  let prodSoldOutId = '';
  let uploadedThumbUrl = '';

  test.beforeAll(async ({ request }) => {
    cleanupCartesImagesE2eData();
    dirUser = createE2eUser('DIRECTION');
    const headers = await getApiAuthHeaders(request, dirUser.email, dirUser.password);

    // 1) Créer produit avec vraie miniature 200px uploadée
    const p1 = await request.post('/api/restaurant/products', {
      headers,
      data: {
        name: `${PREFIX}01 Thieb Photo`,
        categoryName: `${PREFIX}Plats`,
        priceFcfa: 4500,
        status: 'AVAILABLE',
      },
    });
    expect(p1.status()).toBe(201);
    prodWithImgId = (await p1.json()).id;

    const imgUpload = await request.post(`/api/restaurant/products/${prodWithImgId}/image`, {
      headers,
      multipart: {
        image: {
          name: 'plat.png',
          mimeType: 'image/png',
          buffer: TINY_PNG,
        },
      },
    });
    expect(imgUpload.status()).toBe(201);
    const uploadedBody = await imgUpload.json();
    uploadedThumbUrl = uploadedBody.thumbnailUrl;
    expect(uploadedThumbUrl).toContain('-200.webp');

    // 2) Créer produit sans image (doit afficher le SVG par défaut)
    const p2 = await request.post('/api/restaurant/products', {
      headers,
      data: {
        name: `${PREFIX}02 Yassa Sans Photo`,
        categoryName: `${PREFIX}Plats`,
        priceFcfa: 4000,
        status: 'AVAILABLE',
      },
    });
    expect(p2.status()).toBe(201);
    prodNoImgId = (await p2.json()).id;

    // 3) Créer produit dont l'URL miniature échoue en 404 (doit basculer sur le SVG sans image cassée)
    const p3 = await request.post('/api/restaurant/products', {
      headers,
      data: {
        name: `${PREFIX}03 Mafé URL Cassée`,
        categoryName: `${PREFIX}Plats`,
        priceFcfa: 3800,
        status: 'AVAILABLE',
      },
    });
    expect(p3.status()).toBe(201);
    prodBrokenImgId = (await p3.json()).id;

    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      (async () => {
        await p.restaurantProduct.update({
          where: { id: ${JSON.stringify(prodBrokenImgId)} },
          data: { thumbnailUrl: '/api/restaurant/products/images/00000000-0000-4000-8000-000000000099-200.webp' },
        });
        await p.$disconnect();
      })();
    `);

    // 4) Créer produit épuisé avec nom long (niveaux de gris + pastille Épuisé + pas de troncature)
    const p4 = await request.post('/api/restaurant/products', {
      headers,
      data: {
        name: `${PREFIX}04 Plateau Fruits de Mer Grillés de Thiès Grand Standing`,
        categoryName: `${PREFIX}Plats`,
        priceFcfa: 9500,
        status: 'SOLD_OUT',
      },
    });
    expect(p4.status()).toBe(201);
    prodSoldOutId = (await p4.json()).id;

    // Ajouter 56 produits pour atteindre ≥ 60 produits et tester la performance & le scroll interne
    seed60Products(prodWithImgId, uploadedThumbUrl);
  });

  test.afterAll(() => {
    cleanupCartesImagesE2eData();
    if (dirUser?.email) deleteE2eUsers([dirUser.email]);
  });

  test('cartes 4/3, miniature 200px, SVG défaut sans image cassée, épuisé, 60 produits & responsive', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dirUser.email, dirUser.password);

    const tStart = Date.now();
    await page.goto('/restaurant', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="pos-products-grid"]')).toBeVisible({ timeout: 15000 });
    await expect
      .poll(async () => page.locator('[data-testid^="product-tile-"]').count(), { timeout: 10000 })
      .toBeGreaterThanOrEqual(60);
    const displayDurationMs = Date.now() - tStart;
    console.log(`PERF_60_PRODUCTS_DISPLAY_MS=${displayDurationMs}`);
    expect(displayDurationMs).toBeLessThan(8000);

    // Filtrer sur la catégorie CI_E2E_Plats pour vérifier nos 4 cas clés à l'écran et faire la capture
    const catPill = page.locator('[data-testid^="cat-pill-"]', { hasText: `${PREFIX}Plats` }).first();
    await expect(catPill).toBeVisible();
    await catPill.click();

    const cardWithImg = page.locator(`[data-testid="product-tile-${prodWithImgId}"]`);
    const cardNoImg = page.locator(`[data-testid="product-tile-${prodNoImgId}"]`);
    const cardBrokenImg = page.locator(`[data-testid="product-tile-${prodBrokenImgId}"]`);
    const cardSoldOut = page.locator(`[data-testid="product-tile-${prodSoldOutId}"]`);

    await expect(cardWithImg).toBeVisible();
    await expect(cardNoImg).toBeVisible();
    await expect(cardBrokenImg).toBeVisible();
    await expect(cardSoldOut).toBeVisible();

    // Attendre que le fallback (error) sur l'image cassée soit passé en SVG data:image/svg+xml
    const imgBroken = cardBrokenImg.locator('img');
    await expect(imgBroken).toHaveAttribute('src', /^data:image\/svg\+xml/);
    await expect(imgBroken).toHaveAttribute('data-default-image', 'true');

    // Vérifier attributs, tailles ≤ 200 px, ratio 4/3 identique, 0 image cassée, 0 troncature
    const imgMetrics = await page.evaluate(
      ([id1, id2, id3, id4]) => {
        const getInfo = (id: string) => {
          const card = document.querySelector(`[data-testid="product-tile-${id}"]`) as HTMLElement;
          const img = card.querySelector('img') as HTMLImageElement;
          const title = card.querySelector('h3') as HTMLElement;
          const rect = img.getBoundingClientRect();
          const style = getComputedStyle(img);
          const titleStyle = getComputedStyle(title);
          return {
            src: img.getAttribute('src') || '',
            alt: img.getAttribute('alt') || '',
            loading: img.getAttribute('loading') || '',
            widthAttr: img.getAttribute('width') || '',
            heightAttr: img.getAttribute('height') || '',
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            renderedW: rect.width,
            renderedH: rect.height,
            objectFit: style.objectFit,
            filter: style.filter,
            titleTextOverflow: titleStyle.textOverflow,
            titleOverflowX: title.scrollWidth > title.clientWidth + 1,
          };
        };
        return {
          withImg: getInfo(id1),
          noImg: getInfo(id2),
          brokenImg: getInfo(id3),
          soldOut: getInfo(id4),
        };
      },
      [prodWithImgId, prodNoImgId, prodBrokenImgId, prodSoldOutId],
    );

    for (const [label, info] of Object.entries(imgMetrics)) {
      expect(info.loading, `${label} loading`).toBe('lazy');
      expect(info.widthAttr, `${label} width attr`).toBe('200');
      expect(info.heightAttr, `${label} height attr`).toBe('150');
      expect(info.complete, `${label} complete`).toBe(true);
      expect(info.naturalWidth, `${label} naturalWidth > 0`).toBeGreaterThan(0);
      expect(info.naturalWidth, `${label} naturalWidth <= 200`).toBeLessThanOrEqual(200);
      expect(info.naturalHeight, `${label} naturalHeight <= 200`).toBeLessThanOrEqual(200);
      expect(info.objectFit, `${label} object-fit`).toBe('cover');
      expect(info.renderedH / info.renderedW, `${label} ratio ~4/3`).toBeCloseTo(0.75, 1);
      expect(info.titleTextOverflow, `${label} no ellipsis`).not.toBe('ellipsis');
      expect(info.titleOverflowX, `${label} title not horizontally clipped`).toBe(false);
    }

    expect(imgMetrics.withImg.src).toContain('-200.webp');
    expect(imgMetrics.withImg.alt).toBe(`${PREFIX}01 Thieb Photo`);
    expect(imgMetrics.noImg.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(imgMetrics.brokenImg.src.startsWith('data:image/svg+xml')).toBe(true);
    expect(imgMetrics.soldOut.filter).toContain('grayscale');
    expect(Math.abs(imgMetrics.withImg.renderedH - imgMetrics.noImg.renderedH)).toBeLessThanOrEqual(1);

    // Plat épuisé : pastille « Épuisé » sur l'image et bouton « + Ajouter » désactivé
    await expect(cardSoldOut.locator('[data-testid="product-sold-out-badge"]')).toContainText('Épuisé');
    await expect(cardSoldOut.locator(`[data-testid="btn-add-product-${prodSoldOutId}"]`)).toBeDisabled();

    // Capture écran comparatif des cartes avec image, SVG défaut et épuisé
    await fs.promises.mkdir(compDir, { recursive: true });
    await page.screenshot({
      path: path.join(compDir, 'actual_restaurant_v3_cartes_images.png'),
      fullPage: false,
    });

    // Interactions : clic carte (image) ajoute 1, clic bouton "+ Ajouter" ajoute 1 (pas de double ajout), clic épuisé ignore
    await cardWithImg.locator('img').click();
    await expect(page.locator('[data-testid="pos-ticket-total"]')).toContainText('4 500 FCFA');

    await cardWithImg.locator(`[data-testid="btn-add-product-${prodWithImgId}"]`).click();
    await expect(page.locator('[data-testid="pos-ticket-total"]')).toContainText('9 000 FCFA');

    await cardNoImg.click();
    await expect(page.locator('[data-testid="pos-ticket-total"]')).toContainText('13 000 FCFA');

    await cardSoldOut.click({ force: true });
    await expect(page.locator('[data-testid="pos-ticket-total"]')).toContainText('13 000 FCFA');

    // Revenir sur "Toutes" (60+ produits) et vérifier le scroll vertical interne visible + aucune image > 200 px
    await page.locator('[data-testid="cat-pill-ALL"]').click();
    const scrollCheck = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="pos-products-scroll"]') as HTMLElement;
      const imgs = Array.from(document.querySelectorAll('[data-testid="pos-products-grid"] img')) as HTMLImageElement[];
      const oversized = imgs.filter((i) => i.naturalWidth > 200 || i.naturalHeight > 200).length;
      return {
        offsetWidth: box.offsetWidth,
        clientWidth: box.clientWidth,
        scrollHeight: box.scrollHeight,
        clientHeight: box.clientHeight,
        imgCount: imgs.length,
        oversized,
      };
    });
    expect(scrollCheck.imgCount).toBeGreaterThanOrEqual(60);
    expect(scrollCheck.oversized).toBe(0);
    expect(scrollCheck.scrollHeight).toBeGreaterThan(scrollCheck.clientHeight);
    expect(scrollCheck.offsetWidth).toBeGreaterThan(scrollCheck.clientWidth);

    // Responsive 360, 768, 1024, 1440 px : zéro débordement horizontal
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(150);
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(ov.sw, `Débordement horizontal à ${width}px`).toBeLessThanOrEqual(ov.cw);
    }
  });
});
