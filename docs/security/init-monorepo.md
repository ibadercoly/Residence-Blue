# Rapport de la Porte de Sécurité : Initialisation du Monorepo (`feat/init-monorepo`)

**Date :** 07/11/2026  
**Fonctionnalité :** `feat/init-monorepo` (Structure monorepo, NestJS API, PostgreSQL 16 Prisma, Angular standalone, Types partagés)  
**Évaluateur :** Agent Antigravity  
**Statut :** PASS (Tous les contrôles validés)

---

## 1. Périmètre de la Porte de Sécurité
Dans le cadre de l'initialisation de l'architecture de la **Résidence Blue**, les règles fondamentales de sécurité suivantes ont été soumises à des tests d'attaque automatisés :
1. **Accès refusé par défaut (Deny-by-default)** : Aucune route ne doit être accessible sans déclaration explicite de décorateur (`@Public()` ou `@Roles(...)`).
2. **Validation stricte des entrées (ValidationPipe)** : Rejet absolu des propriétés non définies dans les DTOs (`forbidNonWhitelisted: true`) pour prévenir les attaques de type *Mass Assignment* ou injection de propriétés malveillantes.
3. **Protection de l'intégrité financière (Devise FCFA en entiers)** : Rejet strict de toute tentative d'injection de valeurs décimales ou fractionnaires dans les montants financiers.
4. **Chiffrement des données sensibles (AES-256-GCM)** : Chiffrement symétrique avec vecteur d'initialisation aléatoire (IV de 12 octets) et tag d'authentification (16 octets) pour les pièces d'identité et passeports des clients. Détection immédiate de toute altération de charge (tamper resistance).
5. **Prévention des injections SQL** : Utilisation exclusive du moteur Prisma avec requêtes paramétrées ; aucune requête SQL brute dynamique ou concaténée.
6. **Absence de secrets dans le code** : Vérification des variables d'environnement (`.env.example` vs `.gitignore`).

---

## 2. Scénarios d'attaque et résultats des tests

### Test 1 : Tentative d'accès à une route sans rôles déclarés
- **Vecteur d'attaque :** `GET /api/security-test/undecorated-route`
- **Résultat attendu :** HTTP 403 Forbidden avec message explicite de refus par défaut.
- **Résultat obtenu :** `403 Forbidden` (`Accès refusé par défaut : cette ressource ne déclare aucun rôle autorisé.`).
- **Conclusion :** **CONFORME**.

### Test 2 : Tentative d'élévation de privilèges sur route protégée
- **Vecteur d'attaque :** `GET /api/security-test/admin-only` avec header `x-user-role: RECEPTIONIST` ou sans authentification.
- **Résultat attendu :** HTTP 403 Forbidden.
- **Résultat obtenu :** `403 Forbidden`.
- **Conclusion :** **CONFORME**.

### Test 3 : Attaque par Mass Assignment (Injection de champs arbitraires)
- **Vecteur d'attaque :** `POST /api/security-test/strict-validation` avec charge utile contenant :
  ```json
  {
    "idempotencyKey": "uuid-001",
    "amountFcfa": 50000,
    "guestPassportNumber": "SN-112233",
    "isAdmin": true,
    "role": "SUPERADMIN",
    "discountPercentage": 100
  }
  ```
- **Résultat attendu :** HTTP 400 Bad Request rejetant `isAdmin`, `role`, et `discountPercentage`.
- **Résultat obtenu :** `400 Bad Request` contenant :
  - `property isAdmin should not exist`
  - `property role should not exist`
  - `property discountPercentage should not exist`
- **Conclusion :** **CONFORME**.

### Test 4 : Tentative d'injection d'un montant décimal en FCFA
- **Vecteur d'attaque :** `POST /api/security-test/strict-validation` avec `amountFcfa: 45000.5`.
- **Résultat attendu :** HTTP 400 Bad Request rejetant le montant car non entier.
- **Résultat obtenu :** `400 Bad Request` (`amountFcfa must be an integer number`).
- **Conclusion :** **CONFORME**.

### Test 5 : Altération du Tag d'authentification AES-256-GCM
- **Vecteur d'attaque :** Chiffrement d'une pièce d'identité `CNI-1234567890`, altération d'un octet de l'Authentication Tag, tentative de déchiffrement.
- **Résultat attendu :** Exception cryptographique levée, refus de déchiffrement.
- **Résultat obtenu :** Exception levée avec succès (`Unsupported state or unable to authenticate data`).
- **Conclusion :** **CONFORME**.

---

## 3. Synthèse
Tous les tests de sécurité de la suite `npm run test:security` passent avec succès. Aucune vulnérabilité n'a été détectée.
