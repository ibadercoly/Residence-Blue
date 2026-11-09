# Architecture Modulaire & Feuille de Route (Résidence Blue)

Ce document détaille le découpage modulaire du système Résidence Blue, la configuration des fonctionnalités actives en Version 1 Minimale et la feuille de route des évolutions futures (V2 et V3).

---

## 1. Principe Architectural & Feature Flags

Pour répondre aux exigences de simplicité, de rapidité absolue et de légèreté imposées par la direction de l'hôtel (12 chambres, restaurant La Teranga et piscine à Thiès Grand Standing), l'application est régie par un système de configuration déclaratif :
- **Fichier de configuration** : `config/modules.json`
- **Service Angular** : `apps/web/src/app/core/services/module-config.service.ts`
- **Découpage applicatif** : Lazy loading intégral par route (`loadComponent`). Les modules désactivés ne sont ni chargés en mémoire ni inclus dans le bundle initial.

### Matrice des Rôles V1
Le menu de navigation s'adapte dynamiquement et n'affiche que les écrans autorisés (maximum 7 entrées par rôle) :
1. **DIRECTION** : Accès complet à tous les modules, réinitialisation du mode démo, journal d'audit et export sécurisé du répertoire clients.
2. **RECEPTION** : Accueil, Planning, Chambres, Clients, Facturation, Exports de service (Arrivées/Départs, État chambres, Z de caisse).
3. **SERVEUR** : Restaurant (prise de commande, caisse de service, commande en chambre), Planning simplifié.
4. **CUISINE** : Écran Cuisine (`/cuisine`) pour la préparation des bons de commande en temps réel.

---

## 2. Modules Actifs en Version 1 Minimale (V1)

| Module | Route Web | Description & Capacités V1 | Rôles Habilités |
|---|---|---|---|
| **Accueil & Activité** | `/` | 4 chiffres clés (occupation, arrivées, départs, recette) et 5 boutons d'action rapide ergonomiques ($\ge 44$ px). Mode démo en 1 clic. | Tous |
| **Planning** | `/planning` | Calendrier visuel sur fenêtre glissante de 14 jours. Création et glisser-déposer de réservations. | DIRECTION, RECEPTION, SERVEUR |
| **Chambres** | `/chambres` | Grille des 12 chambres (Standard, Deluxe, Suite). Changement d'état (libre, occupée, ménage, maintenance) avec miniatures WebP légères (< 40 Ko). | DIRECTION, RECEPTION |
| **Clients** | `/clients`, `/clients/:id` | Répertoire clients, historique des séjours, préférences. Masquage des pièces d'identité avec déverrouillage sécurisé. | DIRECTION, RECEPTION |
| **Facturation & Folios** | `/facturation` | Folio client en direct, encaissements multiples (Espèces, Wave, Orange Money, CB), clôture Z de caisse journalière. | DIRECTION, RECEPTION |
| **Restaurant & Bar** | `/restaurant` | Prise de commandes sur place et en chambre, gestion du menu pour rôles autorisés, disponibilité en direct. | DIRECTION, RECEPTION, SERVEUR |
| **Écran Cuisine** | `/cuisine` | Affichage plein écran tactile des bons de commande pour les chefs et pâtissiers. | DIRECTION, CUISINE |
| **Piscine** | *Intégré Facturation / Restaurant* | Prestation facturable « Accès Piscine Journée » (`PASS-PISCINE` à 5 000 FCFA TTC). | DIRECTION, RECEPTION, SERVEUR |
| **Exports & Rapports** | `/exports` | Génération en streaming de 6 documents officiels certifiés (PDF et Excel) avec protection anti-injection et journal d'audit. | DIRECTION, RECEPTION |

---

## 3. Feuille de Route & Modules Différés

Les fonctionnalités complexes non nécessaires au démarrage de l'hôtel sont conservées dans le code source mais désactivées via les feature flags dans `config/modules.json` :

### Version 2 (V2 - Moyen Terme)
- **Module Stocks & Économat** : Suivi des ingrédients, bouteilles du bar, réapprovisionnement et alertes de seuil critique.
- **Passerelle Notifications** : Envoi de confirmations de réservation et factures par WhatsApp et SMS via passerelle locale ou API telecom.
- **Module Maintenance Préventive** : Fiches d'intervention détaillées pour la climatisation, la plomberie et l'entretien de la piscine.
- **Conciergerie & Transferts** : Gestion des navettes aéroport Blaise Diagne (AIBD) et excursions.

### Version 3 (V3 - Long Terme)
- **Channel Manager & Synchronisation OTA** : Synchronisation bidirectionnelle iCal / API avec Booking.com, Airbnb et Expedia.
- **Portail Réservation Directe Client** : Moteur de réservation responsive sur le site vitrine avec pré-paiement en ligne Wave / Orange Money.
- **Comptabilité Analytique SYSCOHADA** : Grand livre, écritures comptables automatisées conformes aux normes OHADA et export pour l'expert-comptable.
