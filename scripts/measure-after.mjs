import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { chromium } from '@playwright/test';

const BROWSER_DIR = path.resolve('apps/web/dist/residence-blue-web/browser');

console.log('=== ANALYSE DES MESURES APRÈS OPTIMISATIONS (V1 MINIMALE) ===');

function getCompressedSizes(filePath) {
  const content = fs.readFileSync(filePath);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content, { level: 9 }).length;
  const brotliSize = zlib.brotliCompressSync(content).length;
  return { rawSize, gzipSize, brotliSize };
}

const distFiles = fs.readdirSync(BROWSER_DIR);
const mainJs = distFiles.find(f => f.startsWith('main-') && f.endsWith('.js'));
const polyfillsJs = distFiles.find(f => f.startsWith('polyfills-') && f.endsWith('.js'));
const stylesCss = distFiles.find(f => f.startsWith('styles-') && f.endsWith('.css'));

const staticMetrics = {
  mainJs: mainJs ? { name: mainJs, ...getCompressedSizes(path.join(BROWSER_DIR, mainJs)) } : null,
  polyfillsJs: polyfillsJs ? { name: polyfillsJs, ...getCompressedSizes(path.join(BROWSER_DIR, polyfillsJs)) } : null,
  stylesCss: stylesCss ? { name: stylesCss, ...getCompressedSizes(path.join(BROWSER_DIR, stylesCss)) } : null,
};

console.log('Main JS:', staticMetrics.mainJs);
console.log('Polyfills JS:', staticMetrics.polyfillsJs);
console.log('Styles CSS:', staticMetrics.stylesCss);

// Chunks lazy
const lazyChunks = distFiles.filter(f => f.endsWith('.js') && f.includes('component')).map(f => {
  const sizes = getCompressedSizes(path.join(BROWSER_DIR, f));
  return {
    name: f,
    rawKo: (sizes.rawSize / 1024).toFixed(2),
    gzipKo: (sizes.gzipSize / 1024).toFixed(2),
  };
});
console.log('Lazy Chunks:', lazyChunks);

const totalInitialJsGzip = (staticMetrics.mainJs?.gzipSize || 0) + (staticMetrics.polyfillsJs?.gzipSize || 0);
const totalInitialJsRaw = (staticMetrics.mainJs?.rawSize || 0) + (staticMetrics.polyfillsJs?.rawSize || 0);
console.log(`Total Initial JS (raw): ${(totalInitialJsRaw / 1024).toFixed(2)} Ko`);
console.log(`Total Initial JS (gzip): ${(totalInitialJsGzip / 1024).toFixed(2)} Ko`);

// Serveur HTTP local pour servir les assets de production dist
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(BROWSER_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(BROWSER_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end();
  }
});

const PORT = 8090;
server.listen(PORT, async () => {
  console.log(`Serveur statique de production démarré sur http://localhost:${PORT}`);

  try {
    const browser = await chromium.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    const client = await context.newCDPSession(page);
    await client.send('Performance.enable');

    const networkRequests = [];
    page.on('response', async (res) => {
      try {
        const req = res.request();
        const headers = res.headers();
        const contentLength = headers['content-length'] ? parseInt(headers['content-length'], 10) : 0;
        networkRequests.push({
          url: req.url(),
          status: res.status(),
          type: req.resourceType(),
          size: contentLength,
        });
      } catch {}
    });

    // Mesure 1 : Chargement standard
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle' });
    const loadTimeNormalMs = Date.now() - t0;
    console.log(`Temps de chargement Accueil (standard) : ${loadTimeNormalMs} ms`);

    const metricsInitial = await client.send('Performance.getMetrics');
    function getMetric(name, metrics) {
      const m = metrics.find(x => x.name === name);
      return m ? m.value : 0;
    }

    const heapUsedInitialMb = (getMetric('JSHeapUsedSize', metricsInitial.metrics) / 1024 / 1024).toFixed(2);
    const heapTotalInitialMb = (getMetric('JSHeapTotalSize', metricsInitial.metrics) / 1024 / 1024).toFixed(2);
    console.log(`Mémoire JS Heap initiale : ${heapUsedInitialMb} Mo / ${heapTotalInitialMb} Mo`);

    // Mesure 2 : Simulation CPU ralenti 4x
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const t1 = Date.now();
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
    const loadTimeCpu4xMs = Date.now() - t1;
    console.log(`Temps de premier affichage Accueil (CPU 4x ralenti) : ${loadTimeCpu4xMs} ms`);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    // Mesure 3 : Navigation entre écrans V1
    const routesToTest = ['/planning', '/restaurant', '/facturation', '/exports', '/'];
    const navMetrics = [];

    for (const route of routesToTest) {
      const start = Date.now();
      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
      const duration = Date.now() - start;
      navMetrics.push({ route, durationMs: duration });
    }
    console.log('Temps de navigation entre écrans V1 :', navMetrics);

    // Mesure 4 : Soak test mémoire (30 navigations)
    for (let i = 0; i < 6; i++) {
      for (const target of ['/planning', '/restaurant', '/facturation', '/exports', '/']) {
        await page.goto(`http://localhost:${PORT}${target}`, { waitUntil: 'domcontentloaded' });
      }
    }

    try {
      await client.send('HeapProfiler.collectGarbage');
    } catch {}

    const metricsAfterSoak = await client.send('Performance.getMetrics');
    const heapUsedAfterSoakMb = (getMetric('JSHeapUsedSize', metricsAfterSoak.metrics) / 1024 / 1024).toFixed(2);
    const nodesCount = getMetric('Nodes', metricsAfterSoak.metrics);
    const jsEventListeners = getMetric('JSEventListeners', metricsAfterSoak.metrics);

    console.log(`Mémoire JS Heap après navigations : ${heapUsedAfterSoakMb} Mo`);
    console.log(`DOM Nodes: ${nodesCount}, Event Listeners: ${jsEventListeners}`);

    const report = {
      staticMetrics,
      lazyChunks,
      totalInitialJsRawKo: (totalInitialJsRaw / 1024).toFixed(2),
      totalInitialJsGzipKo: (totalInitialJsGzip / 1024).toFixed(2),
      loadTimeNormalMs,
      loadTimeCpu4xMs,
      navMetrics,
      heapUsedInitialMb,
      heapTotalInitialMb,
      heapUsedAfterSoakMb,
      nodesCount,
      jsEventListeners,
    };

    fs.writeFileSync('docs/performance/MESURES-APRES.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('MESURES-APRES.json sauvegardé avec succès !');

    await browser.close();
  } catch (err) {
    console.error('Erreur durant les mesures:', err);
  } finally {
    server.close();
  }
});
