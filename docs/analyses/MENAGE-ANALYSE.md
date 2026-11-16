# Analyse du parcours Ménage — Résidence Blue (Thiès)

**Branche :** `docs/analyse-menage`
**Méthode :** lecture complète du code réel (front Angular, API NestJS, règles partagées, base PostgreSQL, schéma Prisma) et test HTTP en lecture en mémoire sur les routes restaurant/cuisine (aucune donnée modifiée).

---

## A. Réponse rapide (en 8 lignes)

Non : avec le profil standard **Ménage** (`MENAGE`), la personne du ménage **n’a aucun droit API** sur le restaurant (`403` sur les 23 routes protégées), et le menu **Restaurant & Bar** n’apparaît pas dans sa barre latérale sur ordinateur.
En revanche, **trois défauts réels** expliquent pourquoi un compte ménage peut quand même voir « Restaurant & Bar » ou un bouton vers le restaurant :
1. Sur un compte ménage historique sans droits détaillés en base (comme `test.housekeeping@residenceblue.sn`), le système lui donne accès à **Accueil**, qui affiche en dur un gros bouton **« Commande en chambre »** pointant vers le restaurant (et sur téléphone sous 768 px, la barre du bas affiche des boutons fixes pour tout le monde).
2. Dans la création/modification des comptes, rien n’empêche de cocher manuellement **Restaurant** sur un profil **Ménage** (contrairement à **Cuisine** bloqué pour le restaurant, et **Rapports** bloqué hors comptable).
3. Pour le nettoyage, le parcours actuel mélange tout : après le départ client, la chambre passe bien à **« Ménage »**, mais sur l’écran **Chambres** chaque carte affiche des boutons de réception (`Check-in`, `Check-out`) sans filtrer par rôle, une chambre « Libre » n’a **aucun bouton pour demander un nettoyage** (seulement `Check-in` et `Maintenance`), et un clic sur `Maintenance` bloque la chambre à la réservation sans prévenir personne ni permettre au ménage de l’en sortir.

---

## B. Droits actuels du profil Ménage

### 1. Écran par écran (profil de départ `MENAGE`)

| Écran | Profil `MENAGE` actuel | Compte historique sans JSON (`screen_access = null`) | Ce que cela permet de faire aujourd’hui |
| :--- | :--- | :--- | :--- |
| **Accueil** (`/tableau-de-bord`) | **Aucun accès** (`AUCUN`) | **Lecture** (`LECTURE`) *(défaut)* | Sur compte `MENAGE`, redirigé vers `/chambres`. Sur compte historique sans JSON : atterrit sur Accueil, voit des compteurs clients du jour, « Recette du jour : 0 FCFA », un bouton **« Commande en chambre »** (lien `/restaurant`), « Encaisser » (`/facturation`) et « Réinitialiser les données ». *(Ref. `packages/shared/src/access.ts:267-276`, `:486-493`, `dashboard-page.component.ts:40-205`)* |
| **Planning** (`/planning`) | **Aucun accès** (`AUCUN`) | **Aucun accès** | Entrée absente du menu latéral, `/planning` redirige vers le premier écran autorisé, `403` sur `/api/reservations`. |
| **Chambres** (`/chambres`) | **Lecture** (`LECTURE`) | **Lecture** (`LECTURE`) | Voit les 12 cartes de chambres et peut modifier l’état grâce au droit particulier ci-dessous (sur compte créé par l’administration). Attention : sur compte historique sans JSON (`hasExplicitAccess = false`), `RolesGuard` rejette en `403` car `HOUSEKEEPING.enabled = false` dans `config/modules.json:505-514` (`roles.guard.ts:145-154`). |
| **Clients** (`/clients`) | **Aucun accès** (`AUCUN`) | **Aucun accès** | Aucun accès écran ni API (`/api/guests` -> `403`). |
| **Facturation** (`/facturation`) | **Aucun accès** (`AUCUN`) | **Aucun accès** | Aucun accès écran ni API (`/api/invoices*` -> `403`). |
| **Restaurant & Bar** (`/restaurant`) | **Aucun accès** (`AUCUN`) | **Aucun accès** | Absent du menu latéral si `restaurant = AUCUN`, `/restaurant` redirige via `authGuard`. **Défaut** : aucun verrou n’empêche de l’attribuer manuellement dans l’administration (`administration-compte-form-page.component.ts:256-287`, `administration.service.ts:310-324`), et sur téléphone (`< 768 px`) la barre du bas (`layout.component.ts:133-139`) reste figée sans tenir compte des droits. |
| **Cuisine** (`/cuisine`) | **Aucun accès** (`AUCUN`) | **Aucun accès** | Absent du menu, `403` sur l’API. |
| **Rapports** (`/rapports`) | **Aucun accès** (`AUCUN`) | **Aucun accès** | Verrouillé serveur et interface (`403 « Seul le comptable peut voir les rapports »`). |
| **Administration** (`/administration`) | **Aucun accès** | **Aucun accès** | Page `403` explicite et routes `/api/administration/*` bloquées `403`. |

