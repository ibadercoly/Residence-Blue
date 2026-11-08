import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomsService } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { RoomStatus, Role, formatFcfa } from '@residence-blue/shared';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule],
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

      <!-- Grille des Cartes des 12 Chambres -->
      <div class="rooms-grid">
        @for (room of roomsService.filteredRooms(); track room.id) {
          <div
            class="room-card"
            [attr.data-room-id]="room.id"
            [attr.data-room-number]="room.number"
            [attr.data-room-status]="room.status">
            <!-- Bande visuelle / Photo stylisée boutique avec badge statut -->
            <div class="card-visual" [attr.data-category]="room.type?.name">
              <div class="visual-gradient"></div>
              <div class="visual-header">
                <span class="room-number-tag">Chambre {{ room.number }}</span>
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
              </div>
              <div class="visual-footer">
                <span class="room-type-name">{{ room.type?.name || 'Standard' }}</span>
                <span class="room-floor">Étage {{ room.floor }}</span>
              </div>
            </div>

            <!-- Corps de la carte : Tarifs & Équipements -->
            <div class="card-body">
              <div class="price-row">
                <span class="price-amount">{{ formatPrice(room.type?.pricePerNight || 0) }}</span>
                <span class="price-unit">/ nuitée</span>
              </div>

              <!-- Équipements clés -->
              <div class="amenities-list">
                @for (amenity of room.amenities; track amenity) {
                  <span class="amenity-chip">{{ amenity }}</span>
                }
              </div>

              <!-- Indicateur si modification en attente de synchronisation -->
              @if (room.syncPending) {
                <div class="sync-pending-card-alert">
                  <span class="material-symbols-outlined text-sm">cloud_upload</span>
                  <span>Modifié hors-ligne • En attente de sync</span>
                </div>
              }

              <!-- Actions contextuelles selon statut et rôle -->
              <div class="actions-section">
                <div class="actions-label">Changer le statut :</div>
                <div class="actions-grid">
                  @if (room.status === RoomStatus.FREE) {
                    <button
                      type="button"
                      class="btn btn-action btn-occupied"
                      [attr.data-action]="'check-in-' + room.number"
                      (click)="changeStatus(room.id, RoomStatus.OCCUPIED, 'Check-in client')">
                      <span class="material-symbols-outlined">login</span>
                      Check-in
                    </button>
                    <button
                      type="button"
                      class="btn btn-action btn-maintenance"
                      (click)="changeStatus(room.id, RoomStatus.MAINTENANCE, 'Signalement panne')">
                      <span class="material-symbols-outlined">build</span>
                      Maintenance
                    </button>
                  }

                  @if (room.status === RoomStatus.OCCUPIED) {
                    <button
                      type="button"
                      class="btn btn-action btn-cleaning"
                      [attr.data-action]="'check-out-' + room.number"
                      (click)="changeStatus(room.id, RoomStatus.CLEANING, 'Check-out client')">
                      <span class="material-symbols-outlined">cleaning_services</span>
                      Libérer (Ménage)
                    </button>
                    <button
                      type="button"
                      class="btn btn-action btn-maintenance"
                      (click)="changeStatus(room.id, RoomStatus.MAINTENANCE, 'Incident en chambre')">
                      <span class="material-symbols-outlined">build</span>
                      Maintenance
                    </button>
                  }

                  @if (room.status === RoomStatus.CLEANING) {
                    <button
                      type="button"
                      class="btn btn-action btn-free"
                      [attr.data-action]="'mark-free-' + room.number"
                      (click)="changeStatus(room.id, RoomStatus.FREE, 'Ménage achevé et contrôlé')">
                      <span class="material-symbols-outlined">done_all</span>
                      Prête (Libre)
                    </button>
                    <button
                      type="button"
                      class="btn btn-action btn-maintenance"
                      (click)="changeStatus(room.id, RoomStatus.MAINTENANCE, 'Panne constatée au ménage')">
                      <span class="material-symbols-outlined">build</span>
                      Maintenance
                    </button>
                  }

                  @if (room.status === RoomStatus.MAINTENANCE) {
                    <button
                      type="button"
                      class="btn btn-action btn-cleaning"
                      (click)="changeStatus(room.id, RoomStatus.CLEANING, 'Travaux achevés, ménage requis')">
                      <span class="material-symbols-outlined">cleaning_services</span>
                      Fin travaux $\rightarrow$ Ménage
                    </button>
                    <button
                      type="button"
                      class="btn btn-action btn-free"
                      (click)="changeStatus(room.id, RoomStatus.FREE, 'Petite intervention validée')">
                      <span class="material-symbols-outlined">check</span>
                      Remise Libre
                    </button>
                  }
                </div>
              </div>
            </div>
          </div>
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
      flex-wrap: wrap;
      gap: 1.25rem;
    }

    .badge-tag {
      font-size: 0.6875rem;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: var(--color-primary);
      background: rgba(0, 102, 111, 0.1);
      padding: 0.2rem 0.5rem;
      border-radius: 9999px;
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
    .network-badge.offline {
      background: rgba(239, 68, 68, 0.15);
      color: #991b1b;
    }
    .network-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }
    .network-badge.online .dot { background: #10b981; }
    .network-badge.offline .dot { background: #ef4444; }

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
      flex-wrap: wrap;
      gap: 1rem;
      border-top: 1px solid var(--color-outline-variant);
      padding-top: 1rem;
    }
    .status-filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .filter-pill {
      background: var(--color-surface-container-low);
      border: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
      padding: 0.375rem 0.875rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      transition: all 0.2s;
    }
    .filter-pill.active {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-color: var(--color-primary);
    }
    .status-indicator-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
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
      color: #047857;
    }

    /* Grille des cartes */
    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.5rem;
    }

    .room-card {
      background: var(--color-surface);
      border: 1px solid var(--color-outline-variant);
      border-radius: 1rem;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .room-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
    }

    /* Zone visuelle en-tête carte */
    .card-visual {
      position: relative;
      height: 120px;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: #ffffff;
      background-size: cover;
      background-position: center;
    }
    .card-visual[data-category="Standard"] {
      background: linear-gradient(135deg, #004c54 0%, #00666f 100%);
    }
    .card-visual[data-category="Deluxe"] {
      background: linear-gradient(135deg, #7e5700 0%, #a27205 100%);
    }
    .card-visual[data-category="Suite"] {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
    }

    .visual-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 2;
    }
    .room-number-tag {
      font-size: 1.25rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      text-shadow: 0 1px 2px rgba(0,0,0,0.4);
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
      background: rgba(0, 0, 0, 0.4);
    }
    .status-badge[data-status="FREE"] {
      background: rgba(16, 185, 129, 0.85);
      color: #ffffff;
    }
    .status-badge[data-status="OCCUPIED"] {
      background: rgba(0, 102, 111, 0.9);
      color: #ffffff;
    }
    .status-badge[data-status="CLEANING"] {
      background: rgba(245, 158, 11, 0.9);
      color: #ffffff;
    }
    .status-badge[data-status="MAINTENANCE"] {
      background: rgba(239, 68, 68, 0.9);
      color: #ffffff;
    }
    .status-badge .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #ffffff;
    }

    .visual-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      z-index: 2;
    }
    .room-type-name {
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .room-floor {
      font-size: 0.75rem;
      opacity: 0.9;
    }

    /* Corps carte */
    .card-body {
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      flex: 1;
    }
    .price-row {
      display: flex;
      align-items: baseline;
      gap: 0.375rem;
    }
    .price-amount {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .price-unit {
      font-size: 0.75rem;
      color: var(--color-on-surface-variant);
    }

    .amenities-list {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .amenity-chip {
      background: var(--color-surface-container);
      color: var(--color-on-surface-variant);
      font-size: 0.6875rem;
      font-weight: 500;
      padding: 0.15rem 0.5rem;
      border-radius: 0.25rem;
    }

    .sync-pending-card-alert {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      background: rgba(245, 158, 11, 0.1);
      border: 1px dashed rgba(245, 158, 11, 0.4);
      color: #b45309;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.375rem 0.625rem;
      border-radius: 0.375rem;
    }

    /* Actions */
    .actions-section {
      margin-top: auto;
      border-top: 1px solid var(--color-outline-variant);
      padding-top: 0.875rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .actions-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-outline);
    }
    .actions-grid {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .btn-action {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 0.4375rem 0.75rem;
      font-size: 0.75rem;
      font-weight: 600;
      border-radius: 0.375rem;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .btn-action .material-symbols-outlined {
      font-size: 1rem;
    }
    .btn-occupied {
      background: #00666f;
      color: #ffffff;
    }
    .btn-occupied:hover {
      background: #004c54;
    }
    .btn-cleaning {
      background: #f59e0b;
      color: #ffffff;
    }
    .btn-cleaning:hover {
      background: #d97706;
    }
    .btn-free {
      background: #10b981;
      color: #ffffff;
    }
    .btn-free:hover {
      background: #059669;
    }
    .btn-maintenance {
      background: transparent;
      border: 1px solid #ef4444;
      color: #ef4444;
    }
    .btn-maintenance:hover {
      background: rgba(239, 68, 68, 0.1);
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
