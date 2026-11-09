import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

const viewports = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1280x720', width: 1280, height: 720 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 },
];

test.describe('Modal Nouvelle Réservation Compacte (Multi-Viewports & Ergonomie)', () => {
  for (const vp of viewports) {
    test(`devrait respecter les dimensions compactes à ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/tableau-de-bord');
      await page.waitForLoadState('domcontentloaded');

      // 1. Bouton d'ouverture adapté au viewport
      const openBtn = vp.width >= 768
        ? page.locator('[data-testid="header-new-reservation-btn"]')
        : page.locator('[data-testid="header-new-reservation-mobile-btn"]');

      await expect(openBtn).toBeVisible();
      await openBtn.focus();
      await openBtn.click();

      // 2. Vérification de l'ouverture et du verrouillage du défilement d'arrière-plan
      const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
      await expect(modal).toBeVisible();

      const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(bodyOverflow).toBe('hidden');

      // 3. Vérification des dimensions de la fenêtre modale
      const modalWindow = page.locator('.modal-shell-window');
      await expect(modalWindow).toBeVisible();
      const box = await modalWindow.boundingBox();
      expect(box).not.toBeNull();
      if (!box) return;

      console.log(`Viewport ${vp.name} - Modal Window: ${Math.round(box.width)}x${Math.round(box.height)} px`);

      // Largeur : au plus 960 px et ne dépasse jamais l'écran
      expect(box.width).toBeLessThanOrEqual(Math.min(960, vp.width));

      // Hauteur : au plus 88% de l'écran sur bureau/tablette, ou 100% sur mobile sheet (< 768)
      if (vp.width >= 768) {
        const maxExpectedHeight = vp.height * 0.88 + 2;
        expect(box.height).toBeLessThanOrEqual(maxExpectedHeight);
      } else {
        expect(box.height).toBeLessThanOrEqual(vp.height + 1);
      }

      // 4. Le bouton « Confirmer la réservation » est visible sans aucun défilement
      const submitBtn = page.locator('[data-testid="btn-submit-reservation"]');
      await expect(submitBtn).toBeVisible();
      const btnBox = await submitBtn.boundingBox();
      expect(btnBox).not.toBeNull();
      if (btnBox) {
        expect(btnBox.y).toBeGreaterThanOrEqual(0);
        expect(btnBox.y + btnBox.height).toBeLessThanOrEqual(vp.height + 2);
      }

      // 5. Total TTC visible dans le pied fixe
      const footerTotal = page.locator('[data-testid="total-ttc-amount"]');
      await expect(footerTotal).toBeVisible();

      // 6. Aucun défilement horizontal sur la modale
      const scrollReport = await page.evaluate(() => {
        const modalWin = document.querySelector('.modal-shell-window') as HTMLElement | null;
        return {
          modalScrollWidth: modalWin ? modalWin.scrollWidth : 0,
          modalClientWidth: modalWin ? modalWin.clientWidth : 0,
          windowScrollX: window.scrollX,
        };
      });

      // La modale elle-même ne doit jamais avoir de défilement horizontal
      expect(scrollReport.modalScrollWidth).toBeLessThanOrEqual(scrollReport.modalClientWidth);
      expect(scrollReport.windowScrollX).toBe(0);

      // 7. Capture d'écran comparative après compactage
      if (!fs.existsSync(compDir)) {
        fs.mkdirSync(compDir, { recursive: true });
      }
      const shotPath = path.join(compDir, `modal_compact_${vp.name}.png`);
      await page.screenshot({ path: shotPath, animations: 'disabled' });
      expect(fs.existsSync(shotPath)).toBe(true);

      // 8. Fermeture par Échap et retour du focus
      await page.keyboard.press('Escape');
      await expect(modal).not.toBeVisible();

      // Vérifier que le défilement du body a été restauré
      const restoredOverflow = await page.evaluate(() => document.body.style.overflow);
      expect(restoredOverflow).toBe('');

      // Vérifier que le focus est revenu sur le bouton d'origine
      const isFocused = await openBtn.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);
    });

    test(`devrait fermer la modale par clic à l'extérieur ou croix à ${vp.name} et restaurer le focus`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/tableau-de-bord');
      await page.waitForLoadState('domcontentloaded');

      const openBtn = vp.width >= 768
        ? page.locator('[data-testid="header-new-reservation-btn"]')
        : page.locator('[data-testid="header-new-reservation-mobile-btn"]');

      await expect(openBtn).toBeVisible();
      await openBtn.focus();
      await openBtn.click();

      const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
      await expect(modal).toBeVisible();

      if (vp.width >= 768) {
        // Clic sur le backdrop (marge extérieure)
        await page.mouse.click(10, 10);
        await expect(modal).not.toBeVisible();

        const isFocused = await openBtn.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBe(true);
      } else {
        // Sur mobile sheet plein écran, clic sur le bouton fermer
        const closeBtn = page.locator('[data-testid="btn-close-modal"]');
        await closeBtn.click();
        await expect(modal).not.toBeVisible();

        const isFocused = await openBtn.evaluate((el) => document.activeElement === el);
        expect(isFocused).toBe(true);
      }
    });
  }

  test('devrait demander confirmation avant de fermer si le formulaire a été modifié', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/tableau-de-bord');
    await page.waitForLoadState('domcontentloaded');

    const openBtn = page.locator('[data-testid="header-new-reservation-btn"]');
    await openBtn.click();

    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    // Passer en mode Nouveau client et saisir du texte
    await page.locator('[data-testid="guest-mode-new"]').click();
    await page.locator('#new-guest-name').fill('Cheikh Anta Diop');

    // Écouter le dialogue de confirmation
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      // On annule pour rester dans la modale
      await dialog.dismiss();
    });

    // Tenter de fermer par la croix
    await page.locator('[data-testid="btn-close-modal"]').click();
    expect(dialogMessage).toContain('modifications');

    // La modale doit être restée ouverte
    await expect(modal).toBeVisible();

    // Fermeture avec confirmation (on accepte)
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.locator('[data-testid="btn-close-modal"]').click();
    await expect(modal).not.toBeVisible();
  });
});
