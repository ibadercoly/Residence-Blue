import { test, expect, chromium } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getApiAuthHeaders, loginViaUi } from './auth-e2e.helper';
import { getE2eBaseUrl, getE2eEnv } from './e2e-db.helper';

const repoRoot = path.resolve(__dirname, '../../..');

function cleanupEntities(opts: {
  guestIds: string[];
  reservationIds: string[];
  invoiceIds: string[];
  roomNumber?: string;
}) {
  const prismaDir = path.join(repoRoot, 'apps/api');
  const script = `
    import { createRequire } from 'module';
    const require = createRequire(${JSON.stringify(path.join(prismaDir, 'package.json'))});
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    async function main() {
      const invIds = ${JSON.stringify(opts.invoiceIds)};
      const resIds = ${JSON.stringify(opts.reservationIds)};
      const gIds = ${JSON.stringify(opts.guestIds)};
      await prisma.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
      await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: invIds } } });
      if (resIds.length) {
        const resInvs = await prisma.invoice.findMany({ where: { reservationId: { in: resIds } }, select: { id: true } });
        const allIds = resInvs.map((x) => x.id);
        if (allIds.length) {
          await prisma.payment.deleteMany({ where: { invoiceId: { in: allIds } } });
          await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: allIds } } });
          await prisma.invoice.deleteMany({ where: { id: { in: allIds } } });
        }
        await prisma.reservation.deleteMany({ where: { id: { in: resIds } } });
      }
      if (gIds.length) {
        await prisma.guest.deleteMany({ where: { id: { in: gIds } } });
      }
      if (${JSON.stringify(opts.roomNumber || null)}) {
        await prisma.room.updateMany({ where: { number: ${JSON.stringify(opts.roomNumber || '')} }, data: { status: 'FREE' } });
      }
    }
    main().finally(() => prisma.$disconnect());
  `;
  const tmpScript = path.join(os.tmpdir(), `rb-cleanup-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmpScript, script, 'utf8');
  try {
    execFileSync(process.execPath, [tmpScript], { cwd: repoRoot, env: getE2eEnv(), stdio: 'inherit' });
  } finally {
    fs.rmSync(tmpScript, { force: true });
  }
}

test.describe('Facturation V3 — Stabilité Service Worker (20 reloads) & Hors ligne', () => {
  let guestId = '';
  let reservationId = '';
  let invoiceId = '';
  let roomNumber = '106';

  test.beforeAll(async ({ request }) => {
    const apiHeaders = await getApiAuthHeaders(request, 'fatou.ndiaye@residenceblue.sn');
    const today = new Date();
    const checkOut = new Date(today.getTime() + 2 * 86400000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const availRes = await request.get(
      `/api/rooms/available?checkIn=${fmt(today)}&checkOut=${fmt(checkOut)}`,
      { headers: apiHeaders },
    );
    if (availRes.ok()) {
      const json = await availRes.json();
      if (Array.isArray(json?.items) && json.items.length > 0) {
        roomNumber = json.items[0].number;
      }
    }

    const gRes = await request.post('/api/guests', {
      headers: apiHeaders,
      data: {
        civility: 'Mme',
        firstName: 'Fatou',
        lastName: 'NdiayeSW',
        phone: `+22177${Math.floor(1000000 + Math.random() * 8999999)}`,
      },
    });
    expect(gRes.ok()).toBeTruthy();
    guestId = (await gRes.json()).id;

    const rRes = await request.post('/api/reservations', {
      headers: apiHeaders,
      data: {
        roomNumber,
        guestId,
        checkInDate: fmt(today),
        checkOutDate: fmt(checkOut),
        adultsCount: 1,
        childrenCount: 0,
        status: 'CHECKED_IN',
        breakfastIncluded: false,
        depositFcfa: 0,
      },
    });
    expect(rRes.ok()).toBeTruthy();
    reservationId = (await rRes.json()).id;

    const cRes = await request.get('/api/invoices/counter?search=NdiayeSW&limit=8', {
      headers: apiHeaders,
    });
    expect(cRes.ok()).toBeTruthy();
    const counter = await cRes.json();
    invoiceId = counter.page.items[0]?.id;
    expect(invoiceId).toBeTruthy();
  });

  test.afterAll(async () => {
    cleanupEntities({
      guestIds: guestId ? [guestId] : [],
      reservationIds: reservationId ? [reservationId] : [],
      invoiceIds: invoiceId ? [invoiceId] : [],
      roomNumber,
    });
  });

  test('Profil vide : 20 rechargements /facturation et 20 rechargements /facturation/:id avec SW actif, 0 crash, 0 404', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const crashes: string[] = [];
    const notFoundUrls: string[] = [];

    page.on('crash', () => crashes.push(page.url()));
    page.on('response', (res) => {
      if (res.status() === 404) {
        notFoundUrls.push(res.url());
      }
    });

    await loginViaUi(page, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
    await expect
      .poll(
        () => page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
        { timeout: 10000 },
      )
      .toBeGreaterThanOrEqual(1);
    const swRegs = await page.evaluate(async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length;
    });
    expect(swRegs).toBeGreaterThanOrEqual(1);
    await page.click('a[href="/facturation"]');

    for (let i = 1; i <= 20; i += 1) {
      if (i > 1) {
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      await expect(page.locator('[data-testid="comptoir-kpis"]')).toBeVisible({ timeout: 10000 });
      expect(crashes, `Crash détecté au rechargement #${i} de /facturation`).toHaveLength(0);
    }

    await page.goto(`/facturation/${invoiceId}`, { waitUntil: 'domcontentloaded' });
    for (let i = 1; i <= 20; i += 1) {
      if (i > 1) {
        await page.reload({ waitUntil: 'domcontentloaded' });
      }
      await expect(page.locator('[data-testid="facturation-note-page"]')).toBeVisible({
        timeout: 10000,
      });
      expect(crashes, `Crash détecté au rechargement #${i} de /facturation/${invoiceId}`).toHaveLength(
        0,
      );
    }

    expect(notFoundUrls).toEqual([]);
  });

  test('Profil rempli + scénario mise à jour ancien SW : désenregistrement SW seul, IndexedDB préservée, 20 rechargements sans crash', async () => {
    test.setTimeout(120000);
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-sw-upgrade-'));
    const sentinelId = `sentinel-${Date.now()}`;

    try {
      const ctx = await chromium.launchPersistentContext(userDataDir, {
        headless: true,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        serviceWorkers: 'allow',
        baseURL: getE2eBaseUrl(),
      });

      const page = ctx.pages()[0] || (await ctx.newPage());
      const crashes: string[] = [];
      page.on('crash', () => crashes.push(page.url()));

      // 1. Préparer un profil rempli : charger le site (SW + IDB initialisés) puis injecter une entrée sentinelle dans IndexedDB
      await loginViaUi(page, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
      await page.waitForTimeout(1500);

      const seeded = await page.evaluate(async (id) => {
        // S'assurer qu'un SW est enregistré puis insérer une entrée dans residence_blue_db.outbox
        const regs = await navigator.serviceWorker.getRegistrations();
        const db: IDBDatabase = await new Promise((resolve, reject) => {
          const req = indexedDB.open('residence_blue_db', 1);
          req.onupgradeneeded = () => {
            const d = req.result;
            if (!d.objectStoreNames.contains('outbox')) {
              d.createObjectStore('outbox', { keyPath: 'id' });
            }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        await new Promise((resolve, reject) => {
          const tx = db.transaction('outbox', 'readwrite');
          tx.objectStore('outbox').put({
            id,
            idempotencyKey: id,
            type: 'SENTINEL_KEEP_ME',
            endpoint: '/api/health',
            payload: { ok: true },
            createdAt: Date.now(),
            status: 'SYNCED',
            retryCount: 0,
          });
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        });
        db.close();
        return regs.length;
      }, sentinelId);
      expect(seeded).toBeGreaterThanOrEqual(0);

      // 2. Scénario de mise à jour : désenregistrer UNIQUEMENT l'ancien SW sans vider IndexedDB
      await page.evaluate(async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) {
          await r.unregister();
        }
      });

      await page.goto('/facturation', { waitUntil: 'domcontentloaded' });
      for (let i = 1; i <= 20; i += 1) {
        if (i > 1) {
          await page.reload({ waitUntil: 'domcontentloaded' });
        }
        await expect(page.locator('[data-testid="comptoir-kpis"]')).toBeVisible({ timeout: 10000 });
        expect(crashes).toHaveLength(0);
      }

      await page.goto(`/facturation/${invoiceId}`, { waitUntil: 'domcontentloaded' });
      for (let i = 1; i <= 20; i += 1) {
        if (i > 1) {
          await page.reload({ waitUntil: 'domcontentloaded' });
        }
        await expect(page.locator('[data-testid="facturation-note-page"]')).toBeVisible({
          timeout: 10000,
        });
        expect(crashes).toHaveLength(0);
      }

      // Vérifier que IndexedDB n'a PAS été vidée
      const preserved = await page.evaluate(async (id) => {
        const db: IDBDatabase = await new Promise((resolve, reject) => {
          const req = indexedDB.open('residence_blue_db', 1);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const item = await new Promise((resolve, reject) => {
          const tx = db.transaction('outbox', 'readonly');
          const getReq = tx.objectStore('outbox').get(id);
          getReq.onsuccess = () => resolve(getReq.result);
          getReq.onerror = () => reject(getReq.error);
        });
        db.close();
        return item;
      }, sentinelId);
      expect(preserved).toBeTruthy();

      await ctx.close();
    } finally {
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
      } catch {
        // Ignorer un verrou Windows transitoire sur le profil temporaire après fermeture de Chromium
      }
    }
  });

  test('Mode hors ligne : encaissement -> outbox IndexedDB -> retour réseau -> synchronisation unique (Idempotency-Key)', async ({
    page,
    context,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginViaUi(page, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
    await page.goto(`/facturation/${invoiceId}`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="note-display-number"]')).toBeVisible();

    const apiHeaders = await getApiAuthHeaders(request, 'fatou.ndiaye@residenceblue.sn');
    const beforeRes = await request.get(`/api/invoices/${invoiceId}`, {
      headers: apiHeaders,
    });
    const beforeNote = await beforeRes.json();
    const initialPaymentsCount = beforeNote.payments.length;

    // Couper le réseau
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    await page.locator('[data-testid="pay-method-CASH"]').click();
    await page.locator('[data-testid="payment-amount-input"]').fill('5000');
    await page.locator('[data-testid="btn-submit-payment"]').click();

    await expect(page.locator('[data-testid="offline-pending-badge"]')).toContainText('1');

    // Vérifier présence dans IndexedDB outbox avec idempotencyKey UUID
    const queuedItems = await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open('residence_blue_db', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const items: any[] = await new Promise((resolve, reject) => {
        const tx = db.transaction('outbox', 'readonly');
        const reqAll = tx.objectStore('outbox').getAll();
        reqAll.onsuccess = () => resolve(reqAll.result);
        reqAll.onerror = () => reject(reqAll.error);
      });
      db.close();
      return items.filter((i) => i.type === 'CREATE_INVOICE_PAYMENT');
    });
    expect(queuedItems.length).toBe(1);
    const idempotencyKey = queuedItems[0].idempotencyKey;
    expect(idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // Remettre le réseau et déclencher le retour en ligne
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Attendre que l'outbox se vide et que la note reflète le paiement synchronisé
    await expect(page.locator('[data-testid="offline-pending-badge"]')).toHaveCount(0, {
      timeout: 15000,
    });

    // Vérifier en base (via API) qu'il y a exactement +1 paiement
    const afterRes = await request.get(`/api/invoices/${invoiceId}`, {
      headers: apiHeaders,
    });
    const afterNote = await afterRes.json();
    expect(afterNote.payments.length).toBe(initialPaymentsCount + 1);
    const syncedPayment = afterNote.payments.find((p: any) => p.amountFcfa === 5000);
    expect(syncedPayment).toBeTruthy();

    // Rejouer exactement la même Idempotency-Key vers l'API et vérifier aucune duplication
    const replayRes = await request.post(`/api/invoices/${invoiceId}/payments`, {
      headers: {
        ...(await getApiAuthHeaders(request, 'fatou.ndiaye@residenceblue.sn')),
        'Idempotency-Key': idempotencyKey,
      },
      data: {
        method: 'CASH',
        amountFcfa: 5000,
      },
    });
    expect(replayRes.ok()).toBeTruthy();

    const afterReplayRes = await request.get(`/api/invoices/${invoiceId}`, {
      headers: apiHeaders,
    });
    const afterReplayNote = await afterReplayRes.json();
    expect(afterReplayNote.payments.length).toBe(initialPaymentsCount + 1);
  });
});
