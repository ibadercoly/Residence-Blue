import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient, Role } from '@prisma/client';

const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'db']);

interface TableCounts {
  usersTotal: number;
  usersAdmin: number;
  usersNonAdmin: number;
  refreshTokens: number;
  roomTypes: number;
  rooms: number;
  guests: number;
  reservations: number;
  invoices: number;
  invoiceLines: number;
  payments: number;
  restaurantCategories: number;
  restaurantProducts: number;
  orders: number;
  orderLines: number;
  hotelSettings: number;
  auditLog: number;
  syncOperations: number;
}

function loadEnvIfMissing(): void {
  if (process.env.DATABASE_URL) return;
  const candidates = [
    path.resolve(__dirname, '../../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '.env'),
  ];
  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;
    const content = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIndex = line.indexOf('=');
      if (eqIndex <= 0) continue;
      const key = line.slice(0, eqIndex).trim();
      let value = line.slice(eqIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
    if (process.env.DATABASE_URL) return;
  }
}

function validateLocalDatabaseUrl(): {
  url: URL;
  host: string;
  port: string;
  dbName: string;
  username: string;
  password: string;
} {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'REFUS DE SÉCURITÉ : NODE_ENV=production détecté. Ce script est strictement réservé à la base de test locale.',
    );
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('DATABASE_URL est absent de l’environnement.');
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL est invalide.');
  }

  if (parsed.protocol !== 'postgresql:' && parsed.protocol !== 'postgres:') {
    throw new Error(`Protocole non supporté (${parsed.protocol}). PostgreSQL requis.`);
  }

  const host = parsed.hostname.toLowerCase();
  if (!ALLOWED_LOCAL_HOSTS.has(host)) {
    throw new Error(
      `REFUS DE SÉCURITÉ : l'hôte "${host}" n'est pas autorisé. Seuls localhost, 127.0.0.1 ou le service Docker local "db" sont autorisés.`,
    );
  }

  const dbName = parsed.pathname.replace(/^\//, '');
  if (!dbName) {
    throw new Error('Nom de base de données introuvable dans DATABASE_URL.');
  }

  return {
    url: parsed,
    host: parsed.hostname,
    port: parsed.port || '5432',
    dbName,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}

async function getTableCounts(prisma: PrismaClient): Promise<TableCounts> {
  const [
    usersTotal,
    usersAdmin,
    refreshTokens,
    roomTypes,
    rooms,
    guests,
    reservations,
    invoices,
    invoiceLines,
    payments,
    restaurantCategories,
    restaurantProducts,
    orders,
    orderLines,
    hotelSettings,
    auditLog,
    syncOperations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: Role.DIRECTION } }),
    prisma.refreshToken.count(),
    prisma.roomType.count(),
    prisma.room.count(),
    prisma.guest.count(),
    prisma.reservation.count(),
    prisma.invoice.count(),
    prisma.invoiceLine.count(),
    prisma.payment.count(),
    prisma.restaurantCategory.count(),
    prisma.restaurantProduct.count(),
    prisma.restaurantOrder.count(),
    prisma.restaurantOrderLine.count(),
    prisma.hotelSetting.count(),
    prisma.auditLog.count(),
    prisma.syncOperation.count(),
  ]);

  return {
    usersTotal,
    usersAdmin,
    usersNonAdmin: usersTotal - usersAdmin,
    refreshTokens,
    roomTypes,
    rooms,
    guests,
    reservations,
    invoices,
    invoiceLines,
    payments,
    restaurantCategories,
    restaurantProducts,
    orders,
    orderLines,
    hotelSettings,
    auditLog,
    syncOperations,
  };
}

function formatTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

