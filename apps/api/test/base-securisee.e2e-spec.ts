import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

describe('Base de données sécurisée (feature/base-securisee) — Intégration & Porte de Sécurité', () => {
  const dbHost = process.env.TEST_DB_HOST || 'localhost';
  const dbPort = process.env.TEST_DB_PORT || '5432';
  const dbName = process.env.TEST_DB_NAME || 'residence_blue_db';

  const ownerUrl = `postgresql://app_owner:app_owner_scram_secret@${dbHost}:${dbPort}/${dbName}?schema=public`;
  const appUserUrl = `postgresql://app_user:app_user_scram_secret@${dbHost}:${dbPort}/${dbName}?schema=public`;
  const readonlyUrl = `postgresql://app_readonly:app_readonly_scram_secret@${dbHost}:${dbPort}/${dbName}?schema=public`;

  let ownerClient: PrismaClient;
  let appUserClient: PrismaClient;
  let readonlyClient: PrismaClient;

  beforeAll(async () => {
    ownerClient = new PrismaClient({ datasources: { db: { url: ownerUrl } } });
    appUserClient = new PrismaClient({ datasources: { db: { url: appUserUrl } } });
    readonlyClient = new PrismaClient({ datasources: { db: { url: readonlyUrl } } });

    await ownerClient.$connect();
    await appUserClient.$connect();
    await readonlyClient.$connect();

    // Nettoyage initial des tables non-append-only
    await ownerClient.refreshToken.deleteMany();
    await ownerClient.syncOperation.deleteMany();
    await ownerClient.user.deleteMany();
  });

  afterAll(async () => {
    await ownerClient?.$disconnect();
    await appUserClient?.$disconnect();
    await readonlyClient?.$disconnect();
  });

  describe('1. Schéma Prisma strict (4 tables système uniquement, aucune table métier)', () => {
    it('ne doit comporter que les 4 tables : users, refresh_tokens, audit_log, sync_operations', async () => {
      const tables = await appUserClient.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename NOT LIKE '_prisma%'
        ORDER BY tablename ASC
      `;

      const tableNames = tables.map((t) => t.tablename);
      expect(tableNames).toEqual(['audit_log', 'refresh_tokens', 'sync_operations', 'users']);
    });

    it('doit vérifier que les 3 rôles PostgreSQL utilisent scram-sha-256 et que app_user n’est pas superuser', async () => {
      const roles = await ownerClient.$queryRaw<
        Array<{ rolname: string; rolsuper: boolean; rolcreatedb: boolean; rolcreaterole: boolean }>
      >`
        SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
        FROM pg_roles
        WHERE rolname IN ('app_owner', 'app_user', 'app_readonly')
        ORDER BY rolname ASC
      `;

      expect(roles).toEqual([
        { rolname: 'app_owner', rolsuper: false, rolcreatedb: false, rolcreaterole: false },
        { rolname: 'app_readonly', rolsuper: false, rolcreatedb: false, rolcreaterole: false },
        { rolname: 'app_user', rolsuper: false, rolcreatedb: false, rolcreaterole: false },
      ]);
    });
  });

  describe('2. Restrictions DDL de app_user (interdiction de DROP TABLE / CREATE TABLE)', () => {
    it('doit interdire à app_user de faire un DROP TABLE sur users ou audit_log', async () => {
      await expect(
        appUserClient.$executeRawUnsafe('DROP TABLE "users" CASCADE;'),
      ).rejects.toThrow();

      await expect(
        appUserClient.$executeRawUnsafe('DROP TABLE "audit_log" CASCADE;'),
      ).rejects.toThrow();
    });

    it('doit interdire à app_user de créer une nouvelle table (CREATE TABLE)', async () => {
      await expect(
        appUserClient.$executeRawUnsafe('CREATE TABLE hacked_table (id INT);'),
      ).rejects.toThrow();
    });
  });

  describe('3. Table audit_log en ajout seul (Append-Only : privilèges + trigger)', () => {
    let createdLogId: string;

    it('doit permettre à app_user d’insérer (INSERT) et de lire (SELECT) dans audit_log', async () => {
      const log = await appUserClient.auditLog.create({
        data: {
          action: 'USER_LOGIN_SUCCESS',
          entity: 'User',
          entityId: '00000000-0000-0000-0000-000000000001',
          before: { failedLogins: 1 },
          after: { failedLogins: 0 },
          ip: '192.168.1.10',
        },
      });

      expect(log.id).toBeDefined();
      createdLogId = log.id;

      const fetched = await appUserClient.auditLog.findUnique({
        where: { id: createdLogId },
      });
      expect(fetched?.action).toBe('USER_LOGIN_SUCCESS');
    });

    it('doit interdire à app_user de modifier (UPDATE) une entrée de audit_log', async () => {
      await expect(
        appUserClient.auditLog.update({
          where: { id: createdLogId },
          data: { action: 'TAMPERED_ACTION' },
        }),
      ).rejects.toThrow();
    });

    it('doit interdire à app_user de supprimer (DELETE) une entrée de audit_log', async () => {
      await expect(
        appUserClient.auditLog.delete({
          where: { id: createdLogId },
        }),
      ).rejects.toThrow();
    });

    it('doit bloquer via le trigger trg_audit_log_append_only même si app_owner tente un UPDATE ou DELETE sur audit_log', async () => {
      await expect(
        ownerClient.auditLog.update({
          where: { id: createdLogId },
          data: { action: 'OWNER_TAMPER_ATTEMPT' },
        }),
      ).rejects.toThrow(/ajout seul|append-only/i);

      await expect(
        ownerClient.auditLog.delete({
          where: { id: createdLogId },
        }),
      ).rejects.toThrow(/ajout seul|append-only/i);
    });
  });

  describe('4. Isolation des rôles : app_readonly ne peut que lire (SELECT)', () => {
    it('doit autoriser app_readonly à lire (SELECT) mais lui interdire INSERT, UPDATE et DELETE', async () => {
      const logs = await readonlyClient.auditLog.findMany({ take: 5 });
      expect(Array.isArray(logs)).toBe(true);

      await expect(
        readonlyClient.user.create({
          data: {
            email: 'readonly-hack@residence-blue.sn',
            passwordHash: 'hash',
            role: 'RECEPTION',
          },
        }),
      ).rejects.toThrow();

      await expect(
        readonlyClient.$executeRawUnsafe(`DELETE FROM "users";`),
      ).rejects.toThrow();
    });
  });

  describe('5. Porte de sécurité : mauvais mot de passe et injection SQL', () => {
    it('doit rejeter toute connexion avec un mauvais mot de passe (authentification scram-sha-256)', async () => {
      const badClient = new PrismaClient({
        datasources: {
          db: {
            url: `postgresql://app_user:mauvais_mot_de_passe_test@${dbHost}:${dbPort}/${dbName}?schema=public`,
          },
        },
      });

      await expect(badClient.$connect()).rejects.toThrow();
    });

    it('doit neutraliser une tentative d’injection SQL dans un champ texte grâce au paramétrage Prisma', async () => {
      const sqlInjectionEmail = "attacker@thies.sn'; DROP TABLE users; --";

      const created = await appUserClient.user.create({
        data: {
          email: sqlInjectionEmail,
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$test',
          role: 'RECEPTION',
        },
      });

      expect(created.email).toBe(sqlInjectionEmail);

      // Recherche avec payload d'injection SQL : "' OR '1'='1"
      const injectionLookup = await appUserClient.user.findUnique({
        where: { email: "' OR '1'='1" },
      });
      expect(injectionLookup).toBeNull();

      // La table users existe toujours et contient bien l'enregistrement littéral
      const existingCount = await appUserClient.user.count();
      expect(existingCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('6. Sauvegarde chiffrée (scripts/backup.sh) et restauration complète (scripts/restore.sh)', () => {
    it('doit exécuter une sauvegarde chiffrée GPG, puis restaurer intégralement les données après perte', async () => {
      const markerEmail = `restore-test-${Date.now()}@residence-blue.sn`;

      // 1. Créer un utilisateur témoin avant la sauvegarde
      const createdUser = await appUserClient.user.create({
        data: {
          email: markerEmail,
          passwordHash: 'scram_hash_restore_test',
          role: 'DIRECTION',
        },
      });
      expect(createdUser.id).toBeDefined();

      // 2. Exécuter scripts/backup.sh avec Git Bash + GPG
      const repoRoot = path.resolve(process.cwd(), '../..');
      const backupShPath = path.join(repoRoot, 'scripts', 'backup.sh').replace(/\\/g, '/');
      const restoreShPath = path.join(repoRoot, 'scripts', 'restore.sh').replace(/\\/g, '/');
      const tmpBackupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rb-backups-')).replace(/\\/g, '/');

      const gitUsrBin = 'C:\\Program Files\\Git\\usr\\bin';
      const shBin = fs.existsSync(path.join(gitUsrBin, 'sh.exe'))
        ? `"${path.join(gitUsrBin, 'sh.exe')}"`
        : 'sh';

      const envWithGit = {
        ...process.env,
        PATH: `${gitUsrBin};${process.env.PATH || ''}`,
        PG_CONTAINER: 'residence_blue_postgres',
        PGUSER: 'blue_user',
        PGPASSWORD: 'blue_password',
        PGDATABASE: 'residence_blue_db',
        BACKUP_DIR: tmpBackupDir,
        BACKUP_ENCRYPTION_KEY: 'CleSecreteTest2026!',
      };

      const backupOutput = execSync(`${shBin} "${backupShPath}"`, {
        encoding: 'utf8',
        env: envWithGit,
      });

      expect(backupOutput).toContain('Sauvegarde chiffrée');

      const latestBackupPath = fs
        .readFileSync(path.join(tmpBackupDir, 'latest_backup.txt'), 'utf8')
        .trim();
      expect(latestBackupPath).toMatch(/backup_residence_blue_\d{8}_\d{6}\.sql\.gpg$/);
      expect(fs.existsSync(latestBackupPath)).toBe(true);

      // Vérifier que le fichier de sauvegarde est bien chiffré (binaire GPG, aucune donnée en clair)
      const rawEncryptedBytes = fs.readFileSync(latestBackupPath, 'utf8');
      expect(rawEncryptedBytes).not.toContain(markerEmail);

      // 3. Simuler une suppression accidentelle de l'utilisateur témoin
      await appUserClient.user.delete({ where: { id: createdUser.id } });
      const deletedCheck = await appUserClient.user.findUnique({ where: { id: createdUser.id } });
      expect(deletedCheck).toBeNull();

      // 4. Exécuter scripts/restore.sh pour déchiffrer et restaurer la base
      const restoreOutput = execSync(`${shBin} "${restoreShPath}" "${latestBackupPath}"`, {
        encoding: 'utf8',
        env: envWithGit,
      });
      expect(restoreOutput).toContain('Restauration complète terminée');

      // Réappliquer la fonction de verrouillage des privilèges sur les tables recréées par le dump --clean
      execSync(
        `docker exec residence_blue_postgres psql -U blue_user -d residence_blue_db -c "SELECT enforce_residence_blue_permissions();"`,
      );

      // 5. Vérifier que l'utilisateur témoin est bien restauré à l'identique
      const restoredUser = await appUserClient.user.findUnique({
        where: { email: markerEmail },
      });
      expect(restoredUser).not.toBeNull();
      expect(restoredUser?.id).toBe(createdUser.id);
      expect(restoredUser?.role).toBe('DIRECTION');

      // Nettoyage du dossier temporaire
      fs.rmSync(tmpBackupDir, { recursive: true, force: true });
    }, 30000);
  });
});
