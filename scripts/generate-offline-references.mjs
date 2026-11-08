import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const maquettesDir = path.resolve('design/maquettes');
const refDir = path.resolve('design/reference');
const cssDir = path.join(refDir, 'css');
const imagesDir = path.resolve('images/maquettes-originales');

if (!fs.existsSync(cssDir)) {
  fs.mkdirSync(cssDir, { recursive: true });
}

// Input CSS for Tailwind CLI
const inputCssPath = path.resolve('scripts/tailwind-input.css');
fs.writeFileSync(
  inputCssPath,
  `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`,
  'utf8'
);

const folders = fs.readdirSync(maquettesDir).filter(f => {
  return fs.existsSync(path.join(maquettesDir, f, 'code.html'));
});

console.log(`Traitement de ${folders.length} maquettes...`);

for (const folder of folders) {
  const htmlPath = path.join(maquettesDir, folder, 'code.html');
  const rawHtml = fs.readFileSync(htmlPath, 'utf8');

  // 1. Extraire la config Tailwind
  const configMatch = rawHtml.match(/<script id="tailwind-config">([\s\S]*?)<\/script>/);
  let tailwindConfigObj = null;

  if (configMatch) {
    const scriptContent = configMatch[1];
    const assignMatch = scriptContent.match(/tailwind\.config\s*=\s*(\{[\s\S]*\});?/);
    if (assignMatch) {
      try {
        // Évaluation sécurisée du littéral d'objet config
        const fn = new Function(`return ${assignMatch[1]};`);
        tailwindConfigObj = fn();
      } catch (e) {
        console.error(`Erreur d'analyse config tailwind pour ${folder}:`, e.message);
      }
    }
  }

  // 2. Préparer le fichier HTML intermédiaire pour Tailwind CLI
  const tempHtmlPath = path.resolve(`scripts/temp-${folder}.html`);
  fs.writeFileSync(tempHtmlPath, rawHtml, 'utf8');

  // 3. Écrire le fichier de config Tailwind temporaire
  const tempConfigPath = path.resolve(`scripts/temp-${folder}.config.js`);
  const finalConfig = {
    darkMode: tailwindConfigObj?.darkMode || 'class',
    content: [tempHtmlPath.replace(/\\/g, '/')],
    theme: tailwindConfigObj?.theme || {},
  };

  fs.writeFileSync(
    tempConfigPath,
    `module.exports = ${JSON.stringify(finalConfig, null, 2)};`,
    'utf8'
  );

  // 4. Compiler le CSS avec Tailwind CLI
  const outputCssPath = path.join(cssDir, `${folder}.css`);
  console.log(`Compilation Tailwind pour ${folder}...`);
  try {
    execSync(
      `npx tailwindcss -c "${tempConfigPath}" -i "${inputCssPath}" -o "${outputCssPath}" --minify`,
      { stdio: 'pipe' }
    );
  } catch (err) {
    console.error(`Échec compilation Tailwind pour ${folder}:`, err.message);
  }

  // Nettoyage temporaires de build
  if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
  if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);

  // 5. Remplacer les images et liens distants dans le HTML pour la référence hors ligne
  let offlineHtml = rawHtml;

  // Supprimer CDN tailwind et script tailwind-config
  offlineHtml = offlineHtml.replace(/<script src="https:\/\/cdn\.tailwindcss\.com"><\/script>/gi, '');
  offlineHtml = offlineHtml.replace(/<script id="tailwind-config">[\s\S]*?<\/script>/gi, '');

  // Remplacer les liens Google Fonts distants par fonts.css et le CSS compilé
  offlineHtml = offlineHtml.replace(
    /<link[^>]+href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>/gi,
    ''
  );
  offlineHtml = offlineHtml.replace(
    /<link[^>]+rel="preconnect"[^>]*>/gi,
    ''
  );

  // Injecter fonts.css et css/<folder>.css dans le <head>
  const headInject = `
    <link rel="stylesheet" href="fonts.css" />
    <link rel="stylesheet" href="css/${folder}.css" />
  `;
  offlineHtml = offlineHtml.replace('</head>', `${headInject}</head>`);

  // Remplacer les URLs d'images distantes par les fichiers locaux
  const imgRegex = /https:\/\/lh3\.googleusercontent\.com\/[^\s"'')]+/g;
  const matches = [...offlineHtml.matchAll(imgRegex)].map(m => m[0]);
  const uniqueUrls = [...new Set(matches)];

  let imgIdx = 1;
  for (const url of uniqueUrls) {
    // Vérifier si le fichier local correspondant existe
    const potentialFiles = [
      `${folder}-${imgIdx}.jpg`,
      `${folder}-${imgIdx}.png`,
      `${folder}-${imgIdx}.webp`,
    ];
    let localFile = potentialFiles.find(f => fs.existsSync(path.join(imagesDir, f)));

    if (localFile) {
      const relPath = `../../images/maquettes-originales/${localFile}`;
      offlineHtml = offlineHtml.split(url).join(relPath);
    } else {
      // Image de repli élégante locale pour les liens expirés
      if (url.includes('ALJJyrDFOOkp7aUtXmOYKoN1gTce')) {
        // Logo de repli SVG inline
        const fallbackLogo = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40"><rect width="120" height="40" rx="8" fill="%2300666f"/><text x="60" y="25" fill="%23ffffff" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">BLUE</text></svg>`;
        offlineHtml = offlineHtml.split(url).join(fallbackLogo);
      } else {
        // Avatar de repli
        const fallbackAvatar = `../../images/maquettes-originales/fiche_profil_client_m._mamadou_diop-1.jpg`;
        offlineHtml = offlineHtml.split(url).join(fallbackAvatar);
      }
    }
    imgIdx++;
  }

  // Écrire le fichier reference/<folder>.html
  const targetHtmlPath = path.join(refDir, `${folder}.html`);
  fs.writeFileSync(targetHtmlPath, offlineHtml, 'utf8');
  console.log(`✅ Fichier de référence généré : ${targetHtmlPath}`);
}

// Nettoyage
if (fs.existsSync(inputCssPath)) fs.unlinkSync(inputCssPath);

console.log('\nToutes les références hors ligne ont été générées avec succès !');