async function createBackup(
  prisma: PrismaClient,
  dbInfo: ReturnType<typeof validateLocalDatabaseUrl>,
): Promise<{ type: 'pg_dump' | 'json'; filePath: string }> {
  const backupsDir = path.resolve(__dirname, '../backups');
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = formatTimestamp(new Date());
  const sqlPath = path.join(backupsDir, `backup-test-${stamp}.sql`);

  try {
    execFileSync(
      'pg_dump',
      [
        '-h',
        dbInfo.host,
        '-p',
        dbInfo.port,
        '-U',
        dbInfo.username,
        '-d',
        dbInfo.dbName,
        '-f',
        sqlPath,
        '--no-owner',
        '--no-acl',
      ],
      {
        env: { ...process.env, PGPASSWORD: dbInfo.password },
        stdio: 'pipe',
      },
    );
    if (fs.existsSync(sqlPath) && fs.statSync(sqlPath).size > 0) {
      return { type: 'pg_dump', filePath: sqlPath };
    }
  } catch {
    // Si pg_dump n'est pas disponible sur la machine hôte, bascule sur l'export JSON complet.
    if (fs.existsSync(sqlPath)) {
      try {
        fs.unlinkSync(sqlPath);
      } catch {
        // ignore
      }
    }
  }

  const jsonPath = path.join(backupsDir, `backup-test-${stamp}.json`);
  const [
    users,
    refreshTokens,
    roomTypes,
    rooms,
    guests,
    reservations,
    invoices,
    invoiceLines,
    payments,
    restaurantCategories,
    restaurantProducts,
    orders,
    orderLines,
    hotelSettings,
    auditLog,
    syncOperations,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.refreshToken.findMany(),
    prisma.roomType.findMany(),
    prisma.room.findMany(),
    prisma.guest.findMany(),
    prisma.reservation.findMany(),
    prisma.invoice.findMany(),
    prisma.invoiceLine.findMany(),
    prisma.payment.findMany(),
    prisma.restaurantCategory.findMany(),
    prisma.restaurantProduct.findMany(),
    prisma.restaurantOrder.findMany(),
    prisma.restaurantOrderLine.findMany(),
    prisma.hotelSetting.findMany(),
    prisma.auditLog.findMany(),
    prisma.syncOperation.findMany(),
  ]);

  const payload = {
    createdAt: new Date().toISOString(),
    database: dbInfo.dbName,
    host: dbInfo.host,
    tables: {
      users,
      refresh_tokens: refreshTokens,
      room_types: roomTypes,
      rooms,
      guests,
      reservations,
      invoices,
      invoice_lines: invoiceLines,
      payments,
      restaurant_categories: restaurantCategories,
      restaurant_products: restaurantProducts,
      orders,
      order_lines: orderLines,
      hotel_settings: hotelSettings,
      audit_log: auditLog,
      sync_operations: syncOperations,
    },
  };

  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  if (!fs.existsSync(jsonPath) || fs.statSync(jsonPath).size === 0) {
    throw new Error('La sauvegarde JSON a échoué (fichier vide ou absent).');
  }

  return { type: 'json', filePath: jsonPath };
}

function printCounts(counts: TableCounts, title: string): void {
  console.log(`\n📊 ${title}`);
  console.log(`   - users (total / DIRECTION / autres) : ${counts.usersTotal} (${counts.usersAdmin} DIRECTION, ${counts.usersNonAdmin} autres)`);
  console.log(`   - hotel_settings                     : ${counts.hotelSettings} (conservé)`);
  console.log(`   - refresh_tokens                     : ${counts.refreshTokens}`);
  console.log(`   - room_types                         : ${counts.roomTypes}`);
  console.log(`   - rooms                              : ${counts.rooms}`);
  console.log(`   - guests                             : ${counts.guests}`);
  console.log(`   - reservations                       : ${counts.reservations}`);
  console.log(`   - invoices                           : ${counts.invoices}`);
  console.log(`   - invoice_lines                      : ${counts.invoiceLines}`);
  console.log(`   - payments                           : ${counts.payments}`);
  console.log(`   - restaurant_categories              : ${counts.restaurantCategories}`);
  console.log(`   - restaurant_products                : ${counts.restaurantProducts}`);
  console.log(`   - orders                             : ${counts.orders}`);
  console.log(`   - order_lines                        : ${counts.orderLines}`);
  console.log(`   - audit_log                          : ${counts.auditLog}`);
  console.log(`   - sync_operations                    : ${counts.syncOperations}`);
}

function printBeforeAfterTable(before: TableCounts, after: TableCounts): void {
  const rows: Array<[string, number, number, string]> = [
    ['users (DIRECTION)', before.usersAdmin, after.usersAdmin, 'Conservé'],
    ['users (autres rôles)', before.usersNonAdmin, after.usersNonAdmin, 'Supprimé'],
    ['hotel_settings', before.hotelSettings, after.hotelSettings, 'Conservé'],
    ['refresh_tokens', before.refreshTokens, after.refreshTokens, 'Vidé'],
    ['room_types', before.roomTypes, after.roomTypes, 'Vidé'],
    ['rooms', before.rooms, after.rooms, 'Vidé'],
    ['guests', before.guests, after.guests, 'Vidé'],
    ['reservations', before.reservations, after.reservations, 'Vidé'],
    ['invoices', before.invoices, after.invoices, 'Vidé'],
    ['invoice_lines', before.invoiceLines, after.invoiceLines, 'Vidé'],
    ['payments', before.payments, after.payments, 'Vidé'],
    ['restaurant_categories', before.restaurantCategories, after.restaurantCategories, 'Vidé'],
    ['restaurant_products', before.restaurantProducts, after.restaurantProducts, 'Vidé'],
    ['orders', before.orders, after.orders, 'Vidé'],
    ['order_lines', before.orderLines, after.orderLines, 'Vidé'],
    ['audit_log', before.auditLog, after.auditLog, 'Vidé'],
    ['sync_operations', before.syncOperations, after.syncOperations, 'Vidé'],
  ];

  console.log('\n📋 RÉCAPITULATIF AVANT / APRÈS :');
  console.log('   Table                      | Avant | Après | Action');
  console.log('   ---------------------------+-------+-------+---------');
  for (const [name, b, a, action] of rows) {
    console.log(`   ${name.padEnd(26)} | ${String(b).padStart(5)} | ${String(a).padStart(5)} | ${action}`);
  }
}

