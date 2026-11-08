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

## Fidélité aux maquettes (obligatoire, prioritaire)
- L'interface reproduit À L'IDENTIQUE le STYLE des maquettes de design/maquettes/ :
  dimensions, espacements, couleurs, polices, tailles, rayons, ombres, icônes,
  bordures, survols. Source de vérité : code.html (valeurs exactes) et sa config
  Tailwind. Le fichier design/maquettes/saly_coastal_boutique_hospitality/DESIGN.md
  documente le système, mais en cas de différence, la config Tailwind du code.html
  gagne.
- Il n'y a QU'UN SEUL thème (clair, barre latérale bleu nuit). N'ajoute aucun
  mode sombre. Il existe une version mobile (tableau_de_bord_mode_clair/) : sous
  768 px, la barre latérale devient une barre de navigation en bas.
- Tailwind, polices (Manrope, Newsreader) et icônes (Material Symbols) installés en
  local, jamais de CDN. Toutes les images en local dans les assets.
- Les TEXTES sont adaptés à l'hôtel réel (docs/design/ADAPTATION-THIES.md) :
  Thiès, Grand Standing, dans les terres, aucun océan, plage, marée ni vague. Le
  style reste identique, seul le contenu change.
- Test de fidélité : on compare l'écran Angular au rendu hors ligne de
  design/reference/<ecran>.html (et non à screen.png, qui est réduit). Les zones
  adaptées sont masquées dans la comparaison. Écart maximum 2 % sur le reste.
- Rien de ce qui est dans « Éléments à ne pas reproduire » de ADAPTATION-THIES.md
  ne doit apparaître dans la version de production.

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
- Avant de considérer un git push comme échoué, vérifie avec git fetch puis
  git status -sb et git log origin/master -1 si le commit distant correspond au
  commit local. Si oui, le push a réussi : ne le relance pas. N'utilise jamais
  --force pour résoudre un échec de push ; en cas de refus, fais git pull --rebase
  puis relance les tests avant de pousser à nouveau.

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
