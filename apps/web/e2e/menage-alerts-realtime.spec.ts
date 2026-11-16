import { test, expect } from '@playwright/test';
import { deleteE2eUsers, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

test.describe('Commit 3 : Alertes en direct (SSE) pour la Réception à deux navigateurs', () => {
  const hkEmail = `menage-e2e-sse-${Date.now()}@residenceblue.sn`;
  const hkPwd = 'MenageSsePass!2026';

  test.beforeAll(() => {
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      const argon2 = require('argon2');
      (async () => {
        const prisma = new PrismaClient();
        const hash = await argon2.hash('${hkPwd}', {
          type: argon2.argon2id,
          memoryCost: 19456,
          timeCost: 2,
          parallelism: 1,
        });
        await prisma.user.upsert({
          where: { email: '${hkEmail}' },
          update: {
            fullName: 'Mariama Ménage Live',
            role: 'HOUSEKEEPING',
            starterProfile: 'MENAGE',
            isActive: true,
            mustChangePassword: false,
            passwordHash: hash,
            screenAccess: {
              accueil: 'AUCUN', planning: 'AUCUN', chambres: 'LECTURE',
              clients: 'AUCUN', facturation: 'AUCUN', restaurant: 'AUCUN',
              cuisine: 'AUCUN', rapports: 'AUCUN',
            },
            specialPermissions: {
              voir_montants: false, encaisser_paiement: false,
              changer_etat_chambre: true, annuler_commande_ou_reservation: false,
            },
          },
          create: {
            email: '${hkEmail}',
            fullName: 'Mariama Ménage Live',
            role: 'HOUSEKEEPING',
            starterProfile: 'MENAGE',
            isActive: true,
            mustChangePassword: false,
            passwordHash: hash,
            screenAccess: {
              accueil: 'AUCUN', planning: 'AUCUN', chambres: 'LECTURE',
              clients: 'AUCUN', facturation: 'AUCUN', restaurant: 'AUCUN',
              cuisine: 'AUCUN', rapports: 'AUCUN',
            },
            specialPermissions: {
              voir_montants: false, encaisser_paiement: false,
              changer_etat_chambre: true, annuler_commande_ou_reservation: false,
            },
          },
        });
        await prisma.room.updateMany({
          where: { number: '204' },
          data: { status: 'CLEANING', maintenanceReason: null },
        });
        await prisma.room.updateMany({
          where: { number: '104' },
          data: { status: 'FREE', maintenanceReason: null },
        });
        await prisma.$disconnect();
      })();
    `);
  });

  test.afterAll(() => {
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      (async () => {
        const prisma = new PrismaClient();
        await prisma.room.updateMany({
          where: { number: { in: ['204', '104'] } },
          data: { status: 'FREE', maintenanceReason: null },
        });
        await prisma.$disconnect();
      })();
    `);
    deleteE2eUsers([hkEmail]);
  });

  test('la Réception voit en < 2 s « J’ai nettoyé » et « Signaler un problème » sans polling manuel, avec son facultatif', async ({
    browser,
  }) => {
    const contextMenage = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const contextReception = await browser.newContext({ viewport: { width: 1280, height: 800 } });

    try {
      const menagePage = await contextMenage.newPage();
      const receptionPage = await contextReception.newPage();

      // 1. Navigateur A (Ménage) se connecte et arrive sur /chambres
      await menagePage.goto('/connexion');
      await menagePage.locator('#user-login').fill(hkEmail);
      await menagePage.locator('#user-password').fill(hkPwd);
      await menagePage.locator('#login-btn').click();
      await expect(menagePage).toHaveURL(/\/chambres/, { timeout: 25000 });
      await expect(menagePage.getByTestId('menage-chambres-page')).toBeVisible({ timeout: 15000 });
      await expect(menagePage.getByTestId('menage-btn-cleaned-204')).toBeVisible({ timeout: 15000 });

      // 2. Navigateur B (Réception) se connecte, va sur Planning et vérifie l'interrupteur son + SSE prêt
      await loginViaUi(receptionPage, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
      const streamReadyPromise = receptionPage.waitForResponse(
        (res) => res.url().includes('/api/rooms/stream') && res.status() === 200,
        { timeout: 20000 },
      );
      await receptionPage.goto('/planning');
      await expect(receptionPage.getByTestId('planning-page')).toBeVisible({ timeout: 15000 });
      await streamReadyPromise;

      const bellBtn = receptionPage.getByTestId('header-notifications-btn');
      await expect(bellBtn).toBeVisible();
      await bellBtn.click();
      const soundSwitch = receptionPage.getByTestId('notifications-sound-toggle');
      await expect(soundSwitch).toBeVisible();
      await expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
      await soundSwitch.click();
      await expect(soundSwitch).toHaveAttribute('aria-checked', 'true');
      await soundSwitch.click();
      await expect(soundSwitch).toHaveAttribute('aria-checked', 'false');
      await receptionPage.keyboard.press('Escape');

      // Laisse la boucle ReadableStream démarrer côté serveur avant la mutation
      await receptionPage.waitForTimeout(300);

      // 3. Ménage clique « J'ai nettoyé » sur Chambre 204 -> Réception alertée en < 2 s
      const t0 = Date.now();
      await menagePage.getByTestId('menage-btn-cleaned-204').click();

      await expect(receptionPage.getByTestId('header-notifications-badge')).toHaveText('1', {
        timeout: 2000,
      });
      await expect(receptionPage.getByTestId('planning-live-alert-badge')).toContainText(
        'Chambre 204 : propre, prête à louer',
        { timeout: 2000 },
      );
      await expect(receptionPage.getByTestId('nav-planning-alert-badge')).toHaveText('1', {
        timeout: 2000,
      });
      const elapsedCleanedMs = Date.now() - t0;
      expect(elapsedCleanedMs).toBeLessThan(2000);

      // 4. Ménage signale un problème (Fuite d'eau) sur Chambre 104 -> Réception alertée en < 2 s
      await menagePage.getByTestId('menage-btn-report-104').click();
      await expect(menagePage.getByTestId('menage-problem-modal')).toBeVisible();
      await menagePage.getByTestId('menage-problem-choice-fuite').click();

      const t1 = Date.now();
      await menagePage.getByTestId('menage-problem-submit').click();

      await expect(receptionPage.getByTestId('header-notifications-badge')).toHaveText('2', {
        timeout: 2000,
      });
      await expect(receptionPage.getByTestId('planning-live-alert-badge')).toContainText(
        "Chambre 104 : problème signalé (Fuite d'eau)",
        { timeout: 2000 },
      );
      const elapsedProblemMs = Date.now() - t1;
      expect(elapsedProblemMs).toBeLessThan(2000);

      // Vérifie la cloche + absence de prix/nom client + acquittement
      await bellBtn.click();
      const dropdown = receptionPage.getByTestId('header-notifications-dropdown');
      await expect(dropdown).toBeVisible();
      const itemsText = await dropdown.innerText();
      expect(itemsText).toContain("Chambre 104 : problème signalé (Fuite d'eau)");
      expect(itemsText).toContain('Chambre 204 : propre, prête à louer');
      expect(itemsText).not.toMatch(/FCFA|Diallo|teranga/i);

      await receptionPage.getByTestId('notifications-mark-read-btn').click();
      await expect(receptionPage.getByTestId('header-notifications-badge')).toHaveCount(0);
      await expect(receptionPage.getByTestId('planning-live-alert-badge')).toHaveCount(0);

      // 5. Le compte Ménage authentifié est refusé (403) s'il tente d'accéder directement à /api/rooms/stream (et 401 sans jeton)
      const anonStatus = await menagePage.evaluate(async () => {
        const res = await fetch('/api/rooms/stream');
        return res.status;
      });
      expect(anonStatus).toBe(401);

      const loginRes = await menagePage.request.post('/api/auth/login', {
        data: { login: hkEmail, password: hkPwd },
      });
      const loginBody = await loginRes.json();
      const streamStatus = await menagePage.evaluate(async (token: string) => {
        const res = await fetch('/api/rooms/stream', {
          headers: { Authorization: `Bearer ${token}` },
        });
        return res.status;
      }, loginBody.accessToken);
      expect(streamStatus).toBe(403);
    } finally {
      await contextMenage.close();
      await contextReception.close();
    }
  });
});
