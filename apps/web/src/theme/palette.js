/**
 * Palette Résidence Blue — source unique des couleurs.
 * - light : valeurs EXACTES de la configuration Tailwind des maquettes
 *           (design/maquettes/tableau_de_bord/code.html).
 * - dark  : valeurs du mode sombre définies dans design/tokens.scss
 *           (aucune maquette sombre n'existe, voir docs/design/ECARTS.md).
 * Les couleurs « fixed » (primary-fixed, secondary-fixed, tertiary-fixed…) sont
 * identiques dans les deux thèmes, comme dans Material 3.
 */
const light = {
  'on-tertiary': '#ffffff',
  'background': '#f3fafe',
  'surface-container-lowest': '#ffffff',
  'on-tertiary-container': '#fdfcff',
  'surface-variant': '#dce4e7',
  'primary-container': '#00818c',
  'inverse-surface': '#2a3135',
  'tertiary-fixed-dim': '#b0c8eb',
  'surface-container': '#e8eff3',
  'on-tertiary-fixed-variant': '#314865',
  'surface-bright': '#f3fafe',
  'surface-dim': '#d4dbdf',
  'surface-container-low': '#eef5f9',
  'secondary-fixed': '#ffdead',
  'on-error': '#ffffff',
  'secondary-fixed-dim': '#fabc4f',
  'on-secondary-fixed-variant': '#604100',
  'primary-fixed-dim': '#6fd5e2',
  'tertiary-fixed': '#d2e4ff',
  'tertiary': '#465d7b',
  'primary-fixed': '#8cf2ff',
  'on-primary-fixed': '#001f23',
  'on-primary-container': '#f6feff',
  'primary': '#00666f',
  'on-surface': '#161d20',
  'on-tertiary-fixed': '#001c37',
  'on-secondary-container': '#714d00',
  'inverse-primary': '#6fd5e2',
  'on-primary-fixed-variant': '#004f56',
  'on-primary': '#ffffff',
  'surface-tint': '#006972',
  'on-secondary-fixed': '#281900',
  'surface-container-high': '#e2e9ed',
  'secondary': '#7e5700',
  'outline': '#6d797b',
  'on-secondary': '#ffffff',
  'on-error-container': '#93000a',
  'outline-variant': '#bdc9ca',
  'on-background': '#161d20',
  'error': '#ba1a1a',
  'on-surface-variant': '#3d494a',
  'tertiary-container': '#5f7695',
  'error-container': '#ffdad6',
  'surface': '#f3fafe',
  'secondary-container': '#fdbe51',
  'inverse-on-surface': '#ebf2f6',
  'surface-container-highest': '#dce4e7'
};

const dark = {
  ...light,
  'background': '#12181b',
  'on-background': '#ebf2f6',
  'surface': '#12181b',
  'surface-bright': '#192024',
  'surface-dim': '#0d1214',
  'on-surface': '#ebf2f6',
  'on-surface-variant': '#bdc9ca',
  'surface-container-lowest': '#192024',
  'surface-container-low': '#1e262a',
  'surface-container': '#242c30',
  'surface-container-high': '#2a3338',
  'surface-container-highest': '#30393f',
  'surface-variant': '#30393f',
  'surface-tint': '#6fd5e2',
  'primary': '#6fd5e2',
  'on-primary': '#00363b',
  'primary-container': '#004f56',
  'on-primary-container': '#8cf2ff',
  'inverse-primary': '#00666f',
  'secondary': '#fabc4f',
  'on-secondary': '#422c00',
  'secondary-container': '#604100',
  'on-secondary-container': '#ffdead',
  'tertiary': '#b0c8eb',
  'on-tertiary': '#16304c',
  'tertiary-container': '#2e4663',
  'on-tertiary-container': '#d2e4ff',
  'inverse-surface': '#f3fafe',
  'inverse-on-surface': '#161d20',
  'outline': '#879395',
  'outline-variant': '#3d494a',
  'error': '#ffb4ab',
  'on-error': '#690005',
  'error-container': '#93000a',
  'on-error-container': '#ffdad6'
};

/** '#00666f' -> '0 102 111' (canaux RVB pour rgb(var(--x) / alpha)). */
function toChannels(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).join(' ');
}

module.exports = { light, dark, toChannels };
