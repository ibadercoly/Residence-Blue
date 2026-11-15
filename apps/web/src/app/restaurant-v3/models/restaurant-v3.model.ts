import {
  RESTAURANT_ORDER_STATUS_LABELS,
  RestaurantDestinationType,
} from '@residence-blue/shared';

export interface TicketDraftLine {
  productId: string;
  name: string;
  unitPriceFcfa: number;
  quantity: number;
  notes: string;
  prepStation: string;
}

export const RESTAURANT_PAYMENT_METHODS: Array<{
  value: 'CASH' | 'ORANGE_MONEY' | 'WAVE' | 'CARD' | 'BANK_TRANSFER';
  label: string;
}> = [
  { value: 'CASH', label: 'Espèces' },
  { value: 'ORANGE_MONEY', label: 'Orange Money' },
  { value: 'WAVE', label: 'Wave' },
  { value: 'CARD', label: 'Carte' },
  { value: 'BANK_TRANSFER', label: 'Virement' },
];

export function formatFcfa(amount: number | undefined | null): string {
  const safe = Math.round(Number(amount) || 0);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(safe)
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

export function formatOrderTime(iso: string | undefined | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function elapsedMinutesSince(iso: string | undefined | null, nowMs: number): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((nowMs - t) / 60000));
}

export function computePrepCountdown(
  heureFinPrevueIso: string | undefined | null,
  nowMs: number,
): { isOverdue: boolean; minutesRemaining: number; minutesLate: number; label: string } {
  if (!heureFinPrevueIso) {
    return {
      isOverdue: false,
      minutesRemaining: 0,
      minutesLate: 0,
      label: 'En préparation',
    };
  }
  const targetMs = new Date(heureFinPrevueIso).getTime();
  if (Number.isNaN(targetMs)) {
    return {
      isOverdue: false,
      minutesRemaining: 0,
      minutesLate: 0,
      label: 'En préparation',
    };
  }
  const diffMs = targetMs - nowMs;
  const timeStr = formatOrderTime(heureFinPrevueIso);
  if (diffMs < 0) {
    const lateMin = Math.max(1, Math.ceil(Math.abs(diffMs) / 60000));
    return {
      isOverdue: true,
      minutesRemaining: 0,
      minutesLate: lateMin,
      label: `En retard de ${lateMin} min`,
    };
  }
  const remMin = Math.max(1, Math.ceil(diffMs / 60000));
  return {
    isOverdue: false,
    minutesRemaining: remMin,
    minutesLate: 0,
    label: `En préparation, prête vers ${timeStr} (dans ${remMin} min)`,
  };
}

export function formatFullRoomDestination(
  destinationType: string | undefined | null,
  roomNumber: string | undefined | null,
  fallbackLabel: string | undefined | null,
): string {
  if (destinationType === 'ROOM') {
    const num =
      roomNumber ||
      fallbackLabel?.replace(/^(Ch\.|Chambre)\s*/i, '').trim() ||
      '';
    return num ? `Chambre ${num}` : 'Chambre';
  }
  if (destinationType === 'TAKEAWAY') {
    return 'À emporter';
  }
  return fallbackLabel || 'Table 1';
}

export function orderStatusLabel(status: string): string {
  return RESTAURANT_ORDER_STATUS_LABELS[status] || status;
}

export function orderStatusBadgeClass(status: string): string {
  switch (status) {
    case 'IN_PREPARATION':
      return 'bg-[#fef3c7] text-[#925300] border-[#f59e0b]/40';
    case 'READY':
      return 'bg-[#e3f5ec] text-[#116b41] border-[#116b41]/35';
    case 'SERVED':
      return 'bg-[#e6f0f2] text-[#004f58] border-[#006875]/30';
    case 'CANCELLED':
      return 'bg-[#fde8e8] text-[#9b1c1c] border-[#b81d1d]/35';
    default:
      return 'bg-[#e0f2fe] text-[#075985] border-[#0284c7]/35';
  }
}

export function destinationLabel(type: RestaurantDestinationType | string): string {
  switch (type) {
    case 'ROOM':
      return 'Chambre';
    case 'TAKEAWAY':
      return 'À emporter';
    default:
      return 'Table';
  }
}

