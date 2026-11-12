import * as crypto from 'crypto';
import * as argon2 from 'argon2';

const MIN_PASSWORD_LENGTH = 10;

const COMMON_PASSWORDS = new Set([
  '1234567890',
  '12345678901',
  '123456789012',
  '0987654321',
  'password12',
  'password123',
  'password1234',
  'motdepasse',
  'motdepasse1',
  'motdepasse12',
  'motdepasse123',
  'azertyuiop',
  'azerty1234',
  'qwertyuiop',
  'qwerty1234',
  'admin12345',
  'administrateur',
  'administrator',
  'residenceblue',
  'residence123',
  'residence2024',
  'residence2025',
  'residence2026',
  'thies12345',
  'senegal123',
  'hotel12345',
  'teranga123',
  'welcome123',
  'bienvenue1',
  'letmein123',
  'iloveyou12',
  'changeme12',
  'pass123456',
]);

export function validatePasswordPolicy(password: string): {
  valid: boolean;
  reason?: string;
} {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      reason: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      reason: 'Ce mot de passe est trop courant. Veuillez en choisir un plus robuste.',
    };
  }

  // Rejeter les mots de passe constitués d'un seul caractère répété (ex. "aaaaaaaaaa")
  if (new Set(normalized).size < 4) {
    return {
      valid: false,
      reason: 'Ce mot de passe est trop prévisible (trop peu de caractères distincts).',
    };
  }

  // Rejeter les séquences triviales purement alphanumériques type "abcdefghij" ou "0123456789"
  if ('01234567890'.includes(normalized) || 'abcdefghijklmnopqrstuvwxyz'.includes(normalized)) {
    return {
      valid: false,
      reason: 'Ce mot de passe est une suite trop simple. Choisissez un mot de passe plus sûr.',
    };
  }

  return { valid: true };
}

/**
 * Hache un mot de passe en Argon2id (OWASP baseline : 19 MiB, 2 itérations, parallélisme 1).
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  }
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

/**
 * Vérifie un mot de passe en temps constant contre argon2id (ou scrypt historique).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash) return false;

  if (storedHash.startsWith('$argon2')) {
    try {
      return await argon2.verify(storedHash, password);
    } catch {
      return false;
    }
  }

  // Compatibilité descendante lecture seule pour anciens hachages $scrypt$ avant ré-encodage
  const parts = storedHash.split('$');
  if (parts.length !== 4 || parts[1] !== 'scrypt') {
    return false;
  }

  const [, , salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;

  const derived = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expected.length) return false;

  return crypto.timingSafeEqual(derived, expected);
}

export function isValidPasswordHash(storedHash: string | null | undefined): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  return storedHash.startsWith('$argon2id$') || /^\$scrypt\$[^$]+\$[0-9a-f]{128}$/.test(storedHash);
}

export function isArgon2idHash(storedHash: string | null | undefined): boolean {
  return typeof storedHash === 'string' && storedHash.startsWith('$argon2id$');
}