### 2. Droits particuliers du profil `MENAGE` (`packages/shared/src/access.ts:277-282`)

- **Voir les montants (`voir_montants`)** : **Désactivé (`false`)** — *mais voir Problème #2 : les prix par nuit réapparaissent quand même à l’écran !*
- **Encaisser un paiement (`encaisser_paiement`)** : **Désactivé (`false`)**.
- **Changer l’état d’une chambre (`changer_etat_chambre`)** : **Activé (`true`)**.
- **Annuler une commande ou une réservation (`annuler_commande_ou_reservation`)** : **Désactivé (`false`)**.

### 3. Résultat réel des routes Restaurant & Cuisine pour un compte `MENAGE`

Test exécuté en lecture seule en mémoire sur le serveur NestJS compilé (`JwtAuthGuard`, `RolesGuard`, `ModuleStatusGuard`, `RestaurantController`, `CuisineController`) avec un jeton valide de profil `MENAGE` (`role = HOUSEKEEPING`, `restaurant = AUCUN`, `cuisine = AUCUN`) :

| Méthode | Route API | Résultat | Cause dans le code |
| :--- | :--- | :---: | :--- |
| `GET` | `/api/restaurant/catalog` | **403** | `@Acces({ anyScreens: [restaurant, rapports] })` (`restaurant.controller.ts:78-79`) |
| `GET` | `/api/restaurant/categories` | **403** | `@Acces({ anyScreens: [restaurant, rapports] })` (`restaurant.controller.ts:85-86`) |
| `GET` | `/api/restaurant/rooms-in-stay` | **403** | `@Acces('restaurant', 'LECTURE')` (`restaurant.controller.ts:91-92`) |
| `GET` | `/api/restaurant/products` | **403** | `@Acces({ anyScreens: [restaurant, rapports] })` (`restaurant.controller.ts:114-115`) |
| `GET` | `/api/restaurant/products/images/:filename` | **404 / 200** | `@Public()` : fichier image uniquement, aucun prix ni client (`restaurant.controller.ts:97-98`) |
| `POST/PATCH/DELETE` | `/api/restaurant/products*` (+ image) | **403** | `@Acces({ directorOnly: true })` (`restaurant.controller.ts:121-165`) |
| `GET` | `/api/restaurant/orders/stream` (SSE) | **403** | `@Acces({ anyScreens: [restaurant, cuisine] })` (`restaurant.controller.ts:167-169`) |
| `GET` / `POST` | `/api/restaurant/orders/stale`, `.../close-stale` | **403** | `@Acces('restaurant', 'ECRITURE')` (`restaurant.controller.ts:202-210`) |
| `GET` | `/api/restaurant/orders/page` | **403** | `@Acces({ anyScreens: [restaurant, cuisine, facturation] })` (`restaurant.controller.ts:219-226`) |
| `GET` | `/api/restaurant/kitchen/orders` et `/orders` | **403** | `@Acces('cuisine', 'LECTURE')` (`restaurant.controller.ts:232-240`) |
| `POST` | `/api/restaurant/orders` | **403** | `@Acces('restaurant', 'ECRITURE')` (`restaurant.controller.ts:246-247`) |
| `POST` | `/api/restaurant/orders/:id/pay` | **403** | `@Acces({ screen: 'restaurant', level: 'ECRITURE', specialPermission: 'encaisser_paiement' })` (`restaurant.controller.ts:256-257`) |
| `POST` | `/api/restaurant/orders/:id/cancel` | **403** | `@Acces({ screen: 'restaurant', level: 'ECRITURE', specialPermission: 'annuler_commande_ou_reservation' })` (`restaurant.controller.ts:268-269`) |
| `PATCH` | `/api/restaurant/orders/:id/items` | **403** | `@Acces('restaurant', 'ECRITURE')` (`restaurant.controller.ts:279-280`) |
| `PATCH` | `/api/restaurant/orders/:id/status` et `/:id` | **403** | `@Acces({ anyScreens: [cuisine, restaurant] })` (`restaurant.controller.ts:289-300`) |
| `GET` | `/api/cuisine/orders` et `/api/cuisine/*` | **403** | `@Acces('cuisine', 'LECTURE')` (`restaurant.controller.ts:314-328`) |

