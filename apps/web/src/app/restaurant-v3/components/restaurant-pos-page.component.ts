import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
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
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import {
  RESTAURANT_PAYMENT_METHODS,
  RESTAURANT_SCROLL_STYLES,
  TicketDraftLine,
  destinationLabel,
  formatFcfa,
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
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [RESTAURANT_SCROLL_STYLES],
  template: `
    <app-layout>
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
            <a
              routerLink="/cuisine"
              data-testid="link-kitchen"
              class="rb-btn rb-btn-outline"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">soup_kitchen</span>
              <span>Cuisine</span>
            </a>
            @if (service.isDirection()) {
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
            class="flex items-center justify-between gap-3 rounded-xl border border-[#116b41]/35 bg-[#e3f5ec] px-4 py-3 text-sm font-bold text-[#116b41]"
          >
            <span>{{ ok }}</span>
            <button type="button" (click)="service.clearMessages()" class="rb-btn rb-btn-sm rb-btn-outline">
              OK
            </button>
          </div>
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
          <!-- ZONE GAUCHE (8/12) : Grille produits sans photo, scroll vertical interne -->
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
              class="rb-scroll-box max-h-[460px] pr-1"
            >
              @if (service.loadingCatalog() && filteredProducts().length === 0) {
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (s of [1, 2, 3, 4, 5, 6]; track s) {
                    <div class="h-28 animate-pulse rounded-xl border border-[#d6e2e4] bg-[#f0f5f6]"></div>
                  }
                </div>
              } @else if (filteredProducts().length === 0) {
                <div class="rounded-xl border border-dashed border-[#c2d2d4] p-6 text-center text-sm font-medium text-[#3d494a]">
                  Aucun produit disponible ne correspond à cette sélection.
                </div>
              } @else {
                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  @for (prod of filteredProducts(); track prod.id) {
                    <button
                      type="button"
                      [attr.data-testid]="'product-tile-' + prod.id"
                      [attr.data-product-name]="prod.name"
                      [disabled]="prod.status === 'SOLD_OUT' || service.canReadOnly()"
                      (click)="addProductToTicket(prod)"
                      [class]="prod.status === 'SOLD_OUT'
                        ? 'flex flex-col justify-between gap-2 rounded-xl border border-[#d6e2e4] bg-[#f1f5f6] p-3.5 text-left text-[#4f6264] opacity-75 cursor-not-allowed min-h-[104px]'
                        : 'flex flex-col justify-between gap-2 rounded-xl border border-[#c2d2d4] bg-white p-3.5 text-left hover:border-[#006875] hover:bg-[#f2f8f9] transition-colors min-h-[104px] cursor-pointer'"
                    >
                      <div class="space-y-1">
                        <span class="text-[11px] font-bold uppercase tracking-wide text-[#3d494a] block">
                          {{ prod.categoryName }}
                        </span>
                        <span class="block text-sm font-extrabold text-[#161d20] leading-snug break-words">
                          {{ prod.name }}
                        </span>
                      </div>
                      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <span class="text-sm font-extrabold text-[#00545f]">
                          {{ formatFcfa(prod.priceFcfa) }}
                        </span>
                        @if (prod.status === 'SOLD_OUT') {
                          <span class="rounded-full bg-[#e2e8ea] px-2.5 py-0.5 text-[11px] font-extrabold text-[#3d494a]">
                            Épuisé
                          </span>
                        } @else {
                          <span class="rounded-full bg-[#e6f0f2] px-2.5 py-0.5 text-[11px] font-bold text-[#00545f]">
                            + Ajouter
                          </span>
                        }
                      </div>
                    </button>
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
              <div>Client</div>
              <div>Total</div>
              <div>État</div>
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
                    class="hidden lg:grid rb-orders-grid rb-orders-row border-b border-[#e6f0f2] text-sm hover:bg-[#f8fbfc]"
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
                      {{ ord.destinationLabel }}
                    </div>
                    <div class="font-medium text-[#3d494a] break-words">
                      {{ ord.guestName }}
                    </div>
                    <div class="font-extrabold text-[#161d20]">
                      {{ formatFcfa(ord.totalTtcFcfa) }}
                    </div>
                    <div>
                      <span
                        [attr.data-testid]="'order-status-' + ord.id"
                        [class]="'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ' + orderStatusBadgeClass(ord.status)"
                      >
                        {{ orderStatusLabel(ord.status) }}
                      </span>
                    </div>
                    <div class="text-xs font-semibold text-[#3d494a]">
                      {{ formatOrderTime(ord.createdAt) }}
                    </div>
                    <div class="flex flex-wrap justify-end gap-1.5">
                      @if (!ord.syncPending && ord.status !== 'SERVED' && ord.status !== 'CANCELLED' && !service.canReadOnly()) {
                        <button
                          type="button"
                          [attr.data-testid]="'btn-serve-order-' + ord.id"
                          [disabled]="service.busyAction()"
                          (click)="markServed(ord)"
                          class="rb-btn rb-btn-sm rb-btn-outline"
                        >
                          Servie
                        </button>
                      }
                      @if (!ord.syncPending && service.canCancelOrder() && ord.status !== 'CANCELLED') {
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
                    class="lg:hidden border-b border-[#e6f0f2] p-3 space-y-2"
                    [attr.data-testid]="'service-order-mobile-' + ord.id"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <div class="text-sm font-extrabold text-[#161d20]">
                          {{ ord.ticketNumber }} • {{ ord.destinationLabel }}
                        </div>
                        <div class="text-xs font-medium text-[#3d494a]">
                          {{ ord.guestName }} • {{ formatOrderTime(ord.createdAt) }}
                        </div>
                      </div>
                      <span class="text-sm font-extrabold text-[#161d20]">
                        {{ formatFcfa(ord.totalTtcFcfa) }}
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span
                        [class]="'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ' + orderStatusBadgeClass(ord.status)"
                      >
                        {{ ord.syncPending ? 'En attente de synchronisation' : orderStatusLabel(ord.status) }}
                      </span>
                      <div class="flex flex-wrap gap-1.5">
                        @if (!ord.syncPending && ord.status !== 'SERVED' && ord.status !== 'CANCELLED' && !service.canReadOnly()) {
                          <button
                            type="button"
                            (click)="markServed(ord)"
                            class="rb-btn rb-btn-sm rb-btn-outline"
                          >
                            Servie
                          </button>
                        }
                        @if (!ord.syncPending && service.canCancelOrder() && ord.status !== 'CANCELLED') {
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
    </app-layout>
  `,
})
export class RestaurantPosPageComponent implements OnInit {
  readonly service = inject(RestaurantV3Service);

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

  readonly paymentMethods = RESTAURANT_PAYMENT_METHODS;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

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
    ]);
    const stays = this.service.roomsInStay();
    if (stays.length > 0 && !this.selectedReservationId()) {
      this.selectedReservationId.set(stays[0].reservationId);
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
