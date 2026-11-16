import { expect, test } from '@playwright/test';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const createdEmails: string[] = [];

async function loginExpectUrl(
  page: any,
  email: string,
  password: string,
  expectedUrlRegex: RegExp,
): Promise<void> {
  await page.goto('/connexion');
  await page.locator('#user-login').fill(email);
  await page.locator('#user-password').fill(password);
  await page.locator('#login-btn').click();
  await page.waitForURL(expectedUrlRegex, { timeout: 25000 });
}

test.describe('Commit 1 : Verrouillage du profil Ménage, navigation et masquage des prix', () => {
  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('formulaire administration : sélection Ménage grise tous les autres écrans avec le message dédié', async ({
    page,
  }) => {
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUi(page, dir.email, dir.password);
    await page.goto('/administration/comptes/nouveau');

    await page.getByTestId('profile-card-MENAGE').click();

    for (const screen of ['accueil', 'planning', 'clients', 'facturation', 'restaurant', 'cuisine', 'rapports']) {
      await expect(page.getByTestId(`screen-${screen}-AUCUN`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId(`screen-${screen}-LECTURE`)).toBeDisabled();
      await expect(page.getByTestId(`screen-${screen}-ECRITURE`)).toBeDisabled();
    }

    await expect(page.getByTestId('screen-chambres-LECTURE')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('menage-locked-hint').first()).toContainText(
      'Cette personne n’a besoin que de l’écran Chambres',
    );
  });

  test('compte Ménage historique (screen_access nul) ET récent : aucun Accueil, aucun Restaurant (PC et 360px), aucun prix', async ({
    page,
  }) => {
    test.setTimeout(120000);

    // 1) Compte historique (screen_access = null, starter_profile = null)
    const legacyHk = createE2eUser('HOUSEKEEPING');
    createdEmails.push(legacyHk.email);

    // 2) Compte récent avec profil MENAGE et screen_access JSON explicite
    const recentEmail = `e2e.menage.recent.${Date.now()}@residenceblue.sn`;
    const recentPwd = 'E2eStrongPass2026!';
    createdEmails.push(recentEmail);
    execE2eNodeScript(`
      const argon2 = require('argon2');
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      (async () => {
        const hash = await argon2.hash(${JSON.stringify(recentPwd)}, {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        });
        await p.user.create({
          data: {
            email: ${JSON.stringify(recentEmail)},
            fullName: 'Fatou Ménage',
            jobTitle: 'Ménage',
            role: 'HOUSEKEEPING',
            starterProfile: 'MENAGE',
            isActive: true,
            mustChangePassword: false,
            passwordHash: hash,
            totpEnabled: false,
            screenAccess: {
              accueil: 'AUCUN',
              planning: 'AUCUN',
              chambres: 'LECTURE',
              clients: 'AUCUN',
              facturation: 'AUCUN',
              restaurant: 'AUCUN',
              cuisine: 'AUCUN',
              rapports: 'AUCUN',
            },
            specialPermissions: {
              voir_montants: false,
              encaisser_paiement: false,
              changer_etat_chambre: true,
              annuler_commande_ou_reservation: false,
            },
          },
        });
        await p.$disconnect();
      })();
    `);

    for (const account of [
      { label: 'legacy', email: legacyHk.email, password: legacyHk.password },
      { label: 'recent', email: recentEmail, password: recentPwd },
    ]) {
      // Clear browser session between accounts
      await page.context().clearCookies();

      // Ordinateur 1280px
      await page.setViewportSize({ width: 1280, height: 900 });
      await loginExpectUrl(page, account.email, account.password, /\/chambres/);

      // Aller manuellement sur / et /restaurant doit rediriger sur /chambres
      await page.goto('/');
      await expect(page).toHaveURL(/\/chambres/);
      await page.goto('/restaurant');
      await expect(page).toHaveURL(/\/chambres/);

      // Barre latérale : Chambres uniquement, jamais Restaurant ni Accueil ni Planning
      const navLinks = page.locator('[data-testid="sidebar-nav"] a');
      await expect(navLinks).toHaveCount(1);
      await expect(navLinks.first()).toContainText('Chambres');
      await expect(page.locator('a[href="/restaurant"]')).toHaveCount(0);
      await expect(page.locator('[data-testid="header-global-search"]')).toHaveCount(0);

      // Aucun prix FCFA affiché sur l'écran Chambres
      await page.waitForLoadState('networkidle');
      await expect(page.getByTestId('room-card-price')).toHaveCount(0);
      const bodyTextDesktop = await page.locator('main').innerText();
      expect(bodyTextDesktop).not.toContain('FCFA');

      // Mobile 360px : pas de barre du bas multi-écrans, bouton Se déconnecter visible, 0 lien restaurant, 0 prix
      await page.setViewportSize({ width: 360, height: 740 });
      await expect(page.locator('nav[aria-label="Navigation mobile"]')).toHaveCount(0);
      await expect(page.getByTestId('mobile-logout-btn')).toBeVisible();
      await expect(page.getByTestId('mobile-logout-btn')).toContainText('Se déconnecter');
      await expect(page.locator('a[href="/restaurant"]')).toHaveCount(0);

      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(noOverflow, `Débordement horizontal pour ${account.label} à 360px`).toBe(true);
    }
  });
});
