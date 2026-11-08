import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HOTEL_ROOMS_CATALOG, RoomDefinition, RoomType, formatFcfa } from '@residence-blue/shared';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rooms-container">
      <div class="header-section">
        <div>
          <h2 class="title font-serif">Inventaire des 12 Chambres</h2>
          <p class="subtitle">Gestion des hébergements de Résidence Blue à Thiès (Grand Standing)</p>
        </div>
        <div class="filter-pills">
          <button
            class="pill"
            [class.active]="selectedType() === null"
            (click)="filterType(null)">
            Toutes (12)
          </button>
          <button
            class="pill"
            [class.active]="selectedType() === RoomType.STANDARD"
            (click)="filterType(RoomType.STANDARD)">
            Standard (6)
          </button>
          <button
            class="pill"
            [class.active]="selectedType() === RoomType.DELUXE"
            (click)="filterType(RoomType.DELUXE)">
            Deluxe (4)
          </button>
          <button
            class="pill"
            [class.active]="selectedType() === RoomType.SUITE"
            (click)="filterType(RoomType.SUITE)">
            Suites (2)
          </button>
        </div>
      </div>

      <div class="rooms-grid">
        @for (room of filteredRooms(); track room.id) {
          <div class="card room-card">
            <div class="room-header">
              <span class="room-number">{{ room.number }}</span>
              <span class="room-type-badge" [attr.data-type]="room.type">{{ room.type }}</span>
            </div>
            <h3 class="room-name">{{ room.name }}</h3>
            <p class="room-desc">{{ room.description }}</p>
            <div class="room-meta">
              <span>Étage {{ room.floor === 0 ? 'RDC' : room.floor }}</span>
              <span>•</span>
              <span>Capacité : {{ room.capacity }} pers.</span>
            </div>
            <div class="room-footer">
              <div class="price-tag">
                <span class="price-value">{{ formatPrice(room.basePriceFcfa) }}</span>
                <span class="price-label">/ nuit</span>
              </div>
              <button class="btn btn-primary btn-sm">Réserver</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .rooms-container {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .title {
      font-size: 1.75rem;
      color: var(--color-on-surface);
      font-weight: 600;
    }
    .subtitle {
      color: var(--color-on-surface-variant);
      font-size: 0.875rem;
    }
    .filter-pills {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    .pill {
      background: var(--color-surface-container);
      border: 1px solid var(--color-outline-variant);
      padding: 0.375rem 0.875rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      cursor: pointer;
      color: var(--color-on-surface);
      font-weight: 500;
      transition: all 0.2s;
    }
    .pill.active {
      background: var(--color-primary);
      color: var(--color-on-primary);
      border-color: var(--color-primary);
    }
    .rooms-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.25rem;
    }
    .room-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .room-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .room-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
    .room-number {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--color-primary);
    }
    .room-type-badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      background: var(--color-surface-container-high);
      color: var(--color-on-surface-variant);
    }
    .room-name {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.375rem;
    }
    .room-desc {
      font-size: 0.8125rem;
      color: var(--color-on-surface-variant);
      margin-bottom: 0.75rem;
      line-height: 1.4;
    }
    .room-meta {
      font-size: 0.75rem;
      color: var(--color-outline);
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .room-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--color-outline-variant);
      padding-top: 0.875rem;
      margin-top: auto;
    }
    .price-value {
      font-size: 1.125rem;
      font-weight: 700;
      color: var(--color-on-surface);
    }
    .price-label {
      font-size: 0.75rem;
      color: var(--color-outline);
      margin-left: 0.25rem;
    }
    .btn-sm {
      padding: 0.375rem 0.875rem;
      font-size: 0.75rem;
    }
  `],
})
export class RoomsComponent {
  readonly RoomType = RoomType;
  readonly rooms = signal<RoomDefinition[]>(HOTEL_ROOMS_CATALOG);
  readonly selectedType = signal<RoomType | null>(null);

  filteredRooms() {
    const type = this.selectedType();
    if (!type) {
      return this.rooms();
    }
    return this.rooms().filter((r) => r.type === type);
  }

  filterType(type: RoomType | null) {
    this.selectedType.set(type);
  }

  formatPrice(amountFcfa: number): string {
    return formatFcfa(amountFcfa);
  }
}
