# Points à valider avec la directrice — Tarifs & Location

Ce document recense les **9 questions** nécessitant une confirmation officielle de la directrice de Résidence Blue, avec pour chacune la **valeur par défaut actuellement utilisée par le logiciel** afin de permettre une exploitation immédiate sans rien inventer.

---

### 1. Unité des prix et inclusion du petit-déjeuner
- **Question** : Les prix affichés sur la fiche « TARIF PUBLIC » sont-ils bien **par nuit** et **petit-déjeuner inclus** (B&B) pour toutes les catégories (Standard, Confort, Appartement) ?
- **Valeur utilisée par défaut** : Prix **par nuit** en FCFA entiers, **petit-déjeuner inclus** (`breakfastIncluded = true`).

### 2. TVA et taxe de séjour
- **Question** : Les tarifs publics (ex. 30 000 FCFA, 35 000 FCFA, etc.) incluent-ils déjà la **TVA** (TTC) et la **taxe de séjour**, ou bien l'une ou l'autre s'ajoute-t-elle en sus ?
- **Valeur utilisée par défaut** : Logique existante conservée telle quelle : montants d'hébergement traités en **TTC** (TVA extraite du total dans Facturation) et **taxe de séjour ajoutée en sus** (1 000 FCFA / nuit / adulte par défaut, hors TVA).

### 3. Classement des chambres existantes et nombre d'appartements
- **Question** : Quelles chambres exactes de l'hôtel appartiennent aux catégories **Standard**, **Confort** et **Appartement**, et combien d'appartements compte l'établissement ?
- **Valeur utilisée par défaut** : Aucune catégorie devinée. Les chambres non classées portent le libellé **« À classer »** et ne peuvent être réservées qu'après classement par la directrice dans **Chambres**.

### 4. Composition d'un appartement et réservation séparée
- **Question** : De combien de chambres se compose chaque **Appartement** (2 ou 3 chambres ?), et les chambres d'un appartement sont-elles réservables séparément ou l'appartement est-il loué comme une seule unité entière ?
- **Valeur utilisée par défaut** : L'appartement est modélisé comme **une seule unité réservable** (1 chambre physique dans le planning), avec un sélecteur **« Chambres utilisées »** (1, 2 ou 3) à la réservation pour appliquer le tarif correspondant.

### 5. Tarifs manquants (Appartement 3 chambres et > 2 personnes en Standard/Confort)
- **Question** :
  - Quel est le tarif pour **3 personnes dans 3 chambres** et **4 personnes dans 3 chambres** en Appartement ?
  - Existe-t-il un tarif pour **plus de 2 personnes** en chambre Standard ou Confort ?
- **Valeur utilisée par défaut** :
  - Appartement 3 pers. / 3 ch. et 4 pers. / 3 ch. : **« À définir »** (`null`, aucun prix inventé, réservation bloquée jusqu'à saisie dans Administration → Tarifs).
  - Plus de 2 personnes en Standard ou Confort : **« Non proposé »** (réservation bloquée avec message d'orientation vers un appartement ou la direction).

### 6. Autres grilles tarifaires (entreprise, agence, long séjour, haute saison)
- **Question** : Existe-t-il d'autres tarifs spécifiques (**entreprise / corporate**, **agence**, **long séjour**, **haute saison**) à activer dans le logiciel ?
- **Valeur utilisée par défaut** : Grille unique **Tarif Public**. Les anciens champs `highSeasonPricePerNight` et `corporatePricePerNight` sont conservés en base mais **masqués** dans l'interface. Les négociations ponctuelles passent par la **surcharge Direction avec motif** ou la **remise** existante.

### 7. Enfants, lit supplémentaire et petit-déjeuner en supplément
- **Question** : Quelle est la règle tarifaire pour les **enfants** (gratuits jusqu'à quel âge ? comptés dans le nombre de personnes ?), le **lit supplémentaire**, et le **petit-déjeuner en supplément** (ou déduit si non pris) ?
- **Valeur utilisée par défaut** : `guestsCount = adultsCount + childrenCount` pour la lecture de la grille ; pas de supplément lit ni de déduction automatique petit-déjeuner.

### 8. Prestations à suivre sur un planning (salle de séminaire)
- **Question** : Souhaitez-vous à terme gérer la **salle de séminaire** (ou d'autres prestations) sur un planning dédié avec détection de chevauchement ?
- **Valeur utilisée par défaut** : Les 4 prestations (Salle de séminaire, Pause-café, Pause déjeuner 1 plat, Pause déjeuner 2 plats buffet) sont facturables depuis le catalogue **Autres ventes** (sur note de séjour ou facture directe entreprise/client de passage), **sans calendrier de salle** dans cette version.

### 9. NINEA et coordonnées officielles de l'hôtel
- **Question** : Confirmez-vous les informations lues sur la photo du document « TARIF PUBLIC » ?
  - NINEA : **`006927349 2F2`** *(lecture sur photo — à vérifier impérativement sur l'attestation officielle)*
  - Adresse : `Rue 47 Grand Standing, derrière station EDK, Thiès 21000 (Sénégal)`
  - Téléphones : `+221 33 954 18 68`, `+221 78 426 64 56`, `+221 77 541 69 11`
  - E-mail : `info@residencesblue.com`
  - Site web : `www.residencesblue.com`
- **Valeur utilisée par défaut** : Renseignées uniquement dans les champs **vides** de `hotel_settings` (aucune donnée déjà existante n'a été écrasée).
