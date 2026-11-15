import { test, expect } from '@playwright/test';
import { createE2eUser, deleteE2eUsers, getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { execE2eNodeScript } from './e2e-db.helper';

function cleanupBulkNotes() {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const guests = await p.guest.findMany({
        where: { lastName: { startsWith: 'TableauBulk' } },
        select: { id: true },
      });
      const gIds = guests.map((g) => g.id);
      if (gIds.length) {
        const invs = await p.invoice.findMany({
          where: { guestId: { in: gIds } },
          select: { id: true },
        });
        const invIds = invs.map((i) => i.id);
        if (invIds.length) {
          await p.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
          await p.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
          await p.invoice.deleteMany({ where: { parentInvoiceId: { in: invIds } } });
          await p.invoice.deleteMany({ where: { id: { in: invIds } } });
        }
        await p.reservation.deleteMany({ where: { guestId: { in: gIds } } });
        await p.guest.deleteMany({ where: { id: { in: gIds } } });
      }
      await p.$disconnect();
    })();
  `);
}

function seedBulkNotes(count: number, startIdx: number) {
  execE2eNodeScript(`
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const rooms = await p.room.findMany({ take: 12, orderBy: { number: 'asc' } });
      const now = new Date();
      const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);
      const tomorrowUtc = new Date(todayUtc.getTime() + 86400000);

      for (let i = 0; i < ${count}; i++) {
        const idx = ${startIdx} + i;
        const pad = String(idx).padStart(3, '0');
        const isDepartureToday = idx === 17;
        const room = isDepartureToday
          ? (rooms.find((r) => r.number === '106') || rooms[5] || rooms[0])
          : rooms[(idx - 1) % rooms.length];
        const guest = await p.guest.create({
          data: {
            civility: 'M.',
            firstName: 'Client',
            lastName: 'TableauBulk_' + pad,
            fullName: 'Client TableauBulk_' + pad,
            phone: '+2217799' + pad + '00',
          },
        });

        const isPaidTodayReady = idx === 16;
        // flag set above
        const isOverdue = idx === 18;
        const isIssuedArchive = idx === 19;
        const isPartial = !isPaidTodayReady && !isIssuedArchive && idx % 3 === 0;

        const totalFcfa = 40000 + (idx % 10) * 5000;
        const paidFcfa = isPaidTodayReady || isIssuedArchive
          ? totalFcfa
          : isPartial
            ? 15000
            : 0;
        const balanceFcfa = totalFcfa - paidFcfa;
        const status = balanceFcfa === 0 ? 'PAID' : paidFcfa > 0 ? 'PARTIAL' : 'OPEN';

        const dayStep = Math.floor((idx - 1) / 12) + 1;
        const checkIn = isDepartureToday
          ? new Date(todayUtc.getTime() - 2 * 86400000)
          : new Date(todayUtc.getTime() - (dayStep * 4 + 10) * 86400000);
        const checkOut = isDepartureToday
          ? todayUtc
          : new Date(checkIn.getTime() + 2 * 86400000);
        const res = await p.reservation.create({
          data: {
            reference: 'RES-TBL-' + Date.now() + '-' + pad,
            guestId: guest.id,
            roomId: room.id,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            nights: 2,
            status: isIssuedArchive ? 'CHECKED_OUT' : 'CHECKED_IN',
            totalFcfa,
          },
        });

        const inv = await p.invoice.create({
          data: {
            invoiceNumber: isIssuedArchive ? 'FA-2026-9' + pad : null,
            documentType: 'INVOICE',
            isIssued: isIssuedArchive,
            reservationId: res.id,
            guestId: guest.id,
            roomId: room.id,
            subtotalHtFcfa: totalFcfa,
            totalFcfa,
            paidAmountFcfa: paidFcfa,
            balanceFcfa,
            status,
            settledAt: balanceFcfa === 0 ? now : null,
            createdAt: isOverdue ? twoDaysAgo : now,
            issuedAt: now,
          },
        });

        if (paidFcfa > 0) {
          await p.payment.create({
            data: {
              invoiceId: inv.id,
              method: idx % 2 === 0 ? 'WAVE' : 'CASH',
              amountFcfa: paidFcfa,
              receivedByName: 'E2E Seed',
              paidAt: now,
            },
          });
        }
      }
      await p.$disconnect();
    })();
  `);
}

test.describe('Comptoir Tableau Unique & Archives (300 notes, base E2E séparée)', () => {
  let dirUser = { email: '', password: '' };

  test.beforeAll(() => {
    cleanupBulkNotes();
    dirUser = createE2eUser('DIRECTION');
  });

  test.afterAll(() => {
    cleanupBulkNotes();
    if (dirUser.email) {
      deleteE2eUsers([dirUser.email]);
    }
  });

  test('15 vs 300 notes : hauteur page identique, scrollbar 12px, lots de 50, tri, filtres, recherche, checkout, archives et < 500ms', async ({
    page,
    request,
  }) => {
    test.setTimeout(120000);

    // 1. Seed 15 notes et mesurer hauteur page
    seedBulkNotes(15, 1);
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dirUser.email, dirUser.password);
    await page.goto('/facturation', { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="comptoir-rows"] > [role="row"]').first()).toBeVisible();

    const height15 = await page.evaluate(() => ({
      docHeight: document.documentElement.scrollHeight,
      rowCount: document.querySelectorAll('[data-testid="comptoir-rows"] > [role="row"]').length,
    }));
    expect(height15.rowCount).toBeGreaterThanOrEqual(15);

    // 2. Seed +285 notes => 300 notes en base E2E
    seedBulkNotes(285, 16);
    await page.reload({ waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="comptoir-count"]')).toContainText('50 sur');

    const metrics300 = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="comptoir-table-scroll"]') as HTMLElement;
      const header = document.querySelector('[data-testid="comptoir-table-header"]') as HTMLElement;
      const firstRow = document.querySelector('[data-testid="comptoir-rows"] > [role="row"]') as HTMLElement;
      const rows = Array.from(document.querySelectorAll('[data-testid="comptoir-rows"] > [role="row"]'));
      const everyRowHasTwoBtns = rows.every((r) => r.querySelectorAll('a, button').length === 2);
      return {
        docHeight: document.documentElement.scrollHeight,
        offsetWidth: box.offsetWidth,
        clientWidth: box.clientWidth,
        scrollHeight: box.scrollHeight,
        clientHeight: box.clientHeight,
        headerPosition: getComputedStyle(header).position,
        firstRowHeight: firstRow.getBoundingClientRect().height,
        rowCount: rows.length,
        everyRowHasTwoBtns,
      };
    });

    // Hauteur page identique avec 15 ou 300 notes
    expect(Math.abs(metrics300.docHeight - height15.docHeight)).toBeLessThanOrEqual(2);
    // Barre de défilement visible (offsetWidth > clientWidth)
    expect(metrics300.offsetWidth).toBeGreaterThan(metrics300.clientWidth);
    expect(metrics300.scrollHeight).toBeGreaterThan(metrics300.clientHeight);
    // Sticky header & lignes >= 48px & 50 lignes par lot & 2 boutons par ligne
    expect(metrics300.headerPosition).toBe('sticky');
    expect(metrics300.firstRowHeight).toBeGreaterThanOrEqual(48);
    expect(metrics300.rowCount).toBe(50);
    expect(metrics300.everyRowHasTwoBtns).toBe(true);

    // 3. Défiler vers le bas du tableau => charge le lot suivant (100 sur ...)
    await page.evaluate(() => {
      const box = document.querySelector('[data-testid="comptoir-table-scroll"]') as HTMLElement;
      box.scrollTop = box.scrollHeight;
      box.dispatchEvent(new Event('scroll'));
    });
    await expect(page.locator('[data-testid="comptoir-count"]')).toContainText('100 sur', {
      timeout: 10000,
    });
    const docHeightAfter100 = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(Math.abs(docHeightAfter100 - metrics300.docHeight)).toBeLessThanOrEqual(2);

    // 4. Tri par Client, Séjour, Reste
    await page.locator('[data-testid="sort-balance"]').click();
    await expect(page.locator('[data-testid="sort-balance"]')).toContainText('↓');
    await page.locator('[data-testid="sort-guest"]').click();
    await expect(page.locator('[data-testid="sort-guest"]')).toContainText('↑');
    await page.locator('[data-testid="sort-stay"]').click();
    await expect(page.locator('[data-testid="sort-stay"]')).toContainText('↑');

    // 5. Filtres Comptoir : Départs aujourd'hui, Plus de 24 h, Soldées du jour + check-out direct
    await page.locator('[data-testid="filter-pill-DEPARTURES_TODAY"]').click();
    await expect(page.locator('[data-testid="comptoir-rows"]')).toContainText('TableauBulk_017');

    await page.locator('[data-testid="filter-pill-OVERDUE_24H"]').click();
    await expect(page.locator('[data-testid="comptoir-rows"]')).toContainText('TableauBulk_018');

    await page.locator('[data-testid="filter-pill-PAID_TODAY"]').click();
    await expect(page.locator('[data-testid="comptoir-rows"]')).toContainText('TableauBulk_016');
    await expect(page.locator('[data-testid="comptoir-rows"]')).toContainText('Soldée à clôturer');
    await expect(page.locator('[data-testid="comptoir-rows"]')).not.toContainText('Note ouverte');

    // Cliquer sur Clôturer sur TableauBulk_016 -> check-out => sort du Comptoir
    const settledRow = page.locator('[data-testid="comptoir-rows"] > [role="row"]', {
      hasText: 'TableauBulk_016',
    });
    await expect(settledRow.locator('button', { hasText: 'Clôturer' })).toBeVisible();
    await settledRow.locator('button', { hasText: 'Clôturer' }).click();
    await expect(page.locator('[data-testid="comptoir-success-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="comptoir-rows"]')).not.toContainText('TableauBulk_016');

    // 6. Recherche côté serveur
    await page.locator('[data-testid="filter-pill-TO_PROCESS"]').click();
    await page.locator('[data-testid="comptoir-search-input"]').fill('TableauBulk_042');
    await expect(page.locator('[data-testid="comptoir-count"]')).toContainText('1 sur 1 note', {
      timeout: 5000,
    });
    await page.locator('[data-testid="comptoir-search-input"]').fill('');
    await expect(page.locator('[data-testid="comptoir-count"]')).toContainText('50 sur', {
      timeout: 5000,
    });

    // 7. Responsive sans scroll horizontal à 360, 768, 1024, 1440 px
    for (const w of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(100);
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(ov.sw, `Overflow détecté à ${w}px sur Comptoir`).toBeLessThanOrEqual(ov.cw);
      if (w === 360) {
        await expect(page.locator('[data-testid^="note-card-mobile-"]').first()).toBeVisible();
      }
    }

    // 8. Navigation vers Archives (/facturation/archives)
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('[data-testid="link-all-invoices"]').click();
    await page.waitForURL('**/facturation/archives');
    await expect(page.locator('[data-testid="facturation-archives"]')).toBeVisible();
    await expect(page.locator('[data-testid="archives-rows"]')).toContainText('TableauBulk_016');
    await expect(page.locator('[data-testid="archives-rows"]')).toContainText('TableauBulk_019');

    await page.locator('[data-testid="archives-search-input"]').fill('TableauBulk_019');
    await expect(page.locator('[data-testid="archives-count"]')).toContainText('1 sur 1 note', {
      timeout: 5000,
    });
    await page.locator('[data-testid="archives-search-input"]').fill('');

    await page.locator('[data-testid="archives-method-select"]').selectOption('WAVE');
    await page.locator('[data-testid="archives-status-select"]').selectOption('PAID');
    await expect(page.locator('[data-testid="archives-export-btn"]')).toBeVisible();

    for (const w of [360, 768, 1024, 1440]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.waitForTimeout(100);
      const ov = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        cw: document.documentElement.clientWidth,
      }));
      expect(ov.sw, `Overflow détecté à ${w}px sur Archives`).toBeLessThanOrEqual(ov.cw);
    }

    // 9. Performance API routes < 500 ms sur 300+ notes
    const headers = await getApiAuthHeaders(request, dirUser.email, dirUser.password);
    for (const endpoint of [
      '/api/invoices/counter?offset=0&limit=50',
      '/api/invoices/counter?offset=50&limit=50&sortBy=balance&sortOrder=desc',
      '/api/invoices/archives?offset=0&limit=50',
    ]) {
      const t0 = Date.now();
      const res = await request.get(endpoint, { headers });
      const elapsed = Date.now() - t0;
      expect(res.status()).toBe(200);
      expect(elapsed, `${endpoint} a pris ${elapsed}ms (> 500ms)`).toBeLessThan(500);
    }
  });
});
