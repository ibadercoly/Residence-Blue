# Design Tokens — Résidence Blue (PMS)

Ce document formalise les jetons de conception (Design Tokens) extraits des 10 maquettes interactives et du document de référence `DESIGN.md`. Il réconcilie les variations, élimine les doublons et propose une version unifiée pour l'intégration Angular & SCSS.

---

## 1. Diagnostic des Variations & Unification

Lors de l'analyse des maquettes Google Stitch, des décalages mineurs ont été constatés entre le texte descriptif de `DESIGN.md` et les déclarations réelles dans le code HTML/Tailwind des maquettes :

| Élément | Valeur dans texte DESIGN.md | Valeur dans config Tailwind HTML | Décision d'Unification retenue |
|---|---|---|---|
| **Couleur Primaire (Teal)** | `#0e8f9b` | `#00666f` (avec container `#00818c`) | **`#00666f`** : Conforme aux maquettes HTML validées et garantit un ratio de contraste WCAG AA supérieur (4.9:1 sur blanc). |
| **Couleur Secondaire (Or Teranga)** | `#e0a53a` | `#7e5700` (container `#fdbe51`) | **`#7e5700`** : Base sombre pour le texte et badges contrastés, avec container doré chaleureux **`#fdbe51`** pour les fonds d'accents VIP. |
| **Fond général (Canvas)** | `#eaf1f5` | `#f3fafe` | **`#f3fafe`** : Teinte lumineuse, aérée et apaisante utilisée sur les 10 écrans. |
| **Sidebar & Inverse Surface** | `#0a2540` (Navy) | `#2a3135` (Gris ardoise sombre) | **`#2a3135`** : Conforme à l'écran directeur `tableau_de_bord`. Moins froid que le bleu nuit, excellente lisibilité des icônes cyan. |
| **Rayons de courbure (Cards)** | `1rem` (16px) | `rounded-2xl` (16px à 24px) | Unification : `16px` (`1rem`) pour les cartes standard, `24px` (`1.5rem`) pour les conteneurs bento et modals. |

---

## 2. Palette de Couleurs Unifiée

### 2.1. Palette Principale & Surfaces (Mode Clair)

```css
/* Couleurs de marque */
--color-primary: #00666f;             /* Cyan Océan profond */
--color-on-primary: #ffffff;
--color-primary-container: #00818c;   /* Cyan lumineux pour boutons actifs */
--color-on-primary-container: #f6feff;
--color-primary-fixed: #8cf2ff;
--color-primary-fixed-dim: #6fd5e2;

--color-secondary: #7e5700;           /* Or ambré Teranga */
--color-on-secondary: #ffffff;
--color-secondary-container: #fdbe51; /* Badge doré VIP & réservations confirmées */
--color-on-secondary-container: #714d00;
--color-secondary-fixed: #ffdead;
--color-secondary-fixed-dim: #fabc4f;

--color-tertiary: #465d7b;            /* Bleu acier opérationnel */
--color-on-tertiary: #ffffff;
--color-tertiary-container: #5f7695;
--color-on-tertiary-container: #fdfcff;

/* Surfaces et élévations */
--color-background: #f3fafe;          /* Fond général doux */
--color-on-background: #161d20;
--color-surface: #f3fafe;
--color-on-surface: #161d20;          /* Texte principal haute lisibilité */
--color-on-surface-variant: #3d494a;  /* Texte secondaire */
--color-surface-container-lowest: #ffffff; /* Fond de carte blanc pur */
--color-surface-container-low: #eef5f9;    /* Fond de tableau / zone d'action */
--color-surface-container: #e8eff3;        /* Séparateurs et fonds neutres */
--color-surface-container-high: #e2e9ed;
--color-surface-container-highest: #dce4e7;

/* Surface sombre (Sidebar & Shells contrastés) */
--color-inverse-surface: #2a3135;     /* Fond de la barre latérale gauche */
--color-inverse-on-surface: #ebf2f6;  /* Texte sur barre latérale */
--color-outline: #6d797b;             /* Bordures et icônes neutres */
--color-outline-variant: #bdc9ca;     /* Bordures douces et séparateurs */
```

