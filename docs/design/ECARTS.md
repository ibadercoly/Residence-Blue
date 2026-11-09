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

---

### 1.5. Formulaires et Modal de Gestion du Menu Restaurant
- **Constat :** Aucune maquette Google Stitch n'existe pour les formulaires de gestion administrative du menu (ajout de plat, modification, duplication, archivage, gestion des catégories, import/export CSV/Excel et téléversement de photos). Seule la vue opérationnelle de prise de commande caisse (`point_de_vente_restaurant_la_teranga`) a fait l'objet d'une maquette source.
- **Solution retenue :** Formulaires et tableaux de gestion intégrés dans le composant standard `ModalShellComponent` compact (largeur maximale 960 px, hauteur maximale 88 dvh, corps défilant, en-tête et pied fixes, plein écran sous 768 px). Réutilisation stricte et sans dérive des composants, couleurs, polices (`Manrope`, `Newsreader`), rayons et espacements du design system de l'hôtel.

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
    - Compteurs Adultes et Enfants disposés côte à côte (steppers compacts de 40 px de hauteur).
    - Carte client fidèle compactée sur 2 lignes informatives.
    - Demandes particulières placées dans une section repliable par défaut (dépliée automatiquement si du texte est présent).
    - Volet récapitulatif latéral limité à 300 px maximum (sticky au scroll), et replié sous 900 px en une barre extensible « Total : 456 000 FCFA ▾ ».
  - **Test de fidélité visuelle :** L'évaluation de fidélité compare le style, les couleurs, les polices, les rayons et les composants internes sans imposer les dimensions extérieures de 1152×942 px de la maquette originale.

### 2.4. Fiche Profil Client (M. Mamadou Diop) — Confidentialité PII & Fonctionnalités Réseau
- **Écart constaté & Décision d'architecture :**
  1. *Masquage PII par défaut du numéro de passeport :* Dans la maquette originale, le numéro de passeport complet (« SN-982341-B ») est affiché en clair. Pour respecter les exigences de protection des données sensibles (RGPD / CDP Sénégal et AGENTS.md), le numéro est masqué par défaut sous la forme « SN••••••1-B ». Un bouton « Afficher » permet de le révéler uniquement aux utilisateurs ayant un rôle habilité (Direction / Réceptionniste).
  2. *Boutons de communication externe inactifs :* Les actions WhatsApp (`wa.me/...`), SMS et E-mail nécessitent une connectivité Internet et des passerelles de messagerie tierces non disponibles hors ligne. Ils sont configurés avec un retour utilisateur explicite « TODO notifications, nécessitent internet ».
  3. *Action Scan PDF inactive :* Le bouton « Scan PDF » affiche un message informatif « TODO fonctionnalité d'envoi sécurisé de fichiers », en attente de la brique de stockage chiffré des pièces jointes.
  4. *Conversion dynamique en euros avec taux fixe :* Le montant cumulé dépensé affiche la conversion en euros basée sur le taux officiel fixe UEMOA/BCEAO (1 EUR = 655,957 FCFA) paramétré dans le PMS (ex. 3 850 000 FCFA -> approx. 5 870 €).
  5. *4 onglets opérationnels complets :* Historique des séjours, Préférences & Habitudes, Factures & Folios, Notes & Conciergerie (avec ajout dynamique et immédiat de consignes internes).

---

## 3. Obstacles au Fonctionnement Hors Ligne (Offline-First) & Solutions

Le projet Résidence Blue impose une architecture **offline-first stricte** : l'ensemble du personnel doit pouvoir travailler même en cas de coupure Internet à Thiès. Les maquettes Google Stitch comportaient plusieurs dépendances réseau qui bloquaient le fonctionnement hors ligne :

### 3.1. Dépendances CDN Externes dans le `<head>`
- **Problème :** Les maquettes chargent :
  - `https://cdn.tailwindcss.com` (compilateur JIT Tailwind distant)
  - `https://fonts.googleapis.com` et `https://fonts.gstatic.com`
  - Polices distantes `Manrope` et `Newsreader`
  - Icônes distantes `Material Symbols Outlined`
