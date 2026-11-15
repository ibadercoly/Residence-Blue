import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  DishItem,
  RestaurantDestinationType,
  RestaurantOrderV3,
} from '@residence-blue/shared';
import {
  RESTAURANT_DEFAULT_PLATE_SVG_URI,
  RESTAURANT_PAYMENT_METHODS,
  RESTAURANT_SCROLL_STYLES,
  TicketDraftLine,
  computePrepCountdown,
  destinationLabel,
  formatFcfa,
  formatFullRoomDestination,
  formatOrderTime,
  hasPotentialCardPan,
  orderStatusBadgeClass,
  orderStatusLabel,
} from '../models/restaurant-v3.model';
import {
  CreateOrderRequestPayload,
  RestaurantV3Service,
} from '../services/restaurant-v3.service';

@Component({
  selector: 'app-restaurant-pos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [RESTAURANT_SCROLL_STYLES],
  template: `
      <div class="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 space-y-5" data-testid="restaurant-pos-page">
        <!-- En-tête simple sans menu caché -->
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-[#006875]">
              Restaurant &amp; Bar • La Teranga
            </p>
            <h1 class="rb-serif text-2xl sm:text-3xl font-bold text-[#161d20] leading-tight">
              Prise de commande
            </h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            @if (service.pendingOfflineOrders().length > 0) {
              <span
                data-testid="pos-offline-pending-badge"
                class="inline-flex items-center gap-1.5 rounded-full border border-[#925300]/40 bg-[#fef3c7] px-3 py-1.5 text-xs font-bold text-[#925300]"
              >
                En attente de synchronisation ({{ service.pendingOfflineOrders().length }})
              </span>
            }
            @if (!service.isOnline()) {
              <span
                data-testid="pos-offline-banner"
                class="inline-flex items-center gap-1.5 rounded-full border border-[#b81d1d]/35 bg-[#fde8e8] px-3 py-1.5 text-xs font-bold text-[#9b1c1c]"
              >
                Mode hors ligne actif
              </span>
            }
            <button
              type="button"
              data-testid="pos-sound-toggle"
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
              <a
                routerLink="/cuisine"
                data-testid="link-kitchen"
                class="rb-btn rb-btn-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">soup_kitchen</span>
                <span>Cuisine</span>
              </a>
              <a
                routerLink="/restaurant/carte"
                data-testid="link-carte"
                class="rb-btn rb-btn-secondary"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">menu_book</span>
                <span>Carte</span>
              </a>
            }
          </div>
        </header>

        <!-- Messages statut -->
        @if (service.errorMessage(); as err) {
          <div
            role="alert"
            data-testid="pos-error-banner"
            class="flex items-center justify-between gap-3 rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] px-4 py-3 text-sm font-bold text-[#9b1c1c]"
          >
            <span>{{ err }}</span>
            <button type="button" (click)="service.clearMessages()" class="rb-btn rb-btn-sm rb-btn-danger-outline">
              Fermer
            </button>
          </div>
        }
        @if (service.successMessage(); as ok) {
          <div
            role="status"
            data-testid="pos-success-banner"
            class="flex items-center justify-between gap-3 rounded-xl border border-[#116b41]/35 bg-[#e3f5ec] px-4 py-3 text-base font-bold text-[#116b41]"
          >
            <span>{{ ok }}</span>
            <button type="button" (click)="service.clearMessages()" class="rb-btn rb-btn-sm rb-btn-outline">
              OK
            </button>
          </div>
        }

        <!-- 4. BANDEAUX DE NOTIFICATIONS ASSISTANT (persistants jusqu'au clic « Compris ») -->
        @if (service.assistantNotifications().length > 0) {
          <section
            aria-label="Notifications de la cuisine"
            data-testid="pos-assistant-notifications"
            class="space-y-2.5"
          >
            @for (notif of service.assistantNotifications(); track notif.id) {
              <div
                role="alert"
                [attr.data-testid]="'pos-notif-banner-' + notif.id"
                [attr.data-notif-type]="notif.type"
                [attr.data-order-id]="notif.orderId"
                [class]="
                  notif.type === 'PRETE'
                    ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#116b41] bg-[#e3f5ec] px-4 py-3 text-base font-extrabold text-[#116b41] shadow-sm'
                    : notif.type === 'PLAT_INDISPONIBLE'
                      ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#b81d1d] bg-[#fde8e8] px-4 py-3 text-base font-extrabold text-[#9b1c1c] shadow-sm'
                      : 'flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#006875] bg-[#e0f2fe] px-4 py-3 text-base font-extrabold text-[#075985] shadow-sm'
                "
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="material-symbols-outlined text-[22px] shrink-0" aria-hidden="true">
                    {{
                      notif.type === 'PRETE'
                        ? 'room_service'
                        : notif.type === 'PLAT_INDISPONIBLE'
                          ? 'warning'
                          : 'notifications_active'
                    }}
                  </span>
                  <span class="break-words">{{ notif.message }}</span>
                </div>
                <button
                  type="button"
                  [attr.data-testid]="'btn-notif-understood-' + notif.id"
                  (click)="service.dismissAssistantNotification(notif.id)"
                  class="rb-btn rb-btn-sm rb-btn-primary shrink-0"
                >
                  Compris
                </button>
              </div>
            }
          </section>
        }

        <!-- Barre supérieure : pastilles de catégories qui passent à la ligne + recherche -->
        <section
          aria-label="Catégories et recherche"
          class="rounded-2xl border border-[#d6e2e4] bg-white p-3 sm:p-4 space-y-3"
        >
          <div class="flex flex-wrap items-center gap-2" data-testid="pos-categories-bar">
            <button
              type="button"
              data-testid="cat-pill-ALL"
              (click)="selectedCategoryId.set('ALL')"
              class="rb-btn rb-btn-sm"
              [class.rb-btn-primary]="selectedCategoryId() === 'ALL'"
              [class.rb-btn-outline]="selectedCategoryId() !== 'ALL'"
            >
              Toutes ({{ availableProductCount() }})
            </button>
            @for (cat of visibleCategories(); track cat.id) {
              <button
                type="button"
                [attr.data-testid]="'cat-pill-' + cat.id"
                (click)="selectedCategoryId.set(cat.id)"
                class="rb-btn rb-btn-sm"
                [class.rb-btn-primary]="selectedCategoryId() === cat.id"
                [class.rb-btn-outline]="selectedCategoryId() !== cat.id"
              >
                {{ cat.name }}
              </button>
            }
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <label for="pos-product-search" class="sr-only">Rechercher un produit</label>
            <input
              id="pos-product-search"
              data-testid="pos-search-input"
              type="search"
              [ngModel]="productSearch()"
              (ngModelChange)="productSearch.set($event)"
              placeholder="Rechercher un plat, une boisson..."
              class="min-h-[44px] w-full sm:max-w-md rounded-xl border border-[#7c8c8e] bg-white px-3.5 text-sm font-medium text-[#161d20]"
            />
          </div>
        </section>

        <!-- Disposition principale : Zone gauche (8/12) + Zone droite (4/12 fixe) -->
        <div class="grid grid-cols-1 gap-5 lg:grid-cols-12 items-start">
          <!-- ZONE GAUCHE (8/12) : Grille de cartes produits avec miniatures 200 px, scroll vertical interne -->
          <section
            aria-label="Produits de la carte"
            class="lg:col-span-8 min-w-0 rounded-2xl border border-[#d6e2e4] bg-white p-3 sm:p-4"
          >
            <div class="flex items-center justify-between gap-2 mb-3">
              <h2 class="rb-serif text-lg font-bold text-[#161d20]">
                Carte du service
              </h2>
              <span class="text-xs font-bold text-[#3d494a]">
                {{ filteredProducts().length }} produit(s)
              </span>
            </div>

            <div
              data-testid="pos-products-scroll"
              class="rb-scroll-box max-h-[540px] pr-1"
            >
              @if (service.loadingCatalog() && filteredProducts().length === 0) {
                <div class="rb-pos-products-grid">
                  @for (s of [1, 2, 3, 4, 5, 6]; track s) {
                    <div class="h-64 animate-pulse rounded-xl border border-[#d6e2e4] bg-[#f0f5f6]"></div>
                  }
                </div>
              } @else if (filteredProducts().length === 0) {
                <div class="rounded-xl border border-dashed border-[#c2d2d4] p-6 text-center text-sm font-medium text-[#3d494a]">
                  Aucun produit disponible ne correspond à cette sélection.
                </div>
              } @else {
                <div class="rb-pos-products-grid" data-testid="pos-products-grid">
                  @for (prod of filteredProducts(); track prod.id) {
                    <article
                      [attr.data-testid]="'product-tile-' + prod.id"
                      [attr.data-product-name]="prod.name"
                      [attr.aria-label]="'Ajouter ' + prod.name"
                      [attr.aria-disabled]="isProductDisabled(prod) ? 'true' : null"
                      [attr.tabindex]="isProductDisabled(prod) ? -1 : 0"
                      (click)="addProductToTicket(prod)"
                      (keydown.enter)="onProductCardKeydown($event, prod)"
                      (keydown.space)="onProductCardKeydown($event, prod)"
                      [class]="prod.status === 'SOLD_OUT'
                        ? 'flex flex-col overflow-hidden rounded-xl border border-[#d6e2e4] bg-[#f1f5f6] text-left text-[#4f6264] cursor-not-allowed min-w-0'
                        : 'flex flex-col overflow-hidden rounded-xl border border-[#c2d2d4] bg-white text-left hover:border-[#006875] hover:bg-[#f2f8f9] transition-colors cursor-pointer min-w-0'"
                    >
                      <div class="relative w-full aspect-[4/3] overflow-hidden rounded-t-xl bg-[#eef4f5] shrink-0">
                        <img
                          [src]="resolveProductImageSrc(prod)"
                          [alt]="prod.name"
                          loading="lazy"
                          width="200"
                          height="150"
                          (error)="onProductImageError(prod.id)"
                          [attr.data-default-image]="isDefaultProductImage(prod) ? 'true' : 'false'"
                          class="h-full w-full object-cover"
                          [class.grayscale]="prod.status === 'SOLD_OUT'"
                          [class.opacity-75]="prod.status === 'SOLD_OUT'"
                        />
                        @if (prod.status === 'SOLD_OUT') {
                          <span
                            data-testid="product-sold-out-badge"
                            class="absolute top-2 right-2 rounded-full bg-[#161d20]/90 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm"
                          >
                            Épuisé
                          </span>
                        }
                      </div>

                      <div class="flex flex-1 flex-col justify-between gap-2.5 p-3 min-w-0">
                        <div class="space-y-1 min-w-0">
                          <span class="block text-[11px] font-bold uppercase tracking-wide text-[#3d494a] break-words">
                            {{ prod.categoryName }}
                          </span>
                          <h3 class="text-sm font-extrabold text-[#161d20] leading-snug whitespace-normal break-words">
                            {{ prod.name }}
                          </h3>
                        </div>

                        <div class="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
                          <span class="text-sm font-extrabold text-[#00545f] whitespace-nowrap">
                            {{ formatFcfa(prod.priceFcfa) }}
                          </span>
                          <button
                            type="button"
                            [attr.data-testid]="'btn-add-product-' + prod.id"
                            [disabled]="isProductDisabled(prod)"
                            (click)="$event.stopPropagation(); addProductToTicket(prod)"
                            class="rb-btn rb-btn-sm shrink-0"
                            [class.rb-btn-outline]="prod.status !== 'SOLD_OUT'"
                            [class.rb-btn-muted]="prod.status === 'SOLD_OUT'"
                          >
                            + Ajouter
                          </button>
                        </div>
                      </div>
                    </article>
                  }
                </div>
              }
            </div>
          </section>

          <!-- ZONE DROITE (4/12, fixe desktop) : Ticket en cours -->
          <aside
            id="ticket-section"
            data-testid="pos-ticket-panel"
            aria-label="Ticket en cours"
            class="lg:col-span-4 min-w-0 lg:sticky lg:top-24 rounded-2xl border border-[#d6e2e4] bg-white p-4 space-y-4"
          >
            <div class="flex items-center justify-between gap-2">
              <h2 class="rb-serif text-xl font-bold text-[#161d20]">Ticket en cours</h2>
              @if (draftLines().length > 0) {
                <button
                  type="button"
                  data-testid="btn-clear-ticket"
                  (click)="clearTicket()"
                  class="rb-btn rb-btn-sm rb-btn-outline"
                >
                  Vider
                </button>
              }
            </div>

            <!-- Choix de destination : 3 boutons visibles -->
            <div class="space-y-2">
              <span class="block text-xs font-extrabold uppercase tracking-wider text-[#3d494a]">
                Destination
              </span>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  data-testid="dest-btn-ROOM"
                  (click)="selectDestination('ROOM')"
                  class="rb-btn rb-btn-sm"
                  [class.rb-btn-primary]="destinationType() === 'ROOM'"
                  [class.rb-btn-outline]="destinationType() !== 'ROOM'"
                >
                  Chambre
                </button>
                <button
                  type="button"
                  data-testid="dest-btn-TABLE"
                  (click)="selectDestination('TABLE')"
                  class="rb-btn rb-btn-sm"
                  [class.rb-btn-primary]="destinationType() === 'TABLE'"
                  [class.rb-btn-outline]="destinationType() !== 'TABLE'"
                >
                  Table
                </button>
                <button
                  type="button"
                  data-testid="dest-btn-TAKEAWAY"
                  (click)="selectDestination('TAKEAWAY')"
                  class="rb-btn rb-btn-sm"
                  [class.rb-btn-primary]="destinationType() === 'TAKEAWAY'"
                  [class.rb-btn-outline]="destinationType() !== 'TAKEAWAY'"
                >
                  À emporter
                </button>
              </div>
            </div>

            <!-- Détail destination -->
            @if (destinationType() === 'ROOM') {
              <div class="space-y-1">
                <label for="pos-room-select" class="block text-xs font-bold text-[#161d20]">
                  Chambre avec séjour en cours
                </label>
                @if (service.roomsInStay().length === 0) {
                  <p
                    data-testid="pos-no-room-stay"
                    class="rounded-xl border border-[#925300]/35 bg-[#fef3c7] px-3 py-2 text-xs font-bold text-[#925300]"
                  >
                    Aucun séjour en cours (check-in requis pour imputer sur une chambre).
                  </p>
                } @else {
                  <select
                    id="pos-room-select"
                    data-testid="pos-room-select"
                    [ngModel]="selectedReservationId()"
                    (ngModelChange)="selectedReservationId.set($event)"
                    class="min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm font-semibold text-[#161d20]"
                  >
                    @for (room of service.roomsInStay(); track room.reservationId) {
                      <option [value]="room.reservationId">
                        Ch. {{ room.roomNumber }} — {{ room.guestName }}
                      </option>
                    }
                  </select>
                }
              </div>
            } @else if (destinationType() === 'TABLE') {
              <div class="space-y-1">
                <label for="pos-table-input" class="block text-xs font-bold text-[#161d20]">
                  Numéro de table
                </label>
                <input
                  id="pos-table-input"
                  data-testid="pos-table-input"
                  type="text"
                  [ngModel]="tableLabel()"
                  (ngModelChange)="tableLabel.set($event)"
                  placeholder="Ex: T1, T4, Terrasse"
                  class="min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm font-semibold text-[#161d20]"
                />
              </div>
            } @else {
              <div class="rounded-xl border border-[#d6e2e4] bg-[#f8fafb] px-3 py-2.5 text-xs font-bold text-[#161d20]">
                À emporter • Client de passage
              </div>
            }

            <!-- Lignes du ticket -->
            <div class="rb-scroll-box max-h-[250px] space-y-2.5 pr-1" data-testid="pos-ticket-lines">
              @if (draftLines().length === 0) {
                <p class="rounded-xl border border-dashed border-[#c2d2d4] p-4 text-center text-xs font-medium text-[#3d494a]">
                  Cliquez sur un produit à gauche pour l’ajouter au ticket.
                </p>
              } @else {
                @for (line of draftLines(); track line.productId) {
                  <div
                    [attr.data-testid]="'ticket-line-' + line.productId"
                    class="rounded-xl border border-[#d6e2e4] bg-[#f8fafb] p-3 space-y-2"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <div class="text-sm font-bold text-[#161d20] leading-snug break-words">
                          {{ line.name }}
                        </div>
                        <div class="text-xs font-semibold text-[#3d494a]">
                          {{ formatFcfa(line.unitPriceFcfa) }} × {{ line.quantity }}
                        </div>
                      </div>
                      <span class="text-sm font-extrabold text-[#161d20] whitespace-nowrap">
                        {{ formatFcfa(line.unitPriceFcfa * line.quantity) }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          [attr.aria-label]="'Diminuer quantité ' + line.name"
                          [attr.data-testid]="'qty-minus-' + line.productId"
                          (click)="changeQuantity(line.productId, -1)"
                          class="rb-btn rb-btn-sm rb-btn-outline min-w-[40px] px-2"
                        >
                          −
                        </button>
                        <span class="min-w-[28px] text-center text-sm font-extrabold text-[#161d20]">
                          {{ line.quantity }}
                        </span>
                        <button
                          type="button"
                          [attr.aria-label]="'Augmenter quantité ' + line.name"
                          [attr.data-testid]="'qty-plus-' + line.productId"
                          (click)="changeQuantity(line.productId, 1)"
                          class="rb-btn rb-btn-sm rb-btn-outline min-w-[40px] px-2"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        [attr.data-testid]="'qty-remove-' + line.productId"
                        (click)="removeLine(line.productId)"
                        class="rb-btn rb-btn-sm rb-btn-danger-outline"
                      >
                        Retirer
                      </button>
                    </div>
                    <input
                      type="text"
                      [attr.aria-label]="'Note pour ' + line.name"
                      [attr.data-testid]="'line-note-' + line.productId"
                      [ngModel]="line.notes"
                      (ngModelChange)="updateLineNote(line.productId, $event)"
                      placeholder="Note facultative (sans piment, bien cuit...)"
                      class="min-h-[40px] w-full rounded-lg border border-[#c2d2d4] bg-white px-2.5 text-xs font-medium text-[#161d20]"
                    />
                  </div>
                }
              }
            </div>

            <!-- Total en gros -->
            <div class="border-t border-[#d6e2e4] pt-3 flex items-baseline justify-between gap-2">
              <span class="text-sm font-bold text-[#3d494a]">Total TTC</span>
              <span
                data-testid="pos-ticket-total"
                class="text-2xl font-extrabold text-[#161d20]"
              >
                {{ formatFcfa(ticketTotalFcfa()) }}
              </span>
            </div>

            <!-- Encaissement immédiat si Table ou À emporter -->
            @if (destinationType() !== 'ROOM') {
              <div class="space-y-2 border-t border-[#d6e2e4] pt-3">
                <span class="block text-xs font-extrabold uppercase tracking-wider text-[#3d494a]">
                  Encaissement (Table / À emporter)
                </span>
                <div class="flex flex-wrap gap-1.5">
                  @for (pm of paymentMethods; track pm.value) {
                    <button
                      type="button"
                      [attr.data-testid]="'pay-method-' + pm.value"
                      [disabled]="pm.value === 'CARD' && !service.isOnline()"
                      (click)="selectedPaymentMethod.set(pm.value)"
                      class="rb-btn rb-btn-sm"
                      [class.rb-btn-primary]="selectedPaymentMethod() === pm.value"
                      [class.rb-btn-outline]="selectedPaymentMethod() !== pm.value"
                    >
                      {{ pm.label }}
                    </button>
                  }
                </div>
                @if (!service.isOnline()) {
                  <p class="text-[11px] font-bold text-[#9b1c1c]">
                    L'encaissement par carte bancaire reste indisponible hors ligne.
                  </p>
                }
                <input
                  type="text"
                  data-testid="pos-payment-ref"
                  [ngModel]="paymentRef()"
                  (ngModelChange)="paymentRef.set($event)"
                  placeholder="Référence facultative (Wave/OM/Virement)"
                  class="min-h-[40px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-xs font-medium text-[#161d20]"
                />
                @if (panWarning()) {
                  <p class="text-xs font-bold text-[#9b1c1c]">
                    Ne saisissez jamais un numéro de carte bancaire complet.
                  </p>
                }
              </div>
            }

            <!-- Boutons de validation -->
            <div class="flex flex-col gap-2.5 pt-1">
              <button
                type="button"
                data-testid="btn-send-kitchen"
                [disabled]="!canSendToKitchen()"
                (click)="submitTicket('SEND_TO_KITCHEN')"
                class="rb-btn rb-btn-primary w-full"
              >
                Envoyer en cuisine
              </button>
              @if (destinationType() === 'ROOM') {
                <button
                  type="button"
                  data-testid="btn-room-charge"
                  [disabled]="!canChargeRoom()"
                  (click)="submitTicket('ROOM_CHARGE')"
                  class="rb-btn rb-btn-secondary w-full"
                >
                  Mettre sur la chambre
                </button>
              } @else {
                <button
                  type="button"
                  data-testid="btn-pay-order"
                  [disabled]="!canPayTicket()"
                  (click)="submitTicket('PAY')"
                  class="rb-btn rb-btn-secondary w-full"
                >
                  Encaisser
                </button>
              }
            </div>
          </aside>
        </div>

        <!-- TABLEAU « COMMANDES DU SERVICE » (max 10 lignes visibles, scroll interne, lots de 50) -->
        <section
          aria-label="Commandes du service"
          class="rounded-2xl border border-[#d6e2e4] bg-white p-3 sm:p-4 space-y-3"
          data-testid="service-orders-section"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="rb-serif text-xl font-bold text-[#161d20]">Commandes du service</h2>
              <p class="text-xs font-medium text-[#3d494a]">
                Suivi temps réel des tickets envoyés, prêts, servis ou annulés.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <input
                type="search"
                data-testid="orders-search-input"
                [ngModel]="ordersSearch()"
                (ngModelChange)="onOrdersSearch($event)"
                placeholder="Rechercher n°, chambre, client..."
                class="min-h-[40px] w-full sm:w-64 rounded-xl border border-[#7c8c8e] bg-white px-3 text-xs font-medium text-[#161d20]"
              />
            </div>
          </div>

          <!-- Dialogue inline d'annulation (zéro modale cachée, support Échap/Entrée) -->
          @if (cancellingOrder(); as target) {
            <div
              data-testid="inline-cancel-box"
              class="rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] p-3.5 space-y-2.5"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="text-sm font-extrabold text-[#9b1c1c]">
                  Annuler la commande {{ target.ticketNumber }} ({{ target.destinationLabel }})
                </span>
                <button
                  type="button"
                  data-testid="btn-abort-cancel"
                  (click)="closeCancelPrompt()"
                  class="rb-btn rb-btn-sm rb-btn-outline"
                >
                  Fermer (Échap)
                </button>
              </div>
              <div class="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  data-testid="cancel-reason-input"
                  [ngModel]="cancelReason()"
                  (ngModelChange)="cancelReason.set($event)"
                  (keydown.enter)="confirmCancelOrder()"
                  placeholder="Motif obligatoire d’annulation (min. 3 caractères)..."
                  class="min-h-[42px] flex-1 rounded-xl border border-[#b81d1d] bg-white px-3 text-sm text-[#161d20]"
                />
                <button
                  type="button"
                  data-testid="btn-confirm-cancel"
                  [disabled]="cancelReason().trim().length < 3 || service.busyAction()"
                  (click)="confirmCancelOrder()"
                  class="rb-btn rb-btn-sm rb-btn-danger-outline"
                >
                  Confirmer l’annulation
                </button>
              </div>
            </div>
          }

          <!-- Conteneur défilant interne (10 lignes max, barre 12px toujours visible) -->
          <div
            data-testid="service-orders-scroll"
            (scroll)="onOrdersScroll($event)"
            class="rb-scroll-box rb-orders-scroll rounded-xl border border-[#d6e2e4]"
          >
            <!-- En-tête collant desktop -->
            <div
              class="hidden lg:grid rb-orders-grid sticky top-0 z-10 min-h-[48px] px-3 border-b border-[#d6e2e4] bg-[#f0f5f6] text-xs font-extrabold uppercase tracking-wider text-[#161d20]"
              role="row"
            >
              <div>N°</div>
              <div>Destination</div>
              <div>Plats</div>
              <div>Total</div>
              <div>État / Préparation</div>
              <div>Heure</div>
              <div class="text-right">Actions</div>
            </div>

            <div data-testid="service-orders-rows">
              @if (displayedOrders().length === 0) {
                <div class="p-6 text-center text-sm font-medium text-[#3d494a]">
                  Aucune commande enregistrée pour ce filtre.
                </div>
              } @else {
                @for (ord of displayedOrders(); track ord.id) {
                  <!-- Ligne desktop 48 px -->
                  <div
                    role="row"
                    [attr.data-testid]="'service-order-row-' + ord.id"
                    [class]="
                      'hidden lg:grid rb-orders-grid rb-orders-row border-b border-[#e6f0f2] text-sm ' +
                      (ord.status === 'READY' ? 'bg-[#e3f5ec]/75 hover:bg-[#e3f5ec]' : 'hover:bg-[#f8fbfc]')
                    "
                  >
                    <div class="font-bold text-[#161d20] break-words">
                      {{ ord.ticketNumber }}
                      @if (ord.syncPending) {
                        <span
                          data-testid="badge-sync-pending"
                          class="ml-1 inline-block rounded-full bg-[#fef3c7] px-2 py-0.5 text-[10px] font-bold text-[#925300]"
                        >
                          En attente de synchronisation
                        </span>
                      }
                    </div>
                    <div class="font-semibold text-[#161d20] break-words">
                      {{ formatOrderDestination(ord) }}
                    </div>
                    <div class="font-medium text-[#161d20] break-words">
                      <span class="block font-bold">{{ formatOrderDishesSummary(ord) }}</span>
                      @if (ord.guestName) {
                        <span class="block text-xs text-[#3d494a]">{{ ord.guestName }}</span>
                      }
                    </div>
                    <div class="font-extrabold text-[#161d20]">
                      {{ formatFcfa(ord.totalTtcFcfa) }}
                    </div>
                    <div>
                      @if (ord.syncPending) {
                        <span
                          [attr.data-testid]="'order-status-' + ord.id"
                          class="inline-flex items-center rounded-lg border border-[#f59e0b]/45 bg-[#fef3c7] px-2.5 py-1 text-xs font-extrabold text-[#925300]"
                        >
                          En attente de synchronisation, la cuisine ne l'a pas encore reçue
                        </span>
                      } @else if (ord.status === 'IN_PREPARATION') {
                        <span
                          [attr.data-testid]="'order-status-' + ord.id"
                          [class]="
                            prepCountdown(ord).isOverdue
                              ? 'inline-flex items-center rounded-lg border border-[#d97706] bg-[#ffedd5] px-2.5 py-1 text-xs font-extrabold text-[#b45309]'
                              : 'inline-flex items-center rounded-lg border border-[#f59e0b]/45 bg-[#fef3c7] px-2.5 py-1 text-xs font-extrabold text-[#925300]'
                          "
                        >
                          {{ prepCountdown(ord).label }}
                        </span>
                      } @else if (ord.status === 'READY') {
                        <span
                          [attr.data-testid]="'order-status-' + ord.id"
                          class="inline-flex items-center rounded-full border border-[#116b41] bg-[#e3f5ec] px-2.5 py-0.5 text-xs font-extrabold text-[#116b41]"
                        >
                          Prête, à servir
                        </span>
                      } @else {
                        <span
                          [attr.data-testid]="'order-status-' + ord.id"
                          [class]="'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ' + orderStatusBadgeClass(ord.status)"
                        >
                          {{ orderStatusLabel(ord.status) }}
                        </span>
                      }
                    </div>
                    <div class="text-xs font-semibold text-[#3d494a]">
                      {{ formatOrderTime(ord.envoyeeAt || ord.createdAt) }}
                    </div>
                    <div class="flex flex-wrap justify-end gap-1.5">
                      @if (!ord.syncPending && ord.status === 'READY' && !service.canReadOnly()) {
                        <button
                          type="button"
                          [attr.data-testid]="'btn-row-authorize-' + ord.id"
                          [disabled]="service.busyAction()"
                          (click)="authorizeService(ord)"
                          class="rb-btn rb-btn-sm rb-btn-primary"
                        >
                          J'autorise le service
                        </button>
                      }
                      @if (!ord.syncPending && ord.status === 'AUTHORIZED' && !service.canReadOnly()) {
                        <button
                          type="button"
                          [attr.data-testid]="'btn-serve-order-' + ord.id"
                          [disabled]="service.busyAction()"
                          (click)="markServed(ord)"
                          class="rb-btn rb-btn-sm rb-btn-secondary"
                        >
                          Servie
                        </button>
                      }
                      @if (!ord.syncPending && service.canCancelOrder() && (ord.status === 'PENDING' || ord.status === 'SENT_TO_KITCHEN' || ord.status === 'CONFIRMED' || ord.status === 'IN_PREPARATION')) {
                        <button
                          type="button"
                          [attr.data-testid]="'btn-cancel-order-' + ord.id"
                          [disabled]="service.busyAction()"
                          (click)="openCancelPrompt(ord)"
                          class="rb-btn rb-btn-sm rb-btn-danger-outline"
                        >
                          Annuler
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Carte compacte mobile / tablette (< 1024 px) dans la même zone défilante -->
                  <div
                    [class]="
                      'lg:hidden border-b border-[#e6f0f2] p-3 space-y-2 ' +
                      (ord.status === 'READY' ? 'bg-[#e3f5ec]/75' : '')
                    "
                    [attr.data-testid]="'service-order-mobile-' + ord.id"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="text-sm font-extrabold text-[#161d20]">
                          {{ ord.ticketNumber }} • {{ formatOrderDestination(ord) }}
                        </div>
                        <div class="text-xs font-bold text-[#161d20]">
                          {{ formatOrderDishesSummary(ord) }}
                        </div>
                        <div class="text-xs font-medium text-[#3d494a]">
                          {{ ord.guestName }} • {{ formatOrderTime(ord.envoyeeAt || ord.createdAt) }}
                        </div>
                      </div>
                      <span class="text-sm font-extrabold text-[#161d20]">
                        {{ formatFcfa(ord.totalTtcFcfa) }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      @if (ord.syncPending) {
                        <span class="inline-flex items-center rounded-lg border border-[#f59e0b]/45 bg-[#fef3c7] px-2.5 py-0.5 text-xs font-extrabold text-[#925300]">
                          En attente de synchronisation, la cuisine ne l'a pas encore reçue
                        </span>
                      } @else if (ord.status === 'IN_PREPARATION') {
                        <span
                          [class]="
                            prepCountdown(ord).isOverdue
                              ? 'inline-flex items-center rounded-lg border border-[#d97706] bg-[#ffedd5] px-2.5 py-0.5 text-xs font-extrabold text-[#b45309]'
                              : 'inline-flex items-center rounded-lg border border-[#f59e0b]/45 bg-[#fef3c7] px-2.5 py-0.5 text-xs font-extrabold text-[#925300]'
                          "
                        >
                          {{ prepCountdown(ord).label }}
                        </span>
                      } @else if (ord.status === 'READY') {
                        <span class="inline-flex items-center rounded-full border border-[#116b41] bg-[#e3f5ec] px-2.5 py-0.5 text-xs font-extrabold text-[#116b41]">
                          Prête, à servir
                        </span>
                      } @else {
                        <span
                          [class]="'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ' + orderStatusBadgeClass(ord.status)"
                        >
                          {{ orderStatusLabel(ord.status) }}
                        </span>
                      }
                      <div class="flex flex-wrap gap-1.5">
                        @if (!ord.syncPending && ord.status === 'READY' && !service.canReadOnly()) {
                          <button
                            type="button"
                            (click)="markServed(ord)"
                            class="rb-btn rb-btn-sm rb-btn-primary"
                          >
                            Servie
                          </button>
                        }
                        @if (!ord.syncPending && service.canCancelOrder() && (ord.status === 'PENDING' || ord.status === 'SENT_TO_KITCHEN' || ord.status === 'IN_PREPARATION')) {
                          <button
                            type="button"
                            (click)="openCancelPrompt(ord)"
                            class="rb-btn rb-btn-sm rb-btn-danger-outline"
                          >
                            Annuler
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
          </div>

          <div class="flex items-center justify-between text-xs font-bold text-[#3d494a]" data-testid="service-orders-count">
            <span>{{ loadedCountLabel() }}</span>
            @if (service.loadingMoreOrders()) {
              <span>Chargement du lot suivant...</span>
            }
          </div>
        </section>

        <!-- SECTION « ANCIENNES COMMANDES À CLÔTURER » (> 12 h non terminées, RECEPTION & DIRECTION) -->
        @if (service.canCancelOrder() && service.staleOrders().length > 0) {
          <section
            aria-label="Anciennes commandes à clôturer"
            data-testid="stale-orders-section"
            class="rounded-2xl border border-[#f59e0b] bg-[#fffcf2] p-4 space-y-3"
          >
            <div>
              <h2 class="rb-serif text-lg font-bold text-[#925300]">
                Anciennes commandes à clôturer (&gt; 12 h)
              </h2>
              <p class="text-xs font-medium text-[#925300]">
                Ces tickets non terminés de plus de 12 heures sont masqués de l’écran du cuisinier et doivent être clôturés avec un motif.
              </p>
            </div>

            <div class="space-y-2">
              @for (st of service.staleOrders(); track st.id) {
                <div
                  [attr.data-testid]="'stale-order-row-' + st.id"
                  class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f59e0b]/45 bg-white p-3"
                >
                  <div>
                    <span class="font-extrabold text-sm text-[#161d20]">
                      {{ st.ticketNumber }} • {{ formatOrderDestination(st) }}
                    </span>
                    <span class="block text-xs font-semibold text-[#3d494a]">
                      {{ formatOrderDishesSummary(st) }} • Envoyée le {{ st.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                    </span>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      [attr.data-testid]="'stale-reason-input-' + st.id"
                      [ngModel]="staleReason(st.id)"
                      (ngModelChange)="setStaleReason(st.id, $event)"
                      placeholder="Motif de clôture (min. 3 car.)..."
                      class="min-h-[40px] w-56 rounded-lg border border-[#7c8c8e] bg-white px-2.5 text-xs font-medium text-[#161d20]"
                    />
                    <button
                      type="button"
                      [attr.data-testid]="'btn-close-stale-' + st.id"
                      [disabled]="staleReason(st.id).trim().length < 3 || service.busyAction()"
                      (click)="confirmCloseStale(st)"
                      class="rb-btn rb-btn-sm rb-btn-danger-outline"
                    >
                      Clôturer
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>
        }
      </div>

      <!-- Barre fixe mobile en bas (sous 768 px, au-dessus de la nav mobile) -->
      <div
        data-testid="mobile-ticket-bar"
        class="md:hidden fixed bottom-16 left-0 right-0 z-40 border-t border-[#d6e2e4] bg-white/95 backdrop-blur px-3 py-2.5 flex items-center justify-between gap-3 shadow-sm"
      >
        <div>
          <span class="block text-[11px] font-bold uppercase text-[#3d494a]">Total ticket</span>
          <span class="text-base font-extrabold text-[#161d20]">{{ formatFcfa(ticketTotalFcfa()) }}</span>
        </div>
        <button
          type="button"
          data-testid="btn-scroll-ticket"
          (click)="scrollToTicket()"
          class="rb-btn rb-btn-primary rb-btn-sm"
        >
          Voir le ticket ({{ totalItemsCount() }})
        </button>
      </div>
  `,
})
export class RestaurantPosPageComponent implements OnInit, OnDestroy {
  readonly service = inject(RestaurantV3Service);
  readonly nowMs = signal<number>(Date.now());

