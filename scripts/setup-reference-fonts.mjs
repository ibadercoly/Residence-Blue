import fs from 'fs';
import path from 'path';

const fontsDir = path.resolve('design/reference/fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

// Copy Material Symbols
const matSrc = path.resolve('node_modules/material-symbols/material-symbols-outlined.woff2');
fs.copyFileSync(matSrc, path.join(fontsDir, 'material-symbols-outlined.woff2'));

// Copy Manrope
const manropeFiles = ['400', '500', '600', '700'];
for (const weight of manropeFiles) {
  const src = path.resolve(`node_modules/@fontsource/manrope/files/manrope-latin-${weight}-normal.woff2`);
  fs.copyFileSync(src, path.join(fontsDir, `manrope-latin-${weight}-normal.woff2`));
}

// Copy Newsreader
const newsreaderFiles = ['400', '500', '600'];
for (const weight of newsreaderFiles) {
  const src = path.resolve(`node_modules/@fontsource/newsreader/files/newsreader-latin-${weight}-normal.woff2`);
  fs.copyFileSync(src, path.join(fontsDir, `newsreader-latin-${weight}-normal.woff2`));
}

const fontsCss = `/* Polices locales pour les pages de référence hors ligne */
@font-face {
  font-family: 'Material Symbols Outlined';
  font-style: normal;
  font-weight: 100 700;
  src: url('fonts/material-symbols-outlined.woff2') format('woff2');
  font-display: block;
}

.material-symbols-outlined {
  font-family: 'Material Symbols Outlined';
  font-weight: normal;
  font-style: normal;
  font-size: 24px;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  display: inline-block;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-feature-settings: 'liga';
  -webkit-font-smoothing: antialiased;
}

@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 400;
  src: url('fonts/manrope-latin-400-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 500;
  src: url('fonts/manrope-latin-500-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 600;
  src: url('fonts/manrope-latin-600-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Manrope';
  font-style: normal;
  font-weight: 700;
  src: url('fonts/manrope-latin-700-normal.woff2') format('woff2');
}

@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 400;
  src: url('fonts/newsreader-latin-400-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 500;
  src: url('fonts/newsreader-latin-500-normal.woff2') format('woff2');
}
@font-face {
  font-family: 'Newsreader';
  font-style: normal;
  font-weight: 600;
  src: url('fonts/newsreader-latin-600-normal.woff2') format('woff2');
}
`;

fs.writeFileSync(path.resolve('design/reference/fonts.css'), fontsCss, 'utf8');
console.log('Fonts & fonts.css générés avec succès dans design/reference/');
