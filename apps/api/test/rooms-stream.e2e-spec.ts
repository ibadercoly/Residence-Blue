import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as http from 'http';
import supertest from 'supertest';
import { Role, RoomStatus } from '@residence-blue/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ServerModuleConfigService } from '../src/common/services/server-module-config.service';
import { SessionRevocationService } from '../src/auth/session-revocation.service';
import { seedRooms } from '../prisma/seed';
import { issueDbTestToken } from './auth-test.helper';

const request: any = (supertest as any).default || supertest;

describe('Flux SSE Chambres (/api/rooms/stream) & Révocation (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let moduleConfigService: ServerModuleConfigService;
  let sessionRevocation: SessionRevocationService;
  let baseUrl: string;
  let testRoomId: string;
  let testRoomNumber: string;
  const tokens: Record<string, { token: string; userId: string }> = {};
  const openReqs: http.ClientRequest[] = [];

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
    await app.listen(0);
    const addr = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;

    prisma = app.get<PrismaService>(PrismaService);
    moduleConfigService = app.get<ServerModuleConfigService>(ServerModuleConfigService);
    sessionRevocation = app.get<SessionRevocationService>(SessionRevocationService);

    moduleConfigService.setModuleOverride('maintenance', true);

    for (const r of [
      Role.DIRECTION,
      Role.RECEPTION,
      Role.MAINTENANCE,
      Role.HOUSEKEEPING,
      Role.RESTAURANT,
      Role.CUISINIER,
      Role.COMPTABLE,
    ]) {
      const issued = await issueDbTestToken(prisma, r);
      tokens[r] = { token: issued.token, userId: issued.userId };
    }

    let room = await prisma.room.findFirst({ orderBy: { number: 'asc' } });
    if (!room) {
      await seedRooms();
      room = await prisma.room.findFirst({ orderBy: { number: 'asc' } });
    }
    testRoomId = room!.id;
    testRoomNumber = room!.number;
  }, 30000);

  afterEach(() => {
    while (openReqs.length > 0) {
      openReqs.pop()?.destroy();
    }
  });

  afterAll(async () => {
    if (testRoomId) {
      await prisma.room.update({
        where: { id: testRoomId },
        data: { status: RoomStatus.FREE, maintenanceReason: null },
      }).catch(() => {});
    }
    if (moduleConfigService) {
      moduleConfigService.resetOverrides();
    }
    if (app) {
      await app.close();
    }
  });

  it('refuse 401 sans jeton et 403 aux rôles non autorisés (HOUSEKEEPING, RESTAURANT, CUISINIER, COMPTABLE)', async () => {
    await request(app.getHttpServer()).get('/api/rooms/stream').expect(401);

    for (const deniedRole of [Role.HOUSEKEEPING, Role.RESTAURANT, Role.CUISINIER, Role.COMPTABLE]) {
      await request(app.getHttpServer())
        .get('/api/rooms/stream')
        .set('Authorization', `Bearer ${tokens[deniedRole].token}`)
        .expect(403);
    }
  });

  it('diffuse en direct ROOM_STATUS_UPDATED à RECEPTION, DIRECTION et MAINTENANCE sans prix ni nom de client, avec reprise Last-Event-ID', async () => {
    await prisma.room.update({
      where: { id: testRoomId },
      data: { status: RoomStatus.CLEANING, maintenanceReason: null },
    });

    const receivedChunks: Record<string, string> = {
      RECEPTION: '',
      DIRECTION: '',
      MAINTENANCE: '',
    };

    for (const roleKey of ['RECEPTION', 'DIRECTION', 'MAINTENANCE'] as const) {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          `${baseUrl}/api/rooms/stream`,
          { headers: { Authorization: `Bearer ${tokens[Role[roleKey]].token}` } },
          (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`Attendu 200 pour ${roleKey}, reçu ${res.statusCode}`));
              return;
            }
            res.on('data', (chunk: Buffer) => {
              receivedChunks[roleKey] += chunk.toString('utf8');
            });
            resolve();
          },
        );
        req.on('error', reject);
        openReqs.push(req);
      });
    }

    await new Promise((r) => setTimeout(r, 150));

    // Ménage marque la chambre propre -> FREE
    await request(app.getHttpServer())
      .patch(`/api/rooms/${testRoomId}/status`)
      .set('Authorization', `Bearer ${tokens[Role.HOUSEKEEPING].token}`)
      .send({ status: RoomStatus.FREE, reason: 'Chambre nettoyée et prête' })
      .expect(200);

    // Ménage signale une fuite d'eau -> MAINTENANCE
    await request(app.getHttpServer())
      .patch(`/api/rooms/${testRoomId}/status`)
      .set('Authorization', `Bearer ${tokens[Role.HOUSEKEEPING].token}`)
      .send({ status: RoomStatus.MAINTENANCE, reason: "Fuite d'eau" })
      .expect(200);

    await new Promise((r) => setTimeout(r, 300));

    for (const roleKey of ['RECEPTION', 'DIRECTION', 'MAINTENANCE']) {
      const payload = receivedChunks[roleKey];
      expect(payload).toContain('ROOM_STATUS_UPDATED');
      expect(payload).toContain(testRoomNumber);
      expect(payload).toContain('"status":"FREE"');
      expect(payload).toContain('"status":"MAINTENANCE"');
      expect(payload).toContain("Fuite d'eau");
      // Aucun tarif ni donnée client dans le flux
      expect(payload).not.toContain('pricePerNight');
      expect(payload).not.toContain('guestName');
      expect(payload).not.toContain('totalFcfa');
    }

    // Reprise automatique via Last-Event-ID=1 doit rejouer au moins l'événement 2
    let replayPayload = '';
    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        `${baseUrl}/api/rooms/stream`,
        {
          headers: {
            Authorization: `Bearer ${tokens[Role.RECEPTION].token}`,
            'Last-Event-ID': '1',
          },
        },
        (res) => {
          expect(res.statusCode).toBe(200);
          res.on('data', (chunk: Buffer) => {
            replayPayload += chunk.toString('utf8');
          });
          setTimeout(resolve, 200);
        },
      );
      req.on('error', reject);
      openReqs.push(req);
    });
    expect(replayPayload).toContain('"status":"MAINTENANCE"');
  });

  it('ferme immédiatement le flux SSE si la session utilisateur est révoquée', async () => {
    let streamClosed = false;
    await new Promise<void>((resolve, reject) => {
      const req = http.get(
        `${baseUrl}/api/rooms/stream`,
        { headers: { Authorization: `Bearer ${tokens[Role.RECEPTION].token}` } },
        (res) => {
          expect(res.statusCode).toBe(200);
          res.resume();
          res.on('end', () => {
            streamClosed = true;
          });
          res.on('close', () => {
            streamClosed = true;
          });
          resolve();
        },
      );
      req.on('error', reject);
      openReqs.push(req);
    });

    await new Promise((r) => setTimeout(r, 100));
    sessionRevocation.notifyUserRevoked(tokens[Role.RECEPTION].userId);
    await new Promise((r) => setTimeout(r, 250));
    expect(streamClosed).toBe(true);
  });
});
