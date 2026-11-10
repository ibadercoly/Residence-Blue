import { Component, Input, Output, EventEmitter, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomStatus, Role, formatFcfa } from '@residence-blue/shared';
import { RoomUiItem } from '../../../core/services/rooms.service';
import { ImageComponent } from '../image/image.component';

@Component({
  selector: 'app-room-status-card',
  standalone: true,
  imports: [CommonModule, ImageComponent],
  template: `
    <div
      class="room-card group relative"
      [class.highlight-card]="isHighlighted"
      [class.opacity-75]="room.isActive === false"
      [attr.data-room-id]="room.id"
      [attr.data-room-number]="room.number"
      [attr.data-room-status]="room.status"
      [attr.data-is-active]="room.isActive !== false"
    >
      <!-- Zone visuelle : Photo de la chambre avec superposition d'informations -->
      <div class="card-visual relative h-48 overflow-hidden rounded-t-2xl">
        <app-image
          [src]="room.imageUrl || room.image || 'assets/images/chambres/chambre-fallback.jpg'"
          [alt]="room.imageAlt || ('Chambre ' + room.number + ' - ' + (room.type?.name || 'Standard'))"
          cssClass="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        ></app-image>

        <!-- Dégradé protecteur pour lisibilité des textes -->
        <div class="visual-gradient absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40"></div>

        <!-- En-tête photo : Numéro de chambre, Badge Statut et Menu « ⋯ » discret -->
        <div class="visual-header absolute top-3 left-3 right-3 flex items-center justify-between z-10">
          <span class="room-number-tag font-headline-sm text-white font-bold text-lg drop-shadow-md">
            Chambre {{ room.number }}
          </span>

          <div class="flex items-center gap-1.5">
            <!-- Badge Statut -->
            @if (room.isActive === false) {
              <span class="status-badge inactive" data-status="INACTIVE">
                <span class="dot inactive"></span> Inactive
              </span>
            } @else {
              <span class="status-badge" [attr.data-status]="room.status">
                @switch (room.status) {
                  @case (RoomStatus.FREE) {
                    <span class="dot free"></span> Libre
                  }
                  @case (RoomStatus.OCCUPIED) {
                    <span class="dot occupied"></span> Occupée
                  }
                  @case (RoomStatus.CLEANING) {
                    <span class="dot cleaning"></span> À nettoyer
                  }
                  @case (RoomStatus.MAINTENANCE) {
                    <span class="dot maintenance"></span> En maintenance
                  }
                }
              </span>
            }

            <!-- Menu discret « ⋯ » -->
            <div class="relative">
              <button
                type="button"
                (click)="toggleMenu($event)"
                class="w-7 h-7 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md text-white flex items-center justify-center transition-colors cursor-pointer focus:ring-2 focus:ring-white"
                [attr.data-testid]="'room-menu-btn-' + room.number"
                data-testid="room-menu-btn"
                aria-label="Options chambre"
                aria-haspopup="menu"
                [attr.aria-expanded]="isMenuOpen()"
              >
                <span class="material-symbols-outlined text-[18px]">more_horiz</span>
              </button>

              <!-- Menu déroulant d'actions -->
              @if (isMenuOpen()) {
                <div
                  class="absolute right-0 top-8 w-44 bg-surface rounded-xl shadow-2xl border border-outline-variant/60 py-1.5 z-30 animate-in fade-in zoom-in-95 duration-100"
                  role="menu"
                  (click)="$event.stopPropagation()"
                >
                  <button
                    type="button"
                    (click)="onActionView()"
                    class="w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low flex items-center gap-2 cursor-pointer"
                    data-testid="menu-action-details"
                  >
                    <span class="material-symbols-outlined text-[16px] text-on-surface-variant">visibility</span>
                    <span>Voir la fiche</span>
                  </button>

                  @if (currentRole === Role.DIRECTION) {
                    <button
                      type="button"
                      (click)="onActionEdit()"
                      class="w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low flex items-center gap-2 cursor-pointer"
                      data-testid="menu-action-edit"
                    >
                      <span class="material-symbols-outlined text-[16px] text-primary">edit</span>
                      <span>Modifier</span>
                    </button>

                    @if (room.isActive !== false) {
                      <button
                        type="button"
                        (click)="onActionDeactivate()"
                        class="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                        data-testid="menu-action-deactivate"
                      >
                        <span class="material-symbols-outlined text-[16px] text-rose-500">block</span>
                        <span>Désactiver</span>
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="onActionReactivate()"
                        class="w-full text-left px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 flex items-center gap-2 cursor-pointer"
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
        </div>

        <!-- Bas de photo : Catégorie & Étage -->
        <div class="visual-footer absolute bottom-3 left-3 right-3 flex items-center justify-between text-white z-10">
          <span class="room-type-name font-title-md text-sm font-semibold tracking-wide text-white drop-shadow">
            {{ room.category || room.type?.name || 'Standard' }}
          </span>
          <span class="room-floor text-xs bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">
            Étage {{ room.floor }}
          </span>
        </div>
      </div>

      <!-- Corps de la carte : Tarifs, Équipements et Actions -->
      <div class="card-body p-4 bg-surface-container-lowest rounded-b-2xl border border-t-0 border-outline-variant/60 flex flex-col justify-between flex-1">
        <div>
          <div class="price-row flex items-baseline justify-between mb-2">
            <span class="price-amount font-label-currency text-xl font-bold text-primary">
              {{ formatPrice(room.type?.pricePerNight || 0) }}
            </span>
            <span class="price-unit text-xs text-on-surface-variant font-medium">/ nuitée</span>
          </div>

          <!-- Équipements clés -->
          <div class="amenities-list flex flex-wrap gap-1 mb-3">
            @for (amenity of room.amenities; track amenity) {
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
        </div>

        <!-- Actions contextuelles de statut (actives uniquement si chambre active) -->
        @if (showActions && room.isActive !== false) {
          <div class="actions-section pt-2 border-t border-outline-variant/40 mt-auto">
            <div class="actions-label text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-1.5">
              Changer le statut :
            </div>
            <div class="actions-grid grid grid-cols-2 gap-1.5">
              @if (room.status === RoomStatus.FREE) {
                <button
                  type="button"
                  class="btn-action btn-occupied"
                  [attr.data-action]="'check-in-' + room.number"
                  (click)="onStatusChange.emit({ status: RoomStatus.OCCUPIED, reason: 'Check-in client' })"
                >
                  <span class="material-symbols-outlined text-[16px]">login</span>
                  Check-in
                </button>
                <button
                  type="button"
                  class="btn-action btn-maintenance"
                  (click)="onStatusChange.emit({ status: RoomStatus.MAINTENANCE, reason: 'Signalement panne' })"
                >
                  <span class="material-symbols-outlined text-[16px]">build</span>
                  Maintenance
                </button>
              }

              @if (room.status === RoomStatus.OCCUPIED) {
                <button
                  type="button"
                  class="btn-action btn-cleaning"
                  [attr.data-action]="'check-out-' + room.number"
                  (click)="onStatusChange.emit({ status: RoomStatus.CLEANING, reason: 'Check-out client' })"
                >
                  <span class="material-symbols-outlined text-[16px]">logout</span>
                  Check-out
                </button>
                <button
                  type="button"
                  class="btn-action btn-maintenance"
                  (click)="onStatusChange.emit({ status: RoomStatus.MAINTENANCE, reason: 'Incident en chambre' })"
                >
                  <span class="material-symbols-outlined text-[16px]">build</span>
                  Maintenance
                </button>
              }

              @if (room.status === RoomStatus.CLEANING) {
                <button
                  type="button"
                  class="btn-action btn-free"
                  [attr.data-action]="'mark-free-' + room.number"
                  (click)="onStatusChange.emit({ status: RoomStatus.FREE, reason: 'Ménage achevé et contrôlé' })"
                >
                  <span class="material-symbols-outlined text-[16px]">done_all</span>
                  Prête (Libre)
                </button>
                <button
                  type="button"
                  class="btn-action btn-maintenance"
                  (click)="onStatusChange.emit({ status: RoomStatus.MAINTENANCE, reason: 'Panne constatée au ménage' })"
                >
                  <span class="material-symbols-outlined text-[16px]">build</span>
                  Maintenance
                </button>
              }

              @if (room.status === RoomStatus.MAINTENANCE) {
                <button
                  type="button"
                  class="btn-action btn-cleaning"
                  (click)="onStatusChange.emit({ status: RoomStatus.CLEANING, reason: 'Travaux achevés, ménage requis' })"
                >
                  <span class="material-symbols-outlined text-[16px]">cleaning_services</span>
                  Ménage
                </button>
                <button
                  type="button"
                  class="btn-action btn-free"
                  (click)="onStatusChange.emit({ status: RoomStatus.FREE, reason: 'Petite intervention validée' })"
                >
                  <span class="material-symbols-outlined text-[16px]">check</span>
                  Remise Libre
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>
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
      background: var(--color-surface-container-lowest);
      box-shadow: 0 2px 8px rgba(10, 37, 64, 0.05);
      transition: transform 0.2s, box-shadow 0.2s, ring 0.3s;
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
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      backdrop-filter: blur(8px);
      background: rgba(0, 0, 0, 0.45);
      color: #ffffff;
    }
    .status-badge[data-status="FREE"] { background: rgba(16, 185, 129, 0.9); }
    .status-badge[data-status="OCCUPIED"] { background: rgba(0, 102, 111, 0.9); }
    .status-badge[data-status="CLEANING"] { background: rgba(245, 158, 11, 0.9); }
    .status-badge[data-status="MAINTENANCE"] { background: rgba(239, 68, 68, 0.9); }
    .status-badge.inactive, .status-badge[data-status="INACTIVE"] { background: rgba(107, 114, 128, 0.9); }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 9999px;
      background: currentColor;
    }
    .dot.inactive { background: #9ca3af; }

    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.25rem;
      padding: 0.375rem 0.5rem;
      border-radius: 0.5rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      border: 1px solid transparent;
    }
    .btn-occupied {
      background: var(--color-primary);
      color: #ffffff;
    }
    .btn-occupied:hover { background: var(--color-primary-container); }

    .btn-free {
      background: #10b981;
      color: #ffffff;
    }
    .btn-free:hover { background: #059669; }

    .btn-cleaning {
      background: #f59e0b;
      color: #ffffff;
    }
    .btn-cleaning:hover { background: #d97706; }

    .btn-maintenance {
      background: var(--color-surface-container);
      color: var(--color-on-surface);
      border-color: var(--color-outline-variant);
    }
    .btn-maintenance:hover { background: var(--color-surface-container-high); }
  `]
})
export class RoomStatusCardComponent {
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
      this.closeMenu();
    }
  }

  @HostListener('document:click')
  onDocClick(): void {
    if (this.isMenuOpen()) {
      this.closeMenu();
    }
  }

  toggleMenu(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.isMenuOpen.update((v) => !v);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  onActionView(): void {
    this.closeMenu();
    this.onView.emit(this.room);
  }

  onActionEdit(): void {
    this.closeMenu();
    this.onEdit.emit(this.room);
  }

  onActionDeactivate(): void {
    this.closeMenu();
    this.onDeactivate.emit(this.room);
  }

  onActionReactivate(): void {
    this.closeMenu();
    this.onReactivate.emit(this.room);
  }

  formatPrice(amount: number): string {
    return formatFcfa(amount);
  }
}
