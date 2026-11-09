import { test, expect } from '@playwright/test';

test.describe('Écran Facturation & Folio Client (/facturation)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/facturation', { waitUntil: 'networkidle' });
  });

  test('devrait charger la page de facturation et afficher le folio en cours', async ({ page }) => {
    const container = page.locator('[data-testid="facturation-container"]');
    await expect(container).toBeVisible();

    // Numéro de facture séquentiel
    await expect(page.locator('[data-testid="invoice-number"]')).toContainText('#INV-2024-0542');

    // Identité client & chambre
    await expect(page.locator('h1')).toContainText('Chambre 301 — Suite Panoramique');
    await expect(page.getByText('M. Mamadou Diop').first()).toBeVisible();
    await expect(page.getByText('VIP Gold').first()).toBeVisible();

    // Statut initial
    await expect(page.locator('[data-testid="badge-folio-pending"]')).toBeVisible();
    await expect(page.getByText("Départ aujourd'hui (12:00)")).toBeVisible();
  });

  test('devrait afficher les données d’établissement dynamiques depuis les paramètres hôtel', async ({ page }) => {
    // Vérification que les mentions légales viennent des paramètres (non codées en dur)
    const invoiceHeader = page.locator('#printableInvoiceArea');
    await expect(invoiceHeader).toContainText('Résidence Blue');
    await expect(invoiceHeader).toContainText('Hôtel Boutique • Grand Standing, Thiès');
    await expect(invoiceHeader).toContainText('Quartier Grand Standing • Thiès, Sénégal');
    await expect(invoiceHeader).toContainText('NINEA : 004819230');
    await expect(invoiceHeader).toContainText('RCCM : SN-THS-2021-B-114');
  });

  test('devrait afficher les 7 prestations adaptées avec montants entiers en FCFA', async ({ page }) => {
    const table = page.locator('[data-testid="invoice-items-table"]');
    await expect(table).toBeVisible();

    // Prestations adaptées pour Thiès
    await expect(table).toContainText('Hébergement Suite Panoramique (Ch. 301)');
    await expect(table).toContainText('Vue dégagée sur jardin arboré, terrasse privée & petit-déjeuner inclus');
    await expect(table).toContainText("Restauration 'La Teranga' — Ticket #CMD-0428");
    await expect(table).toContainText('Thiéboudienne Penda Mbaye royale & Bouteille de vin rouge');
    await expect(table).toContainText('Conciergerie — Navette VIP SUV DSS Aéroport A/R');
    await expect(table).toContainText('Housekeeping — Blanchisserie Express');
    await expect(table).toContainText('Excursion guidée — Forêt de Bandia & Manufacture des Arts de Thiès');
    await expect(table).toContainText('Taxe Touristique de Séjour Réglementaire');

    // Chiffres financiers
    await expect(table).toContainText('600\u202f000');
    await expect(page.getByText('716\u202f364 FCFA')).toBeVisible(); // Sous-total HT
    await expect(page.getByText('71\u202f636 FCFA')).toBeVisible(); // TVA 10%
    await expect(page.getByText('8\u202f000 FCFA').first()).toBeVisible(); // Taxe séjour
    await expect(page.getByText('788\u202f000 FCFA')).toBeVisible(); // Total TTC
    await expect(page.getByText('- 500\u202f000 FCFA')).toBeVisible(); // Acompte Wave
  });

  test('devrait calculer la ventilation et la monnaie en temps réel', async ({ page }) => {
    const waveInput = page.locator('[data-testid="input-wave"]');
    const cashInput = page.locator('[data-testid="input-cash"]');
    const receivedInput = page.locator('[data-testid="input-received"]');
    const changeReturn = page.locator('[data-testid="change-return"]');
    const remainingBalance = page.locator('[data-testid="remaining-balance"]');
    const reconBanner = page.locator('[data-testid="reconciliation-banner"]');
    const btnCheckout = page.locator('[data-testid="btn-checkout"]');

    // État initial équilibré
    await expect(remainingBalance).toContainText('0 FCFA');
    await expect(reconBanner).toContainText('Montant parfaitement équilibré');
    await expect(changeReturn).toContainText('12\u202f000 FCFA');
    await expect(btnCheckout).toBeEnabled();

    // Modification Wave : sous-payé
    await waveInput.fill('100000');
    await expect(remainingBalance).toContainText('50\u202f000 FCFA');
    await expect(reconBanner).toContainText('Il reste encore 50\u202f000 FCFA à répartir');
    await expect(btnCheckout).toBeDisabled();

    // Modification Wave : sur-payé (trop-perçu)
    await waveInput.fill('200000');
    await expect(remainingBalance).toContainText('Trop-perçu');
    await expect(reconBanner).toContainText('Dépassement de 50\u202f000 FCFA');
    await expect(btnCheckout).toBeDisabled();

    // Rétablissement Wave équilibré
    await waveInput.fill('150000');
    await expect(remainingBalance).toContainText('0 FCFA');
    await expect(btnCheckout).toBeEnabled();

    // Modification Monnaie reçue en espèces
    await cashInput.fill('88000');
    await receivedInput.fill('90000');
    await expect(changeReturn).toContainText('2\u202f000 FCFA');
  });

  test('devrait valider l’encaissement et libérer la chambre', async ({ page }) => {
    const btnCheckout = page.locator('[data-testid="btn-checkout"]');
    await expect(btnCheckout).toBeEnabled();

    await btnCheckout.click();

    // Confirmation d'encaissement
    await expect(btnCheckout).toContainText('Paiement validé • Chambre 301 clôturée !');
    await expect(page.locator('[data-testid="badge-folio-paid"]')).toBeVisible();

    // Le total encaissé dans le card de caisse doit augmenter de 288 000 FCFA
    // (1 420 000 + 288 000 = 1 708 000 FCFA)
    await expect(page.locator('[data-testid="today-collected-amount"]')).toContainText('1\u202f708\u202f000 FCFA');
  });

  test('devrait basculer vers l’onglet Z de caisse et afficher le rapport de clôture', async ({ page }) => {
    const tabZCaisse = page.locator('[data-testid="tab-z-caisse"]');
    await tabZCaisse.click();

    const zView = page.locator('[data-testid="z-caisse-view"]');
    await expect(zView).toBeVisible();

    // Titre et détails session
    await expect(zView).toContainText('Journal de Caisse (Rapport Z)');
    await expect(zView).toContainText('Aïssatou Ba');

    // Cartes KPI
    await expect(zView).toContainText('Fond Initial');
    await expect(zView).toContainText('150\u202f000 FCFA');
    await expect(zView).toContainText('Encaissé ce Jour');
    await expect(zView).toContainText('Espèces physiques');
    await expect(zView).toContainText('Monnaie électronique');

    // Ventilation par moyen de paiement
    await expect(zView).toContainText('Wave Sénégal');
    await expect(zView).toContainText('Espèces (Billetage Caisse)');
    await expect(zView).toContainText('Orange Money Sénégal');
    await expect(zView).toContainText('Cartes Bancaires (TPE)');

    // Boutons d'actions
    await expect(page.locator('[data-testid="btn-print-z"]')).toBeVisible();
    await expect(page.locator('[data-testid="btn-close-shift"]')).toBeVisible();

    // Revenir sur le folio
    await page.locator('[data-testid="tab-folio"]').click();
    await expect(page.locator('[data-testid="invoice-items-table"]')).toBeVisible();
  });
});
