import { CryptoService } from '../src/common/security/crypto.service';

describe('CryptoService - Chiffrement AES-256-GCM', () => {
  let service: CryptoService;

  beforeEach(() => {
    service = new CryptoService();
  });

  it('doit chiffrer et déchiffrer avec succès un passeport ou pièce d’identité', () => {
    const passportNumber = 'A12345678-SN';
    const encrypted = service.encrypt(passportNumber);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(passportNumber);

    const parts = encrypted.split(':');
    expect(parts.length).toBe(3); // iv, authTag, ciphertext

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(passportNumber);
  });

  it('doit échouer au déchiffrement si le tag d’authentification est altéré (tamper resistance)', () => {
    const sensitiveData = 'CNI-1234567890';
    const encrypted = service.encrypt(sensitiveData);
    const parts = encrypted.split(':');

    // Altération d'un caractère de l'authTag
    const tamperedAuthTag = parts[1].replace(/^[0-9a-f]/, (c) => (c === 'a' ? 'b' : 'a'));
    const tamperedPayload = `${parts[0]}:${tamperedAuthTag}:${parts[2]}`;

    expect(() => service.decrypt(tamperedPayload)).toThrow();
  });

  it('doit échouer au déchiffrement si le texte chiffré est altéré', () => {
    const sensitiveData = 'CNI-9876543210';
    const encrypted = service.encrypt(sensitiveData);
    const parts = encrypted.split(':');

    // Altération du ciphertext
    const tamperedCipher = parts[2].replace(/^[0-9a-f]/, (c) => (c === '0' ? '1' : '0'));
    const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

    expect(() => service.decrypt(tamperedPayload)).toThrow();
  });
});
