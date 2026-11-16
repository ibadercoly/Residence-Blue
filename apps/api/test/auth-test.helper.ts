import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { signJwt, ACCESS_TOKEN_TTL_SECONDS } from '../src/auth/jwt.util';
import { hashPassword } from '../src/auth/password-hash.util';

/**
 * Crée un jeton d'accès signé pour les tests unitaires sans DB (mocks Prisma).
 */
export function signMockTestToken(
  role: string,
  userId = '00000000-0000-4000-8000-000000000001',
  fullName?: string,
): string {
  return signJwt(
    {
      sub: userId,
      email: `${role.toLowerCase()}@test.residenceblue.sn`,
      fullName: fullName || `Testeur ${role}`,
      role,
      sid: '00000000-0000-4000-8000-000000000099',
      jti: crypto.randomUUID(),
      type: 'access',
    },
    ACCESS_TOKEN_TTL_SECONDS,
  );
}

/**
 * Garantit un utilisateur actif et une session RefreshToken valide en base PostgreSQL
 * et retourne un en-tête Authorization Bearer <JWT> authentique (aucun contournement).
 */
export async function issueDbTestToken(
  prisma: PrismaClient,
  role: string,
  options?: { email?: string; fullName?: string },
): Promise<{ token: string; userId: string; familyId: string }> {
  const email = (options?.email || `test.${role.toLowerCase()}@residenceblue.sn`).toLowerCase();
  const fullName = options?.fullName || `Test ${role}`;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const pwdHash = await hashPassword('TestSecure2026!');
    user = await prisma.user.create({
      data: {
        email,
        fullName,
        role: role as any,
        isActive: true,
        passwordHash: pwdHash,
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        role: role as any,
        deletedAt: null,
        mustChangePassword: false,
        screenAccess: null as any,
        specialPermissions: null as any,
        starterProfile: null,
      },
    });
  }

  const familyId = crypto.randomUUID();
  const tokenHash = crypto
    .createHash('sha256')
    .update(crypto.randomBytes(32).toString('hex'))
    .digest('hex');

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      familyId,
      deviceLabel: 'Jest Integration Test',
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  const token = signJwt(
    {
      sub: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      sid: familyId,
      jti: crypto.randomUUID(),
      type: 'access',
    },
    ACCESS_TOKEN_TTL_SECONDS,
  );

  return { token, userId: user.id, familyId };
}
