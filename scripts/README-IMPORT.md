# Importer vos fichiers Excel — Résidence Blue

Ce guide explique comment importer les clients et les réservations à venir depuis vos fichiers Excel (`.xlsx`), sans saisie manuelle.

---

## 1. Format du fichier Excel **Clients**

La première ligne doit contenir les titres de colonnes suivants (une fiche par ligne) :

| Nom | Prénom | Téléphone | Email | Type de pièce | Numéro de pièce | Nationalité |
|---|---|---|---|---|---|---|
| Ndiaye | Aminata | +221 77 123 45 67 | aminata.ndiaye@exemple.sn | CNI | 1234567890123 | Sénégalaise |
| Diallo | Moussa | +221 76 987 65 43 | | Passeport | SN-998877 | Sénégalaise |

- **Obligatoires** : `Nom`, `Prénom`, `Téléphone`.
- **Optionnels** : `Email`, `Type de pièce`, `Numéro de pièce`, `Nationalité` (par défaut : `Sénégalaise`).
- **Sécurité** : le `Numéro de pièce` est chiffré automatiquement avant d'être enregistré en base (jamais stocké en clair).
- **Doublons** : si un numéro de téléphone existe déjà, la ligne est signalée en avertissement et ignorée (aucun doublon créé).

---

## 2. Format du fichier Excel **Réservations**

La première ligne doit contenir les titres de colonnes suivants (une réservation par ligne) :

| Téléphone client | Numéro de chambre | Date d'arrivée | Date de départ | Adultes | Enfants |
|---|---|---|---|---|---|
| +221 77 123 45 67 | 101 | 15/12/2026 | 18/12/2026 | 2 | 0 |
| +221 76 987 65 43 | 202 | 20/12/2026 | 23/12/2026 | 1 | 1 |

- **Dates** : format français strict `JJ/MM/AAAA` (exemple : `15/12/2026`). La date de départ doit être après la date d'arrivée.
- **Téléphone client** : doit correspondre à un client déjà présent en base ou présent dans le fichier `--clients`.
- **Numéro de chambre** : doit correspondre à une chambre active de l'hôtel (ex. `101`, `202`, `301`).
- **Chevauchements** : la base de données refuse automatiquement deux réservations sur la même chambre aux mêmes dates.

---

## 3. Comment lancer l'importation

### Étape 1 — Tester sans rien modifier (`--dry-run`, mode par défaut)

```sh
node --env-file=.env ./node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.json scripts/importer-excel.ts \
  --clients=./clients.xlsx \
  --reservations=./reservations.xlsx \
  --dry-run
```

- Lit les deux fichiers, vérifie toutes les colonnes, dates, doublons et chevauchements.
- **N'écrit rien en base de données.**
- Corrigez les éventuelles erreurs signalées dans votre fichier Excel avant de passer à l'étape 2.

### Étape 2 — Importer réellement (`--apply`)

1. Faire d'abord une sauvegarde : `sh scripts/backup.sh`
2. Lancer l'importation réelle :

```sh
node --env-file=.env ./node_modules/ts-node/dist/bin.js --project apps/api/tsconfig.json scripts/importer-excel.ts \
  --clients=./clients.xlsx \
  --reservations=./reservations.xlsx \
  --apply
```

- **Tout ou rien** : si une seule ligne échoue, toute l'importation est annulée automatiquement (aucune donnée partielle).
- **Rejouable sans risque** : relancer `--apply` avec les mêmes fichiers ne crée aucun doublon.
- **Traçabilité** : chaque client et chaque réservation importés sont enregistrés dans le journal d'audit (`AuditLog`).
