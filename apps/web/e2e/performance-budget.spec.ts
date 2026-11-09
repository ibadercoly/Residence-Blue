import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

test.describe('Budgets de Performance V1 Minimale', () => {
  test('le bundle JavaScript initial compressé (gzip) est inférieur à 250 Ko', () => {
    const distBrowserDir = path.resolve(process.cwd(), 'apps/web/dist/residence-blue-web/browser');

    if (!fs.existsSync(distBrowserDir)) {
      test.skip(!fs.existsSync(distBrowserDir), 'Le dossier dist de production n\'a pas encore été généré.');
      return;
    }

    const files = fs.readdirSync(distBrowserDir);
    const initialJsFiles = files.filter(f =>
      (f.startsWith('main-') || f.startsWith('polyfills-') || f.startsWith('chunk-')) &&
      f.endsWith('.js') &&
      !f.includes('component')
    );

    let totalGzipBytes = 0;
    for (const f of initialJsFiles) {
      const buffer = fs.readFileSync(path.join(distBrowserDir, f));
      const gzipped = zlib.gzipSync(buffer);
      totalGzipBytes += gzipped.length;
    }

    const totalGzipKo = Math.round(totalGzipBytes / 1024);
    // Budget strict : < 250 Ko gzip
    expect(totalGzipKo).toBeLessThan(250);
  });

  test('chaque route chargée à la demande (lazy chunk) est inférieure à 120 Ko', () => {
    const distBrowserDir = path.resolve(process.cwd(), 'apps/web/dist/residence-blue-web/browser');
    if (!fs.existsSync(distBrowserDir)) {
      test.skip();
      return;
    }

    const files = fs.readdirSync(distBrowserDir);
    const lazyRouteFiles = files.filter(f => f.endsWith('.js') && f.includes('component'));

    for (const f of lazyRouteFiles) {
      const stats = fs.statSync(path.join(distBrowserDir, f));
      const rawKo = Math.round(stats.size / 1024);
      // Budget strict : chaque route chunk < 120 Ko
      expect(rawKo).toBeLessThan(120);
    }
  });

  test('le menu latéral ne dépasse pas 7 entrées par rôle', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navLinks = page.locator('app-sidebar nav a, app-sidebar [data-testid="sidebar-nav-item"]');
    const count = await navLinks.count();
    // Recommandation ergonomique directrice : maximum 7 entrées de menu
    expect(count).toBeLessThanOrEqual(7);
  });

  test('navigation fluide entre écrans : temps moyen de transition client inférieur à 300 ms', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navPaths = ['/planning', '/restaurant', '/facturation', '/exports', '/tableau-de-bord'];
    const transitionTimes: number[] = [];

    for (const p of navPaths) {
      const link = page.locator(`app-sidebar a[href="${p}"]`).first();
      if ((await link.count()) > 0) {
        const start = Date.now();
        await link.dispatchEvent('click');
        await page.waitForURL(`**${p}`);
        const duration = Date.now() - start;
        transitionTimes.push(duration);
      }
    }

    if (transitionTimes.length > 0) {
      const avgTransition = transitionTimes.reduce((a, b) => a + b, 0) / transitionTimes.length;
      // Transition client SPA fluide < 300 ms
      expect(avgTransition).toBeLessThan(300);
    }
  });

  test('endurance et fuites mémoire : JSHeapUsedSize reste sous 150 Mo après 20 transitions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const client = await page.context().newCDPSession(page);
    await client.send('Performance.enable');

    const navPaths = ['/planning', '/restaurant', '/facturation', '/exports', '/tableau-de-bord'];

    for (let i = 0; i < 4; i++) {
      for (const p of navPaths) {
        const link = page.locator(`app-sidebar a[href="${p}"]`).first();
        if ((await link.count()) > 0) {
          await link.click();
          await page.waitForTimeout(40);
        }
      }
    }

    try {
      await client.send('HeapProfiler.collectGarbage');
    } catch {}

    const perfMetrics = await client.send('Performance.getMetrics');
    const jsHeapMetric = perfMetrics.metrics.find(m => m.name === 'JSHeapUsedSize');
    const heapUsedBytes = jsHeapMetric ? jsHeapMetric.value : 0;
    const heapUsedMo = Math.round(heapUsedBytes / (1024 * 1024));

    // Budget strict : mémoire JS heap inférieure à 150 Mo
    expect(heapUsedMo).toBeLessThan(150);
  });
});