async function confirmClear(): Promise<boolean> {
  if (process.argv.includes('--oui') || process.argv.includes('--yes')) {
    return true;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question('\n⚠️  Tapez « VIDER » pour confirmer la suppression des données de test : ', (answer) => {
      rl.close();
      resolve(answer.trim() === 'VIDER');
    });
  });
}

function cleanPhotoDirectories(): number {
  const candidateDirs = new Set<string>([
    path.resolve(process.env.MEDIA_DIR || path.resolve(process.cwd(), 'uploads/rooms')),
    path.resolve(__dirname, '../uploads/rooms'),
    path.resolve(__dirname, '../../../uploads/rooms'),
    path.resolve(__dirname, '../uploads/products'),
    path.resolve(__dirname, '../../../uploads/products'),
    path.resolve(__dirname, '../uploads/restaurant'),
    path.resolve(__dirname, '../../../uploads/restaurant'),
  ]);

  let deletedFiles = 0;
  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === '.gitkeep') continue;
      const target = path.join(dir, entry.name);
      try {
        fs.unlinkSync(target);
        deletedFiles++;
      } catch {
        // Ignorer si un fichier a déjà disparu
      }
    }
  }
  return deletedFiles;
}

async function main(): Promise<void> {
  loadEnvIfMissing();
  const dbInfo = validateLocalDatabaseUrl();

  console.log('=====================================================================');
  console.log('🧹 VIDAGE DE LA BASE DE TEST — RÉSIDENCE BLUE');
  console.log('=====================================================================');
  console.log(`🖥️  Hôte : ${dbInfo.host}:${dbInfo.port}`);
  console.log(`🗄️  Base : ${dbInfo.dbName}`);

  const prisma = new PrismaClient();

  try {
    const before = await getTableCounts(prisma);
    printCounts(before, 'NOMBRE DE LIGNES AVANT SUPPRESSION :');

    console.log('\n💾 Création de la sauvegarde préalable...');
    const backup = await createBackup(prisma, dbInfo);
    console.log(`✅ Sauvegarde créée (${backup.type}) : ${backup.filePath}`);

    const confirmed = await confirmClear();
    if (!confirmed) {
      console.log('\n❌ Opération annulée : aucune donnée n’a été supprimée.');
      process.exit(0);
    }

    console.log('\n🗑️  Suppression transactionnelle en cours...');
    await prisma.$transaction(async (tx) => {
      // TRUNCATE vide toutes les tables opérationnelles (y compris audit_log protégé en DELETE)
      // en une seule opération atomique, en excluant users et hotel_settings.
      await tx.$executeRawUnsafe(`
        TRUNCATE TABLE
          "order_lines",
          "orders",
          "restaurant_products",
          "restaurant_categories",
          "payments",
          "invoice_lines",
          "invoices",
          "reservations",
          "guests",
          "rooms",
          "room_types",
          "refresh_tokens",
          "sync_operations",
          "audit_log"
        RESTART IDENTITY CASCADE;
      `);

      // Supprime tous les comptes non-administrateurs (conserve DIRECTION).
      await tx.user.deleteMany({
        where: { role: { not: Role.DIRECTION } },
      });
    });

    const deletedPhotos = cleanPhotoDirectories();
    console.log(`🖼️  Fichiers images supprimés du disque : ${deletedPhotos}`);

    const after = await getTableCounts(prisma);
    printBeforeAfterTable(before, after);

    const nonEmptyTables: string[] = [];
    if (after.usersNonAdmin !== 0) nonEmptyTables.push('users (non-DIRECTION)');
    if (after.refreshTokens !== 0) nonEmptyTables.push('refresh_tokens');
    if (after.roomTypes !== 0) nonEmptyTables.push('room_types');
    if (after.rooms !== 0) nonEmptyTables.push('rooms');
    if (after.guests !== 0) nonEmptyTables.push('guests');
    if (after.reservations !== 0) nonEmptyTables.push('reservations');
    if (after.invoices !== 0) nonEmptyTables.push('invoices');
    if (after.invoiceLines !== 0) nonEmptyTables.push('invoice_lines');
    if (after.payments !== 0) nonEmptyTables.push('payments');
    if (after.restaurantCategories !== 0) nonEmptyTables.push('restaurant_categories');
    if (after.restaurantProducts !== 0) nonEmptyTables.push('restaurant_products');
    if (after.orders !== 0) nonEmptyTables.push('orders');
    if (after.orderLines !== 0) nonEmptyTables.push('order_lines');
    if (after.auditLog !== 0) nonEmptyTables.push('audit_log');
    if (after.syncOperations !== 0) nonEmptyTables.push('sync_operations');

    if (nonEmptyTables.length > 0) {
      console.error(
        `\n❌ ÉCHEC DE VÉRIFICATION : tables non vides après nettoyage : ${nonEmptyTables.join(', ')}`,
      );
      process.exit(1);
    }

    console.log('\n✅ BASE DE TEST VIDÉE AVEC SUCCÈS (comptes DIRECTION et paramètres hôtel conservés).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Erreur : ${message}`);
  process.exit(1);
});
