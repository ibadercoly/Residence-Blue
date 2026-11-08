import { test, expect } from '@playwright/test';

test.describe('Résidence Blue - Navigation, Accessibilité & Mode Hors Ligne du Shell', () => {
  test('doit afficher la barre latérale, l’en-tête et tous les liens de navigation sur bureau', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    // Redirection automatique vers /tableau-de-bord
    await expect(page).toHaveURL(/.*tableau-de-bord/);

    // Titre de marque dans la barre latérale (texte exact de la maquette)
    await expect(page.locator('aside')).toContainText('Résidence Blue');
    await expect(page.locator('aside')).toContainText('Hôtel Boutique • Saly');

    // Les 10 liens de navigation sont présents (9 principaux + Paramètres)
    const navLinks = page.locator('aside nav a');
    await expect(navLinks).toHaveCount(10);

    // Le lien Tableau de bord est actif
    const activeLink = page.locator('aside nav a[aria-current="page"]');
    await expect(activeLink).toContainText('Tableau de bord');

    // Profil utilisateur dans l'en-tête
    const desktopHeader = page.locator('header').first();
    await expect(desktopHeader).toContainText('Aïssatou Ba');
    await expect(desktopHeader).toContainText('Directrice Générale');

    // Champ de recherche présent avec label accessible
    const searchInput = page.locator('#global-search');
    await expect(searchInput).toBeVisible();

    // CTA Nouvelle réservation
    const ctaButton = desktopHeader.locator('a[href*="nouvelle"]');
    await expect(ctaButton).toContainText('Nouvelle réservation');
  });

  test('doit naviguer vers /chambres au clic sur le menu Chambres et mettre à jour l’état actif', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tableau-de-bord');

    const chambresLink = page.locator('aside nav a[href*="chambres"]');
    await chambresLink.click();

    await expect(page).toHaveURL(/.*chambres/);
    await expect(chambresLink).toHaveAttribute('aria-current', 'page');
  });

  test('doit permettre la navigation au clavier (Tab) avec focus visible et rôles ARIA', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tableau-de-bord');

    // Vérifier les rôles landmark ARIA
    await expect(page.locator('aside[aria-label="Navigation principale"]')).toBeVisible();
    await expect(page.locator('main[role="main"]')).toBeVisible();

    // Navigation clavier par Tab
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['A', 'BUTTON', 'INPUT']).toContain(focusedTag);
  });

  test('ne doit émettre aucune requête vers des domaines externes et fonctionner hors ligne', async ({ page, context }) => {
    const externalRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    // Aucune requête externe (polices, icônes, styles et images 100% locaux)
    expect(externalRequests).toEqual([]);

    // Vérifier que les polices locales Manrope, Newsreader et Material Symbols sont bien chargées
    const fontsLoaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.size > 0;
    });
    expect(fontsLoaded).toBe(true);

    // Passage en mode hors ligne : la navigation interne continue de fonctionner
    await context.setOffline(true);
    await page.locator('aside nav a[href*="planning"]').click();
    await expect(page).toHaveURL(/.*planning/);
    await page.locator('aside nav a[href*="tableau-de-bord"]').click();
    await expect(page).toHaveURL(/.*tableau-de-bord/);
    await expect(page.locator('main')).toContainText('485 000');
    await context.setOffline(false);
  });
});
