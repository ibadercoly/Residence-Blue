# Prompt : pannes, nettoyage avec client et interface Technique (branche feature/pannes-technique)

Mode autonome, aucune question. Branche feature/pannes-technique depuis la branche principale à jour. Concerne
les chambres : signalement des pannes, nettoyage même avec un client présent, et l'écran du compte Technique.
Ce prompt a PRIORITÉ sur docs/prompts/menage-parcours.md là où ils se contredisent (voir « Décisions
remplacées »). Avant de commencer, lis ce fichier, docs/analyses/MENAGE-ANALYSE.md et le code réel (chambres,
planning, réservations, notifications/cloche, accès par profil, flux temps réel) et dis en 5 lignes ce qui
existe déjà du parcours Ménage pour ne rien refaire en double. N'affiche jamais le contenu des .env.
Procède en TROIS commits (1 données et règles, 2 écran Ménage et signalement, 3 écran Technique et
notifications), tests verts après chacun.

## PRINCIPE : TROIS CHOSES INDÉPENDANTES PAR CHAMBRE
- Occupation : libre ou occupée (réservation en cours), gérée par la réception (check-in, check-out).
- Propreté : propre ou à nettoyer, gérée par le ménage et par le check-out.
- Problèmes : liste de pannes, chacune avec son propre état, gérée par le ménage, la réception et le technicien.
Une chambre « Hors service » n'est plus un état à part : c'est une chambre libre qui a au moins un problème qui
empêche de la louer. Cherche la solution la moins risquante pour l'existant (par exemple garder la valeur
MAINTENANCE comme état dérivé), migration Prisma SANS perte : toute chambre actuellement en maintenance reçoit
un problème « Autre : maintenance en cours » qui empêche la location. Documente le choix dans
docs/chambres/PANNES-ET-NETTOYAGE.md.

## RÈGLES MÉTIER (décidées par le directeur)
1. UNE CHAMBRE PEUT ÊTRE RÉPARÉE MÊME AVEC UN CLIENT. Un problème signalé dans une chambre occupée ne la met pas
   hors service : elle reste occupée, le client reste logé. La carte indique « Client présent : prévenir avant
   d'entrer ».
2. CHAMBRE LIBRE : un problème qui empêche la location la met « Hors service » jusqu'à la réparation.
3. AU DÉPART DU CLIENT (check-out) : si un problème qui empêche la location n'est pas réparé, la chambre n'est
   PAS remise en location : après le nettoyage elle devient « Hors service » jusqu'à la réparation, la
   réception reçoit « Chambre 108 : le client est parti, problème non réparé (climatisation), chambre non
   louable » et le technicien voit « Chambre vide, vous pouvez entrer ».
4. Types de problèmes et blocage par défaut : Climatisation (bloque), Fuite d'eau (bloque), Électricité (bloque),
   Ampoule (ne bloque pas), Autre (bloque). Le directeur, la réception et le technicien peuvent basculer
   « Chambre louable malgré ce problème » sur un problème précis. Le serveur applique la règle ; le blocage ne
   dépend jamais d'un choix du navigateur.
5. LE MÉNAGE PEUT NETTOYER MÊME AVEC UN CLIENT PRÉSENT : « J'ai nettoyé » et « À nettoyer » fonctionnent sur
   toute chambre, occupée ou non, sans changer son occupation. Une chambre occupée garde son badge « Client
   présent » et le rappel « Frapper et se présenter avant d'entrer ». Pas de planning automatique de ménage
   quotidien dans cette version.
6. Un problème a quatre états : Signalé, Pris en charge, Réparé, Annulé (par la réception ou le directeur, avec
   motif, si signalé par erreur). Transitions validées par le serveur (409 sinon). Une chambre peut avoir
   plusieurs problèmes ouverts ; elle n'est louable que si AUCUN problème bloquant n'est ouvert.

