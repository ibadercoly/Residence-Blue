# Porte de Sécurité — Planning des Réservations (`/planning`)

> **Fonctionnalité :** Tape Chart & Planning Gantt des 12 Clés  
> **Route :** `/planning`  
> **Référence maquette :** `design/maquettes/planning_des_r_servations/code.html`  
> **Date de l'audit :** 09 Novembre 2026  
> **Statut global :** **CONFORME & VALIDÉ (100% SUCCÈS)**  

---

## 1. Contexte & Périmètre de Sécurité

L'écran du planning Gantt (Tape Chart) est le cœur opérationnel de l'exploitation hôtelière de la Résidence Blue à Thiès. Il affiche en temps réel l'attribution des 12 chambres, les arrivées et départs, les profils des clients (dont des profils VIP), la tarification en FCFA et les alertes d'attribution (surréservations/conflits).

Dans le cadre des règles d'ingénierie stricte (`AGENTS.md`) et de la réglementation sénégalaise sur les données personnelles (CDP Sénégal / Loi 2008-12), une batterie de tests d'attaque et de vérification a été menée contre notre propre implémentation.

---

## 2. Vecteurs d'Attaque & Résultats des Tests

| Catégorie CWE / OWASP | Scénario d'attaque testé | Comportement attendu | Résultat obtenu |
| :--- | :--- | :--- | :--- |
| **CWE-200 : Exposition d'informations sensibles** | Tentative de lecture dans le DOM des pièces d'identité (CNI, Passeport), empreintes ou hash de mots de passe des clients. | Aucune pièce d'identité en clair dans le DOM. Seules les métadonnées nécessaires à l'accueil (nom, téléphone, dates) sont visibles. | **RÉUSSI** (Validé par `planning-security.spec.ts`) |
| **CWE-79 : Cross-Site Scripting (XSS)** | Injection de payloads malveillants (`<script>`, `onerror=`, `javascript:`) dans les notes de conciergerie ou les noms d'invités. | Échappement et interpolation stricts par le moteur de templates Angular. Aucun script exécuté. | **RÉUSSI** (Validé par `planning-security.spec.ts`) |
| **CWE-319 : Fuite réseau & CDN distants** | Inspection du trafic réseau sortant lors du chargement et de la manipulation du planning Gantt. | Zéro appel vers des CDN (Google Fonts, Tailwind CDN, CDNs de télémétrie). 100 % des polices, icônes et styles proviennent du serveur local. | **RÉUSSI** (Validé par `planning-security.spec.ts`) |
| **Règle Monétaire AGENTS.md : Intégrité financière** | Injection ou affichage de montants avec décimales ou formatage bancaire invalide dans le volet Folio. | Tous les montants FCFA affichés sont des entiers stricts (ex: 780 000 FCFA, 500 000 FCFA, 280 000 FCFA), sans centimes ni décimales flottantes. | **RÉUSSI** (Validé par `PlanningMockService` & tests E2E) |
| **Idempotence & Prévention des Conflits** | Simulation d'opérations simultanées de relogement et déplacement de réservation (Tape Chart). | Gestion contrôlée du relogement sans duplication de dossier client, avec préparation des événements idempotents pour l'API. | **RÉUSSI** (Validé par `planning.spec.ts`) |

---

## 3. Matrice des Tests de Sécurité Automatisés

- Suite de tests : `apps/web/e2e/planning-security.spec.ts`
- Exécuteur : Playwright (Moteur Chromium headless hermétique)
- Résultats :
  - `Sécurité Réseau : Aucune requête vers des CDN ou domaines externes` : **PASS**
  - `Protection des Données : Aucun secret, token d'authentification ni pièce d'identité en clair` : **PASS**
  - `Règle Monétaire : Tous les montants FCFA affichés sont des entiers stricts sans décimales` : **PASS**
  - `Résistance XSS : Les consignes et noms d'invités sont encodés et sécurisés` : **PASS**

---

## 4. Recommandations pour le Raccordement API (TODO Backend)

1. **Chiffrement au repos :** Les documents d'identité collectés à l'enregistrement doivent être chiffrés en base de données PostgreSQL via le module `CryptoService` (AES-256-GCM).
2. **Idempotency-Key :** Chaque action de relogement ou prolongation générée depuis le Tape Chart doit être signée par un en-tête `Idempotency-Key` unique (UUID v4) pour empêcher les doubles attributions lors de micro-coupures de connexion.
3. **Contrôle d'accès basé sur les rôles (RBAC) :** La modification du Tape Chart est réservée aux rôles `DIRECTION` et `RECEPTION`. Le rôle `GOUVERNANTE` dispose d'un accès en lecture seule avec droit de mise à jour du statut ménage.
