# Prompt : parcours Ménage, version simple (branche feature/menage-parcours)

Mode autonome, aucune question. Branche feature/menage-parcours depuis la branche courante. Suis
docs/analyses/MENAGE-ANALYSE.md (parties F et G) avec les décisions ci-dessous. Vérifie dans le code
chaque fichier et chaque ligne cités avant de les modifier (les numéros de ligne peuvent avoir changé).
N'affiche jamais le contenu des .env. Procède en TROIS commits, lance les tests après chacun, et ne
passe au suivant que s'ils sont verts.

## CONTEXTE ET DÉCISIONS (déjà validées par le directeur)

La personne du ménage n'a jamais utilisé de logiciel : chaque action doit être évidente, en un clic, avec
des mots simples. Réception et direction gardent l'écran Chambres actuel, sans aucun changement visible.
- Libellé unique pour l'état « Ménage » partout dans l'hôtel : « À nettoyer ».
- Qui remet en service une chambre signalée en panne : DIRECTION et profil Technique seulement.
- Chambre occupée : le ménage voit « Client présent », sans bouton de nettoyage, avec « Signaler un
  problème » (confirmation guidée).
- Pas de suivi du ménage quotidien des chambres occupées dans cette version : seulement À nettoyer puis
  Propre.
- La réception voit le motif d'une panne : badge « Hors service : [motif] » sur le Planning et sur la
  carte de la chambre.

## COMMIT 1 : VERROUILLER LE PROFIL MÉNAGE ET NETTOYER LES LIENS (étapes 1 et 2 du rapport)

1. Le profil Ménage n'a accès qu'à Chambres. Retire l'accès Accueil de resolveDefaultAccessForRole
   (HOUSEKEEPING) dans packages/shared/src/access.ts, y compris pour les anciens comptes sans accès
   détaillés en base (screen_access nul) : leur accès par défaut est Chambres seul. Active le rôle
   fonctionnel HOUSEKEEPING (config/modules.json et ServerModuleConfigService/RolesGuard) pour que les
   anciens comptes ne reçoivent plus de 403 sur Chambres.
2. Dans la création et la modification des comptes (administration-compte-form et AdministrationService) :
   pour un profil Ménage, les accès Restaurant, Cuisine, Rapports, Facturation, Clients, Planning et
   Accueil sont verrouillés sur « Aucun accès » (cartes grisées, phrase « Cette personne n'a besoin que
   de l'écran Chambres »), et le serveur refuse (403) toute tentative par appel direct. Comptes ménage
   existants : migration Prisma sans perte qui remet ces accès à « Aucun » ; affiche leur liste dans le
   résumé ; journal d'actions.
3. Barre du bas sur téléphone (layout.component.ts) : filtre les boutons selon les accès réels
   (AuthService.hasScreen). Pour un profil à un seul écran, pas de barre du bas : seulement Chambres et
   « Se déconnecter », bien visible. La recherche globale (header.component.ts) est masquée sans accès à
   Planning ni Clients. Aucun lien vers le restaurant, la facturation ou la réinitialisation des données
   n'apparaît pour un compte qui n'y a pas droit.
4. Prix des chambres : ne jamais afficher de prix par défaut inventés (35 000, 55 000, 95 000 FCFA, dans
   rooms.service.ts et room-status-card.component.ts) ; si le serveur renvoie null ou si le compte n'a pas
   « Voir les montants », la ligne de prix disparaît. Le serveur ne renvoie pas les tarifs à un compte
   sans ce droit.
Tests : access.spec.ts, administration-comptes.e2e-spec.ts (403 sur toutes les routes restaurant pour
Ménage, accès Restaurant impossible à attribuer), Playwright : un compte Ménage, ancien ou récent, ne
voit ni Accueil, ni lien restaurant (ordinateur et 360 px), ni prix. Ne casse aucun test de
AccueilService ni de menu-lateral / chambres pour DIRECTION et RECEPTION.

## COMMIT 2 : ÉCRAN SIMPLE POUR LE MÉNAGE (étapes 3 et 4 du rapport)

Dans l'entrée « Chambres », un compte Ménage voit une version simplifiée (autre composant, DIRECTION et
RECEPTION gardent l'écran actuel). Titre « Chambres à nettoyer ».
- Trois groupes, dans cet ordre, textes de 20 px minimum, boutons de 64 px de haut avec mot et icône :
  1) « À nettoyer maintenant » : une grande carte par chambre (numéro en très grand, étage ou nom),
     bouton plein « J'ai nettoyé ». Une chambre nettoyée passe à Propre et disparaît du groupe.
  2) « Client présent » : cartes compactes, aucune action de nettoyage, bouton contour « Signaler un
     problème ».
  3) « Propres » : cartes compactes avec un bouton contour « À nettoyer » (pour une chambre libre qui
     a besoin d'être refaite) et « Signaler un problème ».
- Aucun bouton Check-in, Check-out, Maintenance, « Remettre en service », menu « ⋯ », fiche ou prix.
- « Signaler un problème » ouvre une fenêtre (ModalShellComponent) avec quatre gros choix : « Fuite
  d'eau », « Ampoule ou électricité », « Climatisation », « Autre » (+ un champ texte facultatif) et la
  phrase « Cette chambre ne pourra plus être louée tant qu'elle n'est pas réparée », boutons « Envoyer »
  et « Annuler ». Le motif est enregistré avec la chambre (internalNote ou champ maintenanceReason ;
  migration Prisma sans perte si nécessaire) et PATCH /api/rooms/:id/status reçoit le motif.
- Le ménage ne peut pas remettre une chambre en service ; DIRECTION et profil Technique le font avec un
  bouton « Remettre en service » (réception : non). Le serveur applique ces règles (403 sinon), avec
  messages en français simple.
- Affiche partout « À nettoyer » au lieu de « Ménage » pour cet état. Planning et carte de chambre
  montrent « Hors service : [motif] » pour la réception.
- Aucune barre de défilement horizontale ; défilement vertical simple de la page ; message d'état vide :
  « Aucune chambre à nettoyer, merci ! ».
Tests : serveur (transitions autorisées par rôle, 403 sinon, motif enregistré), Playwright : cycle
À nettoyer, J'ai nettoyé, Propre, puis Propre, À nettoyer ; signalement avec choix et motif ; le ménage
ne voit aucun bouton interdit ; la réception voit le motif ; scrollWidth <= clientWidth à 360, 768,
1024 et 1440 px ; captures d'écran.

## COMMIT 3 : ALERTE EN DIRECT POUR LA RÉCEPTION (étape 5 du rapport)

- Flux temps réel /api/rooms/stream sur le modèle de restaurant/orders/stream, déclenché dans
  RoomsService.updateStatus, réservé à RECEPTION, DIRECTION et Technique. Il ne contient ni prix, ni nom
  de client.
- Une alerte courte dans la cloche du haut et une pastille sur Planning : « Chambre 204 : propre, prête à
  louer » ou « Chambre 204 : problème signalé (fuite d'eau) ». Son facultatif (interrupteur visible).
- Révocation de session respectée (sessionRevocation), reprise automatique, secours par actualisation
  toutes les 10 s.
Tests : intégration du flux ; Playwright à deux navigateurs (ménage clique « J'ai nettoyé », la réception
voit l'alerte en moins de 2 s) ; le flux n'est refusé qu'aux rôles non autorisés.

## FIN

Base de test séparée pour tous les tests, jamais la base de développement. Lance tests, lint et build.
Résume en trois lignes (un par commit) et ne fusionne rien avant ma validation.
