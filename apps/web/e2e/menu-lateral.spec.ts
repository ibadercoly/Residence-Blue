import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

const createdEmails: string[] = [];
const capturesDir = path.resolve(__dirname, '../../../docs/design/captures/menu-lateral');

const EXPECTED_MENU_COLORS: Array<{
  id: string;
  cssVar: string;
  hex: string;
  rgb: [number, number, number];
}> = [
  { id: 'dashboard', cssVar: '--couleur-menu-accueil', hex: '#4FD1C5', rgb: [79, 209, 197] },
  { id: 'planning', cssVar: '--couleur-menu-planning', hex: '#5B9DF9', rgb: [91, 157, 249] },
  { id: 'rooms', cssVar: '--couleur-menu-chambres', hex: '#A78BFA', rgb: [167, 139, 250] },
  { id: 'clients', cssVar: '--couleur-menu-clients', hex: '#F472B6', rgb: [244, 114, 182] },
  { id: 'facturation', cssVar: '--couleur-menu-facturation', hex: '#34C48B', rgb: [52, 196, 139] },
  { id: 'rapports', cssVar: '--couleur-menu-rapports', hex: '#F2785C', rgb: [242, 120, 92] },
  { id: 'restaurant', cssVar: '--couleur-menu-restaurant', hex: '#F2A33A', rgb: [242, 163, 58] },

  { id: 'administration', cssVar: '--couleur-menu-administration', hex: '#818CF8', rgb: [129, 140, 248] },
];

function relLuminance([r, g, b]: [number, number, number]): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relLuminance(rgb1);
  const l2 = relLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('Menu latéral : couleurs des 7 icônes SVG et suppression de Exports', () => {
  test.beforeAll(() => {
    fs.mkdirSync(capturesDir, { recursive: true });
  });

  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('chaque icône a sa propre couleur >= 3:1 sur #2A3338, pastille active teintée, captures tour à tour et suppression Exports', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir.email, dir.password);

    // 1. « Exports » absent du menu et /exports redirige vers /accueil
    const navLinks = page.locator('[data-testid="sidebar-nav"] a');
    expect(await navLinks.count()).toBe(8);
    await expect(page.locator('[data-testid="nav-cuisine"]')).toHaveCount(0);

    await page.goto('/exports');
    await expect(page).toHaveURL(/\/accueil$/);
    await page.goto('/tableau-de-bord');
    await page.waitForLoadState('networkidle');

    // 2. Vérifier --icone-menu: 26px, les 7 couleurs distinctes égales à leurs variables CSS, parties .accent à 30 %, contraste >= 3:1 sur #2A3338
    const colorAudit = await page.evaluate((expectedList) => {
      const rootStyle = getComputedStyle(document.documentElement);
      const iconSizeVar = rootStyle.getPropertyValue('--icone-menu').trim();

      const results = expectedList.map((exp) => {
        const varVal = rootStyle.getPropertyValue(exp.cssVar).trim().toUpperCase();
        const link = document.querySelector(`[data-testid="nav-${exp.id}"]`) as HTMLElement;
        const svg = link?.querySelector('svg.rb-menu-svg-icon') as SVGElement | null;
        const accent = svg?.querySelector('.accent') as SVGElement | null;
        const svgStyle = svg ? getComputedStyle(svg) : null;
        const accentStyle = accent ? getComputedStyle(accent) : null;
        const linkStyle = link ? getComputedStyle(link) : null;
        const rect = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };

        return {
          id: exp.id,
          varVal,
          computedColor: svgStyle?.color || '',
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hasAccent: Boolean(accent),
          accentOpacity: accentStyle ? parseFloat(accentStyle.fillOpacity) : 0,
          linkColor: linkStyle?.color || '',
          linkWeight: linkStyle ? parseInt(linkStyle.fontWeight, 10) : 0,
          linkBg: linkStyle?.backgroundColor || '',
          isActive: link?.getAttribute('aria-current') === 'page',
        };
      });

      return { iconSizeVar, results };
    }, EXPECTED_MENU_COLORS);

    expect(colorAudit.iconSizeVar).toBe('26px');

    const seenColors = new Set<string>();
    const sidebarBg: [number, number, number] = [42, 51, 56]; // #2A3338

    for (let i = 0; i < EXPECTED_MENU_COLORS.length; i++) {
      const exp = EXPECTED_MENU_COLORS[i];
      const res = colorAudit.results[i];

      expect(res.varVal).toBe(exp.hex);
      expect(res.computedColor).toBe(`rgb(${exp.rgb[0]}, ${exp.rgb[1]}, ${exp.rgb[2]})`);
      expect(res.width).toBe(26);
      expect(res.height).toBe(26);
      expect(res.hasAccent).toBe(true);
      expect(res.accentOpacity).toBeCloseTo(0.3, 2);

      seenColors.add(res.computedColor);

      const ratio = contrastRatio(exp.rgb, sidebarBg);
      expect(ratio).toBeGreaterThanOrEqual(3.0);

      if (res.isActive) {
        // Libellé actif en blanc (#FFFFFF) et poids 600
        expect(res.linkColor).toBe('rgb(255, 255, 255)');
        expect(res.linkWeight).toBe(600);
      } else {
        // Libellé inactif en blanc cassé (#DDEFF1) et poids 500
        expect(res.linkColor).toBe('rgb(221, 239, 241)');
        expect(res.linkWeight).toBe(500);
      }
    }

    // Les 8 couleurs d'icônes sont toutes distinctes
    expect(seenColors.size).toBe(8);

    // 3. Activer chaque entrée tour à tour, vérifier la pastille teintée et capturer la barre latérale
    const asideLocator = page.getByTestId('app-sidebar-aside');
    for (const exp of EXPECTED_MENU_COLORS) {
      const link = page.getByTestId(`nav-${exp.id}`);
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'page');

      const activeState = await link.evaluate((el) => {
        const st = getComputedStyle(el);
        return {
          ariaCurrent: el.getAttribute('aria-current'),
          color: st.color,
          fontWeight: parseInt(st.fontWeight, 10),
          backgroundColor: st.backgroundColor,
        };
      });

      expect(activeState.ariaCurrent).toBe('page');
      expect(activeState.color).toBe('rgb(255, 255, 255)');
      expect(activeState.fontWeight).toBe(600);
      expect(activeState.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(activeState.backgroundColor).not.toBe('transparent');

      await asideLocator.screenshot({
        path: path.join(capturesDir, `sidebar-active-${exp.id}.png`),
      });
    }

    // 4. Aucun scroll horizontal aux 4 largeurs obligatoires (360, 768, 1024, 1440)
    for (const width of [1440, 1024, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    }
  });
});
