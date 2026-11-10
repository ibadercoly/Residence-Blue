import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Chambres - Boutons d\'action et Pastilles d\'état réutilisables', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const capturesDir = path.join(repoRoot, 'docs/design/captures/chambres');

  test.beforeAll(() => {
    if (!fs.existsSync(capturesDir)) {
      fs.mkdirSync(capturesDir, { recursive: true });
    }
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE ERROR:', err.message));

    // Réinitialisation propre de la base IndexedDB pour éviter les collisions d'IDs résiduels
    await page.addInitScript(() => {
      try {
        indexedDB.deleteDatabase('residence_blue_db');
      } catch {}
    });

    // Interception des routes API pour fournir les 4 états de chambre + cas extrême de nom très long
    await page.route(/\/api\/rooms(\/.*)?$/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: '00000000-0000-0000-0000-000000000101',
              number: '101',
              floor: 1,
              category: 'Standard',
              status: 'FREE',
              amenities: ['Climatisation', 'Wi-Fi Fibre'],
              type: { id: 't1', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000102',
              number: '102',
              floor: 1,
              category: 'Standard',
              status: 'OCCUPIED',
              amenities: ['Climatisation', 'Minibar', 'Balcon'],
              type: { id: 't2', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000103',
              number: '103',
              floor: 1,
              category: 'Standard',
              status: 'CLEANING',
              amenities: ['Climatisation', 'Baignoire balnéo', 'Salon privé'],
              type: { id: 't3', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000104',
              number: '104',
              floor: 1,
              category: 'Standard',
              status: 'MAINTENANCE',
              amenities: ['Climatisation', 'Terrasse panoramique'],
              type: { id: 't4', name: 'Standard', pricePerNight: 35000 }
            },
            {
              id: '00000000-0000-0000-0000-000000000302',
              number: '302 - Suite Royale Majestueuse et Panoramique Grand Standing Prestige',
              floor: 3,
              category: 'Suite Royale Majestueuse Prestige',
              status: 'OCCUPIED',
              amenities: ['Jacuzzi', 'Piscine privée', 'Majordome'],
              type: { id: 't5', name: 'Suite Royale Majestueuse Prestige', pricePerNight: 250000 }
            }
          ])
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true })
        });
      }
    });
  });

  test('Vérification à 360, 768, 1024 et 1440 px : non-débordement, texte sur une seule ligne et non-chevauchement', async ({ page }) => {
    const viewports = [
      { width: 360, height: 740, label: '360px_mobile' },
      { width: 768, height: 1024, label: '768px_tablet' },
      { width: 1024, height: 768, label: '1024px_laptop' },
      { width: 1440, height: 900, label: '1440px_desktop' }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/chambres');
      await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
      await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

      // 1. Aucun débordement horizontal de la page entière
      const pageMetrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(pageMetrics.scrollWidth, `Débordement horizontal global à ${vp.width}px`).toBeLessThanOrEqual(pageMetrics.clientWidth);

      // 2. Vérification sur les cartes représentant les 4 états
      const cardNumbers = ['101', '102', '103', '104'];
      for (const num of cardNumbers) {
        const card = page.locator(`.room-card[data-room-number="${num}"]`);
        await card.waitFor({ state: 'visible' });
        await expect(card).toBeVisible();

        // Vérification de non-débordement sur la carte et ses boutons
        const overflowCheck = await card.evaluate((cardEl) => {
          const errors: string[] = [];

          // Vérification que la pastille et le titre ne se chevauchent pas
          const titleEl = cardEl.querySelector('.room-title') as HTMLElement | null;
          const badgeEl = cardEl.querySelector('.status-badge-root') as HTMLElement | null;
          const menuEl = cardEl.querySelector('.menu-btn-trigger') as HTMLElement | null;

          if (titleEl && badgeEl) {
            const titleRect = titleEl.getBoundingClientRect();
            const badgeRect = badgeEl.getBoundingClientRect();
            // Chevauchement = intersection des rectangles
            const overlapX = Math.max(0, Math.min(titleRect.right, badgeRect.right) - Math.max(titleRect.left, badgeRect.left));
            const overlapY = Math.max(0, Math.min(titleRect.bottom, badgeRect.bottom) - Math.max(titleRect.top, badgeRect.top));
            if (overlapX > 0 && overlapY > 0) {
              errors.push(`Chevauchement détecté entre titre (${titleRect.left}-${titleRect.right}) et pastille (${badgeRect.left}-${badgeRect.right})`);
            }
          }

          if (badgeEl && menuEl) {
            const badgeRect = badgeEl.getBoundingClientRect();
            const menuRect = menuEl.getBoundingClientRect();
            const overlapX = Math.max(0, Math.min(badgeRect.right, menuRect.right) - Math.max(badgeRect.left, menuRect.left));
            const overlapY = Math.max(0, Math.min(badgeRect.bottom, menuRect.bottom) - Math.max(badgeRect.top, menuRect.top));
            if (overlapX > 0 && overlapY > 0) {
              errors.push(`Chevauchement détecté entre pastille et menu`);
            }
          }

          // Vérification des boutons d'action du bas de carte
          const buttons = cardEl.querySelectorAll('.actions-footer button') as NodeListOf<HTMLButtonElement>;
          buttons.forEach((btn, idx) => {
            // Aucun enfant du pied ne dépasse (scrollWidth <= clientWidth)
            if (btn.scrollWidth > btn.clientWidth + 1) {
              errors.push(`Bouton ${idx} (${btn.innerText}) déborde : scrollWidth ${btn.scrollWidth} > clientWidth ${btn.clientWidth}`);
            }

            // Vérification que le texte du bouton est sur UNE seule ligne
            const textEl = btn.querySelector('.btn-text') as HTMLElement | null;
            if (textEl) {
              const lineCount = textEl.getClientRects().length;
              if (lineCount > 1) {
                errors.push(`Bouton ${idx} (${textEl.innerText}) sur ${lineCount} lignes`);
              }
            }
          });

          return errors;
        });

        expect(overflowCheck, `Erreurs sur chambre ${num} à ${vp.width}px`).toEqual([]);
      }
    }
  });

  test('Cas extrêmes : Nom de chambre très long et texte agrandi à 125 %', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/chambres');
    await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

    // 1. Chambre 302 avec nom très long : aucun chevauchement avec la pastille
    const cardLong = page.locator('.room-card').filter({ hasText: '302' }).first();
    await cardLong.waitFor({ state: 'visible' });
    await expect(cardLong).toBeVisible();

    const checkOverlapLong = await cardLong.evaluate((cardEl) => {
      const titleEl = cardEl.querySelector('.room-title') as HTMLElement;
      const badgeEl = cardEl.querySelector('.status-badge-root') as HTMLElement;
      const tRect = titleEl.getBoundingClientRect();
      const bRect = badgeEl.getBoundingClientRect();
      const overlapX = Math.max(0, Math.min(tRect.right, bRect.right) - Math.max(tRect.left, bRect.left));
      const overlapY = Math.max(0, Math.min(tRect.bottom, bRect.bottom) - Math.max(tRect.top, bRect.top));
      return {
        overlap: overlapX > 0 && overlapY > 0,
        titleRight: tRect.right,
        badgeLeft: bRect.left,
      };
    });
    expect(checkOverlapLong.overlap, 'Le titre très long ne doit jamais chevaucher la pastille').toBe(false);
    expect(checkOverlapLong.titleRight).toBeLessThanOrEqual(checkOverlapLong.badgeLeft + 1);

    // 2. Texte agrandi à 125 %
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '20px'; // 125% de 16px
    });
    await page.waitForTimeout(200);

    const docMetrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(docMetrics.scrollWidth, 'Pas de scroll horizontal avec police à 125%').toBeLessThanOrEqual(docMetrics.clientWidth);

    // Vérifier qu'aucun bouton ne déborde même à 125 %
    const buttonsOverflow = await page.evaluate(() => {
      const btns = document.querySelectorAll('.actions-footer button');
      let count = 0;
      btns.forEach((b) => {
        if (b.scrollWidth > b.clientWidth + 2) count++;
      });
      return count;
    });
    expect(buttonsOverflow).toBe(0);
  });

  test('Captures d’écran des 4 états de carte (Libre, Occupée, Ménage, Maintenance)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/chambres');
    await page.locator('[data-testid="rooms-header"]').waitFor({ state: 'visible' });
    await page.locator('[data-testid="rooms-grid"]').waitFor({ state: 'visible' });

    // Capture des 4 états distincts
    const states = [
      { num: '101', name: 'carte_etat_free.png', expectedBtn: 'Check-in', badgeText: 'Libre' },
      { num: '102', name: 'carte_etat_occupied.png', expectedBtn: 'Check-out', badgeText: 'Occupée' },
      { num: '103', name: 'carte_etat_cleaning.png', expectedBtn: 'Marquer propre', badgeText: 'Ménage' },
      { num: '104', name: 'carte_etat_maintenance.png', expectedBtn: 'Remettre en service', badgeText: 'Maintenance' },
    ];

    for (const s of states) {
      const card = page.locator(`.room-card[data-room-number="${s.num}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator('.status-badge-root')).toContainText(s.badgeText);
      await expect(card.locator('.actions-footer')).toContainText(s.expectedBtn);

      const shotPath = path.join(capturesDir, s.name);
      await card.screenshot({ path: shotPath });
      expect(fs.existsSync(shotPath)).toBe(true);
    }
  });
});