- **Impact hors ligne :** Sans connexion Internet, Tailwind ne charge pas, les polices redeviennent des polices système (Times / Arial), et les icônes deviennent des chaînes de texte brut (ex. « tsunami », « bed ») rendant l'interface illisible.
- **Solution mise en place :**
  1. Tailwind est intégré localement au projet Angular via le compilateur PostCSS (`apps/web/`).
  2. Les paquets `@fontsource/manrope`, `@fontsource/newsreader` et `material-symbols` sont installés en dépendances locales.
  3. Pour les 10 pages de référence hors ligne (`design/reference/*.html`), les CSS sont compilés localement et les polices servies depuis `design/reference/fonts/`.

### 3.2. Images Distantes sur Google User Content (`lh3.googleusercontent.com`)
- **Problème :** Toutes les photographies (portraits de clients, plats du restaurant, vues des chambres) pointent vers des URLs distantes Google (`https://lh3.googleusercontent.com/...`).
- **Impact hors ligne :** Images brisées hors ligne. De plus, 2 URLs sont expirées (voir `docs/design/INVENTAIRE-IMAGES.md`).
- **Solution mise en place :**
  1. Téléchargement des 14 images valides dans `images/maquettes-originales/`.
  2. Images hébergées localement dans `apps/web/public/assets/images/`.
  3. Composants de repli SVG et initiales pour les URLs expirées ou manquantes.

### 3.3. Gestion de l'Idempotence et File d'Attente Outbox
- **Règle architecturale :** Toute écriture effectuée hors ligne génère un **UUID côté client** et est enregistrée dans **IndexedDB**.
- Chaque requête vers l'API NestJS transporte un en-tête `Idempotency-Key: <UUID>`. La synchronisation ne duplique aucun enregistrement.

---

## 4. Audit d'Accessibilité (Contraste, Cibles Tactiles & Navigation Clavier)

### 4.1. Ratios de Contraste de Couleur (Norme WCAG AA)
- La couleur `--color-outline` (`#6d797b`) sur fond clair `#f3fafe` présente un ratio de **3.6:1**. Le texte secondaire courant est donc basé sur `--color-on-surface-variant` (**`#3d494a`**, ratio **7.2:1**), réservant `#6d797b` aux bordures et séparateurs décoratifs.
- La pastille ambre sur fond jaune pâle (`#fffbeb` avec texte `#92400e`) conserve au moins 14px en graisse semi-bold pour respecter le ratio de 4.5:1.

### 4.2. Ergonomie & Cibles Tactiles (Touch Targets)
- Dans le planning Gantt, les boutons de navigation « < » et « > » et cellules de dates mesurent parfois moins de 32px de large dans la maquette originale.
- Les zones d'appui tactiles (`padding` transparent) sont portées à au moins 44x44px sur tablette/mobile.

### 4.3. Navigation au Clavier & Lecteurs d'Écran
- Tous les champs comportent un `<label>` explicite ou `<label class="sr-only">`.
- Focus visible net : `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`.
- Modales accessibles avec piège du focus (`focus trap`) et fermeture avec `Escape`.

---

## 5. Régularisations Techniques — Shell & Navigation

1. **Accessibilité :**
   - `<label for="global-search" class="sr-only">` sur la recherche globale.
   - `role="banner"` sur `<header>`, `role="main"` sur `<main>`, `aria-label="Navigation principale"` sur `<aside>`, `aria-label="Navigation mobile"` sur la barre d'onglets mobile.
   - `aria-current="page"` sur l'élément actif.
   - `aria-hidden="true"` sur les icônes Material Symbols.
2. **Thème unique (Règle absolue) :**
   - L'application n'a **qu'un seul thème** : mode clair, barre latérale bleu nuit / ardoise sombre (`#2a3135`). Aucun mode sombre n'est implémenté ni proposé à l'utilisateur.
   - En mobile (< 768px), la barre latérale devient une barre de navigation en bas (`tableau_de_bord_mode_clair`).
3. **Ressources 100 % locales :**
   - Zéro CDN. Compilation locale PostCSS/Tailwind, polices locales `@fontsource/*`, `material-symbols` local, images dans `public/assets/images/`.

---

## 6. Décalages de Tokens : DESIGN.md vs code.html (Source de Vérité)

Le tableau suivant répertorie les divergences précises entre la documentation rédigée `DESIGN.md` et les configurations Tailwind réelles contenues dans les fichiers `code.html` des maquettes. Conformément aux consignes strictes du projet, **la configuration Tailwind de `code.html` prévaut systématiquement** :