  readonly selectedCategoryId = signal<string>('ALL');
  readonly productSearch = signal<string>('');
  readonly destinationType = signal<RestaurantDestinationType>('ROOM');
  readonly selectedReservationId = signal<string>('');
  readonly tableLabel = signal<string>('T1');
  readonly draftLines = signal<TicketDraftLine[]>([]);
  readonly selectedPaymentMethod = signal<'CASH' | 'ORANGE_MONEY' | 'WAVE' | 'CARD' | 'BANK_TRANSFER'>('CASH');
  readonly paymentRef = signal<string>('');
  readonly ordersSearch = signal<string>('');
  readonly cancellingOrder = signal<RestaurantOrderV3 | null>(null);
  readonly cancelReason = signal<string>('');
  readonly failedImageIds = signal<Set<string>>(new Set());
  private readonly staleReasonsByOrder = signal<Record<string, string>>({});

  readonly paymentMethods = RESTAURANT_PAYMENT_METHODS;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private sseDelayTimer: ReturnType<typeof setTimeout> | null = null;
  private clockTimer: ReturnType<typeof setInterval> | null = null;
  private fallbackPollTimer: ReturnType<typeof setInterval> | null = null;

  readonly readyOrders = computed(() => this.service.readyOrdersList());


  readonly visibleCategories = computed(() =>
    this.service.categories().filter((c) => !c.isArchived),
  );

