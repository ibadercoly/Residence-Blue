# Écarts, Dépendances Hors Ligne & Accessibilité — Résidence Blue (PMS)

Ce document dresse le bilan critique entre les maquettes exportées de Google Stitch et les exigences réelles du projet Résidence Blue : écrans manquants par rapport au cahier des charges, ajustements géographiques et métiers, contraintes du mode hors ligne (offline-first), audit d'accessibilité (a11y), décalages de tokens graphiques et fonctionnalités visibles dans les maquettes mais non prévues initialement.

---

## Sommaire

1. [Écrans Prévus mais Absents des Maquettes](#1-écrans-prévus-mais-absents-des-maquettes)
2. [Éléments des Maquettes Sans Fonctionnalité ou Décalés](#2-éléments-des-maquettes-sans-fonctionnalité-ou-décalés)
3. [Obstacles au Fonctionnement Hors Ligne (Offline-First) & Solutions](#3-obstacles-au-fonctionnement-hors-ligne-offline-first--solutions)
4. [Audit d'Accessibilité (Contraste, Cibles Tactiles & Navigation Clavier)](#4-audit-daccessibilité-contraste-cibles-tactiles--navigation-clavier)
5. [Régularisations Techniques — Shell & Navigation](#5-régularisations-techniques--shell--navigation)
6. [Décalages de Tokens : DESIGN.md vs code.html (Source de Vérité)](#6-décalages-de-tokens--designmd-vs-codehtml-source-de-vérité)
7. [Fonctionnalités Visibles dans les Maquettes mais Absentes du Plan](#7-fonctionnalités-visibles-dans-les-maquettes-mais-absentes-du-plan)

---

## 1. Écrans Prévus mais Absents des Maquettes

Les 10 maquettes interactives couvrent les parcours principaux (Tableau de bord, Planning Gantt, Modal Réservation, Fiche d'un client fidèle, POS Restaurant, Folio Facturation, Tickets de maintenance, Rapports financiers, Connexion). Cependant, plusieurs écrans clés indispensables au fonctionnement d'un PMS hôtelier complet n'ont pas été maquettés :

### 1.1. Répertoire / Grille des Chambres (Inventaire des 12 Clés)
- **Constat :** Le menu de navigation latérale comporte un lien « Chambres » (`/chambres`), mais aucune maquette dédiée ne détaille cet écran.
- **Besoins opérationnels :**
  - Vue en grille ou en liste des 12 chambres physiques (101 à 106 Standard, 201 à 204 Deluxe, 301 et 302 Suite).
  - Gestion des caractéristiques de chaque chambre : type de lit, étage, statut (`FREE`, `OCCUPIED`, `CLEANING`, `MAINTENANCE`), équipements, tarif par nuitée en entier FCFA.
  - Action manuelle pour bloquer une chambre (« Maintenance ») ou déclarer le nettoyage terminé.
- **Solution retenue :** Composant `RoomsListComponent` / écran Chambres réutilisant les cartes bento et la charte graphique globale.

### 1.2. Annuaire / Liste Complète des Clients (Cardex Central)
- **Constat :** La maquette `fiche_profil_client_m._mamadou_diop` détaille la fiche individuelle d'un client, mais il n'existe pas d'écran pour la liste/annuaire des clients (`/clients`).
- **Besoins opérationnels :**
  - Tableau de tous les clients enregistrés avec recherche instantanée par nom, téléphone (+221...) ou numéro de passeport.
  - Filtres par segment (VIP Gold, Voyageurs d'affaires, Familles, Nouveaux clients).
  - Bouton « Créer une fiche client » indépendamment d'une réservation.
- **Solution retenue :** Concevoir `GuestsListComponent` basé sur le composant réutilisable `DataTableComponent` avec barre de recherche `SearchInputComponent`.

### 1.3. Module Dédié Housekeeping / Gouvernante
- **Constat :** Le menu comporte le lien « Housekeeping » (`/housekeeping`), et des alertes de ménage apparaissent sur le dashboard, mais il manque le tableau de service complet de la gouvernante.
- **Besoins opérationnels :**
  - Matrice d'état de propreté des 12 chambres : *Propre / Prête*, *À blanc (Départ)*, *Recouche (En séjour)*, *En cours de nettoyage*, *À inspecter*.
  - Affectation du personnel de ménage par groupe de chambres.
  - Boutons d'action rapide sur mobile pour marquer une chambre comme « Prête pour Check-in ».
- **Solution retenue :** Concevoir `HousekeepingDashboardComponent` adapté aux smartphones et tablettes selon le modèle de l'écran mobile `tableau_de_bord_mode_clair`.

### 1.4. Écran Paramètres & Configuration Générale
- **Constat :** Lien « Paramètres » (`/parametres`) présent dans la sidebar mais non maquetté.
- **Besoins opérationnels :**
  - Configuration de l'établissement : Nom, adresse officielle (Grand Standing, Thiès), contact, coordonnées marchands Wave et Orange Money.
  - Paramètres fiscaux et comptables : Taux de TVA (10 % par défaut au Sénégal pour l'hôtellerie), montant de la taxe de séjour légale (1 000 FCFA/nuitée/personne), devise (strictement FCFA entiers).
  - Gestion des utilisateurs et des rôles applicatifs (`ADMIN`, `DIRECTION`, `RECEPTION`, `RESTAURANT`, `MAINTENANCE`, `HOUSEKEEPING`).
  - Journal de synchronisation hors ligne (file d'attente Outbox).

### 1.5. Formulaires et Modal de Gestion du Menu Restaurant
- **Constat :** Aucune maquette Google Stitch n'existe pour les formulaires de gestion administrative du menu (ajout de plat, modification, duplication, archivage, gestion des catégories, import/export CSV/Excel et téléversement de photos). Seule la vue opérationnelle de prise de commande caisse (`point_de_vente_restaurant_la_teranga`) a fait l'objet d'une maquette source.
- **Solution retenue :** Formulaires et tableaux de gestion intégrés dans le composant standard `ModalShellComponent` compact (largeur maximale 960 px, hauteur maximale 88 dvh, corps défilant, en-tête et pied fixes, plein écran sous 768 px). Réutilisation stricte et sans dérive des composants, couleurs, polices (`Manrope`, `Newsreader`), rayons et espacements du design system de l'hôtel.

### 1.6. Écran Exports & Rapports Officiels V1 (`/exports`)
- **Constat :** Aucune maquette source n'existe pour l'écran de téléchargement des exports certifiés (Facture séjour PDF, Feuille arrivées/départs PDF, État des chambres PDF, Clôture caisse Z PDF/Excel, Fichier clients Excel, Ventes restaurant et piscine Excel).
- **Solution retenue :** Écran épuré et ergonomique créé selon les mêmes composants, grille bento, palette pierre/bleu nuit `#135bec`, typographie `Manrope`, boutons d'action $\ge 44$ px et tableau d'audit des exports récents.

### 1.7. Écran Cuisine en Temps Réel (`/cuisine`)
- **Constat :** Aucune maquette source n'existe pour le poste de travail des cuisiniers et serveurs.
- **Solution retenue :** Interface plein écran tactile à fort contraste, adaptée aux conditions de travail en cuisine (bons de commande classés par poste : Cuisine, Bar, Pâtisserie avec horodatage et bouton de validation d'envoi en un clic).

---

## 2. Éléments des Maquettes Sans Fonctionnalité ou Décalés

Plusieurs éléments graphiques conçus initialement pour un resort balnéaire à Saly doivent être corrigés pour refléter la réalité de la Résidence Blue à **Thiès (Grand Standing)** (voir détail complet dans `docs/design/ADAPTATION-THIES.md`) :

### 2.1. Le Widget « Météo Marine & Marée Haute »
- **Écart constaté :** Les écrans 01 et 02 affichent un encart « Front de Mer Atlantique • Marée haute à 16h40 • Température de l'eau 27°C • Brise côtière 14 km/h NO ». Or, la ville de **Thiès est située à l'intérieur des terres** (à environ 45 km de l'océan).
- **Conséquence & Recommandation :** Remplacer cet indicateur maritime inadapté par un widget météo sahélienne adapté au microclimat de Thiès :
  - Température extérieure locale & ensoleillement (Thiès).
  - Indice de chaleur / vent (harmattan ou brise de soirée).
  - Statut des espaces extérieurs de l'hôtel : Espace piscine & terrasse jardin ombragée préparés pour les clients.

### 2.2. Prestations Extras Décalées (Sortie Pêche au Gros en Pirogue)
- **Écart constaté :** Dans le folio de l'écran 08 (`facturation_folio`), une ligne facture « Expérience — Sortie Pêche au Gros en Mer avec pirogue Teranga Nautic Saly (75 000 FCFA) ».
- **Recommandation :** Ajuster le catalogue des prestations extras proposées par la conciergerie de la Résidence Blue :
  - Navette aéroport AIBD (l'aéroport Blaise Diagne de Diass est à seulement 25 minutes de Thiès).
  - Visites guidées : Réserve écologique de Bandia, village artisanal de Thiès, Manufacture des Arts Décoratifs de Thiès.
  - Restauration et barbecue privé au bord de la piscine.

### 2.3. Dimensions et Compacité de la Fenêtre « Nouvelle réservation » (ModalShell)
- **Écart constaté :** La maquette originale `design/maquettes/modal_nouvelle_r_servation/` affiche une fenêtre de 1152 px de largeur et 942 px de hauteur. Sur des postes de réception et ordinateurs portables courants (résolutions 1366×768, 1280×720, 1024×768), cette fenêtre déborde largement de l'écran, masque le contexte du logiciel, et son bouton de validation (« Confirmer la réservation ») se retrouve enfoui sous la ligne de flottaison, obligeant l'utilisateur à scroller vers le bas à chaque réservation.
- **Décision d'architecture & Écart voulu :**
  - **Dimensions maîtrisées :** Largeur plafonnée à `min(960px, calc(100vw - 32px))` et hauteur plafonnée à `88dvh` (centrée verticalement et horizontalement). En dessous de 768 px (smartphones/tablettes portrait), la fenêtre devient une feuille plein écran avec en-tête fixe sans arrondi supérieur.
  - **Structure en 3 zones (composant réutilisable `ModalShellComponent`) :**
    1. *En-tête fixe* (~72 px) : Titre, badge 12 clés, sous-titre Thiès et croix de fermeture.
    2. *Corps défilant* (`overflow-y: auto`, `flex-1`) : Le défilement est confiné à l'intérieur de la modale ; le défilement de la page d'arrière-plan est strictement verrouillé (`body { overflow: hidden }`).
    3. *Pied fixe toujours visible* : Boutons « Annuler » et « Confirmer la réservation » avec affichage du Total TTC en direct. Le bouton de confirmation est visible immédiatement dès l'ouverture, sans aucun défilement.
  - **Compactage vertical (~30 % de réduction de hauteur) :**
    - Date d'arrivée, nombre de nuits et date de départ fusionnés sur une seule ligne.
    - Sélection des chambres en carrousel horizontal défilant.
    - Options regroupées en puces cliquables.

---

## 3. Obstacles au Fonctionnement Hors Ligne (Offline-First) & Solutions

1. **Génération d'identifiants côté client** : Toutes les nouvelles entités créées hors ligne (réservations, commandes, factures) utilisent un UUID v4 local unique pour éviter les collisions avec les clés auto-incrémentées de la base PostgreSQL.
2. **Idempotence des transactions (`Idempotency-Key`)** : Chaque opération envoyée dans la file d'attente (Outbox) porte un identifiant d'idempotence unique. En cas de coupure réseau ou de réessais multiples, le serveur élimine les doublons sans altérer l'état de la base.
3. **Purge sélective du cache IndexedDB** : Pour éviter l'asphyxie mémoire sur les postes clients, le magasin local ne conserve que l'horizon utile opérationnel (14 prochains jours de réservations, séjours en cours, carte complète du restaurant et les 100 dernières factures émises).

### 2.4. Refonte Ergonomique du Planning (Semaine 7 Jours sans Débordement Horizontal)
- **Écart constaté dans la maquette Stitch (`planning_des_r_servations.html`) :**
  - La maquette affiche une vue 14 jours qui force un débordement et scroll horizontal excessif.
  - L'écran est surchargé de widgets secondaires : bandeau d'alerte de conflit volumineux, suggestions de relogement, statistiques d'occupation complexes, légendes pléthoriques, filtres multiples d'horizon temporel (14J, Semaine, Mois) et infobulles lourdes.
- **Décision d'architecture & Écart voulu (V1 Légère) :**
  - **Zéro scroll horizontal** : Seul le scroll vertical est autorisé. Strictement aucun débordement horizontal (`scrollWidth <= clientWidth`) à toutes les résolutions (360 px, 768 px, 1024 px, 1440 px).
  - **Structure épurée de haut en bas** :
    1. En-tête : Titre « Planning » et bouton principal « + Nouvelle réservation ».
    2. Bande de 3 chiffres du jour : Arrivées aujourd'hui, Départs aujourd'hui, Chambres libres.
    3. Barre d'outils sur une seule ligne : Navigation de période (◀ Aujourd'hui ▶ avec libellé « 10 – 16 nov. 2026 »), recherche réactive et filtre unique (Toutes / Libres / Occupées).
    4. Grille principale 7 jours (CSS Grid `8rem repeat(7, minmax(0, 1fr))`) : 12 chambres, jour actuel surligné, week-end teinté, barres avec nom tronqué (« … »), 3 couleurs strictes (Confirmée, En séjour, Départ aujourd'hui), légende sous la grille, clic case vide pour réserver, clic barre pour détail.
    5. Panneau de détail (tiroir latéral droit sur desktop, fenêtre inférieure sur mobile) : 6 champs d'information stricts et 4 boutons uniques (Modifier, Prolonger, Check-in/Check-out, Annuler).
  - **Version mobile (< 768 px)** :
    - La grille disparaît au profit d'une liste verticale par jour avec sélecteur 7 pastilles et 3 sections (Arrivées, Départs, En séjour), avec bouton flottant « + Nouvelle réservation ».
  - **Report en V2** : Vue 14 jours, glisser-déposer, relogement automatique, statistiques avancées d'occupation.
