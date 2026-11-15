import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ReservationStatus } from '@prisma/client';
import { issueDbTestToken } from './auth-test.helper';
import { randomUUID } from 'crypto';

// PNG 1x1 valide minimal
const TINY_PNG_BUFFER = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000004000000040802000000269309290000000970485973000003e8000003e801b57b526b0000000f4944415408996360c8284520e2380060130dd11622e1ad0000000049454e44ae426082',
  'hex',
);

describe('Restaurant V3 — Règles métier, Atomicité, RBAC, Photos & Historique (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const roleTokens: Record<string, string> = {};
  const createdGuestIds: string[] = [];
  const createdResIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdInvoiceIds: string[] = [];
  const createdProductIds: string[] = [];

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
    prisma = moduleFixture.get<PrismaService>(PrismaService);

    // Nettoyer d'éventuels résidus d'un run interrompu pour éviter les collisions de dates
    const staleRes = await prisma.reservation.findMany({
      where: { reference: { startsWith: 'RES-RST-' } },
      select: { id: true },
    });
    if (staleRes.length > 0) {
      const staleResIds = staleRes.map((r) => r.id);
      const staleInvs = await prisma.invoice.findMany({
        where: { reservationId: { in: staleResIds } },
        select: { id: true },
      });
      const staleInvIds = staleInvs.map((i) => i.id);
      if (staleInvIds.length > 0) {
        await prisma.restaurantOrderLine.deleteMany({
          where: { order: { invoiceId: { in: staleInvIds } } },
        });
        await prisma.restaurantOrder.deleteMany({
          where: { invoiceId: { in: staleInvIds } },
        });
        await prisma.payment.deleteMany({ where: { invoiceId: { in: staleInvIds } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: staleInvIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: staleInvIds } } });
      }
      await prisma.reservation.deleteMany({ where: { id: { in: staleResIds } } });
    }

    for (const r of [
      'DIRECTION',
      'RECEPTION',
      'COMPTABLE',
      'RESTAURANT',
      'SERVEUR',
      'CUISINE',
      'CUISINIER',
      'HOUSEKEEPING',
      'MAINTENANCE',
    ]) {
      roleTokens[r] = (await issueDbTestToken(prisma, r)).token;
    }
  }, 30000);

  afterAll(async () => {
    if (prisma) {
      if (createdOrderIds.length > 0) {
        const orders = await prisma.restaurantOrder.findMany({
          where: { id: { in: createdOrderIds } },
          select: { id: true, invoiceId: true },
        });
        for (const o of orders) {
          if (o.invoiceId) createdInvoiceIds.push(o.invoiceId);
        }
        await prisma.restaurantOrderLine.deleteMany({
          where: { orderId: { in: createdOrderIds } },
        });
        await prisma.restaurantOrder.deleteMany({
          where: { id: { in: createdOrderIds } },
        });
      }
      if (createdResIds.length > 0) {
        const resInvs = await prisma.invoice.findMany({
          where: { reservationId: { in: createdResIds } },
          select: { id: true },
        });
        for (const ri of resInvs) createdInvoiceIds.push(ri.id);
      }
      const uniqueInvIds = Array.from(new Set(createdInvoiceIds));
      if (uniqueInvIds.length > 0) {
        await prisma.payment.deleteMany({ where: { invoiceId: { in: uniqueInvIds } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: uniqueInvIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: uniqueInvIds } } });
      }
      if (createdResIds.length > 0) {
        await prisma.reservation.deleteMany({ where: { id: { in: createdResIds } } });
      }
      if (createdGuestIds.length > 0) {
        await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds } } });
      }
      if (createdProductIds.length > 0) {
        await prisma.restaurantOrderLine.deleteMany({
          where: { productId: { in: createdProductIds } },
        });
        await prisma.restaurantProduct.deleteMany({
          where: { id: { in: createdProductIds } },
        });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('imputée sur chambre en CHECKED_IN ajoute la ligne Restaurant à la note une seule fois et refuse sans séjour actif', async () => {
    const rooms = await prisma.room.findMany({ take: 2, orderBy: { number: 'asc' } });
    const roomInStay = rooms[0];
    const roomConfirmedOnly = rooms[1];

    const g1 = await prisma.guest.create({
      data: {
        civility: 'M.',
        firstName: 'Ibrahima',
        lastName: `RestoInt_${Date.now()}`,
        fullName: `Ibrahima RestoInt_${Date.now()}`,
        phone: `+22177${Math.floor(1000000 + Math.random() * 8999999)}`,
      },
    });
    createdGuestIds.push(g1.id);

    const baseDate = new Date(Date.now() + 90 * 86400000);
    const checkOutDate = new Date(baseDate.getTime() + 2 * 86400000);

    const resCheckedIn = await prisma.reservation.create({
      data: {
        reference: `RES-RST-${Date.now()}-1`,
        guestId: g1.id,
        roomId: roomInStay.id,
        checkInDate: baseDate,
        checkOutDate,
        nights: 2,
        status: ReservationStatus.CHECKED_IN,
        totalFcfa: 70000,
      },
    });
    createdResIds.push(resCheckedIn.id);

    const resConfirmed = await prisma.reservation.create({
      data: {
        reference: `RES-RST-${Date.now()}-2`,
        guestId: g1.id,
        roomId: roomConfirmedOnly.id,
        checkInDate: new Date(baseDate.getTime() + 5 * 86400000),
        checkOutDate: new Date(baseDate.getTime() + 7 * 86400000),
        nights: 2,
        status: ReservationStatus.CONFIRMED,
        totalFcfa: 70000,
      },
    });
    createdResIds.push(resConfirmed.id);

    const prod = await request(app.getHttpServer())
      .post('/api/restaurant/products')
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({
        name: `Poulet Grillé Test ${Date.now()}`,
        categoryName: 'Plats sénégalais & Mer',
        priceFcfa: 5500,
        prepStation: 'CUISINE',
      })
      .expect(201);
    createdProductIds.push(prod.body.id);

    // 1. Refus si réservation CONFIRMED uniquement (non check-in)
    await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({
        destinationType: 'ROOM',
        roomId: roomConfirmedOnly.id,
        reservationId: resConfirmed.id,
        action: 'ROOM_CHARGE',
        items: [{ productId: prod.body.id, quantity: 1 }],
      })
      .expect(400);

    // 2. Succès en transaction unique + idempotence sur CHECKED_IN
    const idem = randomUUID();
    const payload = {
      destinationType: 'ROOM',
      roomId: roomInStay.id,
      reservationId: resCheckedIn.id,
      action: 'ROOM_CHARGE',
      items: [{ productId: prod.body.id, quantity: 2, unitPriceFcfa: 999999 }], // prix client ignoré
    };

    const r1 = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .set('Idempotency-Key', idem)
      .send(payload)
      .expect(201);
    createdOrderIds.push(r1.body.id);
    expect(r1.body.totalTtcFcfa).toBe(11000); // Prix serveur 5500 x 2
    expect(r1.body.invoiceId).toBeTruthy();
    createdInvoiceIds.push(r1.body.invoiceId);

    const r2 = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .set('Idempotency-Key', idem)
      .send(payload)
      .expect(201);
    expect(r2.body.id).toBe(r1.body.id);

    const invLines = await prisma.invoiceLine.findMany({
      where: { invoiceId: r1.body.invoiceId, sourceOrderId: r1.body.id },
    });
    expect(invLines).toHaveLength(1);
    expect(invLines[0].category).toBe('RESTAURANT');
    expect(invLines[0].totalPriceFcfa).toBe(11000);

    // 3. Changer le prix du produit ne modifie jamais la commande passée
    await request(app.getHttpServer())
      .patch(`/api/restaurant/products/${prod.body.id}`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({ priceFcfa: 7000 })
      .expect(200);

    const orderLineAfter = await prisma.restaurantOrderLine.findFirst({
      where: { orderId: r1.body.id },
    });
    expect(orderLineAfter?.unitPriceFcfa).toBe(5500);
    expect(orderLineAfter?.totalPriceFcfa).toBe(11000);

    // 4. Produit avec historique non supprimable -> 409 Conflict
    const delRes = await request(app.getHttpServer())
      .delete(`/api/restaurant/products/${prod.body.id}`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .expect(409);
    expect(String(delRes.body.message)).toContain('Désactiver');

    // 5. Désactivation réussit et journalisée
    await request(app.getHttpServer())
      .patch(`/api/restaurant/products/${prod.body.id}`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({ status: 'ARCHIVED' })
      .expect(200);
  });

  it('encaissement table / à emporter crée commande + paiement + note Client de passage et contrôle strict des rôles (403)', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/restaurant/products')
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({
        name: `Jus Mangue Test ${Date.now()}`,
        categoryName: 'Boissons & Cocktails',
        priceFcfa: 2000,
        prepStation: 'BAR',
      })
      .expect(201);
    createdProductIds.push(prod.body.id);

    // Rôles 403 : GOUVERNANTE (HOUSEKEEPING) et TECHNIQUE (MAINTENANCE) interdits partout
    for (const role of ['HOUSEKEEPING', 'MAINTENANCE']) {
      await request(app.getHttpServer())
        .get('/api/restaurant/catalog')
        .set('Authorization', `Bearer ${roleTokens[role]}`)
        .expect(403);
      await request(app.getHttpServer())
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${roleTokens[role]}`)
        .send({ destinationType: 'TAKEAWAY', items: [{ productId: prod.body.id, quantity: 1 }] })
        .expect(403);
    }

    // Carte réservée à DIRECTION : RESTAURANT / RECEPTION / COMPTABLE -> 403
    for (const role of ['RESTAURANT', 'RECEPTION', 'COMPTABLE', 'CUISINE', 'SERVEUR']) {
      await request(app.getHttpServer())
        .post('/api/restaurant/products')
        .set('Authorization', `Bearer ${roleTokens[role]}`)
        .send({ name: 'Interdit', priceFcfa: 1000 })
        .expect(403);
    }

    // COMPTABLE lecture autorisée (200), mutation refusée (403)
    await request(app.getHttpServer())
      .get('/api/restaurant/orders/page?offset=0&limit=50')
      .set('Authorization', `Bearer ${roleTokens['COMPTABLE']}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['COMPTABLE']}`)
      .send({ destinationType: 'TAKEAWAY', items: [{ productId: prod.body.id, quantity: 1 }] })
      .expect(403);

    // PAN rejeté en référence de paiement
    await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({
        destinationType: 'TAKEAWAY',
        action: 'PAY',
        paymentMethod: 'CARD',
        paymentRef: '4532 1234 5678 9012',
        items: [{ productId: prod.body.id, quantity: 1 }],
      })
      .expect(400);

    // Encaissement À emporter en une transaction -> note "Client de passage" + paiement
    const paidOrder = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        destinationType: 'TAKEAWAY',
        action: 'PAY',
        paymentMethod: 'WAVE',
        paymentRef: 'WAV-RESTO-123',
        items: [{ productId: prod.body.id, quantity: 2 }],
      })
      .expect(201);
    createdOrderIds.push(paidOrder.body.id);
    expect(paidOrder.body.invoiceId).toBeTruthy();
    createdInvoiceIds.push(paidOrder.body.invoiceId);

    const inv = await prisma.invoice.findUnique({
      where: { id: paidOrder.body.invoiceId },
      include: { payments: true },
    });
    expect(inv?.billingCompanyName).toBe('Client de passage');
    expect(inv?.totalFcfa).toBe(4000);
    expect(inv?.balanceFcfa).toBe(0);
    expect(inv?.payments).toHaveLength(1);
    expect(inv?.payments[0].method).toBe('WAVE');

    // CUISINE : lecture sans montant et progression d'état
    const kitchenOrders = await request(app.getHttpServer())
      .get('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['CUISINE']}`)
      .expect(200);
    const kOrd = kitchenOrders.body.find((o: any) => o.id === paidOrder.body.id);
    expect(kOrd).toBeTruthy();
    expect(kOrd.totalTtcFcfa).toBeUndefined();

    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${paidOrder.body.id}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINE']}`)
      .send({ status: 'IN_PREPARATION' })
      .expect(200);

    // Annulation réservée à DIRECTION / RECEPTION et motif obligatoire
    await request(app.getHttpServer())
      .post(`/api/restaurant/orders/${paidOrder.body.id}/cancel`)
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({ reason: 'Erreur serveur' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/restaurant/orders/${paidOrder.body.id}/cancel`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({ reason: '' })
      .expect(400);

    const cancelOk = await request(app.getHttpServer())
      .post(`/api/restaurant/orders/${paidOrder.body.id}/cancel`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({ reason: 'Client parti avant préparation' })
      .expect(200);
    expect(cancelOk.body.status).toBe('CANCELLED');
    expect(cancelOk.body.cancellationReason).toBe('Client parti avant préparation');
  });

  it('téléversement photo produit : rejette polyglotte, génère miniature 200px et supprime l’ancienne image', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/restaurant/products')
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({
        name: `Salade Fraîche ${Date.now()}`,
        categoryName: 'Entrées & Tapas',
        priceFcfa: 3000,
      })
      .expect(201);
    createdProductIds.push(prod.body.id);

    // Payload texte malveillant déguisé en .png
    await request(app.getHttpServer())
      .post(`/api/restaurant/products/${prod.body.id}/image`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .attach('image', Buffer.from('<script>alert(1)</script>'), 'malveillant.png')
      .expect(400);

    // Upload image PNG valide 1
    const up1 = await request(app.getHttpServer())
      .post(`/api/restaurant/products/${prod.body.id}/image`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .attach('image', TINY_PNG_BUFFER, 'plat1.png')
      .expect(201);

    expect(up1.body.photoUrl).toMatch(/^\/api\/restaurant\/products\/images\/[0-9a-f-]{36}\.webp$/);
    expect(up1.body.thumbnailUrl).toMatch(/^\/api\/restaurant\/products\/images\/[0-9a-f-]{36}-200\.webp$/);

    const oldMainName = up1.body.photoUrl.split('/').pop()!;
    const oldThumbName = up1.body.thumbnailUrl.split('/').pop()!;
    const uploadDir = path.resolve(
      process.env.RESTAURANT_MEDIA_DIR ||
        path.resolve(process.env.MEDIA_DIR || 'uploads/rooms', '..', 'restaurant'),
    );
    expect(fs.existsSync(`${uploadDir}/${oldMainName}`)).toBe(true);
    expect(fs.existsSync(`${uploadDir}/${oldThumbName}`)).toBe(true);

    // Remplacement par image 2 -> anciennes supprimées du disque
    const up2 = await request(app.getHttpServer())
      .post(`/api/restaurant/products/${prod.body.id}/image`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .attach('image', TINY_PNG_BUFFER, 'plat2.png')
      .expect(201);

    expect(up2.body.photoUrl).not.toBe(up1.body.photoUrl);
    expect(fs.existsSync(`${uploadDir}/${oldMainName}`)).toBe(false);
    expect(fs.existsSync(`${uploadDir}/${oldThumbName}`)).toBe(false);

    // Suppression propre du produit sans historique supprime aussi les nouvelles images
    await request(app.getHttpServer())
      .delete(`/api/restaurant/products/${prod.body.id}`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .expect(200);
    const idx = createdProductIds.indexOf(prod.body.id);
    if (idx >= 0) createdProductIds.splice(idx, 1);
  });

  it('flux cuisine & rôle CUISINIER : filtrage strict sans prix ni client, transitions 409, concurrence atomique et clôture >12h', async () => {
    const prod = await request(app.getHttpServer())
      .post('/api/restaurant/products')
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({
        name: `Spaghetti Bolognaise ${Date.now()}`,
        categoryName: 'Plats sénégalais & Mer',
        priceFcfa: 4500,
        prepStation: 'CUISINE',
      })
      .expect(201);
    createdProductIds.push(prod.body.id);

    // 1. CUISINIER reçoit 403 sur catalog, création commande, paiement, annulation ; RECEPTION et RESTAURANT reçoivent 403 sur /api/cuisine/* et /api/restaurant/kitchen/orders
    await request(app.getHttpServer())
      .get('/api/restaurant/catalog')
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ destinationType: 'TABLE', tableLabel: 'Table 2', items: [{ productId: prod.body.id, quantity: 4 }] })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/restaurant/kitchen/orders')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/restaurant/kitchen/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .expect(200);

    // 2. Assistant crée une commande de 4 spaghettis
    const created = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({
        destinationType: 'TABLE',
        tableLabel: 'Table 2',
        items: [{ productId: prod.body.id, quantity: 4, notes: 'Sans piment' }],
      })
      .expect(201);
    const orderId = created.body.id;
    createdOrderIds.push(orderId);
    expect(created.body.statut).toBe('ENVOYEE');
    expect(created.body.envoyeeAt).toBeTruthy();

    // 3. CUISINIER lit les commandes : aucun prix, aucun total, aucun nom client
    const kitchenList = await request(app.getHttpServer())
      .get('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .expect(200);
    const kOrder = kitchenList.body.find((o: any) => o.id === orderId);
    expect(kOrder).toBeTruthy();
    expect(kOrder.totalTtcFcfa).toBeUndefined();
    expect(kOrder.subtotalHtFcfa).toBeUndefined();
    expect(kOrder.guestName).toBeUndefined();
    expect(kOrder.items[0].unitPriceFcfa).toBeUndefined();
    expect(kOrder.items[0].totalPriceFcfa).toBeUndefined();
    expect(kOrder.items[0].quantity).toBe(4);
    expect(kOrder.items[0].notes).toBe('Sans piment');

    // 4. Transition invalide directe Envoyée -> Prête refusée en 409
    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ status: 'READY' })
      .expect(409);

    // 5. Prise en charge concurrente par deux cuisiniers : 1 seul 200, l'autre 409
    const [claim1, claim2] = await Promise.all([
      request(app.getHttpServer())
        .patch(`/api/restaurant/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
        .send({ status: 'IN_PREPARATION', prepTimeMinutes: 15 }),
      request(app.getHttpServer())
        .patch(`/api/restaurant/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${roleTokens['CUISINE']}`)
        .send({ status: 'IN_PREPARATION', prepTimeMinutes: 20 }),
    ]);
    const statuses = [claim1.status, claim2.status].sort();
    expect(statuses).toEqual([200, 409]);

    // 6. Ajustement +5 min en cours de préparation
    const adjusted = await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ status: 'IN_PREPARATION', addMinutes: 5 })
      .expect(200);
    expect([20, 25]).toContain(adjusted.body.tempsPreparationMinutes);
    expect(adjusted.body.heureFinPrevue).toBeTruthy();

    // 7. CUISINIER marque Prête (200), mais ne peut pas autoriser (403), marquer Servie (403) ni Annuler (403)
    const readyRes = await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ status: 'READY' })
      .expect(200);
    expect(readyRes.body.statut).toBe('PRETE');
    expect(readyRes.body.preteAt).toBeTruthy();

    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ status: 'AUTHORIZED' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ status: 'SERVED' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/restaurant/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({ reason: 'Tentative cuisinier' })
      .expect(403);

    // 8. Annulation depuis Prête refusée en 409 même pour RECEPTION
    await request(app.getHttpServer())
      .post(`/api/restaurant/orders/${orderId}/cancel`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({ reason: 'Trop tard déjà prête' })
      .expect(409);

    // 9. Assistant autorise le service (AUTHORIZED) puis marque Servie (SERVED)
    const authRes = await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({ status: 'AUTHORIZED' })
      .expect(200);
    expect(authRes.body.statut).toBe('AUTORISEE');
    expect(authRes.body.autoriseAt).toBeTruthy();

    const servedRes = await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({ status: 'SERVED' })
      .expect(200);
    expect(servedRes.body.statut).toBe('SERVIE');
    expect(servedRes.body.serviAt).toBeTruthy();
    expect(Array.isArray(servedRes.body.events)).toBe(true);
    expect(servedRes.body.events[0].type).toBe('SERVIE');

    // 9b. Signalement plat indisponible + modification par l'assistant
    const unavailOrderRes = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({
        destinationType: 'TABLE',
        tableLabel: 'Table 5',
        items: [{ productId: prod.body.id, quantity: 2 }],
      })
      .expect(201);
    createdOrderIds.push(unavailOrderRes.body.id);

    const reportedRes = await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${unavailOrderRes.body.id}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .send({
        unavailableLineIds: [unavailOrderRes.body.items[0].id],
        unavailableReason: 'plus de pâtes',
      })
      .expect(200);
    expect(reportedRes.body.hasUnavailableItems).toBe(true);
    expect(reportedRes.body.events[0].type).toBe('PLAT_INDISPONIBLE');

    const modifiedRes = await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${unavailOrderRes.body.id}/items`)
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT']}`)
      .send({
        items: [{ productId: prod.body.id, quantity: 1 }],
      })
      .expect(200);
    expect(modifiedRes.body.hasUnavailableItems).toBe(false);
    expect(modifiedRes.body.events[0].type).toBe('COMMANDE_MODIFIEE');

    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
      .send({ status: 'IN_PREPARATION' })
      .expect(409);

    // 10. Commande ancienne (> 12h) masquée au cuisinier et listée dans /orders/stale pour clôture
    const thirteenHoursAgo = new Date(Date.now() - 13 * 60 * 60 * 1000);
    const staleOrder = await prisma.restaurantOrder.create({
      data: {
        ticketNumber: `#CMD-OLD-${Date.now().toString().slice(-4)}`,
        destinationType: 'TABLE',
        tableLabel: 'Table 9',
        guestName: 'Client veille',
        serverName: 'Service Veille',
        status: 'PENDING',
        statut: 'ENVOYEE',
        createdAt: thirteenHoursAgo,
        envoyeeAt: thirteenHoursAgo,
        subtotalHtFcfa: 4091,
        vatAmountFcfa: 409,
        totalTtcFcfa: 4500,
      },
    });
    createdOrderIds.push(staleOrder.id);

    const kitchenAfterStale = await request(app.getHttpServer())
      .get('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['CUISINIER']}`)
      .expect(200);
    expect(kitchenAfterStale.body.some((o: any) => o.id === staleOrder.id)).toBe(false);

    const staleList = await request(app.getHttpServer())
      .get('/api/restaurant/orders/stale')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .expect(200);
    expect(staleList.body.some((o: any) => o.id === staleOrder.id)).toBe(true);

    const closedStale = await request(app.getHttpServer())
      .post(`/api/restaurant/orders/${staleOrder.id}/close-stale`)
      .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
      .send({ reason: 'Fin de service veille non clôturée' })
      .expect(200);
    expect(closedStale.body.status).toBe('CANCELLED');
    expect(closedStale.body.statut).toBe('ANNULEE');
  });
});
