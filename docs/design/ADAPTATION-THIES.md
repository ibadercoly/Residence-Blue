# Adaptation du Contenu & Données Métier — Résidence Blue (Thiès)

> **Document de Référence pour l'Alignement Métier & Géographique**  
> **Établissement réel :** Résidence Blue — Hôtel Boutique de 12 clés, Restaurant & Bar « La Teranga »  
> **Localisation réelle :** Grand Standing, Thiès (Sénégal) — Situé à l'intérieur des terres (à ~45 km de la côte atlantique et de Somone, à 25 minutes de l'aéroport international Blaise Diagne AIBD).  
> **Règle absolue (AGENTS.md) :** L'interface reproduit **À L'IDENTIQUE le STYLE** des maquettes (`code.html` fait foi). Seul le contenu textuel et contextuel est adapté pour refléter fidèlement un hôtel boutique à Thiès.

---

## 1. Occurrences de Contenu Balnéaire et Adaptations pour Thiès

Les maquettes initiales issues de Google Stitch portaient le nom de travail « Saly Coastal Boutique Hospitality » et comportaient de nombreuses références océaniques, côtières ou maritimes inadéquates pour un hôtel implanté à Thiès (Grand Standing).

Le tableau ci-dessous recense **chaque occurrence balnéaire** identifiée dans les fichiers `design/maquettes/*/code.html`, avec son remplacement officiel pour Thiès :

