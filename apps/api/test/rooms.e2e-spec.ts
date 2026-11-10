import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RoomStatus, Role } from '@residence-blue/shared';
import { ServerModuleConfigService } from '../src/common/services/server-module-config.service';
import { seedRooms } from '../prisma/seed';

const request: any = (supertest as any).default || supertest;

describe('API Chambres & Porte de Sécurité (E2E & Intégration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let testRoomId: string;
  let testRoomTypeId: string;
  let moduleConfigService: ServerModuleConfigService;

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

    // RÈGLE POINT 4 DU PROMPT :
    // Les tests des modules désactivés continuent de s'exécuter avec l'interrupteur forcé à true dans les suites de test
    moduleConfigService.setModuleOverride('housekeeping', true);
    moduleConfigService.setModuleOverride('maintenance', true);

    // Récupérer une chambre et une catégorie existante (ou semer si la base est vide)
    let existingRoom = await prisma.room.findFirst({
      include: { type: true },
    });

    if (!existingRoom) {
      await seedRooms();
      existingRoom = await prisma.room.findFirst({
        include: { type: true },
      });
    }

    if (existingRoom) {
      testRoomId = existingRoom.id;
      testRoomTypeId = existingRoom.typeId;
    }
  }, 30000);

  afterAll(async () => {
    if (moduleConfigService) {
      moduleConfigService.resetOverrides();
    }
    if (app) {
      await app.close();
    }
  });

  describe('1. Accès et lecture des chambres (GET /api/rooms)', () => {
    it('doit refuser l’accès si aucun rôle n’est fourni (403 Forbidden - Deny by default)', async () => {
      await request(app.getHttpServer()).get('/api/rooms').expect(403);
    });

    it('doit refuser l’accès si le rôle n’est pas autorisé (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .get('/api/rooms')
        .set('x-user-role', 'ANONYMOUS')
        .expect(403);
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
    });

    it('doit retourner le détail d’une chambre existante (GET /api/rooms/:id)', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/rooms/${testRoomId}`)
        .set('x-user-role', Role.HOUSEKEEPING)
        .expect(200);

      expect(response.body.id).toBe(testRoomId);
      expect(response.body.type).toBeDefined();
    });

    it('doit retourner 404 pour un ID de chambre inexistant (UUID valide)', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      await request(app.getHttpServer())
        .get(`/api/rooms/${nonExistentId}`)
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
        .send({ status: RoomStatus.OCCUPIED })
        .expect(200);

      expect(response.body.status).toBe(RoomStatus.OCCUPIED);

      // Vérification dans l'audit_log (append-only)
      const auditEntry = await prisma.auditLog.findFirst({
        where: {
          entity: 'Room',
          entityId: testRoomId,
          action: { in: ['STATUS_CHANGE', 'ROOM_STATUS_CHANGE'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(auditEntry).toBeDefined();
      expect((auditEntry?.before as any)?.status).toBe('FREE');
      expect((auditEntry?.after as any)?.status).toBe('OCCUPIED');
    });

    it('doit refuser une transition illégale (OCCUPIED -> FREE sans passer par CLEANING)', async () => {
      // D'abord passer à OCCUPIED
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: 'OCCUPIED' },
      });

      // Tenter le retour direct à FREE
      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.DIRECTION)
        .send({ status: RoomStatus.FREE })
        .expect(400);

      expect(response.body.message).toContain('Transition interdite');
    });

    it('doit autoriser HOUSEKEEPING à libérer la chambre (CLEANING -> FREE)', async () => {
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: 'CLEANING' },
      });

      const response = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.HOUSEKEEPING)
        .send({ status: RoomStatus.FREE })
        .expect(200);

      expect(response.body.status).toBe(RoomStatus.FREE);
    });

    it('doit interdire à RESTAURANT de modifier le statut d’une chambre (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RESTAURANT)
        .send({ status: RoomStatus.CLEANING })
        .expect(403);
    });

    it('doit rejeter un statut non valide (validation stricte du DTO)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.DIRECTION)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });

    it('doit rejeter les propriétés supplémentaires (forbidNonWhitelisted)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.DIRECTION)
        .send({
          status: RoomStatus.MAINTENANCE,
          injectionAttempt: "DROP TABLE rooms;",
        })
        .expect(400);
    });
  });

  describe('3. Gestion des Tarifs & Porte de Sécurité Tarifs', () => {
    it('doit refuser la modification de tarifs aux rôles non-DIRECTION (RECEPTION, HOUSEKEEPING, RESTAURANT)', async () => {
      await request(app.getHttpServer())
        .patch(`/api/room-types/${testRoomTypeId}`)
        .set('x-user-role', Role.RESTAURANT)
        .send({ pricePerNight: 50000 })
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

    it('doit REJETER les montants négatifs', async () => {
      await request(app.getHttpServer())
        .patch(`/api/room-types/${testRoomTypeId}`)
        .set('x-user-role', Role.DIRECTION)
        .send({ pricePerNight: -500 })
        .expect(400);
    });
  });

  describe('4. Idempotence & Mode Hors-ligne (SyncOperations)', () => {
    it('doit enregistrer une opération idempotente et renvoyer le même résultat si rejouée', async () => {
      const idempotencyKey = 'uuid-test-idempotency-key-' + Date.now();

      // Première exécution : check-in (FREE -> OCCUPIED)
      const res1 = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RECEPTION)
        .set('Idempotency-Key', idempotencyKey)
        .send({ status: RoomStatus.OCCUPIED })
        .expect(200);

      expect(res1.body.status).toBe(RoomStatus.OCCUPIED);

      // Rejeu immédiat avec la même clé idempotente
      const res2 = await request(app.getHttpServer())
        .patch(`/api/rooms/${testRoomId}/status`)
        .set('x-user-role', Role.RECEPTION)
        .set('Idempotency-Key', idempotencyKey)
        .send({ status: RoomStatus.OCCUPIED })
        .expect(200);

      expect(res2.body).toEqual(res1.body);
    });
  });
});
