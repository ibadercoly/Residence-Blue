import http from 'http';
import fs from 'fs';
import path from 'path';

const BROWSER_DIR = path.resolve('apps/web/dist/residence-blue-web/browser');
const PORT = 4200;

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
      hostname: 'localhost',
      port: 3000,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: 'localhost:3000',
      },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API indisponible sur localhost:3000', details: err.message }));
    });

    req.pipe(proxyReq);
    return;
  }

  const urlPath = req.url.split('?')[0];
  let filePath = path.join(BROWSER_DIR, urlPath === '/' ? 'index.html' : urlPath);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(BROWSER_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  try {
    let data = fileCache.get(filePath);
    if (!data) {
      data = fs.readFileSync(filePath);
      fileCache.set(filePath, data);
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
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
