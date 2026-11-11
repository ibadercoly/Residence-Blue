import { expect, test } from '@playwright/test';
import * as path from 'path';

const CAPTURES_DIR = path.resolve(
  __dirname,
  '../../../docs/design/captures/clients',
);

test.describe('Clients V2 Fluide (E2E & Responsive)', () => {
  test.beforeEach(async ({ page }) => {
    page.on('pageerror', (err) => console.error('PAGEERROR:', err.message));
    await page.addInitScript(() => {
      localStorage.setItem(
        'residence_blue_auth_session',
        JSON.stringify({
          token: 'e2e-token',
          expiresAt: Date.now() + 86400000,
          user: {
            id: 'dir-1',
            email: 'direction@residenceblue.sn',
            fullName: 'Aïssatou Ba',
            role: 'DIRECTION',
          },
        }),
      );
    });
  });

  test('aucun débordement horizontal à 360, 768, 1024 et 1440 px', async ({ page }) => {
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 860 });
      await page.goto('/clients', { waitUntil: 'networkidle' });
      await expect(page.getByTestId('clients-v2-root')).toBeVisible();

      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });

  test('parcours complet : création rapide, doublon, recherche, clavier, édition en place + reload, rollback API, lien direct, suppression et captures', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-4);
    const fullName = `Mariama Sow ${suffix}`;
    const phone = `+221 77 612 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`;
    const updatedCity = `Grand Standing, Thiès ${suffix}`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/clients', { waitUntil: 'networkidle' });

    // Capture écran d'accueil (aucun client sélectionné)
    await expect(page.getByTestId('welcome-panel')).toBeVisible();
    await page.screenshot({ path: path.join(CAPTURES_DIR, 'accueil.png') });

    // 1. Création rapide (colonne droite, sans modale, 2 champs)
    await page.getByTestId('new-client-btn').click();
    await expect(page.getByTestId('quick-create-panel')).toBeVisible();
    await page.screenshot({ path: path.join(CAPTURES_DIR, 'fiche-vide.png') });

    await page.getByTestId('quick-fullname-input').fill(fullName);
    await page.getByTestId('quick-phone-input').fill(phone);
    await page.getByTestId('quick-phone-input').press('Enter');

    await expect(page.getByTestId('client-detail-panel')).toBeVisible();
    await expect(page.getByTestId('inline-display-fullName')).toContainText(fullName);

    // Récupérer l'ID depuis l'URL (/clients/:id)
    await page.waitForURL(/\/clients\/[0-9a-f-]+/i);
    const createdUrl = page.url();
    const createdId = createdUrl.split('/clients/')[1];

    // Capture de la fiche et de la liste chargée
    await page.screenshot({ path: path.join(CAPTURES_DIR, 'fiche.png') });
    await page.screenshot({ path: path.join(CAPTURES_DIR, 'liste-chargee.png') });

    // 2. Modification en place d'un champ (adresse) + rechargement page
    await page.getByTestId('inline-display-address').click();
    await page.getByTestId('inline-input-address').fill(updatedCity);
    const patchPromise = page.waitForResponse(
      (res) => res.url().includes(`/api/guests/${createdId}`) && res.request().method() === 'PATCH',
    );
    await page.getByTestId('inline-input-address').press('Enter');
    const patchRes = await patchPromise;
    expect(patchRes.ok()).toBe(true);
    await expect(page.getByTestId('inline-display-address')).toContainText(updatedCity);

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.getByTestId('inline-display-address')).toContainText(updatedCity);

    // 3. Rollback sur échec de l'API
    await page.route(`**/api/guests/${createdId}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Erreur simulée du serveur' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByTestId('inline-display-nationality').click();
    await page.getByTestId('inline-input-nationality').fill('Ivoirienne');
    await page.getByTestId('inline-input-nationality').press('Enter');
    await expect(page.getByTestId('inline-error-banner')).toBeVisible();
    await expect(page.getByTestId('inline-display-nationality')).toContainText('Sénégalaise');
    await page.unroute(`**/api/guests/${createdId}`);

    // 4. Détection de doublon pendant la frappe
    await page.getByTestId('new-client-btn').click();
    await page.getByTestId('quick-fullname-input').fill(`Doublon ${suffix}`);
    await page.getByTestId('quick-phone-input').fill(phone);
    await expect(page.getByTestId('quick-duplicate-banner')).toBeVisible();
    await page.getByTestId('open-duplicate-btn').click();
    await expect(page.getByTestId('inline-display-fullName')).toContainText(fullName);

    // 5. Recherche instantanée + navigation clavier
    await page.getByTestId('directory-search').fill(suffix);
    await expect(page.getByTestId(`guest-row-${createdId}`)).toBeVisible();
    await page.getByTestId('directory-list').focus();
    await page.keyboard.press('ArrowDown');

    // 6. Lien direct vers une fiche
    await page.goto(`/clients/${createdId}`, { waitUntil: 'networkidle' });
    await expect(page.getByTestId('inline-display-fullName')).toContainText(fullName);

    // 7. Suppression (DIRECTION + saisie du nom de famille)
    await page.getByTestId('detail-menu-btn').click();
    await page.getByTestId('menu-delete-guest').click();
    await expect(page.getByTestId('delete-confirm-box')).toBeVisible();
    await page.getByTestId('delete-confirm-input').fill(`Sow ${suffix}`);
    await page.getByTestId('delete-confirm-btn').click();
    await expect(page.getByTestId(`guest-row-${createdId}`)).toHaveCount(0);
  });

  test('parcours mobile (< 900 px) : liste -> fiche -> retour conserve la recherche', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-4);
    const fullName = `Ibrahima Fall ${suffix}`;
    const phone = `+221 76 701 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`;

    // Créer via API pour un test mobile rapide et déterministe
    const createRes = await page.request.post('/api/guests', {
      headers: { 'x-user-role': 'DIRECTION' },
      data: { fullName, phone },
    });
    expect(createRes.ok()).toBe(true);
    const created = await createRes.json();

    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/clients', { waitUntil: 'networkidle' });

    await expect(page.getByTestId('directory-pane')).toBeVisible();
    await page.getByTestId('directory-search').fill(suffix);
    await expect(page.getByTestId(`guest-row-${created.id}`)).toBeVisible();

    await page.getByTestId(`guest-row-${created.id}`).click();
    await expect(page.getByTestId('detail-pane')).toBeVisible();
    await expect(page.getByTestId('mobile-back-btn')).toBeVisible();

    await page.getByTestId('mobile-back-btn').click();
    await expect(page.getByTestId('directory-pane')).toBeVisible();
    await expect(page.getByTestId('directory-search')).toHaveValue(suffix);

    // Nettoyage
    await page.request.delete(`/api/guests/${created.id}`, {
      headers: { 'x-user-role': 'DIRECTION' },
    });
  });
});
