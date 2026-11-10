import { Component, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomStatus } from '@residence-blue/shared';

export type StatusBadgeVariant =
  | 'FREE'
  | 'OCCUPIED'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'INACTIVE'
  | 'available'
  | 'occupied'
  | 'cleaning'
  | 'maintenance'
  | 'inactive'
  | 'vip'
  | 'neutral'
  | string;

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span
      class="status-badge-root inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[12px] font-bold uppercase tracking-wider whitespace-nowrap shrink-0 border select-none transition-colors"
      [class.bg-emerald-50]="normalizedVariant() === 'FREE'"
      [class.text-emerald-950]="normalizedVariant() === 'FREE'"
      [class.border-emerald-300]="normalizedVariant() === 'FREE'"
      [class.bg-[#e6f4f5]]="normalizedVariant() === 'OCCUPIED'"
      [class.text-[#003b41]]="normalizedVariant() === 'OCCUPIED'"
      [class.border-[#99d5da]]="normalizedVariant() === 'OCCUPIED'"
      [class.bg-amber-50]="normalizedVariant() === 'CLEANING'"
      [class.text-amber-950]="normalizedVariant() === 'CLEANING'"
      [class.border-amber-300]="normalizedVariant() === 'CLEANING'"
      [class.bg-rose-50]="normalizedVariant() === 'MAINTENANCE'"
      [class.text-rose-950]="normalizedVariant() === 'MAINTENANCE'"
      [class.border-rose-300]="normalizedVariant() === 'MAINTENANCE'"
      [class.bg-slate-100]="normalizedVariant() === 'INACTIVE' || normalizedVariant() === 'neutral'"
      [class.text-slate-900]="normalizedVariant() === 'INACTIVE' || normalizedVariant() === 'neutral'"
      [class.border-slate-300]="normalizedVariant() === 'INACTIVE' || normalizedVariant() === 'neutral'"
      [class.bg-secondary-fixed]="normalizedVariant() === 'vip'"
      [class.text-on-secondary-fixed]="normalizedVariant() === 'vip'"
      [class.border-secondary]="normalizedVariant() === 'vip'"
      [attr.data-status]="normalizedVariant()"
      [attr.data-testid]="testId() || ('status-badge-' + normalizedVariant().toLowerCase())"
    >
      @if (showDot()) {
        <span
          class="status-dot w-2 h-2 rounded-full shrink-0"
          [class.bg-emerald-600]="normalizedVariant() === 'FREE'"
          [class.bg-[#00666f]]="normalizedVariant() === 'OCCUPIED'"
          [class.bg-amber-600]="normalizedVariant() === 'CLEANING'"
          [class.bg-rose-600]="normalizedVariant() === 'MAINTENANCE'"
          [class.bg-slate-500]="normalizedVariant() === 'INACTIVE' || normalizedVariant() === 'neutral'"
          [class.bg-secondary]="normalizedVariant() === 'vip'"
          aria-hidden="true"
        ></span>
      }
      <span class="status-label truncate">{{ displayLabel() }}</span>
    </span>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      line-height: 1;
    }
    .status-badge-root {
      height: 24px;
      padding: 0 10px;
      border-radius: 9999px;
      font-size: 12px;
      box-sizing: border-box;
      max-width: 100%;
    }
    .status-dot {
      width: 8px;
      height: 8px;
    }
  `]
})
export class StatusBadgeComponent {
  readonly status = input<RoomStatus | string | null>(null);
  readonly variant = input<StatusBadgeVariant | null>(null);
  readonly label = input<string | null>(null);
  readonly isActive = input<boolean>(true);
  readonly showDot = input<boolean>(true);
  readonly testId = input<string | null>(null);

  readonly normalizedVariant = computed<string>(() => {
    if (this.isActive() === false) {
      return 'INACTIVE';
    }
    const val = (this.status() || this.variant() || 'FREE').toString();
    switch (val.toUpperCase()) {
      case 'FREE':
      case 'AVAILABLE':
      case 'LIBRE':
        return 'FREE';
      case 'OCCUPIED':
      case 'OCCUPEE':
      case 'OCCUPÉE':
      case 'EN_SEJOUR':
        return 'OCCUPIED';
      case 'CLEANING':
      case 'MENAGE':
      case 'MÉNAGE':
      case 'A_NETTOYER':
        return 'CLEANING';
      case 'MAINTENANCE':
      case 'PANNE':
      case 'EN_MAINTENANCE':
        return 'MAINTENANCE';
      case 'INACTIVE':
      case 'INACTIF':
        return 'INACTIVE';
      case 'VIP':
        return 'vip';
      default:
        return val;
    }
  });

  readonly displayLabel = computed<string>(() => {
    if (this.label()) {
      return this.label()!;
    }
    switch (this.normalizedVariant()) {
      case 'FREE':
        return 'Libre';
      case 'OCCUPIED':
        return 'Occupée';
      case 'CLEANING':
        return 'Ménage';
      case 'MAINTENANCE':
        return 'Maintenance';
      case 'INACTIVE':
        return 'Inactive';
      case 'vip':
        return 'VIP';
      default:
        return this.normalizedVariant();
    }
  });
}
