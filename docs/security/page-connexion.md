# Porte de Sécurité : Authentification & Page de Connexion (/connexion)

## 1. Contexte & Périmètre
- **Composant testé :** `ConnexionPageComponent`, `AuthMockService`, `LayoutComponent`.
- **Route :** `/connexion` (route isolée sans barre latérale, sans header, sans navigation basse).
- **Règles applicables (AGENTS.md) :**
  - Validation stricte des entrées.
  - Zéro secret ou mot de passe en dur ou prérempli dans l'UI de production.
  - Zéro ressource distante / CDN (tout en local).
  - Aucune fuite de session dans l'URL ou le DOM.
  - Résistance aux injections XSS.
  - Respect du verrouillage de session après inactivité (15 min) et session 8h.

---

## 2. Vecteurs d'Attaque Testés

### A. Fuite d'identifiants préremplis (CWE-200)
- **Scénario :** Charger la page `/connexion` et vérifier si des identifiants (email, mot de passe) sont stockés ou injectés dans le DOM.
- **Résultat :** **CONFORME**. Les champs `user-login` et `user-password` sont rigoureusement vides à l'initialisation. Les profils de démonstration sont isolés derrière l'indicateur d'environnement `isDevMode()`.

### B. Injections XSS dans les champs (CWE-79)
- **Scénario :** Injection de charges XSS `<img src=x onerror="alert('XSS')">` et `<script>alert(1)</script>` dans les champs d'identifiant et mot de passe.
- **Résultat :** **CONFORME**. Angular neutralise et échappe par défaut toutes les valeurs liées via interpolation et data-binding (`[value]` / event binding). Aucun script ou élément DOM pirate n'a pu s'exécuter.

### C. Écoute de réseau et dépendances distantes / CDN (CWE-319)
- **Scénario :** Analyse des requêtes HTTP sortantes lors du chargement de `/connexion`.
- **Résultat :** **CONFORME**. 0 requête externe. Les polices Manrope/Newsreader, icônes Material Symbols, images WebP/JPG et scripts sont servis exclusivement en local (`http://localhost:4200`).

### D. Fuite de tokens dans l'historique ou URLs (CWE-598)
- **Scénario :** Suivi de la redirection `/connexion` -> `/tableau-de-bord` après authentification réussie.
- **Résultat :** **CONFORME**. Les tokens et identifiants ne transitent ni dans l'URL ni dans les query params.

### E. Masquage des données sensibles (CWE-312)
- **Scénario :** Le champ du mot de passe doit être masqué par défaut (`type="password"`), avec commande explicite de révélation temporaire par l'utilisateur.
- **Résultat :** **CONFORME**. Attribut initial `type="password"`. Le toggle inverse explicitement l'état visuel sans exposer le mot de passe dans le code HTML statique.

---

## 3. Matrice de Résultats des Tests de Sécurité

| ID | Test | Résultat |
|---|---|---|
| SEC-AUTH-01 | Absence de requêtes externes ou CDN | **SUCCÈS (0 appel)** |
| SEC-AUTH-02 | Masquage du mot de passe par défaut | **SUCCÈS (type=password)** |
| SEC-AUTH-03 | Protection anti-XSS sur formulaires | **SUCCÈS (neutralisé)** |
| SEC-AUTH-04 | Absence de fuite de tokens dans l'URL | **SUCCÈS (URL saine)** |
| SEC-AUTH-05 | Champs vides par défaut | **SUCCÈS (inputs vides)** |
| SEC-AUTH-06 | Profils démo masqués hors build dev | **SUCCÈS (isDevMode)** |

## 4. Conclusion
La porte de sécurité frontale pour la page `/connexion` est **validée à 100 %**.
