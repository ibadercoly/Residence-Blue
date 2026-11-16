# 01 — Couverture métier

Audit en lecture seule, branche `docs/audit-complet`, 17/11/2026.
Légende : **Oui** = existe de bout en bout (écran + API + données + droits). **Partiel** = une partie manque. **Non** = absent.
« Non vérifié » = pas lu ou pas exécuté pendant cet audit.

| # | Processus | Existe | Où (preuve) | Ce qui manque | Importance |
|---|---|---|---|---|---|
| 1 | Réservation (créer, modifier, annuler) | Partiel | Écran `/planning` (`apps/web/src/app/app.routes.ts:78`), API `/api/reservations` (`planning-mock.service.ts:246`, `:592`, `:621`) | Le planning s'ouvre toujours sur la semaine du **10 nov. 2026** et marque ce jour comme « aujourd'hui » (`planning-mock.service.ts:290-296`, `:308`). Voir MET-001. | Indispensable |
| 2 | Conflits de chambres / chevauchements | Oui | Contrôle dans une transaction `Serializable` (`reservations.service.ts:272-285`, `:498`) + contrainte en base `reservations_no_overlap_active` avec `btree_gist` (migration `20261112000000_reservation_refonte`, `reservations.service.ts:514`) | — (bien protégé, double barrière) | — |
| 3 | Tarifs et durée | Oui | `Room.pricePerNight`, `highSeasonPricePerNight`, `corporatePricePerNight` (`schema.prisma:143-145`), `Reservation.nights` (`:212`) | Saison haute : pas de calendrier de dates de saison (non vérifié côté écran). | Peut attendre |
| 4 | Fiche client, doublons, historique | Oui | `/clients`, `/clients/:id` (`app.routes.ts:90-99`), index téléphone/email/nom (`schema.prisma:194-196`) | Pas de contrainte d'unicité sur le téléphone : les doublons sont possibles (détection côté code non vérifiée). | Peut attendre |
| 5 | Pièce d'identité chiffrée | Oui | `Guest.idDocumentEncrypted` (`schema.prisma:177`), AES-256-GCM (`crypto.service.ts`) | Clé de secours écrite dans le code (SEC-002). | Indispensable |
| 6 | Check-in / check-out | Oui | Actions `/api/reservations/:id/<action>` (`planning-mock.service.ts:590-592`), `checkedInAt/checkedOutAt` (`schema.prisma:220-221`), départ forcé (`:268-269`) | — | — |
| 7 | Séjour et note (folio) | Oui | `/facturation/:id` (`app.routes.ts:134`), `note-sejour-page.component.ts` | — | — |
| 8 | Facturation : numérotation sans trou | Oui | Compteur `INSERT … ON CONFLICT … last_seq + 1` exécuté dans la transaction de l'émission (`billing.service.ts:239-254`, paramètre `tx`) : si l'émission échoue, le numéro est annulé aussi. Format `FA-AAAA-NNNN` / `AV-AAAA-NNNN`. | — | — |
| 9 | TVA, taxe de séjour, arrondis | Oui | `Math.round` documenté (`billing.service.ts:124-190`), taxe de séjour par nuit et par adulte (`:333`, `:350`) | Les enfants ne paient pas la taxe (`adultsCount` seul, `:350`) : à confirmer avec la règle légale. | Important |
| 10 | Avoirs, duplicata, impression | Oui | `InvoiceDocumentType.CREDIT_NOTE` (`schema.prisma:46-49`), `parentInvoiceId` (`:246`) | Duplicata : mention « DUPLICATA » non vérifiée. | Important |
| 11 | Paiements (espèces, Orange Money, Wave, carte, virement) | Oui | `enum PaymentMethod` (`schema.prisma:51-57`), `idempotencyKey` unique (`:338`) | — | — |
| 12 | Paiement partiel / remboursement | Oui | `InvoiceStatus.PARTIAL` (`:41`), `Payment.isReversal` + `reversedPaymentId` (`:335-337`) | — | — |
| 13 | Clôture de caisse | Partiel | Seulement un export : `GET /api/invoices/cash-closure/export` (`billing.controller.ts:101-116`) | Pas de geste « fermer la caisse » avec montant compté et écart. Voir MET-002. | Indispensable |
| 14 | Restaurant (carte, table, chambre, à emporter, bar, encaissement) | Oui | `/restaurant`, `/restaurant/carte` (`app.routes.ts:102-116`), `destinationType`, `roomId`, `paymentMethod` (`schema.prisma:395-408`), `prepStation` (`:373`) | — | — |
| 15 | Cuisine (plat manquant, temps, prête) | Oui | `/cuisine` (`app.routes.ts:118`), champs `priseEnCharge*`, `tempsPreparationMinutes`, `preteAt` (`schema.prisma:419-425`) | — | — |
| 16 | Ménage et maintenance | Partiel | État `CLEANING` / `MAINTENANCE` d'une chambre (`schema.prisma:23-28`) | Écrans `/housekeeping` et `/maintenance` désactivés et pointant vers le tableau de bord (`app.routes.ts:165-181`). C'est voulu (« ménage limité à Chambres »). | À ne pas faire (simplicité) |
| 17 | Chambres (états, tarifs, catégories) | Oui | `/chambres` (`app.routes.ts:84`), `Room` (`schema.prisma:126-161`) | — | — |
| 18 | Planning | Partiel | voir n°1 | Date de départ figée (MET-001). | Indispensable |
| 19 | Rapports | Oui | `/rapports` (`app.routes.ts:150`), dates en heure de Dakar (`rapports.service.ts:800`, `:831`) | Exactitude des chiffres non recalculée à la main dans cet audit. | Important |
| 20 | Tableau de bord / accueil | Partiel | `/accueil` (`app.routes.ts:62`) | Bandeau « Mode Démonstration Actif » toujours affiché + bouton de remise à zéro (`dashboard-page.component.ts:20-44`, `:374-383`). Voir INT-001. | Indispensable |
| 21 | Administration (comptes, accès, apparence) | Oui | `/administration/*` (`app.routes.ts:25-60`) | Doublon d'API `/users` (SEC-004). | Important |
| 22 | Archives et suppressions | Oui | `/facturation/archives` (`app.routes.ts:126`), suppression douce des comptes `deletedAt`, `deletedDisplayName` (`schema.prisma:71-72`) | — | — |
| 23 | Paramètres de l'hôtel | Partiel | API `PATCH /api/hotel-settings` (`settings.controller.ts:18`) | L'écran `/parametres` est désactivé et ouvre le tableau de bord (`app.routes.ts:192-198`). Voir INT-003. | Indispensable (TVA, taxe, nom légal) |
| 24 | Journal d'actions | Oui | `AuditLog` (`schema.prisma:84`), ex. `entity: 'CashClosure'` (`billing.service.ts:1937`) | Écran de consultation : non vérifié. | Peut attendre |
| 25 | Sauvegarde et restauration | Partiel | `scripts/backup.sh`, `scripts/restore.sh`, variable `BACKUP_ENCRYPTION_KEY` (`.env.example`) | Pas de copie hors du serveur, restauration jamais testée dans cet audit. Voir EXP-002. | Indispensable |
| 26 | Import des données Excel | Non | Aucun script ni écran trouvé (`scripts/` ne contient pas d'import) | Voir MET-003. | Indispensable |
| 27 | Impression et PDF | Oui | Exports PDF/Excel (`billing.controller.ts:101-116`, `exceljs`) | — | — |
| 28 | Notifications (cloche) | Oui | `NotificationMessage`, `NotificationRead` (`schema.prisma:88`, `:438`) | — | — |
| 29 | Hors ligne | Partiel | Règle du projet (AGENTS.md) | Le planning lit directement `fetch('/api/reservations')` et ignore l'erreur (`planning-mock.service.ts:246-255`) : pas de lecture IndexedDB sur cet écran. Voir LOG-005. | Important |

## Constats détaillés

### MET-001 — P0 — Le planning est bloqué sur une date fixe
- **Description** : la grille commence toujours le mardi 10 novembre 2026, et ce jour est marqué « aujourd'hui ».
- **Preuve** : `apps/web/src/app/core/services/planning-mock.service.ts:289-296` (`baseDate = new Date(2026, 10, 10)`), commentaire « Date de référence fixe pour la démo ».
- **Risque** : dès la semaine prochaine, la réception ouvre le planning sur une semaine passée et peut louer une chambre déjà occupée.
- **Correction** : partir de la date du jour (heure de Dakar). **Effort** : petit. **Classement** : indispensable avant la production.

### MET-002 — P1 — Pas de vraie clôture de caisse
- **Description** : on peut exporter les encaissements, mais pas fermer la caisse en saisissant l'argent compté.
- **Preuve** : seule route `GET /api/invoices/cash-closure/export` (`apps/api/src/billing/billing.controller.ts:101-116`).
- **Risque** : écart de caisse non repéré, vols ou erreurs invisibles.
- **Correction** : dans l'écran Facturation, remplacer le bouton d'export par « Fermer la caisse » (montant compté, écart, export). **Effort** : moyen. **Classement** : indispensable avant la production.

### MET-003 — P0 — Aucun import des fichiers Excel
- **Description** : le logiciel remplace des fichiers Excel mais ne sait pas les lire.
- **Preuve** : aucun script d'import dans `scripts/` (liste lue) ni route d'import dans les contrôleurs.
- **Risque** : clients, réservations à venir et soldes à ressaisir à la main, avec des erreurs.
- **Correction** : script unique en ligne de commande (pas d'écran) pour clients et réservations futures, avec rapport des lignes refusées. **Effort** : moyen. **Classement** : indispensable avant la production (au moins les réservations à venir).