  readonly activeCatalogProducts = computed(() =>
    this.service.products().filter((p) => p.status !== 'ARCHIVED'),
  );

  readonly availableProductCount = computed(() => this.activeCatalogProducts().length);

  readonly filteredProducts = computed(() => {
    const cat = this.selectedCategoryId();
    const q = this.productSearch().trim().toLowerCase();
    return this.activeCatalogProducts().filter((p) => {
      if (cat !== 'ALL' && p.categoryId !== cat) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.categoryName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  readonly ticketTotalFcfa = computed(() =>
    this.draftLines().reduce((sum, l) => sum + l.unitPriceFcfa * l.quantity, 0),
  );

  readonly totalItemsCount = computed(() =>
    this.draftLines().reduce((sum, l) => sum + l.quantity, 0),
  );

  readonly panWarning = computed(() => hasPotentialCardPan(this.paymentRef()));

  readonly displayedOrders = computed(() => {
    const pending = this.service.pendingOfflineOrders();
    const remote = this.service.ordersPage().items;
    return [...pending, ...remote];
  });

  readonly loadedCountLabel = computed(() => {
    const page = this.service.ordersPage();
    const shown = page.items.length + this.service.pendingOfflineOrders().length;
    const total = page.total + this.service.pendingOfflineOrders().length;
    return `${shown} sur ${total} commande${total > 1 ? 's' : ''}`;
  });

  readonly canSendToKitchen = computed(() => {
    if (this.service.busyAction() || this.service.canReadOnly()) return false;
    if (this.draftLines().length === 0) return false;
    if (this.destinationType() === 'ROOM' && !this.selectedRoomStay()) return false;
    return true;
  });

  readonly canChargeRoom = computed(() => {
    return (
      this.destinationType() === 'ROOM' &&
      Boolean(this.selectedRoomStay()) &&
      this.draftLines().length > 0 &&
      !this.service.busyAction() &&
      !this.service.canReadOnly()
    );
  });

  readonly canPayTicket = computed(() => {
    if (this.destinationType() === 'ROOM') return false;
    if (this.draftLines().length === 0 || this.service.busyAction() || this.service.canReadOnly()) {
      return false;
    }
    if (this.panWarning()) return false;
    if (this.selectedPaymentMethod() === 'CARD' && !this.service.isOnline()) return false;
    return true;
  });

  readonly formatFcfa = formatFcfa;
  readonly formatOrderTime = formatOrderTime;
  readonly orderStatusLabel = orderStatusLabel;
  readonly orderStatusBadgeClass = orderStatusBadgeClass;
  readonly destinationLabel = destinationLabel;

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.service.loadCatalog(),
      this.service.loadOrdersPage({ offset: 0, limit: 50 }),
      this.service.loadStaleOrders(),
    ]);
    const stays = this.service.roomsInStay();
    if (stays.length > 0 && !this.selectedReservationId()) {
      this.selectedReservationId.set(stays[0].reservationId);
    }

    // Démarrer le flux SSE après 1 500 ms pour laisser l'état networkidle se stabiliser à l'arrivée sur /restaurant
    this.sseDelayTimer = setTimeout(() => {
      this.service.connectKitchenStream(() => {
        void this.service.loadOrdersPage({ offset: 0, limit: 50, search: this.ordersSearch() });
      });
    }, 1500);

    this.clockTimer = setInterval(() => {
      this.nowMs.set(Date.now());
    }, 5_000);

    this.fallbackPollTimer = setInterval(() => {
      if (!this.service.sseConnected()) {
        void this.service.loadOrdersPage({ offset: 0, limit: 50, search: this.ordersSearch() });
      }
    }, 10_000);
  }

  ngOnDestroy(): void {
    if (this.sseDelayTimer) {
      clearTimeout(this.sseDelayTimer);
      this.sseDelayTimer = null;
    }
    this.service.disconnectKitchenStream();
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = null;
    }
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    if (this.fallbackPollTimer) {
      clearInterval(this.fallbackPollTimer);
      this.fallbackPollTimer = null;
    }
  }

