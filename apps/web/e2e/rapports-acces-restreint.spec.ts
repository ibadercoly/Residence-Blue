import { expect, test } from '@playwright/test';
import { STARTER_PROFILES } from '@residence-blue/shared';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

test.describe('Rapports — Accès strict Directeur & Comptable uniquement (E2E)', () => {
  const createdEmails: string[] = [];

  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('menu Rapports absent, /rapports redirige et API 403 pour les 5 profils non autorisés ; accès normal pour Directeur et Comptable', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);

    const deniedProfiles = STARTER_PROFILES.filter((p) => p.key !== 'COMPTABLE');
    expect(deniedProfiles).toHaveLength(5);

    for (const prof of deniedProfiles) {
      const u = createE2eUser(prof.role);
      createdEmails.push(u.email);

      await page.setViewportSize({ width: 1440, height: 900 });
      await loginViaUi(page, u.email, u.password);

      await expect(page.locator('[data-testid="nav-rapports"]')).toHaveCount(0);
      await expect(page.locator('a[href="/rapports"]')).toHaveCount(0);

      // Saisie directe de /rapports -> redirection vers le premier écran autorisé (jamais /rapports)
      await page.goto('/rapports');
      await expect(page).not.toHaveURL(/\/rapports/, { timeout: 15000 });
      await expect(page).toHaveURL(/\/(tableau-de-bord|restaurant|cuisine|chambres)$/);

      // Appel direct API avec jeton valide -> 403 sur /api/rapports, PDF et Excel
      const loginRes = await request.post('/api/auth/login', {
        data: { login: u.email, password: u.password },
      });
      const { accessToken } = (await loginRes.json()) as { accessToken: string };

      for (const apiPath of [
        '/api/rapports?periode=30j',
        '/api/rapports/export/pdf?periode=30j',
        '/api/rapports/export/excel?periode=30j',
      ]) {
        const res = await request.get(apiPath, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        expect(res.status()).toBe(403);
      }
    }

    // Comptable : entrée Rapports présente et accès normal à /rapports
    const comptable = createE2eUser('COMPTABLE');
    createdEmails.push(comptable.email);
    await loginViaUi(page, comptable.email, comptable.password);
    await expect(page.locator('[data-testid="nav-rapports"]')).toBeVisible();
    await page.locator('[data-testid="nav-rapports"]').click();
    await expect(page).toHaveURL(/\/rapports$/);
    await expect(page.getByTestId('rapports-title')).toHaveText('Rapports');

    // Directeur : accès normal à /rapports et option Rapports grisée pour non-Comptable en création de compte
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);
    await loginViaUi(page, dir.email, dir.password);
    await expect(page.locator('[data-testid="nav-rapports"]')).toBeVisible();
    await page.locator('[data-testid="nav-rapports"]').click();
    await expect(page).toHaveURL(/\/rapports$/);
    await expect(page.getByTestId('rapports-title')).toHaveText('Rapports');

    await page.goto('/administration/comptes/nouveau');
    await expect(page.locator('[data-testid="rapports-locked-hint"]')).toContainText(
      'Seul le comptable peut voir les rapports',
    );
    await expect(page.locator('[data-testid="screen-rapports-LECTURE"]')).toBeDisabled();
    await expect(page.locator('[data-testid="screen-rapports-ECRITURE"]')).toBeDisabled();

    // Si on sélectionne le profil Comptable, les options Rapports deviennent actives
    await page.locator('[data-testid="profile-card-COMPTABLE"]').click();
    await expect(page.locator('[data-testid="rapports-locked-hint"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="screen-rapports-LECTURE"]')).toBeEnabled();
  });
});
