import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { issueDbTestToken } from './auth-test.helper';

describe('Notifications dans la cloche — API, Sécurité & Temps Réel (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let notificationsService: NotificationsService;

  const roleTokens: Record<string, { token: string; userId: string }> = {};
  const createdOrderIds: string[] = [];
  const createdGuestIds: string[] = [];
  const createdResIds: string[] = [];

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
    notificationsService = moduleFixture.get<NotificationsService>(NotificationsService);

    for (const role of [
      'DIRECTION',
      'RECEPTION',
      'RESTAURANT',
      'CUISINIER',
      'HOUSEKEEPING',
      'MAINTENANCE',
      'COMPTABLE',
    ]) {
      roleTokens[role] = await issueDbTestToken(prisma, role, {
        email: `notif.test.${role.toLowerCase()}@residenceblue.sn`,
      });
    }
  });

  afterAll(async () => {
    if (createdOrderIds.length > 0) {
      await prisma.notificationMessage.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.restaurantOrderEvent.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.restaurantOrderLine.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      });
      await prisma.restaurantOrder.deleteMany({
        where: { id: { in: createdOrderIds } },
      });
    }
    if (createdResIds.length > 0) {
      await prisma.reservation.deleteMany({ where: { id: { in: createdResIds } } });
    }
    if (createdGuestIds.length > 0) {
      await prisma.guest.deleteMany({ where: { id: { in: createdGuestIds } } });
    }
    await app.close();
  });

  it('refuse sans jeton (401) et bloque CUISINIER, HOUSEKEEPING, MAINTENANCE et COMPTABLE (403)', async () => {
    await request(app.getHttpServer()).get('/api/notifications').expect(401);
    await request(app.getHttpServer()).post('/api/notifications/read-all').expect(401);

    for (const deniedRole of ['CUISINIER', 'HOUSEKEEPING', 'MAINTENANCE', 'COMPTABLE']) {
      await request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${roleTokens[deniedRole].token}`)
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${roleTokens[deniedRole].token}`)
        .expect(403);

      expect(() =>
        notificationsService.getUserStream({
          id: roleTokens[deniedRole].userId,
          role: deniedRole,
        }),
      ).toThrow();
    }
  });

  it('génère les messages serveur sans prix, sans nom pour table/emporter, avec sync lecture multi-appareils et RETARD unique', async () => {
    // 1. Créer une commande Table par RESTAURANT
    const tableOrderRes = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .send({
        ticketNumber: `#CMD-CL-${Date.now().toString().slice(-4)}`,
        destinationType: 'TABLE',
        tableLabel: 'Table 4',
        items: [
          { name: 'Thiéboudienne royale', quantity: 1, unitPriceFcfa: 4500 },
          { name: 'Yassa poulet', quantity: 2, unitPriceFcfa: 4000 },
          { name: 'Thiakry', quantity: 1, unitPriceFcfa: 1500 },
        ],
      })
      .expect(201);

    const tableOrderId = tableOrderRes.body.id;
    createdOrderIds.push(tableOrderId);

    // 2. Le cuisinier accepte avec 15 min -> UN SEUL message PLAT_CONFIRME_TEMPS
    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${tableOrderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER'].token}`)
      .send({ status: 'IN_PREPARATION', tempsPreparationMinutes: 15 })
      .expect(200);

    // 3. Le cuisinier ajoute +5 min -> message TEMPS_AJOUTE
    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${tableOrderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER'].token}`)
      .send({ addMinutes: 5 })
      .expect(200);

    // 4. Vérifier GET /api/notifications par RESTAURANT & RECEPTION & DIRECTION
    const listRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .expect(200);

    const orderNotifs = (listRes.body.items as any[]).filter((n) => n.orderId === tableOrderId);
    expect(orderNotifs.some((n) => n.type === 'PLAT_CONFIRME_TEMPS')).toBe(true);
    expect(orderNotifs.some((n) => n.type === 'TEMPS_AJOUTE')).toBe(true);
    expect(
      orderNotifs.some((n) => /tous les plats existent/i.test(n.title)),
    ).toBe(false);

    const confirmMsg = orderNotifs.find((n) => n.type === 'PLAT_CONFIRME_TEMPS')!;
    expect(confirmMsg.title).toContain('1 Thiéboudienne royale, 2 Yassa poulet et 1 autre plat');
    expect(confirmMsg.detail).toBe('Table 4');
    expect(confirmMsg.importantAlert).toBe(false);
    expect(JSON.stringify(confirmMsg)).not.toMatch(/FCFA|unitPrice|totalTtc|4500|4000/);

    // 5. Lecture sur un appareil (RESTAURANT token) -> persistée côté serveur pour ce même userId, sans affecter RECEPTION
    await request(app.getHttpServer())
      .post(`/api/notifications/${confirmMsg.id}/read`)
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .expect(200);

    const secondDeviceRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .expect(200);
    const sameCardDevice2 = (secondDeviceRes.body.items as any[]).find(
      (n) => n.id === confirmMsg.id,
    );
    expect(sameCardDevice2.read).toBe(true);
    expect(sameCardDevice2.readAt).toBeTruthy();

    const receptionListRes = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION'].token}`)
      .expect(200);
    const cardForReception = (receptionListRes.body.items as any[]).find(
      (n) => n.id === confirmMsg.id,
    );
    expect(cardForReception.read).toBe(false);

    // 6. Simuler un retard (heureFinPrevue passée de 4 min) -> un seul RETARD créé
    await prisma.restaurantOrder.update({
      where: { id: tableOrderId },
      data: { heureFinPrevue: new Date(Date.now() - 4 * 60_000) },
    });
    const createdDelay1 = await notificationsService.checkOverdueOrders(new Date());
    const createdDelay2 = await notificationsService.checkOverdueOrders(new Date());
    expect(createdDelay1).toBe(1);
    expect(createdDelay2).toBe(0);

    // 7. Marquer prête -> importantAlert = true
    await request(app.getHttpServer())
      .patch(`/api/restaurant/orders/${tableOrderId}/status`)
      .set('Authorization', `Bearer ${roleTokens['CUISINIER'].token}`)
      .send({ status: 'READY' })
      .expect(200);

    const afterReady = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${roleTokens['RECEPTION'].token}`)
      .expect(200);
    const readyNotif = (afterReady.body.items as any[]).find(
      (n) => n.orderId === tableOrderId && n.type === 'PRETE',
    );
    expect(readyNotif).toBeTruthy();
    expect(readyNotif.importantAlert).toBe(true);
    expect(readyNotif.title).toMatch(/^Prête à servir : /);

    // 8. Tout marquer comme lu -> unreadCount = 0
    await request(app.getHttpServer())
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .expect(200);

    const afterAllRead = await request(app.getHttpServer())
      .get('/api/notifications')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .expect(200);
    expect(afterAllRead.body.unreadCount).toBe(0);

    // 9. Flux SSE émet pour RESTAURANT/RECEPTION et valide UUID sur :id/read
    await request(app.getHttpServer())
      .post('/api/notifications/not-a-uuid/read')
      .set('Authorization', `Bearer ${roleTokens['RESTAURANT'].token}`)
      .expect(400);

    const streamUser = {
      id: roleTokens['RESTAURANT'].userId,
      role: 'RESTAURANT',
      screenAccess: { restaurant: 'ECRITURE' },
      specialPermissions: { voir_montants: true },
    };
    const streamPromise = firstValueFrom(
      notificationsService.getUserStream(streamUser).pipe(take(1), toArray()),
    );
    await notificationsService.notifyOrderCancelled(
      {
        id: tableOrderId,
        ticketNumber: '#CMD-STRM',
        destinationType: 'TAKEAWAY',
        items: [{ name: 'Thiakry', quantity: 1 }],
      },
      'Test flux annulation',
    );
    const received = await streamPromise;
    expect(received[0].type).toBe('NOTIFICATION_CREATED');
    expect(received[0].notification?.title).toBe(
      'Commande annulée : 1 Thiakry. Motif : Test flux annulation',
    );
    expect(received[0].notification?.detail).toBe('À emporter N° STRM');
  });
});
