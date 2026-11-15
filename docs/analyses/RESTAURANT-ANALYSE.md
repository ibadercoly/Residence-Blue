# Analyse complète du module « Restaurant & Bar » — Résidence Blue

> **Date :** 15 novembre 2026  
> **Branche d’analyse :** `docs/analyse-restaurant` (basée sur `009ed95`)  
> **Périmètre relu :** Interface Angular (`apps/web/src/app/restaurant-v3/`, `facturation-v3/`, `shared/`, `core/`), serveur NestJS (`apps/api/src/restaurant/`, `apps/api/src/billing/`), base de données (`apps/api/prisma/schema.prisma`), droits (`packages/shared/src/`), et suites de tests.  
> **Règle d’or :** chaque constat ci-dessous est vérifié ligne par ligne dans le code réel ; aucune donnée `.env` n’est lue ni exposée.

---

## A. Résumé en 10 lignes

1. Le module « Restaurant & Bar » fonctionne techniquement pour prendre une commande, l’envoyer en cuisine en temps réel, imputer une chambre et encaisser un client de passage au comptoir.
2. L’écran **Cuisine** (`/cuisine`) a été refait pour tablette avec de très gros boutons (une commande à la fois, zéro défilement) et obtient la meilleure note de simplicité (4/5).
3. En revanche, l’écran **Prise de commande** (`/restaurant`) est trop chargé pour des débutants (30 à 50 boutons visibles, petits textes 11–12 px, 3 zones qui défilent) et cumule des blocages graves.
4. **Problème n° 1 :** la suppression récente des cartes de suivi en haut de `/restaurant` a aussi supprimé le seul bouton permettant de **modifier une commande** quand un plat manque en cuisine (`modifyOrderItems` existe encore côté serveur, mais n’est plus accessible à l’écran).
5. **Problème n° 2 :** impossible d’**encaisser plus tard** une commande Table ou À emporter envoyée en cuisine (le bouton « Encaisser » n’existe pas dans le tableau des commandes, même si le serveur sait le faire).
6. **Problème n° 3 :** un serveur ou assistant restaurant (`RESTAURANT` / `SERVEUR`) voit le bouton « Annuler » à l’écran, saisit un motif, puis reçoit une **erreur 403 refusée** du serveur dès qu’il veut corriger une erreur de saisie sans plat manquant ; et sur tablette/mobile (`< 1024 px`), les boutons d’autorisation et de service divergent du mode ordinateur.
7. Plusieurs alertes temps réel peuvent s’empiler jusqu’à 15 bandeaux d’affilée en haut de `/restaurant`, et les deux boutons « Envoyer en cuisine » / « Mettre sur la chambre » prêtent à confusion car les deux facturent la chambre tôt ou tard.
8. Le mode hors ligne ne marche que pour créer une nouvelle commande : en cuisine ou pour servir/annuler, la coupure internet bloque l’action.
9. **Recommandation :** adopter la version **« Simple + suivi en 1 ligne » (Option 2)** : une prise de commande allégée à l’extrême, une seule barre fixe de suivi « 1 ligne par commande » avec un seul bouton d’action selon le cas, et la possibilité d’encaisser après le repas ou de corriger un plat manquant.
10. Chaque écran ajouté ou simplifié respecte la règle d’équilibre : on retire le vocabulaire comptable, les doubles zones et les boutons trompeurs pour rester compréhensible dès le premier jour sans formation.

---

## B. Ce qui existe aujourd’hui

