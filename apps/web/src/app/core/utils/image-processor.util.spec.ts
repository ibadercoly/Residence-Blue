import {
  detectMagicBytes,
  validateImageFile,
  MAX_FILE_SIZE_BYTES
} from './image-processor.util';

describe('ImageProcessorUtil', () => {
  describe('detectMagicBytes', () => {
    it('devrait identifier correctement une signature JPEG (FF D8 FF)', () => {
      const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      expect(detectMagicBytes(bytes)).toBe('jpeg');
    });

    it('devrait identifier correctement une signature PNG (89 50 4E 47 0D 0A 1A 0A)', () => {
      const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
      expect(detectMagicBytes(bytes)).toBe('png');
    });

    it('devrait identifier correctement une signature WebP (RIFF....WEBP)', () => {
      const bytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, // RIFF
        0x24, 0x00, 0x00, 0x00, // length
        0x57, 0x45, 0x42, 0x50  // WEBP
      ]);
      expect(detectMagicBytes(bytes)).toBe('webp');
    });

    it('devrait identifier et rejeter un format GIF (GIF87a / GIF89a)', () => {
      const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00]);
      expect(detectMagicBytes(bytes)).toBe('gif');
    });

    it('devrait identifier et rejeter un format PDF (%PDF)', () => {
      const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x0d, 0x0a, 0x25, 0xd0]);
      expect(detectMagicBytes(bytes)).toBe('pdf');
    });

    it('devrait identifier et rejeter un format SVG vectoriel', () => {
      const encoder = new TextEncoder();
      const svgText = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
      const bytes = encoder.encode(svgText);
      expect(detectMagicBytes(bytes)).toBe('svg');
    });
  });

  describe('validateImageFile', () => {
    it('devrait rejeter un fichier dépassant 8 Mo', async () => {
      const largeBlob = new Blob([new Uint8Array(MAX_FILE_SIZE_BYTES + 1024)]);
      const result = await validateImageFile(largeBlob);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('FILE_TOO_LARGE');
    });

    it('devrait rejeter un fichier SVG même avec une extension .jpg', async () => {
      const fakeJpgContent = '<svg><script>alert("xss")</script></svg>';
      const fakeJpg = new File([fakeJpgContent], 'plat_innocent.jpg', { type: 'image/jpeg' });
      const result = await validateImageFile(fakeJpg);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('REJECTED_FORMAT');
      expect(result.error?.message).toContain('SVG');
    });

    it('devrait rejeter un fichier PDF maquillé en PNG', async () => {
      const fakePngContent = '%PDF-1.4 malicious payload';
      const fakePng = new File([fakePngContent], 'photo.png', { type: 'image/png' });
      const result = await validateImageFile(fakePng);
      expect(result.valid).toBe(false);
      expect(result.error?.code).toBe('REJECTED_FORMAT');
      expect(result.error?.message).toContain('PDF');
    });

    it('devrait accepter un vrai fichier JPEG avec magic bytes FF D8 FF', async () => {
      const validJpgHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const validJpg = new File([validJpgHeader], 'thieboudienne.jpg', { type: 'image/jpeg' });
      const result = await validateImageFile(validJpg);
      expect(result.valid).toBe(true);
    });
  });
});
