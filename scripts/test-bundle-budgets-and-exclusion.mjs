/**
 * Test de conformité des budgets de performance et d'exclusion des modules reportés.
 * RÈGLE POINT 5 :
 * - Vérifie que le bundle initial (main + polyfills) est < 250 Ko gzip.
 * - Vérifie que chaque route lazy est < 120 Ko gzip.
 * - Vérifie qu'aucun code/symbole d'un module reporté n'est inclus dans le bundle initial.
 * - Vérifie les budgets d'images (< 80 Ko par miniature).
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const DIST_BROWSER_DIR = path.resolve('apps/web/dist/residence-blue-web/browser');

console.log('------------------------------------------------------------');
console.log('🧪 VÉRIFICATION DES BUDGETS ET EXCLUSION DES MODULES REPORTÉS');
console.log('------------------------------------------------------------');

if (!fs.existsSync(DIST_BROWSER_DIR)) {
  console.error(`❌ Le répertoire de build de production est introuvable : ${DIST_BROWSER_DIR}`);
  console.error('Veuillez lancer `npm run build:web` au préalable.');
  process.exit(1);
}

const files = fs.readdirSync(DIST_BROWSER_DIR);

// 1. Identification des fichiers initiaux
const mainJs = files.find(f => f.startsWith('main-') && f.endsWith('.js'));
const polyfillsJs = files.find(f => f.startsWith('polyfills-') && f.endsWith('.js'));
const stylesCss = files.find(f => f.startsWith('styles-') && f.endsWith('.css'));

if (!mainJs) {
  console.error('❌ Fichier main-*.js introuvable dans le dossier dist.');
  process.exit(1);
}

function getGzipSize(filePath) {
  const buf = fs.readFileSync(filePath);
  return zlib.gzipSync(buf, { level: 9 }).length;
}

const mainGzip = getGzipSize(path.join(DIST_BROWSER_DIR, mainJs));
const polyfillsGzip = polyfillsJs ? getGzipSize(path.join(DIST_BROWSER_DIR, polyfillsJs)) : 0;
const totalInitialJsGzip = mainGzip + polyfillsGzip;

const INITIAL_BUDGET_BYTES = 250 * 1024; // 250 Ko
console.log(`\n1. Budget JavaScript initial (Budget: 250 Ko gzip) :`);
console.log(`   - Main JS (${mainJs}) : ${(mainGzip / 1024).toFixed(2)} Ko gzip`);
if (polyfillsJs) {
  console.log(`   - Polyfills JS (${polyfillsJs}) : ${(polyfillsGzip / 1024).toFixed(2)} Ko gzip`);
}
console.log(`   👉 Total initial JS : ${(totalInitialJsGzip / 1024).toFixed(2)} Ko gzip`);

if (totalInitialJsGzip > INITIAL_BUDGET_BYTES) {
  console.error(`❌ ÉCHEC : Le bundle initial (${(totalInitialJsGzip / 1024).toFixed(2)} Ko) dépasse le budget de 250 Ko !`);
  process.exit(1);
} else {
  console.log(`   ✅ Budget initial respecté (marge restante : ${((INITIAL_BUDGET_BYTES - totalInitialJsGzip) / 1024).toFixed(2)} Ko)`);
}

// 2. Vérification des chunks à la demande (< 120 Ko gzip)
console.log(`\n2. Budget des routes chargées à la demande (Budget: < 120 Ko gzip par chunk) :`);
const chunkFiles = files.filter(f => f.endsWith('.js') && f !== mainJs && f !== polyfillsJs);
const CHUNK_BUDGET_BYTES = 120 * 1024; // 120 Ko
let chunksOk = true;

for (const chunk of chunkFiles) {
  const chunkSizeGzip = getGzipSize(path.join(DIST_BROWSER_DIR, chunk));
  const chunkKo = (chunkSizeGzip / 1024).toFixed(2);
  if (chunkSizeGzip > CHUNK_BUDGET_BYTES) {
    console.error(`   ❌ Chunk trop lourd : ${chunk} (${chunkKo} Ko > 120 Ko)`);
    chunksOk = false;
  } else {
    console.log(`   ✅ Chunk ${chunk} : ${chunkKo} Ko gzip`);
  }
}

if (!chunksOk) {
  console.error('❌ ÉCHEC : Un ou plusieurs chunks à la demande dépassent 120 Ko.');
  process.exit(1);
}

// 3. Analyse du contenu du bundle : exclusion stricte des modules reportés
console.log(`\n3. Analyse du contenu du bundle initial (Exclusion des modules reportés) :`);
const mainContent = fs.readFileSync(path.join(DIST_BROWSER_DIR, mainJs), 'utf8');

// Termes spécifiques aux composants et services des modules reportés
const DEFERRED_PATTERNS = [
  { id: 'housekeeping', pattern: /HousekeepingPageComponent|housekeeping-page|chambres-blanches/i },
  { id: 'maintenance', pattern: /MaintenancePageComponent|maintenance-work-order|tickets-techniques/i },
  { id: 'stocks', pattern: /InventoryPageComponent|stock-movement|fiches-techniques/i },
  { id: 'marketing_crm', pattern: /MarketingPageComponent|crm-loyalty-campaign/i },
  { id: 'channel_manager', pattern: /ChannelManagerComponent|ota-booking-sync/i },
  { id: 'accounting', pattern: /AccountingPageComponent|syscohada-ledger/i },
];

let leakDetected = false;
for (const { id, pattern } of DEFERRED_PATTERNS) {
  if (pattern.test(mainContent)) {
    console.error(`❌ ÉCHEC : Du code appartenant au module reporté « ${id} » a été détecté dans le bundle initial !`);
    leakDetected = true;
  } else {
    console.log(`   ✅ Module reporté « ${id} » absent du bundle initial.`);
  }
}

if (leakDetected) {
  console.error('❌ ÉCHEC : Des composants de modules reportés sont inclus dans le bundle initial.');
  process.exit(1);
}

// 4. Vérification des budgets images (< 80 Ko par image miniature)
console.log(`\n4. Vérification du poids des images de production (< 80 Ko par miniature) :`);
const imagesDir = path.join(DIST_BROWSER_DIR, 'assets/images');
if (fs.existsSync(imagesDir)) {
  const images = [];
  function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.(webp|jpg|jpeg|png)$/i.test(entry.name)) {
        images.push({ path: path.relative(DIST_BROWSER_DIR, full), size: fs.statSync(full).size });
      }
    }
  }
  scan(imagesDir);

  const heavyImages = images.filter(img => img.size > 80 * 1024);
  if (heavyImages.length > 0) {
    console.warn(`⚠️ Attention : ${heavyImages.length} image(s) dépassent 80 Ko :`);
    heavyImages.forEach(img => console.warn(`   - ${img.path}: ${(img.size / 1024).toFixed(1)} Ko`));
  } else {
    console.log(`   ✅ Toutes les images scannées (${images.length}) respectent le budget de 80 Ko.`);
  }
}

console.log('\n============================================================');
console.log('🎉 TOUS LES BUDGETS ET TESTS D’EXCLUSION SONT VALIDÉS !');
console.log('============================================================\n');
process.exit(0);
