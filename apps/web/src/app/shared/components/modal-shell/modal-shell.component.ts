import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  input,
  output,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';

let nextModalId = 0;

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isOpen()) {
      <!-- Modal Backdrop Overlay -->
      <div
        class="fixed inset-0 bg-inverse-surface/65 backdrop-blur-md z-50 flex items-center justify-center p-0 md:p-4 overflow-hidden modal-shell-backdrop"
        (click)="onBackdropClick($event)"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="titleId()"
        [attr.data-testid]="testId()"
      >
        <!-- Modal Window Container -->
        <div
          #modalContainer
          class="relative w-full max-[767px]:h-full max-[767px]:max-h-full max-[767px]:rounded-none md:rounded-2xl bg-surface-container-lowest text-on-surface shadow-[0_24px_48px_-12px_rgba(10,37,64,0.28)] flex flex-col overflow-hidden modal-shell-window"
          [style.maxWidth]="containerMaxWidth()"
          [style.maxHeight]="containerMaxHeight()"
          (click)="$event.stopPropagation()"
        >
          <!-- Fixed Header (~72px) -->
          <header class="flex items-center justify-between px-4 sm:px-6 py-2.5 min-h-[60px] max-h-[72px] bg-surface-container-low/80 border-b border-outline-variant/15 shrink-0">
            <div class="flex items-center gap-3 min-w-0">
              @if (icon()) {
                <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <span class="material-symbols-outlined text-[20px] sm:text-[22px]" aria-hidden="true">{{ icon() }}</span>
                </div>
              }
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h2 [id]="titleId()" class="font-headline-sm text-base sm:text-lg font-bold tracking-tight text-on-surface truncate">
                    {{ title() }}
                  </h2>
                  @if (badge()) {
                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-secondary-fixed text-on-secondary-container shrink-0">
                      <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                      {{ badge() }}
                    </span>
                  }
                </div>
                @if (subtitle()) {
                  <p class="text-xs text-outline truncate">
                    {{ subtitle() }}
                  </p>
                }
              </div>
            </div>
            @if (showCloseButton()) {
              <button
                #closeButton
                type="button"
                (click)="requestClose()"
                aria-label="Fermer la fenêtre"
                data-testid="btn-close-modal"
                class="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer shrink-0 min-h-[44px] min-w-[44px]"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            }
          </header>

          <!-- Scrollable Body (Internal scroll only, flex-1) -->
          <main class="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4">
            <ng-content select="[modal-body]" />
            <ng-content />
          </main>

          <!-- Fixed Footer (Always visible) -->
          <footer class="shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 bg-surface-container-low/95 border-t border-outline-variant/15 flex items-center justify-between flex-wrap gap-2 sm:gap-3">
            <ng-content select="[modal-footer]" />
          </footer>
        </div>
      </div>
    }
  `,
  styles: [`
    :host {
      display: contents;
    }
    .modal-shell-backdrop {
      animation: modalFadeIn 150ms ease-out forwards;
    }
    .modal-shell-window {
      animation: modalScaleIn 150ms ease-out forwards;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modalScaleIn {
      from { opacity: 0.95; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .modal-shell-backdrop,
      .modal-shell-window {
        animation: none !important;
        transition: none !important;
      }
    }
  `]
})
export class ModalShellComponent implements OnDestroy {
  readonly isOpen = input<boolean>(false);
  readonly title = input<string>('');
  readonly badge = input<string>('');
  readonly subtitle = input<string>('');
  readonly icon = input<string>('');
  readonly maxWidth = input<string>('960px');
  readonly maxHeight = input<string>('88dvh');
  readonly closeOnBackdrop = input<boolean>(true);
  readonly closeOnEscape = input<boolean>(true);
  readonly showCloseButton = input<boolean>(true);
  readonly testId = input<string>('modal-shell');

  readonly closed = output<void>();

  @ViewChild('modalContainer') modalContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  readonly uniqueId = ++nextModalId;
  readonly titleId = computed(() => `modal-shell-title-${this.uniqueId}`);

  private previousActiveElement: HTMLElement | null = null;
  private isBodyLocked = false;

  readonly containerMaxWidth = computed(() => {
    return `min(${this.maxWidth()}, calc(100vw - 32px))`;
  });

  readonly containerMaxHeight = computed(() => {
    return this.maxHeight();
  });

  constructor() {
    effect(() => {
      const open = this.isOpen();
      if (typeof document === 'undefined') return;

      if (open) {
        this.previousActiveElement = document.activeElement as HTMLElement | null;
        this.lockBodyScroll();
        // Placer le focus dans le modal
        setTimeout(() => {
          this.focusInitialElement();
        }, 50);
      } else {
        this.unlockBodyScroll();
        if (this.previousActiveElement && typeof this.previousActiveElement.focus === 'function') {
          this.previousActiveElement.focus();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  private lockBodyScroll(): void {
    if (typeof document === 'undefined' || this.isBodyLocked) return;
    document.body.style.overflow = 'hidden';
    this.isBodyLocked = true;
  }

  private unlockBodyScroll(): void {
    if (typeof document === 'undefined' || !this.isBodyLocked) return;
    document.body.style.overflow = '';
    this.isBodyLocked = false;
  }

  requestClose(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (this.closeOnBackdrop() && event.target === event.currentTarget) {
      this.requestClose();
    }
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen()) return;

    if (event.key === 'Escape' && this.closeOnEscape()) {
      event.preventDefault();
      event.stopPropagation();
      this.requestClose();
      return;
    }

    if (event.key === 'Tab') {
      this.handleTabFocusTrap(event);
    }
  }

  private focusInitialElement(): void {
    if (!this.modalContainer) return;
    const focusable = this.getFocusableElements();
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      this.modalContainer.nativeElement.focus();
    }
  }

  private handleTabFocusTrap(event: KeyboardEvent): void {
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) return;

    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement || !this.modalContainer?.nativeElement.contains(document.activeElement)) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      if (document.activeElement === lastElement || !this.modalContainer?.nativeElement.contains(document.activeElement)) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }

  private getFocusableElements(): HTMLElement[] {
    if (!this.modalContainer) return [];
    const selector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(
      this.modalContainer.nativeElement.querySelectorAll<HTMLElement>(selector)
    ).filter((el) => el.offsetParent !== null && !el.hasAttribute('aria-hidden'));
  }
}
