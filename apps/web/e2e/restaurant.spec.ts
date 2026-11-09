import { test, expect } from '@playwright/test';

test.describe('Point de vente restaurant La Teranga', () => {
  test.beforeEach(async ({ page }) => {
    // Connexion avec rôle RESTAURANT pour les tests
    await page.addInitScript(() => {
      const session = {
        user: {
          id: 'usr-002-resto',
          email: 'teranga.resto@residenceblue.sn',
          fullName: 'Ibrahima Diallo',
          role: 'RESTAURANT',
          jobTitle: "Maître d'Hôtel"
        },
        token: 'test-token-resto',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        stayConnected8h: true,
        lastActivityAt: Date.now(),
        isLocked: false
      };
      localStorage.setItem('residence_blue_auth_session', JSON.stringify(session));
      localStorage.setItem('auth_token', 'fake-jwt-token');
      localStorage.setItem('current_user', JSON.stringify(session.user));
    });
  });

  test('Affiche l\'écran restaurant avec catégories et plats', async ({ page }) => {
    await page.goto('/restaurant');
    await expect(page.locator('h1')).toContainText('La Teranga');

    // Vérifier les onglets de catégories
    await expect(page.getByRole('tab', { name: /Plats sénégalais/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Boissons/i })).toBeVisible();

    // Vérifier les plats dans le catalogue
    const grid = page.locator('[data-testid="dishes-grid"]');
    await expect(grid.getByText('Thiéboudienne Royale')).toBeVisible();
    await expect(grid.getByText('Yassa Poulet Fermier')).toBeVisible();
  });

  test('Filtrage par catégorie et recherche textuelle', async ({ page }) => {
    await page.goto('/restaurant');
    const grid = page.locator('[data-testid="dishes-grid"]');

    // Filtrer par catégorie Boissons & Cocktails
    await page.getByRole('tab', { name: /Boissons/i }).click();
    await expect(grid.getByText('Jus de Bissap Maison')).toBeVisible();
    await expect(grid.getByText('Thiéboudienne Royale')).not.toBeVisible();

    // Revenir à Plats sénégalais
    await page.getByRole('tab', { name: /Plats sénégalais/i }).click();
    await expect(grid.getByText('Thiéboudienne Royale')).toBeVisible();

    // Recherche via le champ dédié catalogue
    const searchInput = page.locator('[data-testid="input-search-dish"]');
    await searchInput.fill('Yassa');
    await expect(grid.getByText('Yassa Poulet Fermier')).toBeVisible();
    await expect(grid.getByText('Thiéboudienne Royale')).not.toBeVisible();
  });

  test('Ajout de plats au ticket et calcul des totaux', async ({ page }) => {
    await page.goto('/restaurant');

    // D'abord vider le ticket initial pour partir de zéro
    await page.locator('[data-testid="btn-clear-ticket"]').click();
    await expect(page.getByText('Aucun article sur ce ticket')).toBeVisible();

    // Cliquer sur Thiéboudienne Royale (4 500 FCFA) dans le catalogue
    const grid = page.locator('[data-testid="dishes-grid"]');
    await grid.getByText('Thiéboudienne Royale').click();

    // Vérifier dans le panneau Commande
    const ticketList = page.locator('[data-testid="ticket-items-list"]');
    await expect(ticketList.getByText('Thiéboudienne Royale')).toBeVisible();

    // Aller sur Boissons et ajouter Jus de Bissap Maison (1 500 FCFA)
    await page.getByRole('tab', { name: /Boissons/i }).click();
    await grid.getByText('Jus de Bissap Maison').click();

    // Total TTC = 4 500 + 1 500 = 6 000 FCFA
    const totalTtc = page.locator('[data-testid="ticket-total-ttc"]');
    await expect(totalTtc).toContainText(/6[\s\u202f]*000\s*FCFA/);
  });

  test('Un plat épuisé ne peut pas être ajouté au ticket', async ({ page }) => {
    await page.goto('/restaurant');

    // Vider le ticket
    await page.locator('[data-testid="btn-clear-ticket"]').click();
    await expect(page.getByText('Aucun article sur ce ticket')).toBeVisible();

    // Le plat dish-3 (Poisson Grillé du Jour) est configuré comme épuisé (SOLD_OUT)
    const soldOutCard = page.locator('[data-dish-id="dish-3"]');
    await expect(soldOutCard).toContainText('Épuisé');

    // Cliquer dessus
    await soldOutCard.click();

    // Ne doit PAS être ajouté au ticket
    await expect(page.getByText('Aucun article sur ce ticket')).toBeVisible();
  });

  test('Sélection de table et affectation chambre', async ({ page }) => {
    await page.goto('/restaurant');

    // Sélectionner la Table T2
    await page.getByRole('button', { name: 'T2' }).click();

    // Basculer vers Chambre
    await page.locator('[data-testid="toggle-dest-room"]').click();
    await expect(page.getByText('Mamadou Diop')).toBeVisible();
    await expect(page.getByText('301').first()).toBeVisible();
  });

  test('Bouton Gérer le menu visible pour rôle RESTAURANT', async ({ page }) => {
    await page.goto('/restaurant');
    await expect(page.getByTestId('btn-manage-menu')).toBeVisible();
  });
});
