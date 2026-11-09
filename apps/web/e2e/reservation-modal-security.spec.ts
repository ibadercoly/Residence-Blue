import { test, expect } from '@playwright/test';

test.describe('Porte de Sécurité - Modal Nouvelle Réservation', () => {
  test('Sécurité Réseau : Aucune requête vers des domaines externes ou CDN tiers', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1') && !url.startsWith('data:')) {
        externalRequests.push(url);
      }
    });

    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    // Vérifier qu'aucune ressource n'a été demandée à l'extérieur
    expect(externalRequests).toEqual([]);
  });

  test('Intégrité Monétaire : Tous les montants affichés en FCFA sont strictement entiers', async ({ page }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    const modal = page.locator('[data-testid="modal-nouvelle-reservation"]');
    await expect(modal).toBeVisible();

    const textContent = await modal.innerText();

    // Règle AGENTS.md : Devise FCFA, montants stockés et affichés en ENTIERS (jamais de décimaux ',00' ou '.00')
    const decimalFcfaRegex = /\d+[.,]\d{2}\s*FCFA/i;
    expect(textContent).not.toMatch(decimalFcfaRegex);
  });

  test('Résistance aux injections XSS : Les caractères HTML/script dans les champs restent encodés', async ({ page }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    // Basculer en nouveau client
    await page.locator('[data-testid="guest-mode-new"]').click();

    const xssPayload = '<img src=x onerror=window.__xss_detected=true>';
    await page.locator('#new-guest-name').fill(xssPayload);
    await page.locator('#new-guest-phone').fill('+221 77 999 88 77');

    const xssDetected = await page.evaluate(() => (window as unknown as { __xss_detected?: boolean }).__xss_detected);
    expect(xssDetected).toBeUndefined();

    // Soumettre et vérifier que le toast échappe le payload
    await page.locator('[data-testid="btn-submit-reservation"]').click();
    const xssDetectedAfterSubmit = await page.evaluate(() => (window as unknown as { __xss_detected?: boolean }).__xss_detected);
    expect(xssDetectedAfterSubmit).toBeUndefined();
  });

  test('Images locales : Toutes les photos de chambre proviennent du répertoire local /assets/images/', async ({ page }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    const images = await page.locator('[data-testid="modal-nouvelle-reservation"] img').all();
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src) {
        expect(src.startsWith('/assets/images/') || src.startsWith('assets/images/')).toBe(true);
        expect(src).not.toContain('unsplash.com');
        expect(src).not.toContain('pexels.com');
        expect(src).not.toContain('pixabay.com');
      }
    }
  });
});
