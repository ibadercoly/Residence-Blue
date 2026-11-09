# Porte de Sécurité — Fiche Profil Client

> **Fonctionnalité :** Consultation et gestion du profil voyageur (`/clients/:id`)  
> **Composants :** `ClientProfilePageComponent`, `GuestProfileService`  
> **Déclencheurs :** Navigation `/clients`, sélection d'un client dans le cardex ou tape chart  
> **Référence maquette :** `design/maquettes/fiche_profil_client_m._mamadou_diop/code.html`  
> **Date de l'audit :** 09 Novembre 2026  
> **Statut global :** **CONFORME & VALIDÉ (100% SUCCÈS)**  

---

## 1. Contexte & Périmètre de Sécurité

La fiche profil voyageur centralise les informations d'un client de la Résidence Blue :
- Données d'identité et de contact (nom, prénom, nationalité, téléphone, email, affiliation professionnelle, ville de résidence).
- **Données d'identification hautement sensibles (PII) :** Numéro de passeport / pièce d'identité et date d'expiration.
- Métriques financières et fidélité (historique des dépenses cumulées en FCFA, équivalent en EUR calculé selon le taux fixe officiel, ratios d'hébergement vs restauration & bar, historique des séjours et folios de facturation).
- Consignes et notes internes de l'équipe (habitudes matinales, régimes, consignes de sécurité et conciergerie).

Dans le respect des règles du projet (`AGENTS.md`) et de la réglementation sur la protection des données personnelles (CDP Sénégal / RGPD), la gestion des pièces d'identité et des notes internes impose un niveau de sécurité rigoureux.

---

## 2. Vecteurs d'Attaque Testés & Résultats

| Catégorie CWE / OWASP | Scénario d'attaque testé | Comportement attendu | Résultat obtenu |
| :--- | :--- | :--- | :--- |
| **CWE-359 : Exposition de données personnelles (PII)** | Accès à la fiche par défaut ou tentative de lecture non autorisée du passeport. | Le numéro de passeport est masqué par défaut (`SN••••••1-B`). Le bouton « Afficher » ne révèle le numéro en clair qu'aux rôles autorisés (`DIRECTRICE`, `RECEPTIONNISTE`). Pour les autres rôles, un refus avec notification s'affiche et le numéro reste masqué. | **RÉUSSI** (Validé par tests unitaires et `client-profile-security.spec.ts`) |
| **CWE-79 : Cross-Site Scripting (XSS)** | Injection de charges malveillantes (`<script>`, `<img onerror=...>`, injection de balises HTML) dans le formulaire d'ajout de note ou consigne conciergerie. | Échappement et neutralisation native Angular. Le texte est inséré comme chaîne brute dans le modèle sans interprétation HTML ni exécution JavaScript. | **RÉUSSI** (Validé par `client-profile-security.spec.ts`) |
| **CWE-319 : Zéro fuite réseau & CDN distants** | Contrôle des requêtes HTTP réseau lors de la consultation de la fiche client, du basculement des 4 onglets et du chargement des images (avatar, photo chambre favorite). | Zéro requête externe vers des CDN (Google Fonts, Unsplash, etc.). 100 % des assets sont locaux (`/assets/images/clients/`). | **RÉUSSI** (Validé par `client-profile-security.spec.ts`) |
| **Règle Monétaire AGENTS.md : Intégrité financière** | Injection ou calcul de montants avec des décimales en FCFA dans le récapitulatif des séjours, panier moyen ou solde des folios. | Tous les montants FCFA sont rigoureusement des entiers, formatés avec espaces insécables (`formatFcfa`). Aucun montant décimal n'apparaît. | **RÉUSSI** (Validé par tests unitaires et `client-profile-security.spec.ts`) |
| **Sécurité Hors-Ligne & Dépendances Réseau** | Clic sur les actions de messagerie (WhatsApp, SMS, Email) ou « Scan PDF ». | En l'absence de réseau ou de brique de transfert de fichiers sécurisée, les actions déclenchent une notification claire et prévisible (« TODO notifications, nécessitent internet », « TODO envoi sécurisé ») évitant tout blocage ou fuite non maîtrisée. | **RÉUSSI** (Validé par tests E2E) |
| **Sécurité d'Accès aux Modales** | Clic sur « Nouvelle réservation » depuis la fiche profil. | Ouverture sécurisée via `ModalShellComponent` respectant les dimensions compactes (`max-width: 960px`, `max-height: 88dvh`), focus trap et verrouillage du fond. | **RÉUSSI** (Validé par tests E2E) |

---

## 3. Matrice des Tests Automatisés

- **Tests unitaires :**
  - `apps/web/src/app/core/services/guest-profile.service.spec.ts` (4/4 PASS)
  - `apps/web/src/app/features/clients/client-profile-page.component.spec.ts` (10/10 PASS)
- **Tests E2E fonctionnels :**
  - `apps/web/e2e/client-profile.spec.ts` (7/7 PASS)
- **Tests E2E de sécurité :**
  - `apps/web/e2e/client-profile-security.spec.ts` (4/4 PASS)

---

## 4. Recommandations pour le Raccordement API & Chiffrement (Backend)

1. **Chiffrement au repos (AES-256-GCM) :** Conformément à `AGENTS.md`, le numéro de passeport et les pièces d'identité stockés en base PostgreSQL doivent être chiffrés avec `CryptoService` (`apps/api/src/common/security/crypto.service.ts`).
2. **Contrôle d'accès RBAC (NestJS Guards) :** Le endpoint API `GET /api/v1/guests/:id` ne doit renvoyer le champ `passportNumber` complet qu'aux utilisateurs disposant des rôles `ADMIN`, `DIRECTRICE` ou `RECEPTIONNISTE`. Pour les rôles `SERVEUR`, `HOUSEKEEPING`, `MAINTENANCE`, le champ doit être renvoyé masqué ou omis.
3. **Journalisation des accès aux pièces d'identité :** Toute action de démasquage ou de consultation de la pièce d'identité doit produire une entrée d'audit dans la table `audit_logs` (Date, Heure, UserId, GuestId, Action).
