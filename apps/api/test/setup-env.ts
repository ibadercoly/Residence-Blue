import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Charger le .env racine et le .env apps/api si présents
const rootEnvPath = path.resolve(process.cwd(), '.env');
const apiEnvPath = path.resolve(process.cwd(), 'apps/api/.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath });
}
if (fs.existsSync(apiEnvPath)) {
  dotenv.config({ path: apiEnvPath, override: false });
}

// Toujours forcer la base de test séparée (jamais la base de développement residence_blue_db)
const testDbName = process.env.E2E_DB_NAME || 'residence_blue_e2e';
process.env.TEST_DB_HOST ??= '127.0.0.1';
process.env.TEST_DB_PORT ??= '5432';
process.env.TEST_DB_NAME = testDbName;
process.env.TEST_PG_CONTAINER ??= 'residence_blue_db';

process.env.TEST_APP_OWNER_PASSWORD =
  process.env.APP_OWNER_PASSWORD || process.env.TEST_APP_OWNER_PASSWORD || 'owner_secure_pass_residence_blue_2026';
process.env.TEST_APP_USER_PASSWORD =
  process.env.APP_USER_PASSWORD || process.env.TEST_APP_USER_PASSWORD || 'user_secure_pass_residence_blue_2026';
process.env.TEST_APP_READONLY_PASSWORD =
  process.env.APP_READONLY_PASSWORD || process.env.TEST_APP_READONLY_PASSWORD || 'readonly_secure_pass_residence_blue_2026';
process.env.TEST_BACKUP_ENCRYPTION_KEY =
  process.env.BACKUP_ENCRYPTION_KEY || process.env.TEST_BACKUP_ENCRYPTION_KEY || 'backup_secret_passphrase_residence_blue_2026';

const rawDbUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL;
if (rawDbUrl) {
  try {
    const parsed = new URL(rawDbUrl);
    parsed.pathname = `/${testDbName}`;
    process.env.DATABASE_URL = parsed.toString();
  } catch {
    process.env.DATABASE_URL =
      `postgresql://app_user:${encodeURIComponent(process.env.TEST_APP_USER_PASSWORD)}@${process.env.TEST_DB_HOST}:${process.env.TEST_DB_PORT}/${testDbName}?schema=public`;
  }
} else {
  process.env.DATABASE_URL =
    `postgresql://app_user:${encodeURIComponent(process.env.TEST_APP_USER_PASSWORD)}@${process.env.TEST_DB_HOST}:${process.env.TEST_DB_PORT}/${testDbName}?schema=public`;
}

process.env.ENCRYPTION_MASTER_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
