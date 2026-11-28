import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

const SCREENSHOT_DIR = path.resolve(__dirname, '../../../docs/location/screenshots');

test.describe('Tarifs réels et côté location (E2E + responsive)', () => {
  let director = { email: '', password: '' };
  let reception = { email: '', password: '' };
  let receptionHeaders: Record<string, string> = {};
  let testRoomId = '';
  let testRoomNumber = '';
  let testGuestId = '';

  test.beforeAll(async ({ request }) => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    director = createE2eUser('DIRECTION');
    reception = createE2eUser('RECEPTION');
    receptionHeaders = await getApiAuthHeaders(request, reception.email, reception.password);

    // Préparer une chambre Standard libre et un client dédiés dans la base E2E
    testRoomNumber = `9${String(Date.now()).slice(-3)}`;
    const seededJson = execE2eNodeScript(`
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      (async () => {
        const stdCat = await prisma.tariffCategory.findUnique({ where: { code: 'STANDARD' } });
        if (!stdCat) throw new Error('Catégorie STANDARD manquante dans residence_blue_e2e');
        let stdType = await prisma.roomType.findUnique({ where: { name: 'Standard' } });
        if (!stdType) {
          stdType = await prisma.roomType.create({ data: { name: 'Standard' } });
        }
        const room = await prisma.room.create({
          data: {
            number: ${JSON.stringify(testRoomNumber)},
            typeId: stdType.id,
            tariffCategoryId: stdCat.id,
            category: 'Standard',
            floor: 1,
            adultsCapacity: 2,
            childrenCapacity: 0,
            status: 'FREE',
            breakfastIncluded: true,
          },
        });
        const guest = await prisma.guest.create({
          data: {
            firstName: 'Aminata',
            lastName: 'Diallo E2E',
            fullName: 'Aminata Diallo E2E',
            phone: '+221 77 888 99 00',
          },
        });
        console.log(JSON.stringify({ roomId: room.id, guestId: guest.id }));
        await prisma.$disconnect();
      })();
    `);
    const seeded = JSON.parse(seededJson.split(/\r?\n/).pop() || '{}');
    testRoomId = seeded.roomId;
    testGuestId = seeded.guestId;
  });

  test.afterAll(async () => {
    if (testRoomId || testGuestId) {
      execE2eNodeScript(`
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        (async () => {
          if (${JSON.stringify(testRoomId)}) {
            await prisma.reservation.deleteMany({ where: { roomId: ${JSON.stringify(testRoomId)} } });
            await prisma.room.deleteMany({ where: { id: ${JSON.stringify(testRoomId)} } });
          }
          if (${JSON.stringify(testGuestId)}) {
            await prisma.guest.deleteMany({ where: { id: ${JSON.stringify(testGuestId)} } });
          }
          await prisma.$disconnect();
        })();
      `);
    }
    deleteE2eUsers([director.email, reception.email]);
  });

  test('DIRECTION gère la grille des tarifs, sans débordement horizontal aux 4 largeurs (360/768/1024/1440 px)', async ({
    page,
  }) => {
    await loginViaUi(page, director.email, director.password);

    // Accès via la carte Tarifs dans Administration (aucune nouvelle entrée de menu latéral)
    await page.goto('/administration/comptes');
    await expect(page.getByTestId('admin-tarifs-card')).toBeVisible();
    await page.getByTestId('btn-open-admin-tarifs').click();
    await page.waitForURL('**/administration/tarifs');

    await expect(page.getByTestId('admin-tarifs-page')).toBeVisible();
    await expect(page.getByTestId('tarifs-scope-notice')).toContainText('nouvelles réservations');

    // Vérifier la grille papier : prix réels, Non proposé, À définir, et prestations
    await expect(page.getByTestId('tariff-input-STANDARD-1p')).toHaveValue('30000');
    await expect(page.getByTestId('tariff-input-STANDARD-2p-1c')).toHaveValue('35000');
    await expect(page.getByTestId('tariff-input-CONFORT-1p')).toHaveValue('35000');
    await expect(page.getByTestId('tariff-input-APPARTEMENT-6p')).toHaveValue('105000');
    await expect(page.getByTestId('tariff-not-offered-STANDARD-3p-2c')).toContainText('Non proposé');
    await expect(page.getByTestId('tariff-undefined-badge-APPARTEMENT-3p-3c')).toContainText('À définir');
    await expect(page.getByTestId('extra-services-section')).toContainText('Prestations');

    // Contrôle responsive strict (scrollWidth <= clientWidth) aux 4 largeurs + captures d'écran
    const widths = [360, 768, 1024, 1440];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(
        metrics.scrollWidth,
        `Débordement horizontal à ${width}px : scrollWidth=${metrics.scrollWidth}, clientWidth=${metrics.clientWidth}`,
      ).toBeLessThanOrEqual(metrics.clientWidth);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `tarifs-${width}.png`),
        fullPage: false,
      });
    }

    // Modifier une case, enregistrer, vérifier le retour, puis restaurer 35000
    await page.setViewportSize({ width: 1440, height: 900 });
    const std2p = page.getByTestId('tariff-input-STANDARD-2p-1c');
    await std2p.fill('37000');
    await expect(page.getByTestId('btn-save-tariffs')).toBeEnabled();
    await page.getByTestId('btn-save-tariffs').click();
    await expect(page.getByTestId('tarifs-success-banner')).toBeVisible();
    await expect(std2p).toHaveValue('37000');

    // Restauration
    await std2p.fill('35000');
    await page.getByTestId('btn-save-tariffs').click();
    await expect(page.getByTestId('tarifs-success-banner')).toBeVisible();
    await expect(std2p).toHaveValue('35000');
  });

  test('RECEPTION reçoit 403 sur /administration/tarifs et en appel direct API', async ({
    page,
    request,
  }) => {
    const directPut = await request.put('/api/tariffs/grid', {
      headers: receptionHeaders,
      data: { items: [] },
    });
    expect(directPut.status()).toBe(403);

    await loginViaUi(page, reception.email, reception.password);
    await page.goto('/administration/tarifs');
    await expect(page.getByTestId('admin-forbidden-403')).toBeVisible();
    await expect(page.getByTestId('admin-forbidden-403')).toContainText('Accès refusé (403)');
  });

  test('Formulaire de réservation : ligne de prix claire et bouton désactivé sans tarif', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await loginViaUi(page, reception.email, reception.password);
    await page.goto('/planning');
    await expect(page.getByTestId('planning-header-new-btn')).toBeVisible();

    await page.getByTestId('planning-header-new-btn').click();
    await expect(page.getByTestId('reservation-modal-dialog')).toBeVisible();

    // La réception ne doit jamais voir la zone de surcharge direction
    await expect(page.getByTestId('director-price-override-box')).toHaveCount(0);

    // Sélectionner 3 nuits
    await page.getByTestId('duration-pill-3').click();

    // Afficher toutes les chambres si besoin puis cliquer notre chambre Standard de test
    const showMore = page.getByTestId('show-more-rooms');
    if (await showMore.isVisible().catch(() => false)) {
      await showMore.click();
    }
    const roomBtn = page.getByTestId(`room-option-${testRoomNumber}`);
    await expect(roomBtn).toBeVisible();
    await roomBtn.click();

    // Passer à 2 adultes
    await page.getByTestId('adults-plus').click();

    // Vérifier la ligne unique exacte demandée
    const summaryLine = page.getByTestId('reservation-tariff-summary-line');
    await expect(summaryLine).toBeVisible();
    await expect(summaryLine).toContainText(
      'Chambre Standard, 2 personnes, petit-déjeuner inclus : 35 000 FCFA par nuit, total 105 000 FCFA pour 3 nuits',
    );

    // Sélectionner le client E2E pour vérifier que le bouton est actif quand un tarif existe
    await page.getByTestId('guest-search-input').fill('Aminata Diallo E2E');
    await page.getByTestId(`guest-result-${testGuestId}`).click();
    await expect(page.getByTestId('reservation-confirm-btn')).toBeEnabled();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'reservation-tarif-valide.png'),
      fullPage: false,
    });

    // Passer à 3 adultes -> pas de tarif en Standard -> erreur claire + bouton désactivé
    await page.getByTestId('adults-plus').click();
    const errBox = page.getByTestId('reservation-tariff-error');
    await expect(errBox).toBeVisible();
    await expect(errBox).toContainText('Pas de tarif pour 3 personnes en chambre Standard');
    await expect(page.getByTestId('reservation-confirm-btn')).toBeDisabled();

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'reservation-sans-tarif.png'),
      fullPage: false,
    });
  });
});
