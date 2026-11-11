# Porte de Sécurité — Chambres : Suppression et Remplacement d'Image

## 1. Périmètre audité
- `POST /api/rooms` : Création d'une chambre avec téléversement optionnel d'image (`multipart/form-data`).
- `PATCH /api/rooms/:id` et `PUT /api/rooms/:id` : Modification d'une chambre, remplacement d'image avec génération d'un identifiant unique UUIDv4, ou retrait de la photo (`removeImage: true`).
- `DELETE /api/rooms/:id/image` : Suppression dédiée de la photo d'une chambre.
- `DELETE /api/rooms/:id` : Suppression définitive atomique d'une chambre sans historique.
- `GET /api/rooms/images/:filename` : Diffusion sécurisée des photos de chambres stockées sur disque.

## 2. Contrôles de sécurité mis en place

### 2.1 Contrôle d'accès par rôle (RBAC — Deny by default)
- Toutes les routes d'écriture (`POST`, `PATCH`, `PUT`, `DELETE`) exigent le rôle `Role.DIRECTION` via `@Roles(Role.DIRECTION)` et `RolesGuard`.
- Un utilisateur avec le rôle `RECEPTION`, `SERVEUR` ou `CUISINE` reçoit systématiquement `403 Forbidden` côté serveur, et les boutons correspondants sont masqués côté client.

### 2.2 Sécurité des fichiers téléversés (Upload d'images)
- **Limite de taille stricte** : `2 Mo` maximum (`MAX_ROOM_IMAGE_SIZE_BYTES = 2 * 1024 * 1024`), vérifiée par Multer et par l'utilitaire `saveRoomImageFile`.
- **Validation MIME et Magic Bytes** : Vérification de la signature binaire réelle du fichier (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF....WEBP`). Tout fichier exécutable, script ou SVG déguisé est rejeté avec `400 Bad Request`.
- **Nommage imprévisible et anti-collision / anti-cache** : Chaque image enregistrée reçoit un nom généré par `randomUUID()` (`<uuid>.jpg|png|webp`), jamais le numéro de chambre ni le nom d'origine fourni par le client.
- **Protection contre la traversée de répertoire (Path Traversal)** : La route `GET /api/rooms/images/:filename` valide le paramètre avec l'expression régulière stricte `/^[a-zA-Z0-9_-]+\.(jpg|png|webp)$/i` et vérifie que le chemin résolu reste confiné dans `uploads/rooms`.
- **Nettoyage atomique des fichiers orphelins** : Si la mise à jour Prisma échoue après l'écriture du nouveau fichier sur disque, le nouveau fichier est immédiatement supprimé dans le bloc `catch`. Si la mise à jour réussit, l'ancien fichier est supprimé du disque sans erreur s'il est déjà absent.

### 2.3 Intégrité référentielle et Journal d'audit (`AuditLog`) à la suppression
- **Protection de l'historique** : Avant toute suppression, le serveur compte les réservations (`Reservation`), factures (`Invoice`) et commandes (`Order`) rattachées à la chambre ou aux réservations de la chambre. Si le total est supérieur à zéro, l'API renvoie `409 Conflict` avec le décompte précis et propose la désactivation (`isActive = false`).
- **Transaction atomique Prisma** : La suppression de la chambre et l'écriture de l'entrée `AuditLog` (`action: 'ROOM_DELETE'`, contenant l'état complet de la chambre avant suppression dans `details`) sont exécutées dans une même transaction `prisma.$transaction`.

## 3. Résultats des tests de sécurité et d'intégration
- Suite `apps/api/test/rooms.e2e-spec.ts` :
  - Rejet `403 Forbidden` pour un profil `RECEPTION` tentant de supprimer une chambre.
  - Rejet `400 Bad Request` pour un fichier image invalide (faux binaire).
  - Rejet `409 Conflict` lors d'une tentative de suppression d'une chambre ayant une réservation ou une facture.
  - Suppression `200 OK` pour une chambre vierge, suppression du fichier sur disque et création de la trace `AuditLog` (`ROOM_DELETE`).
