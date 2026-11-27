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

    it('DIRECTION accède aussi au tableau Technique pour autoriser les interventions', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/technique/problems')
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`);

      expect(res.status).toBe(200);
    });

    it('Les autres profils reçoivent 403 Forbidden sur /api/technique/problems', async () => {
      for (const r of [Role.RECEPTION, Role.HOUSEKEEPING, Role.RESTAURANT, Role.CUISINIER]) {
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
      expect(res.body.directorApproved).toBe(false);
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

    it('Sans accord du directeur, le technicien ne peut ni venir, ni réparer, ni contourner par toggleBlocking ou PATCH /status (409)', async () => {
      const takeRes = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/take`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);

      expect(takeRes.status).toBe(409);
      expect(takeRes.body.message).toContain('accord préalable du directeur');

      const resolveRes = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/resolve`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`)
        .send({ resolutionNote: 'Réparation sans autorisation' });

      expect(resolveRes.status).toBe(409);

      // Tentative de contournement via PATCH /api/rooms/:id/status direct
      const statusBypassRes = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoom.id}/status`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`)
        .send({ status: RoomStatus.CLEANING, reason: 'Contournement statut direct' });

      expect(statusBypassRes.status).toBe(409);
      expect(statusBypassRes.body.message).toContain('accord préalable du directeur');

      // Basculer « chambre louable malgré ce problème » ne donne JAMAIS l'accord de réparation
      const toggleOff = await request(app.getHttpServer())
        .patch(`/api/rooms/problems/${createdProblemId}/toggle-blocking`)
        .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`);
      expect(toggleOff.status).toBe(200);
      expect(toggleOff.body.blocksRental).toBe(false);
      expect(toggleOff.body.directorApproved).toBe(false);

      const takeAfterToggle = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/take`)
        .set('Authorization', `Bearer ${roleTokens[Role.MAINTENANCE]}`);
      expect(takeAfterToggle.status).toBe(409);

      // Rétablir blocksRental = true pour la suite du cycle
      const toggleBack = await request(app.getHttpServer())
        .patch(`/api/rooms/problems/${createdProblemId}/toggle-blocking`)
        .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`);
      expect(toggleBack.status).toBe(200);
      expect(toggleBack.body.blocksRental).toBe(true);
    });

    it('Seul le directeur peut autoriser l’intervention (403 sur /technique et /rooms pour tout autre rôle)', async () => {
      for (const nonDir of [
        Role.MAINTENANCE,
        Role.RECEPTION,
        Role.HOUSEKEEPING,
        Role.RESTAURANT,
        Role.CUISINIER,
      ]) {
        const refusedTech = await request(app.getHttpServer())
          .patch(`/api/technique/problems/${createdProblemId}/approve`)
          .set('Authorization', `Bearer ${roleTokens[nonDir]}`);
        expect(refusedTech.status).toBe(403);

        const refusedRooms = await request(app.getHttpServer())
          .patch(`/api/rooms/problems/${createdProblemId}/approve`)
          .set('Authorization', `Bearer ${roleTokens[nonDir]}`);
        expect(refusedRooms.status).toBe(403);
      }

      const approved = await request(app.getHttpServer())
        .patch(`/api/technique/problems/${createdProblemId}/approve`)
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`);

      expect(approved.status).toBe(200);
      expect(approved.body.directorApproved).toBe(true);
      expect(approved.body.approvedByDirectorName).toBeTruthy();
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

      // Vérifier la traçabilité complète dans audit_log
      const auditEntries = await prisma.auditLog.findMany({
        where: { entity: 'RoomProblem', entityId: createdProblemId },
        select: { action: true },
      });
      const actions = auditEntries.map((a) => a.action);
      expect(actions).toContain('ROOM_PROBLEM_REPORTED');
      expect(actions).toContain('ROOM_PROBLEM_DIRECTOR_APPROVED');
      expect(actions).toContain('ROOM_PROBLEM_ACKNOWLEDGED');
      expect(actions).toContain('ROOM_PROBLEM_RESOLVED');
    });

    it('L’ampoule ne bloque pas la location par défaut et n’exige pas l’accord du directeur', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/${testRoom.id}/problems`)
        .set('Authorization', `Bearer ${roleTokens[Role.HOUSEKEEPING]}`)
        .send({
          type: 'AMPOULE',
          description: 'Lampe de chevet grillée',
        });

      expect(res.status).toBe(201);
      expect(res.body.blocksRental).toBe(false);
      expect(res.body.directorApproved).toBe(true);

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
