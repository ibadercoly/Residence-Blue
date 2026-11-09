# Inventaire des Composants Réutilisables Angular — Résidence Blue (PMS)

Ce document répertorie l'ensemble des composants d'interface utilisateur à développer sous forme de **Standalone Components Angular** (`standalone: true`, avec Angular Signals pour la réactivité). Ces composants seront factorisés et développés une seule fois pour être partagés à travers tous les écrans du logiciel.

---

## Sommaire

1. [Principes de Conception des Composants](#1-principes-de-conception-des-composants)
2. [Composants de Structure & Navigation (Shell)](#2-composants-de-structure--navigation-shell)
3. [Composants de Données & Métriques (Data Display)](#3-composants-de-données--métriques-data-display)
4. [Composants de Formulaires & Filtres (Form Controls)](#4-composants-de-formulaires--filtres-form-controls)
5. [Composants Métier Spécifiques (Domain Components)](#5-composants-métier-spécifiques-domain-components)
6. [Composants de Feedback, Modals & Notifications (Overlays)](#6-composants-de-feedback-modals--notifications-overlays)
7. [Matrice Croisée Composants ⇄ Écrans](#7-matrice-croisée-composants--écrans)

---

## 1. Principes de Conception des Composants

- **Architecture Angular Standalone :** Aucun NgModule. Chaque composant importe directement ses dépendances nécessaires (`CommonModule`, `RouterLink`, etc.).
- **Réactivité par Signals :** Les états internes et les entrées utilisent l'API moderne `input()`, `output()`, `computed()` et `signal()` d'Angular.
- **Design Atomic & Tokens :** Tous les styles référencent strictement les variables CSS de `design/tokens.scss`.
- **Offline-First & Ergonomie Tactile :** Toutes les cibles cliquables mesurent au minimum 44x44px (ou 48x48px pour les boutons de caisse) pour une utilisation fluide sur écran tactile (iPad, tablettes de réception).

---

## 2. Composants de Structure & Navigation (Shell)

### 2.1. `AppSidebarComponent`
- **Rôle :** Barre latérale fixe de navigation principale sur bureau (`w-64`, 256px), au fond sombre très contrasté (`bg-inverse-surface` `#2a3135`), inspirée directement de la maquette directrice `tableau_de_bord`.
- **Sous-éléments :**
  - Bloc identité : Logo vague cyan, nom « Résidence Blue », sous-titre « Grand Standing, Thiès ».
  - Menu vertical : Liens de navigation avec icône et libellé (Tableau de bord, Planning, Chambres, Clients, Restaurant, Housekeeping, Maintenance, Facturation, Rapports, Paramètres).
  - Indicateur de route active avec fond plein cyan (`bg-primary text-on-primary font-bold`).
  - Widget inférieur d'ambiance et météo locale.
- **Écrans l'utilisant :** Tous les écrans bureau (01, 05, 06, 07, 08, 09, 10).

### 2.2. `AppHeaderComponent`
- **Rôle :** En-tête supérieur fixe (`h-20`, 80px) avec effet de verre dépoli (`backdrop-blur-xl`).
- **Sous-éléments :**
  - Barre de recherche globale transversale (`QuickSearchInput`).
  - Bouton d'action primaire flottant « Nouvelle réservation ».
  - Bouton de notifications avec pastille dorée d'alerte.
  - Pastille d'état de synchronisation hors ligne (connecté / hors ligne / n opérations en attente).
  - Avatar et identité de l'utilisateur connecté avec rôle.
- **Écrans l'utilisant :** Tous les écrans bureau (01, 05, 06, 07, 08, 09, 10).

### 2.3. `MobileNavComponent`
- **Rôle :** Barre de navigation inférieure fixe (`h-16`, avec zone de sécurité `pb-safe`) pour smartphones et tablettes en mode portrait.
- **Sous-éléments :** 5 onglets tactiles avec icône et étiquette : Accueil, Planning, Chambres, Restaurant, Plus.
- **Écrans l'utilisant :** Écran 02 (`tableau_de_bord_mode_clair`), vue mobile du POS (07).

### 2.4. `BreadcrumbComponent`
- **Rôle :** Fil d'Ariane hiérarchique avec chevrons et liens de retour.
- **Écrans l'utilisant :** Écran 06 (`fiche_profil_client`), Écran 08 (`facturation_folio`).

---

## 3. Composants de Données & Métriques (Data Display)

### 3.1. `KpiCardComponent`
- **Rôle :** Carte statistique Bento pour l'affichage des métriques majeures.
- **Inputs :** `title: string`, `value: string | number`, `unit?: string`, `icon: string`, `trend?: { value: number, label: string }`, `subtext?: string`, `progressPercent?: number`, `variant?: 'primary' | 'secondary' | 'error' | 'surface'`.
- **Écrans l'utilisant :**
  - Écran 01 (`tableau_de_bord` - 4 cartes : Occupation, Chambres, Revenus, Mouvements)
  - Écran 02 (`tableau_de_bord_mode_clair` - 4 cartes mobiles)
  - Écran 09 (`maintenance` - 4 cartes : Tickets, SLA, Résolution)
  - Écran 10 (`rapports` - 4 cartes : CA, RevPAR, ADR, Occupation)

### 3.2. `StatusBadgeComponent` (Pill & Dot)
- **Rôle :** Pastille d'état compacte entièrement arrondie (`rounded-full`) avec puce colorée.
- **Variantes :**
  - `available` : Vert émeraude (Libre, Réalisé, Confirmé)
  - `occupied` : Rouge cramoisi (Occupée, Urgent, Alerte)
  - `cleaning` : Ambre doré (Ménage en cours, Recouche)
  - `maintenance` : Ardoise (Hors service, En panne)
  - `vip` : Or Teranga avec icône couronne / étoile
- **Écrans l'utilisant :** Tous les écrans (01, 02, 04, 05, 06, 07, 08, 09, 10).

### 3.3. `DataTableComponent`
- **Rôle :** Tableau de données générique, réactif, paginé et triable, stylisé avec les rayures douces du thème.
- **Fonctionnalités :** Lignes cliquables, sélection multiple, colonnes configurables, états vides intégrés.
- **Écrans l'utilisant :**
  - Écran 05 (`planning` - sous-tableaux)
  - Écran 06 (`fiche_profil_client` - historique des 4 séjours)
  - Écran 08 (`facturation_folio` - lignes de débit consommations)
  - Écran 09 (`maintenance` - liste des tickets)

### 3.4. `AvatarComponent`
- **Rôle :** Vignette circulaire affichant soit la photo du collaborateur/client, soit ses initiales sur fond coloré (ex. `MD` pour Mamadou Diop, `AB` pour Aïssatou Ba).
- **Écrans l'utilisant :** 01, 02, 03, 05, 06, 07, 09.

### 3.5. `BarChartWeeklyComponent`
- **Rôle :** Histogramme à 7 barres verticales représentant les revenus ou la fréquentation du Lundi au Dimanche avec infobulles au survol.
- **Écrans l'utilisant :** Écran 01 (`tableau_de_bord`), Écran 10 (`rapports`).

---

## 4. Composants de Formulaires & Filtres (Form Controls)

### 4.1. `ButtonComponent`
- **Rôle :** Bouton d'action universel ergonomique.
- **Variantes :** `primary` (cyan plein), `secondary` (or plein ou contour), `outline` (bordure fine), `ghost` (texte seul), `danger` (rouge).
- **Tailles :** `sm` (32px), `md` (40px), `lg` (48px - tactile standard).
- **États gérés :** Normal, survol, actif (clic), désactivé (`disabled`), chargement (`loading` avec spinner).
- **Écrans l'utilisant :** Absolument tous les écrans (01 à 10).

### 4.2. `SearchInputComponent`
- **Rôle :** Champ de recherche textuelle avec loupe intégrée et bouton d'effacement rapide (`x`).
- **Écrans l'utilisant :** 01 (Header), 05 (Tape Chart), 06 (Clients), 07 (POS Carte), 09 (Tickets).

### 4.3. `TextFieldComponent` & `SelectFieldComponent`
- **Rôle :** Champs de saisie texte, mot de passe, email et menus déroulants accessibles avec libellé flottant ou supérieur, message d'erreur de validation (ValidationPipe NestJS compatible) et icônes préfixe/suffixe.
- **Écrans l'utilisant :** 03 (Connexion), 04 (Modal réservation), 06 (Édition client), 08 (Caisse), 09 (Tickets).

### 4.4. `DateRangePickerComponent`
- **Rôle :** Sélecteur de dates double (Arrivée / Départ) avec calcul automatique du nombre de nuitées et mise en valeur des dates complètes.
- **Écrans l'utilisant :** 04 (Nouvelle résa), 05 (Planning), 10 (Rapports).

---

## 5. Composants Métier Spécifiques (Domain Components)

### 5.1. `GanttTimelineComponent` (Tape Chart 12 Clés)
- **Rôle :** Composant complexe représentant la grille des 12 chambres x N jours.
- **Fonctionnalités :**
  - Défilement horizontal fluide et colonne gauche des chambres figée (`sticky`).
  - Ligne supérieure temporelle avec mise en valeur de la colonne « Aujourd'hui ».
  - Blocs de réservation horizontaux calculés au pourcentage ou en grille CSS.
  - Événements `onSelectReservation(id)` et `onMoveReservation(id, newRoom, newDates)`.
- **Écrans l'utilisant :** Écran 05 (`planning_des_r_servations`).

### 5.2. `SplitPaymentGatewayComponent`
- **Rôle :** Module de règlement multicanal et ventilation comptable.
- **Fonctionnalités :**
  - Canaux supportés : Wave Sénégal, Orange Money, Carte Bancaire TPE, Espèces.
  - Calculatrice de rendu de monnaie intégrée pour les espèces (Montant reçu - Total = Monnaie à rendre).
  - Indicateur visuel d'équilibrage du solde (vert si ventilé == reste à régler, rouge sinon).
  - Case à cocher pour certification fiscale DGID.
- **Écrans l'utilisant :** Écran 08 (`facturation_folio_client_encaissement`), Écran 04 (`modal_nouvelle_r_servation` pour l'acompte).

### 5.3. `DishCardComponent`
- **Rôle :** Carte produit tactile pour le catalogue du restaurant « La Teranga ».
- **Fonctionnalités :** Photo gastronomique, badge spécialité, titre, description, prix en FCFA, bouton d'ajout direct au panier.
- **Écrans l'utilisant :** Écran 07 (`point_de_vente_restaurant_la_teranga`).

### 5.4. `TicketPanelComponent`
- **Rôle :** Volet de commande tactile du restaurant et bar.
- **Fonctionnalités :** Sélecteur Table/Chambre, sélection de la table (T1-T6), liaison avec le client hébergé, liste des articles avec steppers de quantité (+/-), bouton d'envoi cuisine KDS, bouton d'imputation sur la chambre.
- **Écrans l'utilisant :** Écran 07 (`point_de_vente_restaurant_la_teranga`).

### 5.5. `RoomCardComponent`
- **Rôle :** Carte d'état d'une chambre (Numéro, Nom poétique, Catégorie, Étage, Statut ménage/occupation, Tarif nuitée).
- **Écrans l'utilisant :** 01, 02 (vue compacte), 04 (sélection radio), 05.

---

## 6. Composants de Feedback, Modals & Notifications (Overlays)

### 6.1. `ModalShellComponent`
- **Rôle :** Conteneur modal compact standardisé pour l'ensemble des fenêtres modales du PMS (réservation, fiche client, encaissement, ticket technique).
- **Structure en 3 zones :**
  1. *En-tête fixe* (~72 px) : Titre, sous-titre contextuel, badge d'état ou de catégorie, icône métier et bouton croix de fermeture (cible tactile min 44×44 px).
  2. *Corps défilant* (`overflow-y: auto`, `flex-1`) : Contenu projeté via `<ng-content select="[modal-body]" />` ou par défaut. Le défilement est strictement confiné à la fenêtre ; le défilement de la page d'arrière-plan est bloqué (`body { overflow: hidden }`).
  3. *Pied fixe toujours visible* : Actions d'annulation, validation et affichage du total ou résumé via `<ng-content select="[modal-footer]" />`, visible immédiatement sans défilement.
- **Dimensions & Responsive :**
  - Bureau / Tablette : `maxWidth: min(960px, calc(100vw - 32px))`, `maxHeight: 88dvh`, centré avec ombre profonde `shadow-[0_24px_48px_-12px_rgba(10,37,64,0.28)]`.
  - Mobile (< 768 px) : Feuille plein écran (`w-full h-full rounded-none`), avec en-tête et pied fixes.
- **Accessibilité (a11y) & Ergonomie :**
  - Piège de focus (Tabulation cyclique à l'intérieur de la fenêtre).
  - Restauration automatique du focus sur l'élément d'origine qui a ouvert la fenêtre lors de la fermeture.
  - Fermeture par la touche Échap et au clic sur le voile d'ombrage extérieur.
  - Animation d'ouverture douce de 150 ms (désactivée si `prefers-reduced-motion: reduce`).
- **Écrans l'utilisant :** Écran 04 (`NewReservationModalComponent`), modales d'encaissement, édition client, nouveau ticket maintenance.

### 6.2. `ToastNotificationComponent`
- **Rôle :** Bannière d'alerte contextuelle (succès, avertissement, conflit, erreur).
- **Variantes :**
  - `conflict` : Bannière rouge vif avec suggestion de relogement (utilisée sur le Tape Chart de l'écran 05).
  - `success` : Notification verte de synchronisation ou de paiement validé.
  - `offline` : Notification persistante indiquant le travail en mode hors ligne.
- **Écrans l'utilisant :** 01, 02, 05, 07, 08.

### 6.3. `EmptyStateComponent`
- **Rôle :** Écran d'état vide avec illustration, message chaleureux et bouton d'action principal (ex. « Aucune arrivée prévue aujourd'hui », « Aucun ticket de maintenance en cours »).
- **Écrans l'utilisant :** Tous les écrans lors de l'absence de données.

### 6.4. `SkeletonLoaderComponent`
- **Rôle :** Gabarit de chargement simulant la forme des cartes et tableaux avant réception des données locales IndexedDB ou du serveur.
- **Écrans l'utilisant :** Tous les écrans en phase de chargement initial.

---

## 7. Matrice Croisée Composants ⇄ Écrans

| Composant Angular | 01. Dashboard Bureau | 02. Dashboard Mobile | 03. Connexion PMS | 04. Modal Réservation | 05. Planning Gantt | 06. Fiche Client | 07. POS Restaurant | 08. Folio Facturation | 09. Maintenance | 10. Rapports |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **AppSidebar** | X | | | | X | X | X | X | X | X |
| **AppHeader** | X | | | | X | X | X | X | X | X |
| **MobileNav** | | X | | | | | (opt) | | | |
| **Breadcrumb** | | | | | | X | | X | | |
| **KpiCard** | X | X | | | | X | | | X | X |
| **StatusBadge** | X | X | | X | X | X | X | X | X | X |
| **DataTable** | | | | | X | X | | X | X | X |
| **Avatar** | X | X | X | | | X | X | | X | |
| **BarChartWeekly**| X | | | | | | | | | X |
| **Button** | X | X | X | X | X | X | X | X | X | X |
| **SearchInput** | X | | | | X | X | X | | X | |
| **TextField/Select**| | | X | X | X | X | | X | X | X |
| **DateRangePicker**| | | | X | X | | | | | X |
| **GanttTimeline** | | | | | X | | | | | |
| **SplitPayment** | | | | X | | | X | X | | |
| **DishCard** | | | | | | | X | | | |
| **TicketPanel** | | | | | | | X | | | |
| **RoomCard** | X | X | | X | X | | | | X | |
| **Modal** | | | | X | | X | | | X | |
| **Toast** | X | X | | | X | | X | X | X | |
| **EmptyState** | X | X | | X | X | X | X | X | X | X |
| **SkeletonLoader**| X | X | | X | X | X | X | X | X | X |
