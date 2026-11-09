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

  test('Fidélité Modal Nouvelle Réservation vs design/reference/modal_nouvelle_r_servation.html', async ({ page }) => {
    const width = 1440;
    const height = 960;
    await page.setViewportSize({ width, height });

    // 1. Charger la référence hors ligne
    const refFileUrl = 'file:///' + path.resolve(repoRoot, 'design/reference/modal_nouvelle_r_servation.html').replace(/\\/g, '/');
    await page.goto(refFileUrl, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Masquage des zones adaptées (ADAPTATION-THIES.md) et photo dans la référence
    await page.evaluate(() => {
      // Photo de la chambre
      const photoEl = document.querySelector('.w-16.h-16.rounded-xl');
      if (photoEl) (photoEl as HTMLElement).style.visibility = 'hidden';

      // Date inputs containers (inputs interactifs Angular vs textes statiques référence)
      const refDates = document.querySelectorAll('section:nth-of-type(2) .sm\\:col-span-5');
      refDates.forEach(el => (el as HTMLElement).style.visibility = 'hidden');

      // Notes conciergerie / textarea
      const refTextarea = document.querySelector('textarea');
      if (refTextarea) (refTextarea as HTMLElement).style.visibility = 'hidden';

      // En-tête : sous-titre adapté à Thiès
      const headerSub = document.querySelector('.px-space-xl.py-space-lg p');
      if (headerSub) (headerSub as HTMLElement).style.visibility = 'hidden';

      // Catégorie Deluxe : titre & description
      const catCards = document.querySelectorAll('.grid.grid-cols-1.md\\:grid-cols-3 label');
      if (catCards[1]) {
        const subSpans = catCards[1].querySelectorAll('.mt-space-md span:not(.font-label-currency)');
        subSpans.forEach(el => (el as HTMLElement).style.visibility = 'hidden');
      }

      // Attribution chambre spécifique
      const roomAttr = document.querySelector('section:nth-of-type(3) .font-title-md');
      if (roomAttr) (roomAttr as HTMLElement).style.visibility = 'hidden';

      // Volet droit récapitulatif : titre et sous-titre chambre
      const previewBlock = document.querySelector('.lg\\:col-span-5, .xl\\:col-span-4');
      if (previewBlock) {
        const previewTexts = previewBlock.querySelectorAll('h4, p.font-body-sm');
        previewTexts.forEach(el => (el as HTMLElement).style.visibility = 'hidden');
      }
    });
    await page.waitForTimeout(200);

    const refShotPath = path.join(compDir, 'ref_modal_nouvelle_reservation.png');
    const refModal = page.locator('.max-w-6xl');
    await refModal.screenshot({ path: refShotPath, animations: 'disabled' });

    // 2. Charger l'application Angular
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);

    // Ouvrir le modal depuis l'en-tête
    const openBtn = page.locator('[data-testid="header-new-reservation-btn"]');
    await openBtn.click();

    const actualModal = page.locator('[data-testid="modal-nouvelle-reservation"] .max-w-6xl');
    await expect(actualModal).toBeVisible();

    // Masquage des zones adaptées (ADAPTATION-THIES.md) et photo sur le modal Angular
    await page.evaluate(() => {
      // Photo de la chambre
      const photoEl = document.querySelector('.w-16.h-16.rounded-xl');
      if (photoEl) (photoEl as HTMLElement).style.visibility = 'hidden';

      // Date inputs containers (inputs interactifs Angular vs textes statiques référence)
      const angDates = document.querySelectorAll('section:nth-of-type(2) .sm\\:col-span-5');
      angDates.forEach(el => (el as HTMLElement).style.visibility = 'hidden');

      // Notes conciergerie / textarea
      const angTextarea = document.querySelector('textarea');
      if (angTextarea) (angTextarea as HTMLElement).style.visibility = 'hidden';

      // En-tête : sous-titre adapté à Thiès
      const headerSub = document.querySelector('[data-adapted-zone="thies-header"]');
      if (headerSub) (headerSub as HTMLElement).style.visibility = 'hidden';

      // Catégorie Deluxe : titre & description
      const deluxeTitle = document.querySelector('[data-adapted-zone="deluxe-title"]');
      if (deluxeTitle) (deluxeTitle as HTMLElement).style.visibility = 'hidden';
      const deluxeDesc = document.querySelector('[data-adapted-zone="deluxe-desc"]');
      if (deluxeDesc) (deluxeDesc as HTMLElement).style.visibility = 'hidden';

      // Attribution chambre spécifique
      const roomAttr = document.querySelector('[data-adapted-zone="room-assigned"]');
      if (roomAttr) (roomAttr as HTMLElement).style.visibility = 'hidden';

      // Volet droit récapitulatif : titre et sous-titre chambre
      const previewBlock = document.querySelector('.lg\\:col-span-5, .xl\\:col-span-4');
      if (previewBlock) {
        const previewTexts = previewBlock.querySelectorAll('h4, p.font-body-sm');
        previewTexts.forEach(el => (el as HTMLElement).style.visibility = 'hidden');
      }

      document.querySelectorAll('[data-adapted-zone], [data-photo-zone]').forEach(el => {
        (el as HTMLElement).style.visibility = 'hidden';
      });
    });
    await page.waitForTimeout(200);

    const actualShotPath = path.join(compDir, 'actual_modal_nouvelle_reservation.png');
    await actualModal.screenshot({ path: actualShotPath, animations: 'disabled' });

    // 3. Comparer avec pixelmatch
    const refImg = PNG.sync.read(fs.readFileSync(refShotPath));
    const actualImg = PNG.sync.read(fs.readFileSync(actualShotPath));

    const compWidth = Math.min(refImg.width, actualImg.width);
    const compHeight = Math.min(refImg.height, actualImg.height);

    const diff = new PNG({ width: compWidth, height: compHeight });
    const diffPixels = pixelmatch(
      refImg.data,
      actualImg.data,
      diff.data,
      compWidth,
      compHeight,
      { threshold: 0.2 }
    );

    const totalPixels = compWidth * compHeight;
    const diffPercent = (diffPixels / totalPixels) * 100;

    const diffPath = path.join(compDir, 'diff_modal_nouvelle_reservation.png');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));

    console.log(
      `Fidélité Modal Nouvelle Réservation - Diff: ${diffPixels} / ${totalPixels} (${diffPercent.toFixed(2)}%)`
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
