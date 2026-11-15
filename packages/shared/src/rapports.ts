export type RapportsPeriodKey = '30j' | '3m' | '12m' | 'mois';

export interface RapportsValueDelta {
  amountFcfa: number;
  deltaPercent?: number;
}

export interface RapportsShareTile {
  amountFcfa: number;
  sharePercent: number;
}

export interface RapportsOccupancyTile {
  averagePercent: number;
  occupiedRoomNights: number;
  capacityRoomNights: number;
  deltaPercent?: number;
}

export interface RapportsSummaryTiles {
  revenue?: RapportsValueDelta;
  accommodation?: RapportsShareTile;
  restaurant?: RapportsShareTile;
  occupancy?: RapportsOccupancyTile;
  collected?: RapportsValueDelta;
  remaining?: { amountFcfa: number };
}

export interface RapportsEvolutionPoint {
  key: string;
  label: string;
  amountFcfa: number;
}

export interface RapportsEvolutionMilestone {
  key: string;
  label: string;
  amountFcfa: number;
  rank?: 1 | 2 | 3;
}

export interface RapportsRevenueEvolution {
  granularity: 'day' | 'week' | 'month';
  points: RapportsEvolutionPoint[];
  previousPoints?: RapportsEvolutionPoint[];
  topPoints: RapportsEvolutionMilestone[];
  lowestPoint: RapportsEvolutionMilestone;
  bestPoint: RapportsEvolutionMilestone;
}

export interface RapportsEvolutionDetailedPoint {
  key: string;
  label: string;
  fullDateLabel: string;
  amountFcfa: number;
  accommodationFcfa: number;
  restaurantFcfa: number;
  otherFcfa: number;
  trendFcfa: number;
}

export interface RapportsEvolutionChangeMarker {
  fromKey: string;
  toKey: string;
  fromLabel: string;
  toLabel: string;
  deltaFcfa: number;
}

export type RapportsEvolutionInsightType =
  | 'total'
  | 'best_worst'
  | 'trend'
  | 'biggest_moves'
  | 'habit'
  | 'alert';

export interface RapportsEvolutionInsight {
  type: RapportsEvolutionInsightType;
  text: string;
  direction?: 'up' | 'down' | 'flat';
  isAlert?: boolean;
}

export interface RapportsEvolutionSection {
  granularity: 'day' | 'week' | 'month';
  trendLabel: string;
  totalFcfa: number;
  averageFcfa: number;
  previousTotalFcfa?: number;
  deltaPercent?: number;
  points: RapportsEvolutionDetailedPoint[];
  previousPoints?: RapportsEvolutionPoint[];
  topPoints: RapportsEvolutionMilestone[];
  lowestPoint: RapportsEvolutionMilestone;
  bestPoint: RapportsEvolutionMilestone;
  biggestIncrease?: RapportsEvolutionChangeMarker;
  biggestDecrease?: RapportsEvolutionChangeMarker;
  insights: RapportsEvolutionInsight[];
}

export interface RapportsSalesByTypeWeek {
  weekKey: string;
  label: string;
  accommodationFcfa: number;
  restaurantFcfa: number;
  otherFcfa: number;
  totalFcfa: number;
}

export interface RapportsOccupancyDayPoint {
  dateIso: string;
  label: string;
  occupiedRooms: number;
  activeRooms: number;
  percent: number;
}

export interface RapportsOccupancyByDay {
  averageRooms: number;
  averagePercent: number;
  activeRoomsCount: number;
  points: RapportsOccupancyDayPoint[];
}

export interface RapportsPaymentMethodItem {
  method: string;
  label: string;
  amountFcfa: number;
  percent: number;
}

export interface RapportsPaymentsByMethod {
  totalFcfa: number;
  items: RapportsPaymentMethodItem[];
}

export interface RapportsReservationSourceItem {
  source: string;
  label: string;
  count: number;
  percent: number;
}

export interface RapportsReservationSources {
  totalCount: number;
  items: RapportsReservationSourceItem[];
}

export interface RapportsRoomCategoryItem {
  category: string;
  amountFcfa: number;
  sharePercent: number;
  nightsCount: number;
}

export interface RapportsSalesByRoomCategory {
  totalFcfa: number;
  items: RapportsRoomCategoryItem[];
}

export interface RapportsWeekdayAverageItem {
  weekdayIndex: number; // 0 = Lundi .. 6 = Dimanche
  label: string;
  averageFcfa: number;
  totalFcfa: number;
  daysCount: number;
}

export interface RapportsTopDishItem {
  name: string;
  quantity: number;
  amountFcfa: number;
}

export interface RapportsDailyRow {
  dateIso: string;
  label: string;
  occupiedRooms: number;
  activeRooms: number;
  accommodationFcfa: number;
  restaurantFcfa: number;
  otherFcfa: number;
  totalFcfa: number;
}

export interface RapportsDailyTable {
  activeRoomsCount: number;
  rows: RapportsDailyRow[];
  totals: {
    occupiedRoomNights: number;
    capacityRoomNights: number;
    accommodationFcfa: number;
    restaurantFcfa: number;
    otherFcfa: number;
    totalFcfa: number;
  };
}

export interface RapportsResponse {
  period: RapportsPeriodKey;
  periodLabel: string;
  startDateIso: string;
  endDateIso: string;
  timezone: 'Africa/Dakar';
  generatedAt: string;
  hotelName: string;
  activeRoomsCount: number;
  hasData: boolean;
  previousPeriodHasData: boolean;
  tiles?: RapportsSummaryTiles;
  revenueEvolution?: RapportsRevenueEvolution;
  evolution?: RapportsEvolutionSection;
  salesByTypeByWeek?: RapportsSalesByTypeWeek[];
  occupancyByDay?: RapportsOccupancyByDay;
  paymentsByMethod?: RapportsPaymentsByMethod;
  reservationSources?: RapportsReservationSources;
  salesByRoomCategory?: RapportsSalesByRoomCategory;
  weekdayAverages?: RapportsWeekdayAverageItem[];
  topDishes?: RapportsTopDishItem[];
  dailyTable?: RapportsDailyTable;
}
