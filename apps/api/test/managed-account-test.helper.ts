import { INestApplication } from '@nestjs/common';
import { resolveDefaultAccessForRole } from '@residence-blue/shared';
import request from 'supertest';

export interface ManagedAccountForTestOptions {
  email: string;
  fullName: string;
  role: string;
  newPassword?: string;
}

export interface ManagedAccountForTest {
  id: string;
  email: string;
  provisionalPassword: string;
  provisionalAccessToken: string;
}

/**
 * Crée un compte uniquement via la route canonique /administration/comptes.
 * Le mot de passe provisoire est changé quand newPassword est fourni, afin que
 * les tests d'authentification puissent ensuite se connecter normalement.
 */
export async function createManagedAccountForTest(
  app: INestApplication,
  directorToken: string,
  options: ManagedAccountForTestOptions,
): Promise<ManagedAccountForTest> {
  const defaults = resolveDefaultAccessForRole(options.role);
  const created = await request(app.getHttpServer())
    .post('/api/administration/comptes')
    .set('Authorization', `Bearer ${directorToken}`)
    .send({
      fullName: options.fullName,
      email: options.email,
      starterProfile: defaults.starterProfile,
      screenAccess: defaults.screenAccess,
      specialPermissions: defaults.specialPermissions,
    })
    .expect(201);

  const id = created.body.account.id as string;
  const provisionalPassword = created.body.provisionalPassword as string;
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ login: options.email, password: provisionalPassword })
    .expect(200);
  const provisionalAccessToken = login.body.accessToken as string;

  if (options.newPassword) {
    await request(app.getHttpServer())
      .post('/api/auth/change-initial-password')
      .set('Authorization', `Bearer ${provisionalAccessToken}`)
      .send({ newPassword: options.newPassword })
      .expect(200);
  }

  return { id, email: options.email, provisionalPassword, provisionalAccessToken };
}
