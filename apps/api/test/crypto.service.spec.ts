import { CryptoService } from '../src/common/security/crypto.service';

describe('CryptoService - Chiffrement AES-256-GCM (Integration Suite)', () => {
  let service: CryptoService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY_ID = 'v1';
    process.env.ENCRYPTION_MASTER_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    service = new CryptoService();
  });

  it('doit chiffrer et déchiffrer avec succès un passeport avec identifiant de clé (keyId:iv:authTag:ciphertext)', () => {
    const passportNumber = 'A12345678-SN';
    const encrypted = service.encrypt(passportNumber);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(passportNumber);

    const parts = encrypted.split(':');
    expect(parts.length).toBe(4);
    expect(parts[0]).toBe('v1');

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(passportNumber);
  });

  it('doit échouer au déchiffrement si le tag d’authentification ou le texte chiffré est altéré', () => {
    const sensitiveData = 'CNI-1234567890';
    const encrypted = service.encrypt(sensitiveData);
    const [keyId, iv, authTag, cipher] = encrypted.split(':');

    const tamperedAuthTag = authTag.replace(/^[0-9a-f]/, (c) => (c === 'a' ? 'b' : 'a'));
    expect(() => service.decrypt(`${keyId}:${iv}:${tamperedAuthTag}:${cipher}`)).toThrow();

    const tamperedCipher = cipher.replace(/^[0-9a-f]/, (c) => (c === '0' ? '1' : '0'));
    expect(() => service.decrypt(`${keyId}:${iv}:${authTag}:${tamperedCipher}`)).toThrow();
  });
});
