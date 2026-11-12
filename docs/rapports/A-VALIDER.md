# Points comptables et gestion à valider — Écran Rapports (`/rapports`)

Document listant les choix de calcul appliqués par défaut dans le module Rapports, à soumettre au comptable de l'établissement pour validation :

1. **Date de rattachement des factures non encore soldées (ventes par nuit vs facturation globale)** :
   - Actuellement, une facture ou note de séjour est comptabilisée à sa date `issued_at` (date d'émission ou de création de la note).
   - À valider : faut-il répartir les lignes d'hébergement nuit par nuit sur la durée du séjour pour les séjours à cheval sur deux mois, ou conserver la date d'émission/clôture du folio ?
2. **Ventilation des remises et des avoirs entre catégories** :
   - Les remises globales sur facture et les avoirs rattachés à une facture parente sont actuellement répartis au prorata des montants de lignes (Hébergement / Restaurant et bar / Autres) pour garantir `Hébergement + Restaurant et bar + Autres = Chiffre d'affaires`.
   - À valider : convient-il d'imputer certaines remises ou avoirs sur un compte spécifique « Autres » ou par nature explicite sur l'avoir ?
3. **Regroupement des prestations annexes** :
   - Les lignes de catégories `PISCINE`, `BLANCHISSERIE` et `AUTRES` sont regroupées sous le libellé « Autres » (hors taxe de séjour `TAX`, déjà exclue du hors taxes).
   - À valider : la piscine doit-elle rester dans « Autres » ou figurer dans « Restaurant et bar » selon l'organisation analytique retenue ?
4. **Dénominateur du taux moyen de chambres occupées** :
   - Le calcul divise le nombre de nuitées occupées sur la période par `chambres actives actuelles × nombre de jours de la période`.
   - À valider : les chambres temporairement en maintenance ou désactivées sur une fraction de la période doivent-elles être historisées jour par jour ou comptées selon l'effectif actif courant ?
5. **Périmètre des factures ouvertes dans « Reste à encaisser »** :
   - L'indicateur additionne le solde restant (`balance_fcfa > 0`) des notes `OPEN` ou `PARTIAL` datées dans la période sélectionnée.
   - À valider : sur une vue mensuelle, le comptable souhaite-t-il uniquement le reste à encaisser de la période sélectionnée ou également le cumul des créances antérieures non soldées ?
6. **Règle d'arrondi hors taxes au FCFA entier** :
   - Le hors taxes est stocké sur chaque facture via `Math.round(net * 100 / (100 + tauxTVA))`. Lors de la ventilation par ligne ou par jour, les écarts d'arrondi de ±1 FCFA sont ajustés sur la dernière ligne/catégorie non nulle afin que les totaux restent strictement additifs.
