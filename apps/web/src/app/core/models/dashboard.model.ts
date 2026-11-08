export interface DashboardData {
  user: {
    name: string;
    role: string;
  };
  hero: {
    seasonTag: string;
    weatherTag: string;
    title: string;
    subtitle: string;
    imageUrl: string;
  };
  kpis: {
    occupancyRate: {
      value: number;
      changeLabel: string;
      targetLabel: string;
      activeKeysLabel: string;
    };
    occupiedRooms: {
      occupied: number;
      total: number;
      availableBadge: string;
      detailLabel: string;
    };
    todayRevenue: {
      amount: number;
      currency: string;
      lodgingAmount: number;
      restaurantAmount: number;
    };
    keyMovements: {
      checkIns: number;
      checkOuts: number;
      label: string;
      detailLabel: string;
    };
  };
  weeklyRevenue: {
    weekLabel: string;
    title: string;
    totalEstimated: number;
    currency: string;
    averageRate: string;
    days: Array<{
      day: string;
      amountLabel: string;
      heightPercent: number;
      isToday?: boolean;
      isConfirmed?: boolean;
    }>;
  };
  arrivals: Array<{
    id: string;
    initials: string;
    name: string;
    badge: string;
    badgeIcon?: string;
    room: string;
    nights: string;
    arrivalTime: string;
    colorVariant: 'primary' | 'tertiary';
  }>;
  priorityAlerts: Array<{
    id: string;
    category: string;
    meta: string;
    title: string;
    description: string;
    buttonLabel: string;
    buttonIcon: string;
    variant: 'warning' | 'urgent' | 'info';
  }>;
  marineWeather: {
    title: string;
    locationBadge: string;
    tideTime: string;
    coefficient: string;
    waterTemp: string;
    wind: string;
    note: string;
  };
}
