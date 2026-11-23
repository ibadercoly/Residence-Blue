# Porte de sécurité — lot 1

## Changements

- `SecurityTestController` est enregistré uniquement lorsque `NODE_ENV` vaut `test`. Les contrôles de production confirment que `security-test/public-ping` et `security-test/strict-validation` répondent 404.
- `CryptoService` refuse une clé absente ou une valeur d’exemple hors test, avec le message français attendu. Aucun secret réel n’est ajouté au dépôt. `.env.example` documente la génération d’une clé avec `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`; Docker Compose production exige `ENCRYPTION_MASTER_KEY`.
- Les routes historiques de comptes ont été retirées de `AuthController` et `AuthService` après recherche dans `apps/web`; les comptes restent gérés par `/administration/comptes`.
- L’import inutilisé `hasScreenAccess` a été retiré de `RestaurantController`.
- La commande Jest habituelle de l’API gardait `rootDir: 'src'` et ignorait les tests dans `apps/api/test`. La configuration conserve les specs unitaires de `src`, ajoute les specs unitaires de `test` et inclut le test du lot 1, sans ajouter toutes les suites E2E à la commande unitaire. Le test du lot conserve un délai de 60 secondes, identique à la config d’intégration.

## Vérifications

Les tests d’intégration et de sécurité ont été forcés sur `residence_blue_e2e`. Le test « live » vérifie lui-même que `DATABASE_URL` vise exactement cette base et n’utilise aucun remplacement de `PrismaService`.

- Lint API : réussi.
- Build API : réussi.
- Tests Jest habituels de l’API : 10 suites, 45 tests réussis; le test du lot apparaît bien dans la sortie.
- Tests d’intégration API : 21 suites, 132 tests réussis.
- Tests de sécurité API : 20 suites, 130 tests réussis.
- Vérification avec le vrai `PrismaService` : démarrage refusé sans clé en production; `security-test/*` et les cinq anciennes routes `/users` répondent 404. Le test E2E ciblé a réussi après ajout de ces cinq vérifications.

Aucun test n’a été supprimé, désactivé ou assoupli. La suite de sauvegarde utilise un chemin temporaire sous `C:/Users/IBADER`, qui nécessite une exécution autorisée hors sandbox dans cet environnement. Les secrets des fichiers `.env` n’ont pas été affichés.
