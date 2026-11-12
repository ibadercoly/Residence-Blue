import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as path from 'path';
import { generateTotpCode } from './auth-e2e.helper';

const repoRoot = path.resolve(__dirname, '../../..');

function runPrismaSnippet(js: string) {
  return execFileSync('node', ['--env-file=.env', '-e', js], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim();
}

test.describe('Sécurité En Ligne — Vérifications Navigateur E2E', () => {
  const createdEmails: string[] = [];

  test.afterAll(() => {
    if (createdEmails.length > 0) {
      runPrismaSnippet(`
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        p.user.deleteMany({ where: { email: { in: ${JSON.stringify(createdEmails)} } } })
          .then(() => p.$disconnect());
      `);
    }
  });

  test('redirige toute route protégée vers /connexion sans authentification', async ({ page }) => {
    for (const protectedPath of ['/facturation', '/clients', '/tableau-de-bord', '/chambres']) {
      await page.goto(protectedPath);
      await page.waitForURL('**/connexion', { timeout: 10000 });
      expect(page.url()).toContain('/connexion');
    }
  });

  test('conserve le jeton en mémoire (aucun localStorage), rafraîchit par cookie httpOnly au rechargement et déconnecte proprement', async ({
    page,
    context,
  }) => {
    await page.goto('/connexion');
    await page.locator('#user-login').fill('fatou.ndiaye@residenceblue.sn');
    await page.locator('#user-password').fill('ThiesTeranga2024!');
    await page.locator('#login-btn').click();

    await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });

    // 1. Aucun jeton dans localStorage ni sessionStorage
    const storageDump = await page.evaluate(() => ({
      localKeys: Object.keys(localStorage),
      sessionKeys: Object.keys(sessionStorage),
      authLegacy: localStorage.getItem('residence_blue_auth_session'),
    }));
    expect(storageDump.authLegacy).toBeNull();
    expect(storageDump.localKeys.join(',')).not.toMatch(/token|jwt|session|secret/i);
    expect(storageDump.sessionKeys.join(',')).not.toMatch(/token|jwt|session|secret/i);

    // 2. Cookie httpOnly présent côté navigateur (inaccessible en JS document.cookie)
    const cookies = await context.cookies();
    const refreshCookie = cookies.find((c) => c.name === 'rb_refresh_token');
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie!.httpOnly).toBe(true);
    expect(refreshCookie!.sameSite).toBe('Strict');

    const docCookie = await page.evaluate(() => document.cookie);
    expect(docCookie).not.toContain('rb_refresh_token');

    // 3. Rechargement complet F5 -> session restaurée silencieusement par rotation de cookie
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });

    // 4. Déconnexion -> redirection /connexion et impossibilité d'accéder à /facturation
    await page.getByTestId('user-profile-dropdown-btn').click();
    await page.getByTestId('menu-logout-btn').click();
    await page.waitForURL('**/connexion', { timeout: 10000 });

    await page.goto('/facturation');
    await page.waitForURL('**/connexion', { timeout: 10000 });
  });

  test('impose le 2FA TOTP pour DIRECTION, affiche les codes de secours et la liste des appareils dans ModalShell', async ({
    page,
  }) => {
    const uniqueEmail = `e2e.dir.${Date.now()}@residenceblue.sn`;
    const pwd = 'DirectionStrong2026#!';
    createdEmails.push(uniqueEmail);

    // Créer un utilisateur DIRECTION neuf (totpEnabled=false) en base avec argon2id
    runPrismaSnippet(`
      const argon2 = require('argon2');
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      (async () => {
        const hash = await argon2.hash(${JSON.stringify(pwd)}, { type: argon2.argon2id });
        await p.user.create({
          data: {
            email: ${JSON.stringify(uniqueEmail)},
            fullName: 'Directrice E2E',
            jobTitle: 'Directrice',
            role: 'DIRECTION',
            isActive: true,
            passwordHash: hash,
          },
        });
        await p.$disconnect();
      })();
    `);

    await page.goto('/connexion');
    await page.locator('#user-login').fill(uniqueEmail);
    await page.locator('#user-password').fill(pwd);
    await page.locator('#login-btn').click();

    // Étape 1 : activation obligatoire 2FA
    await expect(page.getByTestId('mfa-setup-form')).toBeVisible({ timeout: 10000 });
    const secret = (await page.getByTestId('totp-secret-display').innerText()).trim();
    expect(secret.length).toBeGreaterThanOrEqual(16);

    await page.locator('#totp-setup-code-input').fill(generateTotpCode(secret));
    await page.locator('#confirm-totp-setup-btn').click();

    // Étape 2 : codes de secours affichés une fois
    await expect(page.getByTestId('backup-codes-panel')).toBeVisible({ timeout: 10000 });
    await page.locator('#continue-after-backup-btn').click();
    await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });

    // Étape 3 : modale Appareils connectés (ModalShellComponent)
    await page.getByTestId('user-profile-dropdown-btn').click();
    await page.getByTestId('menu-sessions-btn').click();
    await expect(page.getByTestId('sessions-modal')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('sessions-modal')).toContainText('Session actuelle');
  });
});
