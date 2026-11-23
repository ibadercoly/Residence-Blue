import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import request from 'supertest';

const MISSING_KEY_MESSAGE =
  'Clé de chiffrement manquante : l’application ne démarre pas pour protéger les pièces d’identité';

describe('Lot 1 — vérifications avec Prisma et la base de test réelle (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication | undefined;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;

  async function createRealApp(): Promise<INestApplication> {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl || new URL(databaseUrl).pathname !== '/residence_blue_e2e') {
      throw new Error('Ce contrôle exige exclusivement la base residence_blue_e2e.');
    }

    const { ValidationPipe } = await import('@nestjs/common');
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../src/app.module');

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const nestApp = moduleFixture.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nestApp.init();
    return nestApp;
  }

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    process.env.NODE_ENV = originalNodeEnv ?? 'test';
    if (originalMasterKey === undefined) {
      delete process.env.ENCRYPTION_MASTER_KEY;
    } else {
      process.env.ENCRYPTION_MASTER_KEY = originalMasterKey;
    }
  });

  it('refuse réellement le démarrage en production sans clé de chiffrement', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_MASTER_KEY = '';

    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../src/app.module');

    await expect(Test.createTestingModule({ imports: [AppModule] }).compile()).rejects.toThrow(
      MISSING_KEY_MESSAGE,
    );
  });

  it('répond 404 en production sans remplacer PrismaService', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_MASTER_KEY = crypto.randomBytes(32).toString('hex');
    app = await createRealApp();

    await request(app.getHttpServer()).get('/api/security-test/public-ping').expect(404);
    await request(app.getHttpServer())
      .post('/api/security-test/strict-validation')
      .send({})
      .expect(404);
    await request(app.getHttpServer()).get('/api/users').expect(404);
    const id = '00000000-0000-4000-8000-000000000123';
    await request(app.getHttpServer()).get(`/api/users/${id}`).expect(404);
    await request(app.getHttpServer())
      .post('/api/users')
      .send({ email: 'legacy@residenceblue.sn' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/users/${id}`)
      .send({ fullName: 'Ancienne route' })
      .expect(404);
    await request(app.getHttpServer()).delete(`/api/users/${id}`).expect(404);
  });
});
