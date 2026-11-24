# Porte de sécurité — Paramètres de l’hôtel

## Périmètre

Écran `/parametres`, mise à jour `PATCH /api/hotel-settings`, cache IndexedDB et file outbox. Aucun changement de comportement de facturation n’est inclus ; un contrôle vérifie seulement le taux appliqué à une nouvelle facture après modification des paramètres.

## Contrôles vérifiés

- Le garde Angular refuse la page à tout rôle autre que `DIRECTION`.
- Le contrôleur API existant protège la mise à jour avec `directorOnly` ; l’intégration confirme `403` pour `RECEPTION` et `200` pour `DIRECTION`.
- `UpdateHotelSettingsDto` valide le booléen `tourismTaxIncludesChildren`; les règles globales `whitelist` et `forbidNonWhitelisted` restent actives.
- Les changements hors ligne sont mis en cache dans IndexedDB et envoyés par l’outbox avec un UUID comme `Idempotency-Key`. L’état local indique l’attente de synchronisation.
- Les paramètres sont relus depuis le serveur après chargement du cache, qui reste la source de vérité.
- Une facture créée après la mise à jour API reprend le taux de TVA modifié.

## Résultats

- `apps/api/test/persistence.e2e-spec.ts` : réussi, couvre les droits, la persistance du réglage enfants et le taux d’une facture créée après modification.
- `apps/api/test/base-securisee.e2e-spec.ts` : réussi, 13 tests, dont sauvegarde/restauration chiffrée sur la base de test.
- `npm run lint`, `npm run build` et `npm run test` : réussis au dernier lancement.
- `npm run test:integration` : 22 suites sur 23 réussies au lancement complet ; l’unique échec provenait des chemins temporaires/GPG/Docker sous sandbox. Le test fautif a ensuite réussi seul avec des chemins POSIX dans l’espace du projet et l’accès Docker autorisé.
- E2E Playwright de la nouvelle page : encore en cours de validation après correction d’une course entre le chargement des paramètres et la saisie du taux.

## État

La fonctionnalité n’est pas déclarée terminée tant que le scénario Playwright complet n’est pas vert.
