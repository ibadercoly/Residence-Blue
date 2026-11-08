import { test, expect } from '@playwright/test';

test.describe('Résidence Blue - Navigation & Accessibilité du Shell', () => {
  test('doit afficher la barre latérale, l’en-tête et tous les liens de navigation', async ({ page }) => {
    await page.goto('/');

    // Redirection automatique vers /tableau-de-bord
    await expect(page).toHaveURL(/.*tableau-de-bord/);

    // Titre de marque dans la barre latérale
    await expect(page.locator('aside')).toContainText('Résidence Blue');
    await expect(page.locator('aside')).toContainText('Hôtel Boutique • Grand Standing, Thiès');

    // Les 10 liens de navigation sont présents
    const navLinks = page.locator('aside nav a');
    await expect(navLinks).toHaveCount(10);

    // Le lien Tableau de bord est actif
    const activeLink = page.locator('aside nav a[aria-current="page"], aside nav a.bg-primary');
    await expect(activeLink).toContainText('Tableau de bord');

    // Profil utilisateur dans l'en-tête
    await expect(page.locator('header')).toContainText('Aïssatou Ba');
    await expect(page.locator('header')).toContainText('Directrice Générale');

    // Champ de recherche présent avec label accessible
    const searchInput = page.locator('#global-search');
    await expect(searchInput).toBeVisible();

    // CTA Nouvelle réservation
    const ctaButton = page.locator('header a[href*="nouvelle"]');
    await expect(ctaButton).toContainText('Nouvelle réservation');
  });

  test('doit naviguer vers /chambres au clic sur le menu Chambres', async ({ page }) => {
    await page.goto('/tableau-de-bord');

    // Clic sur Chambres
    const chambresLink = page.locator('aside nav a[href*="chambres"]');
    await chambresLink.click();

    await expect(page).toHaveURL(/.*chambres/);
  });

  test('ne doit émettre aucune requête vers des domaines externes (isolation offline)', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    // Aucune requête vers googleapis, cdn, etc.
    expect(externalRequests).toEqual([]);
  });
});
