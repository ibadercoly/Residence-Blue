import { test, expect } from '@playwright/test';
import { MenuManagementService } from '../src/app/core/services/menu-management.service';
import { RestaurantMockService } from '../src/app/core/services/restaurant-mock.service';
import { HotelSettingsService } from '../src/app/core/services/hotel-settings.service';
import { PhotoStorageService } from '../src/app/core/services/photo-storage.service';
import { validateImageFile } from '../src/app/core/utils/image-processor.util';

function createService(): MenuManagementService {
  return new MenuManagementService(
    new RestaurantMockService(),
    new HotelSettingsService(),
    new PhotoStorageService()
  );
}

test.describe('Sécurité de la gestion du menu restaurant (Porte de Sécurité)', () => {
  test('RBAC : Les rôles non autorisés (MAINTENANCE, RECEPTION) ne voient pas le bouton Gérer le menu', async ({ page }) => {
    // 1. Connexion en MAINTENANCE via residence_blue_auth_session
    await page.addInitScript(() => {
      const session = {
        user: {
          id: 'usr-003-maint',
          email: 'technique@residenceblue.sn',
          fullName: 'Moussa Ndiaye',
          role: 'MAINTENANCE',
          jobTitle: 'Chef Maintenance'
        },
        token: 'token-maintenance',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        stayConnected8h: true,
        lastActivityAt: Date.now(),
        isLocked: false
      };
      localStorage.setItem('residence_blue_auth_session', JSON.stringify(session));
    });

    await page.goto('/restaurant');
    // Le bouton Gérer le menu doit être totalement absent
    await expect(page.locator('[data-testid="btn-manage-menu"]')).not.toBeVisible();
    await expect(page.getByText('Gérer le menu')).not.toBeVisible();
  });

  test('RBAC : Le rôle DIRECTION a bien accès au bouton Gérer le menu', async ({ page }) => {
    await page.addInitScript(() => {
      const session = {
        user: {
          id: 'usr-001-ba',
          email: 'aissatou.ba@residenceblue.sn',
          fullName: 'Aïssatou Ba',
          role: 'DIRECTION',
          jobTitle: "Directrice d'Exploitation"
        },
        token: 'token-dir',
        expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        stayConnected8h: true,
        lastActivityAt: Date.now(),
        isLocked: false
      };
      localStorage.setItem('residence_blue_auth_session', JSON.stringify(session));
    });

    await page.goto('/restaurant');
    await expect(page.locator('[data-testid="btn-manage-menu"]')).toBeVisible();
  });

  test('Protection injection de formules (CSV / Excel Injection) : =, +, -, @ neutralisés', () => {
    const service = createService();

    // Formules malveillantes classiques
    const formulaPayloads = [
      '=cmd|\'/C calc\'!A0',
      '+1+2',
      '-SUM(A1:A10)',
      '@SUM(1,2)',
      '=2+5'
    ];

    for (const payload of formulaPayloads) {
      const sanitized = service.sanitizeForCsv(payload);
      // Doit commencer par "' (apostrophe de neutralisation)
      expect(sanitized.startsWith("\"'")).toBe(true);
      expect(sanitized).toContain(payload);
    }

    // Chaîne normale sans caractère formule
    const normal = service.sanitizeForCsv('Thiéboudienne Royale');
    expect(normal).toBe('"Thiéboudienne Royale"');
    expect(normal.startsWith("\"'")).toBe(false);
  });

  test('Validation signature fichiers photo (Magic Bytes) : Rejet SVG, GIF, PDF et formats interdits', async () => {
    // 1. Fichier faux JPG contenant en réalité du SVG
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>';
    const fakeJpgWithSvg = new File([svgContent], 'image.jpg', { type: 'image/jpeg' });
    const resSvg = await validateImageFile(fakeJpgWithSvg);
    expect(resSvg.valid).toBe(false);
    expect(resSvg.error?.code).toBe('REJECTED_FORMAT');

    // 2. Fichier GIF
    const gifBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00]);
    const gifFile = new File([gifBytes], 'anim.gif', { type: 'image/gif' });
    const resGif = await validateImageFile(gifFile);
    expect(resGif.valid).toBe(false);
    expect(resGif.error?.code).toBe('REJECTED_FORMAT');

    // 3. Fichier PDF
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const pdfFile = new File([pdfBytes], 'menu.pdf', { type: 'application/pdf' });
    const resPdf = await validateImageFile(pdfFile);
    expect(resPdf.valid).toBe(false);
    expect(resPdf.error?.code).toBe('REJECTED_FORMAT');

    // 4. Vrai JPEG (signature FF D8 FF)
    const validJpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
    const validJpgFile = new File([validJpegBytes], 'photo.jpg', { type: 'image/jpeg' });
    const resValidJpg = await validateImageFile(validJpgFile);
    expect(resValidJpg.valid).toBe(true);

    // 5. Vrai PNG (signature 89 50 4E 47 0D 0A 1A 0A)
    const validPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const validPngFile = new File([validPngBytes], 'photo.png', { type: 'image/png' });
    const resValidPng = await validateImageFile(validPngFile);
    expect(resValidPng.valid).toBe(true);
  });

  test('Import CSV : Limites de sécurité 2 Mo et 500 lignes', () => {
    const service = createService();

    // 1. Fichier dépassant 2 Mo
    const bigFileReport = service.parseAndValidateCsv('Nom,Catégorie,Prix FCFA\nTest,Plats,5000', 3 * 1024 * 1024);
    expect(bigFileReport.success).toBe(false);
    expect(bigFileReport.rejectionReason).toContain('2 Mo');

    // 2. Fichier dépassant 500 lignes
    let manyLines = 'Nom,Catégorie,Prix FCFA\n';
    for (let i = 1; i <= 505; i++) {
      manyLines += `Plat ${i},Plats,5000\n`;
    }
    const tooManyLinesReport = service.parseAndValidateCsv(manyLines, 50000);
    expect(tooManyLinesReport.success).toBe(false);
    expect(tooManyLinesReport.rejectionReason).toContain('500 lignes');
  });
});
