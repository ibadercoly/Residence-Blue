# Répertoire des Valeurs Exactes — Tableau de Bord Résidence Blue

> **Source de Vérité :** `design/maquettes/tableau_de_bord/code.html` et `screen.png`  
> **Dimensions exactes de screen.png :** **1 112 px (largeur) × 1 600 px (hauteur)**  
> **Dimensions exactes de tableau_de_bord_mode_clair/screen.png :** **292 px (largeur) × 1 600 px (hauteur)**

---

## 1. Structure Globale & Dimensions d'Agencement

- **Barre latérale (Sidebar) :**
  - Position : Fixe à gauche (`fixed left-0 top-0 h-full z-50`).
  - Largeur : `w-64` = **256 px** (`16rem`).
  - Fond : `bg-inverse-surface` = **`#2a3135`**.
  - Ombre : `shadow-[0_1px_8px_rgba(0,0,0,0.06)]`.
  - En-tête de logo : Hauteur `h-20` = **80 px**, padding horizontal `px-gutter` = **24 px**.
  - Séparateur section : Padding vertical `py-space-sm` = **8 px**, horizontal `px-space-md` = **16 px**.
  - Pied de barre : Padding `p-gutter` = **24 px**.

- **En-tête supérieur (Header) :**
  - Position : Fixe en haut (`fixed top-0 left-64 right-0 z-40`).
  - Hauteur : `h-20` = **80 px** (`5rem`).
  - Décalage gauche : `left-64` = **256 px**.
  - Fond : `bg-surface/90` (`#f3fafe` avec 90% d'opacité) avec `backdrop-blur-xl`.
  - Ombre : `shadow-[0_1px_8px_rgba(0,0,0,0.04)]`.
  - Padding horizontal : `px-margin` = **32 px** (`2rem`).
  - Champ de recherche : Largeur max `max-w-xl`, hauteur `h-11` = **44 px**, fond `bg-surface-container-lowest` (`#ffffff`), ombre `shadow-[0_2px_8px_rgba(10,37,64,0.04)]`, rayon `rounded-xl`.
  - Bouton « Nouvelle réservation » : Hauteur `h-11` = **44 px**, padding `px-gutter` = **24 px**, fond `bg-primary` (`#00666f`), rayon `rounded-xl`, police `font-label-lg text-label-lg` (14px, 600).
  - Bouton notifications : `w-11 h-11` = **44 × 44 px**, rayon `rounded-xl`, pastille `w-2 h-2` `bg-secondary` (`#7e5700`).
  - Profil utilisateur : Avatar `w-8 h-8` `rounded-full` `bg-primary`, nom `Aïssatou Ba` (14px, 600), rôle `Directrice Générale` (12px, 600).

- **Zone de contenu principal (Main Canvas) :**
  - Décalage : `pl-64` (256 px pour compenser la sidebar), `pt-20` (80 px pour le header), `px-margin` (32 px).
  - Espacement vertical interne : `space-y-8` (32 px).
  - Padding inférieur : `pb-16` (64 px).

---

## 2. Configuration Tailwind Exacte Relevée

### Couleurs
```json
{
  "primary": "#00666f",
  "on-primary": "#ffffff",
  "primary-container": "#00818c",
  "on-primary-container": "#f6feff",
  "primary-fixed": "#8cf2ff",
  "primary-fixed-dim": "#6fd5e2",
  "on-primary-fixed": "#001f23",
  "on-primary-fixed-variant": "#004f56",
  "inverse-primary": "#6fd5e2",

  "secondary": "#7e5700",
  "on-secondary": "#ffffff",
  "secondary-container": "#fdbe51",
  "on-secondary-container": "#714d00",
  "secondary-fixed": "#ffdead",
  "secondary-fixed-dim": "#fabc4f",
  "on-secondary-fixed": "#281900",
  "on-secondary-fixed-variant": "#604100",

  "tertiary": "#465d7b",
  "on-tertiary": "#ffffff",
  "tertiary-container": "#5f7695",
  "on-tertiary-container": "#fdfcff",
  "tertiary-fixed": "#d2e4ff",
  "tertiary-fixed-dim": "#b0c8eb",
  "on-tertiary-fixed": "#001c37",
  "on-tertiary-fixed-variant": "#314865",

  "background": "#f3fafe",
  "on-background": "#161d20",
  "surface": "#f3fafe",
  "surface-bright": "#f3fafe",
  "surface-dim": "#d4dbdf",
  "on-surface": "#161d20",
  "on-surface-variant": "#3d494a",

  "surface-container-lowest": "#ffffff",
  "surface-container-low": "#eef5f9",
  "surface-container": "#e8eff3",
  "surface-container-high": "#e2e9ed",
  "surface-container-highest": "#dce4e7",
  "surface-variant": "#dce4e7",
  "surface-tint": "#006972",

  "inverse-surface": "#2a3135",
  "inverse-on-surface": "#ebf2f6",

  "outline": "#6d797b",
  "outline-variant": "#bdc9ca",

  "error": "#ba1a1a",
  "on-error": "#ffffff",
  "error-container": "#ffdad6",
  "on-error-container": "#93000a"
}
```

### Rayons de courbure (Border Radius)
- `DEFAULT` : `0.25rem` (4 px)
- `lg` : `0.5rem` (8 px)
- `xl` : `0.75rem` (12 px)
- `2xl` : `1rem` (16 px)
- `full` : `9999px`

### Espacements personnalisés (Spacing)
- `space-xs` : `0.25rem` (4 px)
- `space-sm` : `0.5rem` (8 px)
- `space-md` : `1rem` (16 px)
- `space-lg` : `1.5rem` (24 px)
- `space-xl` : `2.5rem` (40 px)
- `gutter-sm` : `1rem` (16 px)
- `gutter` : `1.5rem` (24 px)
- `margin-sm` : `1rem` (16 px)
- `margin` : `2rem` (32 px)

### Familles et Tailles Typographiques
- **Familles :**
  - `Newsreader` (Serif) pour : `display-lg`, `display-lg-mobile`, `headline-lg`, `headline-lg-mobile`, `headline-md`, `headline-sm`.
  - `Manrope` (Sans-serif) pour : `title-lg`, `title-md`, `body-lg`, `body-md`, `body-sm`, `label-lg`, `label-md`, `label-currency`.
- **Échelle exacte :**
  - `display-lg` : 48px, line-height 56px, tracking -0.02em, weight 400
  - `display-lg-mobile` : 32px, line-height 40px, tracking -0.01em, weight 400
  - `headline-lg` : 32px, line-height 40px, tracking -0.01em, weight 500
  - `headline-lg-mobile` : 26px, line-height 34px, tracking -0.01em, weight 500
  - `headline-md` : 24px, line-height 32px, weight 500
  - `headline-sm` : 20px, line-height 28px, weight 600
  - `title-lg` : 18px, line-height 26px, weight 700
  - `title-md` : 16px, line-height 24px, weight 600
  - `body-lg` : 16px, line-height 26px, weight 400
  - `body-md` : 14px, line-height 22px, weight 400
  - `body-sm` : 13px, line-height 18px, weight 500
  - `label-lg` : 14px, line-height 20px, tracking 0.01em, weight 600
  - `label-md` : 12px, line-height 16px, tracking 0.02em, weight 600
  - `label-currency` : 16px, line-height 20px, tracking -0.01em, weight 700

---

## 3. Détail des Éléments & Textes Français Exacts

### 3.1. Barre latérale (Sidebar)
- **Icône logo :** `tsunami` (24px, fond `bg-primary`, texte `text-on-primary`, arrondi `rounded-xl`).
- **Titres :**
  - « Résidence Blue » (`font-headline-sm text-headline-sm text-surface-bright tracking-tight`).
  - « Hôtel Boutique • Grand Standing, Thiès » (`font-label-md text-label-md text-outline-variant uppercase tracking-wider`).
  - « Exploitation 12 Clés » (`font-label-md text-label-md text-outline-variant uppercase tracking-wider`).
- **Liens de navigation (avec icônes Material Symbols 20px) :**
  1. `dashboard` → « Tableau de bord » (Actif : `bg-primary text-on-primary font-title-md rounded-lg`).
  2. `calendar_month` → « Planning » (`text-surface-container-high hover:bg-surface-variant/20 hover:text-surface-bright`).
  3. `bed` → « Chambres »
  4. `group` → « Clients »
  5. `restaurant` → « Restaurant »
  6. `cleaning_services` → « Housekeeping »
  7. `build` → « Maintenance »
  8. `receipt_long` → « Facturation »
  9. `analytics` → « Rapports »
  10. `settings` → « Paramètres »
- **Widget bas de sidebar :**
  - Fond `bg-surface-variant/10 rounded-xl p-space-md`.
  - « Front de Mer » (`font-label-md text-label-md text-surface-container-high`).
  - « Marée haute • 28°C » (`font-body-sm text-body-sm text-outline-variant`).
  - Icône `wb_sunny` (`text-primary-fixed-dim text-[20px]`).

### 3.2. En-tête (Header)
- Champ de recherche : icône `search` (20px `text-outline`), placeholder « Rechercher une réservation, client, chambre... ».
- Bouton : icône `add` (18px), « Nouvelle réservation ».
- Bouton notifications : icône `notifications` (22px), puce `bg-secondary` avec bordure `ring-2 ring-surface-container-lowest`.
- Séparateur : `h-8 w-px bg-surface-variant/60`.
- Utilisateur : icône `person`, nom « Aïssatou Ba », point vert cyan `w-1.5 h-1.5 rounded-full bg-primary`, rôle « Directrice Générale ».

### 3.3. Bannière Hero Supérieure
- Hauteur `h-80` (320 px), arrondi `rounded-2xl`, ombre `shadow-lg`, dégradés sombres.
- Badges supérieurs :
  - `bg-secondary/90 text-on-secondary font-label-md uppercase tracking-wider rounded-full backdrop-blur-md` : point clignotant `animate-pulse`, « Haute saison • 9 chambres occupées sur 12 ».
  - `bg-surface-container-lowest/20 backdrop-blur-md text-surface-bright font-label-md rounded-full` : icône `sunny`, « Thiès, Grand Standing • 29°C Ensoleillé ».
- Titre : « Bienvenue à la Résidence Blue » (`font-headline-lg text-headline-lg md:text-[38px] text-surface-bright tracking-tight`).
- Sous-titre : « Boutique Hôtel 12 Chambres • Petite Côte, Sénégal • Vendredi 24 Mai • Service Conciergerie & Exploitation » (`font-body-md text-surface-variant/90`).

### 3.4. Grille des 4 Cartes KPI Bento (`gap-gutter` = 24px)
1. **KPI 1 : Taux d'occupation**
   - Libellé : « Taux d'occupation » (12px, 600, uppercase).
   - Icône : `hotel` (20px, dans carré 36×36 `bg-surface-container-low text-primary rounded-xl`).
   - Valeur : « 75 % » (`font-headline-md font-semibold text-on-surface`).
   - Évolution : « +5% vs hier » (icône `trending_up` 14px, `text-primary`).
   - Jauge : Hauteur 8px (`h-2 rounded-full bg-surface-container`), remplissage 75% (`bg-primary`).
   - Légende : « Objectif mensuel: 80% » (`text-outline`) | « 9 clés actives » (`text-primary font-medium`).
2. **KPI 2 : Chambres occupées**
   - Libellé : « Chambres occupées ».
   - Icône : `key` (20px).
   - Valeur : « 9 / 12 » (9 en 24px semi-bold, / 12 en 18px normal).
   - Badge : « 3 Disponibles » (`bg-surface-container-high text-on-surface-variant rounded-full`).
   - Détail : Point `w-2.5 h-2.5 rounded-full bg-primary-container`, « 2 en recouche • 1 prête ».
3. **KPI 3 : Revenu du jour**
   - Libellé : « Revenu du jour ».
   - Icône : `payments` (20px `text-secondary`).
   - Valeur : « 485 000 FCFA » (485 000 en 18px bold, FCFA en 14px `text-primary`).
   - Détail : Fond `bg-surface-container-low/70 rounded-xl`, « Héberg. 395 000 F • Resto 90 000 F ».
4. **KPI 4 : Mouvements Clés**
   - Libellé : « Mouvements Clés ».
   - Icône : `swap_horiz` (20px).
   - Valeur : « 2 / 1 » (Entrées / Sorties).
   - Détail : icône `schedule` (16px `text-primary`), « 1 départ réglé • 2 arrivées à suivre ».

### 3.5. Graphique : Revenus de la semaine (`lg:col-span-8`)
- En-tête : « Performances financières • Semaine 21 », « Revenus de la semaine », badge « Total estimé : 3 465 000 FCFA ».
- Barres (Hauteur 224 px / `h-56`) :
  - Lun : 420k (67% hauteur) `bg-surface-variant hover:bg-tertiary-container`
  - Mar : 380k (61% hauteur)
  - Mer : 510k (82% hauteur)
  - Jeu : 460k (74% hauteur)
  - Ven : 485k (78% hauteur) — *Aujourd'hui* : badge « Aujourd'hui » au-dessus, couleur `bg-primary`, texte vert cyan bold.
  - Sam : 620k* (100% hauteur) — Couleur dorée `bg-secondary-container`.
  - Dim : 590k* (95% hauteur)
- Pied : Légende avec carrés colorés : « Réalisé » (`bg-primary`), « Réservations confirmées (*) » (`bg-secondary-container`), « Taux moyen semaine : 78.4% ».

### 3.6. Liste : Arrivées attendues aujourd'hui (`lg:col-span-8`)
- En-tête : « Réception & Conciergerie », « Arrivées attendues aujourd'hui », badge « 2 clients attendus ».
- Client 1 :
  - Avatar rond `w-12 h-12 bg-primary text-on-primary font-bold` : `MD`.
  - Nom : « M. Mamadou Diop » (`font-title-md font-semibold text-on-surface`).
  - Badge : « VIP Gold » (icône `workspace_premium` 13px, fond `bg-secondary-fixed text-on-secondary-fixed`).
  - Détail : « Suite Océan (Ch. 01) • 3 nuits • Arrivée prévue 14h30 ».
  - Actions : Bouton téléphone `phone` (40×40px), bouton fiche `receipt_long` (40×40px), bouton « Check-in » (icône `how_to_reg`, `h-10 px-gutter bg-primary text-on-primary rounded-xl`).
- Client 2 :
  - Avatar rond `w-12 h-12 bg-tertiary text-on-tertiary font-bold` : `CL`.
  - Nom : « Mme Claire Lefèvre ».
  - Badge : « Navette aéroport confirmée » (icône `directions_car`, fond `bg-surface-container-high`).
  - Détail : « Deluxe Plage (Ch. 05) • 2 nuits • Arrivée prévue 16h00 ».
  - Actions identiques : Téléphone, Fiche, Bouton « Check-in ».

### 3.7. Actions prioritaires (`lg:col-span-4`)
- En-tête : Icône `notifications_active` (22px `text-secondary`), « Actions prioritaires », badge « 3 alertes » (`bg-error-container text-on-error-container font-semibold`).
- Alerte 1 (Ambre) :
  - Ruban / Surtitre : « Stock Épicerie • Alerte • Il y a 30m » (point `bg-secondary`).
  - Titre : « Café Touba & Vins de réserve bas ».
  - Description : « Seuil critique atteint au Bar Teranga. Réapprovisionnement nécessaire avant le service du dîner. ».
  - Bouton : « Commander » (icône `shopping_cart`, fond `bg-secondary text-on-secondary`).
- Alerte 2 (Rouge / Urgence) :
  - Ruban / Surtitre : « Technique • Urgent • Ch. 12 » (point `bg-error animate-ping`).
  - Titre : « Climatisation Suite Filaos ».
  - Description : « Dysfonctionnement signalé ce matin. Technicien froid convoqué sur place pour 15h00. ».
  - Bouton : « Suivre le ticket » (icône `build`, fond `bg-error text-on-error`).
- Alerte 3 (Information / Folios) :
  - Ruban / Surtitre : « Facturation en suspens • 145 000 FCFA » (point `bg-primary`).
  - Titre : « Folios en attente de clôture ».
  - Description : « Règlements extras piscine & restaurant pour Ch. 03 (M. Diallo) et Ch. 07 (Mme Ndiaye). ».
  - Bouton : « Voir folios » (icône `visibility`, fond `bg-surface-container-highest`).

### 3.8. Widget Météo & Ambiance (`lg:col-span-4`)
- Titre : Icône `water`, « Météo marine & Marée » (ou adapté Thiès), surtitre « Plage Privée ».
- Bloc dégradé `from-surface-container-low to-surface-container rounded-xl p-space-md` :
  - Marée haute 16h40 | Coefficient 78 • Bon.
  - Eau de mer : 27°C (icône `thermostat`).
  - Brise côtière : 14 km/h NO (icône `air`).
  - Info bas : Icône `deck`, « Transats & paillotes préparés au front de mer ».
