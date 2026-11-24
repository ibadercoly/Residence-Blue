import { test, expect } from '@playwright/test';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

test.describe('Paramètres de l’hôtel et routes inconnues', () => {
  let director = { email: '', password: '' };
  let reception = { email: '', password: '' };
  let directorHeaders: Record<string, string> = {};
  let receptionHeaders: Record<string, string> = {};
  let originalVatRate = 10;
  let originalTaxIncludesChildren = false;
  let invoiceId: string | null = null;

  test.beforeAll(async ({ request }) => {
    director = createE2eUser('DIRECTION');
    reception = createE2eUser('RECEPTION');
    directorHeaders = await getApiAuthHeaders(request, director.email, director.password);
    receptionHeaders = await getApiAuthHeaders(request, reception.email, reception.password);
    const response = await request.get('/api/hotel-settings', { headers: directorHeaders });
    expect(response.ok()).toBeTruthy();
    const settings = await response.json();
    originalVatRate = settings.vatRatePercent;
    originalTaxIncludesChildren = settings.tourismTaxIncludesChildren ?? false;
  });

  test.afterAll(async ({ request }) => {
    if (directorHeaders.Authorization) {
      await request.patch('/api/hotel-settings', {
        headers: directorHeaders,
        data: {
          vatRatePercent: originalVatRate,
          tourismTaxIncludesChildren: originalTaxIncludesChildren,
        },
      });
    }
    if (invoiceId) {
      execE2eNodeScript(`
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        (async () => {
          await prisma.payment.deleteMany({ where: { invoiceId: ${JSON.stringify(invoiceId)} } });
          await prisma.invoiceLine.deleteMany({ where: { invoiceId: ${JSON.stringify(invoiceId)} } });
          await prisma.invoice.deleteMany({ where: { id: ${JSON.stringify(invoiceId)} } });
          await prisma.$disconnect();
        })();
      `);
    }
    deleteE2eUsers([director.email, reception.email]);
  });

  test('direction peut modifier la TVA, les autres rôles sont refusés et la facture reprend le nouveau taux', async ({ page, request }) => {
    await loginViaUi(page, director.email, director.password);
    await expect(page.getByTestId('nav-parametres')).toBeVisible();
    await page.goto('/parametres');
    await expect(page.getByRole('heading', { name: 'Paramètres de l’hôtel' })).toBeVisible();
    await expect(page.getByTestId('hotel-tourism-tax-children')).toBeVisible();
    await expect(page.getByTestId('hotel-tourism-tax-children')).toBeChecked({ checked: false });

    await page.getByTestId('hotel-vat-rate').fill('12');
    await expect(page.getByTestId('hotel-vat-rate')).toHaveValue('12');
    await page.getByTestId('hotel-tourism-tax-children').check();
    const patchRequest = page.waitForRequest((request) =>
      request.url().includes('/api/hotel-settings') && request.method() === 'PATCH',
    );
    const patchResponse = page.waitForResponse((response) =>
      response.url().includes('/api/hotel-settings') && response.request().method() === 'PATCH',
    );
    await page.getByTestId('hotel-settings-save').click();
    expect((await patchRequest).postDataJSON().vatRatePercent).toBe(12);
    const savedResponse = await patchResponse;
    expect(savedResponse.status()).toBe(200);
    expect((await savedResponse.json()).vatRatePercent).toBe(12);
    await expect(page.getByTestId('hotel-settings-success')).toContainText('ont été enregistrés');

    const forbidden = await request.patch('/api/hotel-settings', {
      headers: receptionHeaders,
      data: { vatRatePercent: 13 },
    });
    expect(forbidden.status()).toBe(403);
    const settingsAfterSave = await request.get('/api/hotel-settings', { headers: directorHeaders });
    expect((await settingsAfterSave.json()).vatRatePercent).toBe(12);

    const invoiceResponse = await request.post('/api/invoices', {
      headers: receptionHeaders,
      data: {
        roomNumber: '101',
        depositFcfa: 0,
        lines: [{ description: 'Nuitée de vérification fiscale', category: 'ROOM', quantity: 1, unitPriceFcfa: 35000 }],
      },
    });
    expect(invoiceResponse.status()).toBe(201);
    const invoice = await invoiceResponse.json();
    invoiceId = invoice.id;
    expect(invoice.vatRatePercent).toBe(12);
  });

  test('les routes reportées et les URL inconnues reviennent au tableau de bord avec un message', async ({ page }) => {
    await loginViaUi(page, director.email, director.password);
    for (const route of ['/housekeeping', '/maintenance', '/stocks', '/marketing', '/channel-manager', '/comptabilite', '/inconnue']) {
      await page.goto(route);
      await expect(page).toHaveURL(/tableau-de-bord/);
      await expect(page.getByTestId('reservation-toast')).toContainText('Page introuvable');
    }
  });

  test('la page paramètres ne déborde pas horizontalement aux largeurs prévues', async ({ page }) => {
    await loginViaUi(page, director.email, director.password);
    await page.goto('/parametres');
    for (const width of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByTestId('hotel-settings-save')).toBeVisible();
      const hasHorizontalOverflow = await page.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(hasHorizontalOverflow, `débordement horizontal à ${width}px`).toBe(false);
    }
  });

});