| Élément / Jeton | Valeur DESIGN.md | Valeur Tailwind code.html | Décision & Justification |
|---|---|---|---|
| **Couleur Primaire (`primary`)** | `#0e8f9b` | `#00666f` | **`#00666f` retenu**. Le teal sombre de `code.html` offre un ratio WCAG de 4.9:1 sur fond blanc (contre 3.8:1 pour `#0e8f9b`, insuffisant pour le texte normal). Container : `#00818c`. |
| **Couleur Secondaire (`secondary`)** | `#e0a53a` | `#7e5700` | **`#7e5700` retenu**. Or ambré foncé garantissant la lisibilité des badges et étiquettes. Container : `#fdbe51`. |
| **Couleur Tertiaire (`tertiary`)** | Absent / non explicité | `#465d7b` | **`#465d7b` retenu** (Bleu acier opérationnel pour les états d'inventaire et maintenance). Container : `#5f7695`. |
| **Fond général de l'application (`background` / `surface`)** | `#eaf1f5` | `#f3fafe` | **`#f3fafe` retenu**. Présent sur l'intégralité des 10 maquettes `code.html`. Teinte fraîche et lumineuse. |
| **Fond Barre Latérale (`inverse-surface`)** | `#0a2540` (Bleu nuit profond) | `#2a3135` (Gris ardoise / bleu nuit sombre) | **`#2a3135` retenu**. C'est la couleur exacte de la sidebar dans `tableau_de_bord/code.html`. Adoucit le contraste tout en préservant le confort visuel. |
| **Bordures d'interface (`outline-variant`)** | `#d0d7de` | `#bdc9ca` | **`#bdc9ca` retenu**. Conforme à la config Tailwind. |
| **Rayons de courbure (Cards standard)** | `1rem` (16px) | `rounded-2xl` (16px à 24px) | **16px (`1rem`) pour cartes simples, 24px (`1.5rem`) pour cartes bento**. |
| **Multi-thème (Dark Mode)** | Prévu / évoqué | Absent des maquettes | **Thème clair unique imposé**. Pas de mode sombre en production. |

---

## 7. Fonctionnalités Visibles dans les Maquettes mais Absentes du Plan Initial

L'analyse exhaustive des 10 maquettes met en évidence **8 fonctionnalités opérationnelles** représentées graphiquement dans les écrans, mais non couvertes ou différées dans le plan de développement initial. Voici l'état des lieux et les recommandations pour chaque fonctionnalité :

### 7.1. Relogement par Glisser-Déposer (Drag-and-Drop) sur le Planning
- **Écran concerné :** `planning_grille_des_chambres` (Écran 05).
- **Description dans la maquette :** Déplacement direct d'un bloc de réservation d'une chambre à une autre ou d'une date à une autre avec recalcul automatique du tarif et détection de conflit de disponibilité.
- **Statut dans le plan initial :** Le plan prévoyait la consultation du planning et la modification par formulaire / modal, sans interaction drag-and-drop.
- **Proposition :**
  1. *Phase 1 (Actuelle) :* Réassignation de chambre via la modal de réservation ou action « Modifier l'attribution ».
  2. *Phase 2 :* Intégration de l'interaction glisser-déposer HTML5 / Angular CDK DragDrop avec verrouillage de confirmation (modal de validation du relogement pour éviter les manipulations involontaires sur écran tactile).

### 7.2. Écran Cuisine (KDS - Kitchen Display System)
- **Écran concerné :** Évoqué dans `point_de_vente_restaurant` (Écran 07) via le statut « Envoyé en cuisine (12:42) ».
- **Description dans la maquette :** Les commandes passées sur le POS restaurant génèrent des bons de préparation avec minuteur, statut de préparation (*En attente*, *En cuisson*, *Prêt*) et bip sonore.
- **Statut dans le plan initial :** Le plan couvre le POS restaurant, l'addition, le transfert sur folio chambre et l'encaissement, mais pas d'écran dédié pour le cuisinier.
- **Proposition :** Les commandes du restaurant sont persistées avec statut (`PENDING`, `PREPARING`, `SERVED`). Un écran cuisine léger pourra être ajouté ultérieurement dans une sous-route `/restaurant/kds`.

### 7.3. Scan et Pièce Jointe PDF de la Pièce d'Identité Client
- **Écran concerné :** `fiche_profil_client_m._mamadou_diop` (Écran 06).
- **Description dans la maquette :** Encadré « Passeport C01289432 • Validité 14/09/2028 » avec bouton « Télécharger la copie PDF du passeport » et prévisualisation du document officiel.
- **Statut dans le plan initial :** Le plan prévoit la saisie des métadonnées d'identité (numéro de pièce, type, pays) et leur chiffrement AES-256-GCM en base, mais pas le stockage d'images / documents scannés.
- **Proposition :**
  1. Respecter scrupuleusement la sécurité : ne jamais stocker de document d'identité non chiffré.
  2. Prévoir un champ optionnel d'upload de document chiffré côté serveur (AES-256-GCM) dans le cardex client en Phase 2, tout en masquant le bouton de téléchargement factice tant que le stockage de fichiers sécurisé n'est pas activé.

### 7.4. Inventaire des Pièces Détachées de Maintenance
- **Écran concerné :** `tickets_de_maintenance` (Écran 09).
- **Description dans la maquette :** Dans le détail d'un ticket de climatisation (Chambre 204), un panneau affiche « Pièces nécessaires : Filtre climatiseur Daikin 12000 BTU (En stock : 3 unités au magasin central) » avec bouton « Déstocker la pièce ».
- **Statut dans le plan initial :** Le plan couvre les tickets de maintenance (statut, priorité, affectation, coût de réparation en FCFA), mais pas la gestion complète d'un stock de pièces détachées avec inventaire permanent.
- **Proposition :** Conserver un champ texte libre `piecesUtilisees` et un champ montant `coutPiecesFcfa` sur le ticket de maintenance pour impacter les charges, sans créer un module d'inventaire complet de quincaillerie en Phase 1.

### 7.5. Envois Automatisés de Confirmations (WhatsApp, SMS, E-mail)
- **Écran concerné :** `modal_nouvelle_r_servation` (Écran 04) et `fiche_profil_client_m._mamadou_diop` (Écran 06).
- **Description dans la maquette :** Cases à cocher « Envoyer la confirmation par SMS (+221...) », « Notification WhatsApp Business » et « E-mail avec voucher PDF ».
- **Statut dans le plan initial :** Le plan fonctionne en offline-first local sans dépendance obligatoire à un compte Twilio, Infobip ou passerelle SMS locale.
- **Proposition :**
  1. Ajouter un bouton client-side `Partager via WhatsApp Web` (`https://wa.me/221.../?text=...`) générant un message préformaté prêt à envoyer par le réceptionniste depuis son poste ou smartphone, sans coût d'API ni passerelle externe.
  2. Traiter l'intégration API SMS / E-mail transactionnelle comme une extension future configurable dans les Paramètres.

### 7.6. Export des Rapports Comptables en Formats Excel (.xlsx) et PDF
- **Écran concerné :** `rapports_financiers_et_statistiques` (Écran 10).
- **Description dans la maquette :** Boutons d'action proéminents « Exporter le rapport comptable (Excel) » et « Télécharger l'état fiscal mensuel (PDF certifié) ».
- **Statut dans le plan initial :** Le plan prévoit la consultation des rapports en ligne et hors ligne (chiffre d'affaires, taux d'occupation, RevPAR en FCFA entiers), mais pas les moteurs d'export binaire Excel/PDF.
- **Proposition :**
  1. Implémenter l'export CSV UTF-8 (compatible Excel direct) et l'impression navigateur stylisée (CSS `@media print`) pour le PDF en Phase 1.
  2. Ajouter les librairies de génération XLSX / PDF côté client en phase de clôture financière si requis.

### 7.7. Support Multilingue (Langue Anglaise)
- **Écran concerné :** Menu déroulant de langue « FR | EN » présent dans l'en-tête de certaines maquettes.
- **Description dans la maquette :** Possibilité de basculer l'interface en anglais.
- **Statut dans le plan initial :** `AGENTS.md` stipule formellement : « Interface en français. Code en anglais, commentaires et messages affichés en français ».
- **Proposition :** L'interface reste strictement en français pour la version de production. Le sélecteur de langue est retiré ou masqué, conformément à la charte et à la convention du projet.

### 7.8. Clôture de Caisse Journalière « Rapport Z »
- **Écran concerné :** `point_de_vente_restaurant` (Écran 07) et `rapports_financiers_et_statistiques` (Écran 10).
- **Description dans la maquette :** Bouton « Clôturer la caisse (Rapport Z) » avec récapitulatif des encaissements par mode de règlement (Espèces, Wave, Orange Money, Carte bancaire, Prise en charge folio chambre) et vérification du fond de caisse.
- **Statut dans le plan initial :** Les encaissements sont rattachés aux réservations et tickets restaurant, mais la procédure comptable formelle de clôture « Z » quotidienne avec verrouillage des écritures n'était pas détaillée.
- **Proposition :** Intégrer la clôture de caisse quotidienne dans le module Facturation / Finance, permettant au gérant ou à la direction de figer les transactions d'une journée calendaire et d'imprimer le ticket de contrôle.


---

## 8. Écarts Voulus : Facturation, Folio Client & Encaissement (`/facturation`)

Dans le cadre de l'implémentation de la maquette `design/maquettes/facturation_folio_client_encaissement/`, les écarts suivants ont été appliqués de manière délibérée et rigoureusement documentés :

### 8.1. Données Fiscales & Légales Issues des Paramètres Établissement
- **Maquette Stitch :** Mentions en dur dans le code HTML (`Hôtel Boutique & Spa Océanique`, `NINEA : 004819230`, `RCCM : SN-THS-2021-B-114`, adresse statique).
- **Implémentation Angular :** Les informations légales, l'adresse de l'hôtel (`Quartier Grand Standing • Thiès, Sénégal`), le NINEA, le RCCM et le taux de TVA proviennent du service `HotelSettingsService`. Aucune donnée légale d'établissement n'est codée en dur dans le template.

### 8.2. Protection PII Absolue : Exclusion du Numéro de Passeport à l'Impression
- **Règle RGPD & CDP Sénégal :** Le numéro de passeport (`SN-982341-B`) ne doit en aucun cas figurer sur la facture ou le folio client imprimé remis au voyageur ou à des tiers.
- **Implémentation :** Le champ est neutralisé par la classe CSS `print:hidden` et les règles `@media print`, garantissant qu'aucune copie physique ou export PDF du document comptable ne divulgue cette donnée hautement confidentielle.

### 8.3. Horodatage en Heure Locale Sénégalaise
- **Maquette Stitch :** Heure statique `10:42 GMT`.
- **Implémentation :** L'heure est calculée dynamiquement au fuseau horaire de Dakar/Thiès (`GMT`).

### 8.4. Adaptation Géographique & Culinaire (Thiès vs Saly)
- Conformément à `docs/design/ADAPTATION-THIES.md` :
  - `Langoustes fraîches braisées de Saly & Bouteille Sancerre` $\to$ `Thiéboudienne Penda Mbaye royale & Bouteille de vin rouge`.
  - `Pirogue artisanale privée avec skipper (Teranga Nautic Saly)` $\to$ `Mise à disposition véhicule avec chauffeur (Excursion Réserve Bandia)`.
  - `Expérience — Sortie Pêche au Gros en Mer` $\to$ `Excursion guidée — Forêt de Bandia & Manufacture des Arts de Thiès`.
  - `Vue frontale mer, terrasse privée & petit-déjeuner inclus` $\to$ `Vue dégagée sur jardin arboré, terrasse privée & petit-déjeuner inclus`.
  - `Chambre 301 — Suite Océan Panoramique` $\to$ `Chambre 301 — Suite Panoramique`.

### 8.5. Taux de TVA et Taxe de Séjour Réglementaires
- **TVA Sénégalaise :** 10 % (taux légal réduit applicable au secteur de l'hôtellerie et de la restauration au Sénégal, contre 18 % dans la maquette initiale).
- **Taxe de Séjour :** 8 000 FCFA (calculée sur le barème légal : 4 nuits $\times$ 2 adultes $\times$ 1 000 FCFA), exonérée de TVA.

### 8.6. Double Onglet Opérationnel (Folio en Cours & Clôture Z de Caisse)
- L'écran supporte la navigation par onglets entre le folio client individuel (`#INV-2024-0542`) et le rapport de fin de journée de caisse (`Z de caisse`), permettant la visualisation instantanée des encaissements par canal (Wave, Espèces, Orange Money, Carte Bancaire) et le suivi du fond de tiroir physique.
