# Registre des Décisions d'Architecture (ADR) - Résidence Blue

Ce document consigne les choix technologiques et architecturaux majeurs adoptés pour le système de gestion de la **Résidence Blue** à Saly (Sénégal).

---

## ADR 001 : Monorepo Workspaces npm & TypeScript Strict
- **Contexte :** Le projet englobe une API backend, une application web PWA et des contrats partagés (types, utilitaires métier).
- **Décision :** Utilisation d'un monorepo natif npm workspaces avec `packages/shared`, `apps/api` (NestJS) et `apps/web` (Angular standalone). Le mode TypeScript strict (`strictNullChecks`, `noImplicitAny`, etc.) est imposé sur l'ensemble de la base de code via `tsconfig.base.json`.
- **Conséquences :** Partage direct des DTOs et des règles métier (notamment FCFA) sans duplication de code, déploiement modulaire et intégration continue fluide.

---

## ADR 002 : Stockage Financier FCFA Strictement en Entiers
- **Contexte :** La devise officielle à Saly est le Franc CFA (XOF / BCEAO), qui ne comporte pas de décimales (pas de centimes). Les calculs en nombres flottants provoquent traditionnellement des dérives d'arrondi (bugs IEEE 754).
- **Décision :** Règle absolue du projet : TOUS les montants financiers (chambres, folios, commandes restaurant/bar, taxes, encaissements) sont stockés sous forme d'entiers (`Int` dans Prisma, validation `Number.isInteger()` systématique dans `@residence-blue/shared`).
- **Conséquences :** Zéro erreur d'arrondi financier, intégrité comptable totale. Tout montant avec virgule est rejeté à la source avec une erreur 400 Bad Request.

---

## ADR 003 : Approche Hors-Ligne (Offline-First) & Clé d'Idempotence
- **Contexte :** Les coupures de réseau ou de courant à Saly sont des réalités opérationnelles. Le personnel de réception et du restaurant doit pouvoir continuer à enregistrer des réservations, folios et paiements sans interruption.
- **Décision :**
  1. Persistance locale dans le navigateur via **IndexedDB** (`rooms`, `reservations`, `outbox`).
  2. Génération d'identifiants primaires sous forme de **UUID v4 côté client**.
  3. Chaque commande émise porte un en-tête `Idempotency-Key`.
  4. File d'attente sortante (`outbox`) qui rejoue les opérations dès le retour de la connexion.
  5. Le serveur NestJS est la source de vérité et arbitre les conflits sans doublonner les opérations grâce au journal d'idempotence (`IdempotencyLog`).
- **Conséquences :** Disponibilité continue du système sur place, résilience aux déconnexions.

---

## ADR 004 : Sécurité Renforcée - "Deny by Default" & Validation Stricte
- **Contexte :** Le logiciel gère des données sensibles (clients VIP, transactions financières, pièces d'identité).
- **Décision :**
  1. **Accès refusé par défaut :** Un `RolesGuard` global intercepte chaque requête. Toute route ne portant ni `@Public()` ni `@Roles(...)` est automatiquement bloquée avec une erreur HTTP 403 Forbidden.
  2. **ValidationPipe stricte :** Configuration avec `whitelist: true` et `forbidNonWhitelisted: true`. Toute charge utile contenant une propriété inattendue déclenche un HTTP 400 Bad Request, neutralisant les attaques par élévation de privilèges (Mass Assignment).
  3. **Pas de SQL brut :** Requêtes paramétrées exclusives via Prisma.
  4. **Zéro secret dans Git :** Fichier `.env.example` fourni, clés réelles gérées par variables d'environnement.
- **Conséquences :** Réduction drastique de la surface d'attaque, conformité avec les exigences de la porte de sécurité.

---

## ADR 005 : Chiffrement AES-256-GCM des Pièces d'Identité
- **Contexte :** La réglementation hôtelière impose la collecte de pièces d'identité (passeports, CNI) pour la fiche de police, mais leur stockage en clair représente un risque de violation de données.
- **Décision :** Implémentation de `CryptoService` utilisant **AES-256-GCM** avec :
  - Clé de 256 bits (`ENCRYPTION_MASTER_KEY`).
  - Vecteur d'initialisation aléatoire (IV de 12 octets) par document.
  - Tag d'authentification de 16 octets garantissant l'intégrité et la résistance aux altérations (tampering).
  - Format de stockage : `ivHex:authTagHex:ciphertextHex`.
- **Conséquences :** Confidentialité et intégrité cryptographique des documents d'identité au repos dans la base de données.

---

## ADR 006 : Frontend Angular 19 Standalone, Signals & Design Tokens Saly
- **Contexte :** Modernité de l'interface, performance, clarté visuelle et intégration des maquettes de la Résidence Blue.
- **Décision :**
  1. Angular standalone components (sans NgModules superflus).
  2. Gestion d'état locale par Signals (`signal`, `computed`).
  3. Respect scrupuleux des tokens de design `Saly Coastal Boutique Hospitality` : Deep Teal (`#00666f`), Sandy Gold (`#7e5700`), typographie Newsreader pour le caractère boutique raffiné et Manrope pour la lisibilité des tableaux opérationnels.
  4. Support PWA avec manifeste et service worker.
- **Conséquences :** Interface légère, rapide, esthétique et optimisée pour l'usage tactile et bureau.
