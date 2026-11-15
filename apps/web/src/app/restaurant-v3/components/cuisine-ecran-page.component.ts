import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RestaurantOrderV3, isKitchenOnlyRole } from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import {
  computePrepCountdown,
  elapsedMinutesSince,
  formatOrderTime,
} from '../models/restaurant-v3.model';
import { RestaurantV3Service } from '../services/restaurant-v3.service';

type CuisineFilter = 'ALL' | 'ROOM' | 'TABLE' | 'TAKEAWAY';
type AcceptSubStep = 'ASK' | 'DURATION' | 'KEYPAD' | 'MISSING';

interface NewOrderBanner {
  orderId: string;
  label: string;
}

const PRESET_DURATIONS = [10, 15, 20, 30, 45] as const;
const UNAVAILABLE_REASONS = ['Plus de stock', 'Cuisson impossible', 'Autre'] as const;

@Component({
  selector: 'app-cuisine-ecran-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes rb-cuisine-flash {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.45;
        }
      }
      .rb-cuisine-new-flash {
        animation: rb-cuisine-flash 0.55s ease-in-out 1;
      }
      @media (prefers-reduced-motion: reduce) {
        .rb-cuisine-new-flash {
          animation: none;
        }
      }
    `,
  ],
  template: `
    <div
      [class]="
        isKitchenOnly()
          ? 'h-[100dvh] w-full overflow-hidden flex flex-col bg-surface text-on-surface select-none'
          : 'h-[calc(100dvh-5rem)] max-md:h-[calc(100dvh-10rem)] w-full overflow-hidden flex flex-col bg-surface text-on-surface select-none md:rounded-2xl md:border md:border-outline-variant/40'
      "
      data-testid="cuisine-ecran-root"
    >
      <!-- 1. Barre du haut (72 px, fond principal) -->
      <header
        class="min-h-[72px] min-[1024px]:h-[72px] shrink-0 bg-primary text-on-primary px-3 lg:px-5 flex flex-wrap min-[1024px]:flex-nowrap items-center justify-between gap-2 max-[1023px]:py-2"
        data-testid="cuisine-topbar"
      >
        <div class="flex items-center gap-2.5 shrink-0">
          <span class="material-symbols-outlined text-[26px]" aria-hidden="true">chef_hat</span>
          <h1 class="text-xl font-bold tracking-tight whitespace-nowrap">Cuisine</h1>
          <span
            class="text-xl font-bold tabular-nums px-2.5 py-1 rounded-xl bg-on-primary/15 whitespace-nowrap"
            data-testid="cuisine-clock"
            aria-label="Heure actuelle"
          >
            {{ currentClock() }}
          </span>
        </div>

        <!-- Filtres par type -->
        <nav class="flex items-center gap-1.5 shrink-0" aria-label="Filtrer les commandes">
          @for (f of filters; track f.id) {
            <button
              type="button"
              (click)="setFilter(f.id)"
              [attr.data-testid]="'cuisine-filter-' + f.id"
              [attr.aria-pressed]="activeFilter() === f.id"
              [class]="
                activeFilter() === f.id
                  ? 'min-h-[44px] px-3 rounded-xl bg-on-primary text-primary font-bold text-sm whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-primary/60'
                  : 'min-h-[44px] px-3 rounded-xl bg-on-primary/15 text-on-primary font-semibold text-sm whitespace-nowrap hover:bg-on-primary/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-primary/60'
              "
            >
              {{ f.label }}
            </button>
          }
        </nav>

        <!-- Compteur, SSE, Son -->
        <div class="flex items-center gap-2 shrink-0">
          <span
            class="px-3 py-1.5 rounded-xl bg-on-primary/15 font-bold text-sm whitespace-nowrap"
            data-testid="cuisine-active-count"
          >
            {{ activeOrdersCount() }}
            {{ activeOrdersCount() > 1 ? 'commandes en cours' : 'commande en cours' }}
          </span>

          @if (restaurant.sseConnected()) {
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-sm whitespace-nowrap"
              data-testid="cuisine-sse-status"
              role="status"
            >
              <span class="w-2 h-2 rounded-full bg-white" aria-hidden="true"></span>
              En direct
            </span>
          } @else {
            <span
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-error text-on-error font-bold text-sm whitespace-nowrap"
              data-testid="cuisine-sse-status"
              role="alert"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">wifi_off</span>
              Connexion perdue, reconnexion...
            </span>
          }

          <button
            type="button"
            (click)="restaurant.toggleSound()"
            [attr.aria-pressed]="restaurant.soundEnabled()"
            data-testid="cuisine-sound-toggle"
            class="min-h-[44px] px-3 rounded-xl bg-on-primary/15 hover:bg-on-primary/25 text-on-primary font-bold text-sm inline-flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-on-primary/60"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">
              {{ restaurant.soundEnabled() ? 'volume_up' : 'volume_off' }}
            </span>
            <span>Son</span>
          </button>
        </div>
      </header>

      <!-- Bandeau nouvelle commande -->
      @if (newOrderBanner(); as banner) {
        <div
          class="shrink-0 bg-secondary-container text-on-secondary-container px-5 py-2.5 flex items-center justify-between gap-4 border-b border-outline-variant/40 rb-cuisine-new-flash"
          role="status"
          aria-live="polite"
          data-testid="cuisine-new-order-banner"
        >
          <div class="flex items-center gap-3 text-xl font-bold">
            <span class="material-symbols-outlined text-[28px]" aria-hidden="true">notifications_active</span>
            <span>Nouvelle commande, {{ banner.label }}</span>
          </div>
          <div class="flex items-center gap-4">
            <button
              type="button"
              (click)="openBannerOrder(banner.orderId)"
              data-testid="cuisine-new-order-view-btn"
              class="min-h-[48px] px-5 rounded-xl bg-primary text-on-primary font-bold text-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
            >
              Voir
            </button>
            <button
              type="button"
              (click)="dismissBanner()"
              aria-label="Fermer l'alerte"
              class="min-h-[48px] min-w-[48px] rounded-xl border border-on-secondary-container/30 font-bold text-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
            >
              ✕
            </button>
          </div>
        </div>
      }

      @if (restaurant.errorMessage(); as err) {
        <div
          class="shrink-0 bg-error-container text-on-error-container px-5 py-2 font-semibold text-base flex items-center justify-between"
          role="alert"
        >
          <span>{{ err }}</span>
        </div>
      }

      <!-- Corps principal : colonne gauche (360 px) + panneau droit -->
      <div class="flex-1 min-h-0 flex max-[900px]:flex-col gap-4 p-4 overflow-hidden">
        <!-- 2. Colonne de gauche (360 px en paysage, sous le panneau droit en portrait) -->
        <aside
          class="min-[1150px]:w-[360px] min-[900px]:w-[280px] shrink-0 max-[900px]:order-2 flex flex-col gap-3 min-h-0 overflow-hidden bg-surface-container-low rounded-2xl p-4 border border-outline-variant/40"
          aria-label="File d'attente des commandes"
          data-testid="cuisine-queue-column"
        >
          <h2 class="text-lg font-bold text-on-surface-variant shrink-0">
            Ensuite, dans l'ordre d'arrivée
          </h2>

          @if (nextOrders().length === 0) {
            <div
              class="flex-1 flex items-center justify-center text-center text-on-surface-variant text-lg font-medium px-2"
              data-testid="cuisine-queue-empty"
            >
              Aucune autre commande en attente
            </div>
          } @else {
            <div class="flex flex-col max-[900px]:grid max-[900px]:grid-cols-2 gap-3 min-h-0 overflow-hidden">
              @for (ord of visibleQueueOrders(); track ord.id) {
                <button
                  type="button"
                  (click)="selectOrder(ord.id)"
                  [attr.data-testid]="'cuisine-queue-card-' + ord.id"
                  [class]="queueCardClasses(ord)"
                >
                  <div class="flex items-center justify-between gap-2 w-full">
                    <span class="inline-flex items-center gap-2 font-bold text-xl truncate">
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">
                        {{ destinationIcon(ord) }}
                      </span>
                      <span class="truncate">{{ destinationLabel(ord) }}</span>
                    </span>
                    <span
                      class="shrink-0 px-2.5 py-1 rounded-full text-sm font-bold bg-surface-container text-on-surface-variant"
                    >
                      il y a {{ waitMinutes(ord) }} min
                    </span>
                  </div>

                  <p class="text-base text-on-surface-variant line-clamp-1 text-left w-full">
                    {{ summarizeDishes(ord) }}
                  </p>

                  <div class="flex items-center justify-between gap-2 w-full">
                    @if (isReadyOrder(ord)) {
                      <span class="inline-flex items-center gap-1.5 text-base font-bold text-emerald-800">
                        <span class="material-symbols-outlined text-[20px]" aria-hidden="true">check_circle</span>
                        Prête · L'assistant va la servir
                      </span>
                    } @else {
                      <span class="text-base font-bold text-primary">
                        {{ statusFullLabel(ord) }}
                      </span>
                    }
                  </div>
                </button>
              }

              @if (overflowQueueCount() > 0) {
                <div
                  class="min-h-[64px] rounded-xl bg-surface-container px-4 py-3 flex items-center justify-center text-lg font-bold text-on-surface-variant border border-outline-variant/50"
                  data-testid="cuisine-queue-overflow"
                >
                  + {{ overflowQueueCount() }}
                  {{ overflowQueueCount() > 1 ? 'autres commandes' : 'autre commande' }}
                </div>
              }
            </div>
          }
        </aside>

        <!-- 3. Panneau de droite : commande en cours de traitement -->
        <section
          class="flex-1 min-w-0 min-h-0 max-[900px]:order-1 bg-surface-container-lowest rounded-2xl p-5 lg:p-6 border border-outline-variant/40 flex flex-col justify-between gap-4 overflow-hidden"
          aria-label="Commande sélectionnée"
          data-testid="cuisine-detail-panel"
        >
          @if (!activeOrder(); as _empty) {
            <!-- État vide -->
            <div
              class="flex-1 flex flex-col items-center justify-center text-center gap-4 px-6"
              data-testid="cuisine-empty-state"
            >
              <span
                class="material-symbols-outlined text-[80px] text-primary"
                aria-hidden="true"
              >
                chef_hat
              </span>
              <h2 class="text-3xl font-bold text-on-surface">
                Aucune commande pour le moment
              </h2>
              <p class="text-xl text-on-surface-variant max-w-lg">
                Les nouvelles commandes apparaissent ici automatiquement
              </p>
            </div>
          } @else {
            @let order = activeOrder()!;

            <!-- En-tête commande + frise 1. Accepter, 2. Préparer, 3. Prête -->
            <div class="shrink-0 flex flex-col gap-3">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="material-symbols-outlined text-[44px] text-primary shrink-0"
                    aria-hidden="true"
                  >
                    {{ destinationIcon(order) }}
                  </span>
                  <h2
                    class="text-[52px] max-[900px]:text-[34px] leading-[1.08] font-bold text-on-surface truncate"
                    data-testid="cuisine-active-destination"
                  >
                    {{ destinationLabel(order) }}
                  </h2>
                </div>

                <span
                  class="px-4 py-2 rounded-full bg-surface-container text-on-surface-variant text-lg font-bold shrink-0"
                  data-testid="cuisine-active-received"
                >
                  Reçue il y a {{ waitMinutes(order) }} min
                </span>
              </div>

              <!-- Frise 1. Accepter, 2. Préparer, 3. Prête -->
              <ol
                class="grid grid-cols-3 gap-3"
                aria-label="Étapes de préparation"
                data-testid="cuisine-active-timeline"
              >
                <li [class]="timelineStepClass(order, 1)">1. Accepter</li>
                <li [class]="timelineStepClass(order, 2)">2. Préparer</li>
                <li [class]="timelineStepClass(order, 3)">3. Prête</li>
              </ol>
            </div>

            <!-- Liste des plats (ou sélection plats indisponibles si acceptStep === 'MISSING') -->
            @if (isAcceptableOrder(order) && acceptStep() === 'MISSING') {
              <div
                class="flex-1 min-h-0 flex flex-col justify-between gap-3 overflow-hidden"
                data-testid="cuisine-missing-panel"
              >
                <div class="flex flex-col gap-2 min-h-0 overflow-hidden">
                  <p class="text-xl font-bold text-error">
                    Cochez le ou les plats indisponibles :
                  </p>
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-2.5 overflow-hidden">
                    @for (line of order.items; track line.id) {
                      <button
                        type="button"
                        (click)="toggleMissingLine(line.id)"
                        [attr.data-testid]="'cuisine-missing-line-' + line.id"
                        [attr.aria-pressed]="missingLineIds().includes(line.id)"
                        [class]="
                          missingLineIds().includes(line.id)
                            ? 'min-h-[64px] px-4 py-3 rounded-xl border-2 border-error bg-error-container text-on-error-container flex items-center gap-3 text-left font-bold text-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/40'
                            : 'min-h-[64px] px-4 py-3 rounded-xl border-2 border-outline-variant bg-surface-container-low text-on-surface flex items-center gap-3 text-left font-semibold text-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40'
                        "
                      >
                        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">
                          {{
                            missingLineIds().includes(line.id)
                              ? 'check_box'
                              : 'check_box_outline_blank'
                          }}
                        </span>
                        <span class="truncate">{{ line.quantity }}× {{ line.name }}</span>
                      </button>
                    }
                  </div>
                </div>

                <div class="shrink-0 flex flex-col gap-3">
                  <div class="flex flex-wrap items-center gap-4">
                    @for (reason of unavailableReasons; track reason) {
                      <button
                        type="button"
                        (click)="selectMissingReason(reason)"
                        [attr.data-testid]="'cuisine-missing-reason-' + reason"
                        [attr.aria-pressed]="missingReasonPreset() === reason"
                        [class]="
                          missingReasonPreset() === reason
                            ? 'min-h-[64px] px-5 rounded-xl bg-primary text-on-primary font-bold text-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50'
                            : 'min-h-[64px] px-5 rounded-xl bg-surface-container text-on-surface font-semibold text-xl border border-outline-variant focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50'
                        "
                      >
                        {{ reason }}
                      </button>
                    }

                    @if (missingReasonPreset() === 'Autre') {
                      <input
                        type="text"
                        [(ngModel)]="missingReasonCustom"
                        placeholder="Précisez le motif..."
                        data-testid="cuisine-missing-custom-input"
                        class="min-h-[64px] flex-1 min-w-[200px] px-4 rounded-xl border-2 border-outline bg-surface text-on-surface text-xl font-medium"
                      />
                    }
                  </div>

                  <div class="flex items-center gap-4">
                    <button
                      type="button"
                      (click)="cancelAcceptSubStep()"
                      data-testid="cuisine-missing-cancel"
                      class="min-h-[64px] px-6 rounded-xl border-2 border-outline text-on-surface font-bold text-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                    >
                      Retour
                    </button>
                    <button
                      type="button"
                      [disabled]="missingLineIds().length === 0 || restaurant.busyAction()"
                      (click)="submitMissingDishes(order)"
                      data-testid="cuisine-missing-submit"
                      class="flex-1 min-h-[64px] px-6 rounded-xl bg-error text-on-error font-bold text-2xl disabled:opacity-45 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/50"
                    >
                      Prévenir l'assistant
                    </button>
                  </div>
                </div>
              </div>
            } @else {
              <!-- Liste des plats normale (taille dynamique >= 24px si > 6 lignes, zéro défilement) -->
              <ul
                class="flex-1 min-h-0 flex flex-col justify-center gap-2.5 overflow-hidden"
                data-testid="cuisine-active-dishes"
              >
                @for (line of order.items; track line.id) {
                  <li
                    class="flex items-center gap-4 min-w-0"
                    [attr.data-testid]="'cuisine-active-line-' + line.id"
                  >
                    <span
                      class="w-12 h-12 rounded-full bg-primary text-on-primary text-2xl font-bold flex items-center justify-center shrink-0"
                    >
                      {{ line.quantity }}
                    </span>
                    <div class="flex flex-wrap items-center gap-2.5 min-w-0">
                      <span
                        [style.fontSize.px]="dishFontSizePx(order.items.length)"
                        [class]="
                          line.isUnavailable
                            ? 'font-bold leading-tight line-through text-error'
                            : 'font-bold leading-tight text-on-surface'
                        "
                      >
                        {{ line.name }}
                      </span>
                      @if (line.notes) {
                        <span
                          class="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-lg font-bold"
                        >
                          {{ line.notes }}
                        </span>
                      }
                      @if (line.isUnavailable) {
                        <span
                          class="px-3 py-1 rounded-full bg-error-container text-on-error-container text-lg font-bold"
                        >
                          Indisponible
                        </span>
                      }
                    </div>
                  </li>
                }
              </ul>

              <!-- Actions selon les 3 états -->
              <div class="shrink-0 flex flex-col gap-3">
                @if (isAcceptableOrder(order)) {
                  @if (acceptStep() === 'ASK') {
                    <p class="text-2xl font-bold text-on-surface">
                      Avez-vous tous les plats ?
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        (click)="acceptStep.set('DURATION')"
                        data-testid="cuisine-btn-all-available"
                        class="h-[84px] rounded-2xl bg-primary text-on-primary font-bold text-[26px] inline-flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                      >
                        <span class="material-symbols-outlined text-[32px]" aria-hidden="true">
                          check_circle
                        </span>
                        Oui, tout est là
                      </button>
                      <button
                        type="button"
                        (click)="openMissingPanel()"
                        data-testid="cuisine-btn-missing-dish"
                        class="h-[84px] rounded-2xl border-2 border-error text-error bg-surface-container-lowest font-bold text-[26px] inline-flex items-center justify-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-error/40"
                      >
                        <span class="material-symbols-outlined text-[32px]" aria-hidden="true">
                          error_outline
                        </span>
                        Il manque un plat
                      </button>
                    </div>
                  } @else if (acceptStep() === 'DURATION') {
                    <div class="flex items-center justify-between gap-4">
                      <p class="text-2xl font-bold text-on-surface">
                        Prête dans combien de temps ?
                      </p>
                      <button
                        type="button"
                        (click)="acceptStep.set('ASK')"
                        data-testid="cuisine-duration-back"
                        class="min-h-[64px] px-5 rounded-xl border border-outline text-on-surface font-bold text-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                      >
                        Retour
                      </button>
                    </div>
                    <div class="grid grid-cols-3 lg:grid-cols-6 gap-4">
                      @for (m of presetDurations; track m) {
                        <button
                          type="button"
                          [disabled]="restaurant.busyAction()"
                          (click)="startPreparation(order.id, m)"
                          [attr.data-testid]="'cuisine-prep-' + m"
                          class="h-[72px] rounded-2xl bg-primary text-on-primary font-bold text-[26px] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                        >
                          {{ m }} min
                        </button>
                      }
                      <button
                        type="button"
                        (click)="openKeypad()"
                        data-testid="cuisine-prep-other"
                        class="h-[72px] rounded-2xl border-2 border-primary text-primary bg-surface-container-lowest font-bold text-[26px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                      >
                        Autre
                      </button>
                    </div>
                  } @else if (acceptStep() === 'KEYPAD') {
                    <div
                      class="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/50 flex flex-col gap-3"
                      data-testid="cuisine-keypad"
                    >
                      <div class="flex items-center justify-between gap-4">
                        <span class="text-2xl font-bold text-on-surface">
                          Durée personnalisée :
                          <span class="text-primary tabular-nums">
                            {{ keypadValue() || '0' }} min
                          </span>
                        </span>
                        <button
                          type="button"
                          (click)="acceptStep.set('DURATION')"
                          class="min-h-[64px] px-5 rounded-xl border border-outline font-bold text-xl"
                        >
                          Retour
                        </button>
                      </div>
                      <div class="grid grid-cols-6 gap-3">
                        @for (digit of keypadDigits; track digit) {
                          <button
                            type="button"
                            (click)="appendKeypadDigit(digit)"
                            [attr.data-testid]="'cuisine-key-' + digit"
                            class="min-h-[64px] rounded-xl bg-surface-container-lowest border border-outline-variant text-2xl font-bold text-on-surface focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                          >
                            {{ digit }}
                          </button>
                        }
                        <button
                          type="button"
                          (click)="clearKeypad()"
                          data-testid="cuisine-key-clear"
                          class="min-h-[64px] rounded-xl bg-surface-container text-xl font-bold text-on-surface-variant"
                        >
                          Effacer
                        </button>
                        <button
                          type="button"
                          [disabled]="keypadMinutes() < 1 || restaurant.busyAction()"
                          (click)="startPreparation(order.id, keypadMinutes())"
                          data-testid="cuisine-key-confirm"
                          class="min-h-[64px] rounded-xl bg-primary text-on-primary text-xl font-bold disabled:opacity-45"
                        >
                          Valider
                        </button>
                      </div>
                    </div>
                  }
                } @else if (isInPreparationOrder(order)) {
                  @let countdown = orderCountdown(order);
                  <div class="flex flex-wrap items-center justify-between gap-4">
                    <!-- Compte à rebours circulaire -->
                    <div class="flex items-center gap-4" data-testid="cuisine-countdown-box">
                      <div class="relative w-20 h-20 shrink-0 flex items-center justify-center">
                        <svg class="w-20 h-20 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                          <circle
                            cx="40"
                            cy="40"
                            r="34"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="7"
                            class="text-surface-container-high"
                          />
                          <circle
                            cx="40"
                            cy="40"
                            r="34"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="7"
                            stroke-linecap="round"
                            [attr.stroke-dasharray]="213.6"
                            [attr.stroke-dashoffset]="countdownDashOffset(order)"
                            [class]="countdown.isOverdue ? 'text-error' : 'text-primary'"
                          />
                        </svg>
                        <span
                          [class]="
                            countdown.isOverdue
                              ? 'absolute text-xl font-bold text-error tabular-nums'
                              : 'absolute text-xl font-bold text-primary tabular-nums'
                          "
                        >
                          {{ countdown.isOverdue ? '+' + countdown.minutesLate : countdown.minutesRemaining }}m
                        </span>
                      </div>

                      <div>
                        @if (countdown.isOverdue) {
                          <p
                            class="text-2xl font-bold text-error inline-flex items-center gap-2"
                            data-testid="cuisine-overdue-label"
                          >
                            <span class="material-symbols-outlined text-[28px]" aria-hidden="true">
                              warning
                            </span>
                            En retard de {{ countdown.minutesLate }} min
                          </p>
                        } @else {
                          <p class="text-2xl font-bold text-on-surface" data-testid="cuisine-remaining-label">
                            {{ countdown.minutesRemaining }} min restantes, prête vers
                            {{ formatReadyTime(order.heureFinPrevue) }}
                          </p>
                        }
                      </div>
                    </div>

                    <div class="flex items-center gap-4">
                      <button
                        type="button"
                        [disabled]="restaurant.busyAction()"
                        (click)="addFiveMinutes(order.id)"
                        data-testid="cuisine-btn-plus-5"
                        class="min-h-[72px] px-6 rounded-2xl border-2 border-primary text-primary bg-surface-container-lowest font-bold text-[26px] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                      >
                        +5 min
                      </button>
                      <button
                        type="button"
                        [disabled]="restaurant.busyAction()"
                        (click)="markReady(order.id)"
                        data-testid="cuisine-btn-mark-ready"
                        class="min-h-[72px] px-8 rounded-2xl bg-emerald-600 text-white font-bold text-[26px] inline-flex items-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-600/50"
                      >
                        <span class="material-symbols-outlined text-[30px]" aria-hidden="true">
                          check_circle
                        </span>
                        Marquer prête
                      </button>
                    </div>
                  </div>
                } @else if (isReadyOrder(order)) {
                  <div
                    class="rounded-2xl bg-emerald-50 border-2 border-emerald-500 p-4 flex flex-wrap items-center justify-between gap-4"
                    data-testid="cuisine-ready-banner"
                  >
                    <div class="flex items-center gap-3 text-emerald-950">
                      <span class="material-symbols-outlined text-[36px] text-emerald-700" aria-hidden="true">
                        check_circle
                      </span>
                      <div>
                        <p class="text-2xl font-bold">Prête, en attente de service</p>
                        <p class="text-lg font-semibold text-emerald-800">
                          prête depuis {{ readyElapsedMinutes(order) }} min · {{ readyDeliveryText(order) }}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      (click)="goToNextOrder(order.id)"
                      data-testid="cuisine-btn-next-order"
                      class="min-h-[72px] px-7 rounded-2xl bg-primary text-on-primary font-bold text-[26px] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50"
                    >
                      Commande suivante
                    </button>
                  </div>
                }
              </div>
            }
          }
        </section>
      </div>
    </div>
  `,
})
export class CuisineEcranPageComponent implements OnInit, OnDestroy {
  readonly restaurant = inject(RestaurantV3Service);
  private readonly auth = inject(AuthService);

  readonly filters: ReadonlyArray<{ id: CuisineFilter; label: string }> = [
    { id: 'ALL', label: 'Tout' },
    { id: 'ROOM', label: 'Chambres' },
    { id: 'TABLE', label: 'Sur place' },
    { id: 'TAKEAWAY', label: 'À emporter' },
  ];
  readonly presetDurations = PRESET_DURATIONS;
  readonly unavailableReasons = UNAVAILABLE_REASONS;
  readonly keypadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

  readonly isKitchenOnly = computed(() => isKitchenOnlyRole(this.auth.currentRole()));
  readonly activeFilter = signal<CuisineFilter>('ALL');
  readonly selectedOrderId = signal<string | null>(null);
  readonly acceptStep = signal<AcceptSubStep>('ASK');
  readonly keypadValue = signal<string>('');
  readonly missingLineIds = signal<string[]>([]);
  readonly missingReasonPreset = signal<string>('Plus de stock');
  missingReasonCustom = '';
  readonly newOrderBanner = signal<NewOrderBanner | null>(null);
  readonly nowTick = signal<number>(Date.now());

  private readonly knownOrderIds = new Set<string>();
  private initializedKnownOrders = false;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private pollFallbackTimer: ReturnType<typeof setInterval> | null = null;

  readonly currentClock = computed(() => {
    const d = new Date(this.nowTick());
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  });

  readonly activeOrdersCount = computed(() => this.restaurant.kitchenOrders().length);

  readonly filteredOrders = computed(() => {
    const filter = this.activeFilter();
    const list = [...this.restaurant.kitchenOrders()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    if (filter === 'ALL') return list;
    return list.filter((o) => o.destinationType === filter);
  });

  readonly activeOrder = computed<RestaurantOrderV3 | null>(() => {
    const list = this.filteredOrders();
    if (list.length === 0) return null;
    const selectedId = this.selectedOrderId();
    if (selectedId) {
      const match = list.find((o) => o.id === selectedId);
      if (match) return match;
    }
    return (
      list.find((o) => this.isAcceptableOrder(o)) ??
      list.find((o) => this.isInPreparationOrder(o)) ??
      list[0]
    );
  });

  readonly nextOrders = computed(() => {
    const activeId = this.activeOrder()?.id ?? null;
    return this.filteredOrders().filter((o) => o.id !== activeId);
  });

  readonly visibleQueueOrders = computed(() => this.nextOrders().slice(0, 3));
  readonly overflowQueueCount = computed(() => Math.max(0, this.nextOrders().length - 3));

  readonly keypadMinutes = computed(() => {
    const n = Number(this.keypadValue());
    return Number.isFinite(n) && n >= 1 && n <= 180 ? n : 0;
  });

  constructor() {
    effect(
      () => {
        const orders = this.restaurant.kitchenOrders();
        if (!this.initializedKnownOrders) {
          if (orders.length > 0) {
            orders.forEach((o) => this.knownOrderIds.add(o.id));
            this.initializedKnownOrders = true;
          }
          return;
        }
        for (const o of orders) {
          if (!this.knownOrderIds.has(o.id)) {
            this.knownOrderIds.add(o.id);
            this.newOrderBanner.set({
              orderId: o.id,
              label: this.destinationLabel(o),
            });
          }
        }
      },
      { allowSignalWrites: true },
    );
  }

  async ngOnInit(): Promise<void> {
    await this.restaurant.loadKitchenOrders();
    this.restaurant.kitchenOrders().forEach((o) => this.knownOrderIds.add(o.id));
    this.initializedKnownOrders = true;

    this.restaurant.connectKitchenStream((evt) => {
      if (evt?.order && !this.knownOrderIds.has(evt.order.id)) {
        this.knownOrderIds.add(evt.order.id);
        this.newOrderBanner.set({
          orderId: evt.order.id,
          label: this.destinationLabel(evt.order),
        });
      }
    });

    this.clockTimer = setInterval(() => this.nowTick.set(Date.now()), 5_000);
    // Secours par actualisation toutes les 10 s (si SSE coupé ou en attente)
    this.pollFallbackTimer = setInterval(() => {
      if (!this.restaurant.sseConnected()) {
        void this.restaurant.loadKitchenOrders();
      }
    }, 10_000);
  }

  ngOnDestroy(): void {
    this.restaurant.disconnectKitchenStream();
    if (this.clockTimer) clearInterval(this.clockTimer);
    if (this.pollFallbackTimer) clearInterval(this.pollFallbackTimer);
  }

  setFilter(filter: CuisineFilter): void {
    this.activeFilter.set(filter);
    this.acceptStep.set('ASK');
  }

  selectOrder(orderId: string): void {
    this.selectedOrderId.set(orderId);
    this.acceptStep.set('ASK');
    this.keypadValue.set('');
    this.missingLineIds.set([]);
  }

  openBannerOrder(orderId: string): void {
    this.activeFilter.set('ALL');
    this.selectOrder(orderId);
    this.newOrderBanner.set(null);
  }

  dismissBanner(): void {
    this.newOrderBanner.set(null);
  }

  isAcceptableOrder(order: RestaurantOrderV3): boolean {
    return (
      order.status === 'PENDING' ||
      order.status === 'SENT_TO_KITCHEN' ||
      order.status === 'CONFIRMED'
    );
  }

  isInPreparationOrder(order: RestaurantOrderV3): boolean {
    return order.status === 'IN_PREPARATION';
  }

  isReadyOrder(order: RestaurantOrderV3): boolean {
    return order.status === 'READY' || order.status === 'AUTHORIZED';
  }

  statusFullLabel(order: RestaurantOrderV3): string {
    if (this.isReadyOrder(order)) return 'Prête';
    if (this.isInPreparationOrder(order)) return 'En préparation';
    return 'À accepter';
  }

  destinationIcon(order: RestaurantOrderV3): string {
    if (order.destinationType === 'ROOM') return 'bed';
    if (order.destinationType === 'TABLE') return 'restaurant';
    return 'shopping_bag';
  }

  destinationLabel(order: RestaurantOrderV3): string {
    if (order.destinationType === 'ROOM') {
      return order.roomNumber ? `Chambre ${order.roomNumber}` : order.destinationLabel;
    }
    if (order.destinationType === 'TABLE') {
      return order.tableLabel || order.destinationLabel;
    }
    return `À emporter N° ${order.ticketNumber}`;
  }

  waitMinutes(order: RestaurantOrderV3): number {
    return elapsedMinutesSince(order.createdAt, this.nowTick());
  }

  readyElapsedMinutes(order: RestaurantOrderV3): number {
    return elapsedMinutesSince(order.preteAt ?? order.readyAt ?? order.updatedAt, this.nowTick());
  }

  readyDeliveryText(order: RestaurantOrderV3): string {
    if (order.destinationType === 'ROOM') return 'à porter à la chambre';
    if (order.destinationType === 'TABLE') {
      const table = order.tableLabel || order.destinationLabel;
      return `à servir à la ${table}`;
    }
    return `à remettre au client (N° ${order.ticketNumber})`;
  }

  summarizeDishes(order: RestaurantOrderV3): string {
    return order.items.map((l) => `${l.quantity}× ${l.name}`).join(', ');
  }

  dishFontSizePx(lineCount: number): number {
    if (lineCount <= 6) return 34;
    if (lineCount <= 8) return 28;
    return 24;
  }

  timelineStepClass(order: RestaurantOrderV3, step: 1 | 2 | 3): string {
    const current = this.isReadyOrder(order) ? 3 : this.isInPreparationOrder(order) ? 2 : 1;
    const base =
      'min-h-[44px] px-3 py-2 rounded-xl text-center text-lg font-bold flex items-center justify-center ';
    if (step === current) {
      if (step === 3) return base + 'bg-emerald-600 text-white';
      return base + 'bg-primary text-on-primary';
    }
    if (step < current) {
      return base + 'bg-emerald-100 text-emerald-900 border border-emerald-400';
    }
    return base + 'bg-surface-container text-on-surface-variant';
  }

  queueCardClasses(order: RestaurantOrderV3): string {
    const base =
      'min-h-[64px] w-full rounded-xl p-3.5 border-2 flex flex-col gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50 ';
    if (this.isReadyOrder(order)) {
      return base + 'bg-emerald-50 border-emerald-500 text-emerald-950 hover:bg-emerald-100/80';
    }
    return (
      base +
      'bg-surface-container-lowest border-outline-variant/60 text-on-surface hover:border-primary'
    );
  }

  openMissingPanel(): void {
    this.missingLineIds.set([]);
    this.missingReasonPreset.set('Plus de stock');
    this.missingReasonCustom = '';
    this.acceptStep.set('MISSING');
  }

  cancelAcceptSubStep(): void {
    this.acceptStep.set('ASK');
  }

  toggleMissingLine(lineId: string): void {
    const cur = this.missingLineIds();
    this.missingLineIds.set(
      cur.includes(lineId) ? cur.filter((id) => id !== lineId) : [...cur, lineId],
    );
  }

  selectMissingReason(reason: string): void {
    this.missingReasonPreset.set(reason);
  }

  openKeypad(): void {
    this.keypadValue.set('');
    this.acceptStep.set('KEYPAD');
  }

  appendKeypadDigit(digit: string): void {
    const next = (this.keypadValue() + digit).slice(0, 3);
    this.keypadValue.set(next);
  }

  clearKeypad(): void {
    this.keypadValue.set('');
  }

  async startPreparation(orderId: string, minutes: number): Promise<void> {
    if (minutes < 1) return;
    this.selectedOrderId.set(orderId);
    const ok = await this.restaurant.updateOrderStatus(orderId, 'IN_PREPARATION', {
      prepTimeMinutes: minutes,
    });
    if (ok) {
      this.acceptStep.set('ASK');
      this.keypadValue.set('');
    }
  }

  async submitMissingDishes(order: RestaurantOrderV3): Promise<void> {
    const lineIds = this.missingLineIds();
    if (lineIds.length === 0) return;
    const reason =
      this.missingReasonPreset() === 'Autre'
        ? this.missingReasonCustom.trim() || 'Autre'
        : this.missingReasonPreset();
    const ok = await this.restaurant.updateOrderStatus(order.id, undefined, {
      unavailableLineIds: lineIds,
      unavailableReason: reason,
    });
    if (ok) {
      this.acceptStep.set('ASK');
      this.missingLineIds.set([]);
    }
  }

  async addFiveMinutes(orderId: string): Promise<void> {
    await this.restaurant.updateOrderStatus(orderId, undefined, { addMinutes: 5 });
  }

  async markReady(orderId: string): Promise<void> {
    this.selectedOrderId.set(orderId);
    await this.restaurant.updateOrderStatus(orderId, 'READY');
  }

  goToNextOrder(currentOrderId: string): void {
    const next = this.filteredOrders().find((o) => o.id !== currentOrderId);
    this.selectedOrderId.set(next ? next.id : null);
    this.acceptStep.set('ASK');
  }

  orderCountdown(order: RestaurantOrderV3) {
    return computePrepCountdown(order.heureFinPrevue, this.nowTick());
  }

  formatReadyTime(iso: string | null | undefined): string {
    return iso ? formatOrderTime(iso) : '--:--';
  }

  countdownDashOffset(order: RestaurantOrderV3): number {
    const total = Math.max(1, order.tempsPreparationMinutes ?? 15);
    const cd = this.orderCountdown(order);
    if (cd.isOverdue) return 0;
    const ratio = Math.max(0, Math.min(1, cd.minutesRemaining / total));
    return 213.6 * (1 - ratio);
  }
}
