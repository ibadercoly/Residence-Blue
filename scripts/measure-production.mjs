import http from 'http';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { chromium } from '@playwright/test';

const BROWSER_DIR = path.resolve('apps/web/dist/residence-blue-web/browser');

// 1. Measure Static File Sizes & Compression
console.log('=== ANALYSE DES FICHIERS STATIQUES (DIST PRODUCTION) ===');

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

// Total initial JS compressed
const totalInitialJsGzip = (staticMetrics.mainJs?.gzipSize || 0) + (staticMetrics.polyfillsJs?.gzipSize || 0);
const totalInitialJsRaw = (staticMetrics.mainJs?.rawSize || 0) + (staticMetrics.polyfillsJs?.rawSize || 0);
console.log(`Total Initial JS (raw): ${(totalInitialJsRaw / 1024).toFixed(2)} Ko`);
console.log(`Total Initial JS (gzip): ${(totalInitialJsGzip / 1024).toFixed(2)} Ko`);

// Analyze media / fonts
const mediaDir = path.join(BROWSER_DIR, 'media');
const fontFiles = fs.existsSync(mediaDir) ? fs.readdirSync(mediaDir) : [];
const fontMetrics = fontFiles.map(f => {
  const full = path.join(mediaDir, f);
  const stats = fs.statSync(full);
  return { name: f, sizeKo: (stats.size / 1024).toFixed(2), sizeBytes: stats.size };
}).sort((a, b) => b.sizeBytes - a.sizeBytes);

console.log('Top fonts:', fontMetrics.slice(0, 5));

// Analyze assets images
function scanImages(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) scanImages(full, results);
    else if (/\.(jpg|jpeg|png|webp|svg)$/i.test(e.name)) {
      results.push({
        path: path.relative(BROWSER_DIR, full).replace(/\\/g, '/'),
        sizeKo: (fs.statSync(full).size / 1024).toFixed(2),
        sizeBytes: fs.statSync(full).size
      });
    }
  }
  return results;
}
const images = scanImages(path.join(BROWSER_DIR, 'assets/images')).sort((a, b) => b.sizeBytes - a.sizeBytes);
console.log('Top images:', images.slice(0, 8));

// 2. Start HTTP Server for Production Distribution
const PORT = 8089;
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || !path.extname(reqPath)) {
    reqPath = '/index.html';
  }
  const filePath = path.join(BROWSER_DIR, reqPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.json': 'application/json'
  };

  const contentType = mimeMap[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);

  // Compress with gzip if supported
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (/\bgzip\b/.test(acceptEncoding) && (ext === '.js' || ext === '.css' || ext === '.html' || ext === '.json')) {
    const gzipped = zlib.gzipSync(content);
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Encoding': 'gzip',
      'Content-Length': gzipped.length,
      'Cache-Control': 'no-cache'
    });
    res.end(gzipped);
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': content.length,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  }
});

