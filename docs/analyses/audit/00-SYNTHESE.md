# 00 — Synthèse de l'audit avant mise en production

Audit en lecture seule du 17/11/2026, branche `docs/audit-complet`. Aucun code, aucune donnée modifiés.

## A. Verdict

1. **Pas encore prêt pour la production.** La base est solide, mais six points bloquent.
2. Le planning s'ouvre toujours sur la semaine du 10 novembre 2026, et pas sur la date du jour (MET-001).
3. L'accueil affiche « Mode Démonstration Actif » et un bouton qui remet à zéro des données (INT-001).
4. Rien ne permet d'importer les fichiers Excel actuels de l'hôtel (MET-003).
5. L'application n'est pas en HTTPS : les mots de passe passent en clair sur le Wi-Fi (EXP-001).
6. Les sauvegardes restent sur le même serveur et la restauration n'a jamais été prouvée (EXP-002).
7. Un contrôleur de test public est chargé dans l'application réelle (SEC-001).
8. Ce qui va bien : réservations protégées contre les doubles locations, numéros de facture sans trou, montants en francs entiers, droits refusés par défaut, pièces d'identité chiffrées.
9. Délai réaliste : **2 à 3 semaines** pour les six blocages (lots 1 à 5), puis 1 à 2 semaines pour les points importants (caisse, paramètres, montants).
10. Tests lancés pendant l'audit : lint sans erreur, 35 tests unitaires API verts ; les tests d'intégration et de bout en bout n'ont pas été relancés.

## B. Tableau de bord

| Domaine | Bloquant (P0) | Important (P1) | Confort (P2) | Total |
|---|---|---|---|---|
| Métier | 2 | 1 | 0 | 3 |
| Interfaces | 1 | 2 | 2 | 5 |
| Logique | 0 | 4 | 3 | 7 |
| Sécurité | 1 | 2 | 3 | 6 |
| Données | 0 | 1 | 2 | 3 |
| Qualité | 0 | 0 | 1 | 1 |
| Exploitation | 2 | 3 | 1 | 6 |
| **Total** | **6** | **13** | **12** | **31** |

Un même problème vu dans plusieurs fichiers n'est compté qu'une fois.

## C. Les 10 actions à faire en premier

| # | Action | Constat | Effort |
|---|---|---|---|
| 1 | Retirer le contrôleur de test de la production et refuser de démarrer sans clé de chiffrement | SEC-001, SEC-002 | Petit |
| 2 | Mettre l'application derrière HTTPS et fermer le port direct de l'API | EXP-001 | Moyen |
| 3 | Sauvegarde copiée hors du serveur + un essai de restauration écrit | EXP-002 | Moyen |
| 4 | Supprimer le bandeau et le bouton « Mode Démonstration » et les faux clients du code | INT-001, INT-007 | Petit |
| 5 | Ouvrir le planning sur la date du jour (heure de Dakar) | MET-001 | Petit |
| 6 | Script d'import Excel (clients et réservations à venir), avec mode essai | MET-003 | Moyen |
| 7 | Corriger les arrondis de TVA et l'année des numéros, valider la taxe de séjour | LOG-002 à LOG-004 | Petit |
| 8 | « Fermer la caisse » à la place du simple export | MET-002 | Moyen |
| 9 | Carte « Hôtel » dans Administration (TVA, taxe, nom légal) et retrait des pages vides | INT-003, INT-004 | Moyen |
| 10 | Contrôle de santé de l'API, alerte simple et procédure de mise à jour | EXP-003 à EXP-005 | Petit |

## Fichiers du rapport
- [01-COUVERTURE-METIER.md](01-COUVERTURE-METIER.md) : processus par processus
- [02-INTERFACES.md](02-INTERFACES.md) : écrans
- [03-LOGIQUE.md](03-LOGIQUE.md) : règles et calculs
- [04-SECURITE-DROITS.md](04-SECURITE-DROITS.md) : tableau rôle par route
- [05-DONNEES-QUALITE.md](05-DONNEES-QUALITE.md) : base, tests, qualité
- [06-EXPLOITATION.md](06-EXPLOITATION.md) : mise en service
- [07-PLAN-DE-FINITION.md](07-PLAN-DE-FINITION.md) : 10 lots à donner un par un
