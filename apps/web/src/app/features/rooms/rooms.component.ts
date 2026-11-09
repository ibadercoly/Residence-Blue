import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomsService } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { RoomStatus, Role, formatFcfa } from '@residence-blue/shared';
import { RoomStatusCardComponent } from '../../shared/components/room-status-card/room-status-card.component';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, RoomStatusCardComponent],
  template: `
    <div class="rooms-page">
      <!-- En-tête avec métriques et sélecteur de rôle -->
      <div class="header-card">
        <div class="header-main">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="badge-tag">Hôtellerie Boutique</span>
              <!-- Indicateur Réseau & Synchronisation -->
              @if (network.isOnline()) {
                <span class="network-badge online" id="network-status">
                  <span class="dot"></span> En ligne
                </span>
              } @else {
                <span class="network-badge offline" id="network-status">
                  <span class="dot"></span> Hors-ligne (IndexedDB actif)
                </span>
              }

              @if (outbox.pendingCount() > 0) {
                <span class="sync-pending-badge" id="sync-pending-counter">
                  ⏳ {{ outbox.pendingCount() }} en attente de sync
                </span>
                <button
                  class="btn btn-outline btn-xs"
                  [disabled]="!network.isOnline() || outbox.isSyncing()"
                  (click)="syncNow()">
                  {{ outbox.isSyncing() ? 'Synchronisation...' : 'Synchroniser' }}
                </button>
              }
            </div>
            <h1 class="page-title font-serif">Grille des 12 Chambres</h1>
            <p class="page-subtitle">
              Gestion en temps réel des statuts, départs et maintenance • Thiès (Grand Standing)
            </p>
          </div>

          <!-- Sélecteur de rôle simulé pour tester les habilitations RBAC -->
          <div class="role-selector-box">
            <span class="role-label">Profil actif :</span>
            <div class="role-pills">
              <button
                type="button"
                class="role-pill"
                [class.active]="roomsService.currentRole() === Role.RECEPTION"
                (click)="setRole(Role.RECEPTION)">
                Réception
              </button>
              <button
                type="button"
                class="role-pill"
                [class.active]="roomsService.currentRole() === Role.HOUSEKEEPING"
                (click)="setRole(Role.HOUSEKEEPING)">
                Gouvernance
              </button>
              <button
                type="button"
                class="role-pill"
                [class.active]="roomsService.currentRole() === Role.MAINTENANCE"
                (click)="setRole(Role.MAINTENANCE)">
                Technique
              </button>
              <button
                type="button"
                class="role-pill"
                [class.active]="roomsService.currentRole() === Role.DIRECTION"
                (click)="setRole(Role.DIRECTION)">
                Direction
              </button>
            </div>
          </div>
        </div>

        <!-- Barres de filtres par statut et par étage -->
        <div class="filters-row">
          <div class="status-filters">
            <button
              class="filter-pill"
              [class.active]="roomsService.selectedFilter() === 'ALL'"
              (click)="roomsService.setFilter('ALL')">
              Toutes ({{ roomsService.counts().total }})
            </button>
            <button
              class="filter-pill free"
              [class.active]="roomsService.selectedFilter() === RoomStatus.FREE"
              (click)="roomsService.setFilter(RoomStatus.FREE)">
              <span class="status-indicator-dot free"></span>
              Libres ({{ roomsService.counts().free }})
            </button>
            <button
              class="filter-pill occupied"
              [class.active]="roomsService.selectedFilter() === RoomStatus.OCCUPIED"
              (click)="roomsService.setFilter(RoomStatus.OCCUPIED)">
              <span class="status-indicator-dot occupied"></span>
              Occupées ({{ roomsService.counts().occupied }})
            </button>
            <button
              class="filter-pill cleaning"
              [class.active]="roomsService.selectedFilter() === RoomStatus.CLEANING"
              (click)="roomsService.setFilter(RoomStatus.CLEANING)">
              <span class="status-indicator-dot cleaning"></span>
              Ménage ({{ roomsService.counts().cleaning }})
            </button>
            <button
              class="filter-pill maintenance"
              [class.active]="roomsService.selectedFilter() === RoomStatus.MAINTENANCE"
              (click)="roomsService.setFilter(RoomStatus.MAINTENANCE)">
              <span class="status-indicator-dot maintenance"></span>
              Maintenance ({{ roomsService.counts().maintenance }})
            </button>
          </div>

          <div class="floor-filters">
            <span class="floor-label">Étage :</span>
            <button
              class="floor-btn"
              [class.active]="roomsService.selectedFloor() === null"
              (click)="roomsService.setFloor(null)">
              Tous
            </button>
            <button
              class="floor-btn"
              [class.active]="roomsService.selectedFloor() === 1"
              (click)="roomsService.setFloor(1)">
              1er (Standard)
            </button>
            <button
              class="floor-btn"
              [class.active]="roomsService.selectedFloor() === 2"
              (click)="roomsService.setFloor(2)">
              2e (Deluxe)
            </button>
            <button
              class="floor-btn"
              [class.active]="roomsService.selectedFloor() === 3"
              (click)="roomsService.setFloor(3)">
              3e (Suites)
            </button>
          </div>
        </div>

        <!-- Messages d'erreur ou de succès -->
        @if (roomsService.errorMessage()) {
          <div class="alert-banner error" id="alert-error">
            <span class="material-symbols-outlined">error</span>
            <span>{{ roomsService.errorMessage() }}</span>
          </div>
        }
        @if (roomsService.successMessage()) {
          <div class="alert-banner success" id="alert-success">
            <span class="material-symbols-outlined">check_circle</span>
            <span>{{ roomsService.successMessage() }}</span>
          </div>
        }
      </div>

      <!-- Grille des Cartes des 12 Chambres avec Photos Dédiées -->
      <div class="rooms-grid">
        @for (room of roomsService.filteredRooms(); track room.id) {
          <app-room-status-card
            [room]="room"
            [currentRole]="roomsService.currentRole()"
            (onStatusChange)="changeStatus(room.id, $event.status, $event.reason)"
          ></app-room-status-card>
        }
      </div>
    </div>
  `,
  styles: [`
    .rooms-page {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      padding-bottom: 2rem;
    }

    .header-card {
      background: var(--color-surface);
      border: 1px solid var(--color-outline-variant);
      border-radius: 1rem;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }

    .header-main {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      flex-wrap: wrap;
    }

    .badge-tag {
      background: var(--color-primary-container);
      color: var(--color-on-primary-container);
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 0.2rem 0.5rem;
      border-radius: 0.375rem;
    }

    .network-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.625rem;
      border-radius: 9999px;
    }
    .network-badge.online {
      background: rgba(16, 185, 129, 0.15);
      color: #065f46;
    }
    .network-badge.online .dot {
      background: #10b981;
    }
    .network-badge.offline {
      background: rgba(239, 68, 68, 0.15);
      color: #991b1b;
    }
    .network-badge.offline .dot {
      background: #ef4444;
    }

    .dot {
      width: 6px;
      height: 6px;
      border-radius: 9999px;
      display: inline-block;
    }

    .sync-pending-badge {
      background: rgba(245, 158, 11, 0.15);
      color: #b45309;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.2rem 0.625rem;
      border-radius: 9999px;
    }

    .page-title {
      font-size: 1.875rem;
      font-weight: 600;
      color: var(--color-on-surface);
      line-height: 1.2;
    }

    .page-subtitle {
      font-size: 0.875rem;
      color: var(--color-on-surface-variant);
      margin-top: 0.25rem;
    }

    /* Sélecteur de rôle */
    .role-selector-box {
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      border-radius: 0.75rem;
      padding: 0.625rem 0.875rem;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .role-label {
      font-size: 0.6875rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--color-on-surface-variant);
    }
    .role-pills {
      display: flex;
      gap: 0.375rem;
    }
    .role-pill {
      background: transparent;
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      padding: 0.25rem 0.625rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .role-pill.active {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-color: var(--color-primary);
      font-weight: 600;
    }

    /* Filtres */
    .filters-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 1rem;
      flex-wrap: wrap;
      padding-top: 0.75rem;
      border-top: 1px solid var(--color-outline-variant);
    }

    .status-filters {
      display: flex;
      gap: 0.375rem;
      flex-wrap: wrap;
    }
    .filter-pill {
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      padding: 0.375rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      transition: all 0.15s ease;
    }
    .filter-pill.active {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-color: var(--color-primary);
      font-weight: 600;
    }
    .status-indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 9999px;
      display: inline-block;
    }
    .status-indicator-dot.free { background: #10b981; }
    .status-indicator-dot.occupied { background: #00666f; }
    .status-indicator-dot.cleaning { background: #f59e0b; }
    .status-indicator-dot.maintenance { background: #ef4444; }

    .floor-filters {
      display: flex;
      align-items: center;
      gap: 0.375rem;
    }
    .floor-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--color-on-surface-variant);
      margin-right: 0.25rem;
    }
    .floor-btn {
      background: transparent;
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      padding: 0.25rem 0.625rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      cursor: pointer;
    }
    .floor-btn.active {
      background: var(--color-secondary-container);
      color: var(--color-on-secondary-container);
      border-color: var(--color-secondary);
      font-weight: 600;
    }

    /* Bannières d'alerte */
    .alert-banner {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .alert-banner.error {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #b91c1c;
    }
    .alert-banner.success {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #065f46;
    }

    /* Grille des cartes */
    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .btn-xs {
      padding: 0.2rem 0.5rem;
      font-size: 0.6875rem;
      border-radius: 0.25rem;
    }
    .btn-outline {
      border: 1px solid var(--color-outline-variant);
      background: transparent;
      color: var(--color-on-surface);
      cursor: pointer;
    }
  `],
})
export class RoomsComponent {
  readonly RoomStatus = RoomStatus;
  readonly Role = Role;

  constructor(
    public readonly roomsService: RoomsService,
    public readonly network: NetworkService,
    public readonly outbox: OutboxService,
  ) {}

  formatPrice(amountFcfa: number): string {
    return formatFcfa(amountFcfa);
  }

  setRole(role: Role): void {
    this.roomsService.setRole(role);
  }

  async changeStatus(roomId: string, targetStatus: RoomStatus, reason?: string): Promise<void> {
    await this.roomsService.changeRoomStatus(roomId, targetStatus, reason);
  }

  async syncNow(): Promise<void> {
    await this.roomsService.syncOutbox();
  }
}
