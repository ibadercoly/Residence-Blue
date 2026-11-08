# Résidence Blue — Logiciel de Gestion Hôtelière (PMS)

Logiciel de gestion hôtelière (**PMS Offline-First**) pour la **Résidence Blue** (hôtel de 12 chambres : 6 Standard, 4 Deluxe, 2 Suites, avec restaurant et bar) situé à **Grand Standing, Thiès (Sénégal)**.

- **Devise :** Franc CFA (`FCFA`), montants stockés exclusivement en **ENTIERS** (aucun décimal autorisé).
- **Interface :** Français.
- **Architecture Hors Ligne (Offline-First) :** Lecture depuis IndexedDB, écriture dans une file d'attente (outbox) avec `Idempotency-Key` (UUID v4 généré côté client).

---

## Stack Technique

- **Monorepo npm workspaces :**
  - `apps/api` : Backend **NestJS** + **Prisma** + **PostgreSQL 16**
  - `apps/web` : Frontend **Angular** (Standalone Components, Signals, Routing, **PWA** `@angular/service-worker` + Tailwind CSS local)
  - `packages/shared` : Types TypeScript et utilitaires métier partagés
- **Qualité & Tests :** ESLint, Prettier, Jest (tests unitaires), Supertest (tests d'intégration et de sécurité), Playwright (tests E2E & comparaison visuelle), Husky + Commitlint.
- **Conteneurisation :** Docker Compose (`db`, `api`, `web` sous Nginx). La base PostgreSQL 16 (`db`) est isolée sur un réseau Docker interne (`internal_net`) et n'expose **aucun port vers l'hôte**.

---

## Prérequis & Installation

1. **Node.js 22+** et **npm 10+** (et **Docker Desktop** pour l'exécution conteneurisée).
2. Copier le fichier d'environnement d'exemple :
   ```bash
   cp .env.example .env
   ```
3. Installer les dépendances à la racine du monorepo :
   ```bash
   npm install
   ```

---

## Commandes de Lancement

### En développement local
```bash
# Générer le client Prisma et compiler tous les paquets
npm run prisma:generate
npm run build

# Lancer l'API NestJS (port 3000)
npm run start --workspace=@residence-blue/api

# Lancer le serveur Web Angular PWA (port 4200)
npm run start --workspace=@residence-blue/web
```
- **Application Web :** `http://localhost:4200`
- **Santé de l'API :** `http://localhost:3000/health` (et `http://localhost:3000/api/health`)

### Avec Docker Compose (3 services : `db`, `api`, `web`)
```bash
docker compose up -d --build
```
- `db` (`postgres:16-alpine`) : accessible uniquement par `api` via le réseau interne `internal_net` (aucun port publié sur l'hôte).
- `api` : exposé sur `http://localhost:3000` (`GET /health` renvoie `200 OK` `{ "status": "ok" }`).
- `web` (Nginx) : exposé sur `http://localhost:4200`.

---

## Commandes de Vérification et de Test

Toutes les vérifications doivent être vertes avant toute fusion dans `master` :

```bash
# 1. Analyse statique (ESLint sur shared, api, web)
npm run lint

# 2. Compilation complète (shared + api + web PWA)
npm run build

# 3. Tests unitaires (Jest : shared + api + web)
npm run test

# 4. Tests d'intégration API (Supertest : dont GET /health)
npm run test:integration

# 5. Tests de la Porte de Sécurité (Security Gate : RBAC, ValidationPipe, AES-256-GCM, FCFA entier)
npm run test:security

# 6. Tests End-to-End & Fidélité Visuelle (Playwright)
npm run test:e2e

# Exécuter toute la suite backend/unitaire d'un coup
npm run test:all
```

---

## Structure du Dépôt

```text
Residence-Blue/
├── .github/workflows/ci.yml   # Pipeline CI (lint, build, unit, integration, e2e, security)
├── .husky/                    # Hooks Git (pre-commit: lint + test, commit-msg: commitlint)
├── apps/
│   ├── api/                   # API NestJS + Prisma + Tests Supertest/Sécurité
│   └── web/                   # Application Angular Standalone + Signals + PWA + Playwright
├── packages/
│   └── shared/                # Types partagés et validation entière FCFA
├── design/                    # Maquettes Stitch et tokens CSS/SCSS
├── docs/
│   ├── design/                # Analyses des maquettes, composants, écarts et comparaisons visuelles
│   └── security/              # Rapports de la Porte de Sécurité
├── docker-compose.yml         # Orchestration Docker (db isolée, api, web)
└── AGENTS.md                  # Règles d'architecture, sécurité et workflow Git
```
