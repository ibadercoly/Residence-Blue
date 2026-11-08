import { Component, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  host: { class: 'block h-full' },
  template: `
    <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group h-full">
      <div>
        <div class="flex items-center justify-between mb-space-sm">
          <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">{{ label() }}</span>
          <div
            class="w-9 h-9 rounded-xl bg-surface-container-low flex items-center justify-center group-hover:scale-105 transition-transform"
            [class.text-primary]="iconColor() === 'primary'"
            [class.text-secondary]="iconColor() === 'secondary'"
            [class.text-tertiary]="iconColor() === 'tertiary'"
          >
            <span class="material-symbols-outlined text-[20px]">{{ icon() }}</span>
          </div>
        </div>
        <ng-content select="[stat-value]" />
      </div>
      <ng-content select="[stat-footer]" />
    </div>
  `
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly icon = input.required<string>();
  readonly iconColor = input<'primary' | 'secondary' | 'tertiary'>('primary');
}
