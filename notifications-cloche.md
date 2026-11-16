# Prompt : notifications dans la cloche (branche fix/notifications-cloche)

Mode autonome, aucune question. Branche fix/notifications-cloche depuis la branche courante.
Concerne les notifications du flux Restaurant vers Cuisine côté ASSISTANT : elles quittent la page
Restaurant & Bar et vont dans l'icône de notification (la cloche) du haut de l'application. Ne modifie ni
l'écran Cuisine, ni la facturation, ni les règles d'états des commandes, ni les droits existants. N'affiche
jamais le contenu des .env. Lis d'abord le composant de la cloche (header) et le service de notifications
existants, et réutilise-les.

PROBLÈME
Sur /restaurant, chaque événement de la cuisine ajoute un bandeau bleu « Compris » (« Temps de préparation
: 15 min, prête vers 17:04 », « La cuisine a confirmé : tous les plats existent »...). Ils s'empilent, se
répètent et ne disent pas de quelle commande ni de quel plat il s'agit. L'assistant se perd.

1. SUPPRIMER LES BANDEAUX
Supprime (git rm) les bandeaux de notification empilés de la page Restaurant & Bar et leur logique. Aucune
notification n'est plus affichée dans le corps de la page Restaurant. Si le panneau « Où en sont les
plats ? » existe, il reste le seul suivi visible sur la page, sans changement.

2. LA CLOCHE COMME CENTRE DE MESSAGES
- Pastille rouge sur la cloche avec le nombre de messages non lus (« 9+ » au-delà de 9). Elle se met à
  jour en temps réel (flux existant), sans recharger la page.
- Un clic sur la cloche ouvre un panneau (largeur 420 px sur ordinateur, plein écran sous 600 px, jamais
  coupé, fermeture par clic extérieur, touche Échap ou bouton « Fermer »). Titre « Messages », bouton
  « Tout marquer comme lu », deux groupes : « Nouveaux » et « Plus anciens » (24 dernières heures,
  50 messages au maximum). Défilement vertical interne visible, jamais horizontal.
- Un message = une carte de trois lignes :
  1) ce qui se passe, en gras (avec icône et couleur) ;
  2) POUR QUI : « Chambre 301, M. Diop », « Table 4 » ou « À emporter N° 12 » ;
  3) l'heure, « il y a 3 min ».
  Un clic sur la carte la marque lue et ouvre /restaurant en mettant la commande en évidence.
- L'état lu ou non lu est enregistré par utilisateur côté serveur (privilégie une solution minimale :
  date de dernière lecture par utilisateur et par message ; migration Prisma sans perte si nécessaire). Un
  message lu sur la tablette est lu aussi sur l'ordinateur.

3. MESSAGES EXPLICITES (texte généré côté serveur avec les vrais plats, jamais écrit en dur)
Chaque message nomme les plats avec leur quantité : au plus 2 plats nommés, puis « et N autres plats ».
Les textes (exemples avec données fictives) :
- Plat confirmé avec temps (UN SEUL message, qui remplace « tous les plats existent » et « temps de
  préparation ») : « La cuisine prépare 1 Thiéboudienne royale. Prête vers 17:04 (dans 15 min) ».
- Du temps ajouté : « Du temps en plus : 1 Thiéboudienne royale sera prête vers 17:09 au lieu de 17:04 ».
- Plat manquant : « Plat manquant : Omelette n'est plus disponible. Motif : plus d'œufs. Que voulez-vous
  faire ? » avec le motif écrit par le cuisinier.
- Prête : « Prête à servir : 2 Thiéboudiennes ».
- Retard : « En retard de 4 min : 1 Yassa poulet devait être prêt à 17:04 » (une seule fois par commande).
- Commande annulée par la réception : « Commande annulée : 1 Thiakry. Motif : ... ».
Pour un client de passage, jamais de nom : « Table 4 » ou « À emporter N° 12 ». Pour une chambre : le numéro et
le nom du client, vus seulement par les rôles qui y ont droit. Aucun prix ni total dans les messages.
« Tous les plats existent » n'est plus un message : c'est inclus dans la phrase de confirmation.

4. ALERTES IMPORTANTES
Seuls « Prête à servir » et « Plat manquant » déclenchent, en plus, une petite alerte (un seul encadré en
haut à droite, 8 secondes, jamais plus d'un à la fois, les suivants entrent dans la cloche), avec un son
si l'interrupteur « Son » est activé (il ne démarre qu'après la première interaction de la page). Les
autres messages sont silencieux et n'apparaissent que dans la cloche.

5. QUI REÇOIT QUOI
Les messages de commande vont aux comptes RESTAURANT, RECEPTION et DIRECTION qui ont accès à Restaurant,
filtrés selon leurs droits (montants jamais envoyés à qui n'a pas le droit, flux compris). Le cuisinier ne
reçoit rien dans la cloche (il a son écran). La structure du panneau est générique (type, titre, détail,
heure, lien) pour accueillir plus tard les alertes du ménage, sans les créer ici.

6. ACCESSIBILITÉ ET LISIBILITÉ
Textes de 16 px minimum, titre en 18 px, contraste d'au moins 4,5:1, l'état n'est jamais indiqué par la
couleur seule (icône et mot), zones tactiles de 48 px, focus clavier visible, aria-live poli pour les
nouveaux messages, mots simples en français.

TESTS (Playwright, deux navigateurs : assistant et cuisinier ; base de test séparée)
- Le cuisinier accepte avec 15 min : un seul message dans la cloche, avec le nom du plat et l'heure, et
  aucun bandeau sur la page Restaurant.
- « +5 min » : un message « Du temps en plus ». Plat manquant : message avec le plat et le motif, alerte
  et son. Prête : message avec les plats, destination, alerte.
- La pastille compte juste ; « Tout marquer comme lu » la remet à zéro ; un message lu sur un appareil
  l'est sur l'autre ; un clic ouvre la commande en évidence.
- Client de passage sans nom ; aucun prix dans les messages ni dans le flux ; le cuisinier ne reçoit rien.
- Panneau jamais coupé, scrollWidth <= clientWidth à 360, 768, 1024 et 1440 px ; captures d'écran de la
  cloche fermée, ouverte et de la page Restaurant sans bandeaux. Lance tests et build, résume en deux
  lignes, ne fusionne rien avant ma validation.
