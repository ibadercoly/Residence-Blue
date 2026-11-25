import { test, expect } from '@playwright/test';
import { loginViaUi } from './auth-e2e.helper';

test.describe('Planning - Fonctionnement Hors Ligne (Audit LOG-005)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, 'fatou.ndiaye@residenceblue.sn', 'ThiesTeranga2024!');
    await page.goto('/planning');
    await page.waitForLoadState('networkidle');
  });

  test('Coupure réseau -> bandeau hors ligne -> check-in outbox (Idempotency-Key) -> retour réseau -> synchro sans doublon', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const offlineBanner = page.locator('[data-testid="planning-offline-banner"]');

    // 1. Initialement en ligne : aucun bandeau hors ligne
    await expect(offlineBanner).toHaveCount(0);

    // 2. Coupure réseau
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });

    // 3. Le bandeau hors ligne apparaît avec le message exact
    await expect(offlineBanner).toBeVisible();
    await expect(offlineBanner).toContainText(
      'Vous êtes hors ligne. Les modifications seront envoyées dès le retour du réseau.',
    );

    // 4. Clic sur une réservation existante pour ouvrir le tiroir
    const resBar = page.locator('[data-testid^="res-bar-"]').first();
    await expect(resBar).toBeVisible();
    await resBar.click();

    const drawer = page.locator('[data-testid="planning-detail-drawer"]');
    await expect(drawer).toBeVisible();

    // 5. Exécution de l'action rapide (Check-in ou Check-out)
    const actionBtn = page.locator('[data-testid="drawer-btn-checkin-checkout"]');
    await expect(actionBtn).toBeVisible();
    await actionBtn.click();

    // 6. Optimistic UI : feedback avec mention hors ligne
    const feedback = page.locator('[data-testid="planning-feedback-message"]');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText('hors ligne');

    // 7. Vérification de la présence dans l'Outbox IndexedDB avec Idempotency-Key UUID
    const outboxItems = await page.evaluate(async () => {
      const db: IDBDatabase = await new Promise((resolve, reject) => {
        const req = indexedDB.open('residence_blue_db', 2);
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
      return items.filter((i) => i.type.startsWith('RESERVATION_'));
    });

    expect(outboxItems.length).toBeGreaterThanOrEqual(1);
    const queuedAction = outboxItems[outboxItems.length - 1];
    expect(queuedAction.idempotencyKey).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    // 8. Rétablissement du réseau
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // 9. Le bandeau hors ligne disparaît
    await expect(offlineBanner).toHaveCount(0);

    // 10. L'outbox se vide automatiquement après synchronisation avec le serveur
    await expect.poll(async () => {
      return await page.evaluate(async (queuedId: string) => {
        const db: IDBDatabase = await new Promise((resolve, reject) => {
          const req = indexedDB.open('residence_blue_db', 2);
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
        return items.filter((i) => i.id === queuedId).length;
      }, queuedAction.id);
    }, { timeout: 15000 }).toBe(0);
  });
});
