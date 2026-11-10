import { Component, Output, EventEmitter, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ActionButtonVariant = 'solid' | 'outline';
export type ActionButtonColor = 'primary' | 'success' | 'amber' | 'danger' | 'neutral';

@Component({
  selector: 'app-action-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      [type]="type()"
      [disabled]="disabled()"
      (click)="onClick($event)"
      class="action-button-root group relative inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full text-sm font-semibold rounded-xl box-border select-none transition-all duration-150 cursor-pointer overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98]"
      [class.btn-solid]="variant() === 'solid'"
      [class.btn-outline]="variant() === 'outline'"
      [class.color-primary]="color() === 'primary'"
      [class.color-success]="color() === 'success'"
      [class.color-amber]="color() === 'amber'"
      [class.color-danger]="color() === 'danger'"
      [class.color-neutral]="color() === 'neutral'"
      [attr.data-testid]="testId()"
      [attr.aria-label]="ariaLabel() || label()"
    >
      @if (icon()) {
        <span class="material-symbols-outlined text-[16px] shrink-0 leading-none" aria-hidden="true">
          {{ icon() }}
        </span>
      }
      <span class="btn-text truncate whitespace-nowrap">{{ label() }}</span>
    </button>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }
    .action-button-root {
      height: 40px;
      padding: 0 12px;
      box-sizing: border-box;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      width: 100%;
    }
    .btn-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Variantes pleines (solid) */
    .btn-solid.color-primary {
      background: var(--color-primary, #00666f);
      color: #ffffff;
      border: 1px solid transparent;
    }
    .btn-solid.color-primary:hover:not(:disabled) {
      background: var(--color-primary-container, #004d54);
    }

    .btn-solid.color-success {
      background: #059669;
      color: #ffffff;
      border: 1px solid transparent;
    }
    .btn-solid.color-success:hover:not(:disabled) {
      background: #047857;
    }

    .btn-solid.color-amber {
      background: #d97706;
      color: #ffffff;
      border: 1px solid transparent;
    }
    .btn-solid.color-amber:hover:not(:disabled) {
      background: #b45309;
    }

    .btn-solid.color-danger {
      background: #dc2626;
      color: #ffffff;
      border: 1px solid transparent;
    }
    .btn-solid.color-danger:hover:not(:disabled) {
      background: #b91c1c;
    }

    .btn-solid.color-neutral {
      background: var(--color-surface-container-high, #e5e7eb);
      color: var(--color-on-surface, #1f2937);
      border: 1px solid transparent;
    }
    .btn-solid.color-neutral:hover:not(:disabled) {
      background: var(--color-surface-container-highest, #d1d5db);
    }

    /* Variantes contour (outline) */
    .btn-outline {
      background: transparent;
      border: 1px solid var(--color-outline-variant, #cbd5e1);
      color: var(--color-on-surface, #1f2937);
    }
    .btn-outline:hover:not(:disabled) {
      background: var(--color-surface-container, #f3f4f6);
      border-color: var(--color-outline, #94a3b8);
    }

    .btn-outline.color-primary {
      border-color: var(--color-primary, #00666f);
      color: var(--color-primary, #00666f);
    }
    .btn-outline.color-primary:hover:not(:disabled) {
      background: rgba(0, 102, 111, 0.08);
    }

    .btn-outline.color-danger {
      border-color: #ef4444;
      color: #dc2626;
    }
    .btn-outline.color-danger:hover:not(:disabled) {
      background: #fef2f2;
    }
  `]
})
export class ActionButtonComponent {
  readonly label = input.required<string>();
  readonly icon = input<string | null>(null);
  readonly variant = input<ActionButtonVariant>('solid');
  readonly color = input<ActionButtonColor>('primary');
  readonly disabled = input<boolean>(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly testId = input<string | null>(null);
  readonly ariaLabel = input<string | null>(null);

  @Output() action = new EventEmitter<MouseEvent>();

  onClick(event: MouseEvent): void {
    if (!this.disabled()) {
      this.action.emit(event);
    }
  }
}