**Montants et clients** : la personne du ménage ne voit aucun nom de client ni facture (`/api/guests`, `/api/reservations`, `/api/invoices`, `/api/rapports` -> `403`). En revanche, **elle voit encore les prix des chambres par nuit (`35 000`, `55 000`, `95 000 FCFA`) sur toutes les cartes de l’écran Chambres** parce que le front les remet par défaut quand le serveur les masque (voir D.2).

---

## C. Le processus de nettoyage aujourd’hui, étape par étape

### 1. États de chambre existants (`packages/shared/src/rooms.ts:7-12`, `status-badge.component.ts:125-145`)

| État en base | Libellé affiché | Couleur pastille | Signification |
| :--- | :--- | :--- | :--- |
| `FREE` | **Libre** | Vert | Chambre prête à accueillir un client. |
| `OCCUPIED` | **Occupée** | Bleu pétrole | Client actuellement en séjour. |
| `CLEANING` | **Ménage** | Orange (ambre) | Chambre libérée ou à nettoyer avant remise en vente. |
| `MAINTENANCE` | **Maintenance** | Rouge (rose) | Chambre bloquée techniquement (panne). |
| `isActive = false` | **Inactive** | Gris | Chambre retirée de l’exploitation par le directeur. |

### 2. Schéma des transitions actuelles (`packages/shared/src/rooms.ts:108-180`)

```text
  [Check-in]                     [Check-out automatique]
Libre (FREE) ───► Occupée (OCCUPIED) ───────────► Ménage (CLEANING)
    ▲                                                    │
    └──────────── [Bouton "Marquer propre"] ─────────────┘
                  (Directeur, Réception, Ménage)

  * Tout état ──► [Bouton "Maintenance"] ──► Maintenance (MAINTENANCE)
                   (Directeur, Réception, Ménage, Technique)
                   ⚠ Le profil Ménage NE PEUT PLUS EN SORTIR SEUL !
                   (Seuls Directeur ou Technique peuvent faire Maintenance -> Ménage/Libre)
```

- **Check-out automatique** : oui, quand la réception clôture une facture (`billing.service.ts:1401-1406`) ou fait le check-out depuis le planning (`reservations.service.ts:651-654`) ou depuis une carte chambre (`room-status-card.component.ts:254`), la chambre passe automatiquement à `CLEANING` (**Ménage**).
- **Blocage réservation** : `MAINTENANCE` empêche de réserver la chambre (`reservations.service.ts:238-242`, `rooms.service.ts:68`). `CLEANING` n’empêche pas de créer une réservation future, mais bloque l’installation directe du client (`CLEANING -> OCCUPIED` interdit à `rooms.ts:127-132`).

### 3. Ce que vit la personne du ménage sur l’écran Chambres aujourd’hui (`room-status-card.component.ts:219-313`)

Nombre de clics après connexion (si compte `MENAGE` -> arrive sur `/chambres`) :

- **Pour marquer une chambre « Libre » comme « à nettoyer »** : **IMPOSSIBLE en 1 clic sur la carte** (il n’y a **aucun bouton** pour passer `Libre` -> `Ménage`, même si le serveur l’autorise à `rooms.ts:156` !). La carte `Libre` n’affiche que deux boutons : **`Check-in`** (qui déclenche une erreur pour le ménage) et **`Maintenance`**. C’est pour cela qu’elle clique sur **`Maintenance`** !
- **Pour marquer une chambre déjà à l’état « Ménage » comme propre** :
  1. Filtre optionnel « Ménage » (1 clic) ou défilement jusqu’à la chambre ;
  2. Clic sur **`Marquer propre`** (1 clic -> passe à `Libre` sans confirmation, `room-status-card.component.ts:269-277`). Total : **1 à 2 clics**.
  *(Problème : la carte ne dit pas clairement si le client est parti, car toutes les 12 chambres sont mélangées avec des boutons `Check-in` / `Check-out`.)*
