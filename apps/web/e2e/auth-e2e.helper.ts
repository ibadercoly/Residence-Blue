import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import * as path from 'path';
import { APIRequestContext, Page, expect } from '@playwright/test';

const repoRoot = path.resolve(__dirname, '../../..');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
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

export function generateTotpCode(secret: string): string {
  const key = base32Decode(secret);
  let counter = Math.floor(Date.now() / 1000 / 30);
  const msg = Buffer.alloc(8);
  for (let i = 7; i >= 0; i--) {
    msg[i] = counter & 0xff;
    counter = Math.floor(counter / 256);
  }
  const hmac = crypto.createHmac('sha1', key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 1_000_000).toString().padStart(6, '0');
}

const knownSecrets = new Map<string, string>();

/**
 * Authentifie un appel API Playwright avec un vrai JWT signé (sans x-user-role).
 */
export async function getApiAuthHeaders(
  request: APIRequestContext,
  email = 'fatou.ndiaye@residenceblue.sn',
  password = 'ThiesTeranga2024!',
): Promise<Record<string, string>> {
  const res = await request.post('/api/auth/login', {
    data: { login: email, password },
  });
  const body = await res.json();

  if (body?.status === 'AUTHENTICATED' && body?.accessToken) {
    return { Authorization: `Bearer ${body.accessToken}` };
  }

  if (body?.status === 'MFA_SETUP_REQUIRED') {
    const secret = body.totpSetup.secret as string;
    knownSecrets.set(email.toLowerCase(), secret);
    const code = generateTotpCode(secret);
    const setupRes = await request.post('/api/auth/login/totp-setup', {
      data: { mfaToken: body.mfaToken, code },
    });
    const setupBody = await setupRes.json();
    return { Authorization: `Bearer ${setupBody.accessToken}` };
  }

  if (body?.status === 'MFA_REQUIRED') {
    const secret = knownSecrets.get(email.toLowerCase());
    if (!secret) {
      throw new Error(
        `Secret TOTP inconnu pour ${email}. Utilisez un compte sans 2FA (ex. fatou.ndiaye@residenceblue.sn) ou initialisez le secret dans ce test.`,
      );
    }
    const verifyRes = await request.post('/api/auth/login/totp', {
      data: { mfaToken: body.mfaToken, code: generateTotpCode(secret) },
    });
    const verifyBody = await verifyRes.json();
    return { Authorization: `Bearer ${verifyBody.accessToken}` };
  }

  throw new Error(`Échec login API E2E (${res.status()}): ${JSON.stringify(body)}`);
}

/**
 * Connecte un navigateur Playwright via /connexion (sans cookie/localStorage falsifié).
 */
export async function loginViaUi(
  page: Page,
  email = 'fatou.ndiaye@residenceblue.sn',
  password = 'ThiesTeranga2024!',
): Promise<void> {
  await page.goto('/connexion');
  await page.locator('#user-login').fill(email);
  await page.locator('#user-password').fill(password);
  await page.locator('#login-btn').click();

  await page.waitForURL('**/tableau-de-bord', { timeout: 10000 }).catch(async () => {
    const setupForm = page.getByTestId('mfa-setup-form');
    if (await setupForm.isVisible().catch(() => false)) {
      const secret = (await page.getByTestId('totp-secret-display').innerText()).trim();
      knownSecrets.set(email.toLowerCase(), secret);
      await page.locator('#totp-setup-code-input').fill(generateTotpCode(secret));
      await page.locator('#confirm-totp-setup-btn').click();
      await page.locator('#continue-after-backup-btn').click();
      await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });
      return;
    }

    const verifyForm = page.getByTestId('mfa-verify-form');
    if (await verifyForm.isVisible().catch(() => false)) {
      const secret = knownSecrets.get(email.toLowerCase());
      if (!secret) throw new Error(`Secret TOTP inconnu dans le test UI pour ${email}`);
      await page.locator('#totp-code-input').fill(generateTotpCode(secret));
      await page.locator('#verify-totp-btn').click();
      await page.waitForURL('**/tableau-de-bord', { timeout: 10000 });
    }
  });

  await expect(page).toHaveURL(/tableau-de-bord/);
}

/**
 * Crée un utilisateur E2E éphémère en base (totpEnabled=false initial) pour tester DIRECTION/COMPTABLE sans polluer les comptes seedés.
 */
export function createE2eUser(
  role: 'DIRECTION' | 'COMPTABLE' | 'RECEPTION' | 'RESTAURANT' | 'SERVEUR' | 'CUISINE' = 'DIRECTION',
): { email: string; password: string } {
  const email = `e2e.${role.toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 10000)}@residenceblue.sn`;
  const password = 'E2eStrongPass2026!';
  const script = `
    const argon2 = require('argon2');
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const hash = await argon2.hash(${JSON.stringify(password)}, { type: argon2.argon2id });
      await p.user.create({
        data: {
          email: ${JSON.stringify(email)},
          fullName: 'E2E Testeur',
          jobTitle: 'Test E2E',
          role: ${JSON.stringify(role)},
          isActive: true,
          passwordHash: hash,
          totpEnabled: false,
        },
      });
      await p.$disconnect();
    })();
  `;
  execFileSync('node', ['--env-file=.env', '-e', script], { cwd: repoRoot, encoding: 'utf8' });
  return { email, password };
}

export function deleteE2eUsers(emails: string[]): void {
  const valid = emails.filter(Boolean);
  if (valid.length === 0) return;
  const script = `
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const users = await p.user.findMany({ where: { email: { in: ${JSON.stringify(valid)} } }, select: { id: true } });
      const ids = users.map((u) => u.id);
      if (ids.length > 0) {
        await p.refreshToken.deleteMany({ where: { userId: { in: ids } } });
        for (const id of ids) {
          const auditCount = await p.auditLog.count({ where: { userId: id } });
          if (auditCount === 0) {
            await p.user.delete({ where: { id } }).catch(() => {});
          } else {
            await p.user.update({ where: { id }, data: { isActive: false } });
          }
        }
      }
      await p.$disconnect();
    })();
  `;
  execFileSync('node', ['--env-file=.env', '-e', script], { cwd: repoRoot, encoding: 'utf8' });
}
