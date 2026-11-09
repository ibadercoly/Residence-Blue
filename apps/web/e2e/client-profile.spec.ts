import { test, expect } from '@playwright/test';

test.describe('Écran Fiche Profil Client (/clients/:id)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients/c1', { waitUntil: 'networkidle' });
  });

  test('devrait rediriger /clients vers /clients/c1', async ({ page }) => {
    await page.goto('/clients', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/clients\/c1/);
  });

  test('devrait afficher l\'en-tête et les informations principales du voyageur', async ({ page }) => {
    const container = page.locator('[data-testid="client-profile-container"]');
    await expect(container).toBeVisible();

    // Fil d'Ariane et identité
    await expect(page.locator('h1')).toContainText('Fiche Voyageur');
    await expect(page.locator('[data-testid="guest-fullname"]')).toContainText('M. Mamadou Diop');
    await expect(page.getByText('VIP Gold').first()).toBeVisible();

    // Chiffres clés de fidélité
    await expect(page.locator('text=4 séjours')).toBeVisible();
    await expect(page.locator('text=18 nuits')).toBeVisible();
    await expect(page.locator('[data-testid="total-spent-amount"]')).toContainText('850');
    await expect(page.locator('[data-testid="total-spent-amount"]').locator('..')).toContainText('FCFA');

    // Équivalent en euros (taux fixe 1 EUR = 655.957 FCFA)
    await expect(page.locator('[data-testid="euro-conversion-display"]')).toContainText('5 870 €');
  });

  test('devrait masquer le passeport par défaut et permettre de l\'afficher puis le re-masquer', async ({ page }) => {
    const passportField = page.locator('[data-testid="passport-number-display"]');
    const toggleBtn = page.locator('[data-testid="toggle-passport-btn"]');

    // Masqué par défaut
    await expect(passportField).toContainText('SN••••••1-B');
    await expect(toggleBtn).toHaveText('Afficher');

    // Révéler
    await toggleBtn.click();
    await expect(passportField).toContainText('SN-982341-B');
    await expect(toggleBtn).toHaveText('Masquer');

    // Re-masquer
    await toggleBtn.click();
    await expect(passportField).toContainText('SN••••••1-B');
    await expect(toggleBtn).toHaveText('Afficher');
  });

  test('devrait indiquer clairement que les boutons de contact et scan sont inactifs (TODOs)', async ({ page }) => {
    // Bouton de contact dropdown
    const contactBtn = page.locator('[data-testid="btn-message-dropdown"]');
    await contactBtn.click();

    // Cliquer sur WhatsApp
    const whatsappBtn = page.locator('[data-testid="btn-whatsapp"]');
    await expect(whatsappBtn).toBeVisible();
    await whatsappBtn.click();

    const toast = page.locator('[data-testid="toast-notification"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('TODO notifications, nécessitent internet');

    // Bouton Scan PDF
    const scanBtn = page.locator('[data-testid="btn-scan-pdf"]');
    await scanBtn.click();
    await expect(toast).toContainText('TODO fonctionnalité d\'envoi sécurisé de fichiers');
  });

  test('devrait naviguer entre les 4 onglets fonctionnels', async ({ page }) => {
    // 1. Onglet par défaut : Historique des séjours
    await expect(page.locator('[data-testid="live-stay-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="live-stay-banner"]')).toContainText('Ch. 301');
    await expect(page.locator('[data-testid="live-stay-banner"]')).toContainText('280');
    await expect(page.locator('[data-testid="live-stay-banner"]')).toContainText('FCFA');

    // 2. Onglet Préférences & Habitudes
    await page.locator('[data-testid="tab-preferences"]').click();
    await expect(page.locator('[data-testid="tab-preferences-content"]')).toBeVisible();
    await expect(page.locator('text=Réveil & Matin')).toBeVisible();
    await expect(page.locator('text=Couchage & Confort')).toBeVisible();
    await expect(page.locator('text=Transfert VIP')).toBeVisible();

    // 3. Onglet Factures & Folios
    await page.locator('[data-testid="tab-factures"]').click();
    await expect(page.locator('[data-testid="tab-factures-content"]')).toBeVisible();
    await expect(page.locator('text=#RB-2024-0894')).toBeVisible();
    await expect(page.locator('text=#RB-2024-0211')).toBeVisible();

    // 4. Onglet Notes & Conciergerie
    await page.locator('[data-testid="tab-notes"]').click();
    await expect(page.locator('[data-testid="tab-notes-content"]')).toBeVisible();
  });

  test('devrait permettre d\'ajouter une nouvelle note interne dynamiquement', async ({ page }) => {
    // Basculer sur l'onglet Notes
    await page.locator('[data-testid="tab-notes"]').click();
    await expect(page.locator('[data-testid="tab-notes-content"]')).toBeVisible();

    const noteInput = page.locator('[data-testid="input-tab-note"]');
    const submitBtn = page.locator('[data-testid="btn-save-tab-note"]');

    const testNoteText = 'Voyageur très ponctuel pour le départ à 06h30 vers AIBD.';
    await noteInput.fill(testNoteText);
    await submitBtn.click();

    // Toast de confirmation
    const toast = page.locator('[data-testid="toast-notification"]');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Consigne enregistrée dans le dossier voyageur');

    // La note apparaît dans l'onglet des notes
    await expect(page.locator('[data-testid="tab-notes-content"]')).toContainText(testNoteText);
  });

  test('devrait ouvrir la modale compacte de réservation depuis la fiche client', async ({ page }) => {
    const newResaBtn = page.locator('[data-testid="btn-new-reservation-guest"]');
    await newResaBtn.click();

    const modal = page.locator('app-modal-shell');
    await expect(modal).toBeVisible();

    // Vérifier les dimensions compactes : largeur <= 960px
    const boundingBox = await modal.locator('> div > div').first().boundingBox();
    if (boundingBox) {
      expect(boundingBox.width).toBeLessThanOrEqual(960);
    }

    // Fermer avec Échap
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
  });
});
