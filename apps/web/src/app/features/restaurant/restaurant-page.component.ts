import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DishItem, Role } from '@residence-blue/shared';
import { RestaurantMockService } from '../../core/services/restaurant-mock.service';
import { AuthMockService } from '../../core/services/auth-mock.service';
import { MenuManagementModalComponent } from './menu-management-modal/menu-management-modal.component';

@Component({
  selector: 'app-restaurant-page',
  standalone: true,
  imports: [CommonModule, FormsModule, MenuManagementModalComponent],
  template: `
    <div class="flex flex-col w-full pb-8 font-body-md" data-testid="restaurant-container">
      <!-- Toast Notification -->
      @if (toastMessage()) {
        <div
          class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-inverse-surface text-surface-bright shadow-lg text-body-sm flex items-center gap-2 border border-outline-variant/30 print:hidden"
          role="status"
          data-testid="toast-notification"
        >
          <span class="material-symbols-outlined text-[18px] text-secondary">info</span>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      <!-- Operational Header / Status Bar -->
      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md mb-space-lg print:hidden">
        <div class="flex flex-col">
          <div class="flex items-center gap-space-sm mb-space-xs">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant font-label-md text-label-md">
              <span class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span>
              Service Déjeuner en cours
            </span>
            <span class="font-label-md text-label-md text-outline">|</span>
            <span class="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
              <span class="material-symbols-outlined text-[16px] text-primary">person</span>
              {{ restaurantService.serverName() }} (Rang Terrasse)
            </span>
          </div>

          <div class="flex items-baseline gap-space-md">
            <h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight">Restaurant &amp; Bar La Teranga</h1>
            <span class="font-body-sm text-body-sm text-outline hidden sm:inline">12 Clés • Grand Standing, Thiès</span>
          </div>
        </div>

        <!-- Quick Stats & Action Bar -->
        <div class="flex items-center gap-space-md w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
          <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-sm">
            <div class="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-[20px]">table_bar</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-md text-label-md text-outline">Tables occupées</span>
              <span class="font-title-md text-title-md text-on-surface">5 / 8 actives</span>
            </div>
          </div>

          <div class="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-container-lowest shadow-sm">
            <div class="w-8 h-8 rounded-lg bg-secondary-fixed flex items-center justify-center text-secondary">
              <span class="material-symbols-outlined text-[20px]">room_service</span>
            </div>
            <div class="flex flex-col">
              <span class="font-label-md text-label-md text-outline">Envois cuisine</span>
              <span class="font-title-md text-title-md text-on-surface">3 en prép.</span>
            </div>
          </div>

          <button
            type="button"
            class="h-11 px-4 rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex items-center gap-2 font-label-lg text-label-lg transition-colors shadow-sm cursor-pointer"
            (click)="showToast('Clôture X de service effectuée')"
          >
            <span class="material-symbols-outlined text-[18px]">history</span>
            <span class="hidden md:inline">Clôture X</span>
          </button>

          <!-- Bouton Gérer le menu (Réservé aux rôles DIRECTION et RESTAURANT) -->
          @if (canManageMenu()) {
            <button
              type="button"
              class="h-11 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary flex items-center gap-2 font-label-lg text-label-lg transition-all shadow-sm cursor-pointer"
              data-testid="btn-manage-menu"
              (click)="openMenuManagement()"
            >
              <span class="material-symbols-outlined text-[18px]">restaurant_menu</span>
              <span>Gérer le menu</span>
            </button>
          }
        </div>
      </div>

      <!-- Main POS Grid (Catalog 65% + Ticket Panel 35%) -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-gutter items-start">
        <!-- LEFT ZONE: Touch Menu Catalog (xl:col-span-8) -->
        <div class="xl:col-span-8 flex flex-col gap-space-md">
          <!-- Search & Filters Container -->
          <div class="bg-surface-container-lowest p-space-md rounded-2xl shadow-sm flex flex-col gap-space-md">
            <div class="flex flex-col md:flex-row gap-space-md items-center justify-between">
              <div class="relative w-full md:w-96">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
                <input
                  type="text"
                  class="w-full h-12 pl-11 pr-4 rounded-xl bg-surface-container-low text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  placeholder="Rechercher un plat, poisson du jour, cocktail..."
                  data-testid="input-search-dish"
                  [ngModel]="searchQuery()"
                  (ngModelChange)="onSearchChange($event)"
                />
              </div>

              <!-- Secondary tags -->
              <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto py-1">
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-full font-label-md text-label-md flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
                  [ngClass]="activeTag() === 'SPECIALTY' ? 'bg-primary-fixed text-on-primary-fixed shadow-xs' : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'"
                  (click)="filterByTag('SPECIALTY')"
                >
                  <span class="material-symbols-outlined text-[16px]">stars</span>
                  <span>Spécialités locales</span>
                </button>
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer"
                  [ngClass]="activeTag() === 'POPULAR' ? 'bg-primary-fixed text-on-primary-fixed shadow-xs' : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'"
                  (click)="filterByTag('POPULAR')"
                >
                  <span>Pêche du jour Somone</span>
                </button>
                <button
                  type="button"
                  class="px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap transition-colors cursor-pointer"
                  [ngClass]="activeTag() === 'VEGETARIAN' ? 'bg-primary-fixed text-on-primary-fixed shadow-xs' : 'bg-surface-container-low hover:bg-surface-container text-on-surface-variant'"
                  (click)="filterByTag('VEGETARIAN')"
                >
                  <span>Végétarien</span>
                </button>
              </div>
            </div>

            <!-- Touch Category Tabs -->
            <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none" role="tablist">
              @for (cat of categories(); track cat.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeCategory() === cat.id"
                  data-testid="category-tab"
                  class="h-12 px-5 rounded-xl flex items-center gap-2 font-title-md text-title-md whitespace-nowrap transition-all cursor-pointer active:scale-95"
                  [ngClass]="activeCategory() === cat.id ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-low hover:bg-surface-container text-on-surface'"
                  (click)="selectCategory(cat.id)"
                >
                  @if (cat.icon) {
                    <span class="material-symbols-outlined text-[20px]">{{ cat.icon }}</span>
                  }
                  <span>{{ cat.name }}</span>
                  @if (cat.itemCount && cat.itemCount > 0) {
                    <span
                      class="w-5 h-5 rounded-full text-[11px] flex items-center justify-center font-bold"
                      [ngClass]="activeCategory() === cat.id ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-variant text-on-surface-variant'"
                    >
                      {{ cat.itemCount }}
                    </span>
                  }
                </button>
              }
            </div>
          </div>

          <!-- Dish Cards Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-4 gap-gutter" data-testid="dishes-grid">
            @for (dish of filteredDishes(); track dish.id) {
              <div
                class="group bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                [ngClass]="{
                  'opacity-60 grayscale-[0.3] cursor-not-allowed': dish.status === 'SOLD_OUT',
                  'cursor-pointer active:scale-[0.99]': dish.status === 'AVAILABLE'
                }"
                data-testid="dish-card"
                [attr.data-dish-id]="dish.id"
                (click)="onDishClick(dish)"
              >
                <!-- Image Header with badges -->
                <div class="relative h-44 w-full overflow-hidden bg-surface-container">
                  <div class="w-full h-full bg-gradient-to-br from-surface-container to-surface-variant flex items-center justify-center text-outline">
                    <span class="material-symbols-outlined text-[48px] opacity-40">restaurant</span>
                  </div>

                  <!-- Tag Badge -->
                  @if (dish.tags.includes('LOCAL_SPECIALTY')) {
                    <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md shadow-xs">
                      Spécialité locale
                    </span>
                  } @else if (dish.tags.includes('POPULAR')) {
                    <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface font-label-md text-label-md shadow-xs">
                      Populaire
                    </span>
                  } @else if (dish.tags.includes('SIGNATURE_BAR')) {
                    <span class="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md shadow-xs">
                      Signature Bar
                    </span>
                  }

                  <!-- Statut Épuisé (Requirement 7) -->
                  @if (dish.status === 'SOLD_OUT') {
                    <span
                      class="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-bold shadow-xs flex items-center gap-1"
                      data-testid="badge-sold-out"
                    >
                      <span class="w-2 h-2 rounded-full bg-error"></span>
                      Épuisé
                    </span>
                  }
                </div>

                <div class="p-4 flex flex-col flex-1 justify-between gap-3">
                  <div>
                    <h2 class="font-headline-sm text-headline-sm text-on-surface leading-snug">{{ dish.name }}</h2>
                    <p class="font-body-sm text-body-sm text-on-surface-variant line-clamp-2 mt-1">
                      {{ dish.description }}
                    </p>
                  </div>

                  <div class="flex items-center justify-between pt-2">
                    <span class="font-label-currency text-label-currency text-primary">
                      {{ formatNumber(dish.priceFcfa) }} FCFA
                    </span>

                    <button
                      type="button"
                      [disabled]="dish.status === 'SOLD_OUT'"
                      class="w-10 h-10 rounded-xl flex items-center justify-center shadow-xs transition-transform active:scale-90"
                      [ngClass]="dish.status === 'SOLD_OUT'
                        ? 'bg-surface-variant text-outline cursor-not-allowed'
                        : 'bg-primary text-on-primary hover:bg-primary-container cursor-pointer'"
                      data-testid="btn-add-dish"
                      [title]="dish.status === 'SOLD_OUT' ? 'Plat épuisé' : 'Ajouter au ticket'"
                      (click)="$event.stopPropagation(); onDishClick(dish)"
                    >
                      <span class="material-symbols-outlined text-[22px]">
                        {{ dish.status === 'SOLD_OUT' ? 'block' : 'add' }}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- RIGHT ZONE: Ticket de Commande Panel (xl:col-span-4) -->
        <div class="xl:col-span-4 flex flex-col">
          <div class="bg-surface-container-lowest rounded-2xl shadow-md p-space-md flex flex-col gap-space-md sticky top-24">
            <!-- Ticket Header -->
            <div class="flex items-center justify-between pb-space-sm bg-surface-container-low/50 -m-space-md p-space-md rounded-t-2xl">
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <span class="font-title-lg text-title-lg text-on-surface">Ticket Actuel</span>
                  <span class="px-2 py-0.5 rounded bg-surface-container-highest font-mono text-[11px] text-on-surface-variant font-bold">
                    {{ ticketNumber() }}
                  </span>
                </div>
                <span class="font-label-md text-label-md text-outline">
                  Serveur : {{ serverName() }} • 13:24
                </span>
              </div>
              <button
                type="button"
                class="w-9 h-9 rounded-xl bg-surface-container-lowest hover:bg-error-container text-outline hover:text-error flex items-center justify-center transition-colors cursor-pointer"
                title="Effacer tout"
                data-testid="btn-clear-ticket"
                (click)="clearTicket()"
              >
                <span class="material-symbols-outlined text-[20px]">delete_sweep</span>
              </button>
            </div>

            <!-- Destination Selector (Table vs Chambre Toggle) -->
            <div class="flex flex-col gap-space-sm pt-2">
              <div class="grid grid-cols-2 p-1 bg-surface-container-low rounded-xl">
                <button
                  type="button"
                  data-testid="toggle-dest-table"
                  class="h-10 rounded-lg font-title-md text-title-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  [ngClass]="destinationType() === 'TABLE' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
                  (click)="setDestinationType('TABLE')"
                >
                  <span class="material-symbols-outlined text-[18px]">table_bar</span>
                  <span>Table</span>
                </button>
                <button
                  type="button"
                  data-testid="toggle-dest-room"
                  class="h-10 rounded-lg font-title-md text-title-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  [ngClass]="destinationType() === 'ROOM' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
                  (click)="setDestinationType('ROOM')"
                >
                  <span class="material-symbols-outlined text-[18px]">bed</span>
                  <span>Chambre</span>
                </button>
              </div>

              <!-- Quick Table Selector Chips -->
              <div class="flex flex-col gap-1.5">
                <span class="font-label-md text-label-md text-outline">Emplacement sélectionné :</span>
                <div class="grid grid-cols-4 gap-1.5">
                  @for (table of ['T1', 'T2', 'T3', 'T4 (Piscine)', 'T5', 'T6', 'Bar', 'Transat']; track table) {
                    <button
                      type="button"
                      class="h-9 rounded-lg font-label-lg text-label-lg transition-colors cursor-pointer"
                      [ngClass]="selectedTable() === table ? 'bg-primary text-on-primary shadow-xs' : 'bg-surface-container-low text-on-surface hover:bg-surface-variant'"
                      (click)="selectTable(table)"
                    >
                      {{ table }}
                    </button>
                  }
                </div>
              </div>

              <!-- Folio Client Preview Card (Linked to Room) -->
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-secondary-fixed/30 text-on-surface">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center font-bold text-xs">
                    {{ linkedGuest().roomNumber }}
                  </div>
                  <div class="flex flex-col leading-tight">
                    <div class="flex items-center gap-1.5">
                      <span class="font-title-md text-title-md text-on-surface">{{ linkedGuest().guestName }}</span>
                      <span class="px-1.5 py-0.2 rounded bg-secondary text-on-secondary font-label-md text-[10px] uppercase font-bold">
                        {{ linkedGuest().vipTier }}
                      </span>
                    </div>
                    <span class="font-body-sm text-body-sm text-outline">{{ linkedGuest().roomName }}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="text-primary hover:text-primary-container p-1 cursor-pointer"
                  title="Modifier le client"
                  (click)="showToast('Sélection d’un autre résident bientôt disponible')"
                >
                  <span class="material-symbols-outlined text-[18px]">swap_horiz</span>
                </button>
              </div>
            </div>

            <!-- Ordered Items List (Scrollable touch list) -->
            <div class="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1" data-testid="ticket-items-list">
              @for (item of ticketItems(); track item.id) {
                <div class="p-2.5 rounded-xl bg-surface-container-low/70 hover:bg-surface-container-low flex flex-col gap-1.5 transition-colors">
                  <div class="flex items-start justify-between">
                    <div class="flex flex-col">
                      <span class="font-title-md text-title-md text-on-surface">{{ item.name }}</span>
                      @if (item.selectedOptions && item.selectedOptions.length > 0) {
                        <span class="text-xs text-outline">{{ item.selectedOptions.join(', ') }}</span>
                      }
                      @if (item.notes) {
                        <span class="text-xs text-secondary italic">{{ item.notes }}</span>
                      }
                    </div>
                    <span class="font-label-currency text-label-currency text-on-surface whitespace-nowrap">
                      {{ formatNumber(item.totalPriceFcfa) }}
                    </span>
                  </div>

                  <div class="flex items-center justify-between pt-1">
                    <div class="flex items-center gap-1.5">
                      <button
                        type="button"
                        class="w-7 h-7 rounded-lg bg-surface-container-lowest hover:bg-surface-variant flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                        (click)="decrementItem(item.id)"
                      >
                        <span class="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <span class="font-label-lg text-label-lg px-2">{{ item.quantity }}</span>
                      <button
                        type="button"
                        class="w-7 h-7 rounded-lg bg-surface-container-lowest hover:bg-surface-variant flex items-center justify-center text-outline hover:text-on-surface transition-colors cursor-pointer"
                        (click)="incrementItem(item.id)"
                      >
                        <span class="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>

                    <span class="text-xs text-outline">
                      {{ formatNumber(item.unitPriceFcfa) }} FCFA/u
                    </span>
                  </div>
                </div>
              }
              @if (ticketItems().length === 0) {
                <div class="py-8 text-center text-outline font-body-sm text-body-sm">
                  Aucun article sur ce ticket. Cliquez sur un plat du catalogue pour l'ajouter.
                </div>
              }
            </div>

            <!-- Financial Totals -->
            <div class="flex flex-col gap-2 pt-2 border-t border-surface-variant/40 font-body-sm text-body-sm">
              <div class="flex justify-between items-center text-on-surface-variant">
                <span>Sous-total HT :</span>
                <span class="font-label-currency text-label-currency text-on-surface">
                  {{ formatNumber(ticketSubtotalHt()) }} FCFA
                </span>
              </div>
              <div class="flex justify-between items-center text-on-surface-variant">
                <span>TVA (10% taux réduit hôtellerie) :</span>
                <span class="font-label-currency text-label-currency text-on-surface">
                  {{ formatNumber(ticketVat()) }} FCFA
                </span>
              </div>
              <div class="flex justify-between items-center font-title-lg text-title-lg text-on-surface pt-1 border-t border-surface-variant/30">
                <span>Total TTC :</span>
                <span class="font-label-currency text-label-currency text-primary" data-testid="ticket-total-ttc">
                  {{ formatNumber(ticketTotalTtc()) }} FCFA
                </span>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                class="h-12 rounded-xl bg-surface-container hover:bg-surface-variant text-on-surface font-title-md text-title-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                data-testid="btn-send-kitchen"
                (click)="showToast('Commande envoyée en cuisine avec succès !')"
              >
                <span class="material-symbols-outlined text-[20px]">soup_kitchen</span>
                <span>Envoi cuisine</span>
              </button>
              <button
                type="button"
                class="h-12 rounded-xl bg-surface-container hover:bg-surface-variant text-on-surface font-title-md text-title-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                data-testid="btn-print-addition"
                (click)="printAddition()"
              >
                <span class="material-symbols-outlined text-[20px]">receipt</span>
                <span>Imprimer addition</span>
              </button>
            </div>

            <button
              type="button"
              class="w-full h-14 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-title-lg text-title-lg flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.99]"
              data-testid="btn-charge-room"
              (click)="showToast('Montant de ' + formatNumber(ticketTotalTtc()) + ' FCFA transféré sur le Folio de la Suite 301')"
            >
              <span class="material-symbols-outlined text-[22px]">credit_score</span>
              <span>Transférer sur chambre 301</span>
            </button>
          </div>
        </div>
      </div>
      <!-- Modale de gestion du menu -->
      <app-menu-management-modal [isOpen]="isMenuModalOpen()" (closed)="isMenuModalOpen.set(false)" />
    </div>
  `
})
export class RestaurantPageComponent {
  readonly restaurantService = inject(RestaurantMockService);
  readonly authService = inject(AuthMockService);

