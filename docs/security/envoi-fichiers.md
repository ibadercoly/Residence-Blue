# Règles de Sécurité : Téléversement et Traitement des Fichiers (Images & Médias)

## Contexte & Enjeux
La Résidence Blue permet aux utilisateurs autorisés (rôles `DIRECTION` et `RESTAURANT`) d'importer des photos pour illustrer les plats du menu, ainsi que des photos des chambres. Le téléversement de fichiers non sécurisé constitue un des vecteurs d'attaque les plus critiques dans les applications web (exécution de code à distance, bombes de décompression / pixel flood, falsification d'extension, vol de données sensibles EXIF/GPS, serveurs relais d'infections).

Ce document spécifie l'ensemble des règles de sécurité obligatoires appliquées côté client et à implémenter côté serveur (`apps/api`).

---

## 1. Principes Fondamentaux de Traitement Côté Serveur

### 1.1. Vérification par Signature Réelle (Magic Bytes)
- **Règle absolue :** Ne JAMAIS faire confiance au nom de fichier (`filename`), à son extension (`.jpg`), ni à l'en-tête HTTP `Content-Type` envoyé par le client (`multipart/form-data`).
- **Implémentation serveur :**
  - Lecture des premiers octets du flux binaire (magic bytes) dès la réception des paquets.
  - Signatures binaires autorisées exclusivement :
    - **JPEG / JPG** : `FF D8 FF`
    - **PNG** : `89 50 4E 47 0D 0A 1A 0A`
    - **WebP** : `52 49 46 46` (RIFF) ... `57 45 42 50` (WEBP)
  - Tout fichier présentant une signature inconnue ou interdite est rejeté immédiatement avec un code HTTP `415 Unsupported Media Type`.
  - Rejet formel et systématique des fichiers :
    - `SVG` (vecteurs XML permettant l'exécution de scripts JavaScript malveillants XSS / SSRF / XXE)
    - `GIF` et `GIF animés` (vecteurs d'attaque DOS et dépassement de mémoire)
    - `PDF` (injections de formulaires / flux exécutables)
    - `HEIC / TIFF` non transcodés
    - Tout binaire exécutable (`.exe`, `.sh`, `.php`, `.jsp`, etc.).

### 1.2. Re-transcodage Intégral avec Sharp (Aucun Fichier Original Conservé)
- **Règle absolue :** Le fichier brut envoyé par l'utilisateur ne doit JAMAIS être enregistré directement sur le disque ni servi tel quel.
- **Traitement serveur obligatoire :**
  - Le flux reçu est décodé et transcodé immédiatement en mémoire à l'aide de la bibliothèque native `sharp`.
  - Sortie forcée au format WebP optimisé ou JPEG purifié.
  - La recompression détruit de fait toute charge malveillante (stéganographie malveillante, polyglottes PHP/JPEG, métadonnées piégées, scripts intégrés dans les blocs de commentaires).
  - Élimination garantie de l'ensemble des métadonnées EXIF (coordonnées GPS de l'appareil, numéro de série de l'appareil photo, horodatage d'origine).

### 1.3. Limites de Taille et Dimensions (Protection contre les Bombes d'Images)
- **Taille maximale du fichier :** Strictement plafonnée à **8 Mo** (`8 * 1024 * 1024` octets). Le serveur rejette le transfert dès dépassement via `Content-Length` et limite de flux de streaming (`Busboy` / `multer`).
- **Dimensions maximales :** **6 000 × 6 000 pixels**.
  - **Protection contre les « Decompression Bombs » (Pixel Floods) :** Une image PNG ou JPEG minuscule (quelques kilo-octets) peut déclarer des dimensions gigantesques (ex. 100 000 × 100 000 px) et saturer la mémoire vive (RAM) du serveur lors de la décompression, provoquant un arrêt brutal (Denial of Service).
  - `sharp` doit être configuré avec `limitInputPixels: 36_000_000` (6000 × 6000) pour interrompre le décodage avant allocation mémoire excessive.

### 1.4. Nommage Cryptographique Aléatoire (UUIDv4)
- **Règle absolue :** Ne JAMAIS utiliser le nom d'origine fourni par l'utilisateur (ex. `photo.jpg` ou `../../etc/passwd`).
- **Nommage :** Génération systématique d'un identifiant unique de type UUID version 4 :
  ```typescript
  const safeFilename = `${crypto.randomUUID()}.webp`;
  ```
- Empêche toute attaque par traversée de répertoire (*Path Traversal* / `../`), écrasement accidentel ou ciblé d'autres fichiers, et injection de caractères réservés dans le système de fichiers.

### 1.5. Stockage Hors du Répertoire Public Web
- Les fichiers traités sont enregistrés dans un répertoire privé hors de la racine publique des serveurs web (ex. `/var/data/residence-blue/media/dishes/`).
- Aucun interpréteur de scripts (Node.js, PHP, Nginx FastCGI) n'a de droit d'exécution sur ce dossier (`noexec`).
- Les fichiers ne sont jamais servis directement par le serveur de fichiers statiques sans contrôle applicatif préalable.

### 1.6. Distribution via Point d'Accès Contrôlé (En-têtes HTTP de Sécurité)
- L'accès aux images se fait au travers d'une route API contrôlée (ou d'un stockage objet type S3 avec URL pré-signées éphémères).
- **En-têtes HTTP obligatoires lors de la délivrance d'un fichier :**
  ```http
  X-Content-Type-Options: nosniff
  Content-Type: image/webp
  Content-Disposition: inline; filename="image.webp"
  Cache-Control: public, max-age=31536000, immutable
  Content-Security-Policy: default-src 'none'
  ```
- `X-Content-Type-Options: nosniff` neutralise les attaques de type *MIME confusion* où un navigateur essaierait d'interpréter une image comme du HTML ou du JavaScript.

### 1.7. Contrôle d'Accès Basé sur les Rôles (RBAC)
- Seuls les utilisateurs authentifiés possédant les rôles suivants peuvent téléverser ou supprimer une photo de plat :
  - **`DIRECTION`** : Accès complet.
  - **`RESTAURANT`** : Accès complet au catalogue restaurant.
- Tous les autres rôles (`RECEPTION`, `HOUSEKEEPING`, `MAINTENANCE`, non-authentifiés) sont bloqués avec une réponse HTTP `403 Forbidden`.

### 1.8. Analyse Antivirus en Continu (ClamAV / Streaming Scan)
- En environnement de production, les fichiers entrants transitent par un démon antivirus (ex. ClamAV en flux TCP `clamd` ou conteneur d'analyse).
- En cas de signature suspecte détectée, le fichier temporaire est immédiatement purgé et un événement de sécurité est journalisé dans l'audit trail.

### 1.9. Nettoyage Automatique des Fichiers Orphelins (Garbage Collector)
- Lorsqu'un plat ou une chambre voit sa photo remplacée ou supprimée, l'ancien fichier média n'est plus référencé en base de données.
- Un traitement planifié de maintenance (*cron job*) identifie les fichiers du stockage média qui ne correspondent à aucun enregistrement actif en base de données PostgreSQL depuis plus de 24 heures et procède à leur suppression définitive.

---

## 2. Traitement Client (Frontend Angular / Offline-First)

Pour garantir une expérience utilisateur fluide sans connexion internet (Grand Standing, Thiès) :
1. **Validation locale immédiate :**
   - Contrôle de la taille ($\le 8$ Mo).
   - Contrôle des magic bytes dans le navigateur via `FileReader` et `Uint8Array`.
   - Rejet instantané avec message en français clair si l'utilisateur glisse un fichier PDF, SVG ou texte.
2. **Pré-traitement dans le navigateur :**
   - Redimensionnement et ré-encodage via `HTMLCanvasElement.toBlob('image/webp', 0.85)` à une résolution maximale de 1600 px (versions miniatures 400 et 800 px).
   - Cette étape supprime déjà les métadonnées EXIF côté client avant même la transmission réseau.
3. **Persistance locale & Synchronisation hors ligne :**
   - Stockage du Blob optimisé dans la base IndexedDB locale (`idb-photos`).
   - Ajout d'une tâche dans la file d'attente d'envoi (`outbox`) associée à une clé d'idempotence unique (`Idempotency-Key: UUIDv4`).
   - Dès rétablissement de la connectivité réseau, la photo est transmise au serveur de façon idempotente et sans blocage pour le serveur de salle.
