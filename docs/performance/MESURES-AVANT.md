# MESURES-AVANT : Audit Initial de Performance et Poids (Version de Production)

> **Date de mesure** : 9 novembre 2026  
> **Environnement de test** : Build de production Angular (`ng build --configuration production`), distribution servie en HTTP avec compression gzip (`http://localhost:8089`), navigateur Chromium (Playwright + Chrome DevTools Protocol `Performance.getMetrics`).  
> **Contexte** : Hôtel Résidence Blue (12 chambres, restaurant, piscine, Grand Standing Thiès, Sénégal). Présentation à la direction — exigence absolue : ultra légèreté, fluidité immédiate, aucun lag.

---

## 1. Synthèse des Métriques Réelles Mesurées

| Métrique | Valeur Constatée (AVANT) | Budget Cible (Exigence) | Statut |
| :--- | :---: | :---: | :---: |
| **JavaScript Initial (Raw)** | **756,27 Ko** | - | ⚠️ Élevé (monolithique) |
| **JavaScript Initial (Gzip)** | **201,46 Ko** | < 250 Ko | ✅ Dans la limite brute mais tout est dans main.js |
| **Découpage des routes (Lazy Loading)** | **0 chunk différé** (100% dans `main.js`) | < 120 Ko par route | ❌ Aucun lazy loading de route |
| **Police Material Symbols** | **3 917,96 Ko (3,92 Mo)** | < 100 Ko sous-ensemble | ❌ Énorme (police d'icônes complète) |
| **Premier affichage (PC normal)** | **2 266 ms** (FCP: 1 404 ms) | < 2 000 ms | ⚠️ Dépassement léger |
| **Premier affichage (PC modeste CPU 4x)** | **14 014 ms (14,0 s)** | < 2 000 ms | ❌ Échec critique (> 7× le budget) |
| **Navigation entre écrans (moyenne)** | **488 ms** (pics à 622 ms) | < 300 ms | ❌ Trop lent (re-rendu complet) |
| **Mémoire JS Heap Initiale** | **12,95 Mo** | < 50 Mo | ✅ Conforme au démarrage |
| **Mémoire JS Heap après usage (50 navigations)** | **172,02 Mo** (64 089 nœuds DOM) | < 150 Mo | ❌ Fuite mémoire détectée (> 150 Mo) |
| **Poids des images de chambres** | Jusqu'à **225,72 Ko** par image | < 80 Ko | ❌ Images non allégées |
| **Limites mémoire Docker (API / DB)** | **Aucune limite configurée** | API < 300 Mo, DB < 512 Mo | ❌ Risque d'OOM sur petit serveur |

---

## 2. Détail des Fichiers du Bundle Initial (Production)

- **`main-ODOP3OJI.js`** : 739 838 octets (722,50 Ko brut, 189,29 Ko gzip, 153,76 Ko brotli)
- **`polyfills-YMBILSHJ.js`** : 34 585 octets (33,77 Ko brut, 12,17 Ko gzip, 11,07 Ko brotli)
- **`styles-PDSOGF3J.css`** : 84 273 octets (82,30 Ko brut, 12,78 Ko gzip, 10,26 Ko brotli)
- **Total Bundle Initial (JS + CSS)** : 858,70 Ko brut / 214,24 Ko gzip

### Tailles des Polices Locales dans `/media`
- `material-symbols-outlined-4WLI33GR.woff2` : **4 011 996 octets (3,92 Mo)**
- `newsreader-latin-400-italic-*.woff` : 30 876 octets (30,15 Ko)
- `newsreader-latin-500-normal-*.woff` : 29 636 octets (28,94 Ko)
- `newsreader-latin-400-normal-*.woff` : 28 288 octets (27,63 Ko)
- `manrope-latin-*.woff2` : ~14 Ko par variante (400, 500, 600, 700)

### Top des Images les Plus Lourdes
1. `assets/images/chambres/chambre-102-standard.jpg` : **225,72 Ko** (231 133 octets)
2. `assets/images/chambres/chambre-102-standard-1600w.webp` : **225,41 Ko** (230 822 octets)
3. `assets/images/chambres/chambre-204-bungalow-deluxe.jpg` : **223,19 Ko** (228 545 octets)
4. `assets/images/chambres/chambre-204-bungalow-deluxe-1600w.webp` : **209,63 Ko** (214 666 octets)
5. `assets/images/chambres/chambre-104-standard-1600w.webp` : **180,89 Ko** (185 236 octets)
6. `assets/images/chambres/chambre-201-deluxe-1600w.webp` : **175,39 Ko** (179 596 octets)
7. `assets/images/chambres/chambre-103-standard-1600w.webp` : **144,84 Ko** (148 312 octets)
8. `assets/images/hero-dashboard.webp` : **106,14 Ko** (108 692 octets)

---

## 3. Temps de Navigation Constatés entre Écrans

| Transition d'Écran | Temps Constaté (ms) | Seuil Maximal Toléré (ms) |
| :--- | :---: | :---: |
| `/tableau-de-bord` -> `/planning` | **332 ms** | 300 ms |
| `/planning` -> `/chambres` | **585 ms** | 300 ms |
| `/chambres` -> `/clients/c1` | **437 ms** | 300 ms |
| `/clients/c1` -> `/facturation` | **622 ms** | 300 ms |
| `/facturation` -> `/restaurant` | **583 ms** | 300 ms |
| `/restaurant` -> `/tableau-de-bord` | **372 ms** | 300 ms |

---

## 4. Les 10 Plus Gros Problèmes Identifiés

### 1. Absence totale de Lazy Loading (`app.routes.ts`)
Toutes les pages (`DashboardPageComponent`, `RoomsComponent`, `PlanningPageComponent`, `ClientProfilePageComponent`, `FacturationPageComponent`, `RestaurantPageComponent`, `MenuManagementModalComponent`) sont importées de manière statique au démarrage. Le fichier `main.js` contient la totalité de l'application, ce qui alourdit considérablement le temps d'exécution initiale sur processeur modeste.

### 2. Police Material Symbols non sous-ensemble (3,92 Mo)
Le fichier `material-symbols-outlined.woff2` pèse **4,01 Mo** car il contient des milliers de glyphes inutilisés par l'application. Pour une directrice sur connexion 3G/4G au Sénégal, télécharger 4 Mo bloque le premier affichage.

### 3. Effondrement des performances sur CPU modeste (14 secondes)
Avec un processeur ralenti 4x (simulation d'un PC portable bureautique standard ou d'une tablette d'accueil), le premier affichage prend 14 014 ms au lieu de 2 secondes max. La cause principale est la quantité massive de JS à parser et évaluer au démarrage.

### 4. Fuite mémoire lors de la navigation (172 Mo et 64 000 nœuds DOM)
Après 50 changements d'écrans, la mémoire du tas JS grimpe de 12,95 Mo à **172,02 Mo** avec plus de 64 000 nœuds DOM et 3 170 écouteurs d'événements non libérés. Des abonnements ou écouteurs globaux restent attachés sans destruction propre (`takeUntilDestroyed` ou nettoyage).

### 5. Images de chambres non optimisées pour le web (> 220 Ko)
Plusieurs photos de chambres dépassent 220 Ko (fichiers originaux 1600px chargés même en miniature dans les cartes de chambres et de restaurant), violant la limite de 80 Ko.

### 6. Écran Accueil surchargé de widgets non essentiels
Le tableau de bord actuel affiche une météo côtière, des graphiques SVG complexes, des actions prioritaires redondantes et des indicateurs avancés qui ralentissent le premier rendu au lieu d'afficher directement les 4 chiffres clés et les 5 actions d'exploitation.

### 7. Menu de navigation comportant trop d'options sans filtrage par rôle
L'interface comporte des entrées de menu non pertinentes pour la directrice ou la réception, sans architecture claire de désactivation par feature flags (`modules.json`).

### 8. Absence de limites de ressources dans Docker (`docker-compose.yml`)
Ni `db` (PostgreSQL) ni `api` (NestJS) ne disposent de directives `deploy.resources.limits.memory`. En cas de requête lourde ou d'export volumineux, le conteneur peut saturer la RAM de la machine hôte.

### 9. Absence de pagination et chargement intégral des données en mémoire
Les services actuels chargent l'intégralité des réservations, clients et historiques de facturation en mémoire dans des tableaux statiques, sans pagination serveur (20 à 50 lignes) ni limitation de la fenêtre visible du planning (14 jours).

### 10. Module d'export absent de la pile de production
Aucun système de génération d'exports PDF et Excel natif et sécurisé par flux (`pdfmake` / `exceljs`) n'est en place pour décharger la mémoire du navigateur lors de l'extraction de bilans et de clôtures de caisse.
