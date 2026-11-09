export interface GuestStay {
  id: string;
  order: number;
  periodTitle: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  statusBadge: string;
  roomNumber: string;
  roomName: string;
  reference: string;
  datesLabel: string;
  nights: number;
  adults: number;
  extrasSummary: string;
  totalFcfa: number;
  remainingFcfa: number;
  paymentInfo: string;
  isCurrent?: boolean;
}

export interface GuestPreferenceItem {
  id: string;
  category: string;
  icon: string;
  title: string;
  description: string;
}

export interface GuestFolioSummary {
  id: string;
  reference: string;
  stayDate: string;
  roomLabel: string;
  totalAmountFcfa: number;
  paidAmountFcfa: number;
  balanceFcfa: number;
  paymentMethod: string;
  status: 'PAID' | 'PARTIAL' | 'PENDING';
}

export interface GuestNoteItem {
  id: string;
  authorName: string;
  department: string;
  timeAgo: string;
  content: string;
}

export interface GuestProfile {
  id: string;
  civility: string;
  firstName: string;
  lastName: string;
  fullName: string;
  vipTier: string;
  avatarUrl: string;
  loyaltyStayCount: number;
  totalNights: number;
  totalSpentFcfa: number;
  averageBasketFcfa: number;
  averageStayNights: number;
  memberSinceDate: string;
  memberSinceDuration: string;
  lodgingRatioPercent: number;
  fbRatioPercent: number;
  nationality: string;
  phone: string;
  email: string;
  affiliationCompany: string;
  affiliationRole: string;
  residenceCity: string;
  passportNumber: string;
  passportExpiry: string;
  favoriteRoom: {
    name: string;
    number: string;
    photoUrl: string;
    reason: string;
  };
  permanentInstructions: Array<{
    icon: string;
    text: string;
    variant: 'secondary' | 'surface' | 'primary';
  }>;
  dietaryPreferences: {
    diet: string;
    allergies: string;
  };
  stays: GuestStay[];
  preferences: GuestPreferenceItem[];
  folios: GuestFolioSummary[];
  notes: GuestNoteItem[];
}
