import { test, expect } from '@playwright/test';

test.describe('Porte de Sécurité : Fiche Profil Client (/clients/:id)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients/c1', { waitUntil: 'networkidle' });
  });

  test('Sécurité PII : Le numéro de passeport est masqué par défaut', async ({ page }) => {
    const passportField = page.locator('[data-testid="passport-number-display"]');
    await expect(passportField).toBeVisible();

    // Doit être masqué
    const text = await passportField.textContent();
    expect(text?.trim()).toContain('SN••••••1-B');
    expect(text).not.toContain('982341');
  });

  test('Sécurité XSS : La saisie de consignes/notes neutralise les injections HTML/JS', async ({ page }) => {
    let dialogTriggered = false;
    page.on('dialog', (dialog) => {
      dialogTriggered = true;
      dialog.dismiss();
    });

    // Basculer sur l'onglet Notes
    await page.locator('[data-testid="tab-notes"]').click();

    const noteInput = page.locator('[data-testid="input-tab-note"]');
    const submitBtn = page.locator('[data-testid="btn-save-tab-note"]');

    // Injection XSS vectorielle typique
    const xssPayload = '<img src="invalid-image" onerror="window.__xss_detected=true">' +
      '<script>window.__xss_script=true</script><b>Note Test</b>';

    await noteInput.fill(xssPayload);
    await submitBtn.click();

    // Vérifier que la note apparaît textuellement sans exécution de code
    await expect(page.locator('[data-testid="tab-notes-content"]')).toContainText('Note Test');

    // Vérifier qu'aucun script n'a été injecté/exécuté
    const xssDetected = await page.evaluate(() => (window as any).__xss_detected || (window as any).__xss_script);
    expect(xssDetected).toBeFalsy();
    expect(dialogTriggered).toBe(false);
  });

  test('Sécurité Réseau & CDN : Aucune fuite de données vers des domaines externes', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (!url.startsWith('http://localhost') && !url.startsWith('data:') && !url.startsWith('blob:')) {
        externalRequests.push(url);
      }
    });

    await page.reload({ waitUntil: 'networkidle' });

    // Tous les assets (images, icônes, polices) doivent être servis en local
    expect(externalRequests).toEqual([]);
  });

  test('Sécurité Monétaire : Aucun montant décimal en FCFA dans l\'interface', async ({ page }) => {
    const allText = await page.locator('[data-testid="client-profile-container"]').innerText();

    // Regex pour détecter un montant FCFA avec virgule ou décimale (ex: 125,50 FCFA ou 125.50 FCFA)
    const decimalFcfaRegex = /\d+[,.]\d+\s*FCFA/i;
    expect(decimalFcfaRegex.test(allText)).toBe(false);
  });
});
