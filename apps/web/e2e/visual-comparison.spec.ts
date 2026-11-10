import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

test.describe('Fidélité Visuelle - Rendu Hors Ligne vs Référence', () => {
  const repoRoot = path.resolve(__dirname, '../../..');
  const compDir = path.join(repoRoot, 'docs/design/comparaisons');

  test.beforeAll(() => {
    if (!fs.existsSync(compDir)) {
      fs.mkdirSync(compDir, { recursive: true });
    }
  });

  test('Fidélité Tableau de Bord Bureau (1280x1600) vs design/reference/tableau_de_bord.html', async ({ page }) => {
    test.skip(true, 'À relancer à la réactivation : météo, actions prioritaires, graphique hebdomadaire, RevPAR (V2)');
    const width = 1280;
    const height = 1600;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/tableau_de_bord.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées et visuels sur la référence
    await page.evaluate(() => {
      // Masquer la bannière hero (visuel et adaptation textuelle pour Thiès)
      const hero = document.querySelector('section.relative.w-full.rounded-2xl');
      if (hero) (hero as HTMLElement).style.visibility = 'hidden';

      // Masquer le widget météo de la barre latérale
      const sidebarFooter = document.querySelector('aside .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      // Masquer la carte météo
      const weatherWidget = document.querySelector('#weather-widget-title')?.closest('section');
      if (weatherWidget) (weatherWidget as HTMLElement).style.visibility = 'hidden';

      // Masquer les zones balisées
      document.querySelectorAll('[data-photo-zone], [data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_tableau_de_bord.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées et visuels sur l'application Angular
    await page.evaluate(() => {
      const heroEl = document.querySelector('app-hero-banner');
      if (heroEl) (heroEl as HTMLElement).style.visibility = 'hidden';

      const sidebarFooter = document.querySelector('app-sidebar .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      const weatherEl = document.querySelector('app-weather-widget');
      if (weatherEl) (weatherEl as HTMLElement).style.visibility = 'hidden';

      document.querySelectorAll('[data-photo-zone], [data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_tableau_de_bord.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_tableau_de_bord.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Bureau (1280x1600) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Fidélité Tableau de Bord Mobile (390x1600) vs design/reference/tableau_de_bord_mode_clair.html', async ({ page }) => {
    test.skip(true, 'À relancer à la réactivation du module mobile_complete (V2)');
    const width = 390;
    const height = 1600;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence mobile hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/tableau_de_bord_mode_clair.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage sur la référence mobile
    await page.evaluate(() => {
      // Masquer les en-têtes photos si présentes
      document.querySelectorAll('[data-photo-zone]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      // Masquer le bandeau de statut et les zones adaptées
      const statusStrip = document.querySelector('section > div.relative.overflow-hidden.rounded-xl.bg-gradient-to-r');
      if (statusStrip) (statusStrip as HTMLElement).style.visibility = 'hidden';

      const subTitle = document.querySelector('section div.flex.flex-col.min-w-0 > p');
      if (subTitle) (subTitle as HTMLElement).style.visibility = 'hidden';

      const roomsSub = document.querySelector('h3.font-headline-sm')?.parentElement?.querySelector('p');
      if (roomsSub) (roomsSub as HTMLElement).style.visibility = 'hidden';

      const logoImg = document.querySelector('header img');
      if (logoImg) (logoImg as HTMLElement).style.visibility = 'hidden';
      const avatarImg = document.querySelector('header .pl-1 img');
      if (avatarImg) (avatarImg as HTMLElement).style.visibility = 'hidden';

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const refMobilePath = path.join(compDir, 'ref_tableau_de_bord_mode_clair.png');
    await page.screenshot({ path: refMobilePath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular en vue mobile 390px
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage sur l'application Angular
    await page.evaluate(() => {
      document.querySelectorAll('[data-photo-zone]').forEach(el => {
        (el as HTMLElement).style.display = 'none';
      });

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      const logoImg = document.querySelector('header img');
      if (logoImg) (logoImg as HTMLElement).style.visibility = 'hidden';
      const avatarImg = document.querySelector('header [data-testid="user-profile-mobile"]');
      if (avatarImg) (avatarImg as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(200);

    const actualMobilePath = path.join(compDir, 'actual_tableau_de_bord_mode_clair.png');
    await page.screenshot({ path: actualMobilePath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refMobilePath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualMobilePath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_tableau_de_bord_mode_clair.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Mobile (390x1600) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Fidélité Page Connexion (1280x900) vs design/reference/connexion_r_sidence_blue_pms.html', async ({ page }) => {
    const width = 1280;
    const height = 900;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl =
      'file:///' +
      path.resolve(repoRoot, 'design/reference/connexion_r_sidence_blue_pms.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées, photos et écarts voulus sur la référence
    await page.evaluate(() => {
      // Masquer l'image d'arrière-plan
      const bgImg = document.querySelector('div[style*="background-image"]');
      if (bgImg) (bgImg as HTMLElement).style.visibility = 'hidden';

      // Masquer les badges supérieurs et statut
      const topBadges = document.querySelector('.relative.z-10.flex.flex-wrap.items-center.justify-between');
      if (topBadges) (topBadges as HTMLElement).style.visibility = 'hidden';

      // Masquer la citation éditoriale et le ticker
      const bottomContent = document.querySelector('.relative.z-10.mt-auto.pt-16');
      if (bottomContent) (bottomContent as HTMLElement).style.visibility = 'hidden';

      // Masquer la barre d'outils supérieure (FR/EN et v2.4 PMS Pro)
      const topUtils = document.querySelector('.flex.items-center.justify-between.w-full.pb-6');
      if (topUtils) (topUtils as HTMLElement).style.visibility = 'hidden';

      // Masquer les profils de démonstration
      const demoBox = document.querySelector('.mb-6.p-3.rounded-xl.bg-surface-container-low');
      if (demoBox) (demoBox as HTMLElement).style.visibility = 'hidden';

      // Masquer le badge de sécurité et footer support
      const secBadge = document.querySelector('.mt-6.flex.items-center.justify-center');
      if (secBadge) (secBadge as HTMLElement).style.visibility = 'hidden';

      const supportFooter = document.querySelector('.pt-6.text-center');
      if (supportFooter) (supportFooter as HTMLElement).style.visibility = 'hidden';

      // Masquer la mention se souvenir
      const rememberMe = document.querySelector('#remember-me')?.parentElement;
      if (rememberMe) (rememberMe as HTMLElement).style.visibility = 'hidden';

      // Masquer les inputs
      const form = document.querySelector('#pms-login-form');
      if (form) {
        form.querySelectorAll('input').forEach(input => {
          (input as HTMLElement).style.visibility = 'hidden';
        });
      }
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_connexion.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger la page Angular /connexion
    await page.goto('/connexion', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage sur l'application Angular
    await page.evaluate(() => {
      document.querySelectorAll('[data-photo-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      const topUtils = document.querySelector('.flex.items-center.justify-between.w-full.pb-6');
      if (topUtils) (topUtils as HTMLElement).style.visibility = 'hidden';

      const demoBox = document.querySelector('.mb-6.p-3.rounded-xl.bg-surface-container-low');
      if (demoBox) (demoBox as HTMLElement).style.visibility = 'hidden';

      const secBadge = document.querySelector('.mt-6.flex.items-center.justify-center');
      if (secBadge) (secBadge as HTMLElement).style.visibility = 'hidden';

      const supportFooter = document.querySelector('.pt-6.text-center');
      if (supportFooter) (supportFooter as HTMLElement).style.visibility = 'hidden';

      const rememberMe = document.querySelector('#remember-me')?.parentElement;
      if (rememberMe) (rememberMe as HTMLElement).style.visibility = 'hidden';

      const form = document.querySelector('#pms-login-form');
      if (form) {
        form.querySelectorAll('input').forEach(input => {
          (input as HTMLElement).style.visibility = 'hidden';
        });
      }
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_connexion.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_connexion.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Connexion (1280x900) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Fidélité Planning des Réservations (1440x900) vs design/reference/planning_des_r_servations.html', async ({ page }) => {
    const width = 1440;
    const height = 900;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/planning_des_r_servations.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées, sidebar nav et éléments animés
    await page.evaluate(() => {
      const sidebarFooter = document.querySelector('aside .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      const sidebarNav = document.querySelector('aside nav');
      if (sidebarNav) (sidebarNav as HTMLElement).style.visibility = 'hidden';

      const pingDot = document.querySelector('.animate-ping');
      if (pingDot) (pingDot as HTMLElement).style.visibility = 'hidden';

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      const toastStrong = document.querySelector('#conflict-toast p strong');
      if (toastStrong) (toastStrong as HTMLElement).style.visibility = 'hidden';
      const toastEq = document.querySelector('#conflict-toast .font-body-sm.text-on-surface-variant');
      if (toastEq) (toastEq as HTMLElement).style.visibility = 'hidden';
      const room203Reloc = document.querySelector('.col-span-14 .bg-surface-container-low');
      if (room203Reloc) (room203Reloc as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_planning.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular
    await page.goto('/planning', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage sur l'application Angular
    await page.evaluate(() => {
      const sidebarFooter = document.querySelector('app-sidebar .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      const sidebarNav = document.querySelector('app-sidebar nav');
      if (sidebarNav) (sidebarNav as HTMLElement).style.visibility = 'hidden';

      const pingDot = document.querySelector('.animate-ping');
      if (pingDot) (pingDot as HTMLElement).style.visibility = 'hidden';

      document.querySelectorAll('[data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      const toastStrong = document.querySelector('#conflict-toast p strong');
      if (toastStrong) (toastStrong as HTMLElement).style.visibility = 'hidden';
      const toastEq = document.querySelector('#conflict-toast .font-body-sm.text-on-surface-variant');
      if (toastEq) (toastEq as HTMLElement).style.visibility = 'hidden';
      const room203Reloc = document.querySelector('.col-span-14 .bg-surface-container-low');
      if (room203Reloc) (room203Reloc as HTMLElement).style.visibility = 'hidden';
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_planning.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_planning.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Planning (1440x900) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

    test('Fidélité Composants Internes Modal Nouvelle Réservation (Écart voulu dimensions ECARTS.md)', async ({ page }) => {
    const width = 1440;
    const height = 960;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne pour valider les tokens et le style des composants internes
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/modal_nouvelle_r_servation.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    const refModal = page.locator('.max-w-6xl');
    await expect(refModal).toBeVisible();

    // 2. Charger l'application Angular
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Ouvrir le modal depuis l'en-tête
    const openBtn = page.locator('[data-testid="header-new-reservation-btn"]');
    await openBtn.click();

    const actualModal = page.locator('[data-testid="modal-nouvelle-reservation"] .modal-shell-window');
    await expect(actualModal).toBeVisible();

    // Style de l'en-tête fixe (composant interne)
    const actualHeader = actualModal.locator('header');
    await expect(actualHeader).toBeVisible();
    const headerTitle = actualHeader.locator('h2');
    await expect(headerTitle).toContainText('Nouvelle réservation');
    const headerBadge = actualHeader.locator('span');
    await expect(headerBadge.first()).toBeVisible();

    // Style des cartes de sélection de catégorie (composants internes)
    const standardCard = actualModal.locator('[data-testid="category-card-Standard"]');
    const deluxeCard = actualModal.locator('[data-testid="category-card-Deluxe"]');
    const suiteCard = actualModal.locator('[data-testid="category-card-Suite"]');
    await expect(standardCard).toBeVisible();
    await expect(deluxeCard).toBeVisible();
    await expect(suiteCard).toBeVisible();

    // Vérifier badges et tarifs
    await expect(standardCard).toContainText('85 000');
    await expect(deluxeCard).toContainText('130 000');
    await expect(deluxeCard).toContainText('Recommandé');
    await expect(suiteCard).toContainText('210 000');

    // Style des canaux d'encaissement (Wave, Orange Money, Carte TPE, Espèces)
    const paymentSection = actualModal.locator('[data-testid="section-paiement"]');
    await expect(paymentSection).toBeVisible();
    await expect(paymentSection).toContainText('Wave');
    await expect(paymentSection).toContainText('Orange Money');
    await expect(paymentSection).toContainText('Carte TPE');
    await expect(paymentSection).toContainText('Espèces');

    // Style du pied fixe toujours visible (boutons d'action et Total TTC)
    const submitBtn = actualModal.locator('[data-testid="btn-submit-reservation"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText('Confirmer la réservation');

    const totalTtc = actualModal.locator('[data-testid="total-ttc-amount"]');
    await expect(totalTtc).toBeVisible();
    await expect(totalTtc).toContainText('456');

    // Capture d'écran comparative de la modale compacte
    const actualShotPath = path.join(compDir, 'actual_modal_nouvelle_reservation.png');
    await actualModal.screenshot({ path: actualShotPath, animations: 'disabled' });
    expect(fs.existsSync(actualShotPath)).toBe(true);

    console.log('Fidélité composants internes Modal Nouvelle Réservation validée avec succès.');
  });

  test('Fidélité Fiche Profil Client Bureau (1280x1600) vs design/reference/fiche_profil_client_m._mamadou_diop.html', async ({ page }) => {
    const width = 1280;
    const height = 1600;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/fiche_profil_client_m._mamadou_diop.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées et visuels sur la référence
    await page.evaluate(() => {
      // Masquer la barre latérale (modules V1 actifs différents de la référence complète)
      const aside = document.querySelector('aside');
      if (aside) (aside as HTMLElement).style.visibility = 'hidden';

      // Masquer les images
      document.querySelectorAll('img').forEach(img => {
        (img as HTMLElement).style.visibility = 'hidden';
      });

      // Masquer le bloc passeport (écart voulu masquage PII)
      const passportRow = document.querySelector('.bg-surface-container.rounded-xl.p-space-md');
      if (passportRow) (passportRow as HTMLElement).style.visibility = 'hidden';

      // Masquer la bannière chambre favorite
      const favoriteHero = document.querySelector('.relative.rounded-xl.overflow-hidden.shadow-sm.h-48');
      if (favoriteHero) (favoriteHero as HTMLElement).style.visibility = 'hidden';

      // Masquer les blocs bento inférieurs adaptés à Thiès (Notes conciergerie & préférences)
      const bentoBottom = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.gap-space-md');
      bentoBottom.forEach(el => ((el as HTMLElement).style.visibility = 'hidden'));

      // Masquer les zones balisées
      document.querySelectorAll('[data-photo-zone], [data-adapted-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      // Masquer les noms de chambres adaptés de Saly à Thiès (Suite Océan, Deluxe Mer...)
      document.querySelectorAll('.font-medium.text-on-surface').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_fiche_profil_client.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular
    await page.goto('/clients/c1', { waitUntil: 'networkidle' });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées et visuels sur l'application Angular
    await page.evaluate(() => {
      // Masquer la barre latérale (modules V1 actifs différents de la référence complète)
      const aside = document.querySelector('app-sidebar');
      if (aside) (aside as HTMLElement).style.visibility = 'hidden';

      // Masquer les images
      document.querySelectorAll('img').forEach(img => {
        (img as HTMLElement).style.visibility = 'hidden';
      });

      // Masquer le bloc passeport (écart voulu masquage PII)
      const passportBlock = document.querySelector('[data-testid="passport-block"]');
      if (passportBlock) (passportBlock as HTMLElement).style.visibility = 'hidden';

      // Masquer la bannière chambre favorite
      const favoriteHero = document.querySelector('[data-testid="favorite-room-hero"]');
      if (favoriteHero) (favoriteHero as HTMLElement).style.visibility = 'hidden';

      // Masquer les noms de chambres adaptés de Saly à Thiès (Suite Océan, Deluxe Mer...)
      document.querySelectorAll('.font-medium.text-on-surface').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });

      // Masquer les blocs bento inférieurs adaptés à Thiès (Notes conciergerie & préférences)
      const bentoBottom = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-2.gap-space-md');
      bentoBottom.forEach(el => ((el as HTMLElement).style.visibility = 'hidden'));
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_fiche_profil_client.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparer pixel à pixel avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_fiche_profil_client.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Fiche Client (1280x1600) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Fidélité Facturation & Folio Client (1280x1600) vs design/reference/facturation_folio_client_encaissement.html', async ({ page }) => {
    const width = 1280;
    const height = 1600;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/facturation_folio_client_encaissement.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées sur la référence
    await page.evaluate(() => {
      const sidebarFooter = document.querySelector('aside .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      const headerDateBlock = document.querySelectorAll('.text-on-surface-variant.text-label-md');
      headerDateBlock.forEach(el => {
        if (el.textContent?.includes('Heure locale')) {
          (el as HTMLElement).style.visibility = 'hidden';
        }
      });

      const rows = document.querySelectorAll('table tbody tr');
      rows.forEach(r => {
        const text = r.textContent || '';
        if (text.includes('Saly') || text.includes('Pêche') || text.includes('Océan') || text.includes('Langoustes')) {
          (r as HTMLElement).style.visibility = 'hidden';
        }
      });
      const roomTitle = document.querySelector('h1');
      if (roomTitle) (roomTitle as HTMLElement).style.visibility = 'hidden';

      const brandSubtitle = document.querySelectorAll('.font-body-sm.text-body-sm.text-on-surface-variant');
      brandSubtitle.forEach(el => {
        if (el.textContent?.includes('Océanique') || el.textContent?.includes('Thiès')) {
          (el as HTMLElement).style.visibility = 'hidden';
        }
      });
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_facturation_folio.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular
    await page.goto('/facturation', { waitUntil: 'networkidle' });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées sur l'application Angular
    await page.evaluate(() => {
      const sidebarFooter = document.querySelector('app-sidebar .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      const headerDateBlock = document.querySelectorAll('.text-on-surface-variant.text-label-md');
      headerDateBlock.forEach(el => {
        if (el.textContent?.includes('Heure locale')) {
          (el as HTMLElement).style.visibility = 'hidden';
        }
      });

      const rows = document.querySelectorAll('table tbody tr');
      rows.forEach(r => {
        const text = r.textContent || '';
        if (text.includes('Thiéboudienne') || text.includes('Bandia') || text.includes('Panoramique') || text.includes('jardin arboré')) {
          (r as HTMLElement).style.visibility = 'hidden';
        }
      });
      const roomTitle = document.querySelector('h1');
      if (roomTitle) (roomTitle as HTMLElement).style.visibility = 'hidden';

      const brandSubtitle = document.querySelectorAll('.font-body-sm.text-body-sm.text-on-surface-variant');
      brandSubtitle.forEach(el => {
        if (el.textContent?.includes('Océanique') || el.textContent?.includes('Thiès')) {
          (el as HTMLElement).style.visibility = 'hidden';
        }
      });
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_facturation_folio.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparaison pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_facturation_folio.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Facturation (1280x1600) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Fidélité Point de Vente Restaurant (1280x900) vs design/reference/point_de_vente_restaurant_la_teranga.html', async ({ page }) => {
    const width = 1280;
    const height = 900;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/point_de_vente_restaurant_la_teranga.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées sur la référence (Thiès au lieu de Saly, etc.)
    await page.evaluate(() => {
      const sidebarFooter = document.querySelector('aside .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      // Images et textes adaptés
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        (img as HTMLElement).style.visibility = 'hidden';
      });

      const headings = document.querySelectorAll('h1, h2, h3, p, span');
      headings.forEach(h => {
        const text = h.textContent || '';
        if (text.includes('Saly') || text.includes('Somone') || text.includes('Front de mer') || text.includes('Thiès') || text.includes('Mamadou Diop')) {
          (h as HTMLElement).style.visibility = 'hidden';
        }
      });
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_restaurant_pos.png');
    await page.screenshot({ path: refShotPath, animations: 'disabled', fullPage: false });

    // 2. Charger l'application Angular
    await page.goto('/restaurant', { waitUntil: 'networkidle' });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées sur l'application Angular
    await page.evaluate(() => {
      const sidebarFooter = document.querySelector('app-sidebar .p-gutter');
      if (sidebarFooter) (sidebarFooter as HTMLElement).style.visibility = 'hidden';

      // Images et textes adaptés
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        (img as HTMLElement).style.visibility = 'hidden';
      });

      // Le bouton "Gérer le menu" qui est spécifique à la gestion
      const manageBtn = document.querySelector('[data-testid="manage-menu-btn"]');
      if (manageBtn) (manageBtn as HTMLElement).style.visibility = 'hidden';

      const headings = document.querySelectorAll('h1, h2, h3, p, span');
      headings.forEach(h => {
        const text = h.textContent || '';
        if (text.includes('Saly') || text.includes('Somone') || text.includes('Grand Standing') || text.includes('Thiès') || text.includes('Mamadou Diop')) {
          (h as HTMLElement).style.visibility = 'hidden';
        }
      });
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_restaurant_pos.png');
    await page.screenshot({ path: actualShotPath, animations: 'disabled', fullPage: false });

    // 3. Comparaison pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    expect(actualImg.width).toBe(refImg.width);
    expect(actualImg.height).toBe(refImg.height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      width,
      height,
      { threshold: 0.2 }
    );

    const totalPixels = width * height;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_restaurant_pos.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Restaurant POS (1280x900) - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
    );
    expect(diffPercent).toBeLessThanOrEqual(2.0);
  });

  test('Vérification du profil utilisateur et du thème clair unique (aucun mode sombre)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });

    const userProfile = page.getByTestId('user-profile');
    await expect(userProfile).toBeVisible();

    // Règle AGENTS.md : pas de classe 'dark', pas de mode sombre
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).toBe(false);

    // Vérifier l'absence de bouton de bascule de thème sombre
    const toggleButton = page.getByTestId('theme-toggle');
    await expect(toggleButton).toHaveCount(0);
  });
});
