import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const request: any = (supertest as any).default || supertest;

describe('Porte de Sécurité API (Security Gate Tests)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: async () => {},
        $disconnect: async () => {},
        $queryRaw: async () => [{ 1: 1 }],
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Accès refusé par défaut (Deny by default)', () => {
    it('doit bloquer l’accès (403 Forbidden) sur une route ne déclarant aucun rôle', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/security-test/undecorated-route')
        .expect(403);

      expect(response.body.message).toMatch(/Accès refusé par défaut/);
    });

    it('doit bloquer l’accès (403 Forbidden) sur une route ADMIN si aucun rôle n’est fourni', async () => {
      await request(app.getHttpServer())
        .get('/api/security-test/admin-only')
        .expect(403);
    });

    it('doit bloquer l’accès (403 Forbidden) sur une route ADMIN si un rôle non autorisé tente d’accéder', async () => {
      await request(app.getHttpServer())
        .get('/api/security-test/admin-only')
        .set('x-user-role', 'RECEPTIONIST')
        .expect(403);
    });

    it('doit autoriser l’accès (200 OK) sur une route ADMIN si le rôle ADMIN est présent', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/security-test/admin-only')
        .set('x-user-role', 'ADMIN')
        .expect(200);

      expect(response.body.message).toBe('Accès autorisé pour ADMIN.');
    });

    it('doit autoriser l’accès (200 OK) sur une route explicitement déclarée @Public()', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
    });
  });

  describe('2. Validation stricte des entrées (ValidationPipe whitelist + forbidNonWhitelisted)', () => {
    it('doit accepter une charge utile valide', async () => {
      const validPayload = {
        idempotencyKey: 'idem-uuid-001',
        amountFcfa: 45000,
        guestPassportNumber: 'SN-998877',
      };

      const response = await request(app.getHttpServer())
        .post('/api/security-test/strict-validation')
        .send(validPayload)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.decryptedPassportMatch).toBe(true);
      expect(response.body.encryptedPassport).not.toBe(validPayload.guestPassportNumber);
    });

    it('doit REJETER catégoriquement (400 Bad Request) les attaques par injection de propriétés superflues', async () => {
      const maliciousPayload = {
        idempotencyKey: 'idem-uuid-002',
        amountFcfa: 50000,
        guestPassportNumber: 'SN-112233',
        isAdmin: true, // Tentative d'élévation de privilège
        role: 'SUPERADMIN',
        discountPercentage: 100,
      };

      const response = await request(app.getHttpServer())
        .post('/api/security-test/strict-validation')
        .send(maliciousPayload)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/property isAdmin should not exist/),
          expect.stringMatching(/property role should not exist/),
          expect.stringMatching(/property discountPercentage should not exist/),
        ]),
      );
    });

    it('doit REJETER les montants non entiers (protection décimaux FCFA)', async () => {
      const invalidDecimalPayload = {
        idempotencyKey: 'idem-uuid-003',
        amountFcfa: 45000.5,
        guestPassportNumber: 'SN-445566',
      };

      const response = await request(app.getHttpServer())
        .post('/api/security-test/strict-validation')
        .send(invalidDecimalPayload)
        .expect(400);

      expect(response.body.message).toEqual(
        expect.arrayContaining([expect.stringMatching(/amountFcfa must be an integer number/)]),
      );
    });
  });
});