export const RESTAURANT_DEFAULT_PLATE_SVG_URI =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 150" width="200" height="150">' +
      '<rect width="200" height="150" fill="#eef4f5"/>' +
      '<circle cx="100" cy="75" r="46" fill="#ffffff" stroke="#c2d2d4" stroke-width="2"/>' +
      '<circle cx="100" cy="75" r="35" fill="#f7fafb" stroke="#00666f" stroke-width="2.5"/>' +
      '<circle cx="100" cy="75" r="22" fill="none" stroke="#9ec4c9" stroke-width="1.5" stroke-dasharray="4 3"/>' +
      '<g stroke="#0a2540" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
      '<line x1="36" y1="42" x2="36" y2="108"/>' +
      '<path d="M30 42v18c0 5 12 5 12 0V42"/>' +
      '<line x1="36" y1="42" x2="36" y2="60"/>' +
      '<line x1="164" y1="42" x2="164" y2="108"/>' +
      '<path d="M164 42c6 6 6 24 0 32"/>' +
      '</g>' +
      '</svg>',
  );

export function hasPotentialCardPan(raw: string): boolean {
  const cleaned = (raw || '').replace(/[\s-]/g, '');
  return /\d{13,19}/.test(cleaned);
}

/**
 * Styles locaux de défilement vertical interne et boutons accessibles (≥ 40 px, contraste ≥ 4,5:1).
 */
export const RESTAURANT_SCROLL_STYLES = `
  :host {
    display: block;
    font-family: 'Manrope', sans-serif;
    color: #161d20;
  }

  .rb-serif {
    font-family: 'Newsreader', serif;
  }

  .rb-btn {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.2;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    cursor: pointer;
  }

  .rb-btn:focus-visible,
  input:focus-visible,
  select:focus-visible,
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid #006875;
    outline-offset: 2px;
  }

  .rb-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .rb-btn-primary {
    background-color: #006875;
    color: #ffffff;
    border: 1px solid #006875;
  }
  .rb-btn-primary:hover:not(:disabled) {
    background-color: #00545f;
    border-color: #00545f;
  }

  .rb-btn-secondary {
    background-color: #0a2540;
    color: #ffffff;
    border: 1px solid #0a2540;
  }
  .rb-btn-secondary:hover:not(:disabled) {
    background-color: #14365a;
  }

  .rb-btn-outline {
    background-color: #ffffff;
    color: #00545f;
    border: 1px solid #006875;
  }
  .rb-btn-outline:hover:not(:disabled) {
    background-color: #ecf4f6;
  }

  .rb-btn-danger-outline {
    background-color: #ffffff;
    color: #9b1c1c;
    border: 1px solid #b81d1d;
  }
  .rb-btn-danger-outline:hover:not(:disabled) {
    background-color: #fde8e8;
  }

  .rb-btn-muted {
    background-color: #e2e8ea;
    color: #3d494a;
    border: 1px solid #c2d2d4;
  }

  .rb-btn-sm {
    min-height: 40px;
    padding: 0 12px;
    font-size: 12px;
  }

  .rb-pos-products-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 200px), 1fr));
  }

  .rb-scroll-box {
    overflow-y: scroll;
    overflow-x: hidden;
    scrollbar-gutter: stable;
    scrollbar-width: auto;
    scrollbar-color: #4f6264 #e6f0f2;
  }

  .rb-scroll-box::-webkit-scrollbar {
    display: block !important;
    width: 12px;
    height: 12px;
  }

  .rb-scroll-box::-webkit-scrollbar-track {
    background: #e6f0f2;
    border-radius: 6px;
  }

  .rb-scroll-box::-webkit-scrollbar-thumb {
    background: #4f6264;
    border-radius: 6px;
    border: 2px solid #e6f0f2;
  }

  .rb-scroll-box::-webkit-scrollbar-thumb:hover {
    background: #2f3e40;
  }

  .rb-orders-scroll {
    max-height: 528px; /* En-tête 48 px + 10 lignes de 48 px */
  }

  .rb-orders-grid,
  .rb-carte-grid {
    display: none;
  }

  @media (min-width: 1024px) {
    .rb-orders-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr) minmax(0, 1.1fr) minmax(0, 0.85fr) minmax(0, 0.95fr) minmax(0, 0.55fr) minmax(0, 1.45fr);
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .rb-carte-grid {
      display: grid;
      grid-template-columns: 56px minmax(0, 1.5fr) minmax(0, 1.1fr) minmax(0, 0.8fr) minmax(0, 2.3fr);
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .rb-orders-grid > div,
    .rb-carte-grid > div {
      min-width: 0;
      overflow-wrap: anywhere;
    }
  }

  .rb-orders-row {
    min-height: 48px;
    padding: 6px 12px;
  }

  @media (max-width: 767px) {
    .rb-orders-scroll {
      max-height: 480px;
    }
  }
`;
