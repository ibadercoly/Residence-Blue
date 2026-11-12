import { test, expect, Page } from '@playwright/test';

function futureIso(daysFromToday: number): string {
  const now = new Date();
  now.setDate(now.getDate() + daysFromToday);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function openModalFromHeader(page: Page): Promise<number> {
  const openBtn = page.locator('[data-testid="header-new-reservation-btn"]');
  await expect(openBtn).toBeVisible();
  return page.evaluate(async () => {
    const btn = document.querySelector('[data-testid="header-new-reservation-btn"]') as HTMLElement;
    const t0 = performance.now();
    btn.click();
    return new Promise<number>((resolve) => {
      const check = () => {
        const dlg = document.querySelector('[data-testid="reservation-modal-dialog"]');
        const inp = document.querySelector('[data-testid="res-checkin-input"]') as HTMLElement | null;
        if (dlg && inp) {
          resolve(performance.now() - t0);
          return;
        }
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
  });
}

test.describe('Refonte Fenêtre Nouvelle Réservation - E2E & Budget Performance', () => {
  const createdGuestIds: string[] = [];

  test.afterEach(async ({ request }) => {
    for (const guestId of createdGuestIds.splice(0)) {
      const gRes = await request.get(`/api/guests/${guestId}`, {
        headers: { 'x-user-role': 'DIRECTION' },
      });
      if (gRes.ok()) {
        const gData = await gRes.json();
        const reservations = Array.isArray(gData?.reservations) ? gData.reservations : [];
        for (const r of reservations) {
          if (r?.id) {
            await request.post(`/api/reservations/${r.id}/cancel`, {
              headers: { 'x-user-role': 'DIRECTION' },
            });
          }
        }
      }
    }
  });

  test('Budget performance strict : ouverture < 150 ms, frappe < 50 ms, <= 300 DOM, <= 2 API (< 20 Ko)', async ({
    page,
  }) => {
    await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
    await page.waitForTimeout(300); // laisser le prefetch on idle terminer si applicable

    const openRequests: Array<{ url: string; bytes: number }> = [];
    page.on('response', async (resp) => {
      if (resp.url().includes('/api/')) {
        const lenHeader = Number(resp.headers()['content-length'] || 0);
        const bodyLen = lenHeader || (await resp.body().catch(() => Buffer.alloc(0))).length;
        openRequests.push({ url: resp.url(), bytes: bodyLen });
      }
    });

    const openMs = await openModalFromHeader(page);
    expect(openMs).toBeLessThan(150);

    const dialog = page.locator('[data-testid="reservation-modal-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-testid="available-rooms-list"]')).toBeVisible();

    const domNodes = await dialog.evaluate((el) => el.querySelectorAll('*').length + 1);
    expect(domNodes).toBeLessThanOrEqual(300);

    const totalOpenBytes = openRequests.reduce((acc, r) => acc + r.bytes, 0);
    expect(openRequests.length).toBeLessThanOrEqual(2);
    expect(totalOpenBytes).toBeLessThan(20 * 1024);

    // Mesure de latence d'une frappe dans le champ recherche client (< 50 ms)
    const searchInput = page.locator('[data-testid="guest-search-input"]');
    await searchInput.focus();
    const keyMs = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const inp = document.querySelector('[data-testid="guest-search-input"]') as HTMLInputElement;
          const t0 = performance.now();
          inp.value = 'Diop';
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          requestAnimationFrame(() => resolve(performance.now() - t0));
        }),
    );
    expect(keyMs).toBeLessThan(50);
  });

  test('Responsive 360, 768, 1024 et 1440 px : 0 scroll horizontal + barre verticale visible', async ({
    page,
  }) => {
    const viewports = [
      { width: 360, height: 740 },
      { width: 768, height: 900 },
      { width: 1024, height: 800 },
      { width: 1440, height: 900 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize(vp);
      await page.goto('/tableau-de-bord', { waitUntil: 'networkidle' });
      await page.locator('[data-testid="header-new-reservation-btn"]').click();

      const dialog = page.locator('[data-testid="reservation-modal-dialog"]');
      const scrollBody = page.locator('[data-testid="reservation-modal-body"]');
      await expect(dialog).toBeVisible();
      await expect(scrollBody).toBeVisible();

      const metrics = await page.evaluate(() => {
        const doc = document.documentElement;
        const body = document.querySelector('[data-testid="reservation-modal-body"]') as HTMLElement;
        return {
          docScrollW: doc.scrollWidth,
          docClientW: doc.clientWidth,
          bodyScrollW: body.scrollWidth,
          bodyClientW: body.clientClientWidth ?? body.clientWidth,
          bodyOffsetW: body.offsetWidth,
          overflowY: getComputedStyle(body).overflowY,
        };
      });

      expect(metrics.docScrollW).toBeLessThanOrEqual(metrics.docClientW);
      expect(metrics.bodyScrollW).toBeLessThanOrEqual(metrics.bodyClientW);
      expect(metrics.overflowY).toBe('scroll');
      expect(metrics.bodyOffsetW).toBeGreaterThan(metrics.bodyClientW);

      if (vp.width === 1440 || vp.width === 360) {
        await page.screenshot({
          path: `test-results/reservation-modal-${vp.width}px.png`,
          fullPage: false,
        });
      }

      await page.locator('[data-testid="reservation-cancel-btn"]').click();
    }
  });

  test('Parcours complet : client rapide + acompte Wave + persistance PostgreSQL après rechargement', async ({
    page,
  }) => {
    await page.goto('/planning', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="header-new-reservation-btn"]').click();

    const checkIn = futureIso(20);
    const checkOut = futureIso(23);
    await page.locator('[data-testid="res-checkin-input"]').fill(checkIn);
    await page.locator('[data-testid="res-checkout-input"]').fill(checkOut);

    // Sélectionner la première chambre libre affichée
    const firstRoom = page.locator('[data-testid="available-rooms-list"] button').first();
    await expect(firstRoom).toBeVisible();
    await firstRoom.click();

    // Créer un client rapide sénégalais dans la même transaction
    await page.locator('[data-testid="toggle-quick-guest"]').click();
    const uniqueName = `Mariama Sow E2E ${Date.now()}`;
    await page.locator('[data-testid="quick-guest-name"]').fill(uniqueName);
    await page.locator('[data-testid="quick-guest-phone"]').fill('+221 77 812 34 56');

    // Acompte + Wave + source WhatsApp
    await page.locator('[data-testid="res-deposit-input"]').fill('25000');
    await page.locator('[data-testid="res-payment-method"]').selectOption('WAVE');
    await page.locator('[data-testid="res-tx-ref"]').fill('WAV-E2E-2026');
    await page.locator('[data-testid="res-source-select"]').selectOption('WHATSAPP');

    const postPromise = page.waitForResponse(
      (r) => r.url().includes('/api/reservations') && r.request().method() === 'POST',
    );
    await page.locator('[data-testid="reservation-confirm-btn"]').click();
    const postResp = await postPromise;
    expect(postResp.status()).toBe(201);
    const created = await postResp.json();
    if (created?.guestId) createdGuestIds.push(created.guestId);

    // Toast « Réservation enregistrée » visible et fenêtre fermée
    await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="reservation-toast"]')).toContainText(
      'Réservation enregistrée',
    );

    // Vérifier la persistance après F5
    await page.reload({ waitUntil: 'networkidle' });
    await page.goto('/clients', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(uniqueName);
  });

  test('Préremplissage depuis la fiche chambre', async ({ page }) => {
    await page.goto('/chambres', { waitUntil: 'networkidle' });
    const cardBtn = page.locator('[data-testid^="room-card-"]').first();
    await cardBtn.click();

    const reserveRoomBtn = page.locator('[data-testid="btn-reserve-room"]');
    if ((await reserveRoomBtn.count()) > 0) {
      await reserveRoomBtn.click();
      await expect(page.locator('[data-testid="reservation-modal-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="reservation-modal-subtitle"]')).toContainText(
        'Chambre',
      );
    }
  });
});
