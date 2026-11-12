# Porte de Sécurité — Refonte Fenêtre « Nouvelle réservation » (`feature/reservation-refonte`)

> **Date :** 12 novembre 2026  
> **Périmètre :** `RoomsController` (`GET /api/rooms/available`), `GuestsController` (`GET /api/guests/search`), `ReservationsController` / `ReservationsService` (`POST /api/reservations`), migration PostgreSQL `20261112000000_reservation_refonte`, `scripts/restore.sh`, et composants Angular `apps/web/src/app/features/reservation-modal/`.

## 1. Surface d'attaque et contrôles vérifiés

| Vecteur testé | Protection en place | Preuve / Statut |
| :--- | :--- | :--- |
| **Accès non autorisé (RBAC)** | `@Roles(Role.DIRECTION, Role.RECEPTION)` sur `/api/rooms/available`, `/api/guests/search` et `/api/reservations` | ✅ `SERVEUR` et `CUISINE` rejetés avec `403 Forbidden` (`test/reservations-refonte.e2e-spec.ts`) |
| **Falsification de tarif ou total (`Mass Assignment`)** | `ValidationPipe(whitelist + forbidNonWhitelisted)` + recalcul serveur autoritaire depuis `Room.pricePerNight` et `hotel_settings` | ✅ Envoi de `totalFcfa: 100` rejeté en `400 Bad Request` ; total toujours calculé côté serveur |
| **Capture de numéro de carte bancaire (PAN)** | Rejet 13–19 chiffres dans `transactionRef` côté DTO et côté UI (`hasCardPanRisk`) | ✅ Rejet `400 Bad Request` côté API et blocage bouton côté UI (`e2e/reservation-modal-security.spec.ts`) |
| **Injection SQL (recherche client)** | Requêtes Prisma paramétrées exclusivement (`contains`, `mode: 'insensitive'`, `take <= 5`) | ✅ Payload `' OR '1'='1; DROP TABLE users;--` neutralisé (`200`, <= 5 résultats) |
| **Double réservation / Race condition** | Transaction Prisma `IsolationLevel.Serializable` + contrainte PostgreSQL `btree_gist` (`EXCLUDE USING gist`) | ✅ Requête concurrente `Promise.all` : `[201, 409]` avec message exact `Cette chambre vient d'être réservée, choisissez-en une autre` |
| **Rejeu réseau (hors ligne / double clic)** | Clé d'idempotence `Idempotency-Key` vérifiée via table `sync_operations` dans la transaction | ✅ Rejeu retourne la réservation existante sans doublon ni double paiement |
| **Sauvegarde/Restauration PostgreSQL (`app_owner`)** | Filtrage des commandes `DROP/CREATE/COMMENT ON EXTENSION` dans `scripts/restore.sh` | ✅ `test/base-securisee.e2e-spec.ts` (13/13) vert malgré l'extension `btree_gist` |
| **Chambres en maintenance / inactives** | Filtre serveur `isActive: true` + `status: { not: 'MAINTENANCE' }` dans `/api/rooms/available` et dans `POST /api/reservations` | ✅ Exclues de la liste et refusées à la soumission (`test/reservations-refonte.e2e-spec.ts`) |
| **XSS / Fuite DOM & mémoire** | Échappement natif Angular, `OnPush`, aucun `innerHTML`, démontage complet à la fermeture | ✅ Mémoire stable sur 20 cycles ouverture/fermeture (`13,40 → 11,15 Mo`) |

## 2. Traçabilité (`AuditLog`)

- Chaque création via `POST /api/reservations` enregistre une entrée `AuditLog` (`action: 'RESERVATION_CREATE'`) dans la même transaction.
- Lorsqu'un acompte (`depositFcfa > 0`) est versé, une facture, un paiement (`Invoice` + `Payment`) et une entrée `AuditLog` (`action: 'PAYMENT_CREATE'`) sont créés atomiquement.
