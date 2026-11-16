import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { createE2eUser, deleteE2eUsers, loginViaUi } from './auth-e2e.helper';

const createdEmails: string[] = [];
const capturesDir = path.resolve(
  __dirname,
  '../../../docs/design/captures/administration-tableau-comptes',
);

test.describe('Tableau /administration/comptes — Layout fixe, sans débordement et cartes < 1180 px', () => {
  test.beforeAll(() => {
    fs.mkdirSync(capturesDir, { recursive: true });
  });

  test.afterAll(() => {
    deleteE2eUsers(createdEmails);
  });

  test('aucun scroll horizontal à 360/768/1024/1440 px, 3 boutons visibles non coupés, titres 1 ligne, 80 car. sans débordement, défilement vertical interne et en-tête collant avec 17+ comptes', async ({
    page,
    request,
  }) => {
    test.setTimeout(180000);
    const dir = createE2eUser('DIRECTION');
    createdEmails.push(dir.email);

    const loginRes = await request.post('/api/auth/login', {
      data: { login: dir.email, password: dir.password },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.accessToken as string;

    const ts = Date.now();
    // Inclure un e-mail d'exactement 80 caractères + 16 autres comptes (total >= 17)
    const longLocal = 'a'.repeat(56);
    const longEmail80 = `${longLocal}@residenceblue.sn`; // 56 + 17 = 73 -> ajuster exactement à 80 caractères
    const exact80Email = `${'x'.repeat(80 - '@residenceblue.sn'.length)}@residenceblue.sn`;
    expect(exact80Email.length).toBe(80);
    expect(longEmail80.length).toBeLessThan(80);

    const specs: Array<{ fullName: string; email: string; profile: string; screenAccess: Record<string, string> }> = [
      {
        fullName: 'Collaborateur Chaîne Très Longue Pour Vérification De Deux Lignes Maximum Sans Déborder',
        email: exact80Email,
        profile: 'ASSISTANT_RECEPTION',
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'ECRITURE',
          restaurant: 'ECRITURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
      },
    ];

    for (let i = 1; i <= 16; i++) {
      specs.push({
        fullName: `Compte Tableau ${i} Résidence Blue`,
        email: `tbl-${ts}-${i}@residenceblue.sn`,
        profile: i % 2 === 0 ? 'ASSISTANT_RESTAURANT' : 'CUISINIER',
        screenAccess:
          i % 2 === 0
            ? {
                accueil: 'AUCUN',
                planning: 'AUCUN',
                chambres: 'AUCUN',
                clients: 'AUCUN',
                facturation: 'AUCUN',
                restaurant: 'ECRITURE',
                cuisine: 'AUCUN',
                rapports: 'AUCUN',
              }
            : {
                accueil: 'AUCUN',
                planning: 'AUCUN',
                chambres: 'AUCUN',
                clients: 'AUCUN',
                facturation: 'AUCUN',
                restaurant: 'AUCUN',
                cuisine: 'ECRITURE',
                rapports: 'AUCUN',
              },
      });
    }

    for (const sp of specs) {
      createdEmails.push(sp.email);
      const res = await request.post('/api/administration/comptes', {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          fullName: sp.fullName,
          email: sp.email,
          starterProfile: sp.profile,
          screenAccess: sp.screenAccess,
          specialPermissions: {
            voir_montants: false,
            encaisser_paiement: false,
            changer_etat_chambre: false,
            annuler_commande_ou_reservation: false,
          },
        },
      });
      expect(res.status()).toBe(201);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await loginViaUi(page, dir.email, dir.password);
    await page.goto('/administration/comptes');

    const tableContainer = page.locator('[data-testid="accounts-table-container"]');
    await expect(tableContainer).toBeVisible({ timeout: 20000 });
    const longRow = page.locator(`[data-testid="account-row-${exact80Email}"]`);
    await expect(longRow).toBeVisible();

    // 1. Vérifier les 5 titres de colonnes sur 1 ligne, table-layout fixed, scrollWidth <= clientWidth, boutons 44px entièrement dans le tableau
    const desktopAudit = await page.evaluate((longEmail) => {
      const container = document.querySelector('[data-testid="accounts-table-container"]') as HTMLElement;
      const scrollBox = document.querySelector('[data-testid="accounts-scroll-box"]') as HTMLElement;
      const table = container.querySelector('table') as HTMLTableElement;
      const ths = Array.from(table.querySelectorAll('thead th')) as HTMLElement[];

      const headerWrapping = ths.map((th) => {
        const range = document.createRange();
        range.selectNodeContents(th);
        const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
        const distinctLines = new Set(rects.map((r) => Math.round(r.top))).size;
        return {
          text: th.textContent?.trim(),
          distinctLines,
          height: th.getBoundingClientRect().height,
        };
      });

      const boxStyle = getComputedStyle(scrollBox);
      const tableRect = container.getBoundingClientRect();
      const row = document.querySelector(`[data-testid="account-row-${longEmail}"]`) as HTMLElement;
      const actionButtons = Array.from(row.querySelectorAll('a, button')) as HTMLElement[];
      const buttonsAudit = actionButtons.map((btn) => {
        const r = btn.getBoundingClientRect();
        return {
          label: btn.textContent?.trim(),
          height: r.height,
          insideLeft: r.left >= tableRect.left - 1,
          insideRight: r.right <= tableRect.right + 1,
        };
      });

      return {
        pageScrollW: document.documentElement.scrollWidth,
        pageClientW: document.documentElement.clientWidth,
        containerScrollW: container.scrollWidth,
        containerClientW: container.clientWidth,
        scrollBoxScrollW: scrollBox.scrollWidth,
        scrollBoxClientW: scrollBox.clientWidth,
        scrollBoxScrollH: scrollBox.scrollHeight,
        scrollBoxClientH: scrollBox.clientHeight,
        overflowY: boxStyle.overflowY,
        scrollbarGutter: boxStyle.scrollbarGutter,
        tableLayout: getComputedStyle(table).tableLayout,
        headerCount: ths.length,
        headerWrapping,
        buttonsAudit,
      };
    }, exact80Email);

    expect(desktopAudit.tableLayout).toBe('fixed');
    expect(desktopAudit.headerCount).toBe(5);
    expect(desktopAudit.pageScrollW).toBeLessThanOrEqual(desktopAudit.pageClientW);
    expect(desktopAudit.containerScrollW).toBeLessThanOrEqual(desktopAudit.containerClientW);
    expect(desktopAudit.scrollBoxScrollW).toBeLessThanOrEqual(desktopAudit.scrollBoxClientW);
    expect(desktopAudit.overflowY).toBe('scroll');
    expect(desktopAudit.scrollBoxScrollH).toBeGreaterThan(desktopAudit.scrollBoxClientH);

    for (const h of desktopAudit.headerWrapping) {
      expect(h.distinctLines).toBe(1);
    }

    expect(desktopAudit.buttonsAudit.length).toBe(3);
    for (const b of desktopAudit.buttonsAudit) {
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.insideLeft).toBe(true);
      expect(b.insideRight).toBe(true);
    }

    // 2. Vérifier en-tête collant + barre de recherche hors zone défilante lors du scroll interne
    const searchBefore = await page.locator('[data-testid="accounts-search-bar"]').boundingBox();
    const theadBefore = await tableContainer.locator('thead th').first().boundingBox();
    await page.evaluate(() => {
      const scrollBox = document.querySelector('[data-testid="accounts-scroll-box"]') as HTMLElement;
      scrollBox.scrollTop = 320;
    });
    await page.waitForTimeout(100);
    const searchAfter = await page.locator('[data-testid="accounts-search-bar"]').boundingBox();
    const theadAfter = await tableContainer.locator('thead th').first().boundingBox();
    const scrollTopVal = await page.evaluate(
      () => (document.querySelector('[data-testid="accounts-scroll-box"]') as HTMLElement).scrollTop,
    );
    expect(scrollTopVal).toBeGreaterThan(200);
    expect(Math.round(theadAfter!.y)).toBe(Math.round(theadBefore!.y));
    expect(Math.round(searchAfter!.y)).toBe(Math.round(searchBefore!.y));

    await page.evaluate(() => {
      const scrollBox = document.querySelector('[data-testid="accounts-scroll-box"]') as HTMLElement;
      scrollBox.scrollTop = 0;
    });
    await page.screenshot({
      path: path.join(capturesDir, 'apres-1440px.png'),
      fullPage: false,
    });

    // 3. Vérifier 1024, 768 et 360 px : passage en cartes, aucun débordement horizontal, 3 boutons visibles
    for (const width of [1024, 768, 360]) {
      await page.setViewportSize({ width, height: 850 });
      await page.waitForTimeout(150);
      await expect(page.locator('[data-testid="accounts-mobile-cards"]')).toBeVisible();
      await expect(tableContainer).toBeHidden();

      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        cardButtonsCount: document.querySelectorAll(
          `[data-testid="account-card-${'x'.repeat(80 - '@residenceblue.sn'.length)}@residenceblue.sn"] a, [data-testid="account-card-${'x'.repeat(80 - '@residenceblue.sn'.length)}@residenceblue.sn"] button`,
        ).length,
      }));
      expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW);
      expect(overflow.cardButtonsCount).toBe(3);

      await page.screenshot({
        path: path.join(capturesDir, `apres-${width}px.png`),
        fullPage: false,
      });
    }
  });
});
