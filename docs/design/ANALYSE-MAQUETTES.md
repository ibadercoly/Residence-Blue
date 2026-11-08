# Analyse Exhaustive des Maquettes UI — Résidence Blue (PMS)

> **Document de Référence UI/UX**  
> **Source :** 12 dossiers exportés de Google Stitch (`design/maquettes/`)  
> **Établissement :** Résidence Blue — Hôtel Boutique 12 Chambres, Restaurant & Bar « La Teranga »  
> **Localisation :** Grand Standing, Thiès (Sénégal)  
> **Devise monétaire :** FCFA (valeurs strictement entières, ex. `145 000 FCFA`)  
> **Aura Visuelle Directrice :** La maquette `tableau_de_bord` sert de **référence visuelle maîtresse** pour l'ensemble des écrans et composants du logiciel.

---

## Sommaire

1. [Vue d'ensemble et Répartition des Écrans](#1-vue-densemble-et-répartition-des-écrans)
2. [Éléments Non-Écrans](#2-éléments-non-écrans)
3. [Analyse Détaillée des 10 Écrans](#3-analyse-détaillée-des-10-écrans)
   - [Écran 01 — Tableau de bord (Bureau — Écran Directeur)](#écran-01--tableau-de-bord-bureau--écran-directeur)
   - [Écran 02 — Tableau de bord Mode Clair (Tablette & Mobile)](#écran-02--tableau-de-bord-mode-clair-tablette--mobile)
   - [Écran 03 — Connexion PMS Collaborateur](#écran-03--connexion-pms-collaborateur)
   - [Écran 04 — Modal Nouvelle Réservation](#écran-04--modal-nouvelle-réservation)
   - [Écran 05 — Planning des Réservations (Tape Chart / Gantt)](#écran-05--planning-des-réservations-tape-chart--gantt)
   - [Écran 06 — Fiche Profil Client (Cardex Voyageur)](#écran-06--fiche-profil-client-cardex-voyageur)
   - [Écran 07 — Point de Vente Restaurant & Bar « La Teranga »](#écran-07--point-de-vente-restaurant--bar--la-teranga-)
   - [Écran 08 — Facturation, Folio Client & Encaissement](#écran-08--facturation-folio-client--encaissement)
   - [Écran 09 — Maintenance & Suivi des Tickets Techniques](#écran-09--maintenance--suivi-des-tickets-techniques)
   - [Écran 10 — Rapports Statistiques & Financiers](#écran-10--rapports-statistiques--financiers)
4. [Synthèse Matricielle Rôles & Données](#4-synthèse-matricielle-rôles--données)

---

## 1. Vue d'ensemble et Répartition des Écrans

L'analyse porte sur les 12 sous-dossiers situés dans `design/maquettes/` :
- **10 écrans applicatifs interactifs complets** (disposant de code HTML/Tailwind et de captures d'écran `screen.png`).
- **2 éléments complémentaires non-écrans** : un dossier contenant la spécification textuelle du Design System (`DESIGN.md`), et un dossier contenant un rendu 3D d'ambiance / photographie de marque (`screen.png`).

---

## 2. Éléments Non-Écrans

### 2.1. `saly_coastal_boutique_hospitality`
- **Contenu :** Fichier unique `DESIGN.md` (aucun fichier HTML ni capture d'écran).
- **Rôle :** Spécification formelle du **système de design** (Design System) initial de Google Stitch. Il détaille la charte graphique, les jetons de couleurs (nommés selon les conventions Material Theme 3 : `primary`, `secondary`, `surface-container`, etc.), les échelles typographiques (Newsreader pour les titres éditoriaux de prestige, Manrope pour les données opérationnelles), la convention monétaire en Francs CFA, les rayons de courbure et les élévations d'ombre.
- **Remarque de localisation :** Bien que nommé historiquement « Saly Coastal Boutique », ce document a été réaligné sur la localisation officielle de l'hôtel à **Thiès (Grand Standing)**.

### 2.2. `warm_elegant_atmospheric_view_of_r_sidence_blue_a_luxury_boutique_hotel_in_saly`
- **Contenu :** Fichier unique `screen.png` (aucun code HTML).
- **Rôle :** Image d'ambiance / rendu photographique architectural (Mood Image) illustrant l'identité visuelle de l'hôtel : architecture soignée, végétation luxuriante, terrasse baignée de soleil et esprit d'hospitalité haut de gamme « Teranga ». Cette image servira d'illustration pour l'écran de connexion et pour la documentation d'accueil.

---

## 3. Analyse Détaillée des 10 Écrans

---

### Écran 01 — Tableau de bord (Bureau — Écran Directeur)
*Dossier source : `tableau_de_bord/` (`code.html`, `screen.png`)*  
**NOTE CRITIQUE : Cet écran constitue la référence stylistique et ergonomique maîtresse pour l'ensemble du logiciel Résidence Blue.**

#### 1. Utilité & Rôles cibles
- **Utilité :** Centre de pilotage opérationnel quotidien de l'hôtel. Donne à la direction et à la réception une vue d'ensemble immédiate sur les performances financières de la journée, le taux d'occupation des 12 chambres, les mouvements de clés (arrivées/départs), les alertes urgentes et les revenus hebdomadaires.
- **Rôles utilisateurs :** `DIRECTION` (Supervision globale, KPIs, alertes stocks et caisse), `RECEPTION` (Check-in rapide, suivi des arrivées/départs, alertes clients).

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (bureau 1280px+).
- **Barre latérale (Sidebar) :** Fixe à gauche (`w-64`, 256px), fond sombre très contrasté (`bg-inverse-surface` `#2a3135`), logo Résidence Blue avec vague cyan (`tsunami`), intitulé « Hôtel Boutique • Grand Standing, Thiès », libellé de section « Exploitation 12 Clés », menu de 10 liens verticaux avec icônes Material Symbols, et widget inférieur de météo d'ambiance.
- **En-tête (Header) :** Fixe en haut (`h-20`, 80px), aligné à `left-64`, fond translucide dépoli (`bg-surface/90 backdrop-blur-xl`), champ de recherche globale instantanée, bouton d'action primaire « Nouvelle réservation », bouton de notifications avec pastille dorée, séparateur vertical et avatar utilisateur (Aïssatou Ba, Directrice Générale).
- **Zone principale (Main Canvas) :** Décalage `pl-64 pt-20 px-margin`, organisée en grille verticale :
  - *Bannière Hero panoramique* : Couverture photographique avec dégradé d'assombrissement, pastilles de saison et météo locale, titre d'accueil éditorial.
  - *Grille de 4 cartes KPI bento* : 4 colonnes (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`).
  - *Section inférieure en split 65% / 35%* : Colonne gauche (`lg:col-span-8`) pour le graphique des revenus hebdomadaires et la liste des arrivées ; Colonne droite (`lg:col-span-4`) pour le volet des alertes prioritaires et le widget météo/terrasse.

#### 3. Composants UI présents
- **Cartes KPI (x4) :**
  1. *Taux d'occupation* : 75 %, jauge de progression horizontale (75%), objectif mensuel (80%), « 9 clés actives », indicateur « +5% vs hier ».
  2. *Chambres occupées* : « 9 / 12 », badge « 3 Disponibles », détail « 2 en recouche • 1 prête ».
  3. *Revenu du jour* : « 485 000 FCFA », ventilation « Héberg. 395 000 F • Resto 90 000 F ».
  4. *Mouvements Clés* : « 2 / 1 » (Entrées / Sorties), mention « 1 départ réglé • 2 arrivées à suivre ».
- **Graphique des revenus :** Histogramme à 7 barres verticales (Lundi à Dimanche) avec distinction de couleur (réalisé en turquoise, réservations confirmées prévues en or).
- **Liste d'actions arrivées :** Cartes invités avec initiales rondes, badge « VIP Gold », chambre attribuée, heure estimée, boutons d'appel, de consultation de fiche et bouton d'action « Check-in ».
- **Cartes d'alertes prioritaires (x3) :**
  - Alerte Stock Bar/Épicerie (fond ambre, bouton « Commander »).
  - Alerte Climatisation chambre défaillante (fond rouge/erreur, puce pulsante, bouton « Suivre le ticket »).
  - Alerte Folios impayés / Caisse (fond bleu-gris, bouton « Voir folios »).
- **Widget météo :** Température, brise, statut des terrasses et piscine.

#### 4. États d'interface
- **États visibles :** État normal avec données réelles, survols sur cartes bento et lignes d'arrivées, pastille animée `animate-pulse` sur alertes.
- **États manquants à concevoir :**
  - État de chargement initial (Skeletons pulsants pour les 4 KPIs et le graphique).
  - État vide (Aucune arrivée attendue, aucune alerte active).
  - Indicateur de synchronisation hors ligne (Bandeau « Mode hors ligne — données locales à jour »).

#### 5. Textes français affichés
- *Navigation :* « Résidence Blue », « Hôtel Boutique • Grand Standing, Thiès », « Exploitation 12 Clés », « Tableau de bord », « Planning », « Chambres », « Clients », « Restaurant », « Housekeeping », « Maintenance », « Facturation », « Rapports », « Paramètres ».
- *Recherche :* « Rechercher une réservation, client, chambre... ».
- *Boutons :* « Nouvelle réservation », « Check-in », « Commander », « Suivre le ticket », « Voir folios ».
- *Métriques :* « Taux d'occupation », « Chambres occupées », « Revenu du jour », « Mouvements Clés », « Entrées / Sorties », « Objectif mensuel: 80% ».
- *Titres :* « Bienvenue à la Résidence Blue », « Revenus de la semaine », « Arrivées attendues aujourd'hui », « Actions prioritaires ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `dashboard`, `reservations`, `rooms`, `billing`, `inventory`, `maintenance`.
- **Données requises :** Nombre de chambres occupées / libres / en nettoyage ; CA total du jour découpé hébergement/restauration ; liste des réservations dont la date d'arrivée est aujourd'hui ; tickets de maintenance ouverts au statut urgent ; seuils de stock franchis.

---

### Écran 02 — Tableau de bord Mode Clair (Tablette & Mobile)
*Dossier source : `tableau_de_bord_mode_clair/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Version allégée, compacte et tactile du tableau de bord d'exploitation, conçue pour les tablettes en mobilité (ex. iPad à la réception ou en terrasse) et les smartphones des équipes de terrain.
- **Rôles utilisateurs :** `RECEPTION` (Check-in mobile au salon d'accueil), `GOUVERNANTE` / `HOUSEKEEPING` (Contrôle des chambres prêtes lors des rondes), `DIRECTION` (Consultation rapide sur smartphone).

#### 2. Structure & Disposition spatiale
- **Type de shell :** `mobile_tab` (responsive 375px à 820px, avec prise en charge des zones de sécurité `pt-safe` et `pb-safe`).
- **En-tête supérieur compact :** `h-16`, logo vignette, titre « Résidence Blue — Tableau De Bord », bouton de notifications et avatar utilisateur.
- **Zone principale à défilement vertical :** Cartes empilées avec espacement resserré (`gap-space-sm`).
- **Barre de navigation inférieure fixe :** Fixée au bas de l'écran avec 5 onglets tactiles (Accueil, Planning, Chambres, Restaurant, Plus) pour une navigation au pouce sans friction.

#### 3. Composants UI présents
- **Bannière d'accueil mobile :** « Bonjour Aïssatou », date, météo et bouton d'action tactile « Nouvelle résa ».
- **Grille de KPIs mobile (2x2) :** 4 cartes compactes (Occupation 83%, Revenus du jour 1 420 000 FCFA avec sous-totaux, Arrivées 4 prévues, Départs 3 prévus).
- **Cartes d'urgences opérationnelles empilées :** Alerte ménage prioritaire (Chambre 10, bouton « Confirmer prêt »), Alerte note restaurant en chambre (Table 4, 45 000 F).
- **Matrice synthétique des 12 chambres :** Mini-pastilles de statut par numéro de chambre (101 à 302) avec code couleur (vert = propre/libre, rouge = occupée, ambre = ménage en cours).
- **Cartes d'arrivées au format liste accordéon.**

#### 4. États d'interface
- **États visibles :** Normal, survol/appui tactile (`active:scale-95`).
- **États manquants :** État d'erreur réseau / synchronisation différée avec badge hors ligne, état de rafraîchissement au tirage (pull-to-refresh).

#### 5. Textes français affichés
- « Bonjour Aïssatou », « Vendredi 24 Mai • Thiès Grand Standing, 29°C », « Nouvelle résa », « 12 Clés Actives », « Occupation », « Revenus du jour », « Arrivées », « Départs », « Alertes en cours », « Confirmer prêt », « Accueil », « Planning », « Chambres », « Restaurant », « Plus ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `dashboard`, `housekeeping`, `rooms`.
- **Données requises :** Données identiques à l'écran 01 mais agrégées de manière plus synthétique pour affichage sur petit écran.

---

### Écran 03 — Connexion PMS Collaborateur
*Dossier source : `connexion_r_sidence_blue_pms/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Authentification sécurisée des employés et collaborateurs de l'hôtel. Sélection rapide des profils en démonstration et affichage des garanties de chiffrement (AES-256-GCM / CDP Sénégal).
- **Rôles utilisateurs :** Tous les rôles (`ADMIN`, `DIRECTION`, `RECEPTION`, `RESTAURANT`, `MAINTENANCE`, `GOUVERNANTE`).

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_blank` (écran d'authentification plein écran 100vh sans navigation latérale).
- **Disposition divisée en 2 volets (Split-screen) :**
  - *Volet gauche visuel (55% desktop) :* Image de marque avec citation éditoriale sur la Teranga, pastille météo en direct, caractéristiques de l'hôtel.
  - *Volet droit formulaire (45% desktop) :* Sélecteur de langue (FR/EN), numéro de version (v2.4 PMS Pro), logo Résidence Blue, sélecteur de profils rapides démo, formulaire de connexion, case « Se souvenir de ce poste », lien mot de passe oublié, badge de sécurité et support informatique.

#### 3. Composants UI présents
- **Boutons démo rapide de profil (x3) :** Direction/Réception (Aïssatou Ba), Restaurant (La Teranga), Maintenance (Chambres & Parc).
- **Champs de formulaire :**
  - Identifiant / Email professionnel (avec icône `@` et badge dynamique du rôle).
  - Mot de passe avec bouton d'affichage/masquage tactile (`visibility` / `visibility_off`).
- **Case à cocher :** « Se souvenir de ce poste ».
- **Bouton de soumission principal :** « Se connecter au PMS » avec icône de flèche et état d'animation de chargement.
- **Pied de carte :** Badge de conformité « Chiffrement AES-256 • Conforme RGPD & CDP Sénégal » et numéro de support téléphonique d'urgence à Thiès.

#### 4. États d'interface
- **États visibles :** Formulaire rempli, état de pré-remplissage via boutons démo, bascule du mot de passe en clair, simulation de chargement « Ouverture de session PMS... ».
- **États manquants :**
  - Message d'erreur d'identifiants incorrects (Toast rouge / contour d'input en rouge).
  - Mode déconnecté / serveur local injoignable.
  - Verrouillage de compte après tentatives infructueuses (rate limiting).

#### 5. Textes français affichés
- « Connexion Collaborateur », « Portail de gestion hôtelière 12 clés & restaurant La Teranga », « Profils rapides de démonstration », « Identifiant ou Email professionnel », « Mot de passe confidentiel », « Se souvenir de ce poste », « Mot de passe oublié ? », « Se connecter au PMS », « Chiffrement AES-256 • Conforme RGPD & CDP Sénégal », « Support informatique (+221 33 957 00 00) ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `auth`, `users`.
- **Données requises :** Email, mot de passe hashé (Argon2id ou bcrypt), signature JWT, liste des rôles associés.

---

### Écran 04 — Modal Nouvelle Réservation
*Dossier source : `modal_nouvelle_r_servation/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Tunnel guidé de création d'une nouvelle réservation en 5 étapes. Permet au réceptionniste d'enregistrer un client, choisir les dates, allouer une catégorie et un numéro de chambre précis, encaisser un acompte via les moyens de paiement sénégalais (Wave, Orange Money, Espèces, TPE), et noter les demandes particulières.
- **Rôles utilisateurs :** `RECEPTION`, `DIRECTION`.

#### 2. Structure & Disposition spatiale
- **Type de shell :** Modalité de recouvrement (Overlay centré, `max-w-6xl`, hauteur fixe avec défilement interne).
- **Structure interne en 2 colonnes asymétriques :**
  - *Colonne gauche formulaire (7/12) :* Saisie séquentielle en 5 sections numérotées (1. Client & Contact, 2. Dates de séjour & Occupants, 3. Choix de la Chambre & Tarifs, 4. Acompte & Mode de Règlement, 5. Demandes Particulières & Conciergerie).
  - *Colonne droite récapitulatif tarifaire dynamique (5/12) :* Carte récapitulative flottante (`sticky`), photo de la chambre, synthèse des dates, calcul automatique du total (nuits x tarif + suppléments - acompte = solde dû).
- **Pied de modal (Footer fixe) :** Bouton secondaire « Annuler », indicateur de validation automatique des disponibilités, bouton primaire « Confirmer la réservation ».

#### 3. Composants UI présents
- **Bouton d'état client :** Bascule entre « Client régulier (Cardex) » et « Nouveau client ».
- **Champs de saisie :** Nom complet, téléphone mobile (indicatif +221), email, sélecteur de dates avec compteur de nuits automatique, sélecteur d'occupants (adultes, enfants).
- **Sélecteur de catégorie de chambre (Cartes radio) :**
  - *Standard Patio* (6 clés, 85 000 FCFA/nuit)
  - *Deluxe Mer* (4 clés, 130 000 FCFA/nuit) — *Sélectionné*
  - *Suite Océan Panoramique* (2 clés, 185 000 FCFA/nuit)
- **Menu déroulant d'attribution spécifique :** Choix du numéro physique de chambre (ex. Chambre 201 avec option de changer pour 203).
- **Boutons de sélection du moyen d'encaissement :** Boutons tactiles pour Wave, Orange Money, Carte TPE, Espèces.
- **Zone de texte :** Demandes particulières et conciergerie (ex. navette aéroport AIBD, jus de bissap de bienvenue).

#### 4. États d'interface
- **États visibles :** Formulaire renseigné avec valeurs par défaut, moyen de paiement Wave sélectionné.
- **États manquants :**
  - État de conflit de calendrier (Dates indisponibles pour la chambre choisie avec message d'erreur rouge).
  - Calcul dynamique en direct lorsque l'utilisateur modifie la date ou le nombre d'occupants.
  - État de chargement lors de la validation (`isSubmitting`).

#### 5. Textes français affichés
- « Nouvelle Réservation • Clés Résidence Blue », « Informations Client & Séjour », « Client régulier existant », « Nouveau client », « Dates du séjour », « Nombre d'occupants », « Catégorie de Chambre & Tarification », « Attribution de la chambre spécifique », « Acompte & Mode de Règlement », « Canal d'encaissement », « Sans frais • Instantané », « Demandes Particulières & Conciergerie », « Récapitulatif du Séjour », « Confirmer la réservation ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `reservations`, `rooms`, `guests`, `payments`.
- **Données requises :** Liste des clients existants pour autocomplétion, disponibilités des 12 chambres sur l'intervalle de dates, grilles tarifaires en vigueur, génération d'UUID client et d'idempotency-key.

---

### Écran 05 — Planning des Réservations (Tape Chart / Gantt)
*Dossier source : `planning_des_r_servations/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Visualisation spatio-temporelle complète (Gantt hôtelier / Tape Chart) des 12 clés sur un horizon paramétrable (14 jours, semaine, mois). Permet de repérer instantanément les vacances, les arrivées imminentes, les départs et de résoudre les éventuels conflits d'attribution de chambre.
- **Rôles utilisateurs :** `RECEPTION` (Attribution quotidienne, check-in, prolongation de séjour), `DIRECTION` (Gestion des plannings et du yield management).

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (Sidebar gauche identique à l'écran 01, Header avec recherche).
- **Bannière d'alerte supérieure (Toast conflit) :** Bandeau rouge alertant d'un conflit d'attribution sur la chambre 202 avec suggestion immédiate de relogement vers la chambre 203.
- **Barre d'outils du planning :** Commandes de navigation temporelle (Précédent, Aujourd'hui, Suivant), sélecteur d'horizon (14 Jours, Semaine, Mois), filtres par catégorie de chambre et par statut, légende opérationnelle.
- **Zone principale divisée en 2 sections :**
  - *Grille Gantt défilable horizontalement (8 à 9 colonnes sur 12) :* Colonne fixe des 12 chambres (Standard 101-106, Deluxe 201-204, Suites 301-302) et 14 colonnes de dates avec surbrillance nette de la colonne « Aujourd'hui ».
  - *Volet droit Fiche Réservation active (3 à 4 colonnes sur 12) :* Panneau complet affichant les détails de la réservation cliquée (M. Mamadou Diop, Suite 301, dates, acompte, solde restant, actions d'édition et de facturation).

#### 3. Composants UI présents
- **Bandeau de notification d'erreur / conflit :** Icône warning, bouton d'action « Voir options de relogement suggérées », bouton de fermeture.
- **Tableau Gantt matriciel :**
  - Ligne d'en-tête temporelle avec jour de la semaine et quantième.
  - Lignes des 12 chambres avec pastille de catégorie.
  - Blocs de réservation rectangulaires horizontaux avec coins arrondis, nom du client, durée, et couleur selon le statut (gris = passé/check-out, cyan foncé = en séjour, or = réservation confirmée à venir, rouge = conflit).
  - Bloc sélectionné avec bague d'accentuation dorée (`ring-2 ring-secondary`).
- **Volet latéral de détail de séjour :** Badge de fidélité, numéro de dossier, dates de check-in/out, formule repas, solde folio, boutons d'action rapide (« Ouvrir Folio Facture », « Modifier », « Transférer de chambre », « Check-out »).

#### 4. États d'interface
- **États visibles :** Planning rempli sur 14 jours, réservation active sélectionnée, alerte de conflit visible.
- **États manquants :**
  - Drag & Drop interactif d'une réservation avec mise en évidence des cellules cibles valides / invalides.
  - État vide (Aucune réservation sur la période sélectionnée).
  - Indicateur de filtre actif sans résultat.

#### 5. Textes français affichés
- « Chambre déjà réservée sur cette période », « Conflit Tape Chart », « Voir options de relogement suggérées », « 20 Mai – 2 Juin 2024 », « 14 Jours », « Semaine », « Mois », « Toutes les clés (12 chambres) », « En séjour », « Confirmé », « Disponible », « Alerte », « Glissez-déposez une réservation pour changer de chambre ou prolonger », « Exporter le Tape Chart (PDF/Excel) », « Ouvrir Folio Facture ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `reservations`, `rooms`, `calendar`.
- **Données requises :** Liste des 12 chambres classées par étage/type, réservations actives chevauchant l'horizon de dates, état d'occupation en temps réel.

---

### Écran 06 — Fiche Profil Client (Cardex Voyageur)
*Dossier source : `fiche_profil_client_m._mamadou_diop/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Fiche Cardex individuelle détaillée d'un voyageur fidèle (M. Mamadou Diop, VIP Gold). Centralise l'état civil, les pièces d'identité chiffrées, les coordonnées, les préférences d'hospitalité, l'historique de tous les séjours, les dépenses cumulées et les notes de conciergerie.
- **Rôles utilisateurs :** `RECEPTION`, `DIRECTION`, `CONCIERGERIE`.

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (Sidebar et Header complets).
- **Barre supérieure :** Fil d'Ariane (Clients > M. Mamadou Diop), badge VIP Gold, bouton d'édition du profil, menu déroulant de contact rapide (WhatsApp, Email, SMS d'accueil) et bouton « Nouvelle réservation ».
- **Grille principale à 2 colonnes :**
  - *Colonne gauche (4/12) :* Carte d'identité voyageur avec photo portrait, coordonnées, nationalité, document officiel (Passeport SN avec bouton scan PDF), tags d'instructions permanentes (navette, vin, oreillers), carte KPI de fidélité (total dépensé 3 850 000 FCFA, panier moyen, ancienneté, jauge de répartition hébergement/F&B), vignette de la chambre fétiche (Suite 301).
  - *Colonne droite (8/12) :* Espace de travail à onglets (Historique des séjours, Préférences & Habitudes, Factures & Folios, Notes & Conciergerie) avec bannière du séjour en cours et tableau des séjours passés.

#### 3. Composants UI présents
- **Fil d'Ariane (Breadcrumb) :** Navigation hiérarchique avec chevrons.
- **Menu déroulant de messagerie :** Bouton ouvrant les liens vers WhatsApp Web/API, messagerie par mail et envoi de SMS.
- **Cartes d'identité et de contact :** Bouton de copie du numéro de téléphone en un clic.
- **Jauge bicolore de ventilation des dépenses :** 78% hébergement / 22% F&B.
- **Barre d'onglets (Tablist) :** 4 onglets interactifs avec icônes.
- **Tableau des séjours :** Colonnes (Dates, Chambre, Formule, Montant total, Mode de règlement principal, Facture PDF téléchargeable).
- **Blocs de notes d'attention de conciergerie :** Notes saisies par l'équipe avec date et auteur.

#### 4. États d'interface
- **États visibles :** Profil richement renseigné avec 4 séjours, séjour en cours actif, menu de contact ouvert.
- **États manquants :**
  - Fiche d'un nouveau client (Historique vierge, aucune dépense cumulée, incitation à créer la première réservation).
  - Formulaire modal d'édition du profil client.
  - État de suppression ou d'archivage RGPD/CDP du client.

#### 5. Textes français affichés
- « Fiche Voyageur », « VIP Gold », « Éditer le profil », « Message », « Nouvelle réservation », « Nationalité », « Téléphone », « Affiliation », « Passeport N° SN-982341-B », « Valide jusqu'au 14/09/2027 », « Instructions permanentes », « Synthèse Clientèle », « Total Dépensé (Chambres & Folios) », « 3 850 000 FCFA », « Historique des séjours », « Préférences & Habitudes », « Factures & Folios », « Notes & Conciergerie ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `guests`, `reservations`, `billing`, `documents`.
- **Données requises :** Identité client, pièces d'identité chiffrées (AES-256-GCM), liste de ses réservations passées et en cours, total des factures soldées, notes horodatées.

---

### Écran 07 — Point de Vente Restaurant & Bar « La Teranga »
*Dossier source : `point_de_vente_restaurant_la_teranga/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Caisse tactile et prise de commande pour le restaurant et bar « La Teranga » de l'hôtel. Permet la sélection rapide de plats et boissons du terroir sénégalais, l'affectation à une table ou le transfert direct de l'addition sur le folio de la chambre d'un client de l'hôtel, l'envoi de la commande en cuisine (KDS) et l'encaissement direct.
- **Rôles utilisateurs :** `RESTAURANT` (Serveurs, Maître d'hôtel, Barman), `DIRECTION` (Suivi des ventes F&B).

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (Écran large avec sidebar rétractable ou fixe).
- **Organisation en 2 grandes zones :**
  - *Zone catalogue de commande gauche (8/12) :* Barre supérieure de filtres par catégories de mets (Tous, Plats Sénégalais, Grillades Mer, Entrées & Tapas, Cocktails & Boissons, Desserts), barre de recherche de plat, et grille de cartes visuelles de plats avec photos alléchantes, descriptions et tarifs en FCFA.
  - *Zone ticket de commande droite (4/12) :* Panneau de commande fixé à droite (`sticky`), affichage du numéro de commande (#CMD-0428) et du serveur, bascule « Table » / « Chambre », sélecteur de table tactile (T1 à T6, Bar, Transat), liaison avec le client de la chambre (M. Mamadou Diop Ch. 301), liste scrollable des articles commandés avec ajustement de quantités (+ / -), sous-totaux, et double bouton d'action au bas : « Envoyer en Cuisine (KDS) » et « Transférer sur la Chambre » / « Encaisser direct ».

#### 3. Composants UI présents
- **Boutons filtres de catégorie de menu :** Pilules horizontales avec icônes.
- **Cartes produits / plats :** Photo, badge « Suggestion du Chef » ou « Signature Bar », titre du plat, description des ingrédients, prix en gros format monétaire, bouton rond d'ajout direct au ticket (`+`).
- **Sélecteur de destination :** Boutons d'option Table / Chambre.
- **Grille tactile de tables :** 8 boutons d'accès rapide (T1 à T6, Bar, Transat).
- **Vignette d'association de chambre :** Carte miniature avec numéro de chambre, nom du client et bouton de transfert.
- **Lignes du ticket :** Titre du plat, notes de cuisine personnalisées (ex. « Piment bien à part »), stepper de quantité interactif, prix unitaire et sous-total.
- **Blocs d'encaissement et dispatch cuisine :** Bouton pour envoyer les bons en cuisine, boutons Wave / Espèces.

#### 4. États d'interface
- **États visibles :** Catalogue complet, ticket en cours de saisie avec 3 articles, liaison active avec la Suite 301.
- **États manquants :**
  - Ticket vide (Panier vide invitant à sélectionner un premier plat).
  - Écran de division d'addition entre convives (Split bill).
  - Gestion des ruptures de stock de plats (Badge « Épuisé » grisé et non cliquable).
  - Mode hors ligne pour saisie des commandes sans interruption de service.

#### 5. Textes français affichés
- « Point de Vente • Restaurant La Teranga », « Plats Sénégalais », « Grillades Mer », « Cocktails & Boissons », « Thiéboudienne Royale (4 500 FCFA) », « Dibi d'Agneau au Feu de Bois (5 500 FCFA) », « Lotte Grillée de l'Océan (6 000 FCFA) », « Yassa au Poulet Fermier (4 000 FCFA) », « Mafé de Bœuf Fondant (4 500 FCFA) », « Cocktail Saloum Sunset (3 500 FCFA) », « Ticket Actuel », « Emplacement sélectionné : », « Envoyer en Cuisine (KDS) », « Transférer sur la Chambre (Ch. 301) ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `restaurant`, `billing`, `inventory`, `guests`.
- **Données requises :** Carte du restaurant avec catégories et tarifs, plan des tables, liste des chambres actuellement occupées avec nom des occupants, gestion du stock des ingrédients sensibles.

---

### Écran 08 — Facturation, Folio Client & Encaissement
*Dossier source : `facturation_folio_client_encaissement/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Gestion comptable complète du folio voyageur et processus officiel de check-out / départ de l'hôtel. Consolide les nuitées, les extras restauration/bar, les taxes de séjour légales sénégalaises, l'acompte déjà versé, et fournit une passerelle d'encaissement multicanal fractionné (Split payments : Wave, Espèces avec rendu de monnaie, Orange Money, Carte TPE) avant émission de la facture fiscale.
- **Rôles utilisateurs :** `RECEPTION`, `DIRECTION`, `COMPTABILITÉ`.

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (Sidebar gauche et Header standard).
- **En-tête de folio :** Numéro de facture (`#INV-2024-0542`), date d'émission, statut « Séjour en cours / En attente de départ », informations client et hébergement (M. Mamadou Diop, Suite 301, 23 au 27 Mai).
- **Agencement en 2 colonnes principales :**
  - *Colonne gauche détail du folio (7/12) :* Tableau exhaustif des prestations consommées (date/heure, libellé détaillé, quantité, prix unitaire, total), récapitulatif fiscal (Sous-total HT, TVA 10%, Taxe de séjour 1 000 FCFA/nuit/adulte, Total TTC, Déduction de l'acompte Wave) et encadré à fort contraste affichant le « Reste à régler au départ » (288 000 FCFA).
  - *Colonne droite module d'encaissement fractionné (5/12) :* Panneau de ventilation des règlements par moyen de paiement, calculatrice de monnaie pour les espèces, validation d'équilibre du solde, case à cocher pour certification fiscale DGID, et bouton de clôture définitive.

#### 3. Composants UI présents
- **Tableau des lignes de prestations :** Nuitées d'hébergement, repas au restaurant La Teranga avec référence de commande (#CMD-0219), consommations bar, blanchisserie express, excursion, taxe de séjour réglementaire.
- **Encadré comptable HT/TVA/TTC :** Détail clair conforme aux normes fiscales sénégalaises.
- **Module d'encaissement fractionné (Split Payments) :**
  - Canal Wave Sénégal (avec champ de montant à ventiler)
  - Canal Espèces (avec saisie du montant reçu et calcul automatique du montant rendu)
  - Canal Orange Money
  - Canal Carte Bancaire TPE
- **Bandeau d'état d'équilibre :** Pastille dynamique indiquant si le montant ventilé correspond exactement au solde dû.
- **Options légales :** Case à cocher « Émettre facture fiscale certifiée (DGID Sénégal) ».
- **Bouton primaire de validation :** « Valider l'encaissement et Clôturer le Folio ».

#### 4. États d'interface
- **États visibles :** Folio complet prêt pour encaissement avec acompte déduit, solde restant de 288 000 FCFA.
- **États manquants :**
  - État de solde déséquilibré (Avertissement si la somme des moyens de paiement ne correspond pas au reste à payer).
  - Folio entièrement soldé et archivé (Mode lecture seule avec tampon vert « PAYÉ »).
  - Génération et impression du reçu PDF avec QR Code fiscal.

#### 5. Textes français affichés
- « Facturation & Folio Client », « Folio #INV-2024-0542 », « Reste à régler au départ : 288 000 FCFA », « Sous-total HT Prestations : 716 364 FCFA », « TVA sénégalaise (10% taux réduit hôtellerie) : 71 636 FCFA », « Taxe de séjour : 8 000 FCFA », « Total TTC du séjour : 788 000 FCFA », « Acompte versé à la réservation : -500 000 FCFA », « Règlement & Clôture », « Ventilation des règlements », « Wave Sénégal », « Espèces (Caisse locale) », « Calculateur de rendu », « Émettre facture fiscale certifiée (DGID Sénégal) », « Valider l'encaissement et Clôturer le Folio ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `billing`, `reservations`, `payments`, `restaurant`.
- **Données requises :** Lignes de consommation consolidées, application automatique des taux de TVA (10%) et taxes de séjour (1 000 FCFA par personne et par nuit), historique des acomptes perçus, journal de caisse pour les espèces.

---

### Écran 09 — Maintenance & Suivi des Tickets Techniques
*Dossier source : `maintenance_suivi_des_tickets_techniques/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Pilotage technique, entretien des équipements et suivi des pannes dans les 12 chambres et les espaces communs (piscine, cuisine, jardin). Permet au chef technicien et à la gouvernante de déclarer une anomalie, prioriser les urgences climatiques/électriques, assigner un ouvrier ou un prestataire externe, et suivre le délai de résolution (SLA).
- **Rôles utilisateurs :** `MAINTENANCE` (Techniciens, ouvriers), `GOUVERNANTE` (Signalement lors du ménage), `DIRECTION` (Supervision du parc hôtelier).

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (Sidebar et Header standard).
- **Disposition spatiale :**
  - *Grille supérieure de 4 cartes KPI (Bento grid) :* Tickets actifs (5 dont 2 urgents), Alerte critique (Chambre 301 Climatisation), Temps moyen de résolution (2h 15min), Taux SLA respecté (94,2%).
  - *Barre de filtres opérationnels :* Filtres par statut, priorité (Urgente, Haute, Normale), zone d'intervention (Toutes zones, Chambres, Espaces communs, Piscine, Cuisine/Bar) et recherche textuelle.
  - *Agencement inférieur en 2 colonnes :*
    - *Tableau des tickets (8/12) :* Liste détaillée des interventions avec référence, date/heure, chambre concernée, description synthétique du problème, pastille de priorité, technicien assigné, statut et bouton d'action.
    - *Volet de détail de l'intervention sélectionnée (4/12) :* Fiche complète du ticket cliqué (#MNT-2024-089, Climatisation Daikin en panne sur Suite 301), photographie réelle de l'équipement, timeline des étapes, pièces de rechange nécessaires, et boutons d'action (« Marquer comme résolu », « Bloquer la chambre en hors service », « Réassigner »).

#### 3. Composants UI présents
- **Cartes statistiques de maintenance :** Métriques chiffrées avec icônes de clés et d'outils.
- **Tableau de données (Data Table) :**
  - Lignes de tickets avec voyant vertical de couleur.
  - Pastilles de priorité (Urgente rouge, Haute orange, Normale grise).
  - Avatars des techniciens avec initiales et spécialité (Cheikh N., Idrissa Sow, AquaThiès).
  - Pastilles de statut technique (Sur place, Diagnostic, Attente pièce, Résolu).
- **Volet de ticket technique détaillé :**
  - En-tête avec référence et badge de criticité.
  - Photo du matériel en panne.
  - Historique chronologique (Déclaré à 10h15 par Aminata S., Arrivée technicien à 10h30).
  - Formulaire de mise à jour du statut.

#### 4. États d'interface
- **États visibles :** Tableau avec 4 tickets en cours, ticket critique #MNT-2024-089 affiché dans le panneau latéral.
- **États manquants :**
  - État zéro ticket (Aucune panne signalée, parc hôtelier 100% opérationnel).
  - Formulaire modal de création d'un nouveau ticket technique.
  - Déclaration d'indisponibilité de chambre répercutée automatiquement sur le planning Gantt (bloquer les réservations sur cette clé).

#### 5. Textes français affichés
- « Maintenance & Suivi Technique », « Tickets actifs (5 dont 2 urgents) », « Alerte critique : Ch. 301 Climatisation défaillante », « Temps moyen de résolution : 2h 15min », « Taux SLA : 94,2% », « Nouveau ticket d'incident », « Filtrer par statut », « Toutes les zones (12 clés + communs) », « Climatisation en panne - code E4 », « Arrêt complet du compresseur », « Fuite d'eau mitigeur vasque SDB », « Buse refoulement filtration ralentie », « Marquer comme résolu », « Bloquer la chambre en hors service ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `maintenance`, `rooms`, `users`.
- **Données requises :** Liste des tickets ouverts, association avec une chambre ou un équipement, assignation du technicien, impact sur l'état d'occupation de la chambre (`OUT_OF_ORDER`).

---

### Écran 10 — Rapports Statistiques & Financiers
*Dossier source : `rapports_statistiques_financi_res/` (`code.html`, `screen.png`)*

#### 1. Utilité & Rôles cibles
- **Utilité :** Outil d'analyse décisionnelle et de reporting financier pour la gouvernance de l'hôtel. Présente les indicateurs clés de performance hôtelière (RevPAR, Taux d'occupation moyen, Prix moyen de chambre ADR, Chiffre d'affaires global) sur des périodes personnalisables (mois, trimestre, année), la performance comparée par typologie de chambre (Suites, Deluxe, Standard), la répartition des canaux d'encaissement et l'export comptable officiel.
- **Rôles utilisateurs :** `DIRECTION` (Propriétaires, Direction Générale), `COMPTABILITÉ`.

#### 2. Structure & Disposition spatiale
- **Type de shell :** `web_dashboard` (Sidebar et Header standard).
- **Barre supérieure de sélection d'horizon :** Sélecteur de période (Mois en cours — Mai 2024, Trimestre, Année), bouton de comparaison avec la période précédente (+14,2%), et boutons d'export comptable (PDF, Excel, CSV).
- **Organisation verticale en bento :**
  - *4 Cartes KPI exécutives :*
    1. Chiffre d'affaires global : `38 450 000 FCFA` (+14,2% vs Avril)
    2. Taux d'occupation moyen : `82,6 %` (vs 74,1% mois précédent)
    3. RevPAR (Revenu par chambre disponible) : `103 360 FCFA`
    4. ADR (Prix moyen journalier d'une clé louée) : `125 130 FCFA`
  - *Graphique combiné double axe :* Courbe d'évolution journalière du taux d'occupation (avec mise en valeur des pics de remplissage de 100% lors des week-ends fériés d'Ascension et Pentecôte) superposée à l'histogramme du RevPAR journalier.
  - *Grille inférieure à 2 colonnes :*
    - Rendement détaillé par typologie de chambre sur les 12 clés (Suites 301-302 : 94% d'occupation, Deluxe 201-204 : 85%, Standard 101-106 : 76%).
    - Répartition des sources de revenus (Hébergement 68%, Restaurant/Bar 24%, Extras 8%) et ventilation des canaux de paiement (Wave 52%, Espèces 24%, Carte TPE 16%, Orange Money 8%).

#### 3. Composants UI présents
- **Sélecteur de plage de dates :** Composant calendrier avec raccourcis mensuels.
- **Cartes KPI financières :** Valeur principale en grand format, badge de variation en pourcentage, tendance graphique miniature (sparkline).
- **Graphique SVG interactif :** Courbe de taux d'occupation avec dégradé d'ombrage turquoise, barres verticales dorées de RevPAR, repères de dates clés et infobulles de données.
- **Barres de progression segmentées :** Barres de pourcentage de contribution et jauges d'occupation par catégorie.
- **Boutons d'export :** Icônes de téléchargement pour formats PDF comptable et classeur Excel.

#### 4. États d'interface
- **États visibles :** Données consolidées du mois de Mai 2024, comparaison active avec Avril 2024.
- **États manquants :**
  - Période sans aucune donnée (Mois futur sans réservation enregistrée).
  - État de calcul/génération des rapports exportables avec indicateur de progression.
  - Filtre par canal de distribution (réservation directe vs agence).

#### 5. Textes français affichés
- « Rapports & Statistiques Financières », « Mai 2024 • Performances d'Exploitation », « Exporter le rapport (PDF / Excel) », « Chiffre d'Affaires Global : 38 450 000 FCFA », « Taux d'Occupation Moyen : 82,6% », « RevPAR : 103 360 FCFA », « ADR (Prix Moyen Journalier) : 125 130 FCFA », « Évolution Journalière & Taux d'Occupation », « Rendement par Typologie de Chambre (12 Clés) », « Suites Panoramiques (Ch. 301 • 302) », « Chambres Deluxe (Ch. 201 • 204) », « Chambres Standard Patio (Ch. 101 • 106) », « Ventilation des Canaux d'Encaissement », « Wave : 52% », « Espèces : 24% ».

#### 6. Données requises & Rattachement fonctionnel
- **Modules :** `reports`, `billing`, `reservations`, `rooms`.
- **Données requises :** Consolidation de tous les folios clôturés sur la période, nombre de nuitées vendues par chambre, calcul automatisé des formules RevPAR (CA hébergement / total chambres disponibles) et ADR (CA hébergement / chambres vendues).

---

## 4. Synthèse Matricielle Rôles & Données

| N° | Dossier Maquette | Écran / Composant | Rôles Utilisateurs Principaux | Modules Applicatifs Correspondants | Données Clés Manipulées |
|---|---|---|---|---|---|
| **01** | `tableau_de_bord` | Tableau de bord Bureau (Directeur) | `DIRECTION`, `RECEPTION` | `dashboard`, `reservations`, `billing`, `rooms` | KPIs 12 clés, arrivées du jour, alertes urgentes, CA semaine |
| **02** | `tableau_de_bord_mode_clair` | Tableau de bord Mobile/Tablette | `RECEPTION`, `GOUVERNANTE`, `DIRECTION` | `dashboard`, `housekeeping`, `rooms` | Grille 12 clés mobile, alertes ménage, check-in rapide |
| **03** | `connexion_r_sidence_blue_pms` | Connexion Collaborateur | Tous (`ADMIN`, `DIRECTION`, `RECEPTION`, etc.) | `auth`, `users` | Identifiant, mot de passe hashé, token JWT, rôles |
| **04** | `modal_nouvelle_r_servation` | Modal Création Réservation | `RECEPTION`, `DIRECTION` | `reservations`, `guests`, `rooms`, `payments` | Client, dates, catégorie, acompte Wave/OM/Cash, extras |
| **05** | `planning_des_r_servations` | Planning Gantt / Tape Chart | `RECEPTION`, `DIRECTION` | `reservations`, `rooms`, `calendar` | Matrice 12 clés x 14 jours, conflits, fiche séjour latérale |
| **06** | `fiche_profil_client_m._mamadou_diop` | Cardex Profil Voyageur VIP | `RECEPTION`, `DIRECTION`, `CONCIERGERIE` | `guests`, `reservations`, `billing`, `documents` | Identité, passeport AES-256, historique 4 séjours, dépenses FCFA |
| **07** | `point_de_vente_restaurant_la_teranga` | Caisse & POS Restaurant/Bar | `RESTAURANT`, `DIRECTION` | `restaurant`, `billing`, `inventory` | Menu terroir, tables T1-T6, ticket commande, report sur chambre |
| **08** | `facturation_folio_client_encaissement` | Folio, Facturation & Check-out | `RECEPTION`, `DIRECTION`, `COMPTABILITÉ` | `billing`, `reservations`, `payments` | Lignes de débit, TVA 10%, taxe séjour, ventilation multi-moyens |
| **09** | `maintenance_suivi_des_tickets_techniques` | Tickets Techniques & Maintenance | `MAINTENANCE`, `GOUVERNANTE`, `DIRECTION` | `maintenance`, `rooms`, `users` | 5 tickets actifs, priorité climatisation, blocage clé hors service |
| **10** | `rapports_statistiques_financi_res` | Rapports & KPIs Direction | `DIRECTION`, `COMPTABILITÉ` | `reports`, `billing`, `reservations` | CA global, RevPAR, ADR, taux occupation %, exports PDF/Excel |
| *--* | `saly_coastal_boutique_hospitality` | *Design System (DESIGN.md)* | Tous développeurs | Transverse / Design System | Tokens, couleurs, typographies, élévations, règles d'affichage |
| *--* | `warm_elegant_atmospheric_view...` | *Image d'ambiance (Mood Image)* | Graphisme / Documentation | Transverse / Assets | Illustration de marque, accueil, bannières |

---
*Ce document sert de contrat d'interface pour le développement de l'application Angular et des endpoints d'API NestJS.*
