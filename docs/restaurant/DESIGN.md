# DESIGN — Refonte Restaurant & Bar, Cuisine et Carte (`restaurant-v3/`)

## Principes directeurs (Saly / Thiès — Thème clair unique)
- **Zéro élément caché :** aucun menu `⋯`, onglet, tiroir ou accordéon. Tout est visible à l'écran.
- **Zéro défilement horizontal :** à `360 px`, `768 px`, `1024 px` et `1440 px` (`scrollWidth <= clientWidth`). Les barres de catégories et de boutons passent proprement à la ligne (`flex-wrap`).
- **Palette commune :** fond `#f8fafb`, cartes `#ffffff` bordées `#d6e2e4`, encre `#161d20` / `#3d494a`, primaire `#006875`, états `#b81d1d` (rouge urgence/erreur), `#925300` (ambre préparation), `#116b41` (vert prête/disponible).
- **Contrastes ≥ 4,5:1**, boutons ≥ `40 px` de hauteur, libellés sur une ligne (`whitespace-nowrap`), aucun nom de produit tronqué.
- **Accessibilité clavier :** navigation `Tab`, validation `Entrée`, fermeture/annulation `Échap` (dialogue inline d'annulation / retrait).

---

## ÉCRAN 1 : Prise de commande (`/restaurant`)

### Version Ordinateur (`≥ 1024 px`)
```text
+---------------------------------------------------------------------------------------------------+
| [EN-TÊTE APP]  Restaurant & Bar — La Teranga        [Liens: Cuisine (/cuisine) | Carte (/carte)*] |
+---------------------------------------------------------------------------------------------------+
| Filtres visibles (retour à la ligne automatique, 0 scroll H)                                       |
| [Toutes] [Plats sénégalais & Mer] [Boissons & Cocktails] [Desserts] ...   [🔍 Rechercher un plat ] |
+------------------------------------------------------------------+--------------------------------+
| ZONE GAUCHE (8/12) — Grille de produits (scroll interne visible) | ZONE DROITE (4/12, fixe)       |
| overflow-y: scroll | scrollbar-gutter: stable | barre 12px       | TICKET EN COURS                |
| +-------------------+ +-------------------+ +------------------+ | Destination :                  |
| | Thiéboudienne     | | Yassa Poulet      | | Poisson Grillé   | | [Chambre] [Table] [À emporter] |
| | Royale            | | Fermier           | | du Jour          | | Chambre: [102 - Amadou Ba  v]  |
| |     4 500 FCFA    | |     4 000 FCFA    | | [Épuisé]         | |   (ou N° Table: [T4        ])  |
| +-------------------+ +-------------------+ +------------------+ |--------------------------------|
| +-------------------+ +-------------------+ +------------------+ | - Thiéboudienne Royale         |
| | Jus de Bissap     | | Mafé de Bœuf      | | Cocktail Saloum  | |   [-] 1 [+]  4 500 F  [Retirer]|
| | Maison            | | Fondant           | | Sunset           | |   Note: [Sans piment         ] |
| |     1 500 FCFA    | |     4 500 FCFA    | |     3 500 FCFA   | | - Jus de Bissap Maison         |
| +-------------------+ +-------------------+ +------------------+ |   [-] 2 [+]  3 000 F  [Retirer]|
| (défilement vertical interne uniquement, aucune photo)           |--------------------------------|
|                                                                  | TOTAL TTC :      7 500 FCFA    |
|                                                                  | [     Envoyer en cuisine     ] |
|                                                                  | [    Mettre sur la chambre   ] |
|                                                                  |  (ou Mode + Réf + [Encaisser]) |
+------------------------------------------------------------------+--------------------------------+
| COMMANDES DU SERVICE (hauteur max 10 lignes, défilement vertical interne visible, lots de 50)    |
|---------------------------------------------------------------------------------------------------|
| N°          | Destination      | Client             | Total       | État           | Heure | Act. |
| #CMD-...-01 | Ch. 102          | Amadou Ba          |  6 000 FCFA | En attente     | 12:14 | [S][A]|
| #CMD-...-02 | Table T4         | Client de passage  |  4 500 FCFA | En préparation | 12:19 | [S][A]|
| #CMD-...-03 | À emporter       | Client de passage  |  1 500 FCFA | Prête          | 12:22 | [S][A]|
|                                                  ... (chargement auto lot 50 suivant en bas)     |
| 10 sur 58 commandes                                                                               |
+---------------------------------------------------------------------------------------------------+
* Lien « Carte (/restaurant/carte) » visible pour DIRECTION ; bouton « Annuler » ([A]) réservé à DIRECTION / RECEPTION.
```

### Version Mobile (`360 px` – `767 px`, une colonne)
```text
+--------------------------------------+
| Restaurant & Bar — La Teranga        |
| [Cuisine] [Carte*]                   |
+--------------------------------------+
| [Toutes] [Plats] [Boissons] ...      |
| [🔍 Rechercher un produit...       ] |
+--------------------------------------+
| GRILLE PRODUITS (scroll vertical)    |
| +----------------------------------+ |
| | Thiéboudienne Royale   4 500 FCFA| |
| +----------------------------------+ |
| | Poisson Grillé [Épuisé]          | |
| +----------------------------------+ |
+--------------------------------------+
| #ticket-section : TICKET EN COURS    |
| [Chambre] [Table] [À emporter]       |
| Chambre / Table / Lignes / Actions   |
+--------------------------------------+
| COMMANDES DU SERVICE (cartes         |
| compactes en zone scroll interne     |
| hauteur max 10 lignes équivalent)    |
+--------------------------------------+
| BARRE FIXE BAS (> nav mobile)        |
| Total : 7 500 FCFA  [Voir le ticket] |
+--------------------------------------+
```

---

## ÉCRAN 2 : Cuisine (`/cuisine`, pensé pour tablette)

### Version Tablette / Ordinateur (`≥ 900 px`, 3 colonnes égales `minmax(0, 1fr)`)
```text
+---------------------------------------------------------------------------------------------------+
| Cuisine — La Teranga   [Flux temps réel SSE actif / Secours 10 s]   [Retour Prise de commande]    |
+---------------------------------+---------------------------------+-------------------------------+
| EN ATTENTE (N)                  | EN PRÉPARATION (N)              | PRÊTES (N)                    |
| (scroll vertical interne)       | (scroll vertical interne)       | (scroll vertical interne)     |
| +-----------------------------+ | +-----------------------------+ | +---------------------------+ |
| | #CMD-2026-0001       12:01  | | | #CMD-2026-0002       12:18  | | | #CMD-2026-0003     12:24  | |
| | Ch. 102 • Amadou Ba         | | | Table T4                    | | | À emporter                | |
| | ⏱ 18 min (ROUGE > 15 min)   | | | ⏱ 6 min                     | | | ⏱ 2 min                   | |
| | • 2× Thiéboudienne Royale   | | | • 1× Yassa Poulet Fermier   | | | • 1× Jus de Bissap Maison | |
| |   Note: Sans piment         | | |                             | | |                           | |
| | • 1× Jus de Bissap Maison   | | |                             | | |                           | |
| | [  Passer en préparation  ] | | | [     Marquer prête       ] | | | [     Marquer servie     ]  | |
| +-----------------------------+ | +-----------------------------+ | +---------------------------+ |
|  (AUCUN MONTANT AFFICHÉ)        |  (AUCUN MONTANT AFFICHÉ)        |  (AUCUN MONTANT AFFICHÉ)    |
+---------------------------------+---------------------------------+-------------------------------+
```
Sous `900 px` : les 3 colonnes s'empilent en `grid-template-columns: minmax(0, 1fr)` sans aucun débordement horizontal.

---

## ÉCRAN 3 : Carte (`/restaurant/carte`, réservé à `DIRECTION`)

### Version Ordinateur (`≥ 1024 px`) & Mobile (`< 768 px` en cartes empilées)
```text
+---------------------------------------------------------------------------------------------------+
| Carte du Restaurant & Bar (DIRECTION)          [← Retour POS]              [+ Nouveau produit]    |
+---------------------------------------------------------------------------------------------------+
| Rechercher : [_________________________]   Catégorie : [Toutes v]   Statut : [Tous actifs v]      |
+---------------------------------------------------------------------------------------------------+
| FORMULAIRE PLEINE PAGE (+ Nouveau produit / Modifier un produit, visible directement quand ouvert) |
| Nom : [____________________]  Catégorie : [Existant v] ou Nouvelle : [____________________]      |
| Prix (FCFA entier) : [______]  Disponible : [☑ Disponible]  Station : [CUISINE v]                |
| Photo (JPEG/PNG/WebP ≤ 2 Mo) : [Choisir fichier] [Miniature 200px]   [Enregistrer] [Annuler]     |
+---------------------------------------------------------------------------------------------------+
| TABLEAU CARTE (scroll vertical interne visible)                                                   |
| Photo | Produit              | Catégorie           | Prix      | État / Actions                    |
| [200] | Thiéboudienne Royale | Plats sénégalais... | 4 500 F   | [Disponible/Épuisé] [Mod] [Désact]|
| [ - ] | Poisson Grillé       | Plats sénégalais... | 6 000 F   | [Épuisé/Dispo]      [Mod] [Désact]|
+---------------------------------------------------------------------------------------------------+
* Produit avec historique : suppression HTTP 409 avec message clair proposant « Désactiver ».
```
