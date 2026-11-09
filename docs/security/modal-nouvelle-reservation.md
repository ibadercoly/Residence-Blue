# Porte de Sécurité — Modal Nouvelle Réservation

> **Fonctionnalité :** Modal de Création & Attribution d'une Nouvelle Réservation  
> **Composant :** `NewReservationModalComponent`  
> **Déclencheurs :** Bouton En-tête « + Nouvelle réservation » et case libre du Tape Chart  
> **Référence maquette :** `design/maquettes/modal_nouvelle_r_servation/code.html`  
> **Date de l'audit :** 09 Novembre 2026  
> **Statut global :** **CONFORME & VALIDÉ (100% SUCCÈS)**  

---

## 1. Contexte & Périmètre de Sécurité

Le modal de nouvelle réservation permet à la réception ou à la direction d'enregistrer un séjour, de sélectionner un client régulier ou d'en créer un nouveau, d'attribuer une clé parmi les 12 chambres de l'hôtel, de paramétrer les services conciergerie (navette AIBD, lit bébé) et d'enregistrer l'acompte (Wave, Orange Money, Carte TPE, Espèces) avec un calcul tarifaire instantané en FCFA.

Ce composant traite des flux financiers directs (acomptes, solde dû) et des données personnelles des voyageurs (nom, prénom, numéro de téléphone, email, ville d'origine, demandes particulières).

---

## 2. Vecteurs d'Attaque Testés & Résultats

| Catégorie CWE / OWASP | Scénario d'attaque testé | Comportement attendu | Résultat obtenu |
| :--- | :--- | :--- | :--- |
| **CWE-79 : Cross-Site Scripting (XSS)** | Injection de charges malveillantes (`<script>`, `<img src=x onerror=...>`, attributs d'événements) dans les champs nom, téléphone, email, et consignes spéciales. | Sanitization native Angular, aucun code JavaScript exécuté dans le contexte du DOM ou du toast. | **RÉUSSI** (Validé par `reservation-modal-security.spec.ts`) |
| **Règle Monétaire AGENTS.md : Intégrité financière** | Injection de montants d'acompte flottants, négatifs ou avec décimales (ex: `150000.50`, `,00 FCFA`). | Montants stockés et affichés en entiers FCFA stricts, calculs arrondis, devise FCFA respectée. | **RÉUSSI** (Validé par `ReservationModalService` et tests E2E) |
| **CWE-319 : Zéro fuite réseau & CDN distants** | Contrôle des requêtes sortantes lors de l'ouverture du modal, du changement de catégorie et de la sélection de photo de chambre. | Zéro requête vers des CDN externes (Unsplash, Google Fonts, CDN Tailwind). 100% des images sont locales (`/assets/images/chambres/`). | **RÉUSSI** (Validé par `reservation-modal-security.spec.ts`) |
| **CWE-20 : Validation des entrées** | Soumission du formulaire avec un nouveau client sans nom ou téléphone, ou valeurs erronées. | Bouton de confirmation désactivé (`disabled`) tant que le formulaire est incomplet ou invalide. | **RÉUSSI** (Validé par tests unitaires et E2E) |
| **Accessibilité & Ergonomie WCAG (Focus Trap)** | Piégeage du focus au clavier (Tabulation / Shift+Tab) et fermeture par touche `Échap`. | La navigation au clavier boucle à l'intérieur du modal sans fuite de focus dans le document d'arrière-plan. | **RÉUSSI** (Validé par `reservation-modal.spec.ts`) |

---

## 3. Matrice des Tests Automatisés

- **Tests unitaires :**
  - `apps/web/src/app/core/services/reservation-modal.service.spec.ts` (5/5 PASS)
  - `apps/web/src/app/shared/components/new-reservation-modal/new-reservation-modal.component.spec.ts` (7/7 PASS)
- **Tests E2E fonctionnels :**
  - `apps/web/e2e/reservation-modal.spec.ts` (6 tests PASS)
- **Tests E2E de sécurité :**
  - `apps/web/e2e/reservation-modal-security.spec.ts` (4 tests PASS)

---

## 4. Recommandations pour le Raccordement API (TODO Backend)

1. **Validation DTO stricte (NestJS) :** À la connexion au backend NestJS, le contrôleur des réservations devra appliquer `CreateReservationDto` avec `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`.
2. **Idempotence :** Générer un en-tête `Idempotency-Key: <UUID>` côté client à chaque validation pour garantir qu'un double-clic ou une reconnexion réseau ne duplique pas la réservation ni l'acompte.
3. **Paiements Mobiles (Wave / Orange Money) :** Les paiements d'acompte marqués « Perçu maintenant » doivent logger l'identifiant de transaction API opérateur dans le Folio client.
