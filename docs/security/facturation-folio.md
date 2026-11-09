# Porte de Sécurité — Facturation, Folio Client & Encaissement

> **Fonctionnalité :** Facturation du séjour, ventilation des paiements multiples (Split Payments) et clôture journalière de caisse (Rapport Z) (`/facturation`, `/facturation/:id`)  
> **Composants :** `FacturationPageComponent`, `FacturationMockService`, `HotelSettingsService`  
> **Déclencheurs :** Navigation `/facturation`, départ client (Check-out Suite 301), clôture de session de caisse  
> **Référence maquette :** `design/maquettes/facturation_folio_client_encaissement/code.html`  
> **Date de l'audit :** 09 Novembre 2026  
> **Statut global :** **CONFORME & VALIDÉ (100% SUCCÈS)**  

---

## 1. Contexte & Périmètre de Sécurité

Le module de facturation et d'encaissement de la Résidence Blue concentre des flux financiers critiques et des données à haute sensibilité :
- Émission du folio officiel résident et attribution fiscale nominative (VGE Teranga Group Dakar, NINEA 0029103).
- **Confidentialité PII :** Préservation de la vie privée du voyageur (exclusion stricte du passeport sur tout support physique ou impression PDF).
- **Intégrité monétaire :** Gestion de la monnaie FCFA strictement en montants entiers (interdiction absolue de décimales ou de centimes non existants).
- **Ventilation multi-moyens de paiement (Split Payments) :** Répartition Wave, Orange Money, Espèces avec calculatrice de rendu de monnaie au guichet, Carte Bancaire TPE.
- **Verrouillage d'encaissement :** Le bouton de validation du paiement et de libération de la clé 301 est désactivé tant que le montant ventilé n'est pas strictement égal au solde exigible (`diff === 0`).
- **Clôture de caisse (Rapport Z) :** Traçabilité des écritures journalières, décompte du fond de caisse initial et des recettes encaissées par canal.

---

## 2. Vecteurs d'Attaque Testés & Résultats

| Catégorie CWE / OWASP | Scénario d'attaque testé | Comportement attendu | Résultat obtenu |
| :--- | :--- | :--- | :--- |
| **CWE-359 : Exposition de données personnelles (PII) à l'impression** | Tentative d'impression de la facture ou conversion PDF du folio invité contenant le numéro de passeport. | Le passeport `SN-982341-B` est masqué sur la feuille d'impression via la classe `print:hidden` et les styles `@media print`. Aucun document papier ni export PDF ne divulgue le passeport. | **RÉUSSI** (Validé par `facturation-folio-security.spec.ts`) |
| **Règle Monétaire AGENTS.md : Intégrité financière sans décimales** | Injection ou affichage de montants avec des décimales en FCFA (ex: `150 000,50 FCFA` ou `150 000.00 FCFA`). | Tous les montants FCFA sont rigoureusement des entiers, formatés avec espaces insécables (`formatNumber` / `formatFcfa`). Aucun montant décimal n'apparaît sur l'ensemble de l'écran. | **RÉUSSI** (Validé par `facturation-folio-security.spec.ts`) |
| **CWE-79 : Cross-Site Scripting (XSS)** | Injection de charges malveillantes (`<script>`, `<img src=x onerror=...>`, etc.) dans les champs de référence Wave ou Orange Money. | Échappement et neutralisation native Angular. Les chaînes sont traitées textuellement sans exécution de code JavaScript. | **RÉUSSI** (Validé par `facturation-folio-security.spec.ts`) |
| **CWE-319 : Zéro fuite réseau & CDN distants** | Contrôle des requêtes HTTP réseau lors de la facturation, du basculement d'onglet et de la simulation de paiement. | Zéro requête externe vers des CDN. 100 % des polices, icônes et scripts sont locaux. | **RÉUSSI** (Validé par `facturation-folio-security.spec.ts`) |
| **CWE-20 : Validation de la réconciliation comptable** | Tentative de validation d'un encaissement incomplet (solde restant > 0) ou excessif (trop-perçu). | Le bouton d'encaissement est automatiquement désactivé avec message d'alerte contextuel. Seul un équilibre parfait (`remainingBalance === 0`) autorise la libération de la chambre. | **RÉUSSI** (Validé par tests unitaires et E2E) |
| **CWE-1188 : Dynamisation des paramètres légaux** | Tentative de forçage de données fiscales statiques non auditées. | Les données de l'hôtel (NINEA, RCCM, adresse Grand Standing Thiès, taux de TVA 10%) proviennent de `HotelSettingsService`, sans valeur codée en dur. | **RÉUSSI** (Validé par tests unitaires et E2E) |

---

## 3. Matrice des Tests Automatisés

- **Tests unitaires :**
  - `apps/web/src/app/core/services/facturation-mock.service.spec.ts` (9/9 PASS)
  - `apps/web/src/app/features/facturation/facturation-page.component.spec.ts` (8/8 PASS)
- **Tests E2E fonctionnels :**
  - `apps/web/e2e/facturation-folio.spec.ts` (6/6 PASS)
- **Tests E2E de sécurité :**
  - `apps/web/e2e/facturation-folio-security.spec.ts` (4/4 PASS)
- **Fidélité visuelle pixel-à-pixel :**
  - `apps/web/e2e/visual-comparison.spec.ts` (Écran Facturation vs maquette de référence : **0.79% d'écart**, largement inférieur au seuil réglementaire de 2.0%)

---

## 4. Recommandations pour le Raccordement API & Paiements Réels (Backend)

1. **Idempotency-Key obligatoire :** Chaque requête d'encaissement `POST /api/v1/invoices/:id/payments` doit être accompagnée d'une clé d'idempotence UUID générée côté client pour éviter tout double débit en cas de coupure réseau ou de rejeu hors ligne.
2. **Signature des webhooks Wave / Orange Money :** La validation automatique des paiements marchands en ligne doit vérifier la signature HMAC des webhooks des opérateurs télécoms et fintech.
3. **Clôture définitive du Z de caisse :** Lors de la clôture formelle d'une journée comptable, les folios et écritures associées doivent être verrouillés en base (champ `isLocked: true`), interdisant toute modification ou suppression ultérieure sans procédure de réouverture sous droits `ADMIN` / `DIRECTION`.
