import { test, expect } from '@playwright/test';

test.describe('Porte de Sécurité : Facturation & Folio Client (/facturation)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/facturation', { waitUntil: 'networkidle' });
  });

  test('Sécurité PII : Le passeport est exclu de la feuille d’impression (print:hidden)', async ({ page }) => {
    const passportElement = page.locator('[data-testid="passport-screen-display"]');
    await expect(passportElement).toBeVisible();

    // Vérifier la présence de la classe Tailwind print:hidden
    const classList = await passportElement.getAttribute('class');
    expect(classList).toContain('print:hidden');

    // Emuler le média 'print' et vérifier que l’élément est masqué
    await page.emulateMedia({ media: 'print' });
    const isHiddenInPrint = await passportElement.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none';
    });
    expect(isHiddenInPrint).toBe(true);

    // Rétablir média screen
    await page.emulateMedia({ media: 'screen' });
  });

  test('Règle AGENTS.MD : Aucun montant décimal en FCFA sur l’ensemble de l’écran', async ({ page }) => {
    const textContent = await page.locator('[data-testid="facturation-container"]').innerText();

    // Vérifier l'absence de montants avec virgules ou points de décimales suivis de FCFA (ex: 150000,50 FCFA ou 150000.00 FCFA)
    const decimalFcfaRegex = /\d+([.,]\d{1,2})\s*FCFA/gi;
    const decimalMatches = textContent.match(decimalFcfaRegex);

    expect(decimalMatches).toBeNull();
  });

  test('Sécurité Réseau & CDN : Zéro requête vers des domaines externes non autorisés', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
        externalRequests.push(url);
      }
    });

    // Navigation et interactions
    await page.goto('/facturation', { waitUntil: 'networkidle' });
    await page.locator('[data-testid="tab-z-caisse"]').click();
    await page.waitForTimeout(300);
    await page.locator('[data-testid="tab-folio"]').click();

    expect(externalRequests).toEqual([]);
  });

  test('Sécurité XSS : Les références de transaction neutralisent les injections de script', async ({ page }) => {
    let dialogTriggered = false;
    page.on('dialog', (dialog) => {
      dialogTriggered = true;
      dialog.dismiss();
    });

    const waveRefInput = page.locator('[data-testid="input-wave-ref"]');
    const xssPayload = '<img src=x onerror="window.__xss_detected=true"><script>window.__xss_script=true</script>';

    await waveRefInput.fill(xssPayload);
    await page.waitForTimeout(200);

    const xssDetected = await page.evaluate(() => (window as unknown as { __xss_detected?: boolean; __xss_script?: boolean }).__xss_detected || (window as unknown as { __xss_script?: boolean }).__xss_script);
    expect(xssDetected).toBeFalsy();
    expect(dialogTriggered).toBe(false);
  });
});
