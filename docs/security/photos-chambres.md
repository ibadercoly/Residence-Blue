# Porte de Sécurité : Photos des Chambres (`feature/photos-chambres`)

## 1. Périmètre audité
Ce document consigne les tests offensifs, les vecteurs d'attaque et les contrôles de sécurité exécutés sur l'intégration des photographies des 12 chambres de **Résidence Blue** (Grand Standing, Thiès) :
- **Origine & Droits des Médias** : Audit des sources et licences (Unsplash, Pexels, Pixabay), vérification stricte de l'absence de droits restrictifs, et traçabilité exhaustive dans `docs/design/CREDITS-IMAGES.md`.
- **Script de Téléchargement Sécurisé (`scripts/telecharger-photos.mjs`)** :
  - Filtrage des protocoles (HTTPS strict, rejet HTTP, FTP, file, javascript).
  - Whitelist de noms de domaine (`unsplash.com`, `images.unsplash.com`, `pexels.com`, `images.pexels.com`, `pixabay.com`, `cdn.pixabay.com`).
  - Contrôle du Content-Type (MIME `image/jpeg`, `image/png`, `image/webp`).
  - Vérification des signatures binaires (magic bytes JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`).
  - Plafond de taille à 8 Mo par téléchargement.
  - Détection anti-doublon cryptographique par empreinte SHA-256.
- **Pipeline d'Optimisation & Traitement Local (`scripts/optimiser-images.mjs`)** :
  - Découpage et compression adaptative avec `sharp` : génération des déclinaisons WebP (400w, 800w, 1600w) et JPEG fallback.
  - Plafond strict à 250 Ko par fichier produit.
  - Suppression totale des métadonnées EXIF potentiellement indiscrètes ou injectées (géolocalisation GPS, commentaires, signatures d'appareils).
- **Protection Navigateur & Runtime Frontend (`apps/web`)** :
  - Politique de sécurité du contenu (CSP) interdisant tout appel d'image externe (`img-src 'self' data:`).
  - Composant sécurisé `<app-image>` gérant le repli propre (`chambre-fallback.webp`) sans exécution de script lors d'une erreur 404/erreur réseau.
  - Cache Service Worker (`ngsw-config.json`) assurant l'accès 100% hors ligne sans fuite réseau.

---

## 2. Attaques exécutées et résultats (Porte de Sécurité)

### Attaque 1 : Téléchargement depuis un domaine non autorisé ou spoofé
- **Vecteur testé** :
  1. Domaine externe non homologué : `https://evil-hacker.com/malware.png`, `https://google.com/image.jpg`.
  2. Subdomain spoofing : `https://images.unsplash.com.attacker.com/photo.jpg`.
  3. Protocole non chiffré ou arbitraire : `http://images.unsplash.com/...`, `file:///etc/passwd`, `ftp://images.unsplash.com/...`.
- **Preuve automatisée** : Suite `scripts/test-securite-photos.mjs` (section *Vérification du filtrage des domaines et URL suspectes*).
- **Contrôle appliqué** : Validation par analyse d'URL (`new URL(urlStr)`), vérification du protocole `https:` et correspondance exacte de suffixe de domaine sur la liste blanche `ALLOWED_DOMAINS`.
- **Résultat** : **BLOQUÉ**. 100% des URL suspectes ou non homologuées sont rejetées avec une exception immédiate.

### Attaque 2 : Payload polyglotte ou fichier malveillant déguisé en image
- **Vecteur testé** : Injection d'un fichier contenant du code HTML, JavaScript ou PHP déguisé sous une extension d'image (`.jpg`, `.webp`) contenant du code exécutable (`<script>alert("xss")</script>`, `<?php eval(...) ?>`).
- **Preuve automatisée** : Suite `scripts/test-securite-photos.mjs` (section *Détection de payload polyglotte HTML / script*).
- **Contrôle appliqué** :
  - Vérification des magic bytes d'en-tête (signature hexadécimale obligatoire correspondant à l'extension).
  - Analyse textuelle des 1024 premiers octets à la recherche de tokens d'injection (`<script`, `<?php`, `<!doctype`, etc.).
  - Re-compression via `sharp` qui ré-encode les matrices de pixels brutes et purge tout bloc binaire malveillant ou métadonnée cachée.
