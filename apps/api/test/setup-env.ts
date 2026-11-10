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

// Configuration de la base de données pour les tests
process.env.TEST_DB_HOST ??= '127.0.0.1';
process.env.TEST_DB_PORT ??= '5432';
process.env.TEST_DB_NAME ??= process.env.POSTGRES_DB || 'residence_blue_db';
process.env.TEST_PG_CONTAINER ??= 'residence_blue_db';

process.env.TEST_APP_OWNER_PASSWORD =
  process.env.APP_OWNER_PASSWORD || process.env.TEST_APP_OWNER_PASSWORD || 'owner_secure_pass_residence_blue_2026';
process.env.TEST_APP_USER_PASSWORD =
  process.env.APP_USER_PASSWORD || process.env.TEST_APP_USER_PASSWORD || 'user_secure_pass_residence_blue_2026';
process.env.TEST_APP_READONLY_PASSWORD =
  process.env.APP_READONLY_PASSWORD || process.env.TEST_APP_READONLY_PASSWORD || 'readonly_secure_pass_residence_blue_2026';
process.env.TEST_BACKUP_ENCRYPTION_KEY =
  process.env.BACKUP_ENCRYPTION_KEY || process.env.TEST_BACKUP_ENCRYPTION_KEY || 'backup_secret_passphrase_residence_blue_2026';

process.env.DATABASE_URL ??=
  `postgresql://app_user:${encodeURIComponent(process.env.TEST_APP_USER_PASSWORD)}@127.0.0.1:5432/${process.env.TEST_DB_NAME}?schema=public`;

process.env.ENCRYPTION_MASTER_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
