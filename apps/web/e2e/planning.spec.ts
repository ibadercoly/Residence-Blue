import { test, expect } from '@playwright/test';

test.describe('Écran Planning des Réservations (/planning)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/planning', { waitUntil: 'networkidle' });
  });

  test('devrait afficher la page de planning avec le conteneur principal', async ({ page }) => {
    const pageEl = page.locator('[data-testid="planning-page"]');
    await expect(pageEl).toBeVisible();
  });

  test('devrait afficher le bandeau d\'alerte de conflit et permettre de le fermer', async ({ page }) => {
    const toast = page.locator('[data-testid="conflict-toast"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Chambre déjà réservée sur cette période');
    await expect(toast).toContainText('Chambre 202 (Deluxe Balcon)');
    await expect(toast).toContainText('Voir options de relogement suggérées');

    // Cliquer sur la croix pour fermer
    const closeBtn = toast.locator('button[aria-label="Fermer le message"]');
    await closeBtn.click();
    await expect(toast).not.toBeVisible();
  });

  test('devrait afficher la barre de commande temporelle, les filtres et la légende', async ({ page }) => {
    // Navigation temporelle
    await expect(page.getByRole('button', { name: "Aujourd'hui" })).toBeVisible();
    await expect(page.locator('text=20 Mai – 2 Juin 2024')).toBeVisible();
    await expect(page.locator('text=S21 & S22')).toBeVisible();

    // Boutons d'horizon
    await expect(page.getByRole('button', { name: '14 Jours' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Semaine' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Mois' })).toBeVisible();

    // Légende
    const legendSection = page.locator('section');
    await expect(legendSection.getByText('En séjour', { exact: true })).toBeVisible();
    await expect(legendSection.getByText('Confirmé', { exact: true })).toBeVisible();
    await expect(legendSection.getByText('Disponible', { exact: true })).toBeVisible();
    await expect(legendSection.getByText('Alerte', { exact: true })).toBeVisible();
  });

  test('devrait afficher le taux d\'occupation et les statistiques du jour', async ({ page }) => {
    const tapeChart = page.locator('[data-testid="tape-chart-grid"]');
    await expect(tapeChart).toContainText("Taux d'occupation :");
    await expect(tapeChart).toContainText('83,3%');
    await expect(tapeChart).toContainText('(10 / 12 chambres louées)');
    await expect(tapeChart).toContainText('Arrivées du jour : 3');
    await expect(tapeChart).toContainText('Départs du jour : 2');
    await expect(tapeChart).toContainText('Données en temps réel PMS Thiès');
  });

  test('devrait afficher les 12 chambres et la colonne Aujourd\'hui mise en avant', async ({ page }) => {
    const tapeChart = page.locator('[data-testid="tape-chart-grid"]');

    // Vérifier les 12 numéros de chambre
    const roomNumbers = ['101', '102', '103', '104', '105', '106', '201', '202', '203', '204', '301', '302'];
    for (const num of roomNumbers) {
      await expect(tapeChart.getByText(num, { exact: true })).toBeVisible();
    }

    // Vérifier le jour 24 aujourd'hui
    await expect(tapeChart.locator('text=Aujourd\'hui')).toBeVisible();
  });

  test('devrait permettre de reloger le conflit de la chambre 202 vers la 203', async ({ page }) => {
    const toast = page.locator('[data-testid="conflict-toast"]');
    await expect(toast).toBeVisible();

    // Le bouton Reloger ici sur la chambre 203
    const relocateBtn = page.getByRole('button', { name: 'Reloger ici' });
    await expect(relocateBtn).toBeVisible();
    await relocateBtn.click();

    // Après relogement, le toast doit disparaître et la 203 doit avoir la réservation
    await expect(toast).not.toBeVisible();
    await expect(page.locator('text=Relogé Ch. 203')).toBeVisible();
  });

  test('devrait filtrer les chambres par catégorie', async ({ page }) => {
    const categorySelect = page.locator('select[aria-label="Filtrer par catégorie de chambres"]');

    // Filtrer par Suites
    await categorySelect.selectOption('SUITE');
    const tapeChart = page.locator('[data-testid="tape-chart-grid"]');
    await expect(tapeChart.locator('text=301')).toBeVisible();
    await expect(tapeChart.locator('text=302')).toBeVisible();
    await expect(tapeChart.locator('text=101')).not.toBeVisible();

    // Revenir à toutes
    await categorySelect.selectOption('ALL');
    await expect(tapeChart.locator('text=101')).toBeVisible();
  });

  test('devrait afficher la fiche complète de la réservation sélectionnée et changer lors du clic', async ({ page }) => {
    const panel = page.locator('[data-testid="reservation-detail-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('M. Mamadou Diop');
    await expect(panel).toContainText('VIP Gold');
    await expect(panel).toContainText('Suite 301');
    await expect(panel).toContainText('780 000 FCFA');
    await expect(panel).toContainText('500 000 FCFA');
    await expect(panel).toContainText('280 000 FCFA');
    await expect(panel).toContainText('mamadou.diop@teranga.sn');

    // Cliquer sur Sophie Martin (105)
    await page.locator('text=Sophie Martin').click();
    await expect(panel).toContainText('Sophie Martin');
    await expect(panel).toContainText('Chambre 105');
  });

  test('devrait capturer le glisser-déposer inactif avec notification', async ({ page }) => {
    const reservationBar = page.locator('text=M. Mamadou Diop').first();
    await reservationBar.dispatchEvent('dragstart');

    // Le message de drag doit s'afficher
    await expect(page.locator('text=Début de déplacement')).toBeVisible();
  });

  test('devrait afficher la carte Gouvernante Générale', async ({ page }) => {
    const housekeeping = page.locator('[data-testid="housekeeping-card"]');
    await expect(housekeeping).toBeVisible();
    await expect(housekeeping).toContainText('Gouvernante Générale');
    await expect(housekeeping).toContainText('11 chambres prêtes • 1 en recouche');
  });
});