| Écran / Fonction | À quoi ça sert | Qui s'en sert | État réel | Simplicité /5 | Fichiers principaux |
| --- | --- | --- | --- | --- | --- |
| **Prise de commande** (`/restaurant`) | Choisir les plats, choisir Chambre / Table / À emporter, envoyer en cuisine ou encaisser | `DIRECTION`, `RECEPTION`, `RESTAURANT`, `SERVEUR` (et lecture seule `COMPTABLE`) | **Partiel / Fragile** (suppression des cartes = perte du bouton Modifier ; pas d’encaissement différé ; bug mobile sur `Servie`) | **2 / 5** | [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L45-L956) |
| **Tableau « Commandes du service »** (bas de `/restaurant`) | Voir les 50 dernières commandes, temps restant en cuisine, autoriser/marquer servie, annuler | Mêmes rôles (pas `CUISINIER`) | **Partiel** (pas de bouton « Encaisser », pas de bouton « Modifier », décalage desktop vs mobile `< 1024 px`) | **2 / 5** | [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L596-L879) |
| **Cartes d'information** (haut de `/restaurant`) | Cartes détaillées + frise datée + modification des plats manquants | Assistants (supprimées en `009ed95`) | **Supprimé côté écran** (mais le code de modification reste inutilisé côté API) | — | [`restaurant.controller.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.controller.ts#L269-L277) |
| **Bandeaux de notifications cuisine** (haut de `/restaurant`) | Afficher en direct « 15 min », « +5 min », « Plat indisponible », « Prêt à servir » | Assistants | **Fonctionne**, mais peut empiler jusqu'à 15 bandeaux à fermer un par un | **2,5 / 5** | [`restaurant-v3.service.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L165-L220), [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L132-L176) |
| **Écran Cuisine** (`/cuisine`) | Recevoir les commandes en direct (SSE), choisir 10–45 min, +5 min, signaler un plat manquant, marquer « Prête » | `CUISINIER` (écran unique), `CUISINE`, `DIRECTION` | **Fonctionne** (barre haute à ajuster sous 1280 px à cause de la sidebar 256 px ; ancien E2E non mis à jour) | **4 / 5** | [`cuisine-ecran-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/cuisine-ecran-page.component.ts#L60-L650) |
| **Gestion de la carte** (`/restaurant/carte`) | Ajouter/modifier plats, prix FCFA, photo, disponible / épuisé / désactiver | `DIRECTION` uniquement | **Fonctionne** (mais le choix `Cuisine / Bar / Pâtisserie` ne filtre rien côté cuisine) | **3 / 5** | [`carte-admin-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/carte-admin-page.component.ts#L24-L420) |
| **Clôture des anciennes commandes (> 12 h)** | Fermer avec un motif les tickets oubliés depuis plus de 12 h | `DIRECTION`, `RECEPTION` | **Fonctionne**, mais peu compréhensible pour un novice | **2,5 / 5** | [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L882-L934), [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L699-L788) |
| **Lien Facturation & Comptoir** (`/facturation`) | Imputer sur la note de la chambre (`ROOM_CHARGE` + rattachement auto), créer note « Client de passage » | `DIRECTION`, `RECEPTION`, `COMPTABLE` (et `RESTAURANT` pour ajout chambre) | **Fonctionne**, mais mélange des factures déjà payées (« Client de passage » en statut `OPEN`) et rattache auto | **3 / 5** | [`billing.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/billing/billing.service.ts#L415-L493), [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L1048-L1153) |
| **Navigation mobile basse** (`< 768 px`) | Accès rapide sur téléphone | Tous sauf `CUISINIER` | **Cassé / Inutile** pour le restaurant (n'affiche pas `/restaurant` et pointe vers `/reservations` ou `/parametres` inactifs) | **1 / 5** | [`layout.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/shared/components/layout/layout.component.ts#L133-L139) |

---

## C. Problèmes trouvés, classés par gravité

### Bloquant

1. **Plus aucun moyen de modifier une commande quand la cuisine signale un plat manquant**
   - **Description :** la suppression de `pos-tracking-cards-section` a retiré le seul bouton « Modifier la commande » et le bloc d'édition des plats (`openModifyOrder`, `saveModifiedOrder`). Le bandeau d'alerte s'affiche, mais l'assistant ne peut que tout annuler et recommencer.
   - **Preuve :** absence totale d'appel à `modifyOrderItems` dans [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L759-L793) alors que [`restaurant-v3.service.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L671-L705) et `PATCH /api/restaurant/orders/:id/items` ([`restaurant.controller.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.controller.ts#L269-L277)) existent.
   - **Risque pour l'hôtel :** si 1 plat manque sur une commande de 4 articles déjà imputée ou envoyée, l'assistant doit annuler toute la commande (refusé s'il est `RESTAURANT` ou si la facture est déjà émise) ou régler ça à l'oral avec un écart de caisse.
   - **Effort estimé :** Moyen.

2. **Impossible d'encaisser plus tard une commande Table ou À emporter envoyée en cuisine**
   - **Description :** au comptoir de prise de commande, un assistant qui clique « Envoyer en cuisine » pour une Table (client qui mange puis paie l'addition à la fin) n'a ensuite aucun bouton « Encaisser » sur la ligne de commande dans le tableau « Commandes du service ».
   - **Preuve :** le backend implémente `POST /api/restaurant/orders/:id/pay` ([`restaurant.controller.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.controller.ts#L246-L256), [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L1214-L1331)), mais une recherche sur tout `apps/web/src/` montre 0 appel à `/pay` ; le tableau ne propose que `J'autorise le service`, `Servie`, `Annuler` ([`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L759-L793)).
   - **Risque pour l'hôtel :** perte d'argent ou double commande saisie pour encaisser à la fin du repas (ce qui enverrait le ticket une 2e fois en cuisine !).
   - **Effort estimé :** Moyen.

3. **Le bouton « Annuler » est affiché aux serveurs/assistants restaurant mais le serveur renvoie 403 Refusé**
   - **Description :** côté interface, `canCancelOrder` vaut `true` pour `RESTAURANT` et `SERVEUR`. Côté serveur, l'annulation leur est refusée (`403 Forbidden`) sauf si la cuisine a d'abord signalé un plat indisponible.
   - **Preuve :** [`restaurant-v3.service.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L96-L104) vs [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L1889-L1896).
   - **Risque pour l'hôtel :** un assistant restaurant qui se trompe de plat ou de table voit un bouton « Annuler », tape un motif, puis se fait bloquer sans pouvoir corriger son erreur.
   - **Effort estimé :** Petit (clarifier la règle et aligner interface + API).

4. **Comportement incohérent sur mobile/tablette (`< 1024 px`) pour servir une commande prête**
   - **Description :** sur ordinateur (`>= 1024 px`), `READY` affiche « J'autorise le service » (`AUTHORIZED`), puis `AUTHORIZED` affiche « Servie ». Sous `1024 px`, `READY` affiche directement « Servie » (en sautant l'autorisation) et `AUTHORIZED` n'affiche **aucun bouton**.
   - **Preuve :** [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L760-L781) vs lignes [`L847-L855`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L847-L855).
   - **Risque pour l'hôtel :** si la réception autorise le service depuis le PC et que le serveur utilise une tablette, le bouton « Servie » est absent : la commande reste bloquée à l'état « Autorisée ».
   - **Effort estimé :** Petit.

5. **Confusion « Envoyer en cuisine » vs « Mettre sur la chambre » et double effet caché**
   - **Description :** pour une chambre, deux boutons existent (« Envoyer en cuisine » et « Mettre sur la chambre »). En réalité : (a) « Mettre sur la chambre » envoie **aussi** la commande en cuisine (`status: 'PENDING'`), et (b) une commande envoyée par « Envoyer en cuisine » sur une chambre est **quand même rattachée automatiquement** à la facture de la chambre à l'ouverture de Facturation. À l'inverse, encaisser une boisson froide au bar via « Encaisser » l'envoie aussi au cuisinier !
   - **Preuve :** [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L561-L590), [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L1021-L1153), [`billing.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/billing/billing.service.ts#L416-L491).
   - **Risque pour l'hôtel :** risque très élevé qu'un débutant clique « Envoyer en cuisine » puis ressaisisse le ticket et clique « Mettre sur la chambre » (= 2 plats préparés en cuisine et facturés 2 fois), ou encombre la cuisine avec des canettes/bouteilles vendues au bar.
   - **Effort estimé :** Moyen.

### Important

6. **Anciens tests automatisés de bout en bout (Playwright) cassés**
   - **Description :** deux suites E2E vérifient encore les anciens sélecteurs supprimés (`kitchen-col-PENDING`, `pos-order-card-*`, `kitchen-prep-15-*`).
   - **Preuve :** [`cuisine-flux-commandes.spec.ts`](file:///c:/Projets/Residence-Blue/apps/web/e2e/cuisine-flux-commandes.spec.ts#L288-L413) et [`restaurant-v3.spec.ts`](file:///c:/Projets/Residence-Blue/apps/web/e2e/restaurant-v3.spec.ts#L240-L261).
   - **Risque pour l'hôtel :** les contrôles avant mise en production échoueront sur ces suites ou masqueront une vraie panne du flux Restaurant ↔ Cuisine.
   - **Effort estimé :** Moyen.

7. **Mode hors ligne incomplet et trompeur**
   - **Description :** seule la création d'une nouvelle commande utilise la file d'attente locale (`outbox`). Toutes les autres actions (cuisinier qui accepte/termine un plat, assistant qui sert ou annule) échouent dès qu'Internet coupe. De plus, les commandes créées hors ligne n'arrivent jamais au cuisinier sur le réseau local tant que le serveur distant n'est pas revenu.
   - **Preuve :** [`restaurant-v3.service.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L545-L602) vs lignes [`L617-L768`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L617-L768).
   - **Risque pour l'hôtel :** en cas de coupure Wi-Fi/4G à Thiès pendant le service du midi, plus rien ne passe entre l'accueil et la cuisine.
   - **Effort estimé :** Moyen à Grand.

8. **Fuites potentielles / texte cassé vers le rôle Cuisinier et écart `CUISINE` / `CUISINIER`**
   - **Description :**
     - Le message d'événement `PRETE` écrit le nom du client puis tente de le retirer par remplacement de texte, ce qui produit `"Prête : ... à , Chambre 301"` et échouerait si le nom contenait un format différent.
     - `getCatalog()` ne vérifie que `actorRole === 'CUISINE'` (pas `'CUISINIER'`) pour masquer `roomsInStay`, même si le contrôleur bloque l'accès aujourd'hui.
     - `findOrdersPage` autorise `CUISINE`/`CUISINIER` sur `GET /api/restaurant/orders/page` avec recherche par `guestName`.
     - La réponse de `createOrder` en cas de rejeu sur `idempotencyKey` ne passe pas `hideAmounts`.
   - **Preuve :** [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L344), [`L406`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L406), [`L808`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L808), [`L852`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L852) ; [`restaurant.controller.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.controller.ts#L207-L219).
   - **Risque pour l'hôtel :** exposition indirecte d'un nom client ou réponse incohérente pour la cuisine ; dette de sécurité.
   - **Effort estimé :** Petit.

9. **Factures « Client de passage » laissées à l'état `OPEN` sans numéro et barre mobile cassée**
   - **Description :** chaque paiement direct restaurant crée une facture `Invoice` marquée `OPEN` (`isIssued: false`, `invoiceNumber: null`, nom générique `Client de passage` sans précision de table/ticket). Sur mobile (`< 768 px`), la barre de navigation du bas n'affiche pas `Restaurant & Bar` et pointe vers des routes inactives (`/reservations`, `/parametres`).
   - **Preuve :** [`restaurant.service.ts`](file:///c:/Projets/Residence-Blue/apps/api/src/restaurant/restaurant.service.ts#L1109-L1153) ; [`layout.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/shared/components/layout/layout.component.ts#L133-L139).
   - **Risque pour l'hôtel :** liste de factures encombrée de dizaines de lignes « Client de passage » en Facturation, et impossibilité de naviguer vers Restaurant sur téléphone.
   - **Effort estimé :** Moyen.

10. **Barre du haut `/cuisine` trop serrée avec la barre latérale `256 px` sur petites tablettes**
    - **Description :** la barre latérale fixe prend `256 px` dès `768 px` (`md:pl-64`), laissant peu de largeur à `<header>` sur 800–1024 px et forçant la pastille badge cuisine de `DIRECTION` à n'afficher que les 50 dernières commandes si `/cuisine` n'a pas été ouvert.
    - **Preuve :** [`layout.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/shared/components/layout/layout.component.ts#L31), [`cuisine-ecran-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/cuisine-ecran-page.component.ts#L69-L147), [`restaurant-v3.service.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L130-L143).
    - **Risque pour l'hôtel :** chevauchement ou étirement sur certaines tablettes en mode portrait ou petit paysage ; distinction Bar/Cuisine absente (`prepStation` du produit ignoré par `/cuisine`).
    - **Effort estimé :** Petit à Moyen.

### Confort

11. **Empilement de jusqu'à 15 bandeaux + surcharge de boutons et mots techniques sur `/restaurant`**
    - **Description :** bandeaux empilés un par un (`slice(0, 15)`), plus de 30 boutons visibles simultanément, mentions `Total TTC`, `Ticket en cours`, `J'autorise le service`, `#CMD-2026-xxxx-xxx`, textes à `11–12 px`, pas de numéro court simple (1, 2, 3...) pour « À emporter ».
    - **Preuve :** [`restaurant-v3.service.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts#L216), [`restaurant-pos-page.component.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts#L139-L590), [`restaurant-v3.model.ts`](file:///c:/Projets/Residence-Blue/apps/web/src/app/restaurant-v3/models/restaurant-v3.model.ts#L181-L253).
    - **Risque pour l'hôtel :** fatigue visuelle, clics accidentels et abandon du logiciel au profit du carnet papier ou d'Excel.
    - **Effort estimé :** Moyen.

12. **Code mort et incohérences internes**
    - **Description :** double liste de menus dans [`SidebarComponent`](file:///c:/Projets/Residence-Blue/apps/web/src/app/shared/components/sidebar/sidebar.component.ts#L259-L281) et [`ModuleConfigService`](file:///c:/Projets/Residence-Blue/apps/web/src/app/core/services/module-config.service.ts#L459-L489), double rôle historique `CUISINE` + `CUISINIER` et `SERVEUR` + `RESTAURANT`, deux contrôleurs (`RestaurantController` et `CuisineController`) pour la même liste de commandes.
    - **Effort estimé :** Petit.

---

## Mesure des 6 tâches du quotidien (système actuel)

| Tâche du quotidien | Parcours réel aujourd'hui | Clics | Risques d'erreur pour un débutant |
| --- | --- | --- | --- |
| **1. Commander pour une chambre** | `Chambre` (défaut) → Choisir chambre dans liste → Cliquer plat(s) → Cliquer `Envoyer en cuisine` ou `Mettre sur la chambre` | **3 à 4** | Hésiter entre les 2 boutons et cliquer les deux (= double commande). |
| **2. Commander pour un client de passage et l'encaisser** | Cliquer `Table` ou `À emporter` → (taper n° table) → Cliquer plat(s) → Choisir moyen de paiement → Cliquer `Encaisser` | **3 à 5** | Obligé d'encaisser tout de suite : s'il clique `Envoyer en cuisine`, plus aucun bouton `Encaisser` n'existe après le repas. |
| **3. Savoir où en est une commande** | Lire la pile de bandeaux en haut OU scroller jusqu'au tableau du bas (`Commandes du service`) | **0 + scroll** | Trop de bandeaux empilés (jusqu'à 15) ; mots parfois différents entre bandeau, ligne et cuisine. |
| **4. Servir un plat prêt** | Sur PC : cliquer `J'autorise le service` puis `Servie` (2 clics) ; sur tablette : un seul clic `Servie` (cassé si déjà autorisé) | **1 ou 2** | Incohérence entre PC et tablette ; confusion sur le sens de « J'autorise le service ». |
| **5. Gérer un plat manquant** | Lire le bandeau d'alerte → scroller au tableau → cliquer `Annuler` → taper motif → confirmer → tout resaisir à zéro | **4 + frappe** | Bouton `Modifier` disparu ; pas de correction rapide possible. |
| **6. Corriger ou annuler une commande** | Corriger : impossible. Annuler : `Annuler` → taper motif ≥ 3 lettres → `Confirmer l'annulation` | **3 + frappe** | Bloqué en `403` si fait par un rôle `RESTAURANT` / `SERVEUR` hors plat indisponible. |

---

## D. LA MEILLEURE VERSION À PROPOSER

### Comparaison de 3 options (sans augmenter le nombre d'éléments visibles)

| Option | Principe | Avantages | Risques | Effort |
| --- | --- | --- | --- | --- |
| **Option 1 : « Très simple »** (sans suivi cuisine détaillé) | Prise de commande épurée à 1 bouton d'envoi + liste en bas avec 3 états simples (`En cuisine`, `Prêt`, `Servi`). Pas de temps ni de plat manquant à l'écran. | Zéro apprentissage, presque impossible à casser. | Le serveur ne sait pas quand un plat manque ni dans combien de minutes c'est prêt ; perd un besoin réel de l'hôtel. | Petit |
| **Option 2 : « Simple + suivi en 1 ligne » *(RECOMMANDÉE)*** | Garder tout ce qui sert au quotidien (chambre, table/emporter, temps de cuisine, plat manquant, encaisser à la fin), mais remplacer la multitude de bandeaux et colonnes par **un seul tableau épuré « 1 ligne par commande, 1 phrase d'état, 1 seul bouton utile »** et un encart unique pour le dernier message cuisine. | Couvre 100 % du flux réel de Thiès (chambre + passage + cuisine + caisse) tout en restant compréhensible sans formation. Aucun bandeau empilé. | Demande de retirer les boutons trompeurs existants et d'ajouter le bouton « Encaisser » différé + « Remplacer » dans la ligne. | Moyen |
| **Option 3 : « Complète »** (multi-postes Bar/Cuisine, cartes détaillées + frise complète + modales d'édition) | Séparer écran Bar et Cuisine, rétablir les cartes détaillées avec frise datée, gérer les demi-portions et suppléments. | Richesse maximale pour un grand restaurant. | Trop complexe et chargée pour des utilisateurs novices ; multiplie les clics, les textes et les erreurs de saisie dans un hôtel de 12 chambres. | Grand |

### Option recommandée : Option 2 (« Simple + suivi en 1 ligne »)

C’est la seule qui corrige les 5 blocages réels (modification plat manquant, encaissement après repas, incohérence PC/tablette, double bouton Chambre, 403 annulation) **tout en réduisant le nombre de boutons et d'informations affichés**.

#### Ce qu’on garde (écrans & fonctions)
- **3 écrans seulement** :
  1. `/restaurant` — *Prendre une commande & suivre le service* (accessible `DIRECTION`, `RECEPTION`, `RESTAURANT`).
  2. `/cuisine` — *Écran du cuisinier* (accessible `CUISINIER` uniquement, et `DIRECTION` en secours).
  3. `/restaurant/carte` — *Gérer les plats et prix* (accessible `DIRECTION` uniquement, bouton discret en haut).
- **Fonctions gardées** :
  - Choix simple **Chambre** / **Table** / **À emporter** (avec n° court `#1, #2...` par journée de service en plus du n° interne).
  - Un seul clic pour envoyer en cuisine (pour Chambre, l’imputation à la note de séjour est automatique ; pour Table/À emporter, on choisit soit **Encaisser maintenant**, soit **Envoyer en cuisine et encaisser après**).
  - Suivi temps réel entre Cuisine et Accueil/Restaurant (prête dans X min, +5 min, plat manquant, prêt à servir).
  - Raccourci **Vente directe bar / boisson froide** (« Déjà servi & encaissé ») ou case simple pour ne pas encombrer le cuisinier avec une bouteille d’eau prise au frigo.

#### Ce qu’on retire ou reporte (et pourquoi)
- **Retirer la pile de jusqu’à 15 bandeaux d’alertes (`pos-assistant-notifications`)** → remplacée par **un seul bloc fixe** tout en haut (« Dernier message cuisine : Chambre 301 prêt à servir » + « Tout voir / Effacer ») : zéro surcharge visuelle.
- **Retirer la distinction « J’autorise le service » vs « Servie » (`READY` vs `AUTHORIZED`) si la patronne n’en a pas besoin par écrit** (ou la fusionner en un seul bouton **« Servir / Marquer servi »**) → supprime le bug mobile et économise 1 étape pour le personnel.
- **Retirer le double bouton « Envoyer en cuisine » + « Mettre sur la chambre » quand Destination = Chambre** → remplacer par un seul bouton clair : **« Envoyer en cuisine (sur la chambre) »**, car le système impute déjà la chambre automatiquement.
- **Retirer la section visible « Anciennes commandes > 12 h » pour les assistants de base** → garder uniquement pour `DIRECTION` ou clôturer dans un outil simple sans motif obligatoire de 3 caractères si le plat n'a jamais été préparé.
- **Retirer les champs inutiles du ticket** : cacher « Référence Wave/OM » derrière un clic « Ajouter n° de reçu » (optionnel) et remplacer `Total TTC` par `Total`.
- **Reporter en V2** : postes séparés Bar/Pâtisserie, demi-portions, multi-allergènes, recherche texte dans le tableau (sur 12 chambres, 10 à 20 commandes par service se lisent d’un coup d’œil).

#### Carte d'information / suivi idéale sur `/restaurant` (juste au-dessus ou à la place du tableau dense)
- **Une ligne par commande active** (envoyée, en préparation, plat manquant, prête, ou non encaissée).
- **Une seule phrase d’état claire**, sans code technique ni chrono compliqué :
  - *« En attente de la cuisine »*
  - *« Prête vers 13:20 (dans 12 min) »* (ou orange *« En retard de 4 min »*)
  - *« Manque : Spaghetti (plus de pâtes) »*
  - *« Prête à servir »* (ligne verte)
  - *« À encaisser (Table 4 — 9 000 FCFA) »*
- **Un seul bouton principal à droite selon l'état** (jamais 3 boutons côte à côte) :
  - Si plat manquant → **« Changer le plat »** (ouvre une petite fenêtre propre `ModalShellComponent` permettant d’enlever/remplacer le plat manquant ou d’annuler)
  - Si prête → **« Marquer servi »**
  - Si table/emporter non payé → **« Encaisser »** (choisir Espèces / Wave / Orange Money / Carte en 1 clic)
  - Un menu discret `⋮` (ou lien « Annuler ») seulement avant préparation.

#### Mots simples à utiliser à la place du jargon
- `Total TTC` → **Total**
- `Ticket en cours` → **Commande**
- `Client de passage` → **Client sans chambre** (avec `Table 4` ou `À emporter n° 3`)
- `J'autorise le service` → **OK, à servir** (ou fusionné dans **Marquer servi**)
- `En attente de synchronisation` → **Sera envoyé dès que la connexion revient**

#### Ce que voit chaque rôle
- **`CUISINIER` (`CUISINE` fusionné)** : uniquement `/cuisine`, sans prix ni nom de client, avec gros boutons tactiles (`Oui tout est là` → `15 min`, `Il manque un plat`, `+5 min`, `Prête`).
- **`RESTAURANT` (`SERVEUR` unifié)** : `/restaurant` (prise de commande, suivi en 1 ligne, servir, changer plat manquant, encaisser table/emporter, annuler sa propre erreur avant préparation). Aucun accès aux chambres, fiches clients, rapports ou `/cuisine`.
- **`RECEPTION`** : idem sur `/restaurant` + Accueil, Planning, Chambres, Clients, Facturation. Aucun accès à `/cuisine` ni à la modification de la Carte.
- **`DIRECTION`** (la patronne) : tout voir, y compris `/restaurant/carte` (prix et plats) et `/cuisine` si elle veut dépanner.

#### Parcours mesuré des 6 tâches dans la version recommandée
1. **Commander pour une chambre** : choisir chambre (1 clic) → toucher les plats (1 clic/plat) → toucher **« Envoyer en cuisine (sur la chambre) »** (1 clic) = **3 clics, zéro risque de double ticket**.
2. **Commander pour un client de passage et l'encaisser** : toucher `Table` ou `À emporter` (1) → plats (1) → **« Envoyer (à payer après) »** OU **« Encaisser tout de suite »** (1) = **3 clics**.
3. **Savoir où en est une commande** : regarder la liste « En cours » (1 ligne par commande, 1 phrase d'état en gros) + le seul encart fixe du haut = **0 clic**.
4. **Servir un plat prêt** : sur la ligne verte « Prête à servir », toucher l'unique bouton **« Marquer servi »** (fonctionne identiquement sur PC, tablette et téléphone) = **1 clic**.
5. **Gérer un plat manquant** : sur la ligne rouge, toucher **« Changer le plat »** → choisir un autre plat ou retirer → **« Renvoyer en cuisine »** = **3 clics, sans tout refaire**.
6. **Corriger ou annuler une commande** : toucher **« Annuler »** (avant préparation, même pour le serveur qui vient de faire une faute de frappe) → choisir un motif court (Bouton rapide : *Erreur de saisie*, *Client a changé d’avis*) = **2 clics**.

---

## E. Plan d'action ordonné (étape par étape)

1. **Étape 1 — Unifier et corriger les règles de transitions et droits côté serveur**
   - **Objectif :** réparer l’annulation par `RESTAURANT`/`SERVEUR` en cas d’erreur avant préparation, corriger `getCatalog`/`findOrdersPage`/`createOrder` pour garantir 0 fuite vers la cuisine, et nettoyer le message `PRETE` sans nom client résiduel.
   - **Action :** supprimer le blocage `403` sur annulation `PENDING` pour le créateur ou rôle `RESTAURANT`, nettoyer `ev.detail` sans `.replace()` bancal, étendre `isKitchenRole` dans `getCatalog` et bloquer `orders/page` avec `guestName` pour la cuisine.
   - **Fichiers :** `apps/api/src/restaurant/restaurant.service.ts`, `apps/api/src/restaurant/restaurant.controller.ts`.
   - **Risques :** aucun impact destructeur en base ; attention aux tests RBAC existants.
   - **Tests :** `apps/api/test/restaurant-v3.e2e-spec.ts` (droits cuisine et annulation `RESTAURANT`).
   - **Effort :** Petit · **Modèle conseillé :** `medium`.

2. **Étape 2 — Clarifier la facture « Client de passage » et l’imputation chambre**
   - **Objectif :** marquer `PAID` (et non `OPEN`) les factures « Client de passage » déjà soldées au restaurant, libeller clairement `Table X` / `À emporter #N`, et permettre l'envoi direct sans passer en cuisine pour les articles sans préparation (option `alreadyServed`).
   - **Action :** ajuster `createOrder` et `payExistingOrder` dans `restaurant.service.ts` + DTO `CreateRestaurantOrderDto`.
   - **Fichiers :** `apps/api/src/restaurant/restaurant.service.ts`, `apps/api/src/restaurant/dto/restaurant.dto.ts`.
   - **Risques :** vérifier que `ComptoirPageComponent` et les rapports journaliers comptent bien ces encaissements sans double comptage.
   - **Tests :** tests d'intégration facturation + restaurant.
   - **Effort :** Moyen · **Modèle conseillé :** `high`.

3. **Étape 3 — Corriger le mode hors ligne des actions cuisine/service et le badge menu**
   - **Objectif :** permettre au personnel de mettre en file d'attente hors ligne les actions `READY`, `SERVED`, `IN_PREPARATION`, `CANCEL` via `OutboxService` (avec `Idempotency-Key`), et corriger la navigation mobile `< 768 px`.
   - **Action :** ajouter le support outbox aux mutations de `restaurant-v3.service.ts`, ajouter `/restaurant` dans `mobileNavItems` de `layout.component.ts`, et supprimer la liste morte dans `sidebar.component.ts`.
   - **Fichiers :** `apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts`, `apps/web/src/app/core/offline/outbox.service.ts`, `apps/web/src/app/shared/components/layout/layout.component.ts`, `apps/web/src/app/shared/components/sidebar/sidebar.component.ts`.
   - **Risques :** conflit d'état hors ligne ; le serveur reste arbitre (`409` géré proprement).
   - **Tests :** tests unitaires Jest `restaurant-v3.service.spec.ts` et E2E mobile.
   - **Effort :** Moyen · **Modèle conseillé :** `high`.

4. **Étape 4 — Refondre `/restaurant` selon l'Option 2 (« Simple + suivi en 1 ligne »)**
   - **Objectif :** réduire de moitié les boutons visibles, remplacer la pile de 15 bandeaux par 1 encart fixe, remplacer les 2 boutons Chambre par 1 seul, ajouter « Encaisser » sur les tickets Table/À emporter en attente de paiement, ajouter la modale « Changer le plat » (`ModalShellComponent`) quand un plat manque, et unifier le bouton « Marquer servi » sur PC et tablette.
   - **Action :** nettoyer et simplifier `restaurant-pos-page.component.ts` et `restaurant-v3.model.ts` (mots simples, textes ≥ 14 px).
   - **Fichiers :** `apps/web/src/app/restaurant-v3/components/restaurant-pos-page.component.ts`, `apps/web/src/app/restaurant-v3/models/restaurant-v3.model.ts`, `apps/web/src/app/restaurant-v3/services/restaurant-v3.service.ts`.
   - **Risques :** régression visuelle ou perte d'un sélecteur utilisé par les anciens tests E2E.
   - **Tests :** tests unitaires `restaurant-pos-page.component.spec.ts` + tests Playwright complets.
   - **Effort :** Grand · **Modèle conseillé :** `high`.

5. **Étape 5 — Corriger l'adaptation tablette 800–1024 px sur `/cuisine` + numéro court À emporter**
   - **Objectif :** régler la largeur de la barre supérieure de `/cuisine` avec la barre latérale (repliable sous `1024 px` ou adaptation conteneur validée avec la patronne) et afficher un n° de retrait court lisible à 1,5 m pour `À emporter`.
   - **Action :** ajuster `layout.component.ts` (avec accord sur périmètre global) et `cuisine-ecran-page.component.ts`.
   - **Fichiers :** `apps/web/src/app/shared/components/layout/layout.component.ts`, `apps/web/src/app/restaurant-v3/components/cuisine-ecran-page.component.ts`.
   - **Risques :** toucher à `LayoutComponent` impacte les autres pages → vérifier les captures sur Tableau de bord, Planning, Facturation.
   - **Tests :** Playwright sur 5 largeurs (800, 970, 1024, 1280, 1440 px).
   - **Effort :** Moyen · **Modèle conseillé :** `medium`.

6. **Étape 6 — Mettre à jour les suites E2E cassées et ajouter des tests de sécurité/porte**
   - **Objectif :** réaligner `cuisine-flux-commandes.spec.ts` et `restaurant-v3.spec.ts` sur la vraie interface, couvrir les 6 tâches du quotidien et vérifier zéro donnée de test résiduelle.
   - **Action :** mettre à jour les `data-testid` et scénarios Playwright ; exécuter la suite E2E complète + lint + unitaires + sécurité.
   - **Fichiers :** `apps/web/e2e/cuisine-flux-commandes.spec.ts`, `apps/web/e2e/restaurant-v3.spec.ts`, `docs/security/`.
   - **Risques :** échecs d'anciens tests tant que les étapes 4–5 ne sont pas finies.
   - **Tests :** toute la suite Jest + Supertest + Playwright.
   - **Effort :** Moyen · **Modèle conseillé :** `medium`.

---

## F. Risques en production et en usage réel

| Situation réelle | Probabilité | Conséquence | Protection à prévoir |
| --- | --- | --- | --- |
| **Coupure Internet / Wi-Fi** | Élevée | Prise de commande enregistrée localement, mais **invisible en cuisine** ; boutons cuisine/service bloqués. | Afficher clairement « Hors ligne : prévenir la cuisine de vive voix » pour les nouvelles commandes + mettre aussi en file d'attente les actions `Prête / Servie`. |
| **Tablette en cuisine (doigts mouillés, veille)** | Élevée | Mise en veille de l'écran, coupure du flux temps réel SSE, écran trop étroit sous 1024 px. | Secours 10 s déjà présent sur `/cuisine` ; ajouter réveil / bouton plein écran ou masquage de la barre latérale sous 1024 px. |
| **Deux assistants en même temps** | Moyenne | Deux personnes servent ou encaissent la même commande ou saisissent en double. | Verrouillage atomique déjà présent côté API (`updateMany` + `409`) et clé `Idempotency-Key` ; côté écran, rafraîchir tout de suite et afficher un message clair si déjà fait. |
| **Erreur de saisie** | Très élevée | Mauvaise chambre, mauvaise quantité ou doublon envoyé en cuisine. | Autoriser l'annulation facile avant préparation (même par `RESTAURANT`), et permettre « Modifier » sur une commande en attente. |
| **Plat oublié ou manquant** | Élevée | Sans bouton « Changer le plat », la commande reste bloquée ou le client attend sans savoir. | Rétablir une modale simple « Changer le plat » reliée à `PATCH /api/restaurant/orders/:id/items`. |
| **Commande servie deux fois** | Moyenne | L'assistant clique `Envoyer en cuisine` puis `Mettre sur la chambre`. | Fusionner en 1 seul bouton quand la destination est une chambre ; désactiver le bouton pendant l'envoi (`busyAction`). |
| **Données de test restées en base** | Moyenne | Fausses commandes ou faux plats visibles au premier démarrage à Thiès. | Toujours séparer base de test et base de production ; prévoir une remise à zéro propre avant mise en service réelle. |
| **Formation nulle** | Certaine | Personnel intimidé par le vocabulaire comptable, trop de boutons, abandon vers le papier. | Mots simples en français courant, max 1 action par ligne, gros boutons ≥ 44 px (64+ px en cuisine), états vides explicites. |

---

## G. Formation et adoption

### Ce que l'équipe doit savoir faire le premier jour (en 5 phrases)
1. Pour commander : touchez **Chambre** (ou **Table** / **À emporter**), touchez les plats demandés, puis touchez le gros bouton d’envoi en bas à droite.
2. En cuisine, le cuisinier touche une nouvelle commande, appuie sur **« Oui, tout est là »** puis sur le temps (**15 min**, **20 min**…), et enfin sur **« Marquer prête »**.
3. Si un produit manque en cuisine, le cuisinier touche **« Il manque un plat »** et coche le plat ; à l’accueil on le remplace depuis la ligne rouge.
4. Quand la ligne devient verte **« Prête à servir »**, on apporte le plat au client puis on appuie sur **« Marquer servi »**.
5. Pour un client sans chambre qui règle à la fin, on appuie sur **« Encaisser »** sur sa ligne et on choisit comment il paie (Espèces, Wave ou Orange Money).

### Ce qui doit être évident sans explication
- **États vides guidés :** *« Aucune commande en cours pour ce service — choisissez un plat à gauche pour commencer »* et en cuisine *« Tout est calme, les nouvelles commandes s’afficheront ici toutes seules »*.
- **Messages d'erreur humains :** pas de codes HTTP ni de jargon (*« Impossible de facturer une chambre sans client enregistré à l’accueil »* au lieu de messages techniques).
- **Boutons impossibles à confondre :** une seule action bleue/verte mise en avant à chaque étape, jamais deux boutons qui font presque la même chose côte à côte.

---

## H. Questions ouvertes (décisions métier pour la patronne)

1. **Règle d’autorisation avant service :** souhaitez-vous garder deux étapes quand un plat est prêt (1. la réception vérifie et « autorise », 2. le serveur marque « servi ») ou un seul bouton **« Marquer servi »** suffit-il ? *(Option par défaut conseillée : 1 seul bouton « Marquer servi »)*
2. **Annulation par un assistant / serveur :** un serveur du restaurant a-t-il le droit d’annuler tout seul une commande envoyée par erreur **tant que le cuisinier n’a pas commencé la préparation**, ou faut-il toujours appeler la Réception / Direction ? *(Option par défaut conseillée : autorisé tant que le cuisinier n’a pas encore accepté la commande)*
3. **Boissons et produits déjà prêts au bar :** faut-il envoyer une bouteille d’eau ou un jus déjà servi au comptoir sur l’écran du cuisinier, ou seulement les plats à préparer ? *(Option par défaut conseillée : ne pas envoyer les boissons froides servies directement au bar)*
4. **Clients en table qui paient à la fin vs à emporter :** pour les clients sur table, paient-ils généralement après avoir mangé ? *(Option par défaut conseillée : autoriser les deux, « Envoyer en cuisine » puis « Encaisser » après le repas)*
5. **TVA sur la carte :** les prix affichés sur la carte du restaurant sont-ils toujours « tout compris » tels quels pour le client ? *(Option par défaut conseillée : oui, afficher simplement « Total » en FCFA entier sans parler de HT/TTC au comptoir)*
