# Design & Maquettes ASCII — Facturation V3 (`apps/web/src/app/facturation-v3/`)

> **Règle d'or :** Interface en rupture totale avec l'ancien module. Tout est visible d'emblée : **0 menu caché (`⋯`)**, **0 onglet**, **0 tiroir latéral**, **0 accordéon**, **0 action visible uniquement au survol**, **0 scroll horizontal** (`360 px`, `768 px`, `1024 px`, `1440 px`).

## Palette & Typographie communes
- **Fond principal :** `#f3fafe` (`bg-surface`)
- **Cartes / surfaces actives :** `#ffffff` (`bg-surface-container-lowest`), bordure `#bdc9ca` (`border-outline-variant`)
- **Primaire (actions, progression, liens actifs) :** `#00666f` (`text-primary`, `bg-primary`), hover `#00818c`
- **Texte principal :** `#161d20` (`text-on-surface`, contraste ≥ 12:1 sur blanc)
- **Texte secondaire :** `#3d494a` (`text-on-surface-variant`, contraste ≥ 7:1 sur blanc)
- **Alerte / Solde dû / Erreur :** `#ba1a1a` (`text-error`), fond `#ffdad6`
- **Polices :** `Newsreader` pour les grands titres & montants clés, `Manrope` pour l'interface & les libellés (chargées en local)
- **Grilles & défilement :** `grid-template-columns: repeat(N, minmax(0, 1fr))`, `overflow-wrap: anywhere`, aucun `overflow-x: auto`, boutons `>= 40 px` de haut.

---

## ÉCRAN 1 : LE COMPTOIR (`/facturation`)

### Version Ordinateur (`≥ 1024 px`)

```text
+----------------------------------------------------------------------------------+
| Facturation                                                                      |
| [🔍 Rechercher : n° facture, nom du client, chambre...                    (/) ] |
+----------------------------------------------------------------------------------+
| [ À encaisser      ] [ Encaissé aujourd'hui ] [ Notes impayées ] [ Départs auj.] |
| [ 245 000 FCFA     ] [ 180 000 FCFA         ] [ 4 notes        ] [ 2 départs   ] |
+----------------------------------------------------------------------------------+
| CAISSE DU JOUR                          [ Exporter clôture PDF ] [ Clôture XLSX ]|
| [Espèces: 45 000] [Orange Money: 35 000] [Wave: 75 000] [Carte: 25 000] [Vir: 0] |
+----------------------------------------------------------------------------------+
| À RÉGLER (1/3)           | PARTIELLEMENT PAYÉES (1/3) | SOLDÉES (1/3)            |
| +----------------------+ | +------------------------+ | +----------------------+ |
| | Note ouverte  Ch.102 | | | Note ouverte    Ch.201 | | | FA-2026-0008  Ch.301 | |
| | Awa Sene             | | | Mamadou Diop           | | | Moussa Fall          | |
| | 12/11 -> 14/11       | | | 11/11 -> 13/11         | | | 10/11 -> 12/11       | |
| | Total : 70 000 FCFA  | | | Total : 120 000 FCFA   | | | Total : 190 000 FCFA | |
| | RESTE : 70 000 FCFA  | | | RESTE :  70 000 FCFA   | | | RESTE :      0 FCFA  | |
| | [          0%      ] | | | [====>     42%       ] | | | [============ 100% ] | |
| | [Ouvrir] [Encaisser] | | | [Ouvrir]   [Encaisser] | | | [Ouvrir] [Encaisser] | |
| +----------------------+ | +------------------------+ | +----------------------+ |
| ... (max 8 cartes)       | ... (max 8 cartes)         | ... (max 8 cartes)       |
| [     Voir plus (8)    ] | [      Voir plus (8)     ] | [     Voir plus (8)    ] |
+----------------------------------------------------------------------------------+
```

### Version Mobile (`360 px` – `< 900 px`)

```text
+-----------------------------------+
| Facturation                       |
| [🔍 N° facture, client, ch...  ]  |
+-----------------------------------+
| [ À encaisser  ] [ Encaissé auj.] |
| [ 245 000 FCFA ] [ 180 000 FCFA ] |
| [ Notes impay. ] [ Départs auj. ] |
| [ 4 notes      ] [ 2 départs    ] |
+-----------------------------------+
| CAISSE DU JOUR                    |
| [Espèces: 45k] [OM: 35k]          |
| [Wave: 75k]    [Carte: 25k]       |
| [Virement: 0 FCFA]                |
| [ Clôture PDF ] [ Clôture Excel ] |
+-----------------------------------+
| == À RÉGLER ===================== |
| +-------------------------------+ |
| | Note ouverte        Ch. 102   | |
| | Awa Sene (12/11 -> 14/11)     | |
| | Total : 70 000 FCFA           | |
| | RESTE : 70 000 FCFA           | |
| | [                0%         ] | |
| | [  Ouvrir  ] [  Encaisser   ] | |
| +-------------------------------+ |
| [       Voir plus (lot de 8)    ] |
| == PARTIELLEMENT PAYÉES ========= |
| ... (cartes empilées)             |
| == SOLDÉES ====================== |
| ... (cartes empilées)             |
+-----------------------------------+
```