- **Pour signaler une panne (fuite, ampoule)** :
  1. Clic sur **`Maintenance`** (1 clic).
  2. **Aucune fenêtre ni champ pour écrire « fuite » ou « ampoule »** : le code envoie un texte fixe invisible (« Signalement panne » ou « Panne constatée au ménage », `room-status-card.component.ts:241, 285`).
  3. **Personne n’est prévenu** : aucune alerte ni notification en temps réel n’existe pour la réception ou le directeur (la cloche de `header.component.ts:51-57` n’est reliée à aucun flux ; la réception ne voit le changement qu’en allant sur `/chambres` et en actualisant, car `/planning` n’affiche pas l’état de propreté ou panne des chambres, `planning-page.component.ts:252-262`).

---

## D. Problèmes trouvés, classés par gravité

| Gravité | Problème constaté | Preuve exacte (fichier, ligne) | Risque pour l’hôtel | Effort |
| :--- | :--- | :--- | :--- | :---: |
| **Bloquant** | **La personne du ménage se bloque elle-même en cliquant sur « Maintenance »** : aucun bouton pour passer une chambre `Libre` à nettoyer, et une fois en `Maintenance`, ses boutons `Remettre en service` / `Ménage` répondent `400` car seul `TECHNIQUE` ou `DIRECTION` peut sortir de `Maintenance`. | `room-status-card.component.ts:223-309` ; `packages/shared/src/rooms.ts:153-161` ; `reservations.service.ts:238-242` | Des chambres propres se retrouvent bloquées en panne, impossibles à réserver, et la réception ne peut même pas les débloquer (`RECEPTION` bloquée aussi à `rooms.ts:141-151`). | **Petit** |
| **Bloquant** | **Boutons de réception et actions interdites affichés sur toutes les cartes chambre** : le profil Ménage voit `Check-in`, `Check-out`, `Remettre en service`, `Voir la fiche` (`⋯`) avec tout le tiroir d’édition, et génère des erreurs rouges `400`/`403`. | `room-status-card.component.ts:51-89`, `:219-313` ; `rooms.component.ts:1085-1088` | Confusion totale pour une personne peu à l’aise avec l’informatique ; fausses manœuvres et perte de confiance. | **Moyen** |
| **Bloquant** | **Un compte historique `HOUSEKEEPING` sans JSON (`screen_access = null`) est bloqué en `403` sur les chambres et redirigé vers Accueil avec bouton Restaurant** : `resolveDefaultAccessForRole` lui donne `accueil: LECTURE` (avant `chambres`), et `RolesGuard` rejette ses appels `/api/rooms` tant que `HOUSEKEEPING.enabled = false` dans `config/modules.json`. | `packages/shared/src/access.ts:485-493` ; `roles.guard.ts:145-154` ; `config/modules.json:505-514` ; `dashboard-page.component.ts:188-205` | En base actuelle, `test.housekeeping@residenceblue.sn` tombe sur l’Accueil avec bouton « Commande en chambre » et « Recette du jour : 0 FCFA », sans pouvoir gérer les chambres. | **Petit** |
| **Important** | **Les tarifs des chambres (`35 000` / `55 000` / `95 000 FCFA`) restent visibles sans `voir_montants`** : l’API masque `pricePerNight` à `null`, mais le front le remplace par des montants codés en dur et l’affiche en gros sur chaque carte. | `rooms.controller.ts:53, 119` ; `rooms.service.ts:877, 916-944` ; `room-status-card.component.ts:183-188` | Fuite visuelle des tarifs de l’hôtel vers des comptes qui n’ont pas `voir_montants`. | **Petit** |
| **Important** | **Pas de verrou empêchant d’attribuer Restaurant/Accueil au profil Ménage et barre mobile non filtrée** : l’administration laisse cocher `Restaurant` sur un profil `MENAGE`, et sous `768 px` la barre du bas affiche `Bord`, `Planning`, `Chambres`, `Résas`, `Plus` à tout le monde. | `administration.service.ts:310-324` ; `administration-compte-form-page.component.ts:256-287` ; `layout.component.ts:133-139` | Sur smartphone (usage probable d’une femme de chambre), l’écran montre 4 menus inutiles ou bloqués ; en administration, une erreur de case peut ouvrir le restaurant. | **Moyen** |
| **Important** | **Aucune notification ni description de panne** : lorsqu’une chambre devient « Prête/Libre » ou « En panne », la réception n’est pas avertie, et le ménage ne peut pas préciser s’il s’agit d’une fuite ou d’une ampoule (texte codé en dur). | `rooms.service.ts:768-844` ; `room-status-card.component.ts:241, 285` ; `header.component.ts:51-57` | Retards d’accueil client (la réception ignore qu’une chambre vient d’être nettoyée) et pannes sans détail. | **Moyen** |
| **Confort** | **Vocabulaire technique ou ambigu** : pastille `Ménage` au lieu de « À nettoyer », bouton `Maintenance` au lieu de « Signaler un problème », bouton `Check-in` / `Check-out`, affichage des équipements (`Wi-Fi Fibre`), badge `En ligne` / filtres par catégorie. | `status-badge.component.ts:131-137` ; `room-status-card.component.ts:226-303` ; `rooms.component.ts:60-217` | Charge cognitive élevée et erreurs d’interprétation (« Maintenance » pris pour « entretien/ménage »). | **Petit** |

