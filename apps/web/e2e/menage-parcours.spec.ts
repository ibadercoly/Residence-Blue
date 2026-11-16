import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

test.describe('Commit 2 : Écran simple pour le Ménage, motif de panne & remise en service', () => {
  const capturesDir = path.resolve(__dirname, '../../../docs/design/captures/menage');
  const hkEmail = `menage-e2e-ui-${Date.now()}@residenceblue.sn`;
  const hkPwd = 'MenageUiPass!2026';

  test.beforeAll(async () => {
    fs.mkdirSync(capturesDir, { recursive: true });

    // S'assurer que l'écran Ménage a un compte actif prêt sans dépendre du seed interactif
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
            fullName: 'Awa Ménage E2E',
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
            fullName: 'Awa Ménage E2E',
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
        await prisma.room.updateMany({ where: { number: '101' }, data: { status: 'CLEANING', maintenanceReason: null } });
        await prisma.room.updateMany({ where: { number: '102' }, data: { status: 'OCCUPIED', maintenanceReason: null } });
        await prisma.room.updateMany({ where: { number: '103' }, data: { status: 'FREE', maintenanceReason: null } });
        await prisma.room.updateMany({ where: { number: '104' }, data: { status: 'FREE', maintenanceReason: null } });
        await prisma.$disconnect();
      })();
    `);
  });

  test.afterAll(async () => {
    // Désactiver (ne pas supprimer un compte référencé par audit_log append-only)
    execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      (async () => {
        const prisma = new PrismaClient();
        await prisma.room.updateMany({
          where: { number: { in: ['101', '102', '103', '104'] } },
          data: { status: 'FREE', maintenanceReason: null },
        });
        await prisma.refreshToken.deleteMany({ where: { user: { email: '${hkEmail}' } } });
        await prisma.user.updateMany({
          where: { email: '${hkEmail}' },
          data: { isActive: false },
        });
        await prisma.$disconnect();
      })();
    `);
  });

  test('cycle À nettoyer -> J’ai nettoyé -> Propre, Propre -> À nettoyer, signalement panne, responsive & contrôle Réception/Direction', async ({
    page,
  }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/connexion');
    await page.locator('#user-login').fill(hkEmail);
    await page.locator('#user-password').fill(hkPwd);
    await page.locator('#login-btn').click();
    await expect(page).toHaveURL(/\/chambres/, { timeout: 25000 });
    await expect(page).toHaveURL(/\/chambres/);

    const menagePage = page.locator('[data-testid="menage-chambres-page"]');
    await expect(menagePage).toBeVisible();
    await expect(page.locator('[data-testid="menage-page-title"]')).toContainText('Chambres à nettoyer');

    // Vérifie les 3 groupes dans l'ordre et l'absence stricte de boutons interdits ou prix
    const orderOk = await menagePage.evaluate((root) => {
      const headings = Array.from(root.querySelectorAll('section h2')).map((h) => h.textContent || '');
      const idx1 = headings.findIndex((t) => t.includes('À nettoyer maintenant'));
      const idx2 = headings.findIndex((t) => t.includes('Client présent'));
      const idx3 = headings.findIndex((t) => t.includes('Propres'));
      return idx1 !== -1 && idx2 > idx1 && idx3 > idx2;
    });
    expect(orderOk).toBe(true);

    const bodyText = await menagePage.innerText();
    expect(bodyText).not.toContain('Check-in');
    expect(bodyText).not.toContain('Check-out');
    expect(bodyText).not.toContain('Remettre en service');
    expect(bodyText).not.toContain('FCFA');
    expect(await menagePage.locator('.menu-btn-trigger').count()).toBe(0);

    // Taille des textes (>= 20px) et des boutons d'action (>= 64px)
    const sizingCheck = await menagePage.evaluate((root) => {
      const btns = Array.from(root.querySelectorAll('article button')) as HTMLElement[];
      const badBtns = btns.filter((b) => b.getBoundingClientRect().height < 63.5).map((b) => `${b.innerText}:${b.getBoundingClientRect().height}`);
      const desc = root.querySelector('header p') as HTMLElement | null;
      const descSize = desc ? parseFloat(getComputedStyle(desc).fontSize) : 0;
      return { badBtns, descSize };
    });
    expect(sizingCheck.badBtns).toEqual([]);
    expect(sizingCheck.descSize).toBeGreaterThanOrEqual(20);

    // Capture écran Ménage desktop
    await page.screenshot({ path: path.join(capturesDir, 'menage_desktop_1280.png'), fullPage: true });

    // Cycle 1 : À nettoyer (101) -> J'ai nettoyé -> Propre
    await expect(page.locator('[data-testid="menage-card-cleaning-101"]')).toBeVisible();
    await page.locator('[data-testid="menage-btn-cleaned-101"]').click();
    await expect(page.locator('[data-testid="menage-card-free-101"]')).toBeVisible();
    await expect(page.locator('[data-testid="menage-empty-cleaning"]')).toContainText('Aucune chambre à nettoyer, merci !');

    // Cycle 2 : Propre (103) -> À nettoyer
    await expect(page.locator('[data-testid="menage-card-free-103"]')).toBeVisible();
    await page.locator('[data-testid="menage-btn-dirty-103"]').click();
    await expect(page.locator('[data-testid="menage-card-cleaning-103"]')).toBeVisible();

    // Signalement de problème sur chambre 102 (Client présent / OCCUPIED)
    await page.locator('[data-testid="menage-btn-report-102"]').click();
    const modal = page.locator('[data-testid="menage-problem-modal"]');
    await expect(modal).toBeVisible();
    await expect(page.locator('[data-testid="menage-problem-warning"]')).toContainText(
      "Cette chambre ne pourra plus être louée tant qu'elle n'est pas réparée",
    );
    await page.locator('[data-testid="menage-problem-choice-fuite"]').click();
    await page.locator('[data-testid="menage-problem-note"]').fill('robinet qui coule');
    await page.screenshot({ path: path.join(capturesDir, 'menage_problem_modal.png') });
    await page.locator('[data-testid="menage-problem-submit"]').click();
    await expect(modal).not.toBeVisible();

    await expect(page.locator('[data-testid="menage-card-reported-102"]')).toContainText(
      "Hors service : Fuite d'eau — robinet qui coule",
    );

    // Responsive 360, 768, 1024, 1440 px : 0 scroll horizontal
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 840 });
      await page.waitForTimeout(350);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(metrics.scrollWidth, `Débordement horizontal Ménage à ${width}px`).toBeLessThanOrEqual(metrics.clientWidth);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(capturesDir, 'menage_mobile_360.png'), fullPage: true });

    // Vérifier côté Réception : voit "Hors service : ..." sur Chambres + Planning, et PAS de bouton Remettre en service
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
    await page.goto('/chambres');
    await expect(page.locator('[data-testid="room-card-maintenance-reason-102"]')).toContainText(
      "Hors service : Fuite d'eau — robinet qui coule",
    );
    await expect(page.locator('[data-testid="action-btn-restore-102"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="filter-pill-cleaning"]')).toContainText('À nettoyer');

    await page.goto('/planning');
    await expect(page.locator('[data-testid="planning-maintenance-badge-102"]')).toContainText(
      "Hors service : Fuite d'eau — robinet qui coule",
    );
    await page.screenshot({ path: path.join(capturesDir, 'reception_planning_motif.png') });

    // Vérifier côté Direction : voit Remettre en service et réactive la chambre 102
    await loginViaUi(page, 'aissatou.ba@residenceblue.sn', 'ThiesTeranga2024!');
    await page.goto('/chambres');
    await expect(page.locator('[data-testid="action-btn-restore-102"]')).toBeVisible();
    await page.locator('[data-testid="action-btn-restore-102"]').click();
    await expect(page.locator('[data-testid="room-card-maintenance-reason-102"]')).toHaveCount(0);
  });
});
