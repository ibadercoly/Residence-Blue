import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const ALLOWED_DOMAINS = [
  'unsplash.com',
  'images.unsplash.com',
  'pexels.com',
  'images.pexels.com',
  'pixabay.com',
  'cdn.pixabay.com'
];

const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8 Mo max

export const PHOTOS_CONFIG = [
  {
    roomNumber: '101',
    category: 'standard',
    filename: 'chambre-101-standard.jpg',
    author: 'Vojtech Bruzek',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/linge-de-lit-blanc-avec-coussins-decoratifs-Yrxr3bsPdS0',
    downloadUrl: 'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 101, Standard, lit double sobre et tons chauds'
  },
  {
    roomNumber: '102',
    category: 'standard',
    filename: 'chambre-102-standard.jpg',
    author: 'Marcel Strauß',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/chambre-moderne-avec-des-accents-en-bois-et-lumiere-naturelle-CMHgRFDANH8',
    downloadUrl: 'https://images.unsplash.com/photo-1765547090903-348b711f0eee?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 102, Standard, espace bureau et parquet en bois clair'
  },
  {
    roomNumber: '103',
    category: 'standard',
    filename: 'chambre-103-standard.jpg',
    author: 'visualsofdana',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/chambre-dhotel-avec-lit-en-bois-T5pL6ciEn-I',
    downloadUrl: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 103, Standard, lit en bois et vue sur patio intérieur'
  },
  {
    roomNumber: '104',
    category: 'standard',
    filename: 'chambre-104-standard.jpg',
    author: 'João Emanuel',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/chambre-moderne-avec-un-grand-parterre-et-vue-sur-le-jardin-0ppqZpWTkXE',
    downloadUrl: 'https://images.unsplash.com/photo-1781572725438-ac8c41476752?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 104, Standard, balcon privatif et jardin arboré'
  },
  {
    roomNumber: '105',
    category: 'standard',
    filename: 'chambre-105-standard.jpg',
    author: 'Hiram Huang',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/la-lumiere-du-soleil-traverse-les-rideaux-transparents-dune-chambre-dhotel-NIbUk7ATSuw',
    downloadUrl: 'https://images.unsplash.com/photo-1759328257280-28bdb3050be3?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 105, Standard, chambre ensoleillée avec vue sur la piscine'
  },
  {
    roomNumber: '106',
    category: 'standard',
    filename: 'chambre-106-standard.jpg',
    author: 'Point3D Commercial Imaging Ltd.',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/linge-de-lit-blanc-sur-le-lit-oxeCZrodz78',
    downloadUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 106, Standard, literie blanche épurée et douche à l’italienne'
  },
  {
    roomNumber: '201',
    category: 'deluxe',
    filename: 'chambre-201-deluxe.jpg',
    author: 'mark champs',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/chambre-moderne-avec-tete-de-lit-bleue-Id2IIl1jOB0',
    downloadUrl: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 201, Deluxe, lit King et tête de lit bleu nuit boutique'
  },
  {
    roomNumber: '202',
    category: 'deluxe',
    filename: 'chambre-202-deluxe.jpg',
    author: 'Nusrat Ali',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/chambre-moderne-avec-grand-lit-et-mur-daccent-en-marbre-9QhyuOeu3Ik',
    downloadUrl: 'https://images.unsplash.com/photo-1778205015308-1ed324aea202?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 202, Deluxe, grande baie vitrée et coin détente'
  },
  {
    roomNumber: '203',
    category: 'bungalow-deluxe',
    filename: 'chambre-203-bungalow-deluxe.jpg',
    author: 'sidath vimukthi',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/lit-a-baldaquin-dans-une-chambre-dhotel-baignee-de-soleil-9fU-cSvjWYA',
    downloadUrl: 'https://images.unsplash.com/photo-1791535767080-42f5c51e49d0?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 203, Bungalow Deluxe, lit à baldaquin et terrasse tropicale'
  },
  {
    roomNumber: '204',
    category: 'bungalow-deluxe',
    filename: 'chambre-204-bungalow-deluxe.jpg',
    author: 'aurélie sgnl',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/un-pavillon-a-ciel-ouvert-spacieux-avec-toit-de-chaume-et-sieges-confortables-fMdw9JsMetg',
    downloadUrl: 'https://images.unsplash.com/photo-1779216175784-a67b6da108bb?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 204, Bungalow Deluxe, pavillon indépendant avec toit de chaume et végétation'
  },
  {
    roomNumber: '301',
    category: 'suite',
    filename: 'chambre-301-suite.jpg',
    author: 'Aalo Lens',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/coin-salon-moderne-avec-mobilier-contemporain-et-grandes-fenetres-yGEohCLnrl0',
    downloadUrl: 'https://images.unsplash.com/photo-1758448511255-ac2a24a135d7?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 301, Suite Prestige, vaste salon privé et baies panoramiques'
  },
  {
    roomNumber: '302',
    category: 'suite',
    filename: 'chambre-302-suite.jpg',
    author: 'Dynamic Hong Kong',
    bank: 'Unsplash',
    pageUrl: 'https://unsplash.com/fr/photos/chambre-dhotel-luxueuse-avec-vue-sur-la-ville-et-grande-television-km5I2E-mJbo',
    downloadUrl: 'https://images.unsplash.com/photo-1777169794972-12095816073b?auto=format&fit=crop&w=2400&q=85',
    license: 'Licence Unsplash (Usage commercial gratuit, libre de droits)',
    date: '09/11/2026',
    alt: 'Chambre 302, Suite Prestige, salon luxueux et terrasse privative'
  },
];

