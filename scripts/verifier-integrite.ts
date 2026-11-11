import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';
import { isValidPasswordHash } from '../apps/api/src/auth/password-hash.util';
import { getUploadsDir as getRoomsUploadDir } from '../apps/api/src/rooms/rooms-image.util';

const prisma = new PrismaClient();
const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 Mo

function resolveRoomImageFileOnDisk(imageUrl: string): string | null {
  if (!imageUrl) return null;
  const clean = imageUrl.trim();

  if (clean.startsWith('/api/rooms/images/')) {
    const filename = path.basename(clean);
    return path.join(getRoomsUploadDir(), filename);
  }

  if (clean.startsWith('assets/')) {
    const webPublicPath = path.resolve(process.cwd(), 'apps/web/public', clean);
    if (fs.existsSync(webPublicPath)) return webPublicPath;
    const rootImagesPath = path.resolve(
      process.cwd(),
      clean.replace(/^assets\/images\//, 'images/'),
    );
    return rootImagesPath;
  }

  return path.resolve(process.cwd(), clean);
}

function checkImageSignature(buffer: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'webp';
  }
  return null;
}

async function askConfirmation(question: string): Promise<boolean> {
  if (process.argv.includes('--oui') || process.argv.includes('--yes') || process.argv.includes('-y')) {
    return true;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(`${question} (o/N) : `, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'o' || normalized === 'oui' || normalized === 'y' || normalized === 'yes');
    });
  });
}

