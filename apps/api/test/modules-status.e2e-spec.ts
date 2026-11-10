import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ServerModuleConfigService } from '../src/common/services/server-module-config.service';

describe('Modules Status & Deferred Routing (API)', () => {
  let app: INestApplication;
  let moduleConfigService: ServerModuleConfigService;

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
    await app.init();
  });

  afterAll(async () => {
    moduleConfigService.resetOverrides();
    await app.close();
  });

  describe('1. Routes des modules désactivés (Statut 404)', () => {
    it('doit renvoyer 404 sur une route de module désactivé par décorateur @RequireModule', async () => {
      // Même avec le rôle ADMIN, la route doit renvoyer 404 car le module est reporté
      const res = await request(app.getHttpServer())
        .get('/api/security-test/deferred-housekeeping')
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
      expect(res.body.message).toContain('reporté ou désactivé');
    });

    it('doit renvoyer 404 sur les préfixes de route des modules reportés (/api/housekeeping/*)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/housekeeping/tasks')
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
    });

    it('doit renvoyer 404 sur les préfixes de route des modules reportés (/api/stocks/*)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/stocks/items')
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
    });

    it('doit renvoyer 404 sur les préfixes de route des modules reportés (/api/maintenance/*)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/maintenance/logs')
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
    });
  });

  describe('2. Rôles reportés V2 / V3 non assignables ou utilisables en V1', () => {
    it('doit refuser l’accès avec un rôle reporté (ex: HOUSEKEEPING) sur une route même si le rôle y est listé', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/security-test/test-staff-role')
        .set('x-user-role', 'HOUSEKEEPING');

      // Le rôle HOUSEKEEPING est désactivé en V1 -> 403 Forbidden
      expect(res.status).toBe(403);
      expect(res.body.message).toContain('reporté en version ultérieure');
    });

    it('doit accepter le rôle reporté si l’interrupteur est activé dynamiquement pour les tests CI', async () => {
      moduleConfigService.setModuleOverride('housekeeping', true);

      const res = await request(app.getHttpServer())
        .get('/api/security-test/test-staff-role')
        .set('x-user-role', 'HOUSEKEEPING');

      expect(res.status).toBe(200);

      moduleConfigService.resetOverrides();
    });
  });

  describe('3. Routes des modules actifs (Statut 200)', () => {
    it('doit autoriser l’accès aux modules actifs en V1 (Rooms)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/security-test/active-rooms-module')
        .set('x-user-role', 'ADMIN');

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
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Données de gouvernance V2');

      // Réinitialiser les surcharges
      moduleConfigService.resetOverrides();

      // Vérifier le retour au 404 normal
      const resAfter = await request(app.getHttpServer())
        .get('/api/security-test/deferred-housekeeping')
        .set('x-user-role', 'ADMIN');

      expect(resAfter.status).toBe(404);
    });
  });
});
