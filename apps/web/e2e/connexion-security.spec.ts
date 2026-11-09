import { test, expect } from '@playwright/test';

test.describe('Porte de Sécurité Front - Connexion', () => {
  test('Sécurité 1 : Aucune requête vers un domaine CDN ou externe lors du chargement', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('file://')) {
        externalRequests.push(url);
      }
    });

    await page.goto('/connexion');
    await page.waitForLoadState('networkidle');

    expect(externalRequests).toEqual([]);
  });

  test('Sécurité 2 : Le champ mot de passe est masqué par défaut (type="password")', async ({ page }) => {
    await page.goto('/connexion');
    const pwdInput = page.locator('#user-password');
    await expect(pwdInput).toHaveAttribute('type', 'password');
  });

  test('Sécurité 3 : Résistance aux attaques d’injection XSS dans les champs de saisie', async ({ page }) => {
    let dialogTriggered = false;
    page.on('dialog', async dialog => {
      dialogTriggered = true;
      await dialog.dismiss();
    });

    await page.goto('/connexion');

    const xssPayload = '<img src=x onerror="alert(\'XSS\')">';
    await page.locator('#user-login').fill(xssPayload);
    await page.locator('#user-password').fill(xssPayload);
    await page.locator('#login-btn').click();

    await page.waitForTimeout(500);
    expect(dialogTriggered).toBe(false);

    // Vérifier que le payload n'est pas interprété en HTML brut
    const injectedImgs = await page.locator('img[src="x"]').count();
    expect(injectedImgs).toBe(0);
  });

  test('Sécurité 4 : Les tokens de session ne fuient jamais dans l’URL', async ({ page }) => {
    await page.goto('/connexion');
    await page.locator('#user-login').fill('aissatou.ba@residenceblue.sn');
    await page.locator('#user-password').fill('ThiesTeranga2024!');
    await page.locator('#login-btn').click();

    await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('token=');
    expect(currentUrl).not.toContain('jwt=');
    expect(currentUrl).not.toContain('password=');
    expect(currentUrl).not.toContain('ThiesTeranga2024');
  });

  test('Sécurité 5 : Pas de données d’authentification ou mots de passe préremplis en clair au chargement', async ({
    page,
  }) => {
    await page.goto('/connexion');
    await page.waitForLoadState('networkidle');

    const loginValue = await page.locator('#user-login').inputValue();
    const pwdValue = await page.locator('#user-password').inputValue();

    expect(loginValue).toBe('');
    expect(pwdValue).toBe('');
  });
});
