import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomStatus, Role } from '@residence-blue/shared';

const request: any = (supertest as any).default || supertest;

describe('API Chambres & Porte de Sécurité (E2E & Intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testRoomId: string;
  let testRoomTypeId: string;

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

    // Récupérer une chambre et une catégorie existante
    const existingRoom = await prisma.room.findFirst({
      include: { type: true },
    });

    if (existingRoom) {
      testRoomId = existingRoom.id;
      testRoomTypeId = existingRoom.typeId;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Accès et lecture des chambres (GET /api/rooms)', () => {
    it('doit refuser l’accès si aucun rôle n’est fourni (403 Forbidden - Deny by default)', async () => {
      await request(app.getHttpServer()).get('/api/rooms').expect(403);
    });

    it('doit retourner la liste des chambres pour un rôle autorisé (ex: RECEPTION)', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('x-user-role', Role.RECEPTION)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(12);
      expect(response.body[0]).toHaveProperty('number');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('type');
      expect(typeof response.body[0].type.pricePerNight).toBe('number');
    });

    it('doit retourner le détail d’une chambre existante (GET /api/rooms/:id)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${testRoomId}`)
        .set('x-user-role', Role.HOUSEKEEPING)
        .expect(200);

      expect(response.body.id).toBe(testRoomId);
      expect(response.body.type).toBeDefined();
    });

    it('doit retourner 404 pour un identifiant inexistant ou invalide', async () => {
      await request(app.getHttpServer())
        .get('/api/rooms/00000000-0000-0000-0000-000000009999')
        .set('x-user-role', Role.DIRECTION)
        .expect(404);

      await request(app.getHttpServer())
        .get('/api/rooms/not-a-uuid')
        .set('x-user-role', Role.DIRECTION)
        .expect(404);
    });
  });

  describe('2. Transitions de statut et Machine à états (PATCH /api/rooms/:id/status)', () => {
    beforeEach(async () => {
      // Remettre la chambre de test à FREE avant chaque test
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: 'FREE' },
      });
    });

    it('doit autoriser le check-in (FREE -> OCCUPIED) pour RECEPTION et inscrire dans audit_log', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RECEPTION)
        .set('x-user-id', '00000000-0000-0000-0000-000000000001')
        .send({
          status: RoomStatus.OCCUPIED,
          reason: 'Check-in client M. Diop',
        })
        .expect(200);

      expect(response.body.status).toBe(RoomStatus.OCCUPIED);

      // Vérifier la présence dans audit_log
      const audit = await prisma.auditLog.findFirst({
        where: {
          action: 'ROOM_STATUS_CHANGE',
          entityId: testRoomId,
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(audit).not.toBeNull();
      expect((audit?.after as any)?.status).toBe(RoomStatus.OCCUPIED);
    });

    it('doit REJETER la transition interdite OCCUPIED vers FREE sans passer par CLEANING (400 Bad Request)', async () => {
      // 1. Mettre la chambre à OCCUPIED
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: 'OCCUPIED' },
      });

      // 2. Tenter passage direct OCCUPIED -> FREE
      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.DIRECTION)
        .send({
          status: RoomStatus.FREE,
        })
        .expect(400);

      expect(response.body.message).toMatch(/passer par le nettoyage/i);
    });

    it('doit permettre le cycle légal complet : FREE -> OCCUPIED -> CLEANING -> FREE', async () => {
      // 1. FREE -> OCCUPIED (Check-in RECEPTION)
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RECEPTION)
        .send({ status: RoomStatus.OCCUPIED })
        .expect(200);

      // 2. OCCUPIED -> CLEANING (Check-out RECEPTION)
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RECEPTION)
        .send({ status: RoomStatus.CLEANING })
        .expect(200);

      // 3. CLEANING -> FREE (Ménage terminé HOUSEKEEPING)
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.HOUSEKEEPING)
        .send({ status: RoomStatus.FREE, reason: 'Chambre désinfectée' })
        .expect(200);
    });

    it('doit bloquer toute tentative de modification par un rôle non habilité (ex: RESTAURANT, 403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RESTAURANT)
        .send({ status: RoomStatus.OCCUPIED })
        .expect(403);
    });
  });

  describe('3. Gestion des Tarifs & Porte de Sécurité Tarifs', () => {
    it('doit interdire la création/modification de tarifs à RECEPTION (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post('/api/room-types')
        .set('x-user-role', Role.RECEPTION)
        .send({ name: 'Suite Royale', pricePerNight: 150000 })
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/room-types/${testRoomTypeId}`)
        .set('x-user-role', Role.RECEPTION)
        .send({ pricePerNight: 40000 })
        .expect(403);
    });

    it('doit autoriser la modification de tarifs à DIRECTION', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/room-types/${testRoomTypeId}`)
        .set('x-user-role', Role.DIRECTION)
        .send({ pricePerNight: 36000 })
        .expect(200);

      expect(response.body.pricePerNight).toBe(36000);

      // Rétablir le tarif d'origine
      await request(app.getHttpServer())
        .patch(`/api/room-types/${testRoomTypeId}`)
        .set('x-user-role', Role.DIRECTION)
        .send({ pricePerNight: 35000 })
        .expect(200);
    });

    it('doit REJETER les montants non entiers (protection stricte des décimaux FCFA)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/room-types/${testRoomTypeId}`)
        .set('x-user-role', Role.DIRECTION)
        .send({ pricePerNight: 35000.5 })
        .expect(400);
    });
  });

  describe('4. Porte de Sécurité Spécifique aux Chambres', () => {
    it('Attaque : Statut invalide ou corrompu (doit être rejeté 400)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.DIRECTION)
        .send({ status: 'HACKED_STATUS' })
        .expect(400);
    });

    it('Attaque : Injection de champs non autorisés (Mass Assignment / Whitelist)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.DIRECTION)
        .send({
          status: RoomStatus.CLEANING,
          isAdmin: true,
          pricePerNight: 0,
        })
        .expect(400);
    });
  });
});
