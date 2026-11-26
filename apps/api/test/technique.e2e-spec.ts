import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role, RoomStatus } from '@residence-blue/shared';
import { ServerModuleConfigService } from '../src/common/services/server-module-config.service';
import { issueDbTestToken } from './auth-test.helper';

const request: any = (supertest as any).default || supertest;

describe('Porte de sécurité & E2E : Pannes, Nettoyage et Écran Technique', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moduleConfigService: ServerModuleConfigService;
  const roleTokens: Record<string, string> = {};
  let testRoom: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    prisma = app.get<PrismaService>(PrismaService);
    moduleConfigService = app.get<ServerModuleConfigService>(ServerModuleConfigService);

    moduleConfigService.setModuleOverride('maintenance', true);
    moduleConfigService.setModuleOverride('housekeeping', true);

    for (const r of [
      Role.DIRECTION,
      Role.RECEPTION,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.RESTAURANT,
      Role.CUISINIER,
    ]) {
      roleTokens[r] = (await issueDbTestToken(prisma, r)).token;
    }

    // Récupérer une chambre de test
    testRoom = await prisma.room.findFirst({
      where: { number: '101' },
      include: { type: true },
    });

    if (!testRoom) {
      testRoom = await prisma.room.findFirst({
        include: { type: true },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Contrôle d’accès strict & 403 (Porte de sécurité)', () => {
    it('MAINTENANCE accède à /api/technique/problems avec succès (200)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/technique/problems')
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('toTreat');
      expect(res.body).toHaveProperty('inProgress');
      expect(res.body).toHaveProperty('resolvedToday');
    });

    it('Les autres profils reçoivent 403 Forbidden sur /api/technique/problems', async () => {
      for (const r of [Role.RECEPTION, Role.DIRECTION, Role.HOUSEKEEPING, Role.RESTAURANT, Role.CUISINIER]) {
        const res = await request(app.getHttpServer())
          .get('/api/technique/problems')
          .set('Authorization', `Bearer ${roleTokens[r]}`);

        expect(res.status).toBe(403);
      }
    });

    it('MAINTENANCE reçoit 403 Forbidden sur les routes sensibles (clients, factures)', async () => {
      const clientsRes = await request(app.getHttpServer())
        .get('/api/guests')
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);
      expect(clientsRes.status).toBe(403);

      const billingRes = await request(app.getHttpServer())
        .get('/api/invoices')
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);
      expect(billingRes.status).toBe(403);
    });

    it('La réponse Technique ne contient aucun prix ni donnée confidentielle de réservation', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/technique/problems')
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);

      const text = JSON.stringify(res.body);
      expect(text).not.toContain('pricePerNight');
      expect(text).not.toContain('totalAmount');
      expect(text).not.toContain('guestName');
      expect(text).not.toContain('identityNumber');
    });
  });

  describe('2. Cycle de vie des pannes et règles métier', () => {
    let createdProblemId: string;

    it('Signalement d’une panne bloquante sur chambre libre -> la chambre devient non louable (MAINTENANCE)', async () => {
      // S'assurer que la chambre est libre et propre
      await prisma.room.update({
        where: { id: testRoom.id },
        data: { status: RoomStatus.FREE, isClean: true },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/rooms/${testRoom.id}/problems`)
        .set('Authorization', `Bearer ${roleTokens[Role.HOUSEKEEPING]}`)
        .send({
          type: 'CLIMATISATION',
          description: 'Ne souffle que de l’air chaud',
        });

      expect(res.status).toBe(201);
      expect(res.body.blocksRental).toBe(true);
      expect(res.body.status).toBe('REPORTED');
      createdProblemId = res.body.id;

      // Vérifier l'état de la chambre
      const room = await prisma.room.findUnique({ where: { id: testRoom.id } });
      expect(room?.status).toBe(RoomStatus.MAINTENANCE);
    });

    it('Une tentative de réservation ou check-in sur cette chambre est refusée', async () => {
      const now = new Date();
      const checkIn = now.toISOString().split('T')[0];
      const checkOut = new Date(now.getTime() + 86400000).toISOString().split('T')[0];

      // Tentative de réservation
      const res = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
        .send({
          roomId: testRoom.id,
          guestName: 'Client Invalide',
          checkIn,
          checkOut,
          adultsCount: 1,
        });

      // Refusé car la chambre est en maintenance
      expect([400, 409]).toContain(res.status);
    });

    it('Le technicien prend en charge la panne (« Je m’en occupe »)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/take`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.assignedToName).toBeDefined();
    });

    it('Une transition invalide est refusée avec 409 Conflict', async () => {
      // Reprendre en charge un problème déjà IN_PROGRESS
      const res = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/take`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);

      expect(res.status).toBe(409);
    });

    it('Le technicien valide la réparation (« C’est réparé ») -> la chambre redevient louable', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/resolve`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`)
        .send({
          resolutionNote: 'Condensateur remplacé et recharge effectuée.',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('RESOLVED');
      expect(res.body.resolutionNote).toContain('Condensateur');

      // La chambre propre redevient FREE
      const room = await prisma.room.findUnique({ where: { id: testRoom.id } });
      expect(room?.status).toBe(RoomStatus.FREE);
    });

    it('L’ampoule ne bloque pas la location par défaut', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/${testRoom.id}/problems`)
        .set('Authorization', `Bearer ${roleTokens[Role.HOUSEKEEPING]}`)
        .send({
          type: 'AMPOULE',
          description: 'Lampe de chevet grillée',
        });

      expect(res.status).toBe(201);
      expect(res.body.blocksRental).toBe(false);

      // La chambre reste FREE
      const room = await prisma.room.findUnique({ where: { id: testRoom.id } });
      expect(room?.status).toBe(RoomStatus.FREE);
    });
  });

  describe('3. Nettoyage indépendant & client présent', () => {
    it('Le ménage peut marquer « J’ai nettoyé » sur une chambre occupée sans changer son occupation', async () => {
      await prisma.room.update({
        where: { id: testRoom.id },
        data: { status: RoomStatus.OCCUPIED, isClean: false },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoom.id}/cleanliness`)
        .set('Authorization', `Bearer ${roleTokens[Role.HOUSEKEEPING]}`)
        .send({ isClean: true });

      expect(res.status).toBe(200);
      expect(res.body.isClean).toBe(true);
      expect(res.body.status).toBe(RoomStatus.OCCUPIED); // Reste occupée !
    });
  });
});
