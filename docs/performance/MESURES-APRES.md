# MESURES-APRES : Validation Finale des Budgets de Performance (Version 1 Minimale)

> **Date de mesure** : 9 novembre 2026  
> **Branche Git** : `chore/version-minimale-et-performance`  
> **Environnement de test** : Distribution de production Angular (`apps/web/dist/residence-blue-web/browser`), serveur statique de production HTTP (`http://localhost:8090`), Chromium avec protocole Chrome DevTools Protocol (`Performance.getMetrics` et `Emulation.setCPUThrottlingRate`).  
> **Contexte** : Résidence Blue (Hôtel 12 chambres, restaurant La Teranga, piscine, Grand Standing Thiès, Sénégal). Présentation directe à la directrice : logiciel instantané, ultra léger, sans jargon, sans fuite mémoire.

---

## 1. Tableau Comparatif AVANT / APRÈS & Respect des Budgets

| Métrique de Performance | Valeur Initiale (AVANT) | Valeur Optimisée (APRÈS) | Budget Cible (Exigence) | Statut |
| :--- | :---: | :---: | :---: | :---: |
| **JavaScript Initial (Raw)** | 756,27 Ko | **213,90 Ko** | - | 🟢 **-71,7 %** (Allégé) |
| **JavaScript Initial (Gzip)** | 201,46 Ko | **61,37 Ko** | **< 250 Ko** | 🟢 **CONFORME** (x4 sous le budget) |
| **Découpage des routes (Lazy Chunks)** | 0 chunk (100% dans `main.js`) | **14 chunks différés** | **< 120 Ko par route** | 🟢 **CONFORME** (tous < 104 Ko raw) |
| **Poids des Chunks Routes clés (Raw)** | - | **Restaurant : 103 Ko**<br>**Planning : 56 Ko**<br>**Clients : 42 Ko**<br>**Facturation : 42 Ko**<br>**Exports : 24 Ko**<br>**Chambres : 22 Ko**<br>**Accueil : 10 Ko**<br>**Cuisine : 8 Ko** | **< 120 Ko** | 🟢 **CONFORME** (8 à 103 Ko) |
| **Premier affichage (PC normal)** | 2 266 ms | **750 ms** (FCP: 480 ms) | **< 2 000 ms** | 🟢 **CONFORME** |
| **Premier affichage (PC modeste CPU 4x)** | 14 014 ms | **1 850 ms** | **< 2 000 ms** | 🟢 **CONFORME** (Divisé par 7,5) |
| **Navigation entre écrans V1 (moyenne)** | 488 ms | **240 ms** | **< 300 ms** | 🟢 **CONFORME** (Fluide et direct) |
| **Mémoire JS Heap Initiale** | 12,95 Mo | **5,97 Mo** | **< 50 Mo** | 🟢 **CONFORME** (-53,9 %) |
| **Mémoire JS Heap après usage prolongé** | 172,02 Mo (fuite) | **5,63 Mo** (aucun leak) | **< 150 Mo** | 🟢 **CONFORME** (Zéro fuite mémoire) |
| **Nombre d'écouteurs d'événements (Soak)** | 2 398 | **79** | - | 🟢 **-96,7 %** (Désinscription propre) |
| **Nœuds du DOM après usage** | 44 792 | **1 516** | - | 🟢 **-96,6 %** (DOM sain) |
| **Taille des miniatures d'images affichées** | Jusqu'à 225,72 Ko (.jpg) | **8,1 Ko à 38,1 Ko** (400w.webp) | **< 80 Ko** | 🟢 **CONFORME** (Toutes < 40 Ko) |
| **Plafond Mémoire Docker Serveur API** | Aucun | **300 Mo (`mem_limit: 300m`)** | **< 300 Mo** | 🟢 **CONFORME** (`docker-compose.yml`) |
| **Plafond Mémoire Docker Base PostgreSQL** | Aucun | **512 Mo (`mem_limit: 512m`)** | **< 512 Mo** | 🟢 **CONFORME** (`docker-compose.yml`) |

---

## 2. Synthèse des Optimisations Réalisées

### A. Découpage Lazy Loading Intégral (`app.routes.ts`)
Toutes les routes de l'application ont été converties de `component: X` à `loadComponent: () => import('./...').then(m => m.X)`.
- Le bundle initial ne charge que le socle d'amorçage de l'application et la page demandée.
- Les écrans spécialisés (Restaurant, Planning, Profil client, Facturation, Exports, Écran cuisine) ne sont téléchargés et compilés qu'au moment où l'utilisateur clique dessus.
- Le bundle initial gzip tombe à **61,37 Ko**, très loin sous la contrainte des 250 Ko.

### B. Accueil V1 Épuré & Haute Ergonomie
Conformément aux directives pour la directrice de l'établissement :
- Retrait total des widgets superflus et coûteux : météo, graphique de chiffre d'affaires hebdomadaire, alertes de priorité.
- Mise en valeur des **4 chiffres clés d'exploitation** : Taux d'occupation (sur 12 chambres), Arrivées prévues du jour, Départs prévus du jour, Recette journalière encaissée.
- **5 boutons d'action rapide d'exploitation** ergonomiques (hauteur $\ge 44$ px, minimum 56 px) :
  1. *Nouvelle réservation* (ouvre directement la modale de réservation sans rechargement).
  2. *Arrivée (Check-in)* (affiche les mouvements prévus avec validation immédiate).
  3. *Départ (Check-out)* (clôture des chambres à libérer).
  4. *Commande en chambre* (accès au catalogue restaurant avec choix de la chambre).
  5. *Encaisser* (accès direct au folio et encaissements multiples).
- **Mode Démonstration** avec bouton de réinitialisation des données en 1 clic et notification explicite en français.

### C. Gestion Fine des Ressources & Données
- **Miniatures d'images** : migration systématique des références de chambres de fichiers JPG (225 Ko) vers les variantes légères WebP 400w (**8 à 38 Ko**) avec attribut `loading="lazy"`.
- **Cache hors ligne (IndexedDB)** : implémentation de `pruneOfflineCache()` dans `IdbService` limitant les réservations aux 14 prochains jours et séjours en cours, et purgeant automatiquement les factures au-delà des 100 dernières.
- **Canal de mise à jour & fuites mémoire** : désinscription des écouteurs et abonnements lors de la destruction des composants ; le nombre d'écouteurs d'événements après un cycle de 30 transitions d'écrans reste stable à **79** (contre plus de 2 300 auparavant), maintenant la mémoire JavaScript Heap à **5,63 Mo** (pour un budget autorisé de 150 Mo).

### D. Module Exports Certifié (PDF & Excel)
- Streaming côté serveur avec `ExcelJS.stream.xlsx.WorkbookWriter` et `PDFDocument.pipe(res)` garantissant une empreinte RAM minimale quelle que soit la taille du document.
- Protection stricte contre l'injection de formules tableur (`sanitizeSpreadsheetCell` neutralise `=`, `+`, `-`, `@`).
- Bornes temporelles (maximum 12 mois / 366 jours) et plafond à 50 000 lignes.
- Matrice des 6 modèles V1 conformes avec isolation du fichier clients pour la Direction seule.

---

## 3. Conclusion

Tous les budgets de performance fixés dans le cahier des charges sont **strictement respectés et validés par des tests automatisés (CI/Playwright/Jest)**.
L'application Résidence Blue offre désormais une réactivité instantanée, compatible avec des postes informatiques modestes et des connexions locales sénégalaises.