### 2.2. Couleurs Métier & Statuts d'Exploitation

```css
/* États des chambres et réservations */
--status-available-text: #065f46;
--status-available-bg: #ecfdf5;
--status-available-border: #a7f3d0;
--status-available-dot: #10b981;      /* Émeraude : Chambre libre / Réalisé */

--status-occupied-text: #991b1b;
--status-occupied-bg: #fef2f2;
--status-occupied-border: #fecaca;
--status-occupied-dot: #ef4444;       /* Rouge cramoisi : Chambre occupée / Urgent */

--status-cleaning-text: #92400e;
--status-cleaning-bg: #fffbeb;
--status-cleaning-border: #fde68a;
--status-cleaning-dot: #f59e0b;       /* Ambre : Recouche / Ménage en cours */

--status-maintenance-text: #334155;
--status-maintenance-bg: #f1f5f9;
--status-maintenance-border: #cbd5e1;
--status-maintenance-dot: #64748b;    /* Ardoise : Hors service / Maintenance */

/* Alertes & Erreurs */
--color-error: #ba1a1a;
--color-on-error: #ffffff;
--color-error-container: #ffdad6;
--color-on-error-container: #93000a;
```

### 2.3. Adaptation Mode Sombre (Dark Mode)

```css
[data-theme="dark"] {
  --color-background: #12181b;
  --color-on-background: #ebf2f6;
  --color-surface: #12181b;
  --color-on-surface: #ebf2f6;
  --color-on-surface-variant: #bdc9ca;
  
  --color-surface-container-lowest: #192024;
  --color-surface-container-low: #1e262a;
  --color-surface-container: #242c30;
  --color-surface-container-high: #2a3338;
  --color-surface-container-highest: #30393f;
  
  --color-primary: #6fd5e2;           /* Cyan éclairci pour contraste sur fond noir */
  --color-on-primary: #00363b;
  --color-primary-container: #004f56;
  --color-on-primary-container: #8cf2ff;
  
  --color-secondary: #fabc4f;         /* Or éclairci */
  --color-on-secondary: #422c00;
  --color-secondary-container: #604100;
  --color-on-secondary-container: #ffdead;
  
  --color-outline: #879395;
  --color-outline-variant: #3d494a;
  --color-inverse-surface: #f3fafe;
  --color-inverse-on-surface: #161d20;
}
```

---

## 3. Typographie

Deux familles de polices sont rigoureusement associées :
1. **`Newsreader`** (Serif) : Utilisée pour les titres de prestige, le nom de l'établissement, les catégories de chambres et les citations éditoriales.
2. **`Manrope`** (Sans-serif géométrique) : Utilisée pour toutes les données opérationnelles, grilles de planning, tableaux, formulaires, boutons et montants financiers.

### 3.1. Échelle Typographique

