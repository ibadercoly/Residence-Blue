# Prompt : audit complet avant la mise en production (lecture seule)

Mode autonome, aucune question. MISSION D'AUDIT EN LECTURE SEULE : ne modifie, ne supprime et ne crée
AUCUN fichier de code, aucune migration, aucune configuration, aucune donnée. Ne lance aucune commande
qui écrit en base ni qui se connecte à un serveur distant. Les seuls fichiers créés sont les rapports dans
docs/analyses/audit/ (voir plus bas), sur une branche docs/audit-complet, commit des rapports seuls.
N'affiche jamais le contenu des .env. Ne fusionne rien. Les tests, le lint et le build ne se lancent que
sur la base de TEST séparée, jamais sur la base de développement.

CONTEXTE (critère n°1)
Logiciel de gestion de l'hôtel Résidence Blue (12 chambres, restaurant et bar, Thiès, Sénégal) : front
Angular, API NestJS, Prisma, PostgreSQL, temps réel (SSE), exports PDF et Excel. Il remplace des fichiers
Excel. Utilisateurs : la patronne (directrice), assistants de réception et du restaurant, cuisinier,
ménage, comptable : presque aucun n'a utilisé de logiciel. Règle du projet : le MINIMUM de fonctionnalités,
mais compréhensibles tout de suite, sans formation ; une fonction compliquée vaut moins qu'une fonction
simple que tout le monde utilise. Mise en production réelle prévue avec les vraies données de l'hôtel : je
dois savoir si le logiciel est COMPLET et SÛR.