---

## E. La meilleure version à proposer pour une personne novice

### Ce qu’elle doit voir (et rien d’autre)
- **Connexion directe sur un seul écran : `Chambres à nettoyer`** (sur ordinateur comme sur téléphone).
- **Menu épuré** :
  - Desktop : **1 seule entrée** (« Chambres » ou « Ménage »). Aucune barre de recherche globale, aucun bouton `+ Nouvelle réservation`, aucune cloche vide dans l’en-tête.
  - Mobile (`< 768 px`) : supprimer les 5 boutons génériques pour le profil Ménage ; garder uniquement l’écran actuel et un bouton visible **« Se déconnecter »**.
- **Ce qui disparaît de ses cartes de chambres** :
  - Plus de prix (`35 000 FCFA`), plus de menu caché `⋯`, plus de boutons `Check-in`, `Check-out`, `Remettre en service`, plus de mot `Maintenance`.
  - En haut : simplement **3 grands compteurs cliquables** :
    - **À nettoyer (N)** *(ouvert par défaut)*
    - **Propres (N)**
    - **Problème signalé (N)**
- **Mots simples sur chaque carte** :
  - Grande mention : **Chambre 102** (et étage, ex. *1er étage*).
  - Pastille claire : **À nettoyer** (orange), **Propre** (vert), **Problème signalé** (rouge), **Client présent** (bleu, en lecture seule sans action).
  - Au maximum **2 gros boutons (hauteur >= 52 px)** selon l’état :
    - Si **À nettoyer** : **`J’ai nettoyé`** (vert, plein) + **`Signaler un problème`** (contour rouge/ambre).
    - Si **Propre** : **`À nettoyer`** (si besoin de repasser derrière un contrôle, contour discret).
    - Si **Problème signalé** : badge clair + texte du problème saisi + aucun bouton d’erreur (l’équipe technique ou la direction le traite).

### Comparaison de 2 options

| Critère | Option 1 : Ultra-simple (1 clic) | Option 2 : Simple + signalement guidé *(Recommandée)* |
| :--- | :--- | :--- |
| **Marquer propre** | **1 clic** sur `J’ai nettoyé` (passe à `Libre`). | **1 clic** sur `J’ai nettoyé` (passe à `Libre`). |
| **Marquer à nettoyer** | **1 clic** sur `À nettoyer` depuis l’onglet « Propres ». | **1 clic** sur `À nettoyer` depuis l’onglet « Propres ». |
| **Signaler une panne** | **1 clic** sur `Signaler un problème` (bloque la chambre sans détail). | **2 clics** : `Signaler un problème` -> choix rapide en gros boutons (*Fuite d’eau / Ampoule / Climatisation / Autre* + note vocale/texte optionnelle) -> `Envoyer`. |
| **Alerte réception** | Bannière/pastille sur l’écran Réception quand elle recharge. | Alerte en direct (SSE) chez la réception et le directeur dès qu’une chambre devient « Propre » ou « Problème signalé ». |
| **Risque d’erreur** | Moyen si clic par mégarde sur `Signaler un problème` (bloque la chambre). | Très faible : la fenêtre de choix évite le clic accidentel et explique « Cela bloquera la chambre pour les clients ». |

