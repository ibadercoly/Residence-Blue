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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RestaurantOrderV3 } from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import {
  RESTAURANT_SCROLL_STYLES,
  computePrepCountdown,
  elapsedMinutesSince,
  formatFullRoomDestination,
  formatOrderTime,
} from '../models/restaurant-v3.model';
import { RestaurantV3Service } from '../services/restaurant-v3.service';

@Component({
  selector: 'app-kitchen-board-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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
              [class]="
                service.sseConnected() && service.isOnline()
                  ? 'inline-flex items-center gap-1.5 rounded-full border border-[#116b41]/40 bg-[#e3f5ec] px-3 py-1.5 text-xs font-extrabold text-[#116b41]'
                  : 'inline-flex items-center gap-1.5 rounded-full border border-[#b81d1d]/40 bg-[#fde8e8] px-3 py-1.5 text-xs font-extrabold text-[#9b1c1c]'
              "
            >
              <span
                [class]="
                  service.sseConnected() && service.isOnline()
                    ? 'h-2 w-2 rounded-full bg-[#116b41]'
                    : 'h-2 w-2 rounded-full bg-[#b81d1d]'
                "
              ></span>
              <span>
                {{
                  service.sseConnected() && service.isOnline()
                    ? 'Temps réel actif'
                    : 'Connexion perdue, reconnexion...'
                }}
              </span>
            </span>

            <button
              type="button"
              data-testid="kitchen-sound-toggle"
              (click)="service.toggleSound()"
              class="rb-btn rb-btn-sm rb-btn-outline"
              [attr.aria-pressed]="service.soundEnabled()"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                {{ service.soundEnabled() ? 'volume_up' : 'volume_off' }}
              </span>
              <span>Son : {{ service.soundEnabled() ? 'Activé' : 'Coupé' }}</span>
            </button>

            @if (service.isDirection()) {
              <a routerLink="/restaurant" data-testid="link-back-pos" class="rb-btn rb-btn-outline">
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
                <span>Prise de commande</span>
              </a>
            } @else if (service.isKitchenOnly()) {
              <button
                type="button"
                data-testid="kitchen-logout-btn"
                (click)="logout()"
                class="rb-btn rb-btn-danger-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
                <span>Se déconnecter</span>
              </button>
            }
          </div>
        </header>

        @if (service.kitchenNewOrderNotice(); as notice) {
          <div
            role="status"
            aria-live="assertive"
            data-testid="kitchen-new-order-banner"
            class="flex items-center justify-between gap-3 rounded-xl border border-[#006875] bg-[#e0f2fe] px-4 py-3 text-sm font-extrabold text-[#075985] shadow-sm"
          >
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">notifications_active</span>
              <span>{{ notice }}</span>
            </div>
            <button
              type="button"
              data-testid="kitchen-dismiss-new-order"
              (click)="service.kitchenNewOrderNotice.set(null)"
              class="rb-btn rb-btn-sm rb-btn-outline"
            >
              OK
            </button>
          </div>
        }

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
            data-testid="kitchen-error-banner"
            class="flex items-center justify-between gap-3 rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] px-4 py-3 text-sm font-bold text-[#9b1c1c]"
          >
            <span>{{ err }}</span>
            <button type="button" (click)="service.clearMessages()" class="rb-btn rb-btn-sm rb-btn-danger-outline">
              Fermer
            </button>
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
                        <span class="block text-xl font-extrabold text-[#00545f]" [attr.data-testid]="'kitchen-dest-' + ord.id">
                          {{ displayDestination(ord) }}
                        </span>
                        <span class="block text-xs font-bold text-[#3d494a]">
                          {{ ord.ticketNumber }}
                        </span>
                      </div>
                      <div class="text-right">
                        <span class="block text-xs font-bold text-[#3d494a]">
                          Envoi {{ formatOrderTime(ord.envoyeeAt || ord.createdAt) }}
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

                    <ul class="space-y-2 border-t border-[#d6e2e4] pt-2.5">
                      @for (item of ord.items; track item.id) {
                        <li class="text-base text-[#161d20]">
                          <span class="text-lg font-extrabold text-[#00545f] mr-1.5">{{ item.quantity }}×</span>
                          <span class="font-extrabold">{{ item.name }}</span>
                          @if (item.notes) {
                            <span class="block ml-6 text-xs font-bold text-[#925300]">
                              Note : {{ item.notes }}
                            </span>
                          }
                        </li>
                      }
                    </ul>

                    @if (!service.canReadOnly()) {
                      <div class="space-y-2 border-t border-[#d6e2e4] pt-2.5">
                        <span class="block text-[11px] font-extrabold uppercase tracking-wider text-[#3d494a]">
                          Prendre en charge (temps de préparation)
                        </span>
                        <div class="grid grid-cols-5 gap-1.5">
                          @for (preset of prepPresets; track preset) {
                            <button
                              type="button"
                              [attr.data-testid]="'kitchen-prep-' + preset + '-' + ord.id"
                              [disabled]="!service.isOnline() || service.busyAction()"
                              (click)="takeInCharge(ord, preset)"
                              class="rb-btn rb-btn-sm rb-btn-primary px-1"
                            >
                              {{ preset }} min
                            </button>
                          }
                        </div>
                        <div class="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="180"
                            [attr.data-testid]="'kitchen-prep-custom-input-' + ord.id"
                            [ngModel]="customPrepMinutes(ord.id)"
                            (ngModelChange)="setCustomPrepMinutes(ord.id, $event)"
                            placeholder="Autre (min)"
                            class="min-h-[40px] w-28 rounded-lg border border-[#7c8c8e] bg-white px-2.5 text-xs font-bold text-[#161d20]"
                          />
                          <button
                            type="button"
                            [attr.data-testid]="'kitchen-next-' + ord.id"
                            [disabled]="!service.isOnline() || service.busyAction()"
                            (click)="takeInCharge(ord, customPrepMinutes(ord.id) || 15)"
                            class="rb-btn rb-btn-sm rb-btn-outline flex-1"
                          >
                            Passer en préparation
                          </button>
                        </div>
                      </div>
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
                        <span class="block text-xl font-extrabold text-[#00545f]" [attr.data-testid]="'kitchen-dest-' + ord.id">
                          {{ displayDestination(ord) }}
                        </span>
                        <span class="block text-xs font-bold text-[#3d494a]">
                          {{ ord.ticketNumber }}
                        </span>
                      </div>
                      <div class="text-right">
                        <span class="block text-xs font-bold text-[#3d494a]">
                          Envoi {{ formatOrderTime(ord.envoyeeAt || ord.createdAt) }}
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

                    <div
                      [attr.data-testid]="'kitchen-countdown-' + ord.id"
                      [class]="
                        prepCountdown(ord).isOverdue
                          ? 'rounded-lg border border-[#d97706] bg-[#ffedd5] px-3 py-1.5 text-xs font-extrabold text-[#b45309]'
                          : 'rounded-lg border border-[#f59e0b]/40 bg-[#fef3c7] px-3 py-1.5 text-xs font-extrabold text-[#925300]'
                      "
                    >
                      {{ prepCountdown(ord).label }}
                    </div>

                    <ul class="space-y-2 border-t border-[#d6e2e4] pt-2.5">
                      @for (item of ord.items; track item.id) {
                        <li class="text-base text-[#161d20]">
                          <span class="text-lg font-extrabold text-[#925300] mr-1.5">{{ item.quantity }}×</span>
                          <span class="font-extrabold">{{ item.name }}</span>
                          @if (item.notes) {
                            <span class="block ml-6 text-xs font-bold text-[#925300]">
                              Note : {{ item.notes }}
                            </span>
                          }
                        </li>
                      }
                    </ul>

                    @if (!service.canReadOnly()) {
                      <div class="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          [attr.data-testid]="'kitchen-add5-' + ord.id"
                          [disabled]="!service.isOnline() || service.busyAction()"
                          (click)="addFiveMinutes(ord)"
                          class="rb-btn rb-btn-outline shrink-0"
                        >
                          +5 min
                        </button>
                        <button
                          type="button"
                          [attr.data-testid]="'kitchen-next-' + ord.id"
                          [disabled]="!service.isOnline() || service.busyAction()"
                          (click)="advance(ord, 'READY')"
                          class="rb-btn rb-btn-secondary flex-1"
                        >
                          Marquer prête
                        </button>
                      </div>
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
                        <span class="block text-xl font-extrabold text-[#116b41]" [attr.data-testid]="'kitchen-dest-' + ord.id">
                          {{ displayDestination(ord) }}
                        </span>
                        <span class="block text-xs font-bold text-[#3d494a]">
                          {{ ord.ticketNumber }}
                        </span>
                      </div>
                      <div class="text-right">
                        <span class="block text-xs font-bold text-[#3d494a]">
                          Envoi {{ formatOrderTime(ord.envoyeeAt || ord.createdAt) }}
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

                    <ul class="space-y-2 border-t border-[#d6e2e4] pt-2.5">
                      @for (item of ord.items; track item.id) {
                        <li class="text-base text-[#161d20]">
                          <span class="text-lg font-extrabold text-[#116b41] mr-1.5">{{ item.quantity }}×</span>
                          <span class="font-extrabold">{{ item.name }}</span>
                          @if (item.notes) {
                            <span class="block ml-6 text-xs font-bold text-[#925300]">
                              Note : {{ item.notes }}
                            </span>
                          }
                        </li>
                      }
                    </ul>

                    @if (!service.canReadOnly() && !service.isKitchenOnly()) {
                      <button
                        type="button"
                        [attr.data-testid]="'kitchen-next-' + ord.id"
                        [disabled]="!service.isOnline() || service.busyAction()"
                        (click)="advance(ord, 'SERVED')"
                        class="rb-btn rb-btn-outline w-full"
                      >
                        Marquer servie
                      </button>
                    } @else if (service.isKitchenOnly()) {
                      <div class="rounded-lg bg-[#e3f5ec] px-3 py-2 text-center text-xs font-extrabold text-[#116b41]">
                        Prête • En attente de service en salle
                      </div>
                    }
                  </article>
                }
              }
            </div>
          </section>
        </div>
      </div>
  `,
})
export class KitchenBoardPageComponent implements OnInit, OnDestroy {
  readonly service = inject(RestaurantV3Service);
  private readonly authService = inject(AuthService, { optional: true });
  readonly nowMs = signal<number>(Date.now());
  readonly prepPresets = [10, 15, 20, 30, 45];
  private readonly customPrepByOrder = signal<Record<string, number>>({});

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

    // Mise à jour du chrono d'attente et du compte à rebours toutes les 5 s
    this.clockTimer = setInterval(() => {
      this.nowMs.set(Date.now());
    }, 5_000);
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

  displayDestination(ord: RestaurantOrderV3): string {
    return formatFullRoomDestination(ord.destinationType, ord.roomNumber, ord.destinationLabel);
  }

  waitMinutes(ord: RestaurantOrderV3): number {
    return elapsedMinutesSince(ord.envoyeeAt || ord.createdAt, this.nowMs());
  }

  prepCountdown(ord: RestaurantOrderV3) {
    return computePrepCountdown(ord.heureFinPrevue, this.nowMs());
  }

  customPrepMinutes(orderId: string): number | null {
    return this.customPrepByOrder()[orderId] ?? null;
  }

  setCustomPrepMinutes(orderId: string, val: any): void {
    const num = Number(val);
    this.customPrepByOrder.update((prev) => ({
      ...prev,
      [orderId]: !Number.isNaN(num) && num >= 1 ? Math.min(180, Math.round(num)) : 15,
    }));
  }

  async takeInCharge(ord: RestaurantOrderV3, prepMinutes: number): Promise<void> {
    await this.service.updateOrderStatus(ord.id, 'IN_PREPARATION', {
      prepTimeMinutes: prepMinutes,
    });
  }

  async addFiveMinutes(ord: RestaurantOrderV3): Promise<void> {
    await this.service.updateOrderStatus(ord.id, 'IN_PREPARATION', {
      addMinutes: 5,
    });
  }

  async advance(ord: RestaurantOrderV3, nextStatus: 'IN_PREPARATION' | 'READY' | 'SERVED'): Promise<void> {
    await this.service.updateOrderStatus(ord.id, nextStatus);
  }

  async logout(): Promise<void> {
    await this.authService?.logout();
  }
}
