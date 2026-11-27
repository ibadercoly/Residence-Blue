import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { Role, RoomInterventionStatus, RoomStatus } from '@residence-blue/shared';
import { seedRooms } from '../prisma/seed';
import { issueDbTestToken } from './auth-test.helper';

const request: any = (supertest as any).default || supertest;

describe("Workflow d'Intervention Technique en Chambre — Intégration & Sécurité (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const roleUsers: Record<string, { token: string; userId: string }> = {};
  let roomA: any;
  let roomB: any;
  const createdInterventionIds: string[] = [];

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

    prisma = app.get(PrismaService);

    for (const r of [
      Role.DIRECTION,
      Role.RECEPTION,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.RESTAURANT,
      Role.CUISINIER,
    ]) {
      roleUsers[r] = await issueDbTestToken(prisma, r, {
        email: `interv.e2e.${r.toLowerCase()}@residenceblue.sn`,
      });
    }

    let rooms = await prisma.room.findMany({
      where: { number: { in: ['101', '102'] } },
      orderBy: { number: 'asc' },
    });
    if (rooms.length < 2) {
      await seedRooms();
      rooms = await prisma.room.findMany({
        where: { number: { in: ['101', '102'] } },
        orderBy: { number: 'asc' },
      });
    }
    roomA = rooms[0];
    roomB = rooms[1];

    await prisma.roomInterventionRequest.deleteMany({
      where: { roomId: { in: [roomA.id, roomB.id] } },
    });
    await prisma.room.updateMany({
      where: { id: { in: [roomA.id, roomB.id] } },
      data: { status: RoomStatus.FREE, maintenanceReason: null },
    });
  }, 30000);

  afterAll(async () => {
    if (createdInterventionIds.length > 0) {
      await prisma.roomInterventionRequest.deleteMany({
        where: { id: { in: createdInterventionIds } },
      });
    }
    if (roomA && roomB) {
      await prisma.room.updateMany({
        where: { id: { in: [roomA.id, roomB.id] } },
        data: { status: RoomStatus.FREE, maintenanceReason: null },
      });
    }
    await app.close();
  });

  describe('1. Parcours complet Ménage / Réception -> Direction -> Maintenance', () => {
    let housekeepingReqId: string;
    let receptionReqId: string;

    it('Le Ménage signale un problème (201) -> statut PENDING_DIRECTOR + notification DIRECTION', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/${roomA.id}/intervention`)
        .set('Authorization', `Bearer ${roleUsers[Role.HOUSEKEEPING].token}`)
        .send({ issueDescription: "Fuite d'eau importante sous le lavabo" })
        .expect(201);

      expect(res.body.status).toBe(RoomInterventionStatus.PENDING_DIRECTOR);
      expect(res.body.reportedById).toBe(roleUsers[Role.HOUSEKEEPING].userId);
      expect(res.body.roomId).toBe(roomA.id);
      housekeepingReqId = res.body.id;
      createdInterventionIds.push(housekeepingReqId);

      // La chambre ne passe PAS encore en MAINTENANCE
      const roomDb = await prisma.room.findUnique({ where: { id: roomA.id } });
      expect(roomDb?.status).toBe(RoomStatus.FREE);

      // Notification créée pour DIRECTION uniquement
      const dirNotif = await prisma.notificationMessage.findFirst({
        where: {
          category: 'MAINTENANCE',
          type: 'INTERVENTION_DEMANDEE',
          roomNumber: roomA.number,
          targetRoles: { has: Role.DIRECTION },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(dirNotif).not.toBeNull();
      expect(dirNotif?.targetRoles).toEqual([Role.DIRECTION]);

      // MAINTENANCE ne voit PAS cette demande en attente
      const maintList = await request(app.getHttpServer())
        .get('/api/rooms/interventions')
        .set('Authorization', `Bearer ${roleUsers[Role.MAINTENANCE].token}`)
        .expect(200);
      expect((maintList.body as any[]).some((i) => i.id === housekeepingReqId)).toBe(false);
    });

    it("L'Assistant de Réception signale un problème (201) -> statut PENDING_DIRECTOR + reportedBy", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/${roomB.id}/intervention`)
        .set('Authorization', `Bearer ${roleUsers[Role.RECEPTION].token}`)
        .send({ issueDescription: 'Climatisation cassée et bruyante' })
        .expect(201);

      expect(res.body.status).toBe(RoomInterventionStatus.PENDING_DIRECTOR);
      expect(res.body.reportedById).toBe(roleUsers[Role.RECEPTION].userId);
      receptionReqId = res.body.id;
      createdInterventionIds.push(receptionReqId);
    });

    it('La Direction approuve (200) -> statut APPROVED, chambre MAINTENANCE et notification MAINTENANCE avec les détails', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/interventions/${housekeepingReqId}/approve`)
        .set('Authorization', `Bearer ${roleUsers[Role.DIRECTION].token}`)
        .expect(200);

      expect(res.body.status).toBe(RoomInterventionStatus.APPROVED);
      expect(res.body.approvedById).toBe(roleUsers[Role.DIRECTION].userId);
      expect(res.body.approvedAt).toBeTruthy();

      const roomDb = await prisma.room.findUnique({ where: { id: roomA.id } });
      expect(roomDb?.status).toBe(RoomStatus.MAINTENANCE);

      // Notification créée pour MAINTENANCE avec le numéro de chambre et la description
      const maintNotif = await prisma.notificationMessage.findFirst({
        where: {
          category: 'MAINTENANCE',
          type: 'INTERVENTION_APPROUVEE',
          roomNumber: roomA.number,
          targetRoles: { has: Role.MAINTENANCE },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(maintNotif).not.toBeNull();
      expect(maintNotif?.title).toContain(roomA.number);
      expect(maintNotif?.title).toContain("Fuite d'eau importante sous le lavabo");

      // MAINTENANCE voit maintenant l'intervention dans sa liste
      const maintList = await request(app.getHttpServer())
        .get('/api/rooms/interventions')
        .set('Authorization', `Bearer ${roleUsers[Role.MAINTENANCE].token}`)
        .expect(200);
      expect((maintList.body as any[]).some((i) => i.id === housekeepingReqId)).toBe(true);
    });

    it('La Direction refuse (200) -> statut REJECTED, chambre inchangée et notification RECEPTION + HOUSEKEEPING (jamais MAINTENANCE)', async () => {
      const rejectReason = 'Fausse alerte, disjoncteur simplement coupé';
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/interventions/${receptionReqId}/reject`)
        .set('Authorization', `Bearer ${roleUsers[Role.DIRECTION].token}`)
        .send({ reason: rejectReason })
        .expect(200);

      expect(res.body.status).toBe(RoomInterventionStatus.REJECTED);
      expect(res.body.rejectionReason).toBe(rejectReason);

      // La chambre B n'est JAMAIS passée en MAINTENANCE
      const roomDb = await prisma.room.findUnique({ where: { id: roomB.id } });
      expect(roomDb?.status).toBe(RoomStatus.FREE);

      // Notification créée pour RECEPTION et HOUSEKEEPING avec le motif
      const rejectNotif = await prisma.notificationMessage.findFirst({
        where: {
          category: 'MAINTENANCE',
          type: 'INTERVENTION_REFUSEE',
          roomNumber: roomB.number,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(rejectNotif).not.toBeNull();
      expect(rejectNotif?.targetRoles).toEqual(
        expect.arrayContaining([Role.RECEPTION, Role.HOUSEKEEPING]),
      );
      expect(rejectNotif?.targetRoles).not.toContain(Role.MAINTENANCE);
      expect(rejectNotif?.title).toContain(rejectReason);

      // Aucune notification d'approbation créée pour MAINTENANCE sur roomB
      const maintApprovalForB = await prisma.notificationMessage.findFirst({
        where: {
          category: 'MAINTENANCE',
          type: 'INTERVENTION_APPROUVEE',
          roomNumber: roomB.number,
          createdAt: { gte: new Date(Date.now() - 60_000) },
        },
      });
      expect(maintApprovalForB).toBeNull();
    });

    it("L'équipe Technique complète l'intervention approuvée (200) -> COMPLETED et chambre remise en CLEANING", async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/interventions/${housekeepingReqId}/complete`)
        .set('Authorization', `Bearer ${roleUsers[Role.MAINTENANCE].token}`)
        .expect(200);

      expect(res.body.status).toBe(RoomInterventionStatus.COMPLETED);
      expect(res.body.completedAt).toBeTruthy();

      const roomDb = await prisma.room.findUnique({ where: { id: roomA.id } });
      expect(roomDb?.status).toBe(RoomStatus.CLEANING);
      expect(roomDb?.maintenanceReason).toBeNull();
    });
  });

  describe('2. Porte de sécurité & Verrouillage strict du statut MAINTENANCE', () => {
    let pendingId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/rooms/${roomB.id}/intervention`)
        .set('Authorization', `Bearer ${roleUsers[Role.RECEPTION].token}`)
        .send({ issueDescription: 'Serrure bloquée' })
        .expect(201);
      pendingId = res.body.id;
      createdInterventionIds.push(pendingId);
    });

    it('RECEPTION reçoit 403 si elle tente d’approuver ou de refuser elle-même', async () => {
      await request(app.getHttpServer())
        .post(`/api/rooms/interventions/${pendingId}/approve`)
        .set('Authorization', `Bearer ${roleUsers[Role.RECEPTION].token}`)
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/rooms/interventions/${pendingId}/reject`)
        .set('Authorization', `Bearer ${roleUsers[Role.RECEPTION].token}`)
        .send({ reason: 'Auto-refus interdit' })
        .expect(403);
    });

    it('HOUSEKEEPING et MAINTENANCE reçoivent 403 sur approve / reject', async () => {
      for (const forbiddenRole of [Role.HOUSEKEEPING, Role.MAINTENANCE, Role.RESTAURANT, Role.CUISINIER]) {
        await request(app.getHttpServer())
          .post(`/api/rooms/interventions/${pendingId}/approve`)
          .set('Authorization', `Bearer ${roleUsers[forbiddenRole].token}`)
          .expect(403);
      }
    });

    it('MAINTENANCE reçoit 403 si elle tente de passer la chambre en MAINTENANCE sans autorisation préalable', async () => {
      await prisma.room.update({
        where: { id: roomB.id },
        data: { status: RoomStatus.FREE, maintenanceReason: null },
      });

      const res = await request(app.getHttpServer())
        .patch(`/api/rooms/${roomB.id}/status`)
        .set('Authorization', `Bearer ${roleUsers[Role.MAINTENANCE].token}`)
        .send({ status: RoomStatus.MAINTENANCE, reason: 'Forçage technique sans accord' })
        .expect(403);

      expect(res.body.message).toContain('approuvée par la Direction');

      const roomDb = await prisma.room.findUnique({ where: { id: roomB.id } });
      expect(roomDb?.status).toBe(RoomStatus.FREE);
    });

    it('RECEPTION, HOUSEKEEPING et DIRECTION reçoivent aussi 403 sur PATCH /status -> MAINTENANCE sans demande APPROVED', async () => {
      for (const r of [Role.RECEPTION, Role.HOUSEKEEPING, Role.DIRECTION]) {
        await request(app.getHttpServer())
          .patch(`/api/rooms/${roomB.id}/status`)
          .set('Authorization', `Bearer ${roleUsers[r].token}`)
          .send({ status: RoomStatus.MAINTENANCE, reason: 'Contournement direct' })
          .expect(403);
      }
    });

    it('ValidationPipe rejette les champs non autorisés (400)', async () => {
      await request(app.getHttpServer())
        .post(`/api/rooms/${roomB.id}/intervention`)
        .set('Authorization', `Bearer ${roleUsers[Role.RECEPTION].token}`)
        .send({
          issueDescription: 'Test injection',
          status: 'APPROVED',
        })
        .expect(400);
    });
  });
});
