import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { issueDbTestToken } from './auth-test.helper';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServerModuleConfigService } from '../src/common/services/server-module-config.service';

describe('Modules Status & Deferred Routing (API)', () => {
  let app: INestApplication;
  let moduleConfigService: ServerModuleConfigService;
  const roleTokens: Record<string, string> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: ['health', 'api/health'],
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    moduleConfigService = app.get(ServerModuleConfigService);
    const prisma = app.get(PrismaService);
    roleTokens['ADMIN'] = (await issueDbTestToken(prisma, 'DIRECTION')).token;
    roleTokens['HOUSEKEEPING'] = (await issueDbTestToken(prisma, 'HOUSEKEEPING')).token; roleTokens['MAINTENANCE'] = (await issueDbTestToken(prisma, 'MAINTENANCE')).token;
    await app.init();
  }, 30000);

  afterAll(async () => {
    moduleConfigService.resetOverrides();
    await app.close();
  });

  describe('1. Routes des modules désactivés (Statut 404)', () => {
    it('doit renvoyer 404 sur une route de module désactivé par décorateur @RequireModule', async () => {
      // Même avec le rôle ADMIN, la route doit renvoyer 404 car le module est reporté
      const res = await request(app.getHttpServer())
        .get('/api/security-test/deferred-housekeeping')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('reporté ou désactivé');
    });

    it('doit renvoyer 404 sur les préfixes de route des modules reportés (/api/housekeeping/*)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/housekeeping/tasks')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(res.status).toBe(404);
    });

    it('doit renvoyer 404 sur les préfixes de route des modules reportés (/api/stocks/*)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stocks/items')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(res.status).toBe(404);
    });

    it('doit renvoyer 404 sur les préfixes de route des modules reportés (/api/maintenance/*)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/maintenance/logs')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(res.status).toBe(404);
    });
  });

  describe('2. Rôles activés en V1 et surcharges dynamiques de modules', () => {
    it('autorise HOUSEKEEPING et MAINTENANCE (tous deux actifs en V1 depuis le module Technique V1)', async () => {
      const hkRes = await request(app.getHttpServer())
        .get('/api/security-test/test-staff-role')
        .set('Authorization', `Bearer ${roleTokens['HOUSEKEEPING']}`);
      expect(hkRes.status).toBe(200);

      // Le rôle MAINTENANCE est désormais actif en V1 (config/modules.json, module Technique V1) -> 200 OK
      const res = await request(app.getHttpServer())
        .get('/api/security-test/test-staff-role')
        .set('Authorization', `Bearer ${roleTokens['MAINTENANCE']}`);
      expect(res.status).toBe(200);
    });

    it('refuse le rôle si son module est désactivé dynamiquement puis le réaccepte à la réactivation', async () => {
      moduleConfigService.setModuleOverride('maintenance', false);

      const refused = await request(app.getHttpServer())
        .get('/api/security-test/test-staff-role')
        .set('Authorization', `Bearer ${roleTokens['MAINTENANCE']}`);
      expect(refused.status).toBe(403);
      expect(refused.body.message).toContain('reporté en version ultérieure');

      moduleConfigService.setModuleOverride('maintenance', true);

      const res = await request(app.getHttpServer())
        .get('/api/security-test/test-staff-role')
        .set('Authorization', `Bearer ${roleTokens['MAINTENANCE']}`);

      expect(res.status).toBe(200);

      moduleConfigService.resetOverrides();
    });
  });

  describe('3. Routes des modules actifs (Statut 200)', () => {
    it('doit autoriser l’accès aux modules actifs en V1 (Rooms)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/security-test/active-rooms-module')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Module chambres actif V1');
    });
  });

  describe('4. Réactivation dynamique pour les tests CI (Point 4 du prompt)', () => {
    it('doit permettre de réactiver un module en environnement de test pour valider le code dormant', async () => {
      // Forcer l'interrupteur à true pour les tests CI
      moduleConfigService.setModuleOverride('housekeeping', true);

      const res = await request(app.getHttpServer())
        .get('/api/security-test/deferred-housekeeping')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Données de gouvernance V2');

      // Réinitialiser les surcharges
      moduleConfigService.resetOverrides();

      // Vérifier le retour au 404 normal
      const resAfter = await request(app.getHttpServer())
        .get('/api/security-test/deferred-housekeeping')
        .set('Authorization', `Bearer ${roleTokens['ADMIN']}`);

      expect(resAfter.status).toBe(404);
    });
  });
});