- **Résultat** : **BLOQUÉ**. Fichier malveillant intercepté et rejeté avant écriture.

### Attaque 3 : Déni de service par bombe de décompression ou fichier géant (> 8 Mo)
- **Vecteur testé** : Téléchargement d'un flux infini ou d'un fichier excédant 8 Mo pour saturer l'espace disque ou la mémoire du build.
- **Preuve automatisée** : Script `scripts/telecharger-photos.mjs` (vérification de `Content-Length` et vérification de la taille du buffer avant allocation).
- **Contrôle appliqué** : Rejet automatique dès l'en-tête HTTP si `content-length > 8 Mo`, et coupure de flux si la taille cumulée dépasse `MAX_FILE_SIZE`.
- **Résultat** : **BLOQUÉ**. Aucun fichier supérieur à 8 Mo n'est accepté.

### Attaque 4 : Fuite de données réseau et requêtes vers des serveurs tiers au runtime
- **Vecteur testé** : Appel accidentel ou malveillant vers un domaine tiers (`lh3.googleusercontent.com`, `unsplash.com`, CDN tiers) lors de la consultation des cartes de chambres ou du tableau de bord.
- **Preuve automatisée** : Test E2E Playwright `apps/web/e2e/photos-chambres.spec.ts` (section *Aucune requête vers un domaine externe*).
- **Contrôle appliqué** :
  - Remplacement de toutes les URL distantes par des chemins relatifs locaux (`/assets/images/chambres/...`).
  - Entête CSP strict `img-src 'self' data:`.
  - Écoute active de l'ensemble des requêtes réseau lors du test Playwright.
- **Résultat** : **BLOQUÉ**. 0 requête externe émise (`externalRequests = []`).

### Attaque 5 : Altération ou empoisonnement du cache Service Worker hors ligne
- **Vecteur testé** : Mode avion simulé avec tentative d'affichage d'images cassées ou injection d'URL non mises en cache.
- **Preuve automatisée** : Test E2E Playwright `apps/web/e2e/photos-chambres.spec.ts` (section *Mode hors ligne : les images s'affichent sans réseau*).
- **Contrôle appliqué** : Déclaration explicite du groupe d'actifs `room-photos` en mode `installMode: "prefetch"` dans `ngsw-config.json` et gestionnaire d'erreur `(error)` dans `app-image` basculant vers `chambre-fallback.webp`.
- **Résultat** : **CONFORME**. Les 12 chambres affichent leurs photos locales même lorsque le réseau est coupé.

---

## 3. Conformité & Synthèse des Métriques

| Critère de sécurité | Exigence | Statut |
|---|---|---|
| Domaines autorisés | Unsplash, Pexels, Pixabay uniquement | **CONFORME** |
| Droits d'utilisation | Commercial gratuit, libre de droits | **CONFORME** |
| Protocole de téléchargement | HTTPS strict | **CONFORME** |
| Contrôle magic bytes | JPEG (`FF D8 FF`), WebP (`RIFF...WEBP`), PNG | **CONFORME** |
| Anti-polyglotte | Absence totale de code exécutable | **CONFORME** |
| Poids unitaire en production | < 250 Ko par image générée | **CONFORME** (max 225.7 Ko) |
| Poids total du dossier `images/` | < 30 Mo | **CONFORME** (9.1 Mo) |
| Fuite réseau runtime | 0 domaine externe appelé | **CONFORME** |
| Sécurité hors ligne | Précachage Service Worker local | **CONFORME** |
