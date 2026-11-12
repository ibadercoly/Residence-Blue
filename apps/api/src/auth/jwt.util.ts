import * as crypto from 'crypto';

export type JwtTokenType = 'access' | 'mfa_pending' | 'mfa_setup';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  fullName: string;
  role: string;
  sid: string;
  jti: string;
  type: 'access';
  iat: number;
  exp: number;
}

export interface MfaTokenPayload {
  sub: string;
  email: string;
  role: string;
  stayConnected8h?: boolean;
  type: 'mfa_pending' | 'mfa_setup';
  iat: number;
  exp: number;
}

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const MFA_TOKEN_TTL_SECONDS = 10 * 60; // 10 minutes
export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
export const REFRESH_COOKIE_NAME = 'rb_refresh_token';

function encodeBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function decodeBase64Url(input: string): string {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

export function getJwtSigningSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      'Configuration sécurité manquante : JWT_SECRET doit être défini (au moins 16 caractères).',
    );
  }
  return secret;
}

export function signJwt(
  claims: Record<string, unknown>,
  ttlSeconds: number,
  secretOverride?: string,
): string {
  const secret = secretOverride || getJwtSigningSecret();
  const header = encodeBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = encodeBase64Url(
    JSON.stringify({
      ...claims,
      iat: nowSec,
      exp: nowSec + ttlSeconds,
    }),
  );
  const signature = encodeBase64Url(
    crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

export function verifyJwt<T extends { exp?: number; type?: string }>(
  token: string,
  expectedType: JwtTokenType,
  secretOverride?: string,
): T | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, sigB64] = parts;
  if (!headerB64 || !payloadB64 || !sigB64) return null;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(decodeBase64Url(headerB64));
  } catch {
    return null;
  }

  if (header.alg !== 'HS256' || header.typ !== 'JWT') {
    return null;
  }

  let secret: string;
  try {
    secret = secretOverride || getJwtSigningSecret();
  } catch {
    return null;
  }

  const expectedSig = encodeBase64Url(
    crypto.createHmac('sha256', secret).update(`${headerB64}.${payloadB64}`).digest(),
  );

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const providedBuf = Buffer.from(sigB64, 'utf8');
  if (
    expectedBuf.length !== providedBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, providedBuf)
  ) {
    return null;
  }

  let parsed: T;
  try {
    parsed = JSON.parse(decodeBase64Url(payloadB64));
  } catch {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof parsed.exp !== 'number' || parsed.exp <= nowSec) {
    return null;
  }

  if (parsed.type !== expectedType) {
    return null;
  }

  return parsed;
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}
