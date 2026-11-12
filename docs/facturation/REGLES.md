# Règles Métier & Arrondis — Facturation Résidence Blue

> **Principe fondamental :** Le serveur NestJS + PostgreSQL (Prisma) fait toujours foi. Le navigateur affiche uniquement le résultat retourné par l'API.

---

## 1. Montants strictement entiers FCFA & Règle d'arrondi

- Tous les montants stockés, calculés et échangés sont exprimés en **entiers FCFA (`Int`)** sans décimale.
- **Règle d'arrondi utilisée :** Arrondi arithmétique au franc CFA entier le plus proche (*half-up* via `Math.round(x)`).
- Les taux sont **lus dynamiquement depuis la table `hotel_settings` (`HotelSetting`)**, jamais codés en dur dans les formules :
  - `vatRatePercent` : taux de TVA (en `%`, `0` si non renseigné)
  - `serviceRatePercent` : taux de frais de service (en `%`, `0` si `null` / non renseigné par DIRECTION)
  - `tourismTaxPerNightPerPerson` : taxe de séjour par nuit et par adulte en FCFA entier (`0` si non renseigné)
  - `discountThresholdPercent` : seuil de remise (en `%`, `0` si `null` / non renseigné par DIRECTION — toute remise au-dessus de ce seuil est réservée exclusivement à `DIRECTION`)

### Formules autoritaires côté serveur
Soient :
- `grossLinesFcfa` = somme des lignes hors taxe de séjour (`HEBERGEMENT`, `RESTAURANT`, `PISCINE`, `BLANCHISSERIE`, `AUTRES`), où chaque ligne vaut `Math.round(quantity * unitPriceFcfa)` (ou montant signé pour un avoir).
- `discountFcfa` = remise entière (`0 <= discountFcfa <= grossLinesFcfa`).
- `netPrestationsFcfa = Math.max(0, grossLinesFcfa - discountFcfa)`.
- `tourismTaxFcfa` = somme des montants de taxe de séjour (ex. `tourismTaxPerNightPerPerson * adultsCount * nights`).

Calcul des taxes (avec `vatRate = settings.vatRatePercent ?? 0` et `serviceRate = settings.serviceRatePercent ?? 0`) :
1. Extraction de la base HT :
   `subtotalHtFcfa = vatRate > 0 ? Math.round((netPrestationsFcfa * 100) / (100 + vatRate)) : netPrestationsFcfa`
2. Si `serviceRate === 0` :
   - `serviceAmountFcfa = 0`
   - `vatAmountFcfa = netPrestationsFcfa - subtotalHtFcfa` *(aucun écart d'arrondi : `HT + TVA = netPrestationsFcfa`)*
3. Si `serviceRate > 0` :
   - `serviceAmountFcfa = Math.round((subtotalHtFcfa * serviceRate) / 100)`
   - `vatAmountFcfa = Math.round(((subtotalHtFcfa + serviceAmountFcfa) * vatRate) / 100)`
4. Total TTC & reste à payer :
   - `totalFcfa = subtotalHtFcfa + serviceAmountFcfa + vatAmountFcfa + tourismTaxFcfa`
   - `balanceFcfa = Math.max(0, totalFcfa - depositFcfa - paidAmountFcfa)`

Identité garantie en toutes circonstances :
`subtotalHtFcfa + serviceAmountFcfa + vatAmountFcfa + tourismTaxFcfa === totalFcfa`.

---

## 2. Cycle de vie : Note ouverte, Émission, Immutabilité & Avoir

1. **Note ouverte (`isIssued = false`, `invoiceNumber = null`) :**
   - Modifiable : ajout de lignes (`Hébergement`, `Restaurant`, `Piscine`, `Blanchisserie`, `Autres`) et ajustement de remise.
   - Reçoit automatiquement les nuitées de la réservation et les commandes restaurant/bar mises sur la chambre.
   - Affichée comme « Note ouverte » tant qu'elle n'est pas émise.
2. **Émission & Numérotation séquentielle sans trou (`FA-AAAA-NNNN`) :**
   - Attribuée uniquement à l'émission (lors du Check-out ou de l'émission manuelle) dans une transaction Prisma (`Serializable`) avec verrou sur la table `invoice_sequences` (`INSERT ... ON CONFLICT DO UPDATE SET last_seq = last_seq + 1 RETURNING last_seq`).
   - En cas d'échec ou d'annulation de la transaction, l'incrément est annulé : **aucun trou dans la numérotation**.
