import { test, expect } from '@playwright/test';

test.describe('Page de Connexion (/connexion)', () => {
  test('affiche l’écran de connexion en plein écran sans barre latérale ni header ni nav mobile', async ({ page }) => {
    await page.goto('/connexion');
    await page.waitForLoadState('networkidle');

    // Vérifier l'absence de barre latérale et de header de l'application
    await expect(page.locator('app-sidebar')).toHaveCount(0);
    await expect(page.locator('app-header')).toHaveCount(0);
    await expect(page.locator('nav[aria-label="Navigation mobile"]')).toHaveCount(0);

    // Vérifier les éléments clés de la page de connexion
    await expect(page.getByRole('heading', { name: 'Résidence Blue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Connexion Collaborateur' })).toBeVisible();
  });

  test('présente des champs vides au départ', async ({ page }) => {
    await page.goto('/connexion');
    await page.waitForLoadState('networkidle');

    const loginInput = page.locator('#user-login');
    const pwdInput = page.locator('#user-password');

    await expect(loginInput).toHaveValue('');
    await expect(pwdInput).toHaveValue('');
  });

  test('permet de basculer la visibilité du mot de passe', async ({ page }) => {
    await page.goto('/connexion');
    const pwdInput = page.locator('#user-password');
    const toggleBtn = page.locator('#toggle-pwd-btn');

    await expect(pwdInput).toHaveAttribute('type', 'password');
    await toggleBtn.click();
    await expect(pwdInput).toHaveAttribute('type', 'text');
    await toggleBtn.click();
    await expect(pwdInput).toHaveAttribute('type', 'password');
  });

  test('affiche des erreurs de validation lors d’une soumission vide', async ({ page }) => {
    await page.goto('/connexion');
    const submitBtn = page.locator('#login-btn');

    await submitBtn.click();

    await expect(page.getByText('Veuillez renseigner votre identifiant')).toBeVisible();
    await expect(page.getByText('Veuillez saisir votre mot de passe')).toBeVisible();
    expect(page.url()).toContain('/connexion');
  });

  test('affiche « Identifiants incorrects » en cas d’erreur d’authentification', async ({ page }) => {
    await page.goto('/connexion');
    await page.locator('#user-login').fill('inconnu@residenceblue.sn');
    await page.locator('#user-password').fill('MauvaisMdp123!');
    await page.locator('#login-btn').click();

    const errorBanner = page.locator('[data-test="error-banner"]');
    await expect(errorBanner).toBeVisible();
    await expect(errorBanner).toContainText('Identifiants incorrects');
    expect(page.url()).toContain('/connexion');
  });

  test('affiche la mention « Connexion sécurisée » et le numéro de support', async ({ page }) => {
    await page.goto('/connexion');
    await expect(page.getByText('Connexion sécurisée')).toBeVisible();
    await expect(page.getByText('Support informatique (+221 33 957 00 00)')).toBeVisible();
    await expect(page.getByText('Rester connecté 8 h')).toBeVisible();
  });

  test('permet une connexion réussie et redirige vers le tableau de bord', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/connexion');
    await page.locator('#user-login').fill('aissatou.ba@residenceblue.sn');
    await page.locator('#user-password').fill('ThiesTeranga2024!');

    await page.locator('#login-btn').click();

    // Redirection attendue vers /tableau-de-bord
    await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });
    expect(page.url()).toContain('/tableau-de-bord');

    // Sur le tableau de bord, la barre latérale réapparaît
    await expect(page.locator('aside')).toBeVisible();
    await expect(page.locator('aside')).toContainText('Résidence Blue');
  });
});