| Jeton | Police | Taille | Hauteur de ligne | Graisse | Tracking | Usage cible |
|---|---|---|---|---|---|---|
| `display-lg` | Newsreader | 48px (3rem) | 56px | 400 (Regular) | -0.02em | Grands titres d'accueil bureau |
| `display-lg-mobile` | Newsreader | 32px (2rem) | 40px | 400 (Regular) | -0.01em | Titres d'accueil tablette/mobile |
| `headline-lg` | Newsreader | 32px (2rem) | 40px | 500 (Medium) | -0.01em | Titres de sections majeures |
| `headline-md` | Newsreader | 24px (1.5rem) | 32px | 500 (Medium) | 0 | Titres de fiches et sous-parties |
| `headline-sm` | Newsreader | 20px (1.25rem) | 28px | 600 (SemiBold)| 0 | Titres de cartes bento & blocs |
| `title-lg` | Manrope | 18px (1.125rem) | 26px | 700 (Bold) | 0 | Titres d'alertes, noms de tables |
| `title-md` | Manrope | 16px (1rem) | 24px | 600 (SemiBold)| 0 | Noms de clients, boutons majeurs |
| `body-lg` | Manrope | 16px (1rem) | 26px | 400 (Regular) | 0 | Textes descriptifs longs |
| `body-md` | Manrope | 14px (0.875rem) | 22px | 400 (Regular) | 0 | Corps de texte standard |
| `body-sm` | Manrope | 13px (0.8125rem)| 18px | 500 (Medium) | 0 | Métadonnées, heures, aides |
| `label-lg` | Manrope | 14px (0.875rem) | 20px | 600 (SemiBold)| +0.01em | Libellés d'inputs, boutons |
| `label-md` | Manrope | 12px (0.75rem) | 16px | 600 (SemiBold)| +0.02em | Badges de statut, surtitres majuscules |
| **`label-currency`** | **Manrope** | **16px (1rem)** | **20px** | **700 (Bold)** | **-0.01em** | **Montants monétaires entiers FCFA** |

---

## 4. Rayons de Courbure (Border Radii)

```css
--radius-xs: 4px;      /* 0.25rem - Sélecteurs calendrier, puces */
--radius-sm: 8px;      /* 0.5rem - Inputs de formulaire, petits boutons */
--radius-md: 12px;     /* 0.75rem - Lignes de tickets, filtres, cartes internes */
--radius-lg: 16px;     /* 1.0rem - Cartes standards, panneaux du planning */
--radius-xl: 20px;     /* 1.25rem - Cartes Bento du dashboard directeur */
--radius-2xl: 24px;    /* 1.5rem - Modals, conteneurs principaux */
--radius-full: 9999px; /* Pastilles rondes, badges VIP, avatars */
```

---

## 5. Élévations & Ombres Portées (Box Shadows)

Les ombres utilisent une teinte bleue marine estompée (`rgba(10, 37, 64, ...)`) pour conserver la fraîcheur de l'aura balnéaire sans créer de grisaille artificielle :

```css
/* Ombre subtile pour éléments plats */
--shadow-xs: 0 1px 2px 0 rgba(10, 37, 64, 0.04);

/* Ombre standard de carte */
--shadow-sm: 0 1px 8px 0 rgba(10, 37, 64, 0.05);

/* Ombre d'élévation moyenne (survol de carte bento) */
--shadow-md: 0 4px 16px -2px rgba(10, 37, 64, 0.08), 0 2px 4px -1px rgba(10, 37, 64, 0.04);

/* Ombre flottante haute (Modals, menus déroulants, volets) */
--shadow-lg: 0 12px 32px -4px rgba(10, 37, 64, 0.12), 0 4px 8px -2px rgba(10, 37, 64, 0.04);

/* Ombre d'accent primaire au survol d'un bouton CTA */
--shadow-primary-hover: 0 4px 14px 0 rgba(0, 102, 111, 0.35);
```

---

## 6. Échelle d'Espacement (Spacing Scale)

Construite sur un rythme modulaire basé sur 4px :

```css
--space-1: 4px;    /* 0.25rem - space-xs */
--space-2: 8px;    /* 0.5rem  - space-sm */
--space-3: 12px;   /* 0.75rem */
--space-4: 16px;   /* 1.0rem  - space-md / gutter-sm */
--space-5: 20px;   /* 1.25rem */
--space-6: 24px;   /* 1.5rem  - space-lg / gutter */
--space-8: 32px;   /* 2.0rem  - margin */
--space-10: 40px;  /* 2.5rem  - space-xl */
--space-12: 48px;  /* 3.0rem */
--space-16: 64px;  /* 4.0rem */

/* Dimensions structurelles fixes */
--sidebar-width: 256px;   /* w-64 */
--header-height: 80px;    /* h-20 bureau */
--header-height-mobile: 64px; /* h-16 mobile */
--bottom-nav-height: 64px;
```
