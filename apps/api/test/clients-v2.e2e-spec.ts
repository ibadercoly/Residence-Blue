import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { issueDbTestToken } from './auth-test.helper';

describe('Clients V2 Fluide API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const createdGuestIds: string[] = [];
  const createdRoomIds: string[] = [];
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
      }),
    );
    await app.init();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    for (const r of ['DIRECTION', 'RECEPTION', 'CUISINE']) {
      roleTokens[r] = (await issueDbTestToken(prisma, r)).token;
    }
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (createdGuestIds.length > 0) {
        await prisma.reservation.deleteMany({
          where: { guestId: { in: createdGuestIds } },
        });
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

  it('crée rapidement (nom + téléphone), recherche par nom/téléphone/pièce, pagine par curseur et filtre En séjour / À venir', async () => {
    const suffix = Date.now().toString().slice(-5);
    const g1Res = await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        fullName: `Awa Ndiaye ${suffix}`,
        phone: `+221 77 310 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
        idDocumentNumber: `CNI-V2-${suffix}`,
      })
      .expect(201);
    const g1Id = g1Res.body.id;
    createdGuestIds.push(g1Id);
    expect(g1Res.body.idDocumentMasked).toMatch(/^\*\*\*\*/);
    expect(g1Res.body.version).toBe(1);

    const g2Res = await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        fullName: `Bocar Fall ${suffix}`,
        phone: `+221 78 420 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
      })
      .expect(201);
    const g2Id = g2Res.body.id;
    createdGuestIds.push(g2Id);

    // Recherche par nom
    const byName = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: `Awa Ndiaye ${suffix}` })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(byName.body.items.some((g: any) => g.id === g1Id)).toBe(true);
    expect(byName.body.stats).toBeDefined();

    // Recherche par téléphone
    const byPhone = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: '78 420' })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(byPhone.body.items.some((g: any) => g.id === g2Id)).toBe(true);

    // Recherche par numéro de pièce
    const byDoc = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: `CNI-V2-${suffix}` })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(byDoc.body.items.some((g: any) => g.id === g1Id)).toBe(true);

    // Curseur (lot de 1)
    const page1 = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: suffix, limit: 1 })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(page1.body.items.length).toBe(1);
    expect(page1.body.nextCursor).toBeTruthy();

    const page2 = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ search: suffix, limit: 1, cursor: page1.body.nextCursor })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(page2.body.items.length).toBe(1);
    expect(page2.body.items[0].id).not.toBe(page1.body.items[0].id);

    // Filtres En séjour / À venir
    let roomType = await prisma.roomType.findFirst();
    if (!roomType) {
      roomType = await prisma.roomType.create({
        data: { name: `Standard-${suffix}`, pricePerNight: 35000 },
      });
    }
    const room = await prisma.room.create({
      data: {
        number: `9${suffix.slice(0, 2)}`,
        typeId: roomType.id,
        floor: 1,
        category: 'Standard',
      },
    });
    createdRoomIds.push(room.id);

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 2);
    const futureOut = new Date(tomorrow);
    futureOut.setDate(tomorrow.getDate() + 2);

    await prisma.reservation.create({
      data: {
        reference: `RES-IN-${suffix}`,
        guestId: g1Id,
        roomId: room.id,
        checkInDate: today,
        checkOutDate: tomorrow,
        nights: 2,
        status: 'CHECKED_IN',
        totalFcfa: 70000,
      },
    });

    await prisma.reservation.create({
      data: {
        reference: `RES-UP-${suffix}`,
        guestId: g2Id,
        roomId: room.id,
        checkInDate: tomorrow,
        checkOutDate: futureOut,
        nights: 2,
        status: 'CONFIRMED',
        totalFcfa: 70000,
      },
    });

    const inStayRes = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ filter: 'IN_STAY', search: suffix })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(inStayRes.body.items.map((g: any) => g.id)).toContain(g1Id);
    expect(inStayRes.body.items.map((g: any) => g.id)).not.toContain(g2Id);

    const upcomingRes = await request(app.getHttpServer())
      .get('/api/guests')
      .query({ filter: 'UPCOMING', search: suffix })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(upcomingRes.body.items.map((g: any) => g.id)).toContain(g2Id);
    expect(upcomingRes.body.items.map((g: any) => g.id)).not.toContain(g1Id);

    // Suppression refusée car historique présent (409)
    const delConflict = await request(app.getHttpServer())
      .delete(`/api/guests/${g1Id}`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .expect(409);
    expect(delConflict.body.message).toContain('ne peut pas être supprimé');
  });

  it('détecte les doublons, gère la modification partielle + conflit de version, masque la pièce et protège la suppression', async () => {
    const suffix = Date.now().toString().slice(-5);
    const created = await request(app.getHttpServer())
      .post('/api/guests')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({
        fullName: `Cheikh Diop ${suffix}`,
        phone: `+221 76 555 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}`,
        idDocumentNumber: `PASS-${suffix}-99`,
      })
      .expect(201);
    const guestId = created.body.id;
    createdGuestIds.push(guestId);

    // Détection doublon
    const dupRes = await request(app.getHttpServer())
      .get('/api/guests/check-duplicate')
      .query({ phone: `76 555 ${suffix.slice(0, 2)} ${suffix.slice(2, 4)}` })
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(dupRes.body.duplicate?.id).toBe(guestId);

    // Modification partielle d'un seul champ (note interne) avec version=1
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/guests/${guestId}`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({ internalNote: 'Client calme', expectedVersion: 1 })
      .expect(200);
    expect(patchRes.body.internalNote).toBe('Client calme');
    expect(patchRes.body.version).toBe(2);

    // Conflit de version (expectedVersion obsolète = 1)
    const conflictRes = await request(app.getHttpServer())
      .patch(`/api/guests/${guestId}`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({ nationality: 'Malienne', expectedVersion: 1 })
      .expect(409);
    expect(conflictRes.body.code).toBe('VERSION_CONFLICT');

    // Rôle non autorisé (CUISINE) ne peut ni lire la fiche ni révéler la pièce
    await request(app.getHttpServer())
      .get(`/api/guests/${guestId}`)
      .set('Authorization', `Bearer ${roleTokens['CUISINE']}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/guests/${guestId}/reveal-document`)
      .set('Authorization', `Bearer ${roleTokens['CUISINE']}`)
      .expect(403);

    // RECEPTION peut révéler (et c'est journalisé)
    const revealRes = await request(app.getHttpServer())
      .post(`/api/guests/${guestId}/reveal-document`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(revealRes.body.idDocumentNumber).toBe(`PASS-${suffix}-99`);

    // Suppression refusée pour RECEPTION (403)
    await request(app.getHttpServer())
      .delete(`/api/guests/${guestId}`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(403);

    // Suppression autorisée pour DIRECTION (sans historique)
    await request(app.getHttpServer())
      .delete(`/api/guests/${guestId}`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .expect(200);

    const idx = createdGuestIds.indexOf(guestId);
    if (idx !== -1) createdGuestIds.splice(idx, 1);
  }, 20000);
});
