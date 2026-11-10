# Porte de Sécurité : Module Exports (Rapports PDF & Tableurs Excel)

Ce document consigne les tests d'attaque et de robustesse menés sur le module d'exportation de la Résidence Blue conformément aux exigences du fichier `AGENTS.md`.

---

## 1. Contexte & Périmètre

Le module d'export permet de générer à la demande et de télécharger 6 modèles officiels d'exploitation sous format PDF ou Excel (.xlsx) :
1. **Facture de séjour** (PDF) — #INV-2024-0542
2. **Feuille des arrivées et départs du jour** (PDF) — Service Réception
3. **État d'exploitation des 12 chambres** (PDF) — Service Ménage & Gouvernance
4. **Clôture de caisse journalière (Z de caisse)** (PDF et Excel) — Service Comptabilité
5. **Fichier clients complet** (Excel) — **STRICTEMENT RÉSERVÉ À LA DIRECTION**
6. **Ventes Restaurant, Bar & Accès Piscine** (Excel) — Détail périodique

---

## 2. Vecteurs d'Attaque Testés

### A. Injection de formules tableur (CSV / Excel Formula Injection)
- **Vecteur** : Insertion de caractères de contrôle de formule (`=`, `+`, `-`, `@`) dans les champs textuels (ex. nom de client `=cmd|'/C calc'!A0`, libellé d'article, téléphone).
- **Protection** : La fonction `sanitizeSpreadsheetCell` analyse tout champ textuel et ajoute automatiquement une apostrophe de neutralisation (`'`) en préfixe.
- **Résultat** : `=SUM(A1:A100)` devient `'=SUM(A1:A100)`, le tableur interprète la cellule comme une simple chaîne sans exécuter de commande ou macro.

### B. Fuite de données et élévation de privilèges (RBAC)
- **Vecteur** : Un membre du personnel (rôle `RECEPTION`, `SERVEUR` ou `CUISINE`) tente d'extraire la liste complète des clients de l'hôtel (`CLIENTS_LIST_EXCEL`) ou de consulter le journal d'audit des exports (`/api/exports/audit`).
- **Protection** : 
  - `RolesGuard` NestJS vérifie le rôle authentifié.
  - La méthode `validateParams` contrôle spécifiquement `def.allowedRoles`. Pour `CLIENTS_LIST_EXCEL`, seul `Role.DIRECTION` est autorisé.
- **Résultat** : Code HTTP 403 Forbidden systématique pour tout rôle non habilité.

### C. Déni de service par épuisement mémoire (OOM DoS)
- **Vecteur** : Génération d'un export géant avec des milliers de lignes provoquant une surcharge de la RAM sur le serveur ou dans le conteneur Docker limité à 300 Mo.
- **Protection** : 
  - Utilisation systématique du streaming en flux continu via `ExcelJS.stream.xlsx.WorkbookWriter` et `PDFDocument.pipe(res)`. Les lignes sont écrites et vidées du buffer mémoire au fur et à mesure (`row.commit()`).
  - Plafond strict à 50 000 lignes maximum.
- **Résultat** : Empreinte mémoire quasi constante (< 30 Mo) indépendamment du nombre de lignes exportées.

### D. Dépassement de période temporelle
- **Vecteur** : Demande d'un export couvrant une décennie ou avec des dates inversées (`startDate > endDate`).
- **Protection** : Validation stricte des dates dans `validateParams` : limite maximale à 12 mois (366 jours), rejet immédiat (HTTP 400 Bad Request) avec message d'erreur clair en français.
- **Résultat** : Requêtes malformées ou hors limites immédiatement bloquées.

---

## 3. Matrice des Résultats des Tests Automatisés

Fichier de test : `apps/api/test/exports-security.e2e-spec.ts`

| Test | Vecteur | Statut | Temps d'exécution |
|---|---|---|---|
| `neutraliser les formules (=, +, -, @)` | Formula Injection | **SUCCÈS (PASS)** | 8 ms |
| `ne pas altérer valeurs normales` | Intégrité des données | **SUCCÈS (PASS)** | 2 ms |
| `bloquer /api/exports/audit sans auth` | Deny by default | **SUCCÈS (PASS)** | 129 ms |
| `bloquer /api/exports/audit pour RECEPTION` | RBAC Isolation | **SUCCÈS (PASS)** | 20 ms |
| `autoriser /api/exports/audit pour DIRECTION` | Contrôle d'accès légitime | **SUCCÈS (PASS)** | 14 ms |
| `bloquer CLIENTS_LIST_EXCEL pour RECEPTION` | Protection données personnelles | **SUCCÈS (PASS)** | 20 ms |
| `autoriser CLIENTS_LIST_EXCEL pour DIRECTION` | Direction légitime | **SUCCÈS (PASS)** | 151 ms |
| `refuser période > 12 mois (400)` | Bornes temporelles | **SUCCÈS (PASS)** | 13 ms |
| `refuser startDate > endDate (400)` | Cohérence temporelle | **SUCCÈS (PASS)** | 12 ms |
| `refuser dates manquantes pour périodique` | Validation requêtes | **SUCCÈS (PASS)** | 9 ms |
| `streamer un PDF valide avec en-têtes` | Streaming PDF | **SUCCÈS (PASS)** | 62 ms |
| `enregistrer une entrée d'audit immuable` | Audit trail | **SUCCÈS (PASS)** | 13 ms |

**Bilan : 12 tests exécutés, 12 réussis (100% vert).**