**Recommandation : Option 2 (Simple + signalement guidé)**.
Elle garde **1 seul clic** pour les tâches quotidiennes de nettoyage (`J’ai nettoyé`, `À nettoyer`), évite de bloquer une chambre par erreur grâce à une petite confirmation avec boutons de pannes courants, et informe immédiatement la réception pour accueillir le prochain client sans appeler par téléphone.

---

## F. Plan d’action ordonné (à exécuter étape par étape)

1. **Étape 1 — Verrouiller le profil Ménage côté droits et serveur (`access.ts`, `AdministrationService`, `config/modules.json`)**
   - *Objectif* : garantir qu’un compte Ménage n’ait accès qu’aux chambres (jamais Restaurant, Facturation, Rapports, Accueil), y compris les anciens comptes sans JSON.
   - *Actions* : retirer `accueil: 'LECTURE'` de `resolveDefaultAccessForRole(Role.HOUSEKEEPING)` dans `packages/shared/src/access.ts:485-493` ; activer le rôle fonctionnel `HOUSEKEEPING` dans `config/modules.json:505-514` et `ServerModuleConfigService` (`roles.guard.ts`) ; verrouiller `restaurant = AUCUN` pour `MENAGE` dans `AdministrationService` + fiche compte (comme pour `rapports`).
   - *Risques* : un test `accueil.service.spec.ts:43,79` vérifie `resolveVisibleAccueilBlocks(Role.HOUSEKEEPING)` ; ne casser aucun test de `AccueilService`, ne toucher qu’aux accès de `MENAGE`.
   - *Tests* : unitaires (`access.spec.ts`) + intégration (`administration-comptes.e2e-spec.ts`) + sonde des routes restaurant (`403`).
   - *Effort / Modèle* : **Petit** / `inherit` (ou `flash`).

2. **Étape 2 — Nettoyer la navigation mobile, la barre latérale et le masquage des prix de chambres**
   - *Objectif* : faire disparaître tout lien vers Restaurant/Planning/Tarifs sur ordinateur et téléphone pour les profils non autorisés (et en particulier `MENAGE`).
   - *Actions* : filtrer `mobileNavItems` dans `layout.component.ts:133-139` selon `AuthService.hasScreen(...)` (et masquer pour `MENAGE` s’il n’a qu’un seul écran, avec un bouton Déconnexion accessible) ; dans `header.component.ts`, masquer la recherche globale réservations/clients si l’utilisateur n’a accès ni à `planning` ni à `clients` ; dans `rooms.service.ts:877` et `room-status-card.component.ts:183-188`, ne jamais inventer `35 000 / 55 000 / 95 000 FCFA` si le serveur a renvoyé `null` (et masquer la ligne de prix si `!canViewAmounts`).
   - *Risques* : régressions sur le test Playwright `menu-lateral.spec.ts` ou `chambres.spec.ts` -> bien vérifier pour `DIRECTION` et `RECEPTION` que rien ne change.
   - *Tests* : unitaires `rooms.service.spec.ts` + E2E Playwright `chambres` avec compte `MENAGE` sans aucun tarif affiché ni lien Restaurant mobile/desktop.
   - *Effort / Modèle* : **Petit** / `flash` ou `inherit`.

3. **Étape 3 — Adapter l’écran Chambres au rôle de l’utilisateur (actions et mots simples)**
   - *Objectif* : remplacer les boutons génériques par les seules actions permises à chaque rôle, avec le vocabulaire adapté pour le ménage.
   - *Actions* : filtrer les boutons dans `room-status-card.component.ts:219-313` selon `currentRole` et `changer_etat_chambre` :
     - pour `HOUSEKEEPING`/`MENAGE` : masquer `Check-in`, `Check-out`, `Remettre en service`, menu `⋯` (ou limiter `Voir la fiche` hors tarifs/édition) ; afficher **« J’ai nettoyé »** sur `CLEANING` (`À nettoyer`), **« À nettoyer »** sur `FREE` (`Propre`), et **« Signaler un problème »** sur `FREE` / `CLEANING` (jamais sur `MAINTENANCE`, ni d’action `Check-in`) ;
     - traduire l’étiquette du badge `CLEANING` : « À nettoyer » pour `MENAGE` (ou partout si validé).
   - *Risques* : vérifier les `data-testid` attendus par les tests E2E existants de `chambres` pour `DIRECTION` / `RECEPTION`.
   - *Tests* : E2E Playwright parcourant 100 % du cycle Ménage (`À nettoyer -> J’ai nettoyé -> Propre`, `Propre -> À nettoyer`) sans erreur 400/403.
   - *Effort / Modèle* : **Moyen** / `inherit`.

