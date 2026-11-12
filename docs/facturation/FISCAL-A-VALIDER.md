# Points Fiscaux & Légaux à Faire Valider par un Expert-Comptable

> **Avertissement important :** Ce logiciel met en forme et calcule des factures selon les paramètres saisis par l'établissement. **Aucune certification ni conformité automatique à la réglementation fiscale sénégalaise (Code Général des Impôts — DGID) n'est revendiquée par le présent logiciel.** Toutes les mentions ci-dessous doivent être validées par le cabinet comptable de l'hôtel **Résidence Blue** avant mise en exploitation fiscale officielle.

## Liste de contrôle à soumettre au comptable

1. **Mentions légales d'identification sur la facture PDF A4 :**
   - Raison sociale exacte (`legalName`) et forme juridique (ex. S.A.R.L., S.A., EI)
   - Adresse complète de l'établissement et téléphone (`fullAddress`, `supportPhone`)
   - Numéro d'Identification Nationale des Entreprises et Associations (**NINEA**)
   - Numéro au Registre du Commerce et du Crédit Mobilier (**RCCM**)
   - Régime fiscal applicable (réel normal, réel simplifié, CGU / contribution globale unique) et mention éventuelle d'assujettissement ou d'exonération de TVA.

2. **Taux et assiettes paramétrables dans les Paramètres :**
   - **Taux de TVA hôtelière & restauration** (`vatRatePercent`) : vérifier si l'ensemble des prestations (hébergement, restauration, boissons alcoolisées ou non, blanchisserie, accès piscine) relèvent d'un taux réduit (ex. 10 %) ou du taux normal (18 %) selon l'article applicable du CGI.
   - **Frais de service** (`serviceRatePercent`) : vérifier leur traitement fiscal (inclusion ou exclusion de l'assiette TVA et ventilation comptable SYSCOHADA).
   - **Taxe de séjour / promotion touristique** (`tourismTaxPerNightPerPerson`) : vérifier le barème exact en vigueur au Sénégal par personne et par nuitée, ainsi que son exonération ou non de TVA.

3. **Numérotation & Inaltérabilité des pièces :**
   - Série chronologique continue sans rupture (`FA-AAAA-NNNN` pour les factures, `AV-AAAA-NNNN` pour les avoirs).
   - Règle d'archivage et durée légale de conservation des pièces justificatives (10 ans au Sénégal / OHADA).
   - Validité du modèle d'avoir négatif lié à la facture d'origine en cas d'annulation partielle ou totale.

4. **Montant en lettres & Moyens d'encaissement :**
   - Validation du libellé du montant total TTC arrêté en lettres en français (ex. « Arrêtée la présente facture à la somme de … francs CFA »).
   - Traçabilité des encaissements Mobile Money (Wave, Orange Money), espèces (plafonds réglementaires de paiement en espèces), cartes bancaires et virements pour le rapprochement comptable (Z de caisse / SYSCOHADA).
