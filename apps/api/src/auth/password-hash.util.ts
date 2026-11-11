import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Hachage cryptographique de mot de passe via scrypt (Node.js natif).
 * Format stocké : $scrypt$N$r$p$<salt_hex>$<hash_hex>
 * Ne stocke jamais un mot de passe en clair.
 */
export function hashPassword(plainPassword: string): string {
  if (!plainPassword || plainPassword.length < 4) {
    throw new Error('Le mot de passe doit contenir au moins 4 caractères.');
  }
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, 64, { N: 16384, r: 8, p: 1 });
  return `$scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Vérifie un mot de passe en clair contre une empreinte hachée en temps constant.
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  if (!plainPassword || !storedHash) return false;

  if (storedHash.startsWith('$scrypt$')) {
    const parts = storedHash.split('$');
    // ['', 'scrypt', '16384', '8', '1', saltHex, hashHex]
    if (parts.length !== 7) return false;
    const N = Number(parts[2]) || 16384;
    const r = Number(parts[3]) || 8;
    const p = Number(parts[4]) || 1;
    const salt = parts[5];
    const hashHex = parts[6];
    try {
      const expected = Buffer.from(hashHex, 'hex');
      const actual = scryptSync(plainPassword, salt, expected.length, { N, r, p });
      if (expected.length !== actual.length) return false;
      return timingSafeEqual(expected, actual);
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Vérifie qu'une chaîne correspond bien à une empreinte cryptographique hachée
 * (scrypt, bcrypt ou argon2) et non à un mot de passe en clair.
 */
export function isValidPasswordHash(storedHash: string | null | undefined): boolean {
  if (!storedHash || typeof storedHash !== 'string') return false;
  return (
    /^\$scrypt\$\d+\$\d+\$\d+\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(storedHash) ||
    /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(storedHash) ||
    /^\$argon2(id|i|d)\$/.test(storedHash)
  );
}
