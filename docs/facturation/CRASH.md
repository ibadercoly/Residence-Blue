# Diagnostic et résolution du crash `/facturation` (Service Worker Angular)

## Résumé en trois lignes

1. **Cause :** Les `dataGroups` `/api/**` de `apps/web/ngsw-config.json` faisaient écrire les réponses API dans `CacheStorage` par `ngsw-worker.js`, provoquant un arrêt du processus de rendu Chromium (`blink.mojom.CacheStorageCache` `VALIDATION_ERROR_UNEXPECTED_NULL_POINTER`, `reason 123`) dès l'ouverture ou le rechargement de `/facturation`.
2. **Preuve A/B & Correctif :** Sur Chromium `153.0.8010.12`, le build A (avec `dataGroups`) crashe `0/20` fois (crash immédiat au 1er essai), tandis que le build B (sans `dataGroups`, images de chambres en `lazy`, `favicon.ico` et logo mobile corrigés, `no-store` dans `serve-dist.mjs` et `apps/web/nginx.conf`) réussit `20/20` rechargements sur `/facturation` et `20/20` sur `/facturation/:id` (`0` crash, `0` erreur 404).
3. **Validation complète :** 20/20 rechargements validés avec profil vide, profil rempli et scénario de mise à jour (désenregistrement SW sans perte d'IndexedDB), multi-navigateurs Google Chrome (`157.0.8103.52`) et Microsoft Edge (`157.0.4341.60`), plus parcours hors ligne complet (`outbox` IndexedDB + synchronisation unique par `Idempotency-Key`).

---

## 1. Cause technique exacte

L'analyse dans Chromium avec `--enable-logging --v=1` (`chrome_debug.log`) et l'isolation Service Worker on/off ont mis en évidence deux phénomènes distincts :

1. **Terminaison du processus renderer par Chromium (`PAGE_CRASHED`) :**
   - Lorsque `serviceWorkers` est bloqué (`serviceWorkers: 'block'`), `/facturation` s'affiche et se recharge sans aucune erreur.
   - Lorsque `ngsw-worker.js` est actif avec `dataGroups` sur `/api/**` (`api-freshness`), `chrome_debug.log` (lignes 571–574 et 1224–1227) enregistre :
     ```text
     ERROR:mojo\public\cpp\bindings\lib\validation_errors.cc:125] Invalid message: VALIDATION_ERROR_UNEXPECTED_NULL_POINTER (null in array expecting valid pointers: array size - 8; index - 4)
     ERROR:content\browser\renderer_host\render_process_host_impl.cc:6330] Terminating render process for bad Mojo message: Received bad user message: Validation failed for blink.mojom.CacheStorageCache [VALIDATION_ERROR_UNEXPECTED_NULL_POINTER (null in array expecting valid pointers: array size - 8; index - 4)]
     ERROR:content\browser\bad_message.cc:29] Terminating renderer for bad IPC message, reason 123
     ```
   - La persistance hors ligne métier passant déjà par **IndexedDB (`IdbService`) et `OutboxService`**, la mise en cache HTTP `/api/**` par `ngsw-worker.js` était redondante et déclenchait cette erreur IPC `CacheStorageCache`.

2. **Facteurs secondaires corrigés :**
   - `scripts/serve-dist.mjs` et `apps/web/nginx.conf` envoyaient `Cache-Control: public, max-age=31536000, immutable` sur `ngsw-worker.js` et n'envoyaient pas `no-store` sur `index.html`, `ngsw.json` et `manifest.webmanifest`.
   - `ngsw-config.json` préchargeait (`installMode: "prefetch"`) les 62 images `/assets/images/chambres/**` ainsi que `/favicon.ico` (404), et `header.component.ts` référençait `/assets/images/logo-missing.png` (404).

---

## 2. Preuve A/B sur la même version de Chromium (`153.0.8010.12`)

Protocole identique (`serviceWorkers: 'allow'`, navigation `/` -> attente SW -> `/facturation` x20 rechargements -> `/facturation/:id` x20 rechargements) exécuté contre le serveur de production local (`http://localhost:4200`) :

| Variante testée | Version Chrome | `/facturation` (20 rechargements) | `/facturation/:id` (20 rechargements) | Crashs (`PAGE_CRASHED`) | 404 |
| --- | --- | --- | --- | --- | --- |
| **A — Avec `dataGroups` `/api/**`** | `153.0.8010.12` | `0 / 20` (crash immédiat) | `0 / 20` (interrompu) | `1` | `[]` |
| **B — Sans `dataGroups` `/api/**`** | `153.0.8010.12` | **`20 / 20`** | **`20 / 20`** | **`0`** | **`[]`** |

---

## 3. Corrections appliquées

- **`apps/web/ngsw-config.json`** :
  - Suppression complète de `dataGroups` (`/api/**`).
  - Conservation d'un groupe `app` en `prefetch` limité aux fichiers applicatifs (`/favicon.ico`, `/index.html`, `/manifest.webmanifest`, `/*.css`, `/*.js`, `/media/*.woff2`, `/media/*.woff`).
  - Passage de tous les médias restants (`/assets/**`, images) en `assets-on-demand` (`installMode: "lazy"`, `updateMode: "lazy"`).
- **Ressources 404 éliminées :**
  - Création de `apps/web/public/favicon.ico` valide (répond `200 OK`).
  - Remplacement de `/assets/images/logo-missing.png` dans `apps/web/src/app/shared/components/header/header.component.ts` par l'icône `hotel` cohérente avec la barre latérale.
- **En-têtes sans cache en local et en production :**
  - `scripts/serve-dist.mjs` et `apps/web/nginx.conf` envoient `Cache-Control: no-store, no-cache, must-revalidate` sur `/index.html`, `/ngsw.json`, `/ngsw-worker.js`, `/safety-worker.js` et `/manifest.webmanifest`.
- **Mise à jour SW douce & synchronisation hors ligne sans modifier `OutboxService` ni `IdbService` :**
  - `AppComponent` déclenche `reg.update()` sur les enregistrements SW au démarrage sans toucher à `residence_blue_db`.
  - `FacturationService.syncOfflinePayments()` rejoue les opérations `CREATE_INVOICE_PAYMENT` en attente lors du retour en ligne avec les en-têtes utilisateur et la clé `Idempotency-Key` UUID d'origine.
- **Tests E2E sans réglage temporaire :**
  - `apps/web/e2e/playwright.config.ts` repassé en `serviceWorkers: 'allow'`.

---

## 4. Scénarios de stabilité et test hors ligne vérifiés (`apps/web/e2e/facturation-sw-offline.spec.ts`)

1. **Profil vide (`chromium`, Chrome `157.0.8103.52`, SW actif)** : `20/20` rechargements sur `/facturation` et `20/20` sur `/facturation/:id`, `0` crash, `0` 404 (`npx playwright test e2e/facturation-sw-offline.spec.ts` -> PASS).
2. **Profil rempli + scénario mise à jour ancien SW** : profil persistant avec entrée sentinelle dans `residence_blue_db.outbox`, désenregistrement uniquement du Service Worker (sans vider IndexedDB), puis `20/20` rechargements sur `/facturation` et `20/20` sur `/facturation/:id` -> `0` crash et donnée IndexedDB préservée (`PASS`).
3. **Test hors ligne (`context.setOffline(true)`)** :
   - Encaissement de `5 000 FCFA` en espèces hors ligne -> badge `1 encaissement(s) en attente de synchronisation` visible et opération `CREATE_INVOICE_PAYMENT` stockée dans IndexedDB `outbox` avec `idempotencyKey` UUID v4.
   - Rétablissement réseau (`context.setOffline(false)` + événement `online`) -> vidage automatique de l'`outbox`, enregistrement unique vérifié côté API PostgreSQL (`payments.length === initial + 1`), puis rejeu manuel du même `POST /api/invoices/:id/payments` avec la même `Idempotency-Key` confirmant `0` doublon (`PASS`).
4. **Tests multi-navigateurs (`serviceWorkers: 'allow'`, 5 rechargements `/facturation`)** :
   - Google Chrome `157.0.8103.52` : `5/5`, `0` crash, `0` 404.
   - Microsoft Edge `157.0.4341.60` : `5/5`, `0` crash, `0` 404.
   - Mozilla Firefox : non installé sur le poste hôte et binaire `firefox-1543` incompatible en version de protocole avec Playwright `1.65.0` installé à la racine (`Browser.setDownloadOptions` / `legacyInterceptor`).