## DONNÉES (commit 1)
Table des problèmes (chambre, type, remarque courte, signalé par et quand, était occupée au moment du
signalement, bloque la location oui/non, état, pris en charge par et quand, réparé par et quand, remarque de
réparation, motif d'annulation). Champs de propreté séparés de l'occupation si ce n'est pas déjà le cas. Chaque
transition est écrite dans le journal d'actions. Les règles 1 à 6 sont appliquées côté serveur (réservations :
une chambre non louable ne peut pas recevoir une nouvelle réservation ni un check-in, avec un message en
français simple ; le planning l'affiche).

## ÉCRAN MÉNAGE ET SIGNALEMENT (commit 2)
Reprends l'écran simple du ménage dans « Chambres » (docs/prompts/menage-parcours.md) avec ces changements :
- Une seule liste de cartes de chambres (plus de groupe « Client présent » sans action) : « À nettoyer
  maintenant » en premier, puis « Autres chambres ». Une chambre occupée porte le badge « Client présent » ET a
  ses boutons « J'ai nettoyé » ou « À nettoyer ».
- « Signaler un problème » sur toute carte, occupée ou non : fenêtre à gros choix (Climatisation, Fuite d'eau,
  Électricité, Ampoule, Autre) + remarque facultative. Texte d'information selon le cas : chambre libre :
  « Cette chambre ne pourra plus être louée tant qu'elle n'est pas réparée » ; chambre occupée : « Le client
  reste dans la chambre. L'équipe technique est prévenue. »
- Le ménage ne remet jamais une chambre en service et ne voit ni prix ni nom de client.
- La réception et le directeur peuvent aussi signaler un problème depuis Chambres et le Planning.
- Badges clairs pour la réception : « Problème : climatisation » (avec « non louable » si bloquant).

## ÉCRAN TECHNIQUE (commit 3)
- Entrée « Technique » (icône clé à molette, couleur propre définie une seule fois dans les variables du thème)
  visible UNIQUEMENT pour le profil Technique, qui arrive dessus après connexion et n'a que cet écran (plus la
  déconnexion), comme le Cuisinier avec la Cuisine. DIRECTION et RECEPTION ne l'ouvrent pas : ils suivent les
  pannes dans Chambres, Planning et la cloche, et peuvent annuler ou autoriser la location. Routes API
  réservées au profil Technique (403 pour les autres, appel direct compris). L'accès « Technique » ne peut être
  attribué qu'à un compte Technique dans Administration.
- Grandes cartes de problèmes (aucun défilement horizontal), groupes : « À traiter » (les plus anciens et les
  chambres vides en premier), « En cours », « Réparés aujourd'hui ». Chaque carte : « Chambre 108 » en grand,
  type de problème avec icône, remarque, « signalé il y a 2 h par le ménage », et un cadre bien visible :
  « Client présent : prévenir avant d'entrer » (orange) ou « Chambre vide : vous pouvez entrer » (vert).
- Un seul bouton par carte, qui change selon l'état : « Je m'en occupe », puis « C'est réparé » (fenêtre avec
  champ facultatif « Ce qui a été fait » et bouton « Confirmer »). Pas d'autre bouton, pas de menu caché.
- Pastille sur l'entrée de menu (nombre à traiter), alerte visible et son à l'arrivée d'un nouveau problème
  (temps réel, interrupteur « Son »).
- Jamais de prix, de nom de client ni de données de réservation côté technicien, y compris dans le flux temps
  réel (flux filtré par rôle).
- Notifications dans la cloche (réception, direction, ménage qui a signalé) en une phrase explicite :
  « Chambre 108 : climatisation en panne, signalée par le ménage », « Chambre 108 : le technicien s'en occupe »,
  « Chambre 108 : climatisation réparée, chambre de nouveau louable » ou « ...réparée (client toujours présent) ».

## DÉCISIONS REMPLACÉES (par rapport à menage-parcours.md)
- Le groupe « Client présent » sans bouton de nettoyage disparaît : le ménage nettoie aussi les chambres
  occupées.
- « Seuls DIRECTION et Technique remettent une chambre en service » devient : une chambre redevient louable
  automatiquement quand son dernier problème bloquant est réparé ; le technicien clique « C'est réparé ».
- L'écran Technique séparé est maintenant créé (il était jugé inutile avant).

## TESTS (base de test séparée, jamais la base de développement ; Playwright à plusieurs navigateurs)
Chambre libre + panne bloquante = non louable, réservation et check-in refusés ; chambre occupée + panne =
reste occupée, jamais hors service, badge « Client présent » côté technicien ; check-out avec panne non
réparée = après nettoyage « Hors service » et alertes ; réparation du dernier problème bloquant = chambre
louable ; plusieurs problèmes sur une chambre ; l'ampoule ne bloque pas et le basculement « louable malgré ce
problème » fonctionne ; le ménage nettoie une chambre occupée sans changer son occupation ; transitions
invalides refusées (409) ; le profil Technique n'accède à aucun autre écran, 403 sur les autres routes, aucun
prix ni nom de client dans les réponses ni le flux ; les autres profils reçoivent 403 sur l'écran Technique ;
notifications reçues par les bons profils ; migration d'une chambre existante en maintenance ; scrollWidth <=
clientWidth à 360, 768, 1024 et 1440 px ; captures d'écran. Lance lint, tests et build à chaque commit,
résume en trois lignes (un par commit), liste tout ce qui t'a obligé à modifier du code existant, et ne
fusionne rien avant ma validation.
