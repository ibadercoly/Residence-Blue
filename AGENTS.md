# AGENTS.md : Résidence Blue (logiciel de gestion hôtelière)

## Projet
Logiciel de gestion d'un hôtel de 12 chambres (Standard, Deluxe, Suite) avec
restaurant et bar, à Thiès, plus précisément à Grand Standing (Sénégal). Remplace des fichiers Excel.
Devise : FCFA, montants stockés en ENTIERS (jamais de décimaux).
Interface en français. Code (noms de variables, fonctions) en anglais,
commentaires et messages affichés en français.

## Stack (ne jamais en changer sans mon accord)
TypeScript partout. Monorepo npm workspaces : apps/api (NestJS),
apps/web (Angular standalone + signals + PWA), packages/shared (types).
PostgreSQL 16 + Prisma. Tests : Jest, Supertest, Playwright.
Docker Compose pour lancer l'ensemble.

## Workflow Git (obligatoire)
- master est toujours stable. Jamais de commit direct sur master.
- Une branche par fonctionnalité : feature/<nom> ou fix/<nom>.
- Commits au format Conventional Commits (feat:, fix:, test:, docs:...).
- Une fonctionnalité n'est fusionnée dans master que si TOUT est vert :
  lint, build, tests unitaires, tests d'intégration, tests E2E ET tests de
  sécurité de la fonctionnalité. Puis : merge dans master, push sur GitHub,
  suppression de la branche, tag à chaque fin de phase.
- Si un test échoue : corriger sur la branche. Ne jamais désactiver, supprimer
  ou affaiblir un test pour le faire passer.

## Hors ligne (offline-first)
- Toute fonctionnalité doit marcher sans connexion au serveur : lecture depuis
  IndexedDB, écriture dans une file d'attente (outbox) synchronisée ensuite.
- Les identifiants sont des UUID générés côté client. Chaque opération envoyée
  au serveur porte un Idempotency-Key : la rejouer ne doit rien dupliquer.
- Le serveur est la source de vérité et arbitre les conflits. Une action faite
  hors ligne est visible comme « en attente de synchronisation ».

## Sécurité (obligatoire dans chaque fonctionnalité)
- Toutes les entrées validées (ValidationPipe whitelist + forbidNonWhitelisted).
- Accès refusé par défaut : chaque route déclare ses rôles autorisés.
- Jamais de requête SQL brute avec concaténation. Prisma paramétré uniquement.
- Aucun secret dans le code ni dans Git : variables d'environnement.
- Données sensibles (pièces d'identité) chiffrées en AES-256-GCM.
- Chaque fonctionnalité passe la « Porte de sécurité » (voir prompt dédié) :
  on attaque notre propre code en environnement de test, on documente le
  résultat dans docs/security/<fonctionnalité>.md, on corrige, on relance.

## Définition de « terminé »
Code + tests unitaires + intégration + E2E + tests de sécurité verts, lint et
build verts, documentation à jour, branche fusionnée dans master et poussée.

## Règles de travail de l'agent
- Fais UNE seule fonctionnalité à la fois, celle demandée dans le prompt.
- Avant de coder : écris le plan, liste les fichiers à créer ou modifier.
- N'ajoute aucune dépendance sans la justifier.
- À la fin : résume branche, commits, tests lancés avec leur résultat,
  commandes Git de fusion, et la prochaine étape.
