# Porte de Sécurité : Base de données PostgreSQL sécurisée (`feature/base-securisee`)

## 1. Périmètre audité
Ce document consigne les tests offensifs et les contrôles de sécurité exécutés sur l'infrastructure de persistance et de chiffrement de **Résidence Blue** :
- **Modèles Prisma (`apps/api/prisma/schema.prisma`)** : uniquement les 4 tables système (`users`, `refresh_tokens`, `audit_log`, `sync_operations`) et l'enum `Role` (`DIRECTION`, `RECEPTION`, `RESTAURANT`, `HOUSEKEEPING`, `MAINTENANCE`, `COMPTABLE`), sans aucune table métier prématurée.
- **Rôles PostgreSQL 16 (`docker/postgres/init.sql`)** : séparation stricte entre `app_owner` (migrations), `app_user` (exécution API sans DDL ni superuser) et `app_readonly` (lecture seule pour les rapports), avec authentification `scram-sha-256`.
- **Journal d'audit immuable (`audit_log`)** : table en ajout seul (`SELECT` + `INSERT` uniquement pour `app_user`) doublée du trigger PostgreSQL `trg_audit_log_append_only` (`prevent_audit_log_modification()`).
- **Chiffrement applicatif (`CryptoService`)** : AES-256-GCM avec clé en variable d'environnement, identifiant de clé (`keyId`) stocké avec le chiffré et authentifié via AAD pour la rotation de clés (`keyId:ivHex:authTagHex:cipherHex`), et IV aléatoire de 12 octets par valeur.
- **Sauvegardes chiffrées (`scripts/backup.sh` & `scripts/restore.sh`)** : `pg_dump` chiffré en AES-256 avec `gpg` ou `age`, conteneur cron quotidien dans `docker-compose.yml` et test automatisé de restauration complète.

---

## 2. Attaques exécutées et résultats (Porte de Sécurité)

### Attaque 1 : Connexion à la base depuis l'extérieur du réseau Docker
- **Vecteur testé** : Tentative de connexion directe au service `db` depuis l'extérieur du réseau interne Docker (`internal_net`).
- **Configuration vérifiée (`docker-compose.yml`)** :
  - Le service `db` est attaché exclusivement au réseau `internal_net` (`internal: true`).
  - Aucune directive `ports:` n'est déclarée sur le service `db` (seul `expose: ["5432"]` est présent sur le réseau interne).
- **Résultat** : **BLOQUÉ**. Aucun port TCP 5432 du service `db` de `docker-compose.yml` n'est exposé sur les interfaces réseau de l'hôte. Seuls les conteneurs membres de `internal_net` (`api` et `backup`) peuvent joindre `db:5432`.

### Attaque 2 : Connexion avec un mauvais mot de passe (`scram-sha-256`)
- **Vecteur testé** : Connexion PostgreSQL avec l'utilisateur `app_user` et un mot de passe invalide (`postgresql://app_user:mauvais_mot_de_passe_test@...`).
- **Preuve automatisée** : Test `doit rejeter toute connexion avec un mauvais mot de passe (authentification scram-sha-256)` dans `apps/api/test/base-securisee.e2e-spec.ts`.
- **Vérification `pg_authid`** : Les 3 rôles (`app_owner`, `app_user`, `app_readonly`) stockent exclusivement des empreintes `SCRAM-SHA-256$...` (`password_encryption = 'scram-sha-256'`).
- **Résultat** : **BLOQUÉ** (`28P01: password authentication failed for user "app_user"`).

### Attaque 3 : Injection SQL via un champ texte
- **Vecteur testé** :
  1. Insertion d'une charge utile malveillante dans le champ `email` de `User` :
     `attacker@thies.sn'; DROP TABLE users; --`
  2. Tentative de contournement d'authentification / lecture globale via `findUnique` avec la chaîne `' OR '1'='1`.
