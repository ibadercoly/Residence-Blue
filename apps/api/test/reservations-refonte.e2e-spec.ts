import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { issueDbTestToken } from './auth-test.helper';

describe('Réservations Refonte API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdReservationIds: string[] = [];
  const createdGuestIds: string[] = [];
  const createdRoomIds: string[] = [];
  let roomTypeId = '';
  const roleTokens: Record<string, string> = {};

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    for (const r of ['DIRECTION', 'RECEPTION', 'SERVEUR', 'CUISINE']) {
      roleTokens[r] = (await issueDbTestToken(prisma, r)).token;
    }

    const existingType = await prisma.roomType.findFirst();
    if (existingType) {
      roomTypeId = existingType.id;
    } else {
      const rt = await prisma.roomType.create({
        data: { name: 'TestStandard', pricePerNight: 35000 },
      });
      roomTypeId = rt.id;
    }
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (createdReservationIds.length > 0) {
        await prisma.payment.deleteMany({
          where: { invoice: { reservationId: { in: createdReservationIds } } },
        });
        await prisma.invoice.deleteMany({
          where: { reservationId: { in: createdReservationIds } },
        });
        await prisma.reservation.deleteMany({
          where: { id: { in: createdReservationIds } },
        });
      }
      if (createdGuestIds.length > 0) {
        await prisma.guest.deleteMany({
          where: { id: { in: createdGuestIds } },
        });
      }
      if (createdRoomIds.length > 0) {
        await prisma.room.deleteMany({
          where: { id: { in: createdRoomIds } },
        });
      }
    }
    if (app) {
      await app.close();
    }
  }, 30000);

  it('GET /api/rooms/available exclut chambres réservées, en MAINTENANCE et inactives', async () => {
    const suffix = Date.now().toString().slice(-4);
    const freeRoom = await prisma.room.create({
      data: {
        number: `T1${suffix}`,
        typeId: roomTypeId,
        floor: 1,
        category: 'Standard',
        status: 'FREE',
        isActive: true,
        adultsCapacity: 2,
        childrenCapacity: 1,
        pricePerNight: 40000,
      },
    });
    const maintRoom = await prisma.room.create({
      data: {
        number: `T2${suffix}`,
        typeId: roomTypeId,
        floor: 1,
        category: 'Standard',
        status: 'MAINTENANCE',
        isActive: true,
        adultsCapacity: 2,
        childrenCapacity: 0,
        pricePerNight: 40000,
      },
    });
    const inactiveRoom = await prisma.room.create({
      data: {
        number: `T3${suffix}`,
        typeId: roomTypeId,
        floor: 1,
        category: 'Standard',
        status: 'FREE',
        isActive: false,
        adultsCapacity: 2,
        childrenCapacity: 0,
        pricePerNight: 40000,
      },
    });
    createdRoomIds.push(freeRoom.id, maintRoom.id, inactiveRoom.id);

    const avail1 = await request(app.getHttpServer())
      .get('/api/rooms/available')
      .query({ checkIn: '2026-12-10', checkOut: '2026-12-12' })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);

    const numbers1 = avail1.body.items.map((r: any) => r.number);
    expect(numbers1).toContain(freeRoom.number);
    expect(numbers1).not.toContain(maintRoom.number);
    expect(numbers1).not.toContain(inactiveRoom.number);
    expect(avail1.body.rates).toBeDefined();

    // Créer une réservation sur freeRoom du 10 au 12 déc.
    const createRes = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        roomId: freeRoom.id,
        newGuest: {
          fullName: `Client Test ${suffix}`,
          phone: `+221 77 100 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
        },
        checkInDate: '2026-12-10',
        checkOutDate: '2026-12-12',
        adultsCount: 2,
        childrenCount: 0,
      })
      .expect(201);
    createdReservationIds.push(createRes.body.id);
    createdGuestIds.push(createRes.body.guestId);

    const avail2 = await request(app.getHttpServer())
      .get('/api/rooms/available')
      .query({ checkIn: '2026-12-11', checkOut: '2026-12-13' })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);

    const numbers2 = avail2.body.items.map((r: any) => r.number);
    expect(numbers2).not.toContain(freeRoom.number);
  }, 20000);

  it('GET /api/guests/search limite la réponse à 5 résultats max', async () => {
    const tag = `Srch${Date.now().toString().slice(-4)}`;
    for (let i = 0; i < 7; i++) {
      const g = await prisma.guest.create({
        data: {
          civility: 'M.',
          firstName: tag,
          lastName: `Client${i}`,
          fullName: `${tag} Client${i}`,
          phone: `+221 77 200 10 0${i}`,
        },
      });
      createdGuestIds.push(g.id);
    }

    const res = await request(app.getHttpServer())
      .get('/api/guests/search')
      .query({ q: tag, limit: 5 })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);

    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.items.length).toBe(5);
    expect(res.body.items[0]).toHaveProperty('id');
    expect(res.body.items[0]).toHaveProperty('fullName');
    expect(res.body.items[0]).toHaveProperty('phone');
  });

  it('valide les règles métier : calcul serveur autoritaire, acompte + paiement + audit, capacité, dates et double réservation concurrente', async () => {
    const suffix = Date.now().toString().slice(-4);
    const room = await prisma.room.create({
      data: {
        number: `C1${suffix}`,
        typeId: roomTypeId,
        floor: 2,
        category: 'Deluxe',
        status: 'FREE',
        isActive: true,
        adultsCapacity: 2,
        childrenCapacity: 1,
        pricePerNight: 55000,
      },
    });
    createdRoomIds.push(room.id);

    const guest = await prisma.guest.create({
      data: {
        civility: 'Mme',
        firstName: 'Fatou',
        lastName: `Ndiaye${suffix}`,
        fullName: `Fatou Ndiaye${suffix}`,
        phone: `+221 78 310 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
      },
    });
    createdGuestIds.push(guest.id);

    // 1. Départ <= Arrivée refusé (400)
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2026-12-20',
        checkOutDate: '2026-12-19',
      })
      .expect(400);

    // 2. Capacité dépassée refusée (400)
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2026-12-20',
        checkOutDate: '2026-12-22',
        adultsCount: 4,
      })
      .expect(400);

    // 3. Création avec acompte + montant client falsifié (serveur recalcule!) + idempotency
    const idemKey = `res-e2e-${suffix}`;
    const res1 = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .set('Idempotency-Key', idemKey)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2026-12-20',
        checkOutDate: '2026-12-22',
        adultsCount: 2,
        childrenCount: 1,
        totalFcfa: 1000, // doit être ignoré par le calcul serveur !
        depositFcfa: 50000,
        paymentMethod: 'WAVE',
        transactionRef: `WV-${suffix}`,
        breakfastIncluded: true,
        source: 'WHATSAPP',
        notes: 'Arrivée tardive',
      })
      .expect(201);

    createdReservationIds.push(res1.body.id);
    // 2 nuits * 55000 + taxe (1000 * 2 adultes * 2 nuits = 4000) = 114000
    expect(res1.body.totalFcfa).toBe(114000);
    expect(res1.body.depositFcfa).toBe(50000);
    expect(res1.body.remainingFcfa).toBe(64000);
    expect(res1.body.paymentId).toBeTruthy();

    // Vérifier écritures AuditLog
    const audits = await prisma.auditLog.findMany({
      where: {
        OR: [
          { entity: 'Reservation', entityId: res1.body.id },
          { entity: 'Payment', entityId: res1.body.paymentId },
        ],
      },
    });
    expect(audits.some((a) => a.action === 'RESERVATION_CREATE')).toBe(true);
    expect(audits.some((a) => a.action === 'PAYMENT_CREATE')).toBe(true);

    // Replay idempotency ne crée pas de doublon
    const replay = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .set('Idempotency-Key', idemKey)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2026-12-20',
        checkOutDate: '2026-12-22',
        adultsCount: 2,
        childrenCount: 1,
      })
      .expect(201);
    expect(replay.body.id).toBe(res1.body.id);

    // 4. Double réservation séquentielle refusée (409 + message exact)
    const conflictRes = await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        roomId: room.id,
        guestId: guest.id,
        checkInDate: '2026-12-21',
        checkOutDate: '2026-12-23',
        adultsCount: 1,
      })
      .expect(409);
    expect(conflictRes.body.message).toContain(
      "Cette chambre vient d'être réservée, choisissez-en une autre",
    );

    // 5. Deux validations simultanées sur une période libre : une seule réussit (201), l'autre échoue (409)
    const [rA, rB] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          roomId: room.id,
          guestId: guest.id,
          checkInDate: '2027-01-05',
          checkOutDate: '2027-01-07',
          adultsCount: 2,
        }),
      request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          roomId: room.id,
          guestId: guest.id,
          checkInDate: '2027-01-05',
          checkOutDate: '2027-01-07',
          adultsCount: 2,
        }),
    ]);

    const statuses = [rA.status, rB.status].sort();
    expect(statuses).toEqual([201, 409]);
    const winner = rA.status === 201 ? rA : rB;
    const loser = rA.status === 409 ? rA : rB;
    createdReservationIds.push(winner.body.id);
    expect(loser.body.message).toContain(
      "Cette chambre vient d'être réservée, choisissez-en une autre",
    );
  }, 25000);

  it('Porte de sécurité : RBAC refusé par défaut, forbidNonWhitelisted (falsification tarif), rejet PAN bancaire et SQLi neutralisée', async () => {
    // 1. RBAC : rôle SERVEUR ou CUISINE refusé (403)
    await request(app.getHttpServer())
      .get('/api/rooms/available')
      .query({ checkIn: '2026-12-10', checkOut: '2026-12-12' })
      .set('Authorization', `Bearer ${roleTokens['SERVEUR']}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/guests/search')
      .query({ q: 'Diop' })
      .set('Authorization', `Bearer ${roleTokens['CUISINE']}`)
      .expect(403);

    // 2. Falsification de champs interdits (forbidNonWhitelisted) -> 400
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        roomId: '00000000-0000-0000-0000-000000000001',
        guestId: '00000000-0000-0000-0000-000000000002',
        checkInDate: '2027-02-01',
        checkOutDate: '2027-02-03',
        adultsCount: 1,
        totalFcfa: 100, // champ non autorisé dans le DTO
      })
      .expect(400);

    // 3. Numéro de carte bancaire (PAN) interdit dans transactionRef -> 400
    await request(app.getHttpServer())
      .post('/api/reservations')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        roomId: '00000000-0000-0000-0000-000000000001',
        guestId: '00000000-0000-0000-0000-000000000002',
        checkInDate: '2027-02-01',
        checkOutDate: '2027-02-03',
        adultsCount: 1,
        depositFcfa: 10000,
        paymentMethod: 'CARD',
        transactionRef: '4532 1111 2222 3333',
      })
      .expect(400);

    // 4. Tentative d'injection SQL sur GET /api/guests/search -> neutralisée par Prisma
    const sqliRes = await request(app.getHttpServer())
      .get('/api/guests/search')
      .query({ q: "' OR '1'='1; DROP TABLE users;--" })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(Array.isArray(sqliRes.body.items)).toBe(true);
    expect(sqliRes.body.items.length).toBeLessThanOrEqual(5);
  });
});
