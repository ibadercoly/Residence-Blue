import { APIRequestContext, Page, expect } from '@playwright/test';
import { execE2eNodeScript } from './e2e-db.helper';

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
  await page.waitForURL('**/tableau-de-bord', { timeout: 25000 });
  await expect(page).toHaveURL(/tableau-de-bord/);
}

/**
 * Crée un utilisateur E2E éphémère en base (totpEnabled=false initial) pour tester DIRECTION/COMPTABLE sans polluer les comptes seedés.
 */
export function createE2eUser(
  role: 'DIRECTION' | 'COMPTABLE' | 'RECEPTION' | 'RESTAURANT' | 'SERVEUR' | 'CUISINE' | 'CUISINIER' = 'DIRECTION',
): { email: string; password: string } {
  const email = `e2e.${role.toLowerCase()}.${Date.now()}.${Math.floor(Math.random() * 10000)}@residenceblue.sn`;
  const password = 'E2eStrongPass2026!';
  const script = `
    const argon2 = require('argon2');
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    (async () => {
      const hash = await argon2.hash(${JSON.stringify(password)}, {
        type: argon2.argon2id,
        memoryCost: 19456,
        timeCost: 2,
        parallelism: 1,
      });
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
  execE2eNodeScript(script);
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
  execE2eNodeScript(script);
}
