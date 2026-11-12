import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const compDir = path.join(repoRoot, 'docs/design/comparaisons');

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) {
      out.push(full);
    }
  }
  return out;
}

test.describe('Facturation V3 — E2E complet, Responsive & Rupture', () => {
  let createdReservationId: string | null = null;
  let createdGuestId: string | null = null;
  let targetRoomNumber = '105';
  const createdInvoiceIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    if (!fs.existsSync(compDir)) {
      fs.mkdirSync(compDir, { recursive: true });
    }

    const today = new Date();
    const checkOut = new Date(today.getTime() + 2 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    // Trouver une chambre libre pour la période de test
    const availRes = await request.get(
      `/api/rooms/available?checkIn=${fmt(today)}&checkOut=${fmt(checkOut)}`,
      { headers: { 'x-user-role': 'DIRECTION' } },
    );
    if (availRes.ok()) {
      const availJson = await availRes.json();
      if (Array.isArray(availJson?.items) && availJson.items.length > 0) {
        targetRoomNumber = availJson.items[0].number;
      }
    }

    // Créer un client et une réservation de test via API réelle
    const guestRes = await request.post('/api/guests', {
      headers: { 'x-user-role': 'DIRECTION' },
      data: {
        civility: 'M.',
        firstName: 'Cheikh',
        lastName: 'DialloE2E',
        phone: `+22177${Math.floor(1000000 + Math.random() * 8999999)}`,
      },
    });
    expect(guestRes.ok()).toBeTruthy();
    const g = await guestRes.json();
    createdGuestId = g.id;

    const resResp = await request.post('/api/reservations', {
      headers: { 'x-user-role': 'DIRECTION' },
      data: {
        roomNumber: targetRoomNumber,
        guestId: createdGuestId,
        checkInDate: fmt(today),
        checkOutDate: fmt(checkOut),
        adultsCount: 1,
        childrenCount: 0,
        status: 'CHECKED_IN',
        breakfastIncluded: false,
        depositFcfa: 0,
      },
    });
    if (!resResp.ok()) {
      throw new Error(`Reservation setup failed (${resResp.status()}): ${await resResp.text()}`);
    }
    const createdRes = await resResp.json();
    createdReservationId = createdRes.id;

    // Simuler une commande restaurant mise sur la chambre
    const restoCharge = await request.post(
      `/api/invoices/room/${encodeURIComponent(targetRoomNumber)}/restaurant-charge`,
      {
        headers: { 'x-user-role': 'RESTAURANT' },
        data: {
          description: 'Yassa Poulet E2E',
          quantity: 2,
          unitPriceFcfa: 4500,
        },
      },
    );
    expect(restoCharge.ok()).toBeTruthy();
  });

  test.afterAll(async ({ request }) => {
    if (createdGuestId || createdReservationId || createdInvoiceIds.length > 0) {
      const cleanupScript = `
        const { PrismaClient } = require('@prisma/client');
        const p = new PrismaClient();
        (async () => {
          const guestId = ${JSON.stringify(createdGuestId)};
          const resId = ${JSON.stringify(createdReservationId)};
          const invIds = ${JSON.stringify(createdInvoiceIds)};
          const roomNum = ${JSON.stringify(targetRoomNumber)};
          const invs = await p.invoice.findMany({
            where: {
              OR: [
                ...(invIds.length ? [{ id: { in: invIds } }, { parentInvoiceId: { in: invIds } }] : []),
                ...(resId ? [{ reservationId: resId }] : []),
                ...(guestId ? [{ guestId }] : []),
              ]
            },
            select: { id: true }
          });
          const allIds = invs.map(i => i.id);
          if (allIds.length) {
            await p.payment.deleteMany({ where: { invoiceId: { in: allIds } } });
            await p.invoiceLine.deleteMany({ where: { invoiceId: { in: allIds } } });
            await p.invoice.deleteMany({ where: { id: { in: allIds } } });
          }
          if (resId) await p.reservation.deleteMany({ where: { id: resId } });
          if (guestId) await p.guest.deleteMany({ where: { id: guestId } });
          await p.room.updateMany({ where: { number: roomNum }, data: { status: 'FREE' } });
          await p.$disconnect();
        })().catch((e) => { console.error(e); process.exit(1); });
      `;
      execFileSync('node', ['--env-file=.env', '-e', cleanupScript], {
        cwd: repoRoot,
        stdio: 'inherit',
      });
    }
    await request
      .patch(`/api/rooms/by-number/${encodeURIComponent(targetRoomNumber)}/status`, {
        headers: { 'x-user-role': 'DIRECTION' },
        data: { status: 'FREE' },
      })
      .catch(() => {});
  });

  test('Rupture : aucun import hérité de l’ancien module dans facturation-v3', async () => {
    const v3Dir = path.join(repoRoot, 'apps/web/src/app/facturation-v3');
    const files = walkFiles(v3Dir);
    expect(files.length).toBeGreaterThanOrEqual(4);

    const forbiddenPatterns = [
      'features/facturation',
      'facturation-mock',
      'FacturationMockService',
      'shared/components/action-button',
      'shared/components/status-badge',
      'shared/components/modal-shell',
      'shared/components/room-status-card',
    ];

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(content).not.toContain(pattern);
      }
    }
  });

  test('Parcours complet Comptoir -> Note -> Ajout ligne -> 2 paiements -> Check-out -> PDF -> Avoir + captures', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/facturation', { waitUntil: 'networkidle' });

    // Vérifier absence de menus cachés, onglets et accordéons
    await expect(page.locator('[data-testid="comptoir-kpis"]')).toBeVisible();
    await expect(page.locator('[role="tablist"]')).toHaveCount(0);

    // Capturer Le Comptoir desktop 1440px
    await page.screenshot({
      path: path.join(compDir, 'actual_facturation_comptoir_desktop.png'),
      fullPage: false,
    });

    // Recherche côté serveur avec debounce 200ms
    const searchInput = page.locator('[data-testid="comptoir-search-input"]');
    await searchInput.fill('DialloE2E');
    await page.waitForTimeout(350);

    const openLink = page.locator('[data-testid^="open-note-"]').first();
    await expect(openLink).toBeVisible();
    const href = await openLink.getAttribute('href');
    expect(href).toBeTruthy();
    const invoiceId = href!.split('/').pop()!;
    createdInvoiceIds.push(invoiceId);

    // Tester 0 scroll horizontal sur Comptoir pour 360, 768, 1024, 1440 px
    for (const w of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(150);
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(ov.sw).toBeLessThanOrEqual(ov.cw);
      if (w === 360) {
        await page.screenshot({
          path: path.join(compDir, 'actual_facturation_comptoir_mobile.png'),
          fullPage: false,
        });
      }
    }

    // Ouvrir la Note du séjour à 1440 px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/facturation/${invoiceId}`, { waitUntil: 'networkidle' });

    await expect(page.locator('[data-testid="note-display-number"]')).toContainText('Note ouverte');
    // Vérifier que la commande restaurant chambre est bien arrivée automatiquement
    await expect(page.locator('[data-testid="category-group-RESTAURANT"]')).toContainText('Yassa Poulet E2E');

    // Ajouter une ligne Piscine via le formulaire visible
    await page.locator('[data-testid="add-line-description"]').fill('Pass Piscine E2E');
    await page.locator('[data-testid="cat-btn-PISCINE"]').click();
    await page.locator('[data-testid="add-line-qty"]').fill('1');
    await page.locator('[data-testid="add-line-price"]').fill('5000');
    await page.locator('[data-testid="btn-submit-line"]').click();
    await expect(page.locator('[data-testid="category-group-PISCINE"]')).toContainText('Pass Piscine E2E');

    // Capture mobile Note + test barre fixe mobile (< 1024 px)
    for (const w of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(150);
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(ov.sw).toBeLessThanOrEqual(ov.cw);
      if (w === 360) {
        await expect(page.locator('[data-testid="mobile-sticky-encaissement"]')).toBeVisible();
        await page.screenshot({
          path: path.join(compDir, 'actual_facturation_note_mobile.png'),
          fullPage: false,
        });
      }
    }

    await page.setViewportSize({ width: 1440, height: 900 });

    // Paiement partiel 1 : 20 000 FCFA en Espèces
    await page.locator('[data-testid="pay-method-CASH"]').click();
    await page.locator('[data-testid="payment-amount-input"]').fill('20000');
    await page.locator('[data-testid="btn-submit-payment"]').click();
    await expect(page.locator('[data-testid="note-status-badge"]')).toContainText('Partielle');

    // Paiement partiel 2 (solde via bouton Solder) en Wave
    await page.locator('[data-testid="pay-method-WAVE"]').click();
    await page.locator('[data-testid="btn-solder"]').click();
    await page.locator('[data-testid="payment-ref-input"]').fill('WAV-E2E-7788');
    await page.locator('[data-testid="btn-submit-payment"]').click();

    await expect(page.locator('[data-testid="note-status-badge"]')).toContainText('Soldée');
    await expect(page.locator('[data-testid="encaissement-balance"]')).toContainText('0 FCFA');

    // Check-out (doit émettre la facture FA-...)
    await page.locator('[data-testid="btn-checkout"]').click();
    await expect(page.locator('[data-testid="note-display-number"]')).toContainText(/FA-\d{4}-\d{4}/);

    // Capturer La Note desktop
    await page.screenshot({
      path: path.join(compDir, 'actual_facturation_note_desktop.png'),
      fullPage: false,
    });

    // Rechargement complet de la page : vérifier persistance PostgreSQL réelle
    await page.reload({ waitUntil: 'networkidle' });
    const issuedNumber = (await page.locator('[data-testid="note-display-number"]').innerText()).trim();
    expect(issuedNumber).toMatch(/^FA-\d{4}-\d{4}$/);

    // Vérifier téléchargement PDF côté serveur
    const pdfCheck = await request.get(`/api/invoices/${invoiceId}/pdf`, {
      headers: { 'x-user-role': 'DIRECTION' },
    });
    expect(pdfCheck.status()).toBe(200);
    expect(pdfCheck.headers()['content-type']).toContain('application/pdf');
    const pdfBuf = await pdfCheck.body();
    expect(pdfBuf.slice(0, 4).toString()).toBe('%PDF');

    // Créer un avoir depuis la page émise
    await page.locator('[data-testid="btn-open-credit-note"]').click();
    await page.locator('[data-testid="credit-note-reason"]').fill('Annulation E2E');
    await page.locator('[data-testid="btn-submit-credit-note"]').click();
    await expect(page.locator('[data-testid="note-display-number"]')).toContainText(/AV-\d{4}-\d{4}/);

    const creditId = page.url().split('/').pop();
    if (creditId) createdInvoiceIds.push(creditId);
  });
});