| Fichier source | Texte actuel (Maquette Saly) | Texte adapté (Résidence Blue — Thiès) | Justification & Contexte |
| :--- | :--- | :--- | :--- |
| `tableau_de_bord/code.html` (Hero banner) | `Boutique Hôtel 12 Chambres • Petite Côte, Sénégal • Vendredi 24 Mai • Service Conciergerie & Exploitation` | `Boutique Hôtel 12 Chambres • Grand Standing, Thiès • Vendredi 24 Mai • Service Conciergerie & Exploitation` | Remplacement de « Petite Côte » par la localisation réelle « Grand Standing, Thiès ». |
| `tableau_de_bord/code.html` (Sidebar bas) | `Front de Mer` / `Marée haute • 28°C` | `Météo Thiès` / `Ensoleillé • 29°C` | Thiès est à l'intérieur des terres ; affichage de la météo sahélienne locale sans marée. |
| `tableau_de_bord/code.html` (Widget Météo) | `Météo marine & Marée` / `Marée haute` / `Brise côtière 14 km/h` / `Eau de mer 27°C` | `Climat & Espaces Extérieurs` / `Indice chaleur modéré` / `Harmattan léger 12 km/h` / `Bassin piscine 28°C` | La Résidence Blue dispose d'un espace piscine & patio arboré, pas d'accès direct à l'océan. |
| `tableau_de_bord/code.html` (Widget Météo) | `Transats & paillotes préparés au front de mer` | `Transats & parasols installés autour de la piscine et du patio` | Adaptation aux installations réelles de détente de l'hôtel. |
| `tableau_de_bord/code.html` (Arrivées) | `Chambre 01 — Suite Océan` | `Chambre 301 — Suite Panoramique` | Les suites réelles sont aux étages avec vue sur les jardins et la ville de Thiès. |
| `tableau_de_bord/code.html` (Arrivées) | `Chambre 05 — Deluxe Plage` | `Chambre 201 — Deluxe Balcon Terrasse` | Catégorie standardisée conforme à l'inventaire des 12 chambres. |
| `tableau_de_bord_mode_clair/code.html` (Header) | `Petite Côte • Marée haute à 16h40` | `Grand Standing • Ensoleillé 29°C` | Suppression de l'horaire de marée marine sur mobile. |
| `tableau_de_bord_mode_clair/code.html` (Hero) | `Vue en direct de la résidence bord de mer` | `Ambiance sereine au cœur de Grand Standing` | Alignement sur l'atmosphère paisible et résidentielle de Thiès. |
| `tableau_de_bord_mode_clair/code.html` (Chambres) | `Suite Océan`, `Bungalow Alizé`, `Deluxe Plage` | `Suite Panoramique`, `Deluxe Balcon`, `Standard Patio` | Harmonisation des libellés avec les 3 catégories réelles (Standard, Deluxe, Suite). |
| `connexion_r_sidence_blue_pms/code.html` | `12 Clés & Restaurant Front de Mer` | `12 Chambres d'Exception & Restaurant La Teranga` | Remplacement de « Front de Mer » par l'identité du restaurant. |
| `connexion_r_sidence_blue_pms/code.html` | `Front de Mer Atlantique` / `Marée haute` | `Thiès — Grand Standing` / `Ciel dégagé • 28°C` | Suppression de la mention atlantique sur la page d'authentification. |
| `fiche_profil_client_m._mamadou_diop/code.html` | `Table terrasse vue mer` | `Table terrasse vue piscine & jardin` | Orientation réelle de la terrasse du restaurant La Teranga. |
| `fiche_profil_client_m._mamadou_diop/code.html` | `2 draps de bain de plage supplémentaires pour la terrasse` | `2 draps de bain de piscine supplémentaires pour la terrasse` | Serviettes de piscine pour l'espace détente extérieur. |
| `fiche_profil_client_m._mamadou_diop/code.html` | `réservation d'un bateau pour une sortie pêche au gros samedi matin (Pointe Sarène)` | `réservation excursion Réserve de Bandia & transfert AIBD (Diass)` | Activités de conciergerie réalistes à proximité immédiate de Thiès. |
| `fiche_profil_client_m._mamadou_diop/code.html` | `Deluxe Mer`, `Suite Océan Panoramique`, `Bungalow Baobab` | `Deluxe Balcon`, `Suite Panoramique`, `Standard Patio` | Alignement Cardex client sur la nomenclature officielle. |
| `facturation_folio_client_encaissement/code.html` | `Langoustes fraîches braisées de Saly & Bouteille Sancerre` | `Thiéboudienne Penda Mbaye royale & Bouteille de vin rouge` | Carte gastronomique sénégalaise authentique du restaurant La Teranga. |
| `facturation_folio_client_encaissement/code.html` | `Pirogue artisanale privée avec skipper (Teranga Nautic Saly)` | `Mise à disposition véhicule avec chauffeur (Excursion Réserve Bandia)` | Prestation de conciergerie terrestre adaptée. |
| `facturation_folio_client_encaissement/code.html` | `Expérience — Sortie Pêche au Gros en Mer` | `Excursion guidée — Forêt de Bandia & Manufacture des Arts de Thiès` | Patrimoine culturel et naturel de la région de Thiès. |
| `facturation_folio_client_encaissement/code.html` | `Vue frontale mer, terrasse privée & petit-déjeuner inclus` | `Vue dégagée sur jardin arboré, terrasse privée & petit-déjeuner inclus` | Description exacte des atouts de la Suite 301. |
| `maintenance_suivi_des_tickets_techniques/code.html` | `Compresseurs extérieurs exposés à l'air salin marin corrosif` | `Filtres de climatisation exposés à la poussière de latérite sahélienne` | Problématique technique réelle de Thiès (poussière et harmattan, et non corrosion saline). |
| `modal_nouvelle_r_servation/code.html` | `Suite Océan Vue Mer (301)`, `Deluxe Plage (104)`, `Chambre Alizé (102)` | `Suite Panoramique (301)`, `Deluxe Balcon (201)`, `Standard Patio (101)` | Menu déroulant de sélection des chambres conforme à l'inventaire 101-106, 201-204, 301-302. |
| `point_de_vente_restaurant_la_teranga/code.html` | `Carpaccio de Saint-Jacques de la Petite Côte` | `Carpaccio de Mérou blanc de Somone & agrumes locaux` | Approvisionnement réaliste depuis les mareyeurs régionaux. |
| `point_de_vente_restaurant_la_teranga/code.html` | `Lotte de mer grillée aux épices de Joal` | `Filet de Capitaine braisé aux aromates de Thiès` | Cuisine valorisant les produits du marché central de Thiès. |
| `planning_des_r_servations/code.html` | Colonnes et catégories `Bungalow Océan`, `Deluxe Plage`, `Alizés` | `Suite (301-302)`, `Deluxe (201-204)`, `Standard (101-106)` | Matrice Gantt rigoureusement alignée sur les 12 chambres de l'hôtel. |
| `rapports_statistiques_financi_res/code.html` | `Balcon pleine vue mer, Saly Plage` | `Balcon avec vue sur le patio paysager, Grand Standing` | Fiche de performance par catégorie. |
| `rapports_statistiques_financi_res/code.html` | `Excursions & Pêche en haute mer` | `Excursions terrestres & Transferts AIBD` | Rubrique de revenus annexes dans les états financiers. |
| `rapports_statistiques_financi_res/code.html` | `Pic Ascension (09-12 Mai) • Pic Pentecôte (20 Mai)` | `Période Grand Magal de Touba • Pâques • Fêtes de fin d'année` | Les pics d'occupation majeurs à Thiès sont liés aux événements religieux régionaux et aux vacances nationales. |

---

## 2. Éléments à Ne Pas Reproduire en Version de Production

Certains éléments présents dans les maquettes Google Stitch constituent des artefacts de démonstration, des placeholders de design ou des non-conformités réglementaires strictes qui **ne doivent sous aucun prétexte apparaître en production** :

