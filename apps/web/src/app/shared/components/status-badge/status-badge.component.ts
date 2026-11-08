import { Component, input } from '@angular/core';

export type StatusBadgeVariant = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'vip' | 'neutral';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `
    <span
      class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-md text-label-md font-semibold transition-colors"
      [class.bg-emerald-50]="variant() === 'available'"
      [class.text-emerald-800]="variant() === 'available'"
      [class.border]="variant() === 'available'"
      [class.border-emerald-200]="variant() === 'available'"
      [class.bg-rose-50]="variant() === 'occupied'"
      [class.text-rose-800]="variant() === 'occupied'"
      [class.border-rose-200]="variant() === 'occupied'"
      [class.bg-amber-50]="variant() === 'cleaning'"
      [class.text-amber-800]="variant() === 'cleaning'"
      [class.border-amber-200]="variant() === 'cleaning'"
      [class.bg-secondary-fixed]="variant() === 'vip'"
      [class.text-on-secondary-fixed]="variant() === 'vip'"
      [class.bg-surface-container-high]="variant() === 'neutral'"
      [class.text-on-surface-variant]="variant() === 'neutral'"
    >
      @if (showDot()) {
        <span
          class="w-1.5 h-1.5 rounded-full"
          [class.bg-emerald-500]="variant() === 'available'"
          [class.bg-rose-500]="variant() === 'occupied'"
          [class.bg-amber-500]="variant() === 'cleaning'"
          [class.bg-secondary]="variant() === 'vip'"
          [class.bg-outline]="variant() === 'neutral'"
          aria-hidden="true"
        ></span>
      }
      <span>{{ label() }}</span>
    </span>
  `
})
export class StatusBadgeComponent {
  readonly label = input.required<string>();
  readonly variant = input<StatusBadgeVariant>('neutral');
  readonly showDot = input<boolean>(true);
}
