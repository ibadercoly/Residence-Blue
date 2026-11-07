/**
 * Environnement de test : valeurs de repli non sensibles.
 * Les tests d'intégration et de sécurité ne doivent pas dépendre
 * d'une base PostgreSQL réellement démarrée.
 */
process.env.DATABASE_URL ??=
  'postgresql://blue_user:blue_password@localhost:5432/residence_blue_db?schema=public&connect_timeout=1';
process.env.ENCRYPTION_MASTER_KEY ??=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
