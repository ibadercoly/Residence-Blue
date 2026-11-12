// apps/api/src/rapports/rapports.dto.ts
export interface RapportsDto {
  periode: string;
  // Sections are optional; present only if data exists
  chiffreAffaires?: number; // total sales (FCFA)
  hebergementPart?: number; // percentage of total
  restaurantBarPart?: number; // percentage of total
  chambresOccupees?: number; // percentage of rooms occupied
  argentEncaisse?: number; // cash received
  resteAEncaisser?: number; // remaining amount
  // Diagram data structures (simplified)
  evolutionChiffreAffaires?: { date: string; montant: number }[];
  ventesParType?: { type: string; montant: number }[];
  chambresOccupeesParJour?: { date: string; occupees: number; total: number }[];
  argentParModePaiement?: { mode: string; montant: number }[];
  sourcesReservations?: { source: string; count: number }[];
  ventesParCategorieChambre?: { categorie: string; montant: number }[];
  ventesParJourSemaine?: { jour: string; montant: number }[];
  top10Plats?: { plat: string; quantite: number; montant: number }[];
  tableauJourParJour?: {
    date: string;
    chambresOccupees: string; // e.g. "7 sur 12"
    hebergement: number;
    restaurantBar: number;
    autres: number;
    total: number;
  }[];
}
