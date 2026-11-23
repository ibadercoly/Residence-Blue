import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as fs from 'node:fs';
import * as http from 'http';
import * as path from 'node:path';
import request from 'supertest';
import { Role } from '@residence-blue/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { hashPassword } from '../src/auth/password-hash.util';
import { issueDbTestToken } from './auth-test.helper';

describe('Administration des comptes et modèle d’accès (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl = '';

  const roleTokens: Record<string, string> = {};
  const createdUserIds: string[] = [];
  const createdOrderIds: string[] = [];
  const createdGuestIds: string[] = [];
  const openSseReqs: http.ClientRequest[] = [];
  let directorId = '';

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

    prisma = app.get(PrismaService);

    for (const r of [
      Role.DIRECTION,
      Role.RECEPTION,
      Role.RESTAURANT,
      Role.CUISINIER,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.COMPTABLE,
    ]) {
      const issued = await issueDbTestToken(prisma, r);
      roleTokens[r] = issued.token;
      if (r === Role.DIRECTION) {
        directorId = issued.userId;
      }
    }
  });

  afterAll(async () => {
    for (const req of openSseReqs) {
      req.destroy();
    }
    for (const orderId of createdOrderIds) {
      await prisma.restaurantOrderEvent.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.restaurantOrderLine.deleteMany({ where: { orderId } }).catch(() => {});
      await prisma.restaurantOrder.delete({ where: { id: orderId } }).catch(() => {});
    }
    for (const guestId of createdGuestIds) {
      await prisma.guest.delete({ where: { id: guestId } }).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await prisma.refreshToken.deleteMany({ where: { userId: uid } }).catch(() => {});
      await prisma.user.delete({ where: { id: uid } }).catch(() => {});
    }
    (app?.getHttpServer() as any)?.closeAllConnections?.();
    await app?.close();
  });

  it('refuse 403 sur /api/administration/* pour tous les rôles non-directeur (même avec en-têtes falsifiés)', async () => {
    for (const nonDirRole of [
      Role.RECEPTION,
      Role.RESTAURANT,
      Role.CUISINIER,
      Role.HOUSEKEEPING,
      Role.MAINTENANCE,
      Role.COMPTABLE,
    ]) {
      await request(app.getHttpServer())
        .get('/api/administration/comptes')
        .set('Authorization', `Bearer ${roleTokens[nonDirRole]}`)
        .set('x-user-role', 'DIRECTION')
        .set('x-role', 'DIRECTION')
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/administration/comptes')
        .set('Authorization', `Bearer ${roleTokens[nonDirRole]}`)
        .send({
          fullName: 'Tentative Escalade',
          email: `escalade-${Date.now()}@residenceblue.sn`,
          starterProfile: 'ASSISTANT_RECEPTION',
          screenAccess: {
            accueil: 'LECTURE',
            planning: 'NONE',
          },
          specialPermissions: {
            voir_montants: false,
            encaisser_paiement: false,
            changer_etat_chambre: false,
            annuler_commande_ou_reservation: false,
          },
        })
        .expect(403);
    }

    await request(app.getHttpServer())
      .get('/api/administration/comptes')
      .expect(401);
  });

  it('interdit de créer un second administrateur via /api/administration/comptes et retire /api/users', async () => {
    await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName: 'Second Directeur',
        email: `second-admin-${Date.now()}@residenceblue.sn`,
        starterProfile: 'DIRECTEUR',
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'ECRITURE',
          restaurant: 'ECRITURE',
          cuisine: 'ECRITURE',
          rapports: 'ECRITURE',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: true,
        },
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/users')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        email: `second-user-dir-${Date.now()}@residenceblue.sn`,
        fullName: 'Second Directeur Legacy',
        password: 'UnMotDePasseTresSolide2026!',
        role: Role.DIRECTION,
      })
      .expect(404);
  });

  it('protège le compte directeur principal contre DELETE, désactivation, changement de profil et réduction d’accès', async () => {
    let primaryAdmin = await prisma.user.findFirst({
      where: { isPrimaryAdmin: true },
    });
    if (!primaryAdmin) {
      primaryAdmin = await prisma.user.update({
        where: { id: directorId },
        data: { isPrimaryAdmin: true },
      });
    }
    expect(primaryAdmin).toBeTruthy();

    for (const targetId of [primaryAdmin!.id, directorId]) {
      await request(app.getHttpServer())
        .post(`/api/administration/comptes/${targetId}/supprimer`)
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .send({ confirmName: primaryAdmin!.fullName || 'Directeur', directorPassword: 'TestSecure2026!' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/administration/comptes/${targetId}`)
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .send({ confirmName: primaryAdmin!.fullName || 'Directeur', directorPassword: 'TestSecure2026!' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/administration/comptes/${targetId}/desactiver`)
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .expect(403);

      await request(app.getHttpServer())
        .patch(`/api/administration/comptes/${targetId}`)
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .send({
          starterProfile: 'MENAGE',
          screenAccess: {
            accueil: 'AUCUN',
            planning: 'AUCUN',
            chambres: 'LECTURE',
            clients: 'AUCUN',
            facturation: 'AUCUN',
            restaurant: 'AUCUN',
            cuisine: 'AUCUN',
            rapports: 'AUCUN',
          },
        })
        .expect(403);
    }
  });

  it('génère un mot de passe provisoire non stocké en clair, impose son changement, applique Planning 403/200 immédiat et cuisine 403 pour assistant resto', async () => {
    const email = `rec-${Date.now()}@residenceblue.sn`;
    const createRes = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName: 'Awa Mbaye Test',
        email,
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: {
          accueil: 'LECTURE',
          planning: 'AUCUN',
          chambres: 'LECTURE',
          clients: 'LECTURE',
          facturation: 'AUCUN',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: false,
          encaisser_paiement: false,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: false,
        },
      })
      .expect(201);

    const accountId = createRes.body.account.id as string;
    const provisionalPassword = createRes.body.provisionalPassword as string;
    createdUserIds.push(accountId);

    expect(provisionalPassword).toBeTruthy();
    expect(provisionalPassword.length).toBeGreaterThanOrEqual(10);

    // Aucun mot de passe en clair en base ni dans GET ni dans AuditLog
    const dbUser = await prisma.user.findUnique({ where: { id: accountId } });
    expect(dbUser?.passwordHash.startsWith('$argon2id$')).toBe(true);
    expect(JSON.stringify(dbUser)).not.toContain(provisionalPassword);

    const getRes = await request(app.getHttpServer())
      .get(`/api/administration/comptes/${accountId}`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);
    expect(JSON.stringify(getRes.body)).not.toContain(provisionalPassword);
    expect(getRes.body.passwordHash).toBeUndefined();

    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: accountId },
    });
    expect(JSON.stringify(auditLogs)).not.toContain(provisionalPassword);

    // Connexion avec mot de passe provisoire -> mustChangePassword = true & blocage routes métier
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: email, password: provisionalPassword })
      .expect(200);
    expect(loginRes.body.user.mustChangePassword).toBe(true);
    const userToken = loginRes.body.accessToken as string;

    await request(app.getHttpServer())
      .get('/api/accueil/jour')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    // Changement obligatoire du mot de passe
    const personalPwd = `MonNouveauSecret!${Date.now()}`;
    const changeRes = await request(app.getHttpServer())
      .post('/api/auth/change-initial-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ newPassword: personalPwd })
      .expect(200);
    expect(changeRes.body.mustChangePassword).toBe(false);

    // Sans accès Planning -> 403 sur /api/reservations ; montants masqués car voir_montants = false
    await request(app.getHttpServer())
      .get('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);

    const roomsNoPrice = await request(app.getHttpServer())
      .get('/api/rooms')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(roomsNoPrice.body[0].pricePerNight).toBeNull();

    // Modification immédiate : accorder Planning LECTURE -> effet dès la requête suivante SANS reconnexion
    await request(app.getHttpServer())
      .patch(`/api/administration/comptes/${accountId}`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        screenAccess: {
          accueil: 'LECTURE',
          planning: 'LECTURE',
          chambres: 'LECTURE',
          clients: 'LECTURE',
          facturation: 'AUCUN',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
      })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/reservations')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    // Assistant(e) du restaurant ne peut jamais avoir Cuisine et reçoit 403 sur /api/cuisine
    await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens[Role.RESTAURANT]}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName: 'Resto Cuisine Refusé',
        email: `resto-bad-${Date.now()}@residenceblue.sn`,
        starterProfile: 'ASSISTANT_RESTAURANT',
        screenAccess: {
          accueil: 'AUCUN',
          planning: 'AUCUN',
          chambres: 'AUCUN',
          clients: 'AUCUN',
          facturation: 'AUCUN',
          restaurant: 'ECRITURE',
          cuisine: 'LECTURE',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: true,
        },
      })
      .expect(403);

    // DIRECTION reçoit aussi 403 sur /api/cuisine/orders et aucun autre profil ne peut recevoir Cuisine
    await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(403);

    for (const profileKey of ['ASSISTANT_RECEPTION', 'ASSISTANT_RESTAURANT', 'TECHNIQUE', 'COMPTABLE'] as const) {
      const deniedRes = await request(app.getHttpServer())
        .post('/api/administration/comptes')
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .send({
          fullName: `Cuisine Interdite ${profileKey}`,
          email: `no-cook-${profileKey.toLowerCase()}-${Date.now()}@residenceblue.sn`,
          starterProfile: profileKey,
          screenAccess: {
            accueil: 'AUCUN',
            planning: 'AUCUN',
            chambres: 'LECTURE',
            clients: 'AUCUN',
            facturation: 'AUCUN',
            restaurant: 'AUCUN',
            cuisine: 'LECTURE',
            rapports: 'AUCUN',
          },
          specialPermissions: {
            voir_montants: false,
            encaisser_paiement: false,
            changer_etat_chambre: false,
            annuler_commande_ou_reservation: false,
          },
        })
        .expect(403);
      expect(String(deniedRes.body?.message || '')).toContain('Seul le cuisinier voit la cuisine');
    }
  });

  it('désactive immédiatement (jeton refusé + flux SSE fermé) puis réactive, puis supprime en libérant e-mail et gardant historique', async () => {
    const email = `cycle-${Date.now()}@residenceblue.sn`;
    const fullName = `Samba Diouf ${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName,
        email,
        starterProfile: 'ASSISTANT_RESTAURANT',
        screenAccess: {
          accueil: 'AUCUN',
          planning: 'AUCUN',
          chambres: 'AUCUN',
          clients: 'AUCUN',
          facturation: 'AUCUN',
          restaurant: 'ECRITURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: true,
        },
      })
      .expect(201);

    const uid = createRes.body.account.id as string;
    const pwd = `CycleSecret!${Date.now()}`;
    createdUserIds.push(uid);

    const l1 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: email, password: createRes.body.provisionalPassword })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/change-initial-password')
      .set('Authorization', `Bearer ${l1.body.accessToken}`)
      .send({ newPassword: pwd })
      .expect(200);
    const token = l1.body.accessToken as string;

    // Ouvrir un vrai flux SSE HTTP pour ce compte
    let sseClosed = false;
    let sseReq!: http.ClientRequest;
    await new Promise<void>((resolve) => {
      sseReq = http.get(
        `${baseUrl}/api/restaurant/orders/stream`,
        { headers: { Authorization: `Bearer ${token}` } },
        (res) => {
          res.resume();
          res.on('end', () => {
            sseClosed = true;
          });
          res.on('close', () => {
            sseClosed = true;
          });
          resolve();
        },
      );
    });
    openSseReqs.push(sseReq);

    // Créer une commande rattachée à cet utilisateur pour vérifier l'historique après suppression
    const product = await prisma.restaurantProduct.findFirst({
      where: { status: 'AVAILABLE' },
    });
    expect(product).toBeTruthy();
    const orderRes = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        destinationType: 'TABLE',
        tableLabel: 'Table Test Cycle',
        action: 'SEND_TO_KITCHEN',
        items: [{ productId: product!.id, quantity: 1 }],
      })
      .expect(201);
    createdOrderIds.push(orderRes.body.id);

    // Désactivation -> jeton refusé (401) à la requête suivante & SSE fermé
    await request(app.getHttpServer())
      .post(`/api/administration/comptes/${uid}/desactiver`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);

    await new Promise((r) => setTimeout(r, 250));
    expect(sseClosed).toBe(true);
    sseReq.destroy();

    await request(app.getHttpServer())
      .get('/api/restaurant/catalog')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: email, password: pwd })
      .expect(401);

    // Réactivation rétablit la connexion
    await request(app.getHttpServer())
      .post(`/api/administration/comptes/${uid}/reactiver`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: email, password: pwd })
      .expect(200);

    // Suppression exige nom exact + mot de passe directeur (TestSecure2026! pour test.direction)
    await request(app.getHttpServer())
      .post(`/api/administration/comptes/${uid}/supprimer`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({ confirmName: fullName, directorPassword: 'MauvaisPassword123' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/administration/comptes/${uid}/supprimer`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({ confirmName: fullName, directorPassword: 'TestSecure2026!' })
      .expect(200);

    // Compte absent de la liste
    const listAfter = await request(app.getHttpServer())
      .get('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .expect(200);
    expect(listAfter.body.some((u: any) => u.id === uid)).toBe(false);

    // Historique conserve "<Nom> (compte supprimé)"
    const ordInDb = await prisma.restaurantOrder.findUnique({
      where: { id: orderRes.body.id },
    });
    expect(ordInDb?.serverName).toBe(`${fullName} (compte supprimé)`);

    // E-mail libéré -> on peut recréer un compte avec la même adresse
    const recreate = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName: 'Nouveau Titulaire',
        email,
        starterProfile: 'COMPTABLE',
        screenAccess: {
          accueil: 'AUCUN',
          planning: 'AUCUN',
          chambres: 'AUCUN',
          clients: 'AUCUN',
          facturation: 'LECTURE',
          restaurant: 'AUCUN',
          cuisine: 'AUCUN',
          rapports: 'LECTURE',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: false,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: false,
        },
      })
      .expect(201);
    createdUserIds.push(recreate.body.account.id);
  });

  it('cuisinier ne voit jamais ni prix ni nom de client dans les réponses HTTP et le SSE', async () => {
    const product = await prisma.restaurantProduct.findFirst({
      where: { status: 'AVAILABLE' },
    });
    expect(product).toBeTruthy();

    const secretClientName = `ClientUltraConfidentiel${Date.now()}`;
    const room = await prisma.room.findFirst({ where: { isActive: true } });
    expect(room).toBeTruthy();
    const guest = await prisma.guest.create({
      data: {
        firstName: 'Client',
        lastName: `Secret${Date.now()}`,
        fullName: secretClientName,
        phone: `+22177${String(Date.now()).slice(-7)}`,
      },
    });
    createdGuestIds.push(guest.id);
    const stay = await prisma.reservation.create({
      data: {
        reference: `RES-ADM-${Date.now()}`,
        guestId: guest.id,
        roomId: room!.id,
        checkInDate: new Date(Date.now() - 86_400_000),
        checkOutDate: new Date(Date.now() + 86_400_000),
        status: 'CHECKED_IN',
        totalFcfa: 45000,
      },
    });

    let ssePayloadReceived = '';
    const sseReq = http.get(
      `${baseUrl}/api/restaurant/orders/stream`,
      { headers: { Authorization: `Bearer ${roleTokens[Role.CUISINIER]}` } },
      (res) => {
        res.on('data', (chunk: Buffer) => {
          ssePayloadReceived += chunk.toString('utf8');
        });
      },
    );
    openSseReqs.push(sseReq);
    await new Promise((r) => setTimeout(r, 200));

    const orderRes = await request(app.getHttpServer())
      .post('/api/restaurant/orders')
      .set('Authorization', `Bearer ${roleTokens[Role.RECEPTION]}`)
      .send({
        destinationType: 'ROOM',
        roomId: room!.id,
        reservationId: stay.id,
        action: 'SEND_TO_KITCHEN',
        items: [{ productId: product!.id, quantity: 1 }],
      })
      .expect(201);
    createdOrderIds.push(orderRes.body.id);

    await new Promise((r) => setTimeout(r, 250));
    sseReq.destroy();

    await prisma.restaurantOrder.updateMany({ where: { id: orderRes.body.id }, data: { reservationId: null } }).catch(() => {});
    await prisma.reservation.delete({ where: { id: stay.id } }).catch(() => {});

    expect(ssePayloadReceived).not.toContain(secretClientName);
    expect(ssePayloadReceived).not.toContain('totalTtcFcfa');
    expect(ssePayloadReceived).not.toContain('unitPriceFcfa');

    await request(app.getHttpServer())
      .get('/api/restaurant/catalog')
      .set('Authorization', `Bearer ${roleTokens[Role.CUISINIER]}`)
      .expect(403);

    const noMontantsUser = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName: 'Resto Sans Montants',
        email: `no-montants-${Date.now()}@residenceblue.sn`,
        starterProfile: 'ASSISTANT_RESTAURANT',
        screenAccess: {
          accueil: 'AUCUN',
          planning: 'AUCUN',
          chambres: 'AUCUN',
          clients: 'AUCUN',
          facturation: 'AUCUN',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: false,
          encaisser_paiement: false,
          changer_etat_chambre: false,
          annuler_commande_ou_reservation: false,
        },
      })
      .expect(201);
    createdUserIds.push(noMontantsUser.body.account.id);
    const lNoM = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: noMontantsUser.body.account.email, password: noMontantsUser.body.provisionalPassword })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/change-initial-password')
      .set('Authorization', `Bearer ${lNoM.body.accessToken}`)
      .send({ newPassword: 'SafeUserPass!2026' })
      .expect(200);
    const catMasked = await request(app.getHttpServer())
      .get('/api/restaurant/catalog')
      .set('Authorization', `Bearer ${lNoM.body.accessToken}`)
      .expect(200);
    expect(catMasked.body.products[0].priceFcfa).toBeUndefined();

    const cuisineRes = await request(app.getHttpServer())
      .get('/api/cuisine/orders')
      .set('Authorization', `Bearer ${roleTokens[Role.CUISINIER]}`)
      .expect(200);
    const jsonStr = JSON.stringify(cuisineRes.body);
    expect(jsonStr).not.toContain(secretClientName);
    expect(jsonStr).not.toContain('totalTtcFcfa');
    expect(jsonStr).not.toContain('unitPriceFcfa');
  });

  it('permet au directeur de modifier son e-mail et mot de passe avec mot de passe actuel et ferme ses autres sessions', async () => {
    const tempEmail = `dir-cred-${Date.now()}@residenceblue.sn`;
    const initialPwd = 'DirInitialPass!2026';
    const nextPwd = 'DirUpdatedPass!2026';
    const nextEmail = `dir-cred-new-${Date.now()}@residenceblue.sn`;

    const tempUser = await prisma.user.create({
      data: {
        email: tempEmail,
        fullName: 'Directeur Temporaire Test',
        role: Role.DIRECTION,
        isActive: true,
        passwordHash: await hashPassword(initialPwd),
      },
    });
    createdUserIds.push(tempUser.id);

    const sessA = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: tempEmail, password: initialPwd })
      .expect(200);
    const sessB = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: tempEmail, password: initialPwd })
      .expect(200);

    // Mauvais mot de passe actuel -> 403
    await request(app.getHttpServer())
      .patch('/api/administration/directeur/identifiants')
      .set('Authorization', `Bearer ${sessA.body.accessToken}`)
      .send({ currentPassword: 'WrongPassword!', email: nextEmail })
      .expect(403);

    // Bon mot de passe actuel -> 200 & sessB révoquée
    const updRes = await request(app.getHttpServer())
      .patch('/api/administration/directeur/identifiants')
      .set('Authorization', `Bearer ${sessA.body.accessToken}`)
      .send({
        currentPassword: initialPwd,
        email: nextEmail,
        newPassword: nextPwd,
      })
      .expect(200);
    expect(updRes.body.user.email).toBe(nextEmail);
    expect(updRes.body.otherSessionsRevoked).toBeGreaterThanOrEqual(1);

    // L'autre session est révoquée immédiatement
    await request(app.getHttpServer())
      .get('/api/administration/comptes')
      .set('Authorization', `Bearer ${sessB.body.accessToken}`)
      .expect(401);

    // Connexion avec nouveaux identifiants fonctionne
    await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: nextEmail, password: nextPwd })
      .expect(200);
  });

  it('exige le nom à la création et permet de modifier le nom du directeur ainsi que de tout autre compte', async () => {
    const dirEmail = `dir-name-${Date.now()}@residenceblue.sn`;
    const dirPwd = 'DirNamePass!2026';

    const dirUser = await prisma.user.create({
      data: {
        email: dirEmail,
        fullName: 'Aïssatou Ba',
        role: Role.DIRECTION,
        isActive: true,
        passwordHash: await hashPassword(dirPwd),
      },
    });
    createdUserIds.push(dirUser.id);

    const dirLogin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: dirEmail, password: dirPwd })
      .expect(200);

    // Création sans nom ou nom blanc -> 400
    await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${dirLogin.body.accessToken}`)
      .send({
        fullName: '   ',
        email: `noname-${Date.now()}@residenceblue.sn`,
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'LECTURE',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: false,
        },
      })
      .expect(400);

    // Création valide avec nom -> 201
    const collabEmail = `collab-name-${Date.now()}@residenceblue.sn`;
    const createdCollab = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${dirLogin.body.accessToken}`)
      .send({
        fullName: 'Aminata Diop',
        email: collabEmail,
        starterProfile: 'ASSISTANT_RECEPTION',
        screenAccess: {
          accueil: 'ECRITURE',
          planning: 'ECRITURE',
          chambres: 'ECRITURE',
          clients: 'ECRITURE',
          facturation: 'LECTURE',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: {
          voir_montants: true,
          encaisser_paiement: true,
          changer_etat_chambre: true,
          annuler_commande_ou_reservation: false,
        },
      })
      .expect(201);
    createdUserIds.push(createdCollab.body.account.id);
    expect(createdCollab.body.account.fullName).toBe('Aminata Diop');

    // Modification du nom du collaborateur -> 200 (et refus si blanc -> 400)
    await request(app.getHttpServer())
      .patch(`/api/administration/comptes/${createdCollab.body.account.id}`)
      .set('Authorization', `Bearer ${dirLogin.body.accessToken}`)
      .send({ fullName: '  ' })
      .expect(400);

    const updCollab = await request(app.getHttpServer())
      .patch(`/api/administration/comptes/${createdCollab.body.account.id}`)
      .set('Authorization', `Bearer ${dirLogin.body.accessToken}`)
      .send({ fullName: 'Aminata Sarr' })
      .expect(200);
    expect(updCollab.body.fullName).toBe('Aminata Sarr');

    // Modification du nom du directeur avec mauvais mot de passe -> 403
    await request(app.getHttpServer())
      .patch('/api/administration/directeur/identifiants')
      .set('Authorization', `Bearer ${dirLogin.body.accessToken}`)
      .send({ currentPassword: 'WrongPassword!', fullName: 'ibader' })
      .expect(403);

    // Modification du nom du directeur avec mot de passe actuel -> 200 sans perte de rôle
    const updDir = await request(app.getHttpServer())
      .patch('/api/administration/directeur/identifiants')
      .set('Authorization', `Bearer ${dirLogin.body.accessToken}`)
      .send({ currentPassword: dirPwd, fullName: 'ibader' })
      .expect(200);
    expect(updDir.body.user.fullName).toBe('ibader');
    expect(updDir.body.user.role).toBe('DIRECTION');
    expect(updDir.body.otherSessionsRevoked).toBe(0);
  });

  it('verrouille strictement le profil Ménage (403 restaurant, 403 attribution autres écrans, /rooms sans prix, migration SQL)', async () => {
    const baseScreens = {
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'LECTURE',
      clients: 'AUCUN',
      facturation: 'AUCUN',
      restaurant: 'AUCUN',
      cuisine: 'AUCUN',
      rapports: 'AUCUN',
    };
    const basePerms = {
      voir_montants: false,
      encaisser_paiement: false,
      changer_etat_chambre: true,
      annuler_commande_ou_reservation: false,
    };

    // Refus 403 si tentative d'attribuer Restaurant, Accueil, Planning, Clients, Facturation ou Cuisine à MENAGE
    for (const extraScreen of ['restaurant', 'accueil', 'planning', 'clients', 'facturation', 'cuisine'] as const) {
      const denyRes = await request(app.getHttpServer())
        .post('/api/administration/comptes')
        .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
        .send({
          fullName: 'Test Ménage Refusé',
          email: `menage-deny-${extraScreen}-${Date.now()}@residenceblue.sn`,
          starterProfile: 'MENAGE',
          screenAccess: { ...baseScreens, [extraScreen]: 'LECTURE' },
          specialPermissions: basePerms,
        })
        .expect(403);
      expect(denyRes.body.message).toContain('Chambres');
    }

    // Création valide d'un compte Ménage
    const menageEmail = `menage-ok-${Date.now()}@residenceblue.sn`;
    const createdMenage = await request(app.getHttpServer())
      .post('/api/administration/comptes')
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({
        fullName: 'Ndeye Ménage',
        email: menageEmail,
        starterProfile: 'MENAGE',
        screenAccess: baseScreens,
        specialPermissions: basePerms,
      })
      .expect(201);
    const menageId = createdMenage.body.account.id as string;
    createdUserIds.push(menageId);

    // Refus 403 si tentative d'ajouter Restaurant par PATCH
    await request(app.getHttpServer())
      .patch(`/api/administration/comptes/${menageId}`)
      .set('Authorization', `Bearer ${roleTokens[Role.DIRECTION]}`)
      .send({ screenAccess: { ...baseScreens, restaurant: 'LECTURE' } })
      .expect(403);

    // Changement de mot de passe provisoire puis connexion avec le compte Ménage
    const l1 = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: menageEmail, password: createdMenage.body.provisionalPassword })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/auth/change-initial-password')
      .set('Authorization', `Bearer ${l1.body.accessToken}`)
      .send({ newPassword: `MenagePass!${Date.now()}` })
      .expect(200);
    const menageToken = l1.body.accessToken as string;

    // 403 sur toutes les routes Restaurant & Cuisine + Accueil pour les 2 comptes (historique sans JSON + nouveau)
    for (const tokenToCheck of [roleTokens[Role.HOUSEKEEPING], menageToken]) {
      await request(app.getHttpServer()).get('/api/accueil/jour').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/catalog').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/categories').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/rooms-in-stay').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/products').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/orders/page').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/orders').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/restaurant/kitchen/orders').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer()).get('/api/cuisine/orders').set('Authorization', `Bearer ${tokenToCheck}`).expect(403);
      await request(app.getHttpServer())
        .post('/api/restaurant/orders')
        .set('Authorization', `Bearer ${tokenToCheck}`)
        .send({ destinationType: 'COUNTER', action: 'SEND_TO_KITCHEN', items: [] })
        .expect(403);

      // Accès Chambres 200 avec tarifs strictement masqués (null)
      const roomsRes = await request(app.getHttpServer())
        .get('/api/rooms')
        .set('Authorization', `Bearer ${tokenToCheck}`)
        .expect(200);
      expect(Array.isArray(roomsRes.body)).toBe(true);
      expect(roomsRes.body.length).toBeGreaterThanOrEqual(12);
      expect(roomsRes.body[0].pricePerNight).toBeNull();
      expect(roomsRes.body[0].type.pricePerNight).toBeNull();

      const availRes = await request(app.getHttpServer())
        .get('/api/rooms/available?checkIn=2026-12-01&checkOut=2026-12-03')
        .set('Authorization', `Bearer ${tokenToCheck}`)
        .expect(200);
      if (availRes.body.length > 0) {
        expect(availRes.body[0].pricePerNight).toBeNull();
        expect(availRes.body[0].type?.pricePerNight).toBeNull();
      }
    }

    // Migration SQL idempotente sur un compte Ménage périmé
    const staleHk = await prisma.user.create({
      data: {
        email: `stale-menage-${Date.now()}@residenceblue.sn`,
        fullName: 'Ancien Compte Ménage Périmé',
        role: Role.HOUSEKEEPING,
        starterProfile: 'MENAGE',
        isActive: true,
        isPrimaryAdmin: false,
        mustChangePassword: false,
        passwordHash: await hashPassword('StaleMenage!2026'),
        screenAccess: {
          accueil: 'LECTURE',
          planning: 'LECTURE',
          chambres: 'LECTURE',
          clients: 'LECTURE',
          facturation: 'LECTURE',
          restaurant: 'LECTURE',
          cuisine: 'AUCUN',
          rapports: 'AUCUN',
        },
        specialPermissions: basePerms,
      },
    });
    createdUserIds.push(staleHk.id);

    const migPaths = [
      path.resolve(process.cwd(), 'prisma/migrations/20261116063000_menage_verrouillage_acces/migration.sql'),
      path.resolve(process.cwd(), 'apps/api/prisma/migrations/20261116063000_menage_verrouillage_acces/migration.sql'),
    ];
    const migSql = fs.readFileSync(migPaths.find((p) => fs.existsSync(p))!, 'utf8');
    await prisma.$executeRawUnsafe(migSql);

    const cleanedHk = await prisma.user.findUnique({ where: { id: staleHk.id } });
    expect(cleanedHk?.screenAccess).toEqual({
      accueil: 'AUCUN',
      planning: 'AUCUN',
      chambres: 'LECTURE',
      clients: 'AUCUN',
      facturation: 'AUCUN',
      restaurant: 'AUCUN',
      cuisine: 'AUCUN',
      rapports: 'AUCUN',
    });
    const migAudit = await prisma.auditLog.findFirst({
      where: { action: 'MIGRATION_VERROUILLAGE_MENAGE', entityId: staleHk.id },
    });
    expect(migAudit).toBeTruthy();
  });
});
