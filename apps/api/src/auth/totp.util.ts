import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(byteLength = 20): string {
  return base32Encode(crypto.randomBytes(byteLength));
}

export function buildOtpAuthUri(
  secret: string,
  accountEmail: string,
  issuer = 'Résidence Blue',
): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountEmail);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

export function computeHotp(secret: string, counter: number, digits = 6): string {
  const key = base32Decode(secret);
  const msg = Buffer.alloc(8);
  let tmp = counter;
  for (let i = 7; i >= 0; i--) {
    msg[i] = tmp & 0xff;
    tmp = Math.floor(tmp / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

export function generateTotpCode(secret: string, nowMs = Date.now(), stepSeconds = 30): string {
  const counter = Math.floor(nowMs / 1000 / stepSeconds);
  return computeHotp(secret, counter, 6);
}

export function verifyTotpCode(
  secret: string,
  code: string,
  nowMs = Date.now(),
  windowSteps = 1,
): boolean {
  const cleanCode = (code || '').trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) {
    return false;
  }

  const baseCounter = Math.floor(nowMs / 1000 / 30);
  const expectedBuf = Buffer.from(cleanCode, 'utf8');

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const candidate = computeHotp(secret, baseCounter + offset, 6);
    const candidateBuf = Buffer.from(candidate, 'utf8');
    if (
      candidateBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(candidateBuf, expectedBuf)
    ) {
      return true;
    }
  }
  return false;
}

export interface StoredBackupCode {
  hash: string;
  usedAt: string | null;
}

export function generateBackupCodes(count = 8): {
  plainCodes: string[];
  storedCodes: StoredBackupCode[];
} {
  const plainCodes: string[] = [];
  const storedCodes: StoredBackupCode[] = [];
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let i = 0; i < count; i++) {
    const bytes = crypto.randomBytes(8);
    let raw = '';
    for (let j = 0; j < 8; j++) {
      raw += chars[bytes[j] % chars.length];
    }
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plainCodes.push(formatted);
    storedCodes.push({
      hash: hashBackupCode(formatted),
      usedAt: null,
    });
  }

  return { plainCodes, storedCodes };
}

export function hashBackupCode(code: string): string {
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

export function consumeBackupCode(
  storedCodes: StoredBackupCode[] | null | undefined,
  submittedCode: string,
): { matched: boolean; updatedCodes: StoredBackupCode[] } {
  if (!Array.isArray(storedCodes) || storedCodes.length === 0) {
    return { matched: false, updatedCodes: [] };
  }
  const submittedHash = hashBackupCode(submittedCode);
  const submittedBuf = Buffer.from(submittedHash, 'utf8');
  let matched = false;

  const updatedCodes = storedCodes.map((entry) => {
    if (!matched && !entry.usedAt && entry.hash) {
      const entryBuf = Buffer.from(entry.hash, 'utf8');
      if (
        entryBuf.length === submittedBuf.length &&
        crypto.timingSafeEqual(entryBuf, submittedBuf)
      ) {
        matched = true;
        return { ...entry, usedAt: new Date().toISOString() };
      }
    }
    return entry;
  });

  return { matched, updatedCodes };
}