  prepCountdown(ord: RestaurantOrderV3) {
    return computePrepCountdown(ord.heureFinPrevue, this.nowMs());
  }

  formatOrderDestination(ord: RestaurantOrderV3): string {
    if (ord.destinationType === 'ROOM') {
      const num = ord.roomNumber || ord.destinationLabel?.replace(/^(Ch\.|Chambre)\s*/i, '').trim() || '';
      return num ? `Chambre ${num} (Ch. ${num})` : 'Chambre';
    }
    return ord.destinationLabel || 'Table 1';
  }

  async authorizeService(ord: RestaurantOrderV3): Promise<void> {
    await this.service.updateOrderStatus(ord.id, 'AUTHORIZED');
  }

  formatOrderDishesSummary(ord: RestaurantOrderV3): string {
    const items = ord.items || [];
    if (items.length === 0) return '—';
    return items.map((it) => `${it.quantity} ${it.name}`).join(', ');
  }

  formatReadyBannerText(ord: RestaurantOrderV3): string {
    const dest = formatFullRoomDestination(ord.destinationType, ord.roomNumber, ord.destinationLabel);
    const items = ord.items || [];
    const totalQty = items.reduce((s, it) => s + (it.quantity || 1), 0);
    const dishesText =
      items.length > 0
        ? items.map((it) => `${it.quantity} ${it.name}`).join(', ')
        : ord.ticketNumber;
    const suffix = totalQty > 1 ? 'prêts à servir' : 'prêt à servir';
    return `${dest} : ${dishesText} ${suffix}`;
  }

