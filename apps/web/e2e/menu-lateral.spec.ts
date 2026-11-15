import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

const createdEmails: string[] = [];
const capturesDir = path.resolve(__dirname, '../../../docs/design/captures/menu-lateral');

test.describe('Barre latérale agrandie et suppression de l’écran Exports', () => {
  test.beforeAll(() => {
    fs.mkdirSync(capturesDir, { recursive: true });
  });

  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('Exports absent du menu, /exports redirige vers /accueil, exports métiers préservés, tailles/espacements/scroll et captures', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir.email, dir.password);

    // 1. « Exports » absent du menu latéral
    const navLinks = page.locator('[data-testid="sidebar-nav"] a');
    const linkCount = await navLinks.count();
    expect(linkCount).toBe(7);

    const navInfo = await navLinks.evaluateAll((els) =>
      els.map((el) => ({
        href: el.getAttribute('href'),
        text: (el.textContent || '').trim(),
      })),
    );
    expect(navInfo.some((i) => i.href === '/exports' || /exports/i.test(i.text))).toBe(false);

    // 2. Redirection /exports -> /accueil
    await page.goto('/exports');
    await expect(page).toHaveURL(/\/accueil$/);

    // Retour sur /tableau-de-bord pour mesurer la barre latérale avec pastille active
    await page.goto('/tableau-de-bord');
    await page.waitForLoadState('networkidle');

    // 3. Vérification des tailles : titre 13px, libellés 18px (500/600), icônes 26px (--icone-menu), hauteur 56px, écart >= 8px, 0 troncature
    const metrics = await page.evaluate(() => {
      const rootVar = getComputedStyle(document.documentElement).getPropertyValue('--icone-menu').trim();
      const heading = document.querySelector('[data-testid="sidebar-section-title"]') as HTMLElement;
      const headingSize = heading ? parseFloat(getComputedStyle(heading).fontSize) : 0;
      const links = Array.from(document.querySelectorAll('[data-testid="sidebar-nav"] a')) as HTMLElement[];

      const items = links.map((a) => {
        const icon = a.querySelector('.rb-sidebar-icon') as HTMLElement;
        const label = a.querySelector('.rb-sidebar-label') as HTMLElement;
        const rect = a.getBoundingClientRect();
        const aStyle = getComputedStyle(a);
        const iconStyle = getComputedStyle(icon);
        const labelStyle = getComputedStyle(label);
        return {
          text: label.textContent?.trim() || '',
          isActive: a.getAttribute('aria-current') === 'page',
          height: rect.height,
          top: rect.top,
          bottom: rect.bottom,
          radius: parseFloat(aStyle.borderRadius),
          labelFontSize: parseFloat(labelStyle.fontSize),
          labelFontWeight: parseInt(labelStyle.fontWeight, 10),
          iconFontSize: parseFloat(iconStyle.fontSize),
          labelOverflow: label.scrollWidth > label.clientWidth + 1,
          linkOverflow: a.scrollWidth > a.clientWidth + 1,
        };
      });

      const gaps: number[] = [];
      for (let i = 1; i < items.length; i++) {
        gaps.push(Math.round(items[i].top - items[i - 1].bottom));
      }

      return { rootVar, headingSize, items, gaps };
    });

    expect(metrics.rootVar).toBe('26px');
    expect(metrics.headingSize).toBe(13);
    expect(metrics.items.length).toBe(7);

    for (const it of metrics.items) {
      expect(it.height).toBeCloseTo(56, 0);
      expect(it.labelFontSize).toBe(18);
      expect(it.iconFontSize).toBe(26);
      expect(it.radius).toBe(14);
      expect(it.labelOverflow).toBe(false);
      expect(it.linkOverflow).toBe(false);
      if (it.isActive) {
        expect(it.labelFontWeight).toBe(600);
      } else {
        expect(it.labelFontWeight).toBe(500);
      }
    }
    for (const g of metrics.gaps) {
      expect(g).toBeGreaterThanOrEqual(8);
    }

    // 4. Toutes les entrées visibles sans défilement interne à 1440 x 900
    const scroll1440 = await page.getByTestId('sidebar-scroll-container').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scroll1440.scrollHeight).toBeLessThanOrEqual(scroll1440.clientHeight + 1);
    expect(scroll1440.scrollWidth).toBeLessThanOrEqual(scroll1440.clientWidth + 1);

    // Capture après (desktop 1440 x 900)
    await page.screenshot({ path: path.join(capturesDir, 'menu-apres-1440.png') });

    // 5. Toutes les entrées visibles sans défilement interne à 1280 x 720
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(150);
    const scroll720 = await page.getByTestId('sidebar-scroll-container').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scroll720.scrollHeight).toBeLessThanOrEqual(scroll720.clientHeight + 1);
    expect(scroll720.scrollWidth).toBeLessThanOrEqual(scroll720.clientWidth + 1);

    // 6. Défilement vertical interne à 1280 x 600 sans chevauchement du bloc Version
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.waitForTimeout(150);
    const scroll600 = await page.getByTestId('sidebar-scroll-container').evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(scroll600.scrollHeight).toBeGreaterThan(scroll600.clientHeight);
    expect(scroll600.scrollWidth).toBeLessThanOrEqual(scroll600.clientWidth + 1);

    const scrollBox = await page.getByTestId('sidebar-scroll-container').boundingBox();
    const versionBox = await page.getByTestId('sidebar-version-block').boundingBox();
    expect(scrollBox).not.toBeNull();
    expect(versionBox).not.toBeNull();
    expect(scrollBox!.y + scrollBox!.height).toBeLessThanOrEqual(versionBox!.y + 1);

    // 7. Aucun scroll horizontal aux 4 largeurs obligatoires (360, 768, 1024, 1440)
    for (const width of [1440, 1024, 768, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    }

    // 8. Menu coulissant mobile (< 900 px) à 360 px : mêmes tailles (>= 56 px, 18 px, 26 px) + capture
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(150);
    await page.getByTestId('mobile-menu-toggle').click();
    await page.waitForTimeout(250);
    await expect(page.getByTestId('sidebar-backdrop')).toBeVisible();
    const firstMobileLink = page.locator('[data-testid="sidebar-nav"] a').first();
    const mobileLinkBox = await firstMobileLink.boundingBox();
    expect(mobileLinkBox).not.toBeNull();
    expect(mobileLinkBox!.height).toBeGreaterThanOrEqual(56);
    await page.screenshot({ path: path.join(capturesDir, 'menu-apres-mobile-360.png') });
    await page.getByTestId('sidebar-close-mobile').click();
    await expect(page.getByTestId('sidebar-backdrop')).toHaveCount(0);

    // 9. Vérifier que les exports de Rapports, Comptoir et Archives restent accessibles
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/rapports');
    await expect(page.getByTestId('export-pdf-btn')).toBeVisible();
    await expect(page.getByTestId('export-excel-btn')).toBeVisible();

    await page.goto('/facturation');
    await expect(page.locator('button', { hasText: /clôture/i }).first()).toBeVisible();

    await page.goto('/facturation/archives');
    await expect(page.locator('button', { hasText: /exporter/i }).first()).toBeVisible();
  });
});
