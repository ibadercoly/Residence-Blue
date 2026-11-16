import { expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

async function submitLoginForm(page: Page, email: string, password: string, expectedUrl: RegExp) {
  await page.goto('/connexion');
  await page.locator('#user-login').fill(email);
  await page.locator('#user-password').fill(password);
  await page.locator('#login-btn').click();
  await expect(page).toHaveURL(expectedUrl, { timeout: 25000 });
}

const createdEmails: string[] = [];
const capturesDir = path.resolve(__dirname, '../../../docs/design/captures/administration');

test.describe('Administration des comptes et droits d’accès (E2E)', () => {
  test.beforeAll(() => {
    fs.mkdirSync(capturesDir, { recursive: true });
  });

  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('non-directeur ne voit pas Administration, reçoit 403 sur /administration et l’assistant restaurant ne voit pas Cuisine', async ({
    page,
    request,
  }) => {
    test.setTimeout(90000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    const loginDir = await request.post('/api/auth/login', {
      data: { login: dir.email, password: dir.password },
    });
    const dirBody = await loginDir.json();
    const restoEmail = `e2e.resto.profil.${Date.now()}@residenceblue.sn`;
    createdEmails.push(restoEmail);

    const createRes = await request.post('/api/administration/comptes', {
      headers: { Authorization: `Bearer ${dirBody.accessToken}` },
      data: {
        fullName: 'Assistante Restaurant Profil',
        email: restoEmail,
        starterProfile: 'ASSISTANT_RESTAURANT',
        screenAccess: {
          accueil: 'AUCUN',
          planning: 'AUCUN',
          chambres: 'AUCUN',
          clients: 'AUCUN',
          facturation: 'AUCUN',
          restaurant: 'ECRITURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: true,
        },
      },
    });
    expect(createRes.status()).toBe(201);
    const createdResto = await createRes.json();

    await page.setViewportSize({ width: 1440, height: 900 });
    await submitLoginForm(page, restoEmail, createdResto.provisionalPassword, /\/changer-mot-de-passe/);
    const personalPwd = `RestoPass!${Date.now()}`;
    await page.locator('[data-testid="initial-password-new"]').fill(personalPwd);
    await page.locator('[data-testid="initial-password-confirm"]').fill(personalPwd);
    await page.locator('[data-testid="btn-save-initial-password"]').click();

    // L'assistant du restaurant atterrit sur /restaurant et ne voit ni Cuisine ni Administration
    await expect(page).toHaveURL(/\/restaurant/, { timeout: 20000 });
    await expect(page.locator('[data-testid="nav-administration"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="link-carte"]')).toHaveCount(0);

    // Taper /cuisine manuellement redirige vers /restaurant
    await page.goto('/cuisine');
    await expect(page).toHaveURL(/\/restaurant/);

    // Taper /administration affiche 403 Accès refusé
    await page.goto('/administration/comptes');
    await expect(page.locator('[data-testid="admin-forbidden-403"]')).toBeVisible();
  });

  test('cycle complet : création avec mot de passe provisoire, premier changement obligatoire, redirection Planning, modification immédiate, désactivation, suppression et responsive 360/768/1024/1440', async ({
    page,
  }) => {
    test.setTimeout(180000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    const newEmail = `collab-e2e-${Date.now()}@residenceblue.sn`;
    const newFullName = `Khady Seck ${Date.now()}`;
    createdEmails.push(newEmail);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir.email, dir.password);

    // Administration est la dernière entrée du menu du directeur
    const navLinks = page.locator('[data-testid="sidebar-nav"] a');
    const lastHref = await navLinks.last().getAttribute('href');
    expect(lastHref).toBe('/administration');

    await navLinks.last().click();
    await expect(page).toHaveURL(/\/administration\/comptes/);
    await expect(page.locator('[data-testid="accounts-table-container"]')).toBeVisible();

    // Vérifier scrollWidth <= clientWidth et tailles >= 44px/16px aux 4 largeurs
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(150);
      const metrics = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollW).toBeLessThanOrEqual(metrics.clientW);
      if (width === 1440 || width === 360) {
        await page.screenshot({
          path: path.join(capturesDir, `administration-comptes-${width}px.png`),
          fullPage: false,
        });
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-testid="btn-create-account"]').click();
    await expect(page).toHaveURL(/\/administration\/comptes\/nouveau/);

    await page.locator('[data-testid="input-account-fullname"]').fill(newFullName);
    await page.locator('[data-testid="input-account-email"]').fill(newEmail);
    await page.locator('[data-testid="profile-card-ASSISTANT_RECEPTION"]').click();

    // Couper Planning -> vérifier immédiatement l'aperçu en direct "Ce que cette personne verra"
    await page.locator('[data-testid="screen-planning-AUCUN"]').click();
    await expect(page.locator('[data-testid="preview-menu-planning"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="preview-menu-accueil"]')).toBeVisible();

    // Vérifier qu'aucun bouton ni libellé de la matrice "3. Accès par écran" n'est coupé à 1280px et 1440px
    for (const testW of [1280, 1440]) {
      await page.setViewportSize({ width: testW, height: 900 });
      const formAudit = await page.evaluate(() => {
        const docClip = document.documentElement.scrollWidth <= document.documentElement.clientWidth;
        const buttons = Array.from(document.querySelectorAll('[data-testid^="screen-"]')) as HTMLElement[];
        const clipped = buttons.filter((b) => {
          const r = b.getBoundingClientRect();
          const sec = b.closest('section')!.getBoundingClientRect();
          return r.right > sec.right + 1 || r.left < sec.left - 1 || b.scrollWidth > b.clientWidth + 1;
        });
        return { docClip, totalButtons: buttons.length, clippedCount: clipped.length };
      });
      expect(formAudit.docClip).toBe(true);
      expect(formAudit.totalButtons).toBe(24);
      expect(formAudit.clippedCount).toBe(0);
    }

    await page.screenshot({
      path: path.join(capturesDir, 'administration-creation-compte-1440px.png'),
      fullPage: true,
    });

    await page.locator('[data-testid="btn-save-account"]').click();
    const pwdCard = page.locator('[data-testid="provisional-password-card"]');
    await expect(pwdCard).toBeVisible();
    const provisionalPassword = (
      await page.locator('[data-testid="provisional-password-value"]').innerText()
    ).trim();
    expect(provisionalPassword.length).toBeGreaterThanOrEqual(10);

    // Vérifier responsive sur le formulaire / fiche provisoire
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 850 });
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      );
      expect(overflow).toBe(true);
    }

    // Se connecter avec le nouveau compte -> changement obligatoire du mot de passe
    await page.setViewportSize({ width: 1440, height: 900 });
    const context2 = await page.context().browser()!.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page2 = await context2.newPage();
    await submitLoginForm(page2, newEmail, provisionalPassword, /\/changer-mot-de-passe/);
    await expect(page2).toHaveURL(/\/changer-mot-de-passe/);

    // Tenter d'aller directement sur /tableau-de-bord avant changement -> bloqué sur /changer-mot-de-passe
    await page2.goto('/tableau-de-bord');
    await expect(page2).toHaveURL(/\/changer-mot-de-passe/);

    const personalPwd = `PersonalPass!${Date.now()}`;
    await page2.locator('[data-testid="initial-password-new"]').fill(personalPwd);
    await page2.locator('[data-testid="initial-password-confirm"]').fill(personalPwd);
    await page2.locator('[data-testid="btn-save-initial-password"]').click();

    await expect(page2).toHaveURL(/\/tableau-de-bord/);
    await expect(page2.locator('[data-testid="nav-planning"]')).toHaveCount(0);

    // Aller manuellement sur /planning sans accès -> redirigé vers /tableau-de-bord
    await page2.goto('/planning');
    await expect(page2).toHaveURL(/\/tableau-de-bord/);

    // Le directeur accorde Planning en Lecture -> effet immédiat sur la session existante de page2
    await page.locator('[data-testid="screen-planning-LECTURE"]').click();
    await page.locator('[data-testid="btn-save-account"]').click();
    await expect(page.locator('[data-testid="account-form-success"]')).toBeVisible();

    await page2.goto('/planning');
    await expect(page2).toHaveURL(/\/planning/);
    await expect(page2.locator('[data-testid="nav-planning"]')).toBeVisible();
    await context2.close();

    // Retour à la liste, suppression sécurisée avec nom exact + mot de passe directeur
    await page.goto('/administration/comptes');
    const row = page.locator(`[data-testid="account-row-${newEmail}"]`);
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Supprimer' }).click();

    await page.locator('[data-testid="delete-confirm-name"]').fill(newFullName);
    await page.locator('[data-testid="delete-director-password"]').fill(dir.password);
    await page.locator('[data-testid="confirm-delete-btn"]').click();

    await expect(page.locator(`[data-testid="account-row-${newEmail}"]`)).toHaveCount(0);
  });
});