server.listen(PORT, async () => {
  console.log(`Serveur de test dist démarré sur http://localhost:${PORT}`);

  try {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const browser = await chromium.launch({
      executablePath: fs.existsSync(chromePath) ? chromePath : undefined,
      headless: true,
      args: ['--disable-lcd-text', '--disable-gpu']
    });

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });

    const page = await context.newPage();
    const client = await context.newCDPSession(page);
    await client.send('Performance.enable');

    // Add session in localStorage
    await page.addInitScript(() => {
      const session = {
        user: {
          id: 'usr-001-ba',
          email: 'aissatou.ba@residenceblue.sn',
          fullName: 'Aïssatou Ba',
          role: 'DIRECTION',
          jobTitle: "Directrice d'Exploitation"
        },
        token: 'test-token',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        stayConnected8h: true,
        lastActivityAt: Date.now(),
        isLocked: false
      };
      localStorage.setItem('residence_blue_auth_session', JSON.stringify(session));
      localStorage.setItem('auth_token', 'test-token');
    });

    // Track requests
    const networkRequests = [];
    page.on('response', async res => {
      networkRequests.push({
        url: res.url(),
        status: res.status(),
        size: (await res.body().catch(() => Buffer.alloc(0))).length,
        type: res.request().resourceType()
      });
    });

    console.log('Mesure 1 : Chargement initial page d\'accueil (sans throttle)...');
    const t0 = Date.now();
    await page.goto(`http://localhost:${PORT}/tableau-de-bord`, { waitUntil: 'networkidle' });
    const loadTimeNormalMs = Date.now() - t0;

    const navTiming = await page.evaluate(() => {
      const [nav] = performance.getEntriesByType('navigation');
      const paint = performance.getEntriesByType('paint');
      const fcp = paint.find(p => p.name === 'first-contentful-paint');
      return {
        domInteractive: Math.round(nav?.domInteractive || 0),
        domComplete: Math.round(nav?.domComplete || 0),
        loadEventEnd: Math.round(nav?.loadEventEnd || 0),
        fcp: Math.round(fcp?.startTime || 0)
      };
    });

    console.log('Navigation Timing (normal):', navTiming, `Total: ${loadTimeNormalMs}ms`);

    // Mesure avec CPU 4x Throttling (PC modeste)
    console.log('Mesure 2 : Chargement initial avec CPU 4x Throttling (PC modeste)...');
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const tCpu0 = Date.now();
    await page.goto(`http://localhost:${PORT}/tableau-de-bord`, { waitUntil: 'networkidle' });
    const loadTimeCpu4xMs = Date.now() - tCpu0;
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 }); // reset

    console.log(`Temps de chargement initial CPU 4x : ${loadTimeCpu4xMs}ms`);

    // Metrics CDP après chargement
    const metrics1 = await client.send('Performance.getMetrics');
    const getMetric = (name, metrics) => metrics.find(m => m.name === name)?.value || 0;

    const heapUsedInitialMb = (getMetric('JSHeapUsedSize', metrics1.metrics) / 1024 / 1024).toFixed(2);
    const heapTotalInitialMb = (getMetric('JSHeapTotalSize', metrics1.metrics) / 1024 / 1024).toFixed(2);

    console.log(`Mémoire JS Heap Initiale : ${heapUsedInitialMb} Mo (Total: ${heapTotalInitialMb} Mo)`);

    // Mesure des temps de transition entre écrans
    console.log('Mesure 3 : Navigation entre écrans...');
    const routesToTest = ['/planning', '/chambres', '/clients/c1', '/facturation', '/restaurant', '/tableau-de-bord'];
    const navMetrics = [];

    for (const r of routesToTest) {
      const start = Date.now();
      await page.goto(`http://localhost:${PORT}${r}`, { waitUntil: 'domcontentloaded' });
      const elapsed = Date.now() - start;
      navMetrics.push({ route: r, elapsedMs: elapsed });
    }
    console.log('Temps de navigation entre écrans:', navMetrics);

    // Soak test de navigation (50 transitions pour observer la mémoire)
    console.log('Mesure 4 : Test de fuite mémoire (50 transitions répétées)...');
    for (let i = 0; i < 50; i++) {
      const target = routesToTest[i % routesToTest.length];
      await page.goto(`http://localhost:${PORT}${target}`, { waitUntil: 'domcontentloaded' });
    }

    const metricsAfterSoak = await client.send('Performance.getMetrics');
    const heapUsedAfterSoakMb = (getMetric('JSHeapUsedSize', metricsAfterSoak.metrics) / 1024 / 1024).toFixed(2);
    const nodesCount = getMetric('Nodes', metricsAfterSoak.metrics);
    const jsEventListeners = getMetric('JSEventListeners', metricsAfterSoak.metrics);

    console.log(`Mémoire JS Heap après 50 navigations : ${heapUsedAfterSoakMb} Mo`);
    console.log(`DOM Nodes: ${nodesCount}, Event Listeners: ${jsEventListeners}`);

    // Request breakdown
    const reqSummary = {};
    for (const r of networkRequests) {
      reqSummary[r.type] = reqSummary[r.type] || { count: 0, totalBytes: 0 };
      reqSummary[r.type].count++;
      reqSummary[r.type].totalBytes += r.size;
    }
    console.log('Network Requests Summary:', reqSummary);

    const report = {
      staticMetrics,
      totalInitialJsRawKo: (totalInitialJsRaw / 1024).toFixed(2),
      totalInitialJsGzipKo: (totalInitialJsGzip / 1024).toFixed(2),
      fontMetrics: fontMetrics.slice(0, 10),
      images: images.slice(0, 15),
      loadTimeNormalMs,
      loadTimeCpu4xMs,
      navTiming,
      navMetrics,
      heapUsedInitialMb,
      heapTotalInitialMb,
      heapUsedAfterSoakMb,
      nodesCount,
      jsEventListeners,
      reqSummary
    };

    fs.writeFileSync('docs/performance/MESURES-AVANT.json', JSON.stringify(report, null, 2), 'utf8');
    console.log('MESURES-AVANT.json sauvegardé avec succès !');

    await browser.close();
  } catch (err) {
    console.error('Erreur durant les mesures:', err);
  } finally {
    server.close();
  }
});
