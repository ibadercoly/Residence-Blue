import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RestaurantOrderV3 } from '@residence-blue/shared';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import {
  RESTAURANT_SCROLL_STYLES,
  elapsedMinutesSince,
  formatOrderTime,
} from '../models/restaurant-v3.model';
import { RestaurantV3Service } from '../services/restaurant-v3.service';

@Component({
  selector: 'app-kitchen-board-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    RESTAURANT_SCROLL_STYLES,
    `
      .rb-kitchen-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }
      @media (max-width: 899px) {
        .rb-kitchen-grid {
          grid-template-columns: minmax(0, 1fr);
        }
      }
      .rb-kitchen-col-scroll {
        max-height: calc(100dvh - 240px);
        min-height: 280px;
      }
    `,
  ],
  template: `
    <app-layout>
      <div class="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 space-y-5" data-testid="kitchen-board-page">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-[#006875]">
              Écran Cuisine • Temps réel
            </p>
            <h1 class="rb-serif text-2xl sm:text-3xl font-bold text-[#161d20]">
              Suivi des préparations
            </h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <span
              data-testid="kitchen-sync-indicator"
              class="inline-flex items-center gap-1.5 rounded-full border border-[#d6e2e4] bg-white px-3 py-1.5 text-xs font-bold text-[#161d20]"
            >
              {{ service.sseConnected() ? 'Flux SSE temps réel actif' : 'Actualisation auto 10 s' }}
            </span>
            <a routerLink="/restaurant" data-testid="link-back-pos" class="rb-btn rb-btn-outline">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              <span>Prise de commande</span>
            </a>
          </div>
        </header>

        @if (!service.isOnline()) {
          <div
            role="alert"
            data-testid="kitchen-offline-banner"
            class="rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] px-4 py-3 text-sm font-bold text-[#9b1c1c]"
          >
            La cuisine est indisponible hors ligne : reconnectez la tablette pour recevoir et faire avancer les tickets.
          </div>
        }

        @if (service.errorMessage(); as err) {
          <div
            role="alert"
            class="rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] px-4 py-3 text-sm font-bold text-[#9b1c1c]"
          >
            {{ err }}
          </div>
        }

        <!-- Trois colonnes égales >= 900 px, empilées sous 900 px -->
        <div class="rb-kitchen-grid">
          <!-- COLONNE 1 : EN ATTENTE -->
          <section
            aria-label="Commandes en attente"
            data-testid="kitchen-col-PENDING"
            class="rounded-2xl border border-[#d6e2e4] bg-white p-3.5 flex flex-col gap-3 min-w-0"
          >
            <div class="flex items-center justify-between border-b border-[#e6f0f2] pb-2.5">
              <h2 class="rb-serif text-lg font-bold text-[#161d20]">En attente</h2>
              <span class="rounded-full bg-[#e0f2fe] px-2.5 py-0.5 text-xs font-extrabold text-[#075985]">
                {{ pendingOrders().length }}
              </span>
            </div>
            <div class="rb-scroll-box rb-kitchen-col-scroll space-y-3 pr-1">
              @if (pendingOrders().length === 0) {
                <p class="p-4 text-center text-xs font-medium text-[#3d494a]">
                  Aucun ticket en attente.
                </p>
              } @else {
                @for (ord of pendingOrders(); track ord.id) {
                  <article
                    [attr.data-testid]="'kitchen-card-' + ord.id"
                    class="rounded-xl border border-[#c2d2d4] bg-[#f8fafb] p-4 space-y-3"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span class="block text-base font-extrabold text-[#161d20]">
                          {{ ord.ticketNumber }}
                        </span>
                        <span class="block text-sm font-bold text-[#00545f]">
                          {{ ord.destinationLabel }}
                        </span>
                      </div>
                      <div class="text-right">
                        <span class="block text-xs font-bold text-[#3d494a]">
                          {{ formatOrderTime(ord.createdAt) }}
                        </span>
                        <span
                          [attr.data-testid]="'kitchen-wait-' + ord.id"
                          [class]="waitMinutes(ord) > 15
                            ? 'inline-block rounded-full bg-[#fde8e8] px-2.5 py-0.5 text-xs font-extrabold text-[#b81d1d]'
                            : 'inline-block rounded-full bg-[#e6f0f2] px-2.5 py-0.5 text-xs font-bold text-[#161d20]'"
                        >
                          {{ waitMinutes(ord) }} min
                        </span>
                      </div>
                    </div>

                    <ul class="space-y-1.5 border-t border-[#d6e2e4] pt-2.5">
                      @for (item of ord.items; track item.id) {
                        <li class="text-sm text-[#161d20]">
                          <span class="font-extrabold text-[#00545f] mr-1.5">{{ item.quantity }}×</span>
                          <span class="font-bold">{{ item.name }}</span>
                          @if (item.notes) {
                            <span class="block ml-6 text-xs font-bold text-[#925300]">
                              Note : {{ item.notes }}
                            </span>
                          }
                        </li>
                      }
                    </ul>

                    @if (!service.canReadOnly()) {
                      <button
                        type="button"
                        [attr.data-testid]="'kitchen-next-' + ord.id"
                        [disabled]="!service.isOnline() || service.busyAction()"
                        (click)="advance(ord, 'IN_PREPARATION')"
                        class="rb-btn rb-btn-primary w-full"
                      >
                        Passer en préparation
                      </button>
                    }
                  </article>
                }
              }
            </div>
          </section>

          <!-- COLONNE 2 : EN PRÉPARATION -->
          <section
            aria-label="Commandes en préparation"
            data-testid="kitchen-col-IN_PREPARATION"
            class="rounded-2xl border border-[#d6e2e4] bg-white p-3.5 flex flex-col gap-3 min-w-0"
          >
            <div class="flex items-center justify-between border-b border-[#e6f0f2] pb-2.5">
              <h2 class="rb-serif text-lg font-bold text-[#161d20]">En préparation</h2>
              <span class="rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-extrabold text-[#925300]">
                {{ preparingOrders().length }}
              </span>
            </div>
            <div class="rb-scroll-box rb-kitchen-col-scroll space-y-3 pr-1">
              @if (preparingOrders().length === 0) {
                <p class="p-4 text-center text-xs font-medium text-[#3d494a]">
                  Aucun ticket en cours de préparation.
                </p>
              } @else {
                @for (ord of preparingOrders(); track ord.id) {
                  <article
                    [attr.data-testid]="'kitchen-card-' + ord.id"
                    class="rounded-xl border border-[#f59e0b]/45 bg-[#fffcf2] p-4 space-y-3"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span class="block text-base font-extrabold text-[#161d20]">
                          {{ ord.ticketNumber }}
                        </span>
                        <span class="block text-sm font-bold text-[#00545f]">
                          {{ ord.destinationLabel }}
                        </span>
                      </div>
                      <div class="text-right">
                        <span class="block text-xs font-bold text-[#3d494a]">
                          {{ formatOrderTime(ord.createdAt) }}
                        </span>
                        <span
                          [attr.data-testid]="'kitchen-wait-' + ord.id"
                          [class]="waitMinutes(ord) > 15
                            ? 'inline-block rounded-full bg-[#fde8e8] px-2.5 py-0.5 text-xs font-extrabold text-[#b81d1d]'
                            : 'inline-block rounded-full bg-[#fef3c7] px-2.5 py-0.5 text-xs font-bold text-[#925300]'"
                        >
                          {{ waitMinutes(ord) }} min
                        </span>
                      </div>
                    </div>

                    <ul class="space-y-1.5 border-t border-[#d6e2e4] pt-2.5">
                      @for (item of ord.items; track item.id) {
                        <li class="text-sm text-[#161d20]">
                          <span class="font-extrabold text-[#925300] mr-1.5">{{ item.quantity }}×</span>
                          <span class="font-bold">{{ item.name }}</span>
                          @if (item.notes) {
                            <span class="block ml-6 text-xs font-bold text-[#925300]">
                              Note : {{ item.notes }}
                            </span>
                          }
                        </li>
                      }
                    </ul>

                    @if (!service.canReadOnly()) {
                      <button
                        type="button"
                        [attr.data-testid]="'kitchen-next-' + ord.id"
                        [disabled]="!service.isOnline() || service.busyAction()"
                        (click)="advance(ord, 'READY')"
                        class="rb-btn rb-btn-secondary w-full"
                      >
                        Marquer prête
                      </button>
                    }
                  </article>
                }
              }
            </div>
          </section>

          <!-- COLONNE 3 : PRÊTES -->
          <section
            aria-label="Commandes prêtes"
            data-testid="kitchen-col-READY"
            class="rounded-2xl border border-[#d6e2e4] bg-white p-3.5 flex flex-col gap-3 min-w-0"
          >
            <div class="flex items-center justify-between border-b border-[#e6f0f2] pb-2.5">
              <h2 class="rb-serif text-lg font-bold text-[#161d20]">Prêtes</h2>
              <span class="rounded-full bg-[#e3f5ec] px-2.5 py-0.5 text-xs font-extrabold text-[#116b41]">
                {{ readyOrders().length }}
              </span>
            </div>
            <div class="rb-scroll-box rb-kitchen-col-scroll space-y-3 pr-1">
              @if (readyOrders().length === 0) {
                <p class="p-4 text-center text-xs font-medium text-[#3d494a]">
                  Aucun plat prêt à servir.
                </p>
              } @else {
                @for (ord of readyOrders(); track ord.id) {
                  <article
                    [attr.data-testid]="'kitchen-card-' + ord.id"
                    class="rounded-xl border border-[#116b41]/40 bg-[#f4fbf7] p-4 space-y-3"
                  >
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <span class="block text-base font-extrabold text-[#161d20]">
                          {{ ord.ticketNumber }}
                        </span>
                        <span class="block text-sm font-bold text-[#116b41]">
                          {{ ord.destinationLabel }}
                        </span>
                      </div>
                      <div class="text-right">
                        <span class="block text-xs font-bold text-[#3d494a]">
                          {{ formatOrderTime(ord.createdAt) }}
                        </span>
                        <span
                          [attr.data-testid]="'kitchen-wait-' + ord.id"
                          [class]="waitMinutes(ord) > 15
                            ? 'inline-block rounded-full bg-[#fde8e8] px-2.5 py-0.5 text-xs font-extrabold text-[#b81d1d]'
                            : 'inline-block rounded-full bg-[#e3f5ec] px-2.5 py-0.5 text-xs font-bold text-[#116b41]'"
                        >
                          {{ waitMinutes(ord) }} min
                        </span>
                      </div>
                    </div>

                    <ul class="space-y-1.5 border-t border-[#d6e2e4] pt-2.5">
                      @for (item of ord.items; track item.id) {
                        <li class="text-sm text-[#161d20]">
                          <span class="font-extrabold text-[#116b41] mr-1.5">{{ item.quantity }}×</span>
                          <span class="font-bold">{{ item.name }}</span>
                          @if (item.notes) {
                            <span class="block ml-6 text-xs font-bold text-[#925300]">
                              Note : {{ item.notes }}
                            </span>
                          }
                        </li>
                      }
                    </ul>

                    @if (!service.canReadOnly()) {
                      <button
                        type="button"
                        [attr.data-testid]="'kitchen-next-' + ord.id"
                        [disabled]="!service.isOnline() || service.busyAction()"
                        (click)="advance(ord, 'SERVED')"
                        class="rb-btn rb-btn-outline w-full"
                      >
                        Marquer servie
                      </button>
                    }
                  </article>
                }
              }
            </div>
          </section>
        </div>
      </div>
    </app-layout>
  `,
})
export class KitchenBoardPageComponent implements OnInit, OnDestroy {
  readonly service = inject(RestaurantV3Service);
  readonly nowMs = signal<number>(Date.now());

