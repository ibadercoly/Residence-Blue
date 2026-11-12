import http from 'http';
import fs from 'fs';
import path from 'path';

const BROWSER_DIR = path.resolve('apps/web/dist/residence-blue-web/browser');
const PORT = Number(process.env.PORT || 4200);
const API_PORT = Number(process.env.API_PORT || 3000);

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

const fileCache = new Map();

const server = http.createServer((req, res) => {
  // Proxy vers l'API backend si la requête commence par /api ou /health
  if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
    const proxyReq = http.request({
      hostname: '127.0.0.1',
      port: API_PORT,
      path: req.url,
      method: req.method,
      agent: false,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${API_PORT}`,
        connection: 'close',
      },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    req.on('aborted', () => proxyReq.destroy());
    res.on('close', () => { if (!res.writableEnded) proxyReq.destroy(); });
    proxyReq.on('error', (err) => {
      if (req.aborted || res.writableEnded) return;
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `API indisponible sur 127.0.0.1:${API_PORT}`, details: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  const urlPath = req.url.split('?')[0];
  let filePath = path.join(BROWSER_DIR, urlPath === '/' ? 'index.html' : urlPath);

  const staticExt = path.extname(urlPath).toLowerCase();
  const isStaticAsset = Boolean(staticExt && staticExt !== '.html');

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (isStaticAsset) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    filePath = path.join(BROWSER_DIR, 'index.html');
  }

  const baseName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  const isEntryOrSw =
    ext === '.html' ||
    baseName === 'ngsw.json' ||
    baseName === 'ngsw-worker.js' ||
    baseName === 'safety-worker.js' ||
    baseName === 'manifest.webmanifest';

  try {
    let data = isEntryOrSw ? null : fileCache.get(filePath);
    if (!data) {
      data = fs.readFileSync(filePath);
      if (!isEntryOrSw) {
        fileCache.set(filePath, data);
      }
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': isEntryOrSw
        ? 'no-store, no-cache, must-revalidate'
        : 'public, max-age=31536000, immutable',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404);
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(`Serveur statique de production démarré sur http://localhost:${PORT}`);
});
