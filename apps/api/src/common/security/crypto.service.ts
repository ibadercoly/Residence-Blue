import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService?: ConfigService) {
    const rawKey =
      this.configService?.get<string>('ENCRYPTION_MASTER_KEY') ||
      process.env.ENCRYPTION_MASTER_KEY ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    // S'assurer que la clé fait exactement 32 octets (256 bits)
    if (rawKey.length === 64) {
      this.key = Buffer.from(rawKey, 'hex');
    } else {
      this.key = crypto.createHash('sha256').update(rawKey).digest();
    }
  }

  /**
   * Chiffre une chaîne de caractères en AES-256-GCM.
   * Retourne une chaîne sous la forme : ivHex:authTagHex:encryptedDataHex
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    // IV de 12 octets recommandé pour AES-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Déchiffre une chaîne chiffrée en AES-256-GCM en validant l'intégrité de l'Auth Tag.
   * Lève une exception si les données ont été altérées.
   */
  decrypt(cipherPayload: string): string {
    if (!cipherPayload) {
      return '';
    }

    const parts = cipherPayload.split(':');
    if (parts.length !== 3) {
      throw new Error('Format de charge chiffrée invalide. Attendu: iv:authTag:ciphertext');
    }

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