  staleReason(orderId: string): string {
    return this.staleReasonsByOrder()[orderId] || '';
  }

  setStaleReason(orderId: string, val: string): void {
    this.staleReasonsByOrder.update((prev) => ({ ...prev, [orderId]: val || '' }));
  }

  async confirmCloseStale(ord: RestaurantOrderV3): Promise<void> {
    const reason = this.staleReason(ord.id).trim();
    if (reason.length < 3) return;
    const ok = await this.service.closeStaleOrder(ord.id, reason);
    if (ok) {
      this.setStaleReason(ord.id, '');
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.cancellingOrder()) {
      this.closeCancelPrompt();
    }
  }

  private selectedRoomStay() {
    const id = this.selectedReservationId();
    const list = this.service.roomsInStay();
    return list.find((r) => r.reservationId === id) || list[0] || null;
  }

  selectDestination(dest: RestaurantDestinationType): void {
    this.destinationType.set(dest);
    if (dest === 'ROOM' && !this.selectedReservationId()) {
      const first = this.service.roomsInStay()[0];
      if (first) this.selectedReservationId.set(first.reservationId);
    }
  }

  isProductDisabled(prod: DishItem): boolean {
    return prod.status === 'SOLD_OUT' || this.service.canReadOnly();
  }

  isDefaultProductImage(prod: DishItem): boolean {
    return !prod.thumbnailUrl?.trim() || this.failedImageIds().has(prod.id);
  }

