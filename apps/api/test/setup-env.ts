/**
 * Environnement de test : valeurs de repli non sensibles, propres aux tests.
 * Elles ne sont JAMAIS utilisées en production (voir .env.example et docker-compose.yml).
 * La CI et les postes de développement peuvent les surcharger par variables d'environnement.
 */
process.env.DATABASE_URL ??=
  'postgresql://blue_user:blue_password@localhost:5432/residence_blue_db?schema=public&connect_timeout=1';
process.env.ENCRYPTION_MASTER_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mots de passe des rôles PostgreSQL de la base de test (tests de base-securisee)
process.env.TEST_APP_OWNER_PASSWORD ??= 'test_owner_pwd';
process.env.TEST_APP_USER_PASSWORD ??= 'test_user_pwd';
process.env.TEST_APP_READONLY_PASSWORD ??= 'test_readonly_pwd';
process.env.TEST_BACKUP_ENCRYPTION_KEY ??= 'test_backup_passphrase';