  private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  readonly pendingOrders = computed(() =>
    this.service.kitchenOrders().filter((o) => o.status === 'PENDING' || o.status === 'SENT_TO_KITCHEN'),
  );

  readonly preparingOrders = computed(() =>
    this.service.kitchenOrders().filter((o) => o.status === 'IN_PREPARATION'),
  );

  readonly readyOrders = computed(() =>
    this.service.kitchenOrders().filter((o) => o.status === 'READY'),
  );

  readonly formatOrderTime = formatOrderTime;

  ngOnInit(): void {
    void this.service.loadKitchenOrders();
    this.service.connectKitchenStream(() => {
      void this.service.loadKitchenOrders();
    });

    // Secours toutes les 10 s sur cet écran uniquement
    this.fallbackPollTimer = setInterval(() => {
      void this.service.loadKitchenOrders();
    }, 10_000);

    // Mise à jour du chrono d'attente (> 15 min en rouge)
    this.clockTimer = setInterval(() => {
      this.nowMs.set(Date.now());
    }, 15_000);
  }

  ngOnDestroy(): void {
    this.service.disconnectKitchenStream();
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  waitMinutes(ord: RestaurantOrderV3): number {
    return elapsedMinutesSince(ord.createdAt, this.nowMs());
  }

  async advance(ord: RestaurantOrderV3, nextStatus: 'IN_PREPARATION' | 'READY' | 'SERVED'): Promise<void> {
    await this.service.updateOrderStatus(ord.id, nextStatus);
  }
}