  resolveProductImageSrc(prod: DishItem): string {
    if (this.failedImageIds().has(prod.id)) {
      return RESTAURANT_DEFAULT_PLATE_SVG_URI;
    }
    const thumb = prod.thumbnailUrl?.trim();
    return thumb || RESTAURANT_DEFAULT_PLATE_SVG_URI;
  }

  onProductImageError(productId: string): void {
    if (this.failedImageIds().has(productId)) return;
    this.failedImageIds.update((prev) => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  }

  onProductCardKeydown(event: Event, prod: DishItem): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) {
      return;
    }
    event.preventDefault();
    this.addProductToTicket(prod);
  }

  addProductToTicket(prod: DishItem): void {
    if (prod.status === 'SOLD_OUT' || this.service.canReadOnly()) return;
    this.draftLines.update((lines) => {
      const idx = lines.findIndex((l) => l.productId === prod.id);
      if (idx >= 0) {
        return lines.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...lines,
        {
          productId: prod.id,
          name: prod.name,
          unitPriceFcfa: prod.priceFcfa,
          quantity: 1,
          notes: '',
          prepStation: prod.prepStation || 'CUISINE',
        },
      ];
    });
  }

  changeQuantity(productId: string, delta: number): void {
    this.draftLines.update((lines) =>
      lines
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  removeLine(productId: string): void {
    this.draftLines.update((lines) => lines.filter((l) => l.productId !== productId));
  }

  updateLineNote(productId: string, notes: string): void {
    this.draftLines.update((lines) =>
      lines.map((l) => (l.productId === productId ? { ...l, notes } : l)),
    );
  }

  clearTicket(): void {
    this.draftLines.set([]);
    this.paymentRef.set('');
  }

  async submitTicket(action: 'SEND_TO_KITCHEN' | 'ROOM_CHARGE' | 'PAY'): Promise<void> {
    const lines = this.draftLines();
    if (lines.length === 0) return;

    const dest = this.destinationType();
    const stay = this.selectedRoomStay();
    if (dest === 'ROOM' && !stay) {
      this.service.errorMessage.set('Sélectionnez une chambre avec un séjour en cours.');
      return;
    }

    const payload: CreateOrderRequestPayload = {
      ticketNumber: `#CMD-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 9000))}-${Date.now().toString().slice(-3)}`,
      destinationType: dest,
      ...(dest === 'ROOM' && stay
        ? {
            roomId: stay.roomId,
            roomNumber: stay.roomNumber,
            reservationId: stay.reservationId,
          }
        : dest === 'TABLE'
          ? { tableLabel: this.tableLabel().trim() || 'Table 1' }
          : { tableLabel: 'À emporter' }),
      action,
      ...(action === 'ROOM_CHARGE'
        ? { paymentMethod: 'ROOM_CHARGE' }
        : action === 'PAY'
          ? {
              paymentMethod: this.selectedPaymentMethod(),
              ...(this.paymentRef().trim() ? { paymentRef: this.paymentRef().trim() } : {}),
            }
          : {}),
      items: lines.map((l) => ({
        productId: l.productId,
        name: l.name,
        quantity: l.quantity,
        unitPriceFcfa: l.unitPriceFcfa,
        ...(l.notes.trim() ? { notes: l.notes.trim() } : {}),
        prepStation: l.prepStation,
      })),
    };

    const ok = await this.service.submitOrder(payload);
    if (ok) {
      this.clearTicket();
    }
  }

  onOrdersSearch(value: string): void {
    this.ordersSearch.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      void this.service.loadOrdersPage({ offset: 0, limit: 50, search: value });
    }, 200);
  }

  onOrdersScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 96) {
      void this.service.loadMoreOrders({ search: this.ordersSearch() });
    }
  }

  async markServed(ord: RestaurantOrderV3): Promise<void> {
    await this.service.updateOrderStatus(ord.id, 'SERVED');
  }

  openCancelPrompt(ord: RestaurantOrderV3): void {
    this.cancellingOrder.set(ord);
    this.cancelReason.set('');
  }

  closeCancelPrompt(): void {
    this.cancellingOrder.set(null);
    this.cancelReason.set('');
  }

  async confirmCancelOrder(): Promise<void> {
    const ord = this.cancellingOrder();
    if (!ord || this.cancelReason().trim().length < 3) return;
    const ok = await this.service.cancelOrder(ord.id, this.cancelReason());
    if (ok) {
      this.closeCancelPrompt();
    }
  }

  scrollToTicket(): void {
    if (typeof document !== 'undefined') {
      document.getElementById('ticket-section')?.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
