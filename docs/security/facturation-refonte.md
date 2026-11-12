# Audit de sécurité — Refonte Facturation V3 (`feature/facturation-refonte`)

## Portée analysée

- Contrôleur et service API : `apps/api/src/billing/billing.controller.ts`, `apps/api/src/billing/billing.service.ts`, DTOs `apps/api/src/billing/dto/billing.dto.ts`
- Rattachement restaurant-chambre : `apps/api/src/restaurant/restaurant.service.ts`
- Interface et service Angular : `apps/web/src/app/facturation-v3/**`
- Contrôle d'accès global : `apps/api/src/common/guards/roles.guard.ts` (`COMPTABLE` activé dans `config/modules.json`)

---

## Contrôles vérifiés par tests automatisés (`apps/api/test/facturation-v3.e2e-spec.ts` & `security-gate.e2e-spec.ts`)

1. **Accès refusé par défaut & RBAC strict par rôle :**
   - Requête sans rôle (`x-user-role` / JWT absent) rejetée en `403`.
   - Rôles non autorisés (`HOUSEKEEPING`, `MAINTENANCE`) rejetés en `403` sur `/api/invoices/counter` et `/api/invoices/:id`.
   - `RECEPTION` bloqué en `403` sur les opérations financières sensibles : export clôture de caisse (`/api/invoices/cash-closure/export`), création d'avoir (`/api/invoices/:id/credit-notes`), suppression/annulation inverse de paiement (`/api/invoices/:id/payments/:paymentId/reverse`), et check-out forcé (`force: true`).
   - `COMPTABLE` bloqué en `403` sur les écritures opérationnelles non comptables lorsque non autorisé (`POST /api/invoices/:id/lines` réservé aux rôles opérationnels), tout en conservant l'accès lecture, encaissements, clôture et création d'avoir.
   - `RESTAURANT` restreint à l'ajout de lignes de catégorie `RESTAURANT` via `/api/invoices/room/:roomNumber/restaurant-charge` ou `POST /api/invoices/:id/lines` avec réponse masquée (`restrictedView: true`, sans montants totaux ni données caisse).

2. **Validation stricte des entrées & intégrité monétaire FCFA :**
   - `ValidationPipe` global avec `whitelist: true` et `forbidNonWhitelisted: true`.
   - Rejet `400` de tout montant décimal (`1000.5` sur ligne, paiement ou remise) : entiers FCFA strictement imposés (`@IsInt()`).
   - Aucun numéro complet de carte bancaire (`PAN` 13–19 chiffres) accepté dans `transactionRef` : rejeté côté client (`hasPotentialCardPan`) et côté serveur.
   - Taux de TVA (`vatRatePercent`), service (`serviceChargePercent`), taxe de séjour par nuit/personne (`touristTaxPerNightFcfa`) et seuil d'approbation de remise (`discountApprovalThresholdPercent`) lus dynamiquement depuis `HotelSetting` en PostgreSQL (aucun taux codé en dur).

3. **Immutabilité fiscale, numérotation séquentielle et concurrence :**
   - Séquence `FA-AAAA-NNNN` et `AV-AAAA-NNNN` générée atomiquement par verrou de ligne PostgreSQL (`INSERT ... ON CONFLICT DO UPDATE`) dans `Prisma.TransactionIsolationLevel.ReadCommitted` : check-outs concurrents vérifiés sans trou ni collision.
   - Facture émise immuable (`400`/`403` sur ajout de ligne, modification de remise ou suppression directe). Correction uniquement via écriture d'avoir (`AV-AAAA-NNNN`) traçable ou écriture inverse de paiement (`Payment.isReversal` réservée à `DIRECTION` avec motif).

4. **Idempotence & traçabilité (`AuditLog`) :**
   - Clé `Idempotency-Key` vérifiée avant et pendant la transaction Prisma sur `POST /api/invoices/:id/payments` : un double envoi (en ligne ou lors de la resynchronisation hors ligne) ne crée qu'un seul paiement.
   - Toutes les actions sensibles (ajout/suppression de ligne, remise dépassant le seuil, encaissement, écriture inverse, check-out normal/forcé, avoir, export clôture) créent une entrée dans `AuditLog`.
   - Aucune requête SQL brute avec concaténation ; uniquement Prisma paramétré et `INSERT ... ON CONFLICT` paramétré sur `InvoiceSequence`.

---

## Résultats d'exécution observés

- `npm run test:integration --workspace=@residence-blue/api -- --runInBand --testTimeout=60000` :
  - `test/facturation-v3.e2e-spec.ts` : **PASS (22.537 s)**
  - `test/security-gate.e2e-spec.ts` : **PASS (14.322 s)**
  - `test/base-securisee.e2e-spec.ts`, `test/exports-security.e2e-spec.ts`, `test/clients-v2.e2e-spec.ts`, `test/reservations-refonte.e2e-spec.ts`, `test/rooms.e2e-spec.ts`, `test/modules-status.e2e-spec.ts`, `test/health.e2e-spec.ts`, `test/crypto.service.spec.ts` : **PASS**
  - Seule erreur hors périmètre Facturation : `test/persistence.e2e-spec.ts:226` (`guestRes.body.passportNumber` attendu en clair à la création client alors que `guests.service.ts` renvoie le masque depuis la refonte Clients V2).
- `npm run test --workspace=@residence-blue/web` : **21 suites, 136 tests PASS**
- `npm run test --workspace=@residence-blue/shared` : **2 suites, 23 tests PASS**
- `npm run test --workspace=@residence-blue/api` : **3 suites, 15 tests PASS**
- `npm run lint` : **0 erreur, 0 avertissement**