export async function runIntegrityCheck(options?: { cleanOrphans?: boolean }): Promise<{
  anomalies: string[];
  orphans: string[];
  tableCounts: Record<string, number>;
}> {
  const anomalies: string[] = [];
  const orphans: string[] = [];

  console.log('================================================================');
  console.log('🔍 VÉRIFICATION D’INTÉGRITÉ — RÉSIDENCE BLUE (THIÈS)');
  console.log('================================================================\n');

  // 1. Contrôle des images de chambres et des fichiers sur disque
  const rooms = await prisma.room.findMany({ orderBy: { number: 'asc' } });
  const referencedUploadedFiles = new Set<string>();

  for (const room of rooms) {
    if (!room.imageUrl) continue;

    // 1.a Pas de data:image ou base64
    if (
      room.imageUrl.includes('data:image') ||
      room.imageUrl.includes(';base64,') ||
      room.imageUrl.length > 512
    ) {
      anomalies.push(
        `[IMAGE_BASE64] Chambre ${room.number} : image_url contient une donnée encodée en base64 ou invalide.`,
      );
      continue;
    }

    if (room.imageUrl.startsWith('/api/rooms/images/')) {
      referencedUploadedFiles.add(path.basename(room.imageUrl));
    }

    const diskPath = resolveRoomImageFileOnDisk(room.imageUrl);
    if (!diskPath || !fs.existsSync(diskPath)) {
      anomalies.push(
        `[IMAGE_MANQUANTE] Chambre ${room.number} : le fichier référencé "${room.imageUrl}" est introuvable sur disque (${diskPath}).`,
      );
      continue;
    }

    // 1.b Taille <= 2 Mo et format (JPEG, PNG, WebP)
    const stat = fs.statSync(diskPath);
    if (stat.size > MAX_IMAGE_BYTES) {
      anomalies.push(
        `[IMAGE_TAILLE] Chambre ${room.number} : "${room.imageUrl}" dépasse 2 Mo (${stat.size} octets).`,
      );
    }

    const headerBuf = fs.readFileSync(diskPath);
    const sig = checkImageSignature(headerBuf);
    if (!sig) {
      anomalies.push(
        `[IMAGE_FORMAT] Chambre ${room.number} : "${room.imageUrl}" n'est pas un fichier JPEG, PNG ou WebP valide.`,
      );
    }
  }

  // Vérifier aussi les photos de produits du restaurant
  const products = await prisma.restaurantProduct.findMany();
  for (const prod of products) {
    if (prod.photoUrl && (prod.photoUrl.includes('data:image') || prod.photoUrl.includes(';base64,'))) {
      anomalies.push(
        `[PRODUIT_IMAGE_BASE64] Produit "${prod.name}" : photo_url contient une image encodée en base64.`,
      );
    }
  }

  // 1.c Détection des fichiers orphelins dans uploads/rooms
  const uploadDir = getRoomsUploadDir();
  if (fs.existsSync(uploadDir)) {
    const filesOnDisk = fs.readdirSync(uploadDir).filter((f) => {
      const full = path.join(uploadDir, f);
      return fs.statSync(full).isFile() && /\.(jpg|jpeg|png|webp)$/i.test(f);
    });

    for (const file of filesOnDisk) {
      if (!referencedUploadedFiles.has(file)) {
        orphans.push(path.join(uploadDir, file));
      }
    }
  }

  console.log(`1. Contrôle des photos de chambres (${rooms.length} chambres inspectées) :`);
  console.log(`   - Fichiers téléversés référencés : ${referencedUploadedFiles.size}`);
  console.log(`   - Fichiers orphelins dans uploads/rooms : ${orphans.length}`);
  if (orphans.length > 0) {
    for (const orph of orphans) {
      console.log(`     • Orphelin : ${orph}`);
    }
    const shouldClean = options?.cleanOrphans ?? process.argv.includes('--nettoyer-orphelins');
    if (shouldClean) {
      const confirmed = await askConfirmation(
        `Voulez-vous supprimer définitivement ces ${orphans.length} fichier(s) orphelin(s) ?`,
      );
      if (confirmed) {
        for (const orph of orphans) {
          try {
            fs.unlinkSync(orph);
            console.log(`     ✓ Supprimé : ${orph}`);
          } catch {}
        }
        orphans.length = 0;
      }
    }
  }

  // 2. Contrôle des doublons de numéro de chambre
  const roomNumbers = new Map<string, number>();
  for (const r of rooms) {
    const key = r.number.trim().toLowerCase();
    roomNumbers.set(key, (roomNumbers.get(key) || 0) + 1);
  }
  for (const [num, count] of roomNumbers.entries()) {
    if (count > 1) {
      anomalies.push(`[CHAMBRE_DOUBLON] Le numéro de chambre "${num}" apparaît ${count} fois.`);
    }
  }

  // 3. Contrôle des réservations (chevauchements et intégrité référentielle)
  const reservations = await prisma.reservation.findMany({
    include: { room: true, guest: true },
    orderBy: { checkInDate: 'asc' },
  });

  const activeReservations = reservations.filter(
    (r) => r.status !== 'CANCELLED' && r.status !== 'NO_SHOW',
  );

  for (const res of reservations) {
    if (!res.room) {
      anomalies.push(`[RESERVATION_ORPHELINE] Réservation ${res.reference} (${res.id}) : chambre introuvable.`);
    }
    if (!res.guest) {
      anomalies.push(`[RESERVATION_ORPHELINE] Réservation ${res.reference} (${res.id}) : client introuvable.`);
    }
  }

  for (let i = 0; i < activeReservations.length; i++) {
    for (let j = i + 1; j < activeReservations.length; j++) {
      const a = activeReservations[i];
      const b = activeReservations[j];
      if (a.roomId === b.roomId) {
        const aIn = new Date(a.checkInDate).getTime();
        const aOut = new Date(a.checkOutDate).getTime();
        const bIn = new Date(b.checkInDate).getTime();
        const bOut = new Date(b.checkOutDate).getTime();
        if (aIn < bOut && bIn < aOut) {
          anomalies.push(
            `[CHEVAUCHEMENT_RESERVATION] Chambre ${a.room?.number || a.roomId} : chevauchement entre ${a.reference} et ${b.reference}.`,
          );
        }
      }
    }
  }

  console.log(`2. Contrôle des réservations (${reservations.length} réservations) :`);
  console.log(`   - Réservations actives contrôlées : ${activeReservations.length}`);

  // 4. Contrôle des factures et paiements
  const invoices = await prisma.invoice.findMany({
    include: { lines: true, payments: true },
  });

  for (const inv of invoices) {
    const linesSum = inv.lines.reduce((acc, l) => acc + l.totalPriceFcfa, 0);
    const paymentsSum = inv.payments.reduce((acc, p) => acc + p.amountFcfa, 0);
    const expectedBalance = Math.max(0, linesSum - inv.depositFcfa - paymentsSum);

    if (inv.lines.length > 0 && inv.totalFcfa !== linesSum) {
      anomalies.push(
        `[FACTURE_INCOHERENTE] Facture ${inv.invoiceNumber} : totalFcfa (${inv.totalFcfa}) != somme des lignes (${linesSum}).`,
      );
    }
    if (inv.balanceFcfa !== expectedBalance) {
      anomalies.push(
        `[FACTURE_SOLDE_INCOHERENT] Facture ${inv.invoiceNumber} : balanceFcfa (${inv.balanceFcfa}) != attendu (${expectedBalance}).`,
      );
    }
  }

  console.log(`3. Contrôle des factures et paiements (${invoices.length} factures) :`);
  console.log(`   - Cohérence lignes / acomptes / paiements vérifiée.`);

  // 5. Contrôle des utilisateurs (rôle obligatoire, mot de passe haché, jamais en clair)
  const users = await prisma.user.findMany();
  for (const u of users) {
    if (!u.role) {
      anomalies.push(`[UTILISATEUR_SANS_ROLE] Utilisateur ${u.email} (${u.id}) n'a aucun rôle.`);
    }
    if (!u.passwordHash || !isValidPasswordHash(u.passwordHash)) {
      anomalies.push(
        `[MOT_DE_PASSE_NON_HACHE] Utilisateur ${u.email} (${u.id}) n'a pas d'empreinte de mot de passe cryptographique valide.`,
      );
    }
  }

  console.log(`4. Contrôle des comptes utilisateurs (${users.length} comptes) :`);
  console.log(`   - Rôles et hachages cryptographiques vérifiés.`);

  // 6. Nombre de lignes par table
  const tableCounts: Record<string, number> = {
    users: await prisma.user.count(),
    refresh_tokens: await prisma.refreshToken.count(),
    room_types: await prisma.roomType.count(),
    rooms: await prisma.room.count(),
    guests: await prisma.guest.count(),
    reservations: await prisma.reservation.count(),
    invoices: await prisma.invoice.count(),
    invoice_lines: await prisma.invoiceLine.count(),
    payments: await prisma.payment.count(),
    restaurant_categories: await prisma.restaurantCategory.count(),
    restaurant_products: await prisma.restaurantProduct.count(),
    orders: await prisma.restaurantOrder.count(),
    order_lines: await prisma.restaurantOrderLine.count(),
    hotel_settings: await prisma.hotelSetting.count(),
    audit_log: await prisma.auditLog.count(),
    sync_operations: await prisma.syncOperation.count(),
  };

  console.log('\n5. Nombre de lignes par table PostgreSQL :');
  console.table(
    Object.entries(tableCounts).map(([table, count]) => ({
      Table: table,
      Lignes: count,
    })),
  );

  if (anomalies.length > 0) {
    console.error(`\n❌ ${anomalies.length} ANOMALIE(S) DÉTECTÉE(S) :`);
    for (const a of anomalies) {
      console.error(`   - ${a}`);
    }
  } else {
    console.log('\n✅ AUCUNE ANOMALIE DÉTECTÉE : Intégrité images & base de données 100 % conforme.');
  }

  return { anomalies, orphans, tableCounts };
}

async function main() {
  try {
    const result = await runIntegrityCheck();
    if (result.anomalies.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('[ERREUR VERIFIER-INTEGRITE]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('verifier-integrite.ts') || process.argv[1].endsWith('verifier-integrite'))
) {
  main();
}