  readonly toastMessage = signal<string | null>(null);
  readonly isMenuModalOpen = signal<boolean>(false);

  readonly categories = this.restaurantService.categories;
  readonly filteredDishes = this.restaurantService.filteredDishes;
  readonly activeCategory = this.restaurantService.activeCategoryId;
  readonly activeTag = this.restaurantService.activeTagFilter;
  readonly searchQuery = this.restaurantService.searchQuery;

  readonly ticketItems = this.restaurantService.ticketItems;
  readonly destinationType = this.restaurantService.destinationType;
  readonly selectedTable = this.restaurantService.selectedTable;
  readonly linkedGuest = this.restaurantService.linkedGuest;
  readonly ticketNumber = this.restaurantService.ticketNumber;
  readonly serverName = this.restaurantService.serverName;

  readonly ticketTotalTtc = this.restaurantService.ticketTotalTtcFcfa;
  readonly ticketSubtotalHt = this.restaurantService.ticketSubtotalHtFcfa;
  readonly ticketVat = this.restaurantService.ticketVatAmountFcfa;

  // Accès au bouton « Gérer le menu » : rôle DIRECTION ou RESTAURANT (Règle 1)
  readonly canManageMenu = computed(() => {
    const role = this.authService.currentUser()?.role;
    return role === Role.DIRECTION || role === Role.RESTAURANT;
  });

  selectCategory(id: string): void {
    this.restaurantService.setActiveCategory(id);
  }

  filterByTag(tag: string): void {
    this.restaurantService.setTagFilter(tag);
  }

  onSearchChange(q: string): void {
    this.restaurantService.setSearchQuery(q);
  }

  onDishClick(dish: DishItem): void {
    if (dish.status === 'SOLD_OUT') {
      this.showToast(`Le plat « ${dish.name} » est actuellement épuisé.`);
      return;
    }
    this.restaurantService.addDishToTicket(dish);
  }

  incrementItem(id: string): void {
    this.restaurantService.incrementItem(id);
  }

  decrementItem(id: string): void {
    this.restaurantService.decrementItem(id);
  }

  clearTicket(): void {
    this.restaurantService.clearTicket();
  }

  setDestinationType(type: 'TABLE' | 'ROOM'): void {
    this.restaurantService.setDestinationType(type);
  }

  selectTable(table: string): void {
    this.restaurantService.setSelectedTable(table);
  }

  openMenuManagement(): void {
    this.isMenuModalOpen.set(true);
  }

  printAddition(): void {
    window.print();
  }

  formatNumber(val: number): string {
    const clean = Math.round(val || 0);
    return clean.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }
}