| Élément présent dans la maquette | Type de risque / Non-conformité | Remplacement prévu en production |
| :--- | :--- | :--- |
| **Bascule Mode Sombre (`dark mode`)** | Contradiction directe avec la consigne architecturale : *« Il n'y a QU'UN SEUL thème (clair, barre latérale bleu nuit `#2a3135`). N'ajoute aucun mode sombre. »* | **Suppression totale** du commutateur de thème et de la classe `.dark`. L'avatar utilisateur reste un élément de profil non cliquable ou ouvrant le menu utilisateur. |
| **Profils et identités fictives en dur** | Noms de démonstration (« Mamadou Diop », « Sarah Jenkins ») codés en dur dans le HTML. | **Dynamisation complète** via les modèles Prisma (`User`, `Guest`, `Reservation`) et injection de données réelles ou vides par défaut. |
| **Numéro de passeport en clair dans l'UI** | Violation de la loi sénégalaise sur la protection des données personnelles (CDP) et de la règle `AGENTS.md` (*« Données sensibles chiffrées en AES-256-GCM »*). | **Chiffrement AES-256-GCM** en base PostgreSQL ; masquage partiel à l'affichage (`SN••••••482`) avec droit de révélation réservé à la DIRECTION/RÉCEPTION sous trace d'audit. |
| **Champs de formulaire préremplis de données statiques** | Champs d'adresses, e-mails et téléphones hardcodés dans `modal_nouvelle_r_servation.html`. | Champs vides avec `placeholder` descriptif accessible ou préremplis uniquement lors d'une modification de réservation existante. |
| **Numéros fiscaux en dur (NINEA, RCCM)** | Mentions factices dupliquées sur les folios : `NINEA: 009845123 2V3`, `RCCM: SN.THS.2023.B.8912`. | **Paramètres dynamiques d'établissement** configurables dans le module `/parametres` et stockés dans la base. |
| **Numéro de support technique fantaisiste** | Téléphone support `+221 33 800 00 00` et e-mail `support@stitch-pms.com`. | Coordonnées réelles du support interne Résidence Blue (configurables via variables d'environnement). |
| **Mention légale factice « Conforme RGPD / CDP Sénégal »** | Badge déclaratif non audité affiché dans le footer de connexion. | Remplacement par un lien vers la politique de confidentialité locale et registre interne des consentements. |
| **Taux de TVA codé en dur à 18 %** | Dans `facturation_folio_client_encaissement.html`, la TVA est calculée à 18 % au lieu du taux réduit sénégalais applicable au secteur hôtelier agréé (10 %). | **Taux paramétrable** issu de la configuration fiscale de l'établissement (par défaut 10 % pour l'hébergement au Sénégal, ou exonération selon convention). |
| **Scripts et styles distants via CDN** | `<script src="https://cdn.tailwindcss.com">` et balises Google Fonts distantes. | **Zéro CDN en production** : compilation Tailwind PostCSS locale, polices Manrope/Newsreader et icônes Material Symbols hébergées à 100 % en local. |
| **Montants décimaux en FCFA** | Aucun centime n'existe pour le Franc CFA (`XOF`). Les maquettes ne doivent jamais afficher de virgule flottante. | **Entiers stricts partout** (`formatFcfa()` garantissant des entiers sans décimales). |

---

## 3. Données Métier à Faire Valider par la Direction de l'Hôtel

Avant le déploiement opérationnel final sur site à Grand Standing, les points suivants doivent être soumis à la validation formelle de la direction générale de la Résidence Blue :

1. **Nomenclature officielle des 12 chambres physiques :**
   - Confirmation de la répartition :
     - 6 Chambres **Standard** (101, 102, 103, 104, 105, 106) au 1er étage (tarif de base : 35 000 FCFA).
     - 4 Chambres **Deluxe** (201, 202, 203, 204) au 2e étage avec balcon (tarif de base : 55 000 FCFA).
     - 2 **Suites** (301, 302) au 3e étage avec terrasse panoramique (tarif de base : 95 000 FCFA).
   - Validation des éventuels noms d'usage personnalisés (ex. « Suite Teranga », « Chambre Baobab ») souhaités en complément du numéro.

2. **Grille tarifaire et conditions de séjour :**
   - Montant des suppléments : lit d'appoint enfant, lit bébé, petit-déjeuner continental servi en chambre.
   - Montant légal de la **Taxe de séjour** de la commune de Thiès (usuellement 1 000 FCFA par nuitée et par adulte).
   - Politique des arrhes obligatoires à la réservation (ex. 30 % ou 50 % du montant total).

3. **Paramètres fiscaux, juridiques et financiers :**
   - Numéro d'Identification Nationale des Entreprises et Associations (**NINEA**) officiel.
   - Numéro du Registre du Commerce et du Crédit Mobilier (**RCCM**) au Tribunal de Commerce de Thiès.
   - Régime de TVA applicable à l'établissement (10 % taux réduit hébergement touristique ou 18 % régime général).
   - Comptes marchands Wave Business et Orange Money Pro pour les encaissements mobiles.

4. **Carte et tarification du Restaurant & Bar « La Teranga » :**
   - Liste des plats signatures, formules petit-déjeuner et carte des boissons/vins locaux et importés.
   - Heures d'ouverture des services (petit-déjeuner, déjeuner, dîner, room-service).

5. **Catalogue des prestations de conciergerie :**
   - Grille tarifaire des transferts navette AIBD (Aéroport International Blaise Diagne) — Résidence Blue.
   - Partenariats d'excursion locaux : Réserve écologique de Bandia, village artisanal de Thiès, Manufacture des Arts Décoratifs, cours de poterie de Thiès.

6. **Calendrier des événements régionaux à haute saisonnalité :**
   - Dates et pics de surréservation à configurer dans le calendrier : Grand Magal de Touba (flux majeur transitant par Thiès), Gamou de Tivaouane (à 20 km de Thiès), Pâques, fêtes de fin d'année et festivals culturels locaux.
