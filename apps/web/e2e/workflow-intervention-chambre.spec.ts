import { expect, test } from '@playwright/test';
import { createE2eUser, deleteE2eUsers } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

async function loginToUrl(page: any, email: string, password: string): Promise<void> {
  await page.goto('/connexion');
  await page.locator('#user-login').fill(email);
  await page.locator('#user-password').fill(password);
  await page.locator('#login-btn').click();
  await page.waitForURL((url: URL) => !url.pathname.includes('/connexion'), { timeout: 25000 });
}

test.describe("Workflow complet d'intervention technique en chambre (E2E)", () => {
  const createdEmails: string[] = [];
  let recUser = { email: '', password: '' };
  let dirUser = { email: '', password: '' };
  let maintUser = { email: '', password: '' };

  test.beforeAll(async () => {
    recUser = createE2eUser('RECEPTION');
    dirUser = createE2eUser('DIRECTION');
    maintUser = createE2eUser('MAINTENANCE');
    createdEmails.push(recUser.email, dirUser.email, maintUser.email);

    // Réinitialiser la chambre 105 et supprimer ses interventions précédentes en base de test
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      (async () => {
        const room = await p.room.findUnique({ where: { number: '105' } });
        if (room) {
          await p.roomInterventionRequest.deleteMany({ where: { roomId: room.id } });
          await p.room.update({ where: { id: room.id }, data: { status: 'FREE', maintenanceReason: null } });
        }
        await p.$disconnect();
      })();
    `);
  });

  test.afterAll(async () => {
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      const p = new PrismaClient();
      (async () => {
        const room = await p.room.findUnique({ where: { number: '105' } });
        if (room) {
          await p.roomInterventionRequest.deleteMany({ where: { roomId: room.id } });
          await p.room.update({ where: { id: room.id }, data: { status: 'FREE', maintenanceReason: null } });
        }
        await p.$disconnect();
      })();
    `);
    deleteE2eUsers(createdEmails);
  });

  test('Réception signale -> Direction approuve -> Maintenance marque comme réparé (CLEANING)', async ({
    browser,
  }) => {
    const issueText = `Fuite robinet douche E2E ${Date.now()}`;

    // 1. Assistant de Réception signale un problème sur la chambre 105
    const recCtx = await browser.newContext();
    const recPage = await recCtx.newPage();
    await loginToUrl(recPage, recUser.email, recUser.password);
    await recPage.goto('/chambres');
    await recPage.waitForSelector('[data-testid="rooms-grid"]');

    const reportBtn = recPage.locator('[data-testid="btn-report-problem-105"]');
    await expect(reportBtn).toBeVisible({ timeout: 15000 });
    await reportBtn.click();

    await expect(recPage.locator('[data-testid="modal-report-intervention"]')).toBeVisible();
    await recPage.locator('[data-testid="input-intervention-description"]').fill(issueText);
    await recPage.locator('[data-testid="btn-submit-intervention"]').click();

    // La carte chambre 105 affiche désormais "En attente d'accord du Directeur" (bouton grisé)
    const pendingBtn = recPage.locator('[data-testid="btn-pending-director-105"]');
    await expect(pendingBtn).toBeVisible({ timeout: 15000 });
    await expect(pendingBtn).toBeDisabled();
    await expect(pendingBtn).toContainText("En attente d'accord du Directeur");
    await recCtx.close();

    // 2. La Direction voit la demande en attente et l'approuve
    const dirCtx = await browser.newContext();
    const dirPage = await dirCtx.newPage();
    await loginToUrl(dirPage, dirUser.email, dirUser.password);
    await dirPage.goto('/chambres');

    const dirPanel = dirPage.locator('[data-testid="director-pending-interventions-panel"]');
    await expect(dirPanel).toBeVisible({ timeout: 15000 });
    await expect(dirPanel).toContainText(issueText);

    const approveBtn = dirPanel.locator('button:has-text("Approuver")').first();
    await approveBtn.click();
    await expect(dirPage.locator('[data-testid="room-alert-success"]')).toContainText(
      'approuvée',
      { timeout: 15000 },
    );
    await dirCtx.close();

    // 3. L'équipe Technique (MAINTENANCE) voit l'intervention approuvée et clique "Marquer comme réparé"
    const maintCtx = await browser.newContext();
    const maintPage = await maintCtx.newPage();
    await loginToUrl(maintPage, maintUser.email, maintUser.password);
    await maintPage.goto('/chambres');

    const maintPanel = maintPage.locator('[data-testid="maintenance-approved-interventions-panel"]');
    await expect(maintPanel).toBeVisible({ timeout: 15000 });
    await expect(maintPanel).toContainText('Chambre 105');
    await expect(maintPanel).toContainText(issueText);

    const completeBtn = maintPanel.locator('button:has-text("Marquer comme réparé")').first();
    await completeBtn.click();
    await expect(maintPage.locator('[data-testid="room-alert-success"]')).toContainText(
      'réparée',
      { timeout: 15000 },
    );

    // Vérifier que la chambre 105 est repassée en CLEANING
    const card105 = maintPage.locator('[data-room-number="105"]');
    await expect(card105).toHaveAttribute('data-room-status', 'CLEANING', { timeout: 15000 });
    await maintCtx.close();
  });
});
