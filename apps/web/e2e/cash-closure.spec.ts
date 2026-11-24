import { test, expect } from '@playwright/test';
import { loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

function clearTodayCashClosures(): void {
  const script = `
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Dakar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      await p.cashClosure.deleteMany({ where: { businessDate: today } });
      await p.$disconnect();
    })();
  `;
  execE2eNodeScript(script);
}

test.describe('Clôture de caisse — Comptoir Facturation (E2E)', () => {
  test.setTimeout(90_000);

  test.beforeEach(() => {
    clearTodayCashClosures();
  });

  test.afterAll(() => {
    clearTodayCashClosures();
  });

  test('ouvre la modale, calcule l’écart sans scroll horizontal à 360px, puis enregistre la clôture', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await loginViaUi(page);
    await page.goto('/facturation', { waitUntil: 'domcontentloaded' });

    const openBtn = page.locator('[data-testid="btn-open-cash-closure"]');
    await expect(openBtn).toBeVisible({ timeout: 25_000 });
    await openBtn.click();

    const modal = page.locator('[data-testid="cash-closure-modal"]');
    await expect(modal).toBeVisible();

    // Aucun défilement horizontal à 360px sur la page ni sur la modale
    const overflow = await page.evaluate(() => {
      const docOverflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      const modalWin = document.querySelector('.modal-shell-window') as HTMLElement | null;
      const modalOverflow = modalWin ? modalWin.scrollWidth > modalWin.clientWidth : false;
      return { docOverflow, modalOverflow };
    });
    expect(overflow.docOverflow).toBe(false);
    expect(overflow.modalOverflow).toBe(false);

    // Lire le montant attendu actuel puis saisir attendu + 2500
    const expectedRaw =
      (await page.locator('[data-testid="closure-expected-cash"]').textContent()) ?? '0';
    const expectedDigits = Number(expectedRaw.replace(/[^\d]/g, '')) || 0;
    const counted = expectedDigits + 2500;

    await page.locator('[data-testid="input-counted-cash"]').fill(String(counted));
    await expect(page.locator('[data-testid="cash-closure-difference-value"]')).toContainText(
      '+2',
    );
    await expect(page.locator('[data-testid="cash-closure-difference"]')).toHaveClass(
      /text-red-800/,
    );

    await page.locator('[data-testid="input-closure-notes"]').fill('Clôture test E2E');
    await page.locator('[data-testid="btn-confirm-cash-closure"]').click();

    // Modale fermée, message de succès visible, badge "Caisse fermée aujourd'hui" affiché
    await expect(modal).toHaveCount(0);
    await expect(page.locator('[data-testid="comptoir-success-banner"]')).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator('[data-testid="comptoir-success-banner"]')).toContainText(
      'Clôture de caisse enregistrée avec succès',
    );
    await expect(page.locator('[data-testid="cash-closed-today-badge"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-open-cash-closure"]')).toHaveCount(0);
  });
});
