# Prompt : Administration, comptes et accès (feature/administration-comptes)

Mode autonome, aucune question. Branche feature/administration-comptes depuis la branche courante.
Crée le menu « Administration », visible UNIQUEMENT par le compte directeur : dernière entrée de la
barre latérale, route /administration et sous-routes. Pour tous les autres, l'entrée est absente et
les routes (interface et API) renvoient 403. Lis d'abord le code d'authentification et de rôles
existant (guards, @Roles, schema.prisma, création d'utilisateurs, packages/shared) et ne casse aucun
écran. N'affiche jamais le contenu des .env. L'écran « Paramètres » existant (TVA, NINEA, tarifs) n'est
pas modifié.

## 1. MODÈLE D'ACCÈS

- Chaque utilisateur a une liste d'accès par écran, avec 3 niveaux : Aucun accès, Lecture, Lecture et
  modification. Écrans : Accueil, Planning, Chambres, Clients, Facturation, Restaurant, Cuisine,
  Rapports. « Administration » n'est jamais attribuable. La Carte (plats et prix) et l'apparence
  restent réservées au directeur.
- Droits particuliers (interrupteurs) : « Voir les montants » (prix, totaux, chiffre d'affaires),
  « Encaisser un paiement », « Changer l'état d'une chambre (ménage, maintenance) »,
  « Annuler une commande ou une réservation ».
- Restent RÉSERVÉS au directeur, non attribuables : supprimer, avoirs et annulation de paiement,
  check-out forcé, réinitialisation des données, gestion des comptes, apparence, gestion de la carte.
- Profils de départ (modèles qui préremplissent les accès, modifiables ensuite) : Assistant(e) de
  réception, Assistant(e) du restaurant (Restaurant en modification, encaisser, annuler ; JAMAIS
  l'écran Cuisine), Cuisinier (Cuisine en modification, rien d'autre, jamais de prix ni de nom de
  client), Ménage (Chambres en lecture et « Changer l'état d'une chambre »), Technique (Chambres en
  lecture), Comptable (Facturation et Rapports en lecture, voir les montants).
- Regroupe les rôles en double : CUISINE et CUISINIER deviennent un seul profil Cuisinier ; SERVEUR et
  RESTAURANT deviennent un seul profil Assistant(e) du restaurant. Migration Prisma sans perte : les
  utilisateurs existants reçoivent les accès équivalents à leur rôle actuel ; documente la
  correspondance dans docs/administration/ACCES.md.
- Le serveur vérifie l'accès sur CHAQUE route (décorateur du type @Acces('planning','ECRITURE'),
  droits particuliers inclus), à partir de la base, jamais d'un en-tête ni d'une donnée envoyée par
  le navigateur. Les montants ne sont pas renvoyés à qui n'a pas le droit, y compris dans les flux
  temps réel (SSE).
- La barre latérale n'affiche que les écrans accessibles ; une adresse tapée à la main sans accès
  redirige vers le premier écran autorisé. La connexion arrive sur ce premier écran.

## 2. COMPTE DIRECTEUR PROTÉGÉ

- Marque le compte DIRECTION existant comme administrateur principal (s'il y en a plusieurs, marque le
  plus ancien et signale-le). Il n'existe qu'un seul administrateur : on ne peut pas en créer un autre.
- Ce compte ne peut JAMAIS être supprimé, désactivé, rétrogradé ni voir ses droits réduits : le service
  répond 403 même pour des appels directs à l'API. Il peut seulement modifier son e-mail et son mot de
  passe.
- Changer l'e-mail ou le mot de passe exige le mot de passe actuel (et le code de double
  authentification si elle est activée). Mot de passe : politique de force existante, et toutes les
  autres sessions de ce compte sont fermées après le changement. L'e-mail doit rester unique.

## 3. GESTION DES COMPTES (/administration/comptes)

- Tableau à défilement vertical interne visible (15 lignes visibles, en-tête collant, recherche) :
  nom, e-mail, profil, état (pastille Actif, Désactivé), dernière connexion, boutons visibles
  « Modifier », « Désactiver » (ou « Réactiver »), « Supprimer ». La ligne du directeur porte un
  cadenas et n'a que « Modifier l'e-mail et le mot de passe ». Sous 768 px : cartes.
- « + Créer un compte » ouvre une page pleine (pas de tiroir), tout visible : (a) nom et e-mail,
  (b) profil de départ en grandes cartes sélectionnables, (c) « Accès par écran » : pour chaque écran
  trois choix visibles (Aucun accès, Lecture, Lecture et modification), (d) droits particuliers en
  interrupteurs, (e) à droite, un aperçu en direct « Ce que cette personne verra » (les entrées du
  menu qui apparaîtront), (f) mot de passe provisoire généré, affiché UNE SEULE FOIS avec boutons
  « Copier » et « Imprimer la fiche » ; la personne doit le changer à sa première connexion (écran
  dédié obligatoire avant tout autre).
- « Modifier » réutilise la même page. Changement d'accès : effet immédiat (au plus 1 requête).
  « Réinitialiser le mot de passe » génère un nouveau mot de passe provisoire (affiché une fois) et
  ferme les sessions.
- « Désactiver » : réversible, confirmation simple, le compte ne peut plus se connecter, TOUTES ses
  sessions et jetons sont révoqués et ses flux temps réel fermés à la requête suivante, ses données
  restent. « Réactiver » le rétablit.
- « Supprimer » : retire le compte de la liste et libère son e-mail, sans effacer l'historique
  (factures, paiements, commandes, réservations et journal gardent le nom suivi de « (compte
  supprimé) »). Confirmation en tapant le nom du compte ET le mot de passe du directeur. Aucune
  suppression possible du directeur.
- Journal d'actions pour : création, modification d'accès, désactivation, réactivation,
  réinitialisation de mot de passe, suppression, changement d'e-mail ou de mot de passe du directeur.
- Mots de passe hachés (argon2id), jamais stockés ni journalisés en clair, jamais renvoyés par l'API.
  Limitation des tentatives sur ces routes.

## CONTRAINTES

Aucun scroll horizontal à 360, 768, 1024 et 1440 px, aucun menu caché (rien dans des menus ⋯),
boutons de 44 px minimum, textes de 16 px minimum, mots simples en français, accessible au clavier.

## TESTS (base de test séparée, jamais la base de développement)

Chaque rôle sauf directeur : 403 sur /api/administration et menu absent ; création d'un compte avec
mot de passe provisoire et changement obligatoire ; un compte sans accès à Planning reçoit 403 sur les
routes du Planning (appel direct) et est redirigé en tapant l'adresse ; l'assistant du restaurant ne voit
pas Cuisine et reçoit 403 sur /api/cuisine ; modification d'accès effective immédiatement ;
désactivation : un jeton valide déjà émis est refusé à la requête suivante, le flux SSE se ferme,
réactivation rétablit ; suppression : historique conservé avec « (compte supprimé) », e-mail libéré ;
directeur : DELETE, désactivation, changement de profil, réduction d'accès tous refusés par appel
direct, e-mail et mot de passe modifiables avec mot de passe actuel, aucun second administrateur
possible ; aucun mot de passe en clair dans la base, les journaux ou les réponses ; cuisinier sans prix
ni nom de client dans les réponses et le SSE ; scrollWidth <= clientWidth aux 4 largeurs ; captures
d'écran. Lance tests et build, résume en trois lignes, ne fusionne rien avant ma validation.
