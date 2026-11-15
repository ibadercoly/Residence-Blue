import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedAll } from '../prisma/seed';
import { getUploadsDir as getRoomsUploadDir } from '../src/rooms/rooms-image.util';
import { isValidPasswordHash } from '../src/auth/password-hash.util';
import { issueDbTestToken } from './auth-test.helper';

describe('Persistance Complète de Bout en Bout (chore/audit-persistance)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const roleTokens: Record<string, string> = {};

  const samplePngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );

  async function bootstrapTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const nestApp = moduleFixture.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nestApp.init();
    const prismaSvc = moduleFixture.get<PrismaService>(PrismaService);
    return { app: nestApp, prisma: prismaSvc };
  }

  beforeAll(async () => {
    const booted = await bootstrapTestApp();
    app = booted.app;
    prisma = booted.prisma;
    await seedAll(prisma);
    for (const r of ['DIRECTION', 'RECEPTION', 'SERVEUR']) {
      roleTokens[r] = (await issueDbTestToken(prisma, r)).token;
    }
  }, 90000);

  afterAll(async () => {
    // Restaurer l'état propre du seed à la fin de la suite
    if (prisma) {
      await seedAll(prisma);
    }
    if (app) {
      await app.close();
    }
  }, 90000);

  describe('1. Utilisateur & Connexion : création, hachage, redémarrage API, lecture Prisma, modification, suppression', () => {
    let createdUserId: string;
    const testEmail = `persistance.user.${Date.now()}@residenceblue.sn`;

    it('crée un utilisateur via POST /api/users, hache le mot de passe, survit au redémarrage API et permet la connexion', async () => {
      // 1. Création
      const createRes = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({
          email: testEmail,
          fullName: 'Ousmane Kane',
          jobTitle: 'Réceptionniste Nuit',
          password: 'PasswordSecurise2026!',
          role: 'RECEPTION',
        })
        .expect(201);

      createdUserId = createRes.body.id;
      expect(createdUserId).toBeDefined();
      expect(createRes.body.email).toBe(testEmail);
      expect(createRes.body.passwordHash).toBeUndefined();

      // 2. Lecture directe en base via Prisma : mot de passe haché (jamais en clair)
      const dbUser = await prisma.user.findUnique({ where: { id: createdUserId } });
      expect(dbUser).toBeDefined();
      expect(dbUser!.fullName).toBe('Ousmane Kane');
      expect(dbUser!.passwordHash).not.toBe('PasswordSecurise2026!');
      expect(isValidPasswordHash(dbUser!.passwordHash)).toBe(true);

      // 3. Redémarrage du serveur API et vérification de la persistance
      await app.close();
      const rebooted = await bootstrapTestApp();
      app = rebooted.app;
      prisma = rebooted.prisma;

      const getRes = await request(app.getHttpServer())
        .get(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);
      expect(getRes.body.fullName).toBe('Ousmane Kane');

      // 4. Connexion avec l'utilisateur créé
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          login: testEmail,
          password: 'PasswordSecurise2026!',
        })
        .expect(200);
      expect(loginRes.body.user.id).toBe(createdUserId);
      expect(loginRes.body.accessToken).toBeDefined();

      // 5. Modification puis suppression (désactivation car l'utilisateur a un historique de connexion)
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({ fullName: 'Ousmane Kane Senior' })
        .expect(200);
      expect(patchRes.body.fullName).toBe('Ousmane Kane Senior');

      await request(app.getHttpServer())
        .delete(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);

      const afterDeactivate = await prisma.user.findUnique({ where: { id: createdUserId } });
      expect(afterDeactivate).toBeDefined();
      expect(afterDeactivate!.isActive).toBe(false);

      // 6. Suppression définitive d'un utilisateur vierge sans historique de connexion
      const freshEmail = `persistance.fresh.${Date.now()}@residenceblue.sn`;
      const freshCreate = await request(app.getHttpServer())
        .post('/api/users')
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({
          email: freshEmail,
          fullName: 'Utilisateur Vierge',
          password: 'PasswordSecurise2026!',
          role: 'SERVEUR',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/users/${freshCreate.body.id}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);

      const afterHardDelete = await prisma.user.findUnique({ where: { id: freshCreate.body.id } });
      expect(afterHardDelete).toBeNull();
    });
  });

  describe('2. Chambre avec photo : création, remplacement photo (suppression ancien fichier), lecture Prisma, suppression', () => {
    it('persiste tous les champs de la chambre et remplace proprement le fichier image sur disque', async () => {
      const roomNum = '808';
      await prisma.room.deleteMany({ where: { number: roomNum } });

      // 1. Création avec première photo
      const createRes = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .field('number', roomNum)
        .field('floor', '4')
        .field('category', 'Deluxe')
        .field('pricePerNight', '55000')
        .field('adultsCapacity', '3')
        .field('surfaceM2', '38')
        .field('view', 'piscine')
        .field('description', 'Chambre test persistance complète')
        .attach('image', samplePngBuffer, { filename: 'photo1.png', contentType: 'image/png' })
        .expect(201);

      const roomId = createRes.body.id;
      const firstImageUrl: string = createRes.body.imageUrl;
      expect(firstImageUrl).toMatch(/^\/api\/rooms\/images\/[0-9a-f-]+\.png$/);

      const firstDiskPath = path.join(getRoomsUploadDir(), path.basename(firstImageUrl));
      expect(fs.existsSync(firstDiskPath)).toBe(true);

      // 2. Lecture directe Prisma
      const dbRoom = await prisma.room.findUnique({ where: { id: roomId } });
      expect(dbRoom).toBeDefined();
      expect(dbRoom!.surfaceM2).toBe(38);
      expect(dbRoom!.adultsCapacity).toBe(3);
      expect(dbRoom!.imageUrl).toBe(firstImageUrl);

      // 3. Remplacement de la photo
      const patchRes = await request(app.getHttpServer())
        .patch(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .field('surfaceM2', '42')
        .attach('image', samplePngBuffer, { filename: 'photo2.png', contentType: 'image/png' })
        .expect(200);

      const secondImageUrl: string = patchRes.body.imageUrl;
      expect(secondImageUrl).not.toBe(firstImageUrl);
      const secondDiskPath = path.join(getRoomsUploadDir(), path.basename(secondImageUrl));
      expect(fs.existsSync(secondDiskPath)).toBe(true);
      expect(fs.existsSync(firstDiskPath)).toBe(false);

      // 4. Suppression de la chambre vierge
      await request(app.getHttpServer())
        .delete(`/api/rooms/${roomId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);

      expect(fs.existsSync(secondDiskPath)).toBe(false);
      expect(await prisma.room.findUnique({ where: { id: roomId } })).toBeNull();
    });
  });

  describe('3. Client, Réservation, Anti-Chevauchement et Check-in/Check-out', () => {
    it('chiffre la pièce d’identité du client en base, refuse tout chevauchement de réservation et persiste le check-in/check-out', async () => {
      // 1. Création d'un client avec numéro de passeport
      const guestRes = await request(app.getHttpServer())
        .post('/api/guests')
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          civility: 'Mme',
          firstName: 'Aminata',
          lastName: 'Touré',
          phone: '+221 77 888 99 00',
          email: 'aminata.toure@thies.sn',
          passportNumber: 'SN-SECRET-7741',
        })
        .expect(201);

      const guestId = guestRes.body.id;
      expect(guestRes.body.passportNumber).toBeUndefined();
      expect(guestRes.body.idDocumentMasked).toBe('****7741');

      // Vérifier en base Prisma que la pièce d'identité est chiffrée (AES-256-GCM) et non en clair
      const dbGuest = await prisma.guest.findUnique({ where: { id: guestId } });
      expect(dbGuest).toBeDefined();
      expect(dbGuest!.idDocumentEncrypted).toBeDefined();
      expect(dbGuest!.idDocumentEncrypted).not.toContain('SN-SECRET-7741');

      // 2. Création d'une réservation sur la chambre 106
      const resCreate = await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          guestId,
          roomNumber: '106',
          checkInDate: '2026-12-01',
          checkOutDate: '2026-12-05',
          adultsCount: 2,
          totalFcfa: 140000,
          depositFcfa: 50000,
        })
        .expect(201);

      const reservationId = resCreate.body.id;
      expect(resCreate.body.roomNumber).toBe('106');

      // 3. Tentative de réservation qui se chevauche sur la même chambre 106 (doit être refusée 409)
      await request(app.getHttpServer())
        .post('/api/reservations')
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          guestId,
          roomNumber: '106',
          checkInDate: '2026-12-03',
          checkOutDate: '2026-12-07',
          adultsCount: 1,
          totalFcfa: 140000,
        })
        .expect(409);

      // 4. Check-in de la réservation -> passe en CHECKED_IN et chambre OCCUPIED en base
      const checkInRes = await request(app.getHttpServer())
        .post(`/api/reservations/${reservationId}/check-in`)
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .expect(200);
      expect(checkInRes.body.dbStatus).toBe('CHECKED_IN');

      const room106AfterCheckIn = await prisma.room.findUnique({ where: { number: '106' } });
      expect(room106AfterCheckIn!.status).toBe('OCCUPIED');

      // 5. Check-out -> passe en CHECKED_OUT et chambre CLEANING
      await request(app.getHttpServer())
        .post(`/api/reservations/${reservationId}/check-out`)
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .expect(200);

      // Remettre la chambre 106 en FREE et nettoyer la facture auto-créée, la réservation et le client de test
      await prisma.room.update({ where: { number: '106' }, data: { status: 'FREE' } });
      const linkedInvs = await prisma.invoice.findMany({ where: { reservationId }, select: { id: true } });
      if (linkedInvs.length) {
        const invIds = linkedInvs.map((i) => i.id);
        await prisma.payment.deleteMany({ where: { invoiceId: { in: invIds } } });
        await prisma.invoiceLine.deleteMany({ where: { invoiceId: { in: invIds } } });
        await prisma.invoice.deleteMany({ where: { id: { in: invIds } } });
      }
      await request(app.getHttpServer())
        .delete(`/api/reservations/${reservationId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/api/guests/${guestId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);
    });
  });

  describe('4. Restaurant (Produit & Commande), Facture, Paiement et Paramètres de l’hôtel', () => {
    it('crée, vérifie en base Prisma, modifie et nettoie un produit, une commande, une facture, un paiement et un paramètre', async () => {
      await prisma.restaurantOrderLine.deleteMany({
        where: { name: 'Pastels au Thon de Thiès' },
      });
      await prisma.restaurantProduct.deleteMany({
        where: { name: 'Pastels au Thon de Thiès' },
      });

      // 1. Produit du restaurant
      const prodRes = await request(app.getHttpServer())
        .post('/api/restaurant/products')
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({
          name: 'Pastels au Thon de Thiès',
          description: 'Beignets dorés farcis au poisson et sauce tomate relevée.',
          categoryName: 'Entrées & Tapas',
          priceFcfa: 3000,
          prepStation: 'CUISINE',
        })
        .expect(201);

      const productId = prodRes.body.id;
      const dbProd = await prisma.restaurantProduct.findUnique({ where: { id: productId } });
      expect(dbProd?.priceFcfa).toBe(3000);

      // Modification du produit
      await request(app.getHttpServer())
        .patch(`/api/restaurant/products/${productId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({ priceFcfa: 3500 })
        .expect(200);

      // 2. Commande du restaurant
      const orderRes = await request(app.getHttpServer())
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${roleTokens['SERVEUR']}`)
        .send({
          destinationType: 'TABLE',
          tableLabel: 'T2 (Patio)',
          serverName: 'Moussa Fall',
          items: [
            {
              productId,
              name: 'Pastels au Thon de Thiès',
              quantity: 2,
              unitPriceFcfa: 3500,
            },
          ],
        })
        .expect(201);

      const orderId = orderRes.body.id;
      expect(orderRes.body.totalTtcFcfa).toBe(7000);

      const dbOrder = await prisma.restaurantOrder.findUnique({
        where: { id: orderId },
        include: { lines: true },
      });
      expect(dbOrder?.totalTtcFcfa).toBe(7000);
      expect(dbOrder?.lines.length).toBe(1);

      // 3. Facture et Paiement
      const invRes = await request(app.getHttpServer())
        .post('/api/invoices')
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          roomNumber: '101',
          depositFcfa: 10000,
          lines: [
            {
              description: 'Nuitée Standard 101',
              category: 'ROOM',
              quantity: 1,
              unitPriceFcfa: 35000,
            },
          ],
        })
        .expect(201);

      const invoiceId = invRes.body.id;
      expect(invRes.body.totalFcfa).toBe(35000);
      expect(invRes.body.balanceFcfa).toBe(25000);

      // Enregistrement du paiement soldant la facture
      const payRes = await request(app.getHttpServer())
        .post(`/api/invoices/${invoiceId}/payments`)
        .set('Authorization', `Bearer ${roleTokens['RECEPTION']}`)
        .send({
          method: 'WAVE',
          amountFcfa: 25000,
          transactionRef: 'WAV-TEST-2026',
        })
        .expect(201);

      expect(payRes.body.balanceFcfa).toBe(0);
      expect(payRes.body.status).toBe('PAID');

      const dbInv = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: { payments: true },
      });
      expect(dbInv?.balanceFcfa).toBe(0);
      expect(dbInv?.payments.length).toBe(1);
      expect(dbInv?.payments[0].transactionRef).toBe('WAV-TEST-2026');

      // 4. Modification d'un paramètre de l'hôtel
      const settingsPatch = await request(app.getHttpServer())
        .patch('/api/hotel-settings')
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({ supportPhone: '+221 33 951 99 99' })
        .expect(200);
      expect(settingsPatch.body.supportPhone).toBe('+221 33 951 99 99');

      const dbSettings = await prisma.hotelSetting.findUnique({ where: { id: 'default' } });
      expect(dbSettings?.supportPhone).toBe('+221 33 951 99 99');

      // Remettre le téléphone initial et nettoyer les entités créées par le test
      await request(app.getHttpServer())
        .patch('/api/hotel-settings')
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .send({ supportPhone: '+221 33 957 00 00' })
        .expect(200);

      await prisma.payment.deleteMany({ where: { invoiceId } });
      await prisma.invoice.delete({ where: { id: invoiceId } });
      await prisma.restaurantOrder.delete({ where: { id: orderId } });
      await request(app.getHttpServer())
        .delete(`/api/restaurant/products/${productId}`)
        .set('Authorization', `Bearer ${roleTokens['DIRECTION']}`)
        .expect(200);
    });
  });
});
