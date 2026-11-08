import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service de chiffrement AES-256-GCM pour les données sensibles (pièces d'identité).
 *
 * Exigences (feature/base-securisee) :
 * - Algorithme : AES-256-GCM
 * - Clé issue des variables d'environnement (ENCRYPTION_MASTER_KEY / ENCRYPTION_KEYS)
 * - Identifiant de clé (keyId) stocké avec le chiffré pour supporter la rotation de clés
 * - IV aléatoire de 12 octets généré pour chaque valeur
 * - Format du chiffré : keyId:ivHex:authTagHex:encryptedHex
 * - Toute modification du keyId, de l'IV, du tag ou du chiffré lève une exception.
 */
@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private activeKeyId: string;
  private readonly keyRing: Map<string, Buffer> = new Map();

  constructor(private readonly configService?: ConfigService) {
    this.activeKeyId =
      this.configService?.get<string>('ENCRYPTION_KEY_ID') ||
      process.env.ENCRYPTION_KEY_ID ||
      'v1';

    const rawMasterKey =
      this.configService?.get<string>('ENCRYPTION_MASTER_KEY') ||
      process.env.ENCRYPTION_MASTER_KEY ||
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    this.keyRing.set(this.activeKeyId, this.deriveKeyBuffer(rawMasterKey));

    // Support de la rotation de clés via ENCRYPTION_KEYS (format: "v1:hexKey1,v2:hexKey2")
    const additionalKeys =
      this.configService?.get<string>('ENCRYPTION_KEYS') ||
      process.env.ENCRYPTION_KEYS ||
      '';

    if (additionalKeys.trim().length > 0) {
      for (const entry of additionalKeys.split(',')) {
        const [id, rawKey] = entry.split(':').map((s) => s.trim());
        if (id && rawKey) {
          this.keyRing.set(id, this.deriveKeyBuffer(rawKey));
        }
      }
    }
  }

  private deriveKeyBuffer(rawKey: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  /**
   * Permet d'enregistrer une nouvelle clé et de la définir optionnellement comme clé active (rotation).
   */
  registerKey(keyId: string, rawKey: string, makeActive = false): void {
    if (!keyId || !rawKey) {
      throw new Error('Identifiant de clé et matériel cryptographique requis.');
    }
    this.keyRing.set(keyId, this.deriveKeyBuffer(rawKey));
    if (makeActive) {
      this.activeKeyId = keyId;
    }
  }

  getActiveKeyId(): string {
    return this.activeKeyId;
  }

  /**
   * Chiffre une chaîne de caractères en AES-256-GCM.
   * Retourne : keyId:ivHex:authTagHex:encryptedDataHex
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return '';
    }

    const key = this.keyRing.get(this.activeKeyId);
    if (!key) {
      throw new Error(`Clé de chiffrement active introuvable : ${this.activeKeyId}`);
    }

    // IV aléatoire de 12 octets (96 bits) par valeur
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv, {
      authTagLength: 16,
    });

    // On lie l'identifiant de clé dans les données authentifiées additionnelles (AAD)
    // afin que toute modification du keyId soit rejetée par GCM
    cipher.setAAD(Buffer.from(this.activeKeyId, 'utf8'));

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${this.activeKeyId}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Déchiffre une chaîne chiffrée en AES-256-GCM en validant l'intégrité du tag GCM et du keyId.
   * Lève une exception si une quelconque partie de la valeur a été modifiée.
   */
  decrypt(cipherPayload: string): string {
    if (!cipherPayload) {
      return '';
    }

    const parts = cipherPayload.split(':');
    if (parts.length !== 4) {
      throw new Error(
        'Format de charge chiffrée invalide. Attendu: keyId:iv:authTag:ciphertext',
      );
    }

    const [keyId, ivHex, authTagHex, encryptedHex] = parts;

    if (!keyId || !ivHex || !authTagHex || !encryptedHex) {
      throw new Error('Charge chiffrée incomplète ou corrompue.');
    }

    const key = this.keyRing.get(keyId);
    if (!key) {
      throw new Error(`Identifiant de clé inconnu ou révoqué : ${keyId}`);
    }

    if (ivHex.length !== 24 || !/^[0-9a-fA-F]+$/.test(ivHex)) {
      throw new Error('IV invalide ou altéré.');
    }

    if (authTagHex.length !== 32 || !/^[0-9a-fA-F]+$/.test(authTagHex)) {
      throw new Error('Tag d’authentification invalide ou altéré.');
    }

    if (encryptedHex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(encryptedHex)) {
      throw new Error('Texte chiffré invalide ou altéré.');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv, {
      authTagLength: 16,
    });
    decipher.setAAD(Buffer.from(keyId, 'utf8'));
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}
