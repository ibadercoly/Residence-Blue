import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const inputDir = path.resolve(rootDir, 'images/chambres');
const targetDirs = [
  path.resolve(rootDir, 'apps/web/public/assets/images/chambres'),
  path.resolve(rootDir, 'apps/web/src/assets/images/chambres')
];

const MAX_SIZE_BYTES = 250 * 1024; // Strictement < 250 Ko

async function encodeWebpAdaptive(srcPath, width) {
  let quality = 80;
  let buffer = await sharp(srcPath)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toBuffer();

  while (buffer.length >= MAX_SIZE_BYTES && quality > 40) {
    quality -= 5;
    buffer = await sharp(srcPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 6 })
      .toBuffer();
  }
  return buffer;
}

async function encodeJpgAdaptive(srcPath, width) {
  let quality = 80;
  let buffer = await sharp(srcPath)
    .resize({ width, withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  while (buffer.length >= MAX_SIZE_BYTES && quality > 40) {
    quality -= 5;
    buffer = await sharp(srcPath)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  return buffer;
}

export async function optimizeImages() {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`Dossier source introuvable : ${inputDir}`);
  }

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
  console.log(`=== Optimisation des images avec Sharp (${files.length} fichiers) ===`);

  for (const file of files) {
    const srcPath = path.join(inputDir, file);
    const baseName = path.basename(file, path.extname(file));

    console.log(`\nTraitement de ${file}...`);

    const buf400 = await encodeWebpAdaptive(srcPath, 400);
    const buf800 = await encodeWebpAdaptive(srcPath, 800);
    const buf1600 = await encodeWebpAdaptive(srcPath, 1600);
    const bufJpg = await encodeJpgAdaptive(srcPath, 1200);

    const variants = [
      { name: `${baseName}-400w.webp`, buffer: buf400 },
      { name: `${baseName}-800w.webp`, buffer: buf800 },
      { name: `${baseName}-1600w.webp`, buffer: buf1600 },
      { name: `${baseName}.webp`, buffer: buf800 },
      { name: `${baseName}.jpg`, buffer: bufJpg },
    ];

    for (const v of variants) {
      if (v.buffer.length >= MAX_SIZE_BYTES) {
        throw new Error(`Erreur : Le fichier ${v.name} dépasse le plafond (${(v.buffer.length / 1024).toFixed(1)} Ko >= 250 Ko)`);
      }

      for (const dir of targetDirs) {
        const dest = path.join(dir, v.name);
        fs.writeFileSync(dest, v.buffer);
      }
      console.log(`  ✓ ${v.name} -> ${(v.buffer.length / 1024).toFixed(1)} Ko`);
    }
  }

  // 5. Visuel de remplacement propre (fallback placeholder)
  console.log(`\nGénération du visuel de repli par défaut (chambre-fallback)...`);
  const firstImg = path.join(inputDir, files[0]);
  const fallbackWebp = await sharp(firstImg)
    .resize({ width: 800 })
    .blur(15)
    .modulate({ brightness: 0.8, saturation: 0.8 })
    .webp({ quality: 75 })
    .toBuffer();

  const fallbackJpg = await sharp(firstImg)
    .resize({ width: 800 })
    .blur(15)
    .modulate({ brightness: 0.8, saturation: 0.8 })
    .jpeg({ quality: 75 })
    .toBuffer();

  for (const dir of targetDirs) {
    fs.writeFileSync(path.join(dir, 'chambre-fallback.webp'), fallbackWebp);
    fs.writeFileSync(path.join(dir, 'chambre-fallback.jpg'), fallbackJpg);
  }
  console.log(`  ✓ chambre-fallback.webp -> ${(fallbackWebp.length / 1024).toFixed(1)} Ko`);
  console.log(`  ✓ chambre-fallback.jpg -> ${(fallbackJpg.length / 1024).toFixed(1)} Ko`);

  console.log(`\nSuccès : Toutes les images optimisées sont générées et validées (< 250 Ko).`);
}

if (process.argv[1] && process.argv[1].endsWith('optimiser-images.mjs')) {
  optimizeImages().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
}
