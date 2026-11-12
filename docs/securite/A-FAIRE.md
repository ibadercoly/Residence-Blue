# Sécurité En Ligne — Audit npm & Points d'attention restants

## 1. Résultat `npm audit`

Analyse effectuée le 2026-11-12 après ajout de `argon2@0.45.2` (aucune vulnérabilité introduite par `argon2`).

### Dépendances de production (`npm audit --omit=dev`)
- **2 vulnérabilités modérées uniquement (`high: 0, critical: 0`)** :
  - `uuid < 11.1.1` (transitif dans `node_modules/exceljs/node_modules/uuid`, advisory GHSA-w5hq-g745-h8pq : dépassement de tampon potentiel dans v3/v5/v6 si un `buf` explicite est fourni).
  - **Justification** : L'application génère uniquement des UUID v4 aléatoires via `crypto.randomUUID()` ou `uuid.v4()` et n'appelle jamais `uuid.v3/v5/v6` avec un buffer utilisateur dans `exceljs`. La correction automatique proposée par npm (`npm audit fix --force`) rétrograderait `exceljs` vers la version majeure `3.4.0` (ancienne version cassant l'API d'export `WorkbookWriter`). `exceljs@4.4.0` est conservé et isolé côté serveur.

### Dépendances de développement (`npm audit`)
- **13 vulnérabilités `devDependencies` (7 faibles, 6 modérées ; `high: 0, critical: 0`)** :
  - `deepmerge >= 4.2.0` dans la chaîne `jest@29.7.0 / ts-jest@29.2.5` (GHSA-gcqx-w48m-w2h4, `low`) : outil de test local jamais embarqué dans les conteneurs ni dans les builds de production. `npm audit fix --force` rétrograderait vers `jest@25.1.0` (incompatible ESM/TypeScript 6).
  - `minimatch 7.0.0 - 11.0.0` dans `@typescript-eslint/*@8.16.0` (GHSA-g3hv-75wg-m249, `moderate`) : linter de développement jamais exécuté sur des entrées utilisateur externes. `npm audit fix --force` rétrograderait vers `@typescript-eslint@6.15.0` (incompatible ESLint 9).

## 2. Points d'exploitation à vérifier avant mise en production Internet

1. **Terminaison TLS / HTTPS obligatoire (Reverse Proxy)** :
   - Le cookie de rafraîchissement `rb_refresh_token` est émis avec les attributs `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/api/auth`. En production en ligne, un reverse proxy TLS (Caddy / Nginx + Let's Encrypt) doit terminer HTTPS et transmettre `X-Forwarded-Proto: https` (l'API active déjà `trust proxy` et HSTS 1 an avec `includeSubDomains`).
2. **Variables d'environnement secrètes obligatoires** :
   - `JWT_SECRET` (minimum 32 octets aléatoires), `ENCRYPTION_MASTER_KEY` (clé AES-256 hex 64 caractères), `CORS_ORIGIN` (origine HTTPS exacte du domaine, ex. `https://pms.residenceblue.sn`). Ne jamais lancer avec `COOKIE_SECURE=false` en production.
3. **Mode hors ligne avec session sécurisée** :
   - Le jeton d'accès (15 minutes) est conservé strictement en mémoire (jamais dans `localStorage`). À la réouverture du navigateur ou après expiration, une connexion réseau vers `POST /api/auth/refresh` (avec le cookie `httpOnly`) ou une ré-authentification sur `/connexion` est requise.
4. **Sauvegarde de la clé de chiffrement hors base** :
   - Les pièces d'identité clients et les secrets TOTP sont chiffrés en AES-256-GCM avant stockage PostgreSQL ; conserver `ENCRYPTION_MASTER_KEY` dans le gestionnaire de secrets / coffre-fort hors base de données.