---

## ÉCRAN 2 : LA NOTE DU SÉJOUR (`/facturation/:id`)

### Version Ordinateur (`≥ 1024 px`) — Grille 12 colonnes (`7/12` gauche + `5/12` droite fixe)

```text
+----------------------------------------------------------------------------------+
| [← Retour]  FA-2026-0008 (ou Note ouverte)  [PARTIEL]  Ch. 201 • Mamadou Diop    |
|             Séjour : 11/11/2026 -> 13/11/2026 (2 nuits, 2 adultes)               |
|             [ Télécharger PDF ] [ Imprimer ] [ Check-out ] [ Créer un avoir* ]   |
+----------------------------------------------------------------------------------+
| COLONNE GAUCHE (7/12) Ticket de caisse    | COLONNE DROITE (5/12, sticky)        |
|                                           |                                      |
| -- HÉBERGEMENT -------------------------+ | +----------------------------------+ |
| Nuitée Deluxe x2    55 000   110 000 F  | | | ENCAISSEMENT                     | |
| Sous-total Hébergement :     110 000 F  | | | RESTE À PAYER :                   | |
|                                         | | |   70 000 FCFA                    | |
| -- RESTAURANT --------------------------+ | |                                  | |
| Thiéboudienne x2     5 000    10 000 F  | | | Mode de paiement (5 boutons) :   | |
| Sous-total Restaurant :       10 000 F  | | | [Espèces] [Orange Money] [Wave]  | |
|                                         | | | [Carte]   [Virement]             | |
| -- PISCINE / BLANCHISSERIE / AUTRES ----+ | |                                  | |
| Pass Piscine x1      5 000     5 000 F  | | | Montant (FCFA) :                 | |
|                                         | | | [ 70000          ] [ Solder ]    | |
| == TOTAUX ==============================+ | | Référence transaction (OM/Wave): | |
| Sous-total HT     :          113 636 F  | | | [ WAV-2026-9981                ] | |
| Remise            :           -5 000 F  | | |                                  | |
| Service (taux)    :                0 F  | | | [         Encaisser            ] | |
| TVA (taux Param.) :           11 364 F  | | +----------------------------------+ |
| Taxe de séjour    :            4 000 F  | |                                      | |
| TOTAL TTC         :          124 000 F  | | -- HISTORIQUE DES PAIEMENTS -------+ |
|                                         | | 12/11 09:15 • Wave • 50 000 FCFA   | |
| -- AJOUTER UNE LIGNE (si note ouverte) -+ | | Réf: WAV-01 • Fatou Sow (RÉC.)   | |
| Libellé : [                          ]  | | [Annuler (écriture inverse) - DIR] | |
| Catég.  : [Héberg|Resto|Pisc|Blan|Autr] | +----------------------------------+ |
| Qté [1]  Prix FCFA [      ] [Ajouter]   |                                      |
+----------------------------------------------------------------------------------+
```

### Version Mobile (`360 px` – `< 1024 px`)

```text
+-----------------------------------+
| [← Retour] Note ouverte [PARTIEL] |
| Mamadou Diop • Ch. 201            |
| 11/11/2026 -> 13/11/2026          |
| [PDF] [Imprimer] [Check-out]      |
+-----------------------------------+
| -- HÉBERGEMENT ------------------ |
| Nuitée Deluxe x2       110 000 F  |
| -- RESTAURANT ------------------- |
| Thiéboudienne x2        10 000 F  |
| -- TOTAUX ----------------------- |
| Sous-total HT / Service / TVA     |
| Taxe de séjour / TOTAL TTC        |
| -- AJOUTER UNE LIGNE ------------ |
| [Libellé] [Cat] [Qté] [Prix]      |
| [ Ajouter la ligne ]              |
| -- ENCAISSEMENT (#encaissement) - |
| Reste : 70 000 FCFA               |
| [Espèces] [OM] [Wave] [Carte][Vir]|
| [ Montant ] [Solder] [Référence]  |
| [ Encaisser ]                     |
| -- HISTORIQUE PAIEMENTS --------- |
| ...                               |
+-----------------------------------+
| BARRE FIXE BAS MOBILE :           |
| Reste: 70 000 F | [ Encaisser ↑ ] |
+-----------------------------------+
```
