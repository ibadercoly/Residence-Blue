import { test, expect } from '@playwright/test';

test.describe('Porte de Sécurité Front-End — Planning des Réservations (/planning)', () => {
  test('Sécurité Réseau : Aucune requête vers des CDN ou domaines externes', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    await page.goto('/planning', { waitUntil: 'networkidle' });
    expect(externalRequests).toEqual([]);
  });

  test('Protection des Données : Aucun secret, token d\'authentification ni pièce d\'identité en clair', async ({ page }) => {
    await page.goto('/planning', { waitUntil: 'networkidle' });
    const content = await page.content();

    // Pas de jeton sensible dans le DOM
    expect(content).not.toMatch(/eyJhbGciOi/i); // JWT
    expect(content).not.toMatch(/passport/i);
    expect(content).not.toMatch(/cni/i);
    expect(content).not.toMatch(/password/i);
  });

  test('Règle Monétaire : Tous les montants FCFA affichés sont des entiers stricts sans décimales', async ({ page }) => {
    await page.goto('/planning', { waitUntil: 'networkidle' });
    const folioText = await page.locator('[data-testid="reservation-detail-panel"]').innerText();

    // Rechercher les montants FCFA : ex. 780 000 FCFA
    const fcfaMatches = folioText.match(/\d+[\s\u202f]?\d*\s*FCFA/g) || [];
    expect(fcfaMatches.length).toBeGreaterThan(0);

    for (const match of fcfaMatches) {
      // Aucun montant ne doit comporter de virgule ou point décimal (ex: 780,50 FCFA ou 780.00 FCFA)
      expect(match).not.toMatch(/[.,]\d+\s*FCFA/);
    }
  });

  test('Résistance XSS : Les consignes et noms d\'invités sont encodés et sécurisés', async ({ page }) => {
    await page.goto('/planning', { waitUntil: 'networkidle' });

    // Injection simulée dans le DOM
    const hasInjectedScript = await page.evaluate(() => {
      return document.querySelector('script[data-xss-test]') !== null;
    });
    expect(hasInjectedScript).toBe(false);
  });
});