function isDomainAllowed(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function verifyImageSignature(buffer) {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  // PNG: 89 50 4E 47
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  // WebP: RIFF ... WEBP
  const isWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  return isJpeg || isPng || isWebp;
}

export async function downloadAllPhotos() {
  const outputDir = path.resolve(rootDir, 'images/chambres');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const hashes = new Map();
  console.log(`=== Téléchargement sécurisé des photos des 12 chambres ===`);

  for (const item of PHOTOS_CONFIG) {
    console.log(`\n[Chambre ${item.roomNumber}] ${item.filename} (${item.author})...`);

    // 1. Validation de domaine whitelist
    if (!isDomainAllowed(item.downloadUrl)) {
      throw new Error(`Sécurité : domaine non autorisé pour l'URL ${item.downloadUrl}`);
    }

    // 2. Requête HTTPS
    const res = await fetch(item.downloadUrl);
    if (!res.ok) {
      throw new Error(`Échec HTTP ${res.status} pour ${item.downloadUrl}`);
    }

    // 3. Vérification du type MIME
    const contentType = res.headers.get('content-type') || '';
    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMime.some(mime => contentType.includes(mime))) {
      throw new Error(`Sécurité : Type MIME invalide "${contentType}" pour ${item.downloadUrl}`);
    }

    // 4. Lecture du Buffer avec plafonnement à 8 Mo
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`Sécurité : Fichier trop volumineux (${buffer.length} octets > ${MAX_FILE_SIZE})`);
    }

    // 5. Vérification de la signature binaire (magic bytes)
    if (!verifyImageSignature(buffer)) {
      throw new Error(`Sécurité : Signature d'image invalide (possible fichier malveillant) pour ${item.filename}`);
    }

    // 6. Calcul de l'empreinte SHA-256 et détection de doublons exacts
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    if (hashes.has(hash)) {
      throw new Error(`Erreur doublon : l'image pour chambre ${item.roomNumber} est identique à chambre ${hashes.get(hash)}`);
    }
    hashes.set(hash, item.roomNumber);

    // 7. Enregistrement local
    const destPath = path.join(outputDir, item.filename);
    fs.writeFileSync(destPath, buffer);
    console.log(`  ✓ Enregistré : ${destPath} (${(buffer.length / 1024).toFixed(1)} Ko, SHA-256: ${hash.slice(0, 12)}...)`);
  }

  console.log(`\nSuccès : 12 photos différentes téléchargées avec succès sous images/chambres/`);
}

// Exécution directe
if (process.argv[1] && process.argv[1].endsWith('telecharger-photos.mjs')) {
  downloadAllPhotos().catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
}
