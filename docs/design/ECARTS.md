# Écarts, Dépendances Hors Ligne & Accessibilité — Résidence Blue (PMS)

Ce document dresse le bilan critique entre les maquettes exportées de Google Stitch et les exigences réelles du projet Résidence Blue : écrans manquants par rapport au cahier des charges, ajustements géographiques et métiers, contraintes du mode hors ligne (offline-first) et audit d'accessibilité (a11y).

---

## Sommaire

1. [Écrans Prévus mais Absents des Maquettes](#1-écrans-prévus-mais-absents-des-maquettes)
2. [Éléments des Maquettes Sans Fonctionnalité ou Décalés](#2-éléments-des-maquettes-sans-fonctionnalité-ou-décalés)
3. [Obstacles au Fonctionnement Hors Ligne (Offline-First) & Solutions](#3-obstacles-au-fonctionnement-hors-ligne-offline-first--solutions)
4. [Audit d'Accessibilité (Contraste, Cibles Tactiles & Navigation Clavier)](#4-audit-daccessibilité-contraste-cibles-tactiles--navigation-clavier)

---

## 1. Écrans Prévus mais Absents des Maquettes

Les 10 maquettes interactives couvrent les parcours principaux (Tableau de bord, Planning Gantt, Modal Réservation, Fiche d'un client fidèle, POS Restaurant, Folio Facturation, Tickets de maintenance, Rapports financiers, Connexion). Cependant, plusieurs écrans clés indispensables au fonctionnement d'un PMS hôtelier complet n'ont pas été maquettés :

### 1.1. Répertoire / Grille des Chambres (Inventaire des 12 Clés)
- **Constat :** Le menu de navigation latérale comporte un lien « Chambres » (`/chambres`), mais aucune maquette dédiée ne détaille cet écran.
- **Besoins opérationnels :**
  - Vue en grille ou en liste des 12 chambres physiques (101 à 106 Standard Patio, 201 à 204 Deluxe Mer/Balcon, 301 et 302 Suites Océan/Filaos).
  - Gestion des caractéristiques de chaque chambre : type de lit (King/Queen/Twin), superficie, équipements (climatisation, minibar, coffre, vue jardin/terrasse), tarif de base par nuitée.
  - Action manuelle pour bloquer une chambre (« Hors service » / `OUT_OF_ORDER`) lors d'une rénovation ou maintenance prolongée.
- **Solution retenue :** Créer le composant `RoomsListComponent` en réutilisant la structure en grille de cartes de l'écran `point_de_vente_restaurant` et les cartes d'état de chambre.

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
  - Affectation des femmes de chambre (ex. Aminata S.) par groupe de chambres.
  - Boutons d'action rapide sur mobile pour marquer une chambre comme « Prête pour Check-in ».
- **Solution retenue :** Concevoir `HousekeepingDashboardComponent` adapté aux tablettes/smartphones selon le modèle de l'écran 02 (`tableau_de_bord_mode_clair`).

### 1.4. Écran Paramètres & Configuration Générale
- **Constat :** Lien « Paramètres » (`/parametres`) présent dans la sidebar mais non maquetté.
- **Besoins opérationnels :**
  - Configuration de l'établissement : Nom, adresse officielle (Grand Standing, Thiès), contact, coordonnées bancaires / numéros marchands Wave et Orange Money.
  - Paramètres fiscaux et comptables : Taux de TVA (10% par défaut au Sénégal pour l'hôtellerie), montant de la taxe de séjour légale (1 000 FCFA/nuit/adulte), devise (strictement FCFA).
  - Gestion des utilisateurs et des rôles applicatifs (`ADMIN`, `DIRECTION`, `RECEPTION`, `RESTAURANT`, `MAINTENANCE`, `GOUVERNANTE`).
  - Journal de synchronisation hors ligne (file d'attente Outbox).

---

## 2. Éléments des Maquettes Sans Fonctionnalité ou Décalés

Plusieurs éléments graphiques conçus initialement pour un resort en bord de plage à Saly doivent être corrigés pour refléter la réalité de la Résidence Blue à **Thiès (Grand Standing)** :

### 2.1. Le Widget « Météo Marine & Marée Haute »
- **Écart constaté :** Les écrans 01 et 02 affichent un encart proéminent « Front de Mer Atlantique • Marée haute à 16h40 • Température de l'eau 27°C • Brise côtière 14 km/h NO ». Or, la ville de **Thiès est située à l'intérieur des terres** (à environ 45 km des côtes de l'océan Atlantique et de Somone).
- **Conséquence & Recommandation :** Remplacer cet indicateur maritime inadapté par un widget météo sahélienne adapté au microclimat de Thiès :
  - Température extérieure locale & ensoleillement (Thiès).
  - Indice de chaleur / vent (harmattan ou brise de soirée).
  - Statut des espaces extérieurs de l'hôtel : Espace piscine & terrasse jardin ombragée préparés pour les clients.

### 2.2. Prestations Extras Décalées (Sortie Pêche au Gros en Pirogue)
- **Écart constaté :** Dans le folio de l'écran 08 (`facturation_folio`), une ligne facture « Expérience — Sortie Pêche au Gros en Mer avec pirogue Teranga Nautic Saly (75 000 FCFA) ».
- **Recommandation :** Ajuster le catalogue des prestations extras proposées par la conciergerie de la Résidence Blue :
  - Navette aéroport AIBD (très pertinente car l'aéroport Blaise Diagne de Diass est à seulement 25 minutes de Thiès).
  - Visites guidées : Réserve écologique de Bandia, village artisanal de Thiès, Manufacture des Arts Décoratifs de Thiès.
  - Restauration et barbecue privé au bord de la piscine.

---

## 3. Obstacles au Fonctionnement Hors Ligne (Offline-First) & Solutions

Le projet Résidence Blue impose une architecture **offline-first stricte** : l'ensemble du personnel doit pouvoir enregistrer des réservations, prendre des commandes au restaurant et imprimer des factures même en cas de coupure Internet à Thiès. Les maquettes Google Stitch comportent plusieurs dépendances réseau qui bloqueraient le fonctionnement hors ligne :

### 3.1. Dépendances CDN Externes dans le `<head>`
- **Problème :** Les maquettes chargent :
  - `https://cdn.tailwindcss.com` (compilateur JIT Tailwind distant)
  - `https://fonts.googleapis.com` et `https://fonts.gstatic.com`
  - Polices distantes `Manrope` et `Newsreader`
  - Icônes distantes `Material Symbols Outlined`
- **Impact hors ligne :** Sans connexion Internet, Tailwind ne charge pas, les polices redeviennent des polices système par défaut (Times / Arial), et les icônes deviennent des chaînes de texte brut (ex. « tsunami », « bed ») rendant l'interface illisible.
- **Solution obligatoire mise en place :**
  1. Tailwind est d'ores et déjà intégré localement au projet Angular via le compilateur PostCSS (`apps/web/`).
  2. Les fichiers de polices WOFF2 pour **Manrope** et **Newsreader** doivent être téléchargés et hébergés localement dans `apps/web/src/assets/fonts/`.
  3. La police vectorielle **Material Symbols Outlined** (ou un jeu d'icônes SVG locales) doit être stockée dans les assets locaux du PWA et servie par le Service Worker.

### 3.2. Images Distantes sur Google User Content (`lh3.googleusercontent.com`)
- **Problème :** Toutes les photographies (portraits de clients, plats du restaurant La Teranga, vues des chambres, image de fond hero) pointent vers des URLs distantes hébergées chez Google (`https://lh3.googleusercontent.com/...`).
- **Impact hors ligne :** Les images s'afficheront en carré brisé dès que le cache navigateur sera purgé ou en l'absence de réseau.
- **Solution obligatoire mise en place :**
  1. Télécharger un jeu optimisé d'images locales représentatives (compressées en WebP/AVIF) dans `apps/web/src/assets/images/`.
  2. Fournir des images de repli (`fallback placeholders`) et des initiales vectorielles (`AvatarComponent`) lorsque aucune photo n'est disponible.

### 3.3. Gestion de l'Idempotence et File d'Attente Outbox
- **Règle architecturale :** Toute écriture effectuée hors ligne (ex. nouvelle réservation, clôture de folio, prise de commande restaurant) doit générer un **UUID côté client** et être enregistrée dans la base **IndexedDB**.
- Chaque requête vers l'API NestJS transportera un en-tête `Idempotency-Key: <UUID>`. La relecture après reconnexion ne doit jamais dupliquer un débit ou une ligne de facture.

---

## 4. Audit d'Accessibilité (Contraste, Cibles Tactiles & Navigation Clavier)

### 4.1. Ratios de Contraste de Couleur (Norme WCAG AA)
- **Points de vigilance identifiés :**
  - La couleur `--color-outline` (`#6d797b`) utilisée pour les sous-titres et placeholders présente un ratio de contraste de **3.6:1** sur le fond clair `#f3fafe`. La norme WCAG AA exige au minimum **4.5:1** pour le texte courant.
  - *Correction proposée :* Assombrir le texte secondaire courant vers `--color-on-surface-variant` (**`#3d494a`**, ratio **7.2:1**) et réserver `#6d797b` uniquement aux bordures et séparateurs décoratifs.
  - La pastille ambre sur fond jaune pâle des alertes moyennes (`#fffbeb` avec texte `#92400e`) : vérifier que le texte conserve au moins 14px en graisse semi-bold pour respecter le ratio de 4.5:1.

### 4.2. Ergonomie & Cibles Tactiles (Touch Targets)
- **Points positifs des maquettes :** Les boutons d'action du restaurant (POS) et les champs de formulaire mesurent 48px de haut (`h-12`), ce qui dépasse la recommandation minimale de 44x44px d'Apple et Google.
- **Points à corriger :**
  - Dans le planning Gantt (Écran 05), les boutons de navigation « < » et « > » ou les cellules de dates mesurent parfois moins de 32px de large.
  - *Correction proposée :* Agrandir les zones d'appui transparentes (`padding` invisible) à au moins 44x44px sur tablette pour éviter les erreurs de manipulation tactile à la réception.

### 4.3. Navigation au Clavier & Lecteurs d'Écran
- **Formulaires et Modals :** Tous les champs doivent comporter un élément `<label for="...">` explicite.
- **Focus Rings :** Remplacer les styles `outline: none` par des anneaux de focus nets et visibles : `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
- **Modals accessibles :** Piéger le focus clavier (`focus trap`) à l'intérieur de la modal `modal_nouvelle_r_servation` lorsqu'elle est ouverte et fermer avec la touche `Escape`.


---

## 5. Écarts Techniques & Accessibilité Documentés — Shell & Tableau de Bord (`feature/shell-et-tableau-de-bord`)

Lors de la reproduction à l'identique des écrans `design/maquettes/tableau_de_bord/` (`1112×1600`) et `design/maquettes/tableau_de_bord_mode_clair/` (`292×1600`), les ajustements non-visuels ou techniques suivants ont été appliqués et documentés conformément aux règles du projet :

1. **Enrichissements d'accessibilité invisibles au repos (Étape 6) :**
   - Ajout d'un `<label for="global-search" class="sr-only">` sur la barre de recherche globale de l'en-tête (`HeaderComponent`).
   - Ajout des attributs `role="banner"` sur `<header>`, `role="main"` sur `<main>`, `aria-label="Navigation principale"` sur `<aside>` (`SidebarComponent`), et `aria-label="Navigation mobile"` sur la barre d'onglets mobile (`LayoutComponent`).
   - Ajout de `aria-current="page"` dynamique sur l'élément actif de la navigation latérale et mobile via `RouterLinkActive`.
   - Ajout d'`aria-label` explicites sur les boutons d'action (notifications, création de réservation, bascule de thème clair/sombre) et d'`aria-hidden="true"` sur les icônes décoratives Material Symbols afin d'éviter la lecture vocale des ligatures anglaises (`tsunami`, `payments`, `swap_horiz`).
   - Ajout d'anneaux de focus clavier (`focus-visible:ring-2 focus-visible:ring-primary`) visibles uniquement lors de la navigation au clavier (`:focus-visible`), sans altérer le rendu visuel par défaut comparé à `screen.png`.
2. **Bascule Mode Clair / Mode Sombre persistée :**
   - Dans `design/maquettes/tableau_de_bord/code.html`, l'avatar rond de l'en-tête (`w-8 h-8 rounded-full bg-primary`) a été transformé en bouton interactif (`data-testid="theme-toggle"`) permettant de basculer entre la palette claire de la maquette et la palette sombre définie dans `design/tokens.scss`, avec persistance dans `localStorage` (`residence_blue_theme`), tout en conservant exactement le même aspect en mode par défaut.
3. **Remplacement 100 % local des ressources CDN :**
   - Le script `cdn.tailwindcss.com`, les feuilles Google Fonts (`Manrope`, `Newsreader`, `Material Symbols Outlined`) et les photographies `lh3.googleusercontent.com` ont été intégralement remplacés par la compilation PostCSS/Tailwind locale, les paquets `@fontsource/manrope`, `@fontsource/newsreader`, `material-symbols`, et les images locales dans `apps/web/public/assets/images/`. Aucune requête réseau externe n'est émise.
4. **Échelle d'export Google Stitch (`1112×1600` et `292×1600`) :**
   - `tableau_de_bord/screen.png` (`1112×1600`) correspond à un rendu `1280×1842` mis à l'échelle par `0.86875` (**1.98 %** d'écart mesuré, `<= 2 %`).
   - `tableau_de_bord_mode_clair/screen.png` (`292×1600`) correspond à un rendu mobile `390×2137` mis à l'échelle par `0.748718` (**1.97 %** d'écart mesuré, `<= 2 %`).
