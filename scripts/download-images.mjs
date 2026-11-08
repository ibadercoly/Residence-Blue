import fs from 'fs';
import path from 'path';
import https from 'https';

const maquettesDir = path.resolve('design/maquettes');
const outDir = path.resolve('images/maquettes-originales');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function detectExtension(buffer, contentType) {
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'jpg';
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buffer.length >= 4 && buffer.toString('ascii', 0, 4) === '<svg') {
    return 'svg';
  }
  if (contentType?.includes('png')) return 'png';
  if (contentType?.includes('jpeg') || contentType?.includes('jpg')) return 'jpg';
  if (contentType?.includes('webp')) return 'webp';
  return 'bin';
}

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve);
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          contentType: res.headers['content-type'],
          data: Buffer.concat(chunks),
        });
      });
    }).on('error', (err) => {
      resolve({
        statusCode: 0,
        error: err.message,
        data: Buffer.alloc(0),
      });
    }).on('timeout', () => {
      resolve({
        statusCode: 408,
        error: 'Timeout',
        data: Buffer.alloc(0),
      });
    });
  });
}

async function run() {
  const folders = fs.readdirSync(maquettesDir).filter(f => {
    return fs.existsSync(path.join(maquettesDir, f, 'code.html'));
  });

  const results = [];

  for (const folder of folders) {
    const htmlPath = path.join(maquettesDir, folder, 'code.html');
    const content = fs.readFileSync(htmlPath, 'utf8');
    const regex = /https:\/\/lh3\.googleusercontent\.com\/[^\s"'')]+/g;
    const matches = [...content.matchAll(regex)].map(m => m[0]);
    const uniqueUrls = [...new Set(matches)];

    let index = 1;
    for (const url of uniqueUrls) {
      console.log(`Téléchargement [${folder}] #${index}: ${url.substring(0, 60)}...`);
      const res = await fetchUrl(url);
      const isSuccess = res.statusCode === 200 && res.data.length > 0;
      let filename = '';
      let format = 'Inconnu';
      let fileSize = 0;

      if (isSuccess) {
        const ext = detectExtension(res.data, res.contentType);
        format = ext.toUpperCase();
        fileSize = res.data.length;
        filename = `${folder}-${index}.${ext}`;
        const filePath = path.join(outDir, filename);
        fs.writeFileSync(filePath, res.data);
      }

      results.push({
        folder,
        index,
        url,
        statusCode: res.statusCode,
        isSuccess,
        filename,
        format,
        fileSize,
        error: res.error,
      });

      index++;
    }
  }

  // Écriture du rapport inventaire
  const lines = [
    '# Inventaire des Images Originales des Maquettes Google Stitch',
    '',
    `Date d'extraction : ${new Date().toISOString()}`,
    `Total d'URLs extraites : ${results.length}`,
    `Téléchargements réussis : ${results.filter(r => r.isSuccess).length}`,
    `Téléchargements échoués (liens expirés ou indisponibles) : ${results.filter(r => !r.isSuccess).length}`,
    '',
    '## Détail par écran et image',
    '',
    '| Écran | Réf | Fichier local | Statut HTTP | Format | Taille | URL originale |',
    '| :--- | :---: | :--- | :---: | :---: | :---: | :--- |',
  ];

  for (const r of results) {
    const statusLabel = r.isSuccess ? '✅ Téléchargé' : `❌ Échoué (${r.statusCode || r.error})`;
    const fileLabel = r.filename ? `\`images/maquettes-originales/${r.filename}\`` : '*Aucun*';
    const sizeLabel = r.fileSize ? `${(r.fileSize / 1024).toFixed(1)} ko` : '-';
    lines.push(`| \`${r.folder}\` | #${r.index} | ${fileLabel} | ${statusLabel} | ${r.format} | ${sizeLabel} | \`${r.url}\` |`);
  }

  lines.push('');
  lines.push('## Images ayant échoué (liens expirés à remplacer)');
  lines.push('');
  const failed = results.filter(r => !r.isSuccess);
  if (failed.length === 0) {
    lines.push('Toutes les images ont été téléchargées avec succès. Aucune image expirée.');
  } else {
    for (const f of failed) {
      lines.push(`- **Écran \`${f.folder}\` (#${f.index})** : Code HTTP \`${f.statusCode}\` — URL : \`${f.url}\``);
    }
  }

  const docPath = path.resolve('docs/design/INVENTAIRE-IMAGES.md');
  fs.writeFileSync(docPath, lines.join('\n'), 'utf8');
  console.log(`\nInventaire généré dans ${docPath}`);
  console.log(`Succès: ${results.filter(r => r.isSuccess).length}/${results.length}`);
}

run();