- **Preuve automatisée** : Test `doit neutraliser une tentative d’injection SQL dans un champ texte grâce au paramétrage Prisma` dans `apps/api/test/base-securisee.e2e-spec.ts`.
- **Résultat** : **BLOQUÉ / NEUTRALISÉ**. Prisma utilise exclusivement des requêtes préparées paramétrées (`$1`, `$2`). La chaîne d'attaque est traitée comme un littéral texte pur, la recherche `' OR '1'='1` renvoie `null`, et la table `users` demeure intacte.

### Attaque 4 : Élévation de privilèges / Exécution de DDL (`DROP TABLE` / `CREATE TABLE`) par `app_user`
- **Vecteur testé** : Exécution de `DROP TABLE "users" CASCADE;`, `DROP TABLE "audit_log" CASCADE;` et `CREATE TABLE hacked_table (id INT);` via la connexion de l'API (`app_user`).
- **Preuve automatisée** : Section `2. Restrictions DDL de app_user` dans `apps/api/test/base-securisee.e2e-spec.ts`.
- **Résultat** : **BLOQUÉ** (`42501: must be owner of table` / `permission denied for schema public`).

### Attaque 5 : Altération ou effacement des traces dans `audit_log` (`UPDATE` / `DELETE`)
- **Vecteur testé** :
  1. Tentative de `UPDATE` et `DELETE` sur `audit_log` avec le rôle applicatif `app_user`.
  2. Tentative de `UPDATE` et `DELETE` sur `audit_log` avec le propriétaire du schéma `app_owner`.
- **Preuve automatisée** : Section `3. Table audit_log en ajout seul (Append-Only : privilèges + trigger)` dans `apps/api/test/base-securisee.e2e-spec.ts`.
- **Résultat** : **BLOQUÉ** par double barrière :
  - `app_user` est bloqué dès la vérification des privilèges SQL (`REVOKE UPDATE, DELETE ON audit_log FROM app_user`).
  - Même un rôle privilégié (`app_owner`) est bloqué par le trigger `trg_audit_log_append_only` qui lève l'exception :
    `Opération UPDATE/DELETE interdite : la table audit_log est en ajout seul (append-only) (SQLSTATE 42501)`.

### Attaque 6 : Écriture avec le rôle de reporting `app_readonly`
- **Vecteur testé** : Tentative de `INSERT` et `DELETE` dans `users` avec le rôle `app_readonly`.
- **Preuve automatisée** : Section `4. Isolation des rôles : app_readonly ne peut que lire (SELECT)` dans `apps/api/test/base-securisee.e2e-spec.ts`.
- **Résultat** : **BLOQUÉ** (`42501: permission denied for table users`).

### Attaque 7 : Altération d'un chiffré AES-256-GCM (`CryptoService`)
- **Vecteur testé** : Modification d'un octet du texte chiffré, du tag d'authentification GCM, de l'IV ou de l'identifiant de clé (`keyId`) lié par AAD.
- **Preuve automatisée** : `apps/api/src/common/security/crypto.service.spec.ts`.
- **Résultat** : **BLOQUÉ**. `CryptoService.decrypt()` lève immédiatement une exception d'intégrité cryptographique.

---

## 3. Synthèse de conformité

| Exigence | Statut | Preuve |
| :--- | :---: | :--- |
| Modèles Prisma `User`, `RefreshToken`, `AuditLog`, `SyncOperation` (sans tables métier) | Vert | `apps/api/prisma/schema.prisma` |
| 3 rôles PostgreSQL (`app_owner`, `app_user`, `app_readonly`) + `scram-sha-256` | Vert | `docker/postgres/init.sql` |
| Table `audit_log` en ajout seul (droits retirés + trigger SQL) | Vert | `apps/api/test/base-securisee.e2e-spec.ts` |
| `CryptoService` AES-256-GCM avec `keyId` (rotation), IV aléatoire et rejet d'altération | Vert | `apps/api/src/common/security/crypto.service.spec.ts` |
| Sauvegarde chiffrée (`scripts/backup.sh`), restauration (`scripts/restore.sh`) et cron | Vert | `scripts/backup.sh`, `scripts/restore.sh`, `docker-compose.yml` |
| Test automatisé d'un cycle complet sauvegarde chiffrée + restauration | Vert | `apps/api/test/base-securisee.e2e-spec.ts` |
