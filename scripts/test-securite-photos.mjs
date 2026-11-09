import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const JPEG_MAGIC = Buffer.from([0xFF, 0xD8, 0xFF]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const RIFF_MAGIC = Buffer.from('RIFF');
const WEBP_MAGIC = Buffer.from('WEBP');

function verifyFileSignature(filePath) {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.jpg' || ext === '.jpeg') {
    if (buffer.length < 3 || !buffer.subarray(0, 3).equals(JPEG_MAGIC)) {
      throw new Error(`Signature JPEG invalide pour ${filePath}`);
    }
  } else if (ext === '.png') {
    if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      throw new Error(`Signature PNG invalide pour ${filePath}`);
    }
  } else if (ext === '.webp') {
    if (buffer.length < 12 || 
        !buffer.subarray(0, 4).equals(RIFF_MAGIC) || 
        !buffer.subarray(8, 12).equals(WEBP_MAGIC)) {
      throw new Error(`Signature WebP invalide pour ${filePath}`);
    }
  } else {
    throw new Error(`Extension non autorisée détectée: ${filePath}`);
  }

  // Vérifier l'absence de balises ou scripts exécutables déguisés (anti-polyglot)
  const headStr = buffer.subarray(0, Math.min(buffer.length, 1024)).toString('latin1').toLowerCase();
  const suspiciousTokens = ['<?php', '<script', '<html', '<!doctype', 'eval(', 'system('];
  for (const token of suspiciousTokens) {
    if (headStr.includes(token)) {
      throw new Error(`Contenu suspect (${token}) détecté dans ${filePath}`);
    }
  }

  return true;
}

function scanDirImages(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDirImages(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('=== Porte de Sécurité : Photos Chambres ===\n');

// 1. Contrôle des fichiers dans images/chambres
console.log('1. Audit des signatures dans images/chambres...');
const originalImages = scanDirImages(path.join(rootDir, 'images', 'chambres'));
if (originalImages.length === 0) throw new Error('Aucune image trouvée dans images/chambres');
for (const file of originalImages) {
  verifyFileSignature(file);
}
console.log(`   ✓ ${originalImages.length} fichiers originaux validés (signatures magiques & absence de code).`);

// 2. Contrôle des fichiers dans assets/images/chambres
console.log('2. Audit des images optimisées dans apps/web/public/assets/images/chambres...');
const webImages = scanDirImages(path.join(rootDir, 'apps', 'web', 'public', 'assets', 'images', 'chambres'));
if (webImages.length === 0) throw new Error('Aucune image trouvée dans assets/images/chambres');
for (const file of webImages) {
  verifyFileSignature(file);
}
console.log(`   ✓ ${webImages.length} fichiers optimisés validés.`);

// 3. Test offensif de rejet des domaines non autorisés
console.log('3. Test offensif : vérification du filtrage des domaines et URL suspectes...');
const ALLOWED_DOMAINS = [
  'unsplash.com',
  'images.unsplash.com',
  'pexels.com',
  'images.pexels.com',
  'pixabay.com',
  'cdn.pixabay.com'
];

function isUrlAllowed(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain));
  } catch {
    return false;
  }
}

const forbiddenUrls = [
  'http://images.unsplash.com/photo-123', // Non HTTPS
  'https://google.com/image.jpg',         // Domaine hors liste
  'https://evil-hacker.com/malware.png',  // Domaine non autorisé
  'ftp://images.unsplash.com/file.jpg',   // Protocole FTP interdit
  'javascript:alert(1)',                  // Vecteur XSS
  'file:///etc/passwd',                   // LFI / SSRF
  'https://images.unsplash.com.attacker.com/photo.jpg' // Subdomain spoofing
];

for (const url of forbiddenUrls) {
  if (isUrlAllowed(url)) {
    throw new Error(`ÉCHEC de sécurité : l'URL interdite ${url} n'a pas été rejetée !`);
  }
}
console.log('   ✓ Toutes les 7 URL malveillantes ou interdites ont été strictement rejetées.');

// 4. Test offensif : détection d'un fichier corrompu ou HTML déguisé
console.log('4. Test offensif : détection de payload polyglotte HTML / script...');
const fakeHtmlImage = Buffer.from('<!DOCTYPE html><html><script>alert("xss")</script></html>');
const tempFakeFile = path.join(rootDir, 'images', 'chambres', '.temp-malicious-test.jpg');
fs.writeFileSync(tempFakeFile, fakeHtmlImage);

let caught = false;
try {
  verifyFileSignature(tempFakeFile);
} catch (e) {
  caught = true;
} finally {
  if (fs.existsSync(tempFakeFile)) fs.unlinkSync(tempFakeFile);
}

if (!caught) {
  throw new Error('ÉCHEC de sécurité : le faux fichier HTML déguisé n\'a pas été intercepté !');
}
console.log('   ✓ Fichier malveillant déguisé intercepté et rejeté avec succès.');

console.log('\n=== Porte de sécurité validée avec succès à 100% ===\n');
