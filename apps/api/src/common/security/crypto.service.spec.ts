import { CryptoService } from './crypto.service';

describe('CryptoService - Chiffrement AES-256-GCM avec rotation de clés', () => {
  let service: CryptoService;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY_ID = 'v1';
    process.env.ENCRYPTION_MASTER_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.ENCRYPTION_KEYS = '';
    service = new CryptoService();
  });

  it('doit chiffrer et déchiffrer avec succès en stockant keyId:iv:authTag:ciphertext', () => {
    const passportNumber = 'A12345678-SN';
    const encrypted = service.encrypt(passportNumber);

    expect(encrypted).toBeDefined();
    expect(encrypted).not.toBe(passportNumber);

    const parts = encrypted.split(':');
    expect(parts.length).toBe(4); // keyId, iv, authTag, ciphertext
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toHaveLength(24); // IV de 12 octets en hex

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(passportNumber);
  });

  it('doit générer un IV aléatoire différent à chaque chiffrement de la même valeur', () => {
    const idNumber = 'CNI-SN-1990-001122';
    const enc1 = service.encrypt(idNumber);
    const enc2 = service.encrypt(idNumber);

    expect(enc1).not.toBe(enc2);
    expect(enc1.split(':')[1]).not.toBe(enc2.split(':')[1]);
    expect(service.decrypt(enc1)).toBe(idNumber);
    expect(service.decrypt(enc2)).toBe(idNumber);
  });

  it('doit supporter la rotation de clés (déchiffrer v1 tout en chiffrant les nouvelles valeurs avec v2)', () => {
    const oldData = 'PASSPORT-OLD-KEY-V1';
    const encryptedWithV1 = service.encrypt(oldData);
    expect(encryptedWithV1.startsWith('v1:')).toBe(true);

    // Rotation vers une nouvelle clé v2
    service.registerKey(
      'v2',
      'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
      true,
    );
    expect(service.getActiveKeyId()).toBe('v2');

    const newData = 'PASSPORT-NEW-KEY-V2';
    const encryptedWithV2 = service.encrypt(newData);
    expect(encryptedWithV2.startsWith('v2:')).toBe(true);

    // Les deux valeurs (v1 et v2) doivent être déchiffrables sans perte
    expect(service.decrypt(encryptedWithV1)).toBe(oldData);
    expect(service.decrypt(encryptedWithV2)).toBe(newData);
  });

  it('doit rejeter une valeur si le tag d’authentification est altéré', () => {
    const sensitiveData = 'CNI-1234567890';
    const encrypted = service.encrypt(sensitiveData);
    const [keyId, iv, authTag, cipher] = encrypted.split(':');

    const tamperedAuthTag = authTag.replace(/^[0-9a-f]/, (c) => (c === 'a' ? 'b' : 'a'));
    const tamperedPayload = `${keyId}:${iv}:${tamperedAuthTag}:${cipher}`;

    expect(() => service.decrypt(tamperedPayload)).toThrow();
  });

  it('doit rejeter une valeur si le texte chiffré est altéré', () => {
    const sensitiveData = 'CNI-9876543210';
    const encrypted = service.encrypt(sensitiveData);
    const [keyId, iv, authTag, cipher] = encrypted.split(':');

    const tamperedCipher = cipher.replace(/^[0-9a-f]/, (c) => (c === '0' ? '1' : '0'));
    const tamperedPayload = `${keyId}:${iv}:${authTag}:${tamperedCipher}`;

    expect(() => service.decrypt(tamperedPayload)).toThrow();
  });

  it('doit rejeter une valeur si l’IV ou le keyId est modifié', () => {
    const sensitiveData = 'CNI-5555666677';
    const encrypted = service.encrypt(sensitiveData);
    const [keyId, iv, authTag, cipher] = encrypted.split(':');

    const tamperedIv = iv.replace(/^[0-9a-f]/, (c) => (c === '0' ? '1' : '0'));
    expect(() => service.decrypt(`${keyId}:${tamperedIv}:${authTag}:${cipher}`)).toThrow();

    // Même si une clé v2 existe, remplacer keyId dans le payload échoue grâce à l'AAD et à la clé différente
    service.registerKey(
      'v2',
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      false,
    );
    expect(() => service.decrypt(`v2:${iv}:${authTag}:${cipher}`)).toThrow();
    expect(() => service.decrypt(`unknown_key:${iv}:${authTag}:${cipher}`)).toThrow();
  });
});