4. **Étape 4 — Modale simple de signalement de problème et déblocage encadré**
   - *Objectif* : éviter les mises en maintenance par erreur et permettre de préciser la panne en 2 clics.
   - *Actions* : ouvrir `ModalShellComponent` au clic sur « Signaler un problème » avec 4 gros choix (*Fuite d’eau*, *Ampoule / Électricité*, *Climatisation*, *Autre*) + description optionnelle + rappel « Cette chambre ne pourra plus être louée tant qu’elle n’est pas réparée » -> envoie `reason` à `PATCH /api/rooms/:id/status` et sauvegarde une note lisible sur la chambre (`internalNote` ou nouveau champ `maintenanceReason` en migration Prisma). Permettre à `RECEPTION` (ou confirmer si souhaité) de voir ce motif.
   - *Risques* : modification du schéma Prisma si stockage dédié du motif ; migration sans perte obligatoire.
   - *Tests* : test d’intégration `rooms.e2e-spec.ts` + Playwright E2E signalement panne.
   - *Effort / Modèle* : **Moyen** / `inherit`.

5. **Étape 5 — Notification en direct vers la réception (chambre propre / problème signalé)**
   - *Objectif* : prévenir la réception dès qu’une chambre change d’état.
   - *Actions* : créer un flux temps réel SSE `/api/rooms/stream` (sur le modèle de `restaurant/orders/stream`) déclenché dans `RoomsService.updateStatus` et branché sur le bouton cloche de `header.component.ts` pour `RECEPTION` et `DIRECTION` + pastille sur le Planning.
   - *Risques* : vérifier la révocation de session SSE (`sessionRevocation.onUserRevoked`) et les performances hors ligne.
   - *Tests* : test d’intégration SSE + Playwright multi-contexte (page Ménage clique « J’ai nettoyé », page Réception voit immédiatement la notification et la pastille).
   - *Effort / Modèle* : **Moyen** / `pro` ou `inherit`.

---

## G. Questions ouvertes (points à valider)

1. **Si une chambre est marquée comme « Problème signalé » par erreur par la personne du ménage, qui doit pouvoir la remettre en service sans attendre un technicien ?**
   - *Par défaut proposé* : le Directeur (administrateur) et le compte Technique ; si la réception doit aussi pouvoir annuler une erreur, il faudra l’autoriser explicitement pour `RECEPTION`.
2. **Lorsqu’un client est encore dans sa chambre (« Occupée »), la personne du ménage doit-elle pouvoir signaler une panne ou changer l’état, ou seulement voir que le client est là ?**
   - *Par défaut proposé* : sur « Occupée », afficher **« Client présent »** sans bouton de nettoyage, avec possibilité de « Signaler un problème » uniquement via confirmation guidée.
3. **Pour le travail quotidien (recouche de chambres toujours occupées plusieurs jours), faut-il suivre le ménage quotidien dans le logiciel, ou uniquement le nettoyage après départ d’un client ?**
   - *Par défaut proposé* : suivre uniquement la disponibilité réelle à la vente (`À nettoyer` -> `Propre`), sans ajouter de gestion lourde de recouche en Version 1.
4. **Quel libellé préférez-vous sur l’étiquette de chambre pour tout l’hôtel : « À nettoyer » ou « Ménage » ?**
   - *Par défaut proposé* : **« À nettoyer »** (plus clair pour tout le monde, y compris à la réception).
5. **Le rôle « Réception » peut-il aussi voir directement la raison d’une panne sur le Planning ?**
   - *Par défaut proposé* : oui, afficher un petit badge « Hors service : [motif] » sur le Planning et sur la carte Chambre.