3. **Immutabilité de la facture émise (`isIssued = true`) :**
   - Une facture émise ne peut **plus** être modifiée (ni ajout de ligne, ni modification de remise) ni supprimée (`DELETE` refusé en `400`).
4. **Avoir (`AV-AAAA-NNNN`, `documentType = 'CREDIT_NOTE'`) :**
   - Uniquement créable par `DIRECTION` ou `COMPTABLE` sur une facture émise.
   - Motif obligatoire (`>= 5` caractères).
   - Montant négatif (`<= totalFcfa` restant non crédité sur la facture d'origine), numéroté séquentiellement `AV-AAAA-NNNN`.

---

## 3. Paiements, Idempotence & Écritures inverses

- **Paiements partiels autorisés :** tant que `0 < amountFcfa <= balanceFcfa`. Tout montant `<= 0`, non entier, ou `> balanceFcfa` est refusé (`400 Bad Request`).
- **Idempotence :** chaque encaissement porte un en-tête `Idempotency-Key` enregistré en base (`payments.idempotency_key` + `sync_operations`). Un double clic ou renvoi réseau retourne la facture mise à jour sans créer de second paiement.
- **Protection cartes bancaires :** aucun numéro de carte bancaire (13–19 chiffres) n'est accepté ni stocké dans `transactionRef` (`400 Bad Request`).
- **Annulation de paiement (`DIRECTION` uniquement) :** un paiement n'est **jamais supprimé** ; son annulation génère une écriture inverse négative (`isReversal = true`, `amountFcfa = -montantInitial`, `reversedPaymentId`) avec **motif obligatoire** dans une transaction recalculant `paidAmountFcfa`, `balanceFcfa` et le statut.

---

## 4. Check-out transactionnel

- Disponible uniquement lorsque `balanceFcfa === 0` (sauf forçage par `DIRECTION` avec `force = true` et un motif obligatoire).
- Exécuté en **une seule transaction atomique** :
  1. Émission de la facture avec attribution du numéro `FA-AAAA-NNNN` (si non encore émise)
  2. Passage de la réservation liée au statut `CHECKED_OUT` (`Terminée`)
  3. Passage de la chambre liée au statut `CLEANING` (`Ménage`)
  4. Écriture des journaux `AuditLog`.

---

## 5. Matrice des rôles (vérifiée côté serveur, `403` sinon)

| Action | DIRECTION | COMPTABLE | RECEPTION | RESTAURANT | GOUVERNANTE / TECHNIQUE / SERVEUR / CUISINE |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Voir le comptoir, totaux & caisse du jour | ✅ | ✅ | ✅ | ❌ (`403`) | ❌ (`403`) |
| Voir une note détaillée (`/api/invoices/:id`) | ✅ | ✅ | ✅ | ❌ (`403`) | ❌ (`403`) |
| Ajouter ligne `RESTAURANT` sur chambre | ✅ | ❌ (`403`) | ✅ | ✅ *(sans voir totaux/caisse)* | ❌ (`403`) |
| Ajouter ligne autre catégorie (`HEBERGEMENT`, `PISCINE`…) | ✅ | ❌ (`403`) | ✅ | ❌ (`403`) | ❌ (`403`) |
| Remise `<= seuil` | ✅ | ❌ (`403`) | ✅ | ❌ (`403`) | ❌ (`403`) |
| Remise `> seuil` | ✅ | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) |
| Encaisser un paiement | ✅ | ❌ (`403`) | ✅ | ❌ (`403`) | ❌ (`403`) |
| Annuler un paiement (écriture inverse) | ✅ | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) |
| Émettre / Check-out normal | ✅ | ❌ (`403`) | ✅ | ❌ (`403`) | ❌ (`403`) |
| Check-out forcé (solde > 0 + motif) | ✅ | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) |
| Créer un avoir (`AV-AAAA-NNNN`) | ✅ | ✅ | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) |
| Télécharger PDF d'une facture | ✅ | ✅ | ✅ | ❌ (`403`) | ❌ (`403`) |
| Exporter la clôture de caisse (PDF / Excel) | ✅ | ✅ | ❌ (`403`) | ❌ (`403`) | ❌ (`403`) |
