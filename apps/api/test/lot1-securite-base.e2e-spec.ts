import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import * as crypto from 'crypto';
import request from 'supertest';
import { signMockTestToken } from './auth-test.helper';

const MISSING_KEY_MESSAGE =
  'Clé de chiffrement manquante : l’application ne démarre pas pour protéger les pièces d’identité';
const VALID_STRICT_PAYLOAD = {
  idempotencyKey: 'lot1-idem-uuid',
  amountFcfa: 45000,
  guestPassportNumber: 'SN-LOT1-TEST',
};

describe('Lot 1 — base de sécurité (e2e)', () => {
  jest.setTimeout(300_000);

  let app: INestApplication | undefined;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMasterKey = process.env.ENCRYPTION_MASTER_KEY;

  async function createFreshApp(): Promise<INestApplication> {
    // Toutes les classes Nest sont chargées depuis le même registre de modules :
    // AppModule recalcule ainsi ses contrôleurs selon NODE_ENV à chaque test.
    const { ValidationPipe } = await import('@nestjs/common');
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../src/app.module');
    const { PrismaService } = await import('../src/prisma/prisma.service');

    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => {},
        $disconnect: async () => {},
        $queryRaw: async () => [{ 1: 1 }],
      })
      .compile();

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

  it('expose security-test/public-ping et security-test/strict-validation en environnement de test', async () => {
    process.env.NODE_ENV = 'test';
    app = await createFreshApp();

    const ping = await request(app.getHttpServer())
      .get('/api/security-test/public-ping')
      .expect(200);
    expect(ping.body).toEqual({ status: 'ok', public: true });

    const validation = await request(app.getHttpServer())
      .post('/api/security-test/strict-validation')
      .send(VALID_STRICT_PAYLOAD)
      .expect(201);
    expect(validation.body.success).toBe(true);
    expect(validation.body.decryptedPassportMatch).toBe(true);
    expect(validation.body.encryptedPassport).not.toBe(VALID_STRICT_PAYLOAD.guestPassportNumber);
  });

  it('renvoie 404 sur security-test/* hors environnement de test', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_MASTER_KEY = crypto.randomBytes(32).toString('hex');
    app = await createFreshApp();

    await request(app.getHttpServer()).get('/api/security-test/public-ping').expect(404);
    await request(app.getHttpServer())
      .post('/api/security-test/strict-validation')
      .send(VALID_STRICT_PAYLOAD)
      .expect(404);
  });

  it('refuse de démarrer hors test sans ENCRYPTION_MASTER_KEY', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_MASTER_KEY = '';

    await expect(createFreshApp()).rejects.toThrow(MISSING_KEY_MESSAGE);
  });

  it('refuse de démarrer hors test avec une clé d’exemple', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_MASTER_KEY = '0'.repeat(64);

    await expect(createFreshApp()).rejects.toThrow(MISSING_KEY_MESSAGE);
  });

  it('renvoie 404 sur toutes les anciennes routes /users', async () => {
    process.env.NODE_ENV = 'test';
    app = await createFreshApp();
    const token = signMockTestToken('DIRECTION');
    const id = '00000000-0000-4000-8000-000000000123';

    await request(app.getHttpServer())
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .get(`/api/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'legacy@residenceblue.sn' })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Ancienne route' })
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/users/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
