import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomUiItem } from '../../../core/services/rooms.service';
import { RoomStatus, Role, formatFcfa } from '@residence-blue/shared';
import { ImageComponent } from '../image/image.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { ActionButtonComponent } from '../action-button/action-button.component';

@Component({
  selector: 'app-room-status-card',
  standalone: true,
  imports: [CommonModule, ImageComponent, StatusBadgeComponent, ActionButtonComponent],
  template: `
    @if (room) {
      <div
        class="room-card group relative"
        [class.highlight-card]="isHighlighted"
        [class.opacity-75]="room.isActive === false"
        [class.z-40]="isMenuOpen()"
        [attr.data-room-id]="room.id"
        [attr.data-room-number]="room.number"
        [attr.data-room-status]="room.status"
        [attr.data-is-active]="room.isActive !== false"
      >
        <!-- En-tête de carte épuré : titre et catégorie à gauche (pleine largeur restante), bouton ⋯ à droite -->
        <div class="card-header flex items-center justify-between gap-2 p-3.5 bg-surface-container-lowest border-b border-outline-variant/30 min-w-0 w-full rounded-t-2xl">
          <!-- Titre et catégorie prenant toute la largeur restante, sans troncature (pas de truncate ni ellipsis) -->
          <div class="room-title-group min-w-0 flex-1 flex flex-col mr-1">
            <span
              class="room-title font-headline-sm font-bold text-on-surface text-base leading-tight break-words [overflow-wrap:anywhere]"
              [title]="'Chambre ' + room.number"
              data-testid="room-card-title"
            >
              Chambre {{ room.number }}
            </span>
            <span class="room-category text-xs text-on-surface-variant font-medium leading-normal break-words [overflow-wrap:anywhere]">
              {{ room.category || room.type?.name || 'Standard' }} • Étage {{ room.floor }}
            </span>
          </div>

          <!-- Bouton discret « ⋯ » (zone cliquable 40 x 40 px) avec menu déroulant s'ouvrant vers la gauche -->
          <div class="relative shrink-0">
            <button
              #menuTrigger
              type="button"
              (click)="toggleMenu($event)"
              (keydown)="onTriggerKeydown($event)"
              class="menu-btn-trigger w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              [attr.data-testid]="'room-menu-btn-' + room.number"
              data-testid="room-menu-btn"
              aria-label="Options chambre"
              aria-haspopup="menu"
              [attr.aria-expanded]="isMenuOpen()"
            >
              <span class="material-symbols-outlined text-[20px]">more_horiz</span>
            </button>

            <!-- Menu déroulant d'actions : min-width 220px, aligné à droite du bouton (ouvre vers la gauche) -->
            @if (isMenuOpen()) {
              <div
                #menuDropdown
                class="room-menu-dropdown absolute right-0 top-11 min-w-[220px] bg-surface rounded-xl shadow-2xl border border-outline-variant/60 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                role="menu"
                [attr.aria-labelledby]="'room-menu-btn-' + room.number"
                (keydown)="onMenuKeydown($event)"
                (click)="$event.stopPropagation()"
              >
                <!-- 1. Voir la fiche -->
                <button
                  type="button"
                  role="menuitem"
                  tabindex="0"
                  (click)="onActionView()"
                  class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  data-testid="menu-action-details"
                >
                  <span class="material-symbols-outlined text-[16px] text-on-surface-variant">visibility</span>
                  <span>Voir la fiche</span>
                </button>

                <!-- 2. Modifier (DIRECTION uniquement) -->
                @if (currentRole === Role.DIRECTION) {
                  <button
                    type="button"
                    role="menuitem"
                    tabindex="0"
                    (click)="onActionEdit()"
                    class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    data-testid="menu-action-edit"
                  >
                    <span class="material-symbols-outlined text-[16px] text-primary">edit</span>
                    <span>Modifier</span>
                  </button>
                }

                <!-- 3. État de la chambre (non cliquable, affiche la pastille d'état actuelle) -->
                <div
                  class="menu-item-status px-3 py-2 flex items-center justify-between gap-3 text-xs font-medium text-on-surface-variant select-none whitespace-nowrap"
                  role="none"
                  data-testid="menu-item-status"
                >
                  <span class="text-on-surface-variant font-medium">État</span>
                  <app-status-badge
                    [status]="room.status"
                    [isActive]="room.isActive !== false"
                    [testId]="'room-status-badge-' + room.number"
                  ></app-status-badge>
                </div>

                <!-- Séparation fine avant la dernière entrée -->
                @if (currentRole === Role.DIRECTION) {
                  <div class="border-t border-outline-variant/40 my-1" role="separator" aria-hidden="true"></div>

                  <!-- 4. Désactiver / Réactiver (en rouge / vert en dernier) -->
                  @if (room.isActive !== false) {
                    <button
                      type="button"
                      role="menuitem"
                      tabindex="0"
                      (click)="onActionDeactivate()"
                      class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                      data-testid="menu-action-deactivate"
                    >
                      <span class="material-symbols-outlined text-[16px] text-rose-500">block</span>
                      <span>Désactiver</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      role="menuitem"
                      tabindex="0"
                      (click)="onActionReactivate()"
                      class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                      data-testid="menu-action-reactivate"
                    >
                      <span class="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                      <span>Réactiver</span>
                    </button>
                  }
                }
              </div>
            }
          </div>
        </div>

        <!-- Zone visuelle : Photo épurée sans superposition de texte ni pastille -->
        <div class="card-visual relative h-44 overflow-hidden bg-surface-container">
          <app-image
            [src]="room.imageUrl || room.image || 'assets/images/chambres/chambre-fallback.jpg'"
            [alt]="room.imageAlt || ('Chambre ' + room.number + ' - ' + (room.type?.name || 'Standard'))"
            cssClass="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          ></app-image>
        </div>

        <!-- Corps de la carte : Tarifs, Équipements et Sync -->
        <div class="card-body p-4 bg-surface-container-lowest flex flex-col justify-between flex-1">
          <div>
            <div class="price-row flex items-baseline justify-between mb-2">
              <span class="price-amount font-label-currency text-xl font-bold text-primary">
                {{ formatPrice(room.type?.pricePerNight || 0) }}
              </span>
              <span class="price-unit text-xs text-on-surface-variant font-medium">/ nuitée</span>
            </div>

            <!-- Équipements clés -->
            <div class="amenities-list flex flex-wrap gap-1 mb-3">
              @for (amenity of (room.amenities || []); track amenity) {
                <span class="amenity-chip text-[11px] bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-md font-medium">
                  {{ amenity }}
                </span>
              }
            </div>

            <!-- Alerte modification hors ligne -->
            @if (room.syncPending) {
              <div class="sync-pending-card-alert flex items-center gap-1.5 p-1.5 bg-amber-50 text-amber-800 text-xs rounded-lg mb-2 font-medium">
                <span class="material-symbols-outlined text-[16px] text-amber-600 animate-spin">sync</span>
                <span>Modifié hors-ligne • En attente de sync</span>
              </div>
            }

            <!-- Alerte chambre inactive -->
            @if (room.isActive === false) {
              <div class="inactive-card-alert flex items-center gap-1.5 p-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg mb-2 font-medium" data-testid="room-inactive-alert">
                <span class="material-symbols-outlined text-[16px] text-slate-500">block</span>
                <span>Chambre désactivée (Inactive)</span>
              </div>
            }
          </div>
        </div>

        <!-- DÉFAUT 1 CORRIGÉ : Pied de carte sans libellé parasite -->
        <!-- Grille pleine largeur : max 2 boutons, même largeur, empilement sur 2 lignes sous 260px -->
        @if (showActions && room.isActive !== false) {
          <div class="actions-footer p-3.5 pt-0 bg-surface-container-lowest rounded-b-2xl border-t-0" data-testid="room-card-actions">
            <div class="actions-grid">
              @switch (room.status) {
                @case (RoomStatus.FREE) {
                  <!-- Action principale : Check-in -->
                  <app-action-button
                    label="Check-in"
                    icon="login"
                    variant="solid"
                    color="success"
                    [attr.data-action]="'check-in-' + room.number"
                    [testId]="'action-btn-check-in-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.OCCUPIED, reason: 'Check-in client' })"
                  ></app-action-button>
                  <!-- Action secondaire : Maintenance -->
                  <app-action-button
                    label="Maintenance"
                    icon="build"
                    variant="outline"
                    [attr.data-action]="'maintenance-' + room.number"
                    [testId]="'action-btn-maintenance-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.MAINTENANCE, reason: 'Signalement panne' })"
                  ></app-action-button>
                }

                @case (RoomStatus.OCCUPIED) {
                  <!-- Action principale : Check-out -->
                  <app-action-button
                    label="Check-out"
                    icon="logout"
                    variant="solid"
                    color="primary"
                    [attr.data-action]="'check-out-' + room.number"
                    [testId]="'action-btn-check-out-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.CLEANING, reason: 'Check-out client' })"
                  ></app-action-button>
                  <!-- Action secondaire : Maintenance -->
                  <app-action-button
                    label="Maintenance"
                    icon="build"
                    variant="outline"
                    [attr.data-action]="'maintenance-' + room.number"
                    [testId]="'action-btn-maintenance-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.MAINTENANCE, reason: 'Incident en chambre' })"
                  ></app-action-button>
                }

                @case (RoomStatus.CLEANING) {
                  <!-- Action principale : Marquer propre -->
                  <app-action-button
                    label="Marquer propre"
                    icon="done_all"
                    variant="solid"
                    color="success"
                    [attr.data-action]="'mark-free-' + room.number"
                    [testId]="'action-btn-mark-clean-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.FREE, reason: 'Ménage achevé et contrôlé' })"
                  ></app-action-button>
                  <!-- Action secondaire : Maintenance -->
                  <app-action-button
                    label="Maintenance"
                    icon="build"
                    variant="outline"
                    [attr.data-action]="'maintenance-' + room.number"
                    [testId]="'action-btn-maintenance-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.MAINTENANCE, reason: 'Panne constatée au ménage' })"
                  ></app-action-button>
                }

                @case (RoomStatus.MAINTENANCE) {
                  <!-- Action principale : Remettre en service -->
                  <app-action-button
                    label="Remettre en service"
                    icon="check_circle"
                    variant="solid"
                    color="primary"
                    [attr.data-action]="'restore-' + room.number"
                    [testId]="'action-btn-restore-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.FREE, reason: 'Petite intervention validée' })"
                  ></app-action-button>
                  <!-- Action secondaire : Ménage -->
                  <app-action-button
                    label="Ménage"
                    icon="cleaning_services"
                    variant="outline"
                    [attr.data-action]="'cleaning-' + room.number"
                    [testId]="'action-btn-cleaning-' + room.number"
                    (action)="onStatusChange.emit({ status: RoomStatus.CLEANING, reason: 'Travaux achevés, ménage requis' })"
                  ></app-action-button>
                }
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .room-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      border-radius: 1rem;
      border: 1px solid rgba(203, 213, 225, 0.6);
      background: var(--color-surface-container-lowest);
      box-shadow: 0 2px 8px rgba(10, 37, 64, 0.05);
      transition: transform 0.2s, box-shadow 0.2s;
      overflow: visible;
    }
    .room-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(10, 37, 64, 0.08);
    }
    .highlight-card {
      outline: 3px solid var(--color-primary);
      box-shadow: 0 0 0 6px rgba(0, 102, 111, 0.2), 0 8px 24px rgba(0, 102, 111, 0.25);
      animation: pulse-ring 2s infinite ease-in-out;
    }
    @keyframes pulse-ring {
      0%, 100% { outline-color: var(--color-primary); }
      50% { outline-color: rgba(0, 102, 111, 0.4); }
    }

    .room-title {
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .room-category {
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .menu-btn-trigger {
      width: 40px;
      height: 40px;
      box-sizing: border-box;
    }

    .room-menu-dropdown {
      min-width: 220px;
      box-sizing: border-box;
    }

    /* Grille d'actions selon spécification */
    .actions-footer {
      container-type: inline-size;
      width: 100%;
      box-sizing: border-box;
    }
    .actions-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
      width: 100%;
      align-items: center;
    }

    /* Empilement automatique sur 2 lignes pleine largeur si carte trop étroite (< 260px) */
    @container (max-width: 259px) {
      .actions-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `]
})
export class RoomStatusCardComponent {
  private readonly elementRef = inject(ElementRef, { optional: true });

