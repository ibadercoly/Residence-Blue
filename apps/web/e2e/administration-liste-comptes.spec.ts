import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from '@playwright/test';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

const capturesDir = path.resolve(
  __dirname,
  '../../../docs/design/captures/administration-liste-comptes',
);

test.describe('Administration — Liste des comptes en cartes (anti-régression)', () => {
  const createdEmails: string[] = [];

  test.beforeAll(() => {
    fs.mkdirSync(capturesDir, { recursive: true });
  });

  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('cartes sans débordement à 360/768/1024/1440, filtres dynamiques, directeur unique protégé, suppression en page Modifier et refus API 2e admin', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    const loginRes = await request.post('/api/auth/login', {
      data: { login: dir.email, password: dir.password },
    });
    expect(loginRes.status()).toBe(200);
    const { accessToken: token } = (await loginRes.json()) as { accessToken: string };
    expect(token).toBeTruthy();

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir.email, dir.password);

    // Sécurité : l'API doit refuser (403) la création d'un second compte DIRECTEUR
    const forbiddenSecondDirRes = await page.request.post('/api/administration/comptes', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        fullName: 'Tentative Deuxième Admin',
        email: `second-admin-${Date.now()}@residenceblue.sn`,
        starterProfile: 'DIRECTEUR',
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'ECRITURE',
          restaurant: 'ECRITURE',
          cuisine: 'ECRITURE',
          rapports: 'ECRITURE',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: true,
        },
      },
    });
    expect(forbiddenSecondDirRes.status()).toBe(403);

    // Créer 2 comptes de test (dont un avec e-mail >= 80 caractères pour vérifier le wrapping)
    const longEmail = `mariama.ndiaye.accueil.grand.standing.thies.${Date.now()}@direction.residenceblue.sn`;
    expect(longEmail.length).toBeGreaterThanOrEqual(80);
    const longFullName = `Mariama Ndiaye ${Date.now()}`;
    const secondEmail = `cuisinier.liste.${Date.now()}@residenceblue.sn`;
    const secondFullName = `Ibrahima Fall ${Date.now()}`;
    createdEmails.push(longEmail, secondEmail);

    const createLong = await page.request.post('/api/administration/comptes', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        fullName: longFullName,
        email: longEmail,
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'LECTURE',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: false,
        },
      },
    });
    expect(createLong.status()).toBe(201);

    const createSecond = await page.request.post('/api/administration/comptes', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        fullName: secondFullName,
        email: secondEmail,
        starterProfile: 'CUISINIER',
        screenAccess: {
          accueil: 'AUCUN',
          planning: 'AUCUN',
          chambres: 'AUCUN',
          clients: 'AUCUN',
          facturation: 'AUCUN',
          restaurant: 'AUCUN',
          cuisine: 'ECRITURE',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: false,
          encaisser_paiement: false,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: false,
        },
      },
    });
    expect(createSecond.status()).toBe(201);

    await page.goto('/administration/comptes');
    await expect(page.locator('[data-testid="accounts-scroll-zone"]')).toBeVisible();

    // Vérifier dimensions bouton + Créer un compte (>= 56 px) et recherche (>= 52 px)
    const createBtnBox = await page.locator('[data-testid="btn-create-account"]').boundingBox();
    const searchBox = await page.locator('[data-testid="admin-search-input"]').boundingBox();
    expect(createBtnBox?.height).toBeGreaterThanOrEqual(55);
    expect(searchBox?.height).toBeGreaterThanOrEqual(51);

    // Vérifier barre de défilement verticale interne visible et grille
    const scrollStyle = await page.locator('[data-testid="accounts-scroll-zone"]').evaluate((el) => {
      const s = window.getComputedStyle(el);
      return { overflowY: s.overflowY, scrollbarGutter: s.scrollbarGutter };
    });
    expect(scrollStyle.overflowY).toBe('scroll');

    // Un seul compte directeur protégé, jamais de Désactiver/Supprimer dessus
    const protectedBadges = page.locator('[data-testid="badge-protected-director"]');
    await expect(protectedBadges).toHaveCount(1);
    const directorCard = page.locator('article').filter({ has: protectedBadges });
    await expect(directorCard.locator('[data-testid="btn-edit-director-credentials"]')).toBeVisible();
    await expect(directorCard.getByRole('button', { name: /Désactiver|Réactiver|Supprimer/i })).toHaveCount(0);

    // Aucune carte ne contient de bouton Supprimer ni de menu caché '...'
    await expect(page.locator('[data-testid="accounts-cards-grid"] button:has-text("Supprimer")')).toHaveCount(0);
    await expect(page.locator('[data-testid="accounts-cards-grid"] button[aria-label*="menu"]')).toHaveCount(0);

    // Vérifier les 4 largeurs 1440, 1024, 768, 360 + captures visuelles
    for (const width of [1440, 1024, 768, 360]) {
      await page.setViewportSize({ width, height: 860 });
      await page.waitForTimeout(180);

      const layoutAudit = await page.evaluate((targetEmail) => {
        const docOk = document.documentElement.scrollWidth <= document.documentElement.clientWidth;
        const zone = document.querySelector('[data-testid="accounts-scroll-zone"]') as HTMLElement | null;
        const grid = document.querySelector('[data-testid="accounts-cards-grid"]') as HTMLElement | null;
        const zoneOk = zone ? zone.scrollWidth <= zone.clientWidth + 1 : false;

        let cols = 1;
        if (grid) {
          const tpl = window.getComputedStyle(grid).gridTemplateColumns.trim();
          cols = tpl.split(/\s+/).filter(Boolean).length;
        }

        const longCard = document.querySelector(
          `[data-testid="account-card-${targetEmail}"]`,
        ) as HTMLElement | null;
        let longWrapOk = false;
        let noDuplicateText = false;
        if (longCard) {
          const titleEl = longCard.querySelector('h2') as HTMLElement | null;
          const emailEl = longCard.querySelector('p') as HTMLElement | null;
          const cardRect = longCard.getBoundingClientRect();
          const emailRect = emailEl?.getBoundingClientRect();
          longWrapOk = Boolean(
            emailRect && emailRect.right <= cardRect.right + 1 && emailEl!.scrollWidth <= emailEl!.clientWidth + 2,
          );
          noDuplicateText = Boolean(
            titleEl && emailEl && titleEl.innerText.trim() !== emailEl.innerText.trim(),
          );
        }

        const actionButtons = Array.from(
          document.querySelectorAll('[data-testid="accounts-cards-grid"] article a, [data-testid="accounts-cards-grid"] article button'),
        ) as HTMLElement[];
        const smallButtons = actionButtons.filter((b) => b.getBoundingClientRect().height < 47);

        return {
          docOk,
          zoneOk,
          cols,
          longWrapOk,
          noDuplicateText,
          smallButtonsCount: smallButtons.length,
        };
      }, longEmail);

      expect(layoutAudit.docOk).toBe(true);
      expect(layoutAudit.zoneOk).toBe(true);
      expect(layoutAudit.longWrapOk).toBe(true);
      expect(layoutAudit.noDuplicateText).toBe(true);
      expect(layoutAudit.smallButtonsCount).toBe(0);
      if (width >= 900) {
        expect(layoutAudit.cols).toBe(2);
      } else {
        expect(layoutAudit.cols).toBe(1);
      }

      await page.screenshot({
        path: path.join(capturesDir, `apres-${width}px.png`),
        fullPage: false,
      });
    }

    // Revenir à 1440 px pour tester filtres, recherche, désactivation/réactivation et suppression
    await page.setViewportSize({ width: 1440, height: 900 });

    const cuisinierPill = page.locator('[data-testid="filter-pill-PROFILE:Cuisinier"]');
    await expect(cuisinierPill).toBeVisible();
    await cuisinierPill.click();
    await expect(page.locator(`[data-testid="account-card-${secondEmail}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="account-card-${longEmail}"]`)).toHaveCount(0);

    await page.locator('[data-testid="filter-pill-ALL"]').click();
    await page.locator('[data-testid="admin-search-input"]').fill(longEmail);
    await expect(page.locator(`[data-testid="account-card-${longEmail}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="account-card-${secondEmail}"]`)).toHaveCount(0);

    // Vider la recherche puis désactiver le 2e compte et filtrer sur Désactivés
    await page.locator('[data-testid="admin-search-input"]').fill('');
    const secondCard = page.locator(`[data-testid="account-card-${secondEmail}"]`);
    await secondCard.getByRole('button', { name: 'Désactiver' }).click();
    await page.locator('[data-testid="confirm-deactivate-btn"]').click();

    await page.locator('[data-testid="filter-pill-INACTIVE"]').click();
    await expect(secondCard).toBeVisible();
    await secondCard.getByRole('button', { name: 'Réactiver' }).click();
    await expect(secondCard).toHaveCount(0);

    // Retour Tous, ouvrir Modifier du long compte et tester « Supprimer ce compte » en bas de la page
    await page.locator('[data-testid="filter-pill-ALL"]').click();
    const longCard = page.locator(`[data-testid="account-card-${longEmail}"]`);
    await longCard.getByRole('link', { name: 'Modifier' }).click();
    await expect(page).toHaveURL(/\/administration\/comptes\/[0-9a-f-]+$/i);

    const dangerSection = page.locator('[data-testid="danger-delete-account-section"]');
    await expect(dangerSection).toBeVisible();
    await dangerSection.scrollIntoViewIfNeeded();
    await page.locator('[data-testid="btn-delete-account"]').click();

    await page.locator('[data-testid="delete-confirm-name"]').fill(longFullName);
    await page.locator('[data-testid="delete-director-password"]').fill(dir.password);
    await page.locator('[data-testid="confirm-delete-btn"]').click();

    await expect(page).toHaveURL(/\/administration\/comptes/);
    await expect(page.locator(`[data-testid="account-card-${longEmail}"]`)).toHaveCount(0);
  });

  test('nom obligatoire à la création et modification du nom pour le directeur (ibader) comme pour tout autre compte', async ({
    page,
  }) => {
    test.setTimeout(180000);
    const dir2 = createE2eUser('DIRECTION');
    const collabEmail = `collab-nom-ui-${Date.now()}@residenceblue.sn`;
    createdEmails.push(dir2.email, collabEmail);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir2.email, dir2.password);

    // 1. Création : le nom est obligatoire (un nom vide ou uniquement d'espaces bloque la création)
    await page.goto('/administration/comptes/nouveau');
    await page.locator('[data-testid="input-account-email"]').fill(collabEmail);
    await page.locator('[data-testid="input-account-fullname"]').fill('   ');
    await page.locator('[data-testid="btn-save-account"]').click();
    await expect(page.locator('[data-testid="account-form-error"]')).toBeVisible();
    await expect(page).toHaveURL(/\/administration\/comptes\/nouveau/);

    // Avec un nom renseigné, la création réussit
    await page.locator('[data-testid="input-account-fullname"]').fill('Fatoumata Binetou');
    await page.locator('[data-testid="btn-save-account"]').click();
    await expect(page.locator('[data-testid="provisional-password-card"]')).toBeVisible();

    // 2. Compte administrateur : modifier le nom (ex. -> ibader) via /administration/directeur
    await page.goto('/administration/directeur');
    await expect(page.locator('[data-testid="director-fullname-input"]')).toHaveValue('E2E Testeur');
    await page.locator('[data-testid="director-fullname-input"]').fill('ibader');
    await page.locator('[data-testid="director-current-password-input"]').fill(dir2.password);
    await page.locator('[data-testid="btn-save-director-credentials"]').click();
    await expect(page.locator('[data-testid="director-success"]')).toBeVisible();
    await expect(page.locator('header[role="banner"]').first()).toContainText('ibader');

    await page.goto('/administration/comptes');
    await expect(page.locator(`[data-testid="account-card-${dir2.email}"]`)).toContainText('ibader');

    // 3. Autre compte : modifier son nom via la page Modifier et vérifier l'affichage sur sa carte
    await page.locator('[data-testid="admin-search-input"]').fill(collabEmail);
    const collabCard = page.locator(`[data-testid="account-card-${collabEmail}"]`);
    await expect(collabCard).toContainText('Fatoumata Binetou');
    await collabCard.getByRole('link', { name: 'Modifier' }).click();
    await expect(page).toHaveURL(/\/administration\/comptes\/[0-9a-f-]+$/i);

    await page.locator('[data-testid="input-account-fullname"]').fill('Fatoumata Ndiaye');
    await page.locator('[data-testid="btn-save-account"]').click();
    await expect(page.locator('[data-testid="account-form-success"]')).toBeVisible();

    await page.goto('/administration/comptes');
    await page.locator('[data-testid="admin-search-input"]').fill(collabEmail);
    await expect(page.locator(`[data-testid="account-card-${collabEmail}"]`)).toContainText('Fatoumata Ndiaye');
  });
});
