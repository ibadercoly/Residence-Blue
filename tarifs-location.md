# Prompt : tarifs réels et côté location (branche feature/tarifs-location)

Mode autonome, aucune question. Branche feature/tarifs-location depuis la branche principale à jour. Concerne
le CÔTÉ LOCATION : catégories de chambres, tarifs réels de l'hôtel, calcul du prix d'une réservation, et les
prestations (salle de séminaire, pauses). Ne modifie ni le calcul de la TVA et de la taxe de séjour, ni la
numérotation des factures, ni les règles anti-chevauchement. N'affiche jamais le contenu des .env. Procède en
TROIS commits (1 données et calcul, 2 écran des tarifs, 3 réservation et nettoyage), tests verts après chacun.
Avant de commencer, lis le code réel (Room, room types, réservations, génération des lignes de facture,
paramètres de l'hôtel, formulaire de réservation, planning, seeds) et dis en 8 lignes ce qui existe déjà du
côté tarifs, pour ne rien refaire en double.

## DONNÉES RÉELLES (document « TARIF PUBLIC » de l'hôtel, lu sur une photo : vérifie chaque chiffre dans
## docs/location/TARIFS.md, et marque « à vérifier » tout ce qui est incertain)
B&B = nuit avec petit-déjeuner. Prix en FCFA, entiers. Unité supposée : PAR NUIT (à faire confirmer).

| Situation | Chambre Standard | Chambre Confort | Appartement |
|---|---|---|---|
| 1 personne | 30 000 | 35 000 | 50 000 |
| 2 personnes | 35 000 | 40 000 | 55 000 (couple, 1 chambre) ; 65 000 (2 personnes, 2 chambres) |
| 3 personnes, 2 chambres | non proposé | non proposé | 75 000 |
| 3 personnes, 3 chambres | non proposé | non proposé | tarif non défini |
| 4 personnes, 2 chambres | non proposé | non proposé | 85 000 |
| 4 personnes, 3 chambres | non proposé | non proposé | tarif non défini |
| 5 personnes | non proposé | non proposé | 95 000 |
| 6 personnes | non proposé | non proposé | 105 000 |

Prestations : Salle de séminaire 100 000 FCFA par journée ; Pause-café 3 000 FCFA par personne ; Pause
déjeuner 7 000 FCFA par personne (1 plat au menu) ; Pause déjeuner 10 000 FCFA par personne (2 plats en buffet).

Identité de l'hôtel (pied de page du document) : Résidence Blue, Rue 47 Grand Standing, derrière station EDK,
Thiès, code postal 21000 (Sénégal) ; NINEA 006927349 2F2 (lecture d'une photo : À VÉRIFIER sur le document
officiel) ; tél. +221 33 954 18 68, +221 78 426 64 56, +221 77 541 69 11 ; e-mail info@residencesblue.com ;
site www.residencesblue.com.
RÈGLE : ne comble JAMAIS une case « non proposé » ou « non défini » avec un prix inventé.

## COMMIT 1 : DONNÉES ET CALCUL DU PRIX
- Modèle (migration Prisma SANS perte) : catégories de chambre (Standard, Confort, Appartement), et une grille
  de tarifs : catégorie, nombre de personnes, nombre de chambres utilisées (seulement pour l'appartement),
  libellé, prix par nuit en FCFA entier, actif. Une case non proposée n'a pas de ligne ; une case « non
  défini » est une ligne sans prix (à définir). Chaque chambre appartient à UNE catégorie. L'appartement est une
  seule unité réservable avec le champ « chambres utilisées » à la réservation (à faire confirmer).
- Chargement des tarifs RÉELS ci-dessus par migration ou script idempotent autorisé en production (ce sont les
  vraies données, pas de la démonstration), sans écraser ce que la directrice a déjà modifié. Même chose pour
  l'identité de l'hôtel (paramètres de l'hôtel : seulement les champs VIDES, jamais d'écrasement ; liste dans
  ton résumé ce qui a été rempli).
- Chambres existantes : ne devine pas leur catégorie. Si une chambre n'en a pas, elle reçoit « À classer » et la
  directrice la choisit (commit 2). Aucun numéro de chambre inventé.
- Fonction de calcul unique et testable côté serveur : prix par nuit = tarif de (catégorie, personnes,
  chambres) ; total = prix par nuit x nombre de nuits. Cas sans tarif (case non proposée ou non définie) :
  erreur claire en français simple (« Pas de tarif pour 3 personnes en chambre Standard. Choisissez
  un appartement ou demandez à la direction. »), jamais un prix par défaut. Le prix est FIGÉ à la création de
  la réservation : une modification ultérieure des tarifs ne change pas les réservations existantes ni les
  factures émises.
- Prix modifiable à la main pour une réservation (négociation) : DIRECTION seulement, motif obligatoire,
  journal d'actions ; la réception voit « Prix fixé par la direction ». Si un mécanisme de remise existe déjà,
  réutilise-le au lieu d'en créer un second.
- Le serveur calcule le prix ; il ne fait jamais confiance au prix envoyé par le navigateur. La TVA, la taxe de
  séjour et l'arrondi continuent d'utiliser la logique existante ; indique dans ton résumé si le code traite
  les prix des chambres comme TTC ou HT, sans le modifier.
- Prestations (salle de séminaire, pauses) : ajoutées au catalogue des « autres ventes » existant (ne crée pas
  un second catalogue), avec unité (journée ou personne), prix et quantité, ajoutables à une note de séjour,
  à une facture d'entreprise ou à un client de passage dans Facturation. Pas de calendrier de la salle dans
  cette version.
- Anciennes valeurs par défaut à retirer : Room.pricePerNight @default(35000), surface et vue par défaut
  (DAT-003), prix de secours 35 000, 55 000 et 95 000 FCFA dans l'interface et les services. Les champs
  « haute saison » et « entreprise » ne sont plus utilisés : ne les supprime pas, masque-les et liste-les.

## COMMIT 2 : ÉCRAN DES TARIFS (direction seulement)
Carte « Tarifs » dans Administration (écran existant, aucune nouvelle entrée de menu) :
- Grille de la même forme que le document papier : lignes = situations, colonnes = Standard, Confort,
  Appartement. Chaque case : prix modifiable en FCFA, « Non proposé » ou « À définir » (jamais vide ni zéro).
  Boutons « Enregistrer » et « Annuler les changements ». Sous la grille, liste des prestations modifiable.
- Un changement de prix est écrit dans le journal d'actions (ancien prix, nouveau prix, qui, quand) et ne
  s'applique qu'aux NOUVELLES réservations ; l'écran le dit en une phrase.
- Dans Chambres (direction) : choix de la catégorie de chaque chambre, avec le message « À classer » sur les
  chambres sans catégorie.
- Serveur : routes réservées à la direction (403 pour les autres, appels directs compris). Textes en français
  simple, 16 px minimum, aucune barre de défilement horizontale à 360, 768, 1024 et 1440 px.

## COMMIT 3 : RÉSERVATION ET NETTOYAGE
- Formulaire de réservation : après le choix de la chambre, de la durée et du nombre de personnes (et du nombre
  de chambres pour l'appartement), il affiche en une ligne : « Chambre Standard, 2 personnes, petit-déjeuner
  inclus : 35 000 FCFA par nuit, total 105 000 FCFA pour 3 nuits ». Si aucun tarif n'existe : le message
  d'erreur ci-dessus et le bouton d'enregistrement reste désactivé. Pas de nouveau champ de prix à saisir pour
  la réception. Le planning et la carte de chambre affichent la catégorie, et le prix seulement aux comptes
  qui ont « Voir les montants ».
- Le prix et le total de la réservation alimentent la note et la facture existantes (lignes d'hébergement)
  sans changer leur mise en forme ni leur numérotation.
- Retire du code livré et des écrans tout faux tarif restant ; recherche dans apps et packages les montants
  de démonstration (35000, 55000, 95000) et liste ce qui reste et pourquoi.
- Écris docs/location/A-VALIDER.md : questions à poser à la directrice, chacune avec la valeur utilisée par
  défaut : (1) le prix est-il bien par nuit et petit-déjeuner inclus ? (2) les prix incluent-ils la TVA et la
  taxe de séjour ? (3) quelles chambres sont Standard, Confort ou Appartement, et combien d'appartements ?
  (4) de combien de chambres se compose un appartement, et les chambres sont-elles réservables séparément ?
  (5) tarif pour 3 ou 4 personnes dans 3 chambres, et pour plus de 2 personnes en Standard ou Confort ?
  (6) existe-t-il d'autres tarifs (entreprise, agence, long séjour, haute saison) ? (7) enfants, lit
  supplémentaire, petit-déjeuner en supplément ? (8) quelles prestations réserver sur le planning (salle) ?
  (9) NINEA et coordonnées à confirmer sur le document officiel.

## TESTS (base de test séparée, jamais la base de développement)
Tableau de cas unitaire de la fonction de calcul : chaque case définie de la grille (valeurs exactes), chaque
case non proposée ou non définie (erreur, jamais un prix), plusieurs nuits, appartement avec 1, 2 et 3
chambres, prix figé après modification des tarifs, prix modifié par la direction avec motif (refus pour la
réception, journal écrit) ; le serveur refuse un prix envoyé par le navigateur ; les factures émises avant le
changement de tarif ne bougent pas ; la TVA et la taxe de séjour donnent les mêmes résultats qu'avant sur des
cas de référence ; migration d'une base existante sans perte, chambres sans catégorie « À classer » ; la
directrice modifie une case, les réservations suivantes l'utilisent ; 403 pour les autres profils ; les
prestations s'ajoutent à une note ; aucune valeur 35000, 55000, 95000 par défaut dans le code ni dans le
paquet construit ; E2E du formulaire de réservation (une ligne de prix claire, bouton désactivé sans tarif) ;
scrollWidth <= clientWidth aux 4 largeurs ; captures d'écran. Lance lint, tests et build à chaque commit,
résume en trois lignes (un par commit), liste ce qui n'a pas pu être fait sans réponse aux questions de
A-VALIDER.md, et ne fusionne rien avant ma validation.
