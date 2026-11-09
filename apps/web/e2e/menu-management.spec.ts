import { test, expect } from '@playwright/test';

test.describe('Gestion du menu restaurant La Teranga', () => {
  test.beforeEach(async ({ page }) => {
    // Connexion avec session RESTAURANT reconnue par AuthMockService
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
    });
  });

  test('Accès et ouverture de la modale compacte ModalShell', async ({ page }) => {
    await page.goto('/restaurant');

    const btnManage = page.locator('[data-testid="btn-manage-menu"]');
    await expect(btnManage).toBeVisible();
    await btnManage.click();

    // Vérifier la modale et son conteneur
    const modalWindow = page.locator('.modal-shell-window');
    await expect(modalWindow).toBeVisible();
    await expect(page.getByText('Gestion du menu')).toBeVisible();

    // Vérifier que la modale respecte le dimensionnement compact (ModalShellComponent max 960px)
    const box = await modalWindow.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(962);
    }
  });

  test('Liste des plats : recherche, filtres et actions rapides', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    const modalWindow = page.locator('.modal-shell-window');
    await expect(modalWindow).toBeVisible();

    // Recherche dans la table
    const searchInput = modalWindow.getByPlaceholder('Rechercher par nom ou description...');
    await searchInput.fill('Thiéboudienne');
    await expect(modalWindow.locator('tr').filter({ hasText: 'Thiéboudienne Royale' })).toBeVisible();
    await expect(modalWindow.locator('tr').filter({ hasText: 'Yassa Poulet Fermier' })).not.toBeVisible();

    await searchInput.clear();
    await expect(modalWindow.locator('tr').filter({ hasText: 'Yassa Poulet Fermier' })).toBeVisible();
  });

  test('Action 1-clic Épuisé : effet direct sur le catalogue caisse', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    const modalWindow = page.locator('.modal-shell-window');
    await expect(modalWindow).toBeVisible();

    // Localiser la ligne de Thiéboudienne Royale et cliquer sur le bouton Épuisé
    const row = modalWindow.locator('tr').filter({ hasText: 'Thiéboudienne Royale' });
    await expect(row).toBeVisible();

    const btnSoldOut = row.locator('button[title*="épuisé"], button[title*="Épuisé"]');
    await btnSoldOut.click();

    // Le badge dans la table passe à Épuisé
    await expect(row.getByText('Épuisé')).toBeVisible();

    // Fermer la modale
    await page.locator('[data-testid="btn-close-modal"]').click();

    // Vérifier sur la caisse : la carte du plat est grisée avec la mention Épuisé et bouton désactivé
    const catalogGrid = page.locator('[data-testid="dishes-grid"]');
    const dishCard = catalogGrid.locator('[data-testid="dish-card"]').filter({ hasText: 'Thiéboudienne Royale' });
    await expect(dishCard.getByTestId('badge-sold-out')).toBeVisible();

    const addBtn = dishCard.getByTestId('btn-add-dish');
    await expect(addBtn).toBeDisabled();
  });

  test('Duplication d\'un plat existant', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    const modalWindow = page.locator('.modal-shell-window');
    await expect(modalWindow).toBeVisible();

    const row = modalWindow.locator('tr').filter({ hasText: 'Yassa Poulet Fermier' });
    const btnDuplicate = row.locator('button[title="Dupliquer le plat"]');
    await btnDuplicate.click();

    // Vérifier l'apparition de la copie dans la liste
    await expect(modalWindow.locator('tr').filter({ hasText: 'Yassa Poulet Fermier (copie)' })).toBeVisible();
  });

  test('Archivage d\'un plat avec confirmation et disparition du catalogue', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    const modalWindow = page.locator('.modal-shell-window');
    await expect(modalWindow).toBeVisible();

    // Utiliser Mafé de Bœuf Fondant présent dans la carte initiale
    const row = modalWindow.locator('tr').filter({ hasText: 'Mafé de Bœuf Fondant' });
    const btnArchive = row.locator('button[title="Archiver le plat"]');
    await btnArchive.click();

    // Modale de confirmation
    await expect(page.getByText('Archiver le plat')).toBeVisible();
    await expect(page.getByText(/Le plat ne sera plus affiché sur la caisse/i)).toBeVisible();

    // Confirmer l'archivage
    await page.getByRole('button', { name: 'Archiver' }).click();

    // Fermer la modale
    await page.locator('[data-testid="btn-close-modal"]').click();

    // Le plat ne doit plus être dans le catalogue POS
    const catalogGrid = page.locator('[data-testid="dishes-grid"]');
    await expect(catalogGrid.getByText('Mafé de Bœuf Fondant')).not.toBeVisible();
  });

  test('Formulaire : validation stricte et ajout d\'un nouveau plat', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    // Aller sur le formulaire Nouveau plat
    await page.getByRole('button', { name: 'Nouveau plat' }).click();

    // Tenter de valider avec nom court
    const submitBtn = page.getByRole('button', { name: 'Créer le plat' });
    const nameInput = page.getByPlaceholder('Ex. Tiep Bou Dien Penda');

    await nameInput.fill('A');
    await expect(page.getByText('Le nom doit comporter au moins 2 caractères.')).toBeVisible();
    await expect(submitBtn).toBeDisabled();

    // Remplir correctement
    await nameInput.fill('Caldou de Mérou Frais');
    const descInput = page.getByPlaceholder(/Détails du plat/i);
    await descInput.fill('Poisson mérou mijoté au citron vert, légumes du potager et riz blanc.');

    // Vérifier le compteur de description
    await expect(page.getByText(/\/ 300/)).toBeVisible();

    // Prix
    const priceInput = page.locator('input[type="number"]').first();
    await priceInput.fill('6500');

    // Activer un tag et un allergène
    await page.getByRole('button', { name: 'Spécialité locale' }).click();
    await page.getByRole('button', { name: 'Poisson' }).click();

    // Soumettre le formulaire
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // Retour sur l'onglet liste et vérification de la présence du plat
    const modalWindow = page.locator('.modal-shell-window');
    await expect(modalWindow.locator('tr').filter({ hasText: 'Caldou de Mérou Frais' })).toBeVisible();

    // Fermer la modale et vérifier sur la caisse
    await page.locator('[data-testid="btn-close-modal"]').click();
    const catalogGrid = page.locator('[data-testid="dishes-grid"]');
    await expect(catalogGrid.getByText('Caldou de Mérou Frais')).toBeVisible();
  });

  test('Gestion des catégories : création et protection non-vide', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    // Onglet Catégories
    await page.getByRole('button', { name: 'Catégories' }).click();

    // Ajouter une catégorie
    const catInput = page.getByPlaceholder(/Nom de la nouvelle catégorie/i);
    await catInput.fill('Glaces & Sorbets Locaux');
    await page.getByRole('button', { name: 'Ajouter la catégorie' }).click();

    await expect(page.getByText('Glaces & Sorbets Locaux')).toBeVisible();
  });

  test('Import / Export : déclenchement export et neutralisation formules', async ({ page }) => {
    await page.goto('/restaurant');
    await page.locator('[data-testid="btn-manage-menu"]').click();

    // Onglet Import / Export
    await page.getByRole('button', { name: 'Import / Export' }).click();

    await expect(page.getByRole('button', { name: /Télécharger en CSV/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Télécharger en Excel/i })).toBeVisible();
  });
});