CE QUE TU AUDITES (lis le code réel, exécute en lecture ; ne te fie ni aux noms ni aux docs ni aux tests)
1. COUVERTURE MÉTIER : pour chaque processus de l'hôtel, vérifie qu'il existe de bout en bout (écran, API,
   données, droits, tests) : réservation (création, modification, annulation, conflits de chambres,
   tarifs, durée) ; client (fiche, pièce d'identité chiffrée, doublons, historique) ; check-in et
   check-out ; séjour et note ; facturation (numérotation sans trou, TVA et taxe de séjour, avoirs,
   impression, duplicata) ; paiements (espèces, Orange Money, Wave, carte, virement, partiel, remboursement,
   clôture de caisse) ; restaurant (carte, commande chambre, table, à emporter, bar, plat manquant,
   encaissement) ; cuisine ; ménage et maintenance ; chambres (états, tarifs, catégories) ; planning ;
   rapports (exactitude des chiffres) ; administration (comptes, accès, apparence) ; archives et
   suppressions ; paramètres de l'hôtel ; journal d'actions ; sauvegarde et restauration ; import des
   données Excel existantes ; impression et PDF ; notifications ; hors ligne.
2. INTERFACES MANQUANTES ET INCOMPLÈTES : liste les écrans, boutons, états vides, messages d'erreur,
   confirmations, pages de mot de passe oublié ou changé, écran de première connexion, aide à l'écran,
   pages d'erreur (404, 403, panne), états de chargement qui manquent ou sont incomplets. Cherche aussi les
   routes API sans écran, les écrans sans route, les boutons sans action, le code mort et les doublons.
3. LOGIQUE MANQUANTE OU FAUSSE : règles métier absentes, incomplètes ou contradictoires ; calculs de
   montants, de taxes, d'arrondis en FCFA ; chevauchements ; fuseau horaire Africa/Dakar ; états
   impossibles ; transitions non protégées ; opérations qui devraient être atomiques (transactions) ;
   courses entre deux utilisateurs ; idempotence ; effets de bord entre modules (par exemple
   facturation, restaurant, rapports, ménage) ; données orphelines ; validations absentes côté serveur.
4. SÉCURITÉ ET DROITS : pour chaque route, qui peut appeler quoi (tableau complet rôle par route : 200 ou
   403 en lecture) ; fuites de données (prix, noms de clients, pièces d'identité) vers les rôles qui n'y ont
   pas droit, y compris dans les flux temps réel et les exports ; sessions, jetons, mots de passe,
   double authentification, limitation des tentatives, journaux sans données sensibles, injections,
   téléversement de fichiers, en-têtes, secrets, dépendances vulnérables (npm audit en lecture).
5. DONNÉES : schéma Prisma (index, contraintes, relations, suppressions en cascade, champs inutiles),
   migrations (rejouables sur une base vide ET sur une base existante), seeds et scripts dangereux,
   données de test présentes, sauvegarde et restauration, conservation légale, chiffrement.
6. QUALITÉ : résultats réels des tests, du lint et du build (sur base de test), couverture des parcours
   critiques, tests fragiles ou absents, dette technique, TODO et FIXME, avertissements, code dupliqué,
   fichiers énormes, performance (requêtes lentes, N+1, taille des pages), accessibilité (contrastes,
   clavier, lecteurs d'écran), responsive (360, 768, 1024, 1440 px), mode hors ligne, tablette.
7. CONFORMITÉ AUX DÉCISIONS DU PROJET : vérifie que le code respecte les règles suivantes et liste les
   écarts : Cuisine réservée au cuisinier ; Rapports réservés au directeur et au comptable ; ménage limité à
   Chambres ; un seul administrateur protégé ; notifications dans la cloche ; pas de défilement
   horizontal ; mots simples sans jargon (RevPAR, ADR, HT/TTC...) ; aucune donnée fictive dans les écrans de
   production ; suppression des comptes sans effacer l'historique.
8. EXPLOITATION : variables d'environnement (noms seulement), journaux, surveillance, santé de l'API,
   documentation du projet (à jour ou fausse), procédure d'installation, de mise à jour, de retour en
   arrière.

LES LIVRABLES (français simple, phrases courtes, sans jargon ; un non-développeur doit comprendre les
parties A, B et C). Plusieurs fichiers pour rester lisibles :
- docs/analyses/audit/00-SYNTHESE.md
  A. VERDICT en 10 lignes : prêt ou non pour la production, les 5 plus gros problèmes, le délai
     réaliste pour être prêt.
  B. Tableau de bord : nombre de constats par gravité (bloquant, important, confort) et par domaine
     (métier, interfaces, logique, sécurité, données, qualité, exploitation).
  C. Les 10 actions à faire en premier, dans l'ordre, avec l'effort (petit, moyen, grand).
- docs/analyses/audit/01-COUVERTURE-METIER.md : tableau processus par processus : existe (oui, partiel,
  non), où, ce qui manque, importance pour l'hôtel.
- docs/analyses/audit/02-INTERFACES.md : tout ce qui manque ou est incomplet côté écrans.
- docs/analyses/audit/03-LOGIQUE.md : toute la logique manquante ou fausse.
- docs/analyses/audit/04-SECURITE-DROITS.md : tableau rôle par route, fuites, risques.
- docs/analyses/audit/05-DONNEES-QUALITE.md : base, tests, build, performance, accessibilité.
- docs/analyses/audit/06-EXPLOITATION.md : ce qui manque pour exploiter en production.
- docs/analyses/audit/07-PLAN-DE-FINITION.md : le plan complet, par ordre de priorité.
Chaque constat contient : identifiant (par exemple LOG-012), gravité (P0 bloquant, P1 important, P2
confort, P3 idée), description simple, PREUVE (fichier et ligne, ou commande de lecture et résultat),
risque concret pour l'hôtel, correction proposée et effort. Pour chaque fonction manquante, classe-la :
« indispensable avant la production », « peut attendre après le lancement » ou « à ne pas faire pour garder
le logiciel simple », avec la raison.
Le plan de finition (07) regroupe les constats en lots que l'on peut donner un par un à un agent de code
(objectif, ce qu'il faut supprimer, ajouter ou corriger, fichiers, risques de migration, tests à prévoir,
effort, modèle conseillé medium ou high) dans l'ordre : sécurité et données d'abord, puis logique métier,
puis interfaces, puis confort.

RÈGLES
Chaque constat est appuyé sur du code lu ou une exécution en lecture ; sinon écris « non vérifié ». N'invente
aucune fonction ni aucun chiffre. Ne recommande rien qui ajoute des boutons ou des informations à l'écran
sans en retirer autant ailleurs. Distingue clairement ce qui est cassé de ce qui est seulement absent. Ne
propose pas de réécriture globale. Si l'audit est trop grand pour une seule passe, procède domaine par
domaine, écris chaque fichier au fur et à mesure et termine toujours par la synthèse. Termine ta réponse par
un résumé en cinq lignes : le verdict, le nombre de problèmes bloquants, les trois premières actions et le
nom des fichiers produits.
