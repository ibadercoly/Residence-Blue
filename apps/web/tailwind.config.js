/**
 * Configuration Tailwind reprise À L'IDENTIQUE des maquettes Stitch
 * (design/maquettes/tableau_de_bord/code.html) : mêmes noms et valeurs de
 * couleurs, rayons, espacements, familles et tailles de police.
 * Seule différence technique : les couleurs passent par des variables CSS
 * pour permettre la bascule clair / sombre (les valeurs claires sont exactement
 * celles de la maquette).
 */
const plugin = require('tailwindcss/plugin');
const { light, dark, toChannels } = require('./src/theme/palette.js');

const colors = Object.fromEntries(
  Object.keys(light).map(name => [name, `rgb(var(--rb-${name}) / <alpha-value>)`])
);

const toVars = palette =>
  Object.fromEntries(Object.entries(palette).map(([name, hex]) => [`--rb-${name}`, toChannels(hex)]));

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors,
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px'
      },
      spacing: {
        'gutter-sm': '1rem',
        'space-sm': '0.5rem',
        'space-md': '1rem',
        'margin': '2rem',
        'gutter': '1.5rem',
        'space-lg': '1.5rem',
        'space-xl': '2.5rem',
        'margin-sm': '1rem',
        'space-xs': '0.25rem'
      },
      fontFamily: {
        'label-currency': ['Manrope'],
        'title-md': ['Manrope'],
        'body-lg': ['Manrope'],
        'display-lg-mobile': ['Newsreader'],
        'headline-lg': ['Newsreader'],
        'headline-lg-mobile': ['Newsreader'],
        'headline-md': ['Newsreader'],
        'headline-sm': ['Newsreader'],
        'label-lg': ['Manrope'],
        'body-md': ['Manrope'],
        'display-lg': ['Newsreader'],
        'title-lg': ['Manrope'],
        'label-md': ['Manrope'],
        'body-sm': ['Manrope']
      },
      fontSize: {
        'label-currency': ['16px', { lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '700' }],
        'title-md': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '26px', fontWeight: '400' }],
        'display-lg-mobile': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'headline-lg-mobile': ['26px', { lineHeight: '34px', letterSpacing: '-0.01em', fontWeight: '500' }],
        'headline-md': ['24px', { lineHeight: '32px', fontWeight: '500' }],
        'headline-sm': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'label-lg': ['14px', { lineHeight: '20px', letterSpacing: '0.01em', fontWeight: '600' }],
        'body-md': ['14px', { lineHeight: '22px', fontWeight: '400' }],
        'display-lg': ['48px', { lineHeight: '56px', letterSpacing: '-0.02em', fontWeight: '400' }],
        'title-lg': ['18px', { lineHeight: '26px', fontWeight: '700' }],
        'label-md': ['12px', { lineHeight: '16px', letterSpacing: '0.02em', fontWeight: '600' }],
        'body-sm': ['13px', { lineHeight: '18px', fontWeight: '500' }]
      }
    }
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({ ':root': toVars(light), '.dark': toVars(dark) });
    })
  ]
};
