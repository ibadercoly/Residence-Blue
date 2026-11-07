import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NetworkService } from './core/offline/network.service';
import { OutboxService } from './core/offline/outbox.service';
import { RoomsComponent } from './features/rooms/rooms.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RoomsComponent],
  template: `
    <div class="app-layout">
      <!-- En-tête principal -->
      <header class="app-header">
        <div class="header-left">
          <div class="brand">
            <span class="brand-title font-serif">Résidence Blue</span>
            <span class="brand-sub">PMS &bull; Saly, Sénégal</span>
          </div>
        </div>

        <div class="header-right">
          <!-- Indicateur d'état Réseau & Synchronisation Hors-ligne -->
          <div class="sync-status-indicator">
            @if (isOnline()) {
              @if (pendingCount() > 0) {
                <span class="badge badge-syncing">
                  <span class="pulse-dot syncing"></span>
                  {{ pendingCount() }} en attente de synchronisation
                </span>
              } @else {
                <span class="badge badge-online">
                  <span class="pulse-dot online"></span>
                  En ligne
                </span>
              }
            } @else {
              <span class="badge badge-offline">
                <span class="pulse-dot offline"></span>
                Hors ligne (Mode déconnecté)
              </span>
            }
          </div>

          <div class="user-pill">
            <span class="user-role">Réception</span>
            <span class="user-name">Mamadou D.</span>
          </div>
        </div>
      </header>

      <!-- Navigation latérale & contenu -->
      <div class="main-body">
        <aside class="sidebar">
          <nav class="nav-menu">
            <a class="nav-item">
              <span>Tableau de bord</span>
            </a>
            <a class="nav-item">
              <span>Planning Réservations</span>
            </a>
            <a class="nav-item active">
              <span>12 Chambres</span>
            </a>
            <a class="nav-item">
              <span>Restaurant &amp; Bar</span>
            </a>
            <a class="nav-item">
              <span>Facturation &amp; Folio</span>
            </a>
            <a class="nav-item">
              <span>Maintenance</span>
            </a>
          </nav>
        </aside>

        <!-- Contenu principal -->
        <main class="content-area">
          <app-rooms></app-rooms>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem 1.5rem;
      background: var(--color-surface-container-lowest);
      border-bottom: 1px solid var(--color-outline-variant);
      position: sticky;
      top: 0;
      z-index: 50;
    }
    .brand {
      display: flex;
      flex-direction: column;
    }
    .brand-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--color-primary);
      line-height: 1.2;
    }
    .brand-sub {
      font-size: 0.75rem;
      color: var(--color-secondary);
      font-weight: 500;
      letter-spacing: 0.05em;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 1rem;
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      display: inline-block;
      margin-right: 0.35rem;
    }
    .pulse-dot.online {
      background-color: #10b981;
    }
    .pulse-dot.offline {
      background-color: #ef4444;
    }
    .pulse-dot.syncing {
      background-color: #f59e0b;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.4; }
      100% { opacity: 1; }
    }
    .user-pill {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-size: 0.8125rem;
    }
    .user-role {
      font-size: 0.7rem;
      color: var(--color-outline);
    }
    .user-name {
      font-weight: 600;
      color: var(--color-on-surface);
    }
    .main-body {
      display: flex;
      flex: 1;
    }
    .sidebar {
      width: 240px;
      background: var(--color-surface-container-low);
      border-right: 1px solid var(--color-outline-variant);
      padding: 1rem 0;
    }
    .nav-menu {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .nav-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 1.25rem;
      color: var(--color-on-surface-variant);
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .nav-item:hover {
      background: var(--color-surface-container);
      color: var(--color-on-surface);
    }
    .nav-item.active {
      background: var(--color-primary);
      color: var(--color-on-primary);
      font-weight: 600;
    }
    .content-area {
      flex: 1;
      padding: 1.5rem;
      background: var(--color-surface);
    }
  `],
})
export class AppComponent {
  private readonly networkService = inject(NetworkService);
  private readonly outboxService = inject(OutboxService);

  readonly isOnline = this.networkService.isOnline;
  readonly pendingCount = this.outboxService.pendingCount;
}