  @Input({ required: true }) room!: RoomUiItem;
  @Input() currentRole: Role = Role.DIRECTION;
  @Input() showActions: boolean = true;
  @Input() isHighlighted: boolean = false;

  @Output() onStatusChange = new EventEmitter<{ status: RoomStatus; reason?: string }>();
  @Output() onEdit = new EventEmitter<RoomUiItem>();
  @Output() onDeactivate = new EventEmitter<RoomUiItem>();
  @Output() onReactivate = new EventEmitter<RoomUiItem>();
  @Output() onView = new EventEmitter<RoomUiItem>();

  readonly RoomStatus = RoomStatus;
  readonly Role = Role;
  readonly isMenuOpen = signal<boolean>(false);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.closeMenu(true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event?: MouseEvent): void {
    if (this.isMenuOpen() && event && this.elementRef?.nativeElement) {
      const target = event.target as Node;
      if (!this.elementRef.nativeElement.contains(target)) {
        this.closeMenu(false);
      }
    } else if (this.isMenuOpen() && !event) {
      this.closeMenu(false);
    }
  }

  toggleMenu(event?: MouseEvent | KeyboardEvent): void {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }
    const willOpen = !this.isMenuOpen();
    this.isMenuOpen.set(willOpen);
    if (willOpen && this.elementRef?.nativeElement) {
      setTimeout(() => {
        const firstAction = this.elementRef?.nativeElement?.querySelector?.('.menu-item-action') as HTMLElement | null;
        firstAction?.focus();
      }, 0);
    }
  }

  closeMenu(restoreFocus = false): void {
    this.isMenuOpen.set(false);
    if (restoreFocus && this.elementRef?.nativeElement) {
      setTimeout(() => {
        const btn = this.elementRef?.nativeElement?.querySelector?.('[data-testid^="room-menu-btn"]') as HTMLElement | null;
        btn?.focus();
      }, 0);
    }
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.isMenuOpen()) {
        this.toggleMenu(event);
      }
    } else if (event.key === 'Escape' && this.isMenuOpen()) {
      event.preventDefault();
      this.closeMenu(true);
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation?.();
      this.closeMenu(true);
      return;
    }

    if (!this.elementRef?.nativeElement) return;
    const actions = Array.from(
      this.elementRef.nativeElement.querySelectorAll('.menu-item-action')
    ) as HTMLElement[];

    if (actions.length === 0) return;
    const currentIndex = actions.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < actions.length - 1 ? currentIndex + 1 : 0;
      actions[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : actions.length - 1;
      actions[prevIndex]?.focus();
    } else if (event.key === 'Tab') {
      this.closeMenu(false);
    }
  }

  onActionView(): void {
    this.closeMenu(true);
    this.onView.emit(this.room);
  }

  onActionEdit(): void {
    this.closeMenu(true);
    this.onEdit.emit(this.room);
  }

  onActionDeactivate(): void {
    this.closeMenu(true);
    this.onDeactivate.emit(this.room);
  }

  onActionReactivate(): void {
    this.closeMenu(true);
    this.onReactivate.emit(this.room);
  }

  formatPrice(amount: number): string {
    return formatFcfa(amount);
  }
}
