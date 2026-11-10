import {
  Component,
  computed,
  effect,
  inject,
  signal,
  WritableSignal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatFcfa } from '@residence-blue/shared';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import {
  CategoryCardOption,
  GuestMode,
  NewGuestData,
  PaymentChannelType,
  PaymentStatusType,
  RegularGuest,
  ReservationCostBreakdown,
  ReservationSubmitPayload,
  RoomCategoryType,
  SpecificRoomOption
} from '../../../core/models/reservation-modal.model';

@Component({
  selector: 'app-new-reservation-modal',
  standalone: true,
  imports: [CommonModule, ModalShellComponent],
  template: `
    <app-modal-shell
      [isOpen]="modalService.isOpen()"
      [title]="'Nouvelle réservation'"
      [badge]="'Boutique 12 Clés'"
      [subtitle]="'Enregistrement séjour & émission du bon de confirmation • Thiès Grand Standing'"
      [icon]="'calendar_add_on'"
      [testId]="'modal-nouvelle-reservation'"
      [maxWidth]="'960px'"
      [maxHeight]="'88dvh'"
      (closed)="onClose()"
    >
      <!-- MODAL BODY -->
      <div modal-body class="flex flex-col gap-4 text-on-surface">
        @if (modalService.errorMessage(); as errorMsg) {
          <div
            class="p-3 rounded-xl bg-error-container text-on-error-container border border-error/30 flex items-center gap-2 text-xs sm:text-sm font-semibold shadow-xs"
            role="alert"
            data-testid="reservation-conflict-error"
          >
            <span class="material-symbols-outlined text-error text-[20px]" aria-hidden="true">warning</span>
            <span>{{ errorMsg }}</span>
          </div>
        }
        <div class="flex flex-col min-[900px]:flex-row gap-4 items-start">
          <!-- LEFT COLUMN: Saisie Opérationnelle -->
          <div class="flex-1 w-full min-w-0 flex flex-col gap-4">
            <!-- 1. Client Section (Réduite à deux lignes) -->
            <section class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-sm" data-testid="section-client">
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">1</span>
                  <h3 class="font-title-md text-sm sm:text-base font-semibold text-on-surface">Client &amp; Contact</h3>
                </div>
                <!-- Segmented Control -->
                <div class="inline-flex p-0.5 rounded-lg bg-surface-container text-xs">
                  <button
                    type="button"
                    (click)="setGuestMode('REGULAR')"
                    data-testid="guest-mode-regular"
                    [class]="guestMode() === 'REGULAR'
                      ? 'px-2.5 py-1 rounded-md bg-surface-container-lowest text-primary shadow-sm font-semibold transition-all cursor-pointer'
                      : 'px-2.5 py-1 rounded-md text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'"
                  >
                    Client régulier
                  </button>
                  <button
                    type="button"
                    (click)="setGuestMode('NEW')"
                    data-testid="guest-mode-new"
                    [class]="guestMode() === 'NEW'
                      ? 'px-2.5 py-1 rounded-md bg-surface-container-lowest text-primary shadow-sm font-semibold transition-all cursor-pointer'
                      : 'px-2.5 py-1 rounded-md text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'"
                  >
                    + Nouveau client
                  </button>
                </div>
              </div>

              <!-- Carte Client Régulier Réduite à Deux Lignes -->
              @if (guestMode() === 'REGULAR') {
                <div class="p-2.5 rounded-lg bg-surface-container-lowest flex flex-col gap-1.5 border border-outline-variant/15">
                  <!-- Ligne 1 : Avatar, Nom, Badge VIP, Bouton Changer -->
                  <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xs shrink-0">
                        {{ selectedRegularGuest().initials }}
                      </div>
                      <div class="flex items-center gap-2 truncate">
                        <span class="font-title-md text-sm sm:text-base font-bold text-on-surface truncate">
                          {{ selectedRegularGuest().name }}
                        </span>
                        @if (selectedRegularGuest().vipBadge) {
                          <span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-[11px] font-semibold flex items-center gap-1 shrink-0">
                            <span class="material-symbols-outlined text-[13px]" aria-hidden="true">{{ selectedRegularGuest().vipIcon || 'star' }}</span>
                            {{ selectedRegularGuest().vipBadge }}
                          </span>
                        }
                      </div>
                    </div>
                    <div class="relative shrink-0">
                      <button
                        type="button"
                        (click)="toggleChangeGuestMenu()"
                        class="px-2.5 py-1 rounded-md bg-surface-container-high hover:bg-surface-variant text-on-surface-variant text-xs font-medium transition-colors cursor-pointer"
                      >
                        Changer
                      </button>
                      @if (isChangingGuest()) {
                        <div class="absolute right-0 top-full mt-1 w-64 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 py-1 z-30">
                          @for (guest of modalService.regularGuests; track guest.id) {
                            <button
                              type="button"
                              (click)="selectRegularGuest(guest)"
                              class="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-container flex items-center justify-between cursor-pointer"
                            >
                              <span class="font-medium text-on-surface">{{ guest.name }}</span>
                              <span class="text-[11px] text-outline">{{ guest.vipBadge || 'Standard' }}</span>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                  <!-- Ligne 2 : Coordonnées (téléphone, email, ville) -->
                  <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-outline pl-10.5">
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]" aria-hidden="true">call</span>
                      {{ selectedRegularGuest().phone }}
                    </span>
                    <span>•</span>
                    <span class="flex items-center gap-1 truncate max-w-[200px]">
                      <span class="material-symbols-outlined text-[14px]" aria-hidden="true">mail</span>
                      {{ selectedRegularGuest().email }}
                    </span>
                    <span>•</span>
                    <span>{{ selectedRegularGuest().city }}</span>
                  </div>
                </div>
              } @else {
                <!-- Nouveau client Form Compact -->
                <div class="p-2.5 rounded-lg bg-surface-container-lowest grid grid-cols-1 sm:grid-cols-2 gap-2 border border-outline-variant/15">
                  <div>
                    <label for="new-guest-name" class="block text-[11px] font-semibold text-outline uppercase tracking-wider mb-0.5">
                      Nom complet *
                    </label>
                    <input
                      id="new-guest-name"
                      type="text"
                      [value]="newGuest().fullName"
                      (input)="onNewGuestFullNameInput($event)"
                      placeholder="Ex: M. Ousmane Sonko"
                      class="w-full h-8 px-2.5 rounded-md bg-surface-container-low text-on-surface text-xs outline-none border border-outline-variant/30 focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label for="new-guest-phone" class="block text-[11px] font-semibold text-outline uppercase tracking-wider mb-0.5">
                      Téléphone *
                    </label>
                    <input
                      id="new-guest-phone"
                      type="tel"
                      [value]="newGuest().phone"
                      (input)="onNewGuestPhoneInput($event)"
                      placeholder="Ex: +221 77 000 00 00"
                      class="w-full h-8 px-2.5 rounded-md bg-surface-container-low text-on-surface text-xs outline-none border border-outline-variant/30 focus:border-primary"
                      required
                    />
                  </div>
                  <div>
                    <label for="new-guest-email" class="block text-[11px] font-semibold text-outline uppercase tracking-wider mb-0.5">
                      E-mail
                    </label>
                    <input
                      id="new-guest-email"
                      type="email"
                      [value]="newGuest().email"
                      (input)="onNewGuestEmailInput($event)"
                      placeholder="client@domaine.sn"
                      class="w-full h-8 px-2.5 rounded-md bg-surface-container-low text-on-surface text-xs outline-none border border-outline-variant/30 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label for="new-guest-city" class="block text-[11px] font-semibold text-outline uppercase tracking-wider mb-0.5">
                      Ville / Résidence
                    </label>
                    <input
                      id="new-guest-city"
                      type="text"
                      [value]="newGuest().city"
                      (input)="onNewGuestCityInput($event)"
                      placeholder="Dakar, Thiès, Somone..."
                      class="w-full h-8 px-2.5 rounded-md bg-surface-container-low text-on-surface text-xs outline-none border border-outline-variant/30 focus:border-primary"
                    />
                  </div>
                </div>
              }
            </section>

            <!-- 2. Séjour & Occupants (Dates sur 1 ligne + Occupants côte à côte) -->
            <section class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-sm" data-testid="section-sejour">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">2</span>
                <h3 class="font-title-md text-sm sm:text-base font-semibold text-on-surface">Séjour &amp; Occupants</h3>
              </div>

              <!-- Ligne 1 : Date Arrivée, Nuits badge, Date Départ sur une seule ligne -->
              <div class="p-2.5 rounded-lg bg-surface-container-lowest grid grid-cols-12 gap-2 items-center border border-outline-variant/15">
                <!-- Date Arrivée -->
                <div class="col-span-5 flex items-center gap-2 min-w-0">
                  <span class="material-symbols-outlined text-primary text-[20px] shrink-0" aria-hidden="true">flight_land</span>
                  <div class="min-w-0 flex-1">
                    <label for="input-date-checkin" class="block text-[11px] uppercase tracking-wider text-outline font-semibold truncate">
                      Arrivée
                    </label>
                    <input
                      id="input-date-checkin"
                      type="date"
                      [value]="checkInDate()"
                      (input)="onCheckInChange($event)"
                      class="bg-transparent text-xs sm:text-sm font-bold text-on-surface outline-none cursor-pointer w-full p-0"
                    />
                  </div>
                </div>

                <!-- Nuits Badge au centre -->
                <div class="col-span-2 flex flex-col items-center justify-center">
                  <span class="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold shadow-sm whitespace-nowrap">
                    {{ nightsCount() }} nuit{{ nightsCount() > 1 ? 's' : '' }}
                  </span>
                  <span class="material-symbols-outlined text-primary text-[14px] mt-0.5" aria-hidden="true">arrow_forward</span>
                </div>

                <!-- Date Départ -->
                <div class="col-span-5 flex items-center gap-2 min-w-0">
                  <span class="material-symbols-outlined text-primary text-[20px] shrink-0" aria-hidden="true">flight_takeoff</span>
                  <div class="min-w-0 flex-1">
                    <label for="input-date-checkout" class="block text-[11px] uppercase tracking-wider text-outline font-semibold truncate">
                      Départ
                    </label>
                    <input
                      id="input-date-checkout"
                      type="date"
                      [value]="checkOutDate()"
                      (input)="onCheckOutChange($event)"
                      class="bg-transparent text-xs sm:text-sm font-bold text-on-surface outline-none cursor-pointer w-full p-0"
                    />
                  </div>
                </div>
              </div>

              <!-- Ligne 2 : Adultes et Enfants côte à côte (steppers h-10) -->
              <div class="grid grid-cols-2 gap-2">
                <!-- Adultes -->
                <div class="p-2 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2 border border-outline-variant/15">
                  <div class="min-w-0">
                    <span class="font-title-md text-xs sm:text-sm font-bold block text-on-surface truncate">Adultes</span>
                    <span class="text-[11px] text-outline truncate block">+12 ans</span>
                  </div>
                  <div class="flex items-center gap-1.5 bg-surface-container-low rounded-lg p-1 h-10 shrink-0">
                    <button
                      type="button"
                      (click)="decrementAdults()"
                      [disabled]="adultsCount() <= 1"
                      aria-label="Diminuer les adultes"
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface font-bold disabled:opacity-40 cursor-pointer min-w-[28px] min-h-[28px]"
                    >
                      -
                    </button>
                    <span class="w-4 text-center font-bold text-xs sm:text-sm">{{ adultsCount() }}</span>
                    <button
                      type="button"
                      (click)="incrementAdults()"
                      [disabled]="adultsCount() >= 8"
                      aria-label="Augmenter les adultes"
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface font-bold disabled:opacity-40 cursor-pointer min-w-[28px] min-h-[28px]"
                    >
                      +
                    </button>
                  </div>
                </div>

                <!-- Enfants -->
                <div class="p-2 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2 border border-outline-variant/15">
                  <div class="min-w-0">
                    <span class="font-title-md text-xs sm:text-sm font-bold block text-on-surface truncate">Enfants</span>
                    <span class="text-[11px] text-outline truncate block">Lit supp. 25k</span>
                  </div>
                  <div class="flex items-center gap-1.5 bg-surface-container-low rounded-lg p-1 h-10 shrink-0">
                    <button
                      type="button"
                      (click)="decrementChildren()"
                      [disabled]="childrenCount() <= 0"
                      aria-label="Diminuer les enfants"
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface font-bold disabled:opacity-40 cursor-pointer min-w-[28px] min-h-[28px]"
                    >
                      -
                    </button>
                    <span class="w-4 text-center font-bold text-xs sm:text-sm">{{ childrenCount() }}</span>
                    <button
                      type="button"
                      (click)="incrementChildren()"
                      [disabled]="childrenCount() >= 6"
                      aria-label="Augmenter les enfants"
                      class="w-7 h-7 sm:w-8 sm:h-8 rounded bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface font-bold disabled:opacity-40 cursor-pointer min-w-[28px] min-h-[28px]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <!-- 3. Choix de la Chambre & Catégorie -->
            <section class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-sm" data-testid="section-categorie">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">3</span>
                  <h3 class="font-title-md text-sm sm:text-base font-semibold text-on-surface">Catégorie &amp; Attribution Clé</h3>
                </div>
                <span class="text-xs text-primary font-semibold">Taux d'occupation : 75%</span>
              </div>

              <!-- Categories Radio Grid (3 cartes compactes) -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <!-- Standard -->
                <label
                  (click)="selectCategory('Standard')"
                  data-testid="category-card-Standard"
                  [class]="selectedCategory() === 'Standard'
                    ? 'cursor-pointer rounded-lg p-2.5 bg-primary-fixed/20 shadow-sm border border-primary/30 flex flex-col justify-between transition-all'
                    : 'cursor-pointer rounded-lg p-2.5 bg-surface-container-lowest hover:bg-surface-container transition-all flex flex-col justify-between border border-outline-variant/15'"
                >
                  <input type="radio" name="room_category" value="Standard" [checked]="selectedCategory() === 'Standard'" class="sr-only" />
                  <div class="flex items-start justify-between">
                    <span class="text-[11px] px-1.5 py-0.5 rounded-full bg-surface-variant text-on-surface-variant font-medium">2 dispo</span>
                    <div [class]="selectedCategory() === 'Standard' ? 'w-4 h-4 rounded-full bg-primary flex items-center justify-center text-on-primary' : 'w-4 h-4 rounded-full bg-surface-container-high'">
                      @if (selectedCategory() === 'Standard') {
                        <span class="material-symbols-outlined text-[12px]">check</span>
                      }
                    </div>
                  </div>
                  <div class="mt-2">
                    <span class="font-bold text-xs sm:text-sm block text-on-surface">Standard</span>
                    <span class="text-[11px] text-outline block">Jardin tropical</span>
                    <span class="font-bold text-xs sm:text-sm block text-on-surface mt-1 whitespace-nowrap">
                      85&nbsp;000 <span class="text-[11px] text-outline font-normal">FCFA/nuit</span>
                    </span>
                  </div>
                </label>

                <!-- Deluxe (Badge Recommandé) -->
                <label
                  (click)="selectCategory('Deluxe')"
                  data-testid="category-card-Deluxe"
                  [class]="selectedCategory() === 'Deluxe'
                    ? 'cursor-pointer rounded-lg p-2.5 bg-primary-fixed/20 shadow-sm border border-primary/40 flex flex-col justify-between transition-all relative'
                    : 'cursor-pointer rounded-lg p-2.5 bg-surface-container-lowest hover:bg-surface-container transition-all flex flex-col justify-between border border-outline-variant/15'"
                >
                  <input type="radio" name="room_category" value="Deluxe" [checked]="selectedCategory() === 'Deluxe'" class="sr-only" />
                  <div class="flex items-start justify-between">
                    <span class="text-[11px] px-1.5 py-0.5 rounded-full bg-primary text-on-primary font-medium">Recommandé</span>
                    <div [class]="selectedCategory() === 'Deluxe' ? 'w-4 h-4 rounded-full bg-primary flex items-center justify-center text-on-primary' : 'w-4 h-4 rounded-full bg-surface-container-high'">
                      @if (selectedCategory() === 'Deluxe') {
                        <span class="material-symbols-outlined text-[12px]">check</span>
                      }
                    </div>
                  </div>
                  <div class="mt-2">
                    <span class="font-bold text-xs sm:text-sm block text-primary" data-adapted-zone="deluxe-title">Deluxe Balcon</span>
                    <span class="text-[11px] text-on-surface-variant block" data-adapted-zone="deluxe-desc">1er Étage &amp; Balcon Large</span>
                    <span class="font-bold text-xs sm:text-sm block text-primary mt-1 whitespace-nowrap">
                      130&nbsp;000 <span class="text-[11px] text-outline font-normal">FCFA/nuit</span>
                    </span>
                  </div>
                </label>

                <!-- Suite -->
                <label
                  (click)="selectCategory('Suite')"
                  data-testid="category-card-Suite"
                  [class]="selectedCategory() === 'Suite'
                    ? 'cursor-pointer rounded-lg p-2.5 bg-primary-fixed/20 shadow-sm border border-primary/30 flex flex-col justify-between transition-all'
                    : 'cursor-pointer rounded-lg p-2.5 bg-surface-container-lowest hover:bg-surface-container transition-all flex flex-col justify-between border border-outline-variant/15'"
                >
                  <input type="radio" name="room_category" value="Suite" [checked]="selectedCategory() === 'Suite'" class="sr-only" />
                  <div class="flex items-start justify-between">
                    <span class="text-[11px] px-1.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-medium">Dernière clé</span>
                    <div [class]="selectedCategory() === 'Suite' ? 'w-4 h-4 rounded-full bg-primary flex items-center justify-center text-on-primary' : 'w-4 h-4 rounded-full bg-surface-container-high'">
                      @if (selectedCategory() === 'Suite') {
                        <span class="material-symbols-outlined text-[12px]">check</span>
                      }
                    </div>
                  </div>
                  <div class="mt-2">
                    <span class="font-bold text-xs sm:text-sm block text-on-surface">Suite Panoramique</span>
                    <span class="text-[11px] text-outline block">Terrasse privée rooftop</span>
                    <span class="font-bold text-xs sm:text-sm block text-on-surface mt-1 whitespace-nowrap">
                      210&nbsp;000 <span class="text-[11px] text-outline font-normal">FCFA/nuit</span>
                    </span>
                  </div>
                </label>
              </div>

              <!-- Attribution de la chambre spécifique (Dropdown compact) -->
              <div class="p-2.5 rounded-lg bg-surface-container-lowest flex items-center justify-between gap-2 border border-outline-variant/15">
                <div class="flex items-center gap-2 min-w-0">
                  <div class="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <span class="material-symbols-outlined text-[18px]">key</span>
                  </div>
                  <div class="min-w-0">
                    <span class="text-[11px] uppercase tracking-wider text-outline block font-semibold truncate">
                      Attribution clé physique
                    </span>
                    <span class="font-bold text-xs sm:text-sm text-on-surface truncate block" data-adapted-zone="room-assigned">
                      Chambre {{ currentRoomOption().number }} - {{ currentRoomOption().label }}
                    </span>
                  </div>
                </div>
                <div class="relative shrink-0">
                  <select
                    [value]="selectedRoomNumber()"
                    (change)="onRoomChange($event)"
                    data-testid="select-room"
                    aria-label="Sélectionner la chambre spécifique"
                    class="h-8 pl-2 pr-6 rounded-md bg-surface-container-low text-primary font-bold text-xs outline-none cursor-pointer border border-outline-variant/30 focus:border-primary"
                  >
                    @for (r of availableRoomsForCategory(); track r.number) {
                      <option [value]="r.number" [selected]="r.number === selectedRoomNumber()">
                        Ch. {{ r.number }} ({{ r.floor }})
                      </option>
                    }
                  </select>
                </div>
              </div>
            </section>

            <!-- 4. Règlement & Acompte -->
            <section class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-sm" data-testid="section-paiement">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">4</span>
                <h3 class="font-title-md text-sm sm:text-base font-semibold text-on-surface">Acompte &amp; Mode de Règlement</h3>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <!-- Montant Acompte -->
                <div class="p-2.5 rounded-lg bg-surface-container-lowest flex flex-col justify-between border border-outline-variant/15">
                  <label for="input-deposit" class="text-[11px] text-outline uppercase tracking-wider font-semibold">
                    Montant de l'acompte (FCFA)
                  </label>
                  <div class="flex items-center justify-between gap-2 mt-1">
                    <input
                      id="input-deposit"
                      type="text"
                      [value]="depositInputFormatted()"
                      (change)="onDepositInputChange($event)"
                      class="bg-surface-container-low text-on-surface font-bold text-sm px-2.5 py-1.5 rounded-md w-full max-w-[150px] outline-none"
                    />
                    <span class="px-2 py-0.5 rounded-full bg-surface-variant text-[11px] text-on-surface-variant font-medium shrink-0">
                      ~{{ depositPercentage() }}% du total
                    </span>
                  </div>
                </div>

                <!-- Statut Versement -->
                <div class="p-2.5 rounded-lg bg-surface-container-lowest flex flex-col justify-between border border-outline-variant/15">
                  <span class="text-[11px] text-outline uppercase tracking-wider font-semibold mb-1">
                    Statut du versement
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="setPaymentStatus('PERCU')"
                      [class]="paymentStatus() === 'PERCU'
                        ? 'flex-1 py-1.5 px-2 rounded-md bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1 shadow-sm cursor-pointer min-h-[36px]'
                        : 'flex-1 py-1.5 px-2 rounded-md bg-surface-container-high text-on-surface-variant text-xs font-medium flex items-center justify-center cursor-pointer min-h-[36px]'"
                    >
                      <span class="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
                      Perçu maintenant
                    </button>
                    <button
                      type="button"
                      (click)="setPaymentStatus('EN_ATTENTE')"
                      [class]="paymentStatus() === 'EN_ATTENTE'
                        ? 'flex-1 py-1.5 px-2 rounded-md bg-primary text-on-primary text-xs font-semibold flex items-center justify-center gap-1 shadow-sm cursor-pointer min-h-[36px]'
                        : 'flex-1 py-1.5 px-2 rounded-md bg-surface-container-high text-on-surface-variant text-xs font-medium flex items-center justify-center cursor-pointer min-h-[36px]'"
                    >
                      En attente
                    </button>
                  </div>
                </div>
              </div>

              <!-- Canaux d'encaissement (4 blocs compacts) -->
              <div>
                <span class="text-[11px] text-outline uppercase tracking-wider block mb-1 font-semibold">
                  Canal d'encaissement
                </span>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <!-- Wave -->
                  <button
                    type="button"
                    (click)="setPaymentChannel('WAVE')"
                    [class]="paymentChannel() === 'WAVE'
                      ? 'p-2 rounded-lg bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-0.5 cursor-pointer min-h-[44px]'
                      : 'p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface flex flex-col items-center gap-0.5 border border-outline-variant/15 cursor-pointer min-h-[44px]'"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">send_to_mobile</span>
                    <span class="text-xs font-bold">Wave</span>
                    <span class="text-[10px] opacity-80">Instantané</span>
                  </button>

                  <!-- Orange Money -->
                  <button
                    type="button"
                    (click)="setPaymentChannel('ORANGE_MONEY')"
                    [class]="paymentChannel() === 'ORANGE_MONEY'
                      ? 'p-2 rounded-lg bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-0.5 cursor-pointer min-h-[44px]'
                      : 'p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface flex flex-col items-center gap-0.5 border border-outline-variant/15 cursor-pointer min-h-[44px]'"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">smartphone</span>
                    <span class="text-xs font-bold">Orange Money</span>
                    <span class="text-[10px] opacity-80">Mobile</span>
                  </button>

                  <!-- Carte TPE -->
                  <button
                    type="button"
                    (click)="setPaymentChannel('CARTE_TPE')"
                    [class]="paymentChannel() === 'CARTE_TPE'
                      ? 'p-2 rounded-lg bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-0.5 cursor-pointer min-h-[44px]'
                      : 'p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface flex flex-col items-center gap-0.5 border border-outline-variant/15 cursor-pointer min-h-[44px]'"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">credit_card</span>
                    <span class="text-xs font-bold">Carte TPE</span>
                    <span class="text-[10px] opacity-80">Visa/Mastercard</span>
                  </button>

                  <!-- Espèces -->
                  <button
                    type="button"
                    (click)="setPaymentChannel('ESPECES')"
                    [class]="paymentChannel() === 'ESPECES'
                      ? 'p-2 rounded-lg bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-0.5 cursor-pointer min-h-[44px]'
                      : 'p-2 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface flex flex-col items-center gap-0.5 border border-outline-variant/15 cursor-pointer min-h-[44px]'"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">payments</span>
                    <span class="text-xs font-bold">Espèces</span>
                    <span class="text-[10px] opacity-80">Front-desk</span>
                  </button>
                </div>
              </div>
            </section>

            <!-- 5. Demandes Particulières & Conciergerie (Section Repliable par Défaut) -->
            <section class="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3 shadow-sm" data-testid="section-notes">
              <button
                type="button"
                (click)="toggleSpecialRequests()"
                class="flex items-center justify-between w-full text-left cursor-pointer min-h-[36px]"
                data-testid="toggle-special-requests"
              >
                <div class="flex items-center gap-2">
                  <span class="w-5 h-5 rounded-full bg-primary text-on-primary text-xs flex items-center justify-center font-bold">5</span>
                  <h3 class="font-title-md text-sm sm:text-base font-semibold text-on-surface">Demandes Particulières &amp; Conciergerie</h3>
                  @if (specialRequests().trim().length > 0) {
                    <span class="w-2 h-2 rounded-full bg-primary" title="Demandes renseignées"></span>
                  }
                </div>
                <span class="material-symbols-outlined text-[20px] text-outline transition-transform" [class.rotate-180]="isSpecialRequestsOpen()">
                  expand_more
                </span>
              </button>

              @if (isSpecialRequestsOpen() || specialRequests().trim().length > 0) {
                <textarea
                  [value]="specialRequests()"
                  (input)="onSpecialRequestsInput($event)"
                  rows="2"
                  placeholder="Indiquez les détails de vol, allergies, attentions personnalisées..."
                  class="w-full p-2.5 rounded-lg bg-surface-container-lowest text-on-surface text-xs outline-none transition-all placeholder:text-outline border border-outline-variant/30 focus:border-primary"
                ></textarea>
              }
            </section>

            <!-- Récapitulatif Mobile (< 900px) Repliable en une barre -->
            <div class="min-[900px]:hidden bg-surface-container-low rounded-xl p-3 border border-outline-variant/20 shadow-sm">
              <button
                type="button"
                (click)="toggleMobileSummary()"
                class="w-full flex items-center justify-between text-on-surface cursor-pointer min-h-[44px]"
                data-testid="toggle-mobile-summary"
              >
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">receipt_long</span>
                  <span class="text-xs sm:text-sm font-semibold">Total :</span>
                  <span class="text-primary font-bold text-sm sm:text-base whitespace-nowrap">{{ formatMoney(totalStayTtcFcfa()) }}</span>
                </div>
                <span class="material-symbols-outlined text-[20px] text-outline transition-transform" [class.rotate-180]="isMobileSummaryOpen()">
                  expand_more
                </span>
              </button>

              @if (isMobileSummaryOpen()) {
                <div class="mt-2.5 pt-2.5 border-t border-outline-variant/15 flex flex-col gap-2 text-xs">
                  <div class="flex justify-between">
                    <span class="text-outline">Hébergement ({{ nightsCount() }} nuits)</span>
                    <span class="font-bold whitespace-nowrap">{{ formatMoney(accommodationTotalFcfa()) }}</span>
                  </div>
                  @if (extraChildBedFcfa() > 0) {
                    <div class="flex justify-between">
                      <span class="text-outline">Lit suppl. enfant</span>
                      <span class="font-bold whitespace-nowrap">{{ formatMoney(extraChildBedFcfa()) }}</span>
                    </div>
                  }
                  @if (airportShuttleFcfa() > 0) {
                    <div class="flex justify-between">
                      <span class="text-outline">Navette AIBD</span>
                      <span class="font-bold whitespace-nowrap">{{ formatMoney(airportShuttleFcfa()) }}</span>
                    </div>
                  }
                  <div class="flex justify-between">
                    <span class="text-outline">Taxe de séjour</span>
                    <span class="font-bold whitespace-nowrap">{{ formatMoney(cityTaxFcfa()) }}</span>
                  </div>
                  <div class="flex justify-between pt-1 border-t border-outline-variant/15 font-bold">
                    <span>Acompte déduit</span>
                    <span class="text-primary whitespace-nowrap">-{{ formatMoney(depositAmountFcfa()) }}</span>
                  </div>
                  <div class="flex justify-between font-bold text-on-secondary-container bg-secondary-fixed/50 p-2 rounded-lg">
                    <span>Solde dû</span>
                    <span class="whitespace-nowrap">{{ formatMoney(remainingBalanceFcfa()) }}</span>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- RIGHT COLUMN: Résumé Desktop (>= 900px, max 300px, sticky top-0) -->
          <div class="hidden min-[900px]:block w-[290px] xl:w-[300px] shrink-0 sticky top-0" data-testid="live-breakdown-panel">
            <div class="bg-surface-container-low rounded-xl p-3 flex flex-col gap-2.5 shadow-sm border border-outline-variant/15">
              <!-- Aperçu chambre avec photo 56px -->
              <div class="flex items-center gap-2.5 pb-2 border-b border-outline-variant/15">
                <div class="w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-sm" data-photo-zone="room-preview-photo">
                  <img
                    [src]="roomImageUrl()"
                    [alt]="'Photo de la ' + currentRoomOption().label"
                    class="w-full h-full object-cover"
                    (error)="onImageError($event)"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <span class="text-[10px] uppercase tracking-wider text-primary font-bold block truncate">
                    Résidence Blue • Thiès
                  </span>
                  <h4 class="font-bold text-xs sm:text-sm text-on-surface truncate" data-adapted-zone="summary-room-title">
                    Ch. {{ currentRoomOption().number }} - {{ currentRoomOption().category === 'Deluxe' ? 'Deluxe Mer' : currentRoomOption().label }}
                  </h4>
                  <p class="text-[11px] text-outline truncate" data-adapted-zone="summary-room-sub">
                    {{ currentRoomOption().category === 'Deluxe' ? "Balcon privé • Face océan" : currentRoomOption().details }}
                  </p>
                </div>
              </div>

              <!-- Attributs séjour -->
              <div class="bg-surface-container-lowest p-2 rounded-lg flex flex-col gap-1 text-xs border border-outline-variant/15">
                <div class="flex items-center justify-between">
                  <span class="text-outline flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">calendar_month</span>
                    Séjour
                  </span>
                  <span class="font-bold text-on-surface">
                    {{ stayDateRangeFormatted() }} ({{ nightsCount() }}n)
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-outline flex items-center gap-1">
                    <span class="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">group</span>
                    Occupants
                  </span>
                  <span class="font-bold text-on-surface">
                    {{ adultsCount() }} Ad.{{ childrenCount() > 0 ? ', ' + childrenCount() + ' Enf.' : '' }}
                  </span>
                </div>
              </div>

              <!-- Lignes de ventilation tarifaire plus serrées -->
              <div class="flex flex-col gap-1 text-xs py-0.5">
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant truncate">Hébergement ({{ nightsCount() }}n)</span>
                  <span class="font-bold text-on-surface whitespace-nowrap">{{ formatMoney(accommodationTotalFcfa()) }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant">Petit-déj. Teranga</span>
                  <span class="text-[10px] font-bold px-1.5 py-0.2 rounded bg-surface-variant text-on-surface-variant">Inclus</span>
                </div>
                @if (extraChildBedFcfa() > 0) {
                  <div class="flex items-center justify-between">
                    <span class="text-on-surface-variant">Lit suppl. enfant</span>
                    <span class="font-bold text-on-surface whitespace-nowrap">{{ formatMoney(extraChildBedFcfa()) }}</span>
                  </div>
                }
                @if (airportShuttleFcfa() > 0) {
                  <div class="flex items-center justify-between">
                    <span class="text-on-surface-variant">Navette AIBD</span>
                    <span class="font-bold text-on-surface whitespace-nowrap">{{ formatMoney(airportShuttleFcfa()) }}</span>
                  </div>
                }
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant">Taxe de séjour</span>
                  <span class="font-bold text-on-surface whitespace-nowrap">{{ formatMoney(cityTaxFcfa()) }}</span>
                </div>
              </div>

              <!-- Totaux & Soldes -->
              <div class="bg-surface-container-lowest p-2.5 rounded-lg flex flex-col gap-1.5 border border-outline-variant/15">
                <div class="flex items-baseline justify-between">
                  <span class="text-xs font-bold text-on-surface">Total Séjour TTC</span>
                  <span class="text-sm font-bold text-primary tracking-tight whitespace-nowrap">
                    {{ formatMoney(totalStayTtcFcfa()) }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs">
                  <span class="text-outline truncate">
                    Acompte {{ paymentStatus() === 'PERCU' ? 'perçu' : 'en attente' }}
                  </span>
                  <span class="font-bold text-primary whitespace-nowrap">
                    {{ paymentStatus() === 'PERCU' ? '- ' : '' }}{{ formatMoney(depositAmountFcfa()) }}
                  </span>
                </div>
                <div class="p-1.5 rounded-md bg-secondary-fixed/50 flex items-center justify-between mt-0.5">
                  <span class="text-[11px] font-bold text-on-secondary-fixed-variant uppercase">Solde dû</span>
                  <span class="text-xs font-bold text-on-secondary-container whitespace-nowrap">
                    {{ formatMoney(remainingBalanceFcfa()) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MODAL FIXED FOOTER (Toujours visible avec Total TTC et Bouton de confirmation) -->
      <div modal-footer class="w-full flex items-center justify-between flex-wrap gap-2 sm:gap-3">
        <!-- Récapitulatif Total TTC dans le footer -->
        <div class="flex items-center gap-2">
          <span class="text-xs uppercase tracking-wider text-outline font-semibold">Total TTC :</span>
          <span class="font-bold text-primary text-sm sm:text-base whitespace-nowrap" data-testid="total-ttc-amount">
            {{ formatAmountNumberOnly(totalStayTtcFcfa()) }}&nbsp;FCFA
          </span>
          <span class="text-xs text-outline hidden sm:inline">
            • Solde dû : <strong class="text-on-surface whitespace-nowrap" data-testid="remaining-balance-amount">{{ formatMoney(remainingBalanceFcfa()) }}</strong>
          </span>
        </div>

        <!-- Boutons d'action -->
        <div class="flex items-center gap-2 shrink-0">
          <button
            type="button"
            (click)="onClose()"
            class="px-3.5 py-2 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface-variant font-label-md text-xs sm:text-sm font-medium transition-colors cursor-pointer min-h-[44px]"
          >
            Annuler
          </button>
          <button
            type="button"
            (click)="onConfirm()"
            [disabled]="isSubmitDisabled()"
            data-testid="btn-submit-reservation"
            [class]="isSubmitDisabled()
              ? 'inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-outline-variant/60 text-surface-container-highest font-label-md text-xs sm:text-sm shadow-none cursor-not-allowed min-h-[44px]'
              : 'inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-md text-xs sm:text-sm font-bold shadow-md transition-all cursor-pointer min-h-[44px]'"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">done_all</span>
            <span>Confirmer la réservation</span>
          </button>
        </div>
      </div>
    </app-modal-shell>

    @if (modalService.feedbackMessage(); as msg) {
      <div
        class="fixed bottom-6 right-6 z-50 bg-primary text-on-primary px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in"
        data-testid="toast-reservation-success"
        role="alert"
      >
        <div class="w-9 h-9 rounded-xl bg-on-primary/10 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-[22px]">verified</span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs sm:text-sm font-bold">Réservation confirmée avec succès !</span>
          <span class="text-xs opacity-90">{{ msg }}</span>
        </div>
      </div>
    }
  `
})
export class NewReservationModalComponent {
  readonly modalService: ReservationModalService;

  // État formulaire
  readonly guestMode = signal<GuestMode>('REGULAR');
  readonly selectedRegularGuest: WritableSignal<RegularGuest>;
  readonly isChangingGuest = signal<boolean>(false);
  readonly newGuest = signal<NewGuestData>({
    fullName: '',
    phone: '',
    email: '',
    city: ''
  });

  readonly checkInDate = signal<string>('2024-05-30');
  readonly checkOutDate = signal<string>('2024-06-02');
  readonly adultsCount = signal<number>(2);
  readonly childrenCount = signal<number>(1);

  readonly selectedCategory = signal<RoomCategoryType>('Deluxe');
  readonly selectedRoomNumber = signal<string>('201');

  readonly depositAmountFcfa = signal<number>(150000);
  readonly paymentStatus = signal<PaymentStatusType>('PERCU');
  readonly paymentChannel = signal<PaymentChannelType>('WAVE');

  readonly airportShuttleIncluded = signal<boolean>(true);
  readonly extraChildBedIncluded = signal<boolean>(true);
  readonly specialRequests = signal<string>('');

  // Sections repliables
  readonly isSpecialRequestsOpen = signal<boolean>(false);
  readonly isMobileSummaryOpen = signal<boolean>(false);

  // Image de la chambre
  readonly roomImageUrl = signal<string>('/assets/images/chambres/chambre-201-deluxe-800w.webp');

  private readonly initialSnapshot = {
    checkInDate: '2024-05-30',
    checkOutDate: '2024-06-02',
    adultsCount: 2,
    childrenCount: 1,
    selectedCategory: 'Deluxe' as RoomCategoryType,
    selectedRoomNumber: '201',
    depositAmountFcfa: 150000,
    paymentStatus: 'PERCU' as PaymentStatusType,
    paymentChannel: 'WAVE' as PaymentChannelType,
    guestMode: 'REGULAR' as GuestMode,
    specialRequests: ''
  };

  constructor(modalService?: ReservationModalService) {
    this.modalService = modalService ?? inject(ReservationModalService);
    this.selectedRegularGuest = signal<RegularGuest>(this.modalService.regularGuests[0]);

    effect(
      () => {
        const params = this.modalService.currentParams();
        if (params) {
          if (params.category) {
            this.selectedCategory.set(params.category);
          }
          if (params.roomNumber) {
            this.selectedRoomNumber.set(params.roomNumber);
            const r = this.modalService.getRoomByNumber(params.roomNumber);
            if (r) {
              this.selectedCategory.set(r.category);
              this.updateRoomImage(r.number, r.category);
            }
          }
          if (params.checkInDate) {
            this.checkInDate.set(params.checkInDate);
          }
          if (params.checkOutDate) {
            this.checkOutDate.set(params.checkOutDate);
          }
        }
      },
      { allowSignalWrites: true }
    );
  }

  isFormDirty(): boolean {
    if (this.guestMode() !== this.initialSnapshot.guestMode) return true;
    if (this.guestMode() === 'NEW') {
      const ng = this.newGuest();
      if (ng.fullName || ng.phone || ng.email || ng.city) return true;
    }
    if (this.checkInDate() !== this.initialSnapshot.checkInDate) return true;
    if (this.checkOutDate() !== this.initialSnapshot.checkOutDate) return true;
    if (this.adultsCount() !== this.initialSnapshot.adultsCount) return true;
    if (this.childrenCount() !== this.initialSnapshot.childrenCount) return true;
    if (this.selectedCategory() !== this.initialSnapshot.selectedCategory) return true;
    if (this.selectedRoomNumber() !== this.initialSnapshot.selectedRoomNumber) return true;
    if (this.depositAmountFcfa() !== this.initialSnapshot.depositAmountFcfa) return true;
    if (this.paymentStatus() !== this.initialSnapshot.paymentStatus) return true;
    if (this.paymentChannel() !== this.initialSnapshot.paymentChannel) return true;
    if (this.specialRequests().trim() !== this.initialSnapshot.specialRequests) return true;
    return false;
  }

  // --- Calculs Réactifs (Live Breakdown) ---

  readonly nightsCount = computed(() => {
    try {
      const inDate = new Date(this.checkInDate());
      const outDate = new Date(this.checkOutDate());
      const diffMs = outDate.getTime() - inDate.getTime();
      const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
      return days > 0 ? days : 1;
    } catch {
      return 3;
    }
  });

  readonly currentCategoryOption = computed<CategoryCardOption>(() => {
    return (
      this.modalService.categoryOptions.find((c) => c.id === this.selectedCategory()) ??
      this.modalService.categoryOptions[1]
    );
  });

  readonly availableRoomsForCategory = computed<SpecificRoomOption[]>(() => {
    return this.modalService.getRoomsForCategory(this.selectedCategory());
  });

  readonly currentRoomOption = computed<SpecificRoomOption>(() => {
    const list = this.availableRoomsForCategory();
    const found = list.find((r) => r.number === this.selectedRoomNumber());
    return found ?? list[0] ?? this.modalService.roomsCatalog[6];
  });

  readonly accommodationTotalFcfa = computed(() => {
    return this.nightsCount() * this.currentCategoryOption().ratePerNightFcfa;
  });

  readonly extraChildBedFcfa = computed(() => {
    return this.childrenCount() > 0 && this.extraChildBedIncluded() ? 25000 : 0;
  });

  readonly airportShuttleFcfa = computed(() => {
    return this.airportShuttleIncluded() ? 35000 : 0;
  });

  readonly cityTaxFcfa = computed(() => {
    return 1000 * this.adultsCount() * this.nightsCount();
  });

  readonly totalStayTtcFcfa = computed(() => {
    return (
      this.accommodationTotalFcfa() +
      this.extraChildBedFcfa() +
      this.airportShuttleFcfa() +
      this.cityTaxFcfa()
    );
  });

  readonly depositPercentage = computed(() => {
    const tot = this.totalStayTtcFcfa();
    if (tot <= 0) return 0;
    return Math.round((this.depositAmountFcfa() / tot) * 100);
  });

  readonly remainingBalanceFcfa = computed(() => {
    return Math.max(0, this.totalStayTtcFcfa() - this.depositAmountFcfa());
  });

  readonly stayDateRangeFormatted = computed(() => {
    return '30 Mai – 02 Juin';
  });

  readonly paymentChannelLabel = computed(() => {
    switch (this.paymentChannel()) {
      case 'WAVE':
        return 'Wave';
      case 'ORANGE_MONEY':
        return 'Orange Money';
      case 'CARTE_TPE':
        return 'Carte TPE';
      case 'ESPECES':
        return 'Espèces';
    }
  });

  readonly depositInputFormatted = computed(() => {
    return `${formatFcfa(this.depositAmountFcfa())}`;
  });

  readonly isSubmitDisabled = computed(() => {
    if (this.guestMode() === 'NEW') {
      const g = this.newGuest();
      if (!g.fullName.trim() || !g.phone.trim()) {
        return true;
      }
    }
    return this.nightsCount() <= 0 || !this.selectedRoomNumber();
  });

  // --- Actions Utilisateur ---

  setGuestMode(mode: GuestMode): void {
    this.guestMode.set(mode);
  }

  toggleChangeGuestMenu(): void {
    this.isChangingGuest.update((v) => !v);
  }

  selectRegularGuest(guest: RegularGuest): void {
    this.selectedRegularGuest.set(guest);
    this.isChangingGuest.set(false);
  }

  onNewGuestFullNameInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.newGuest.update((g) => ({ ...g, fullName: val }));
  }

  onNewGuestPhoneInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.newGuest.update((g) => ({ ...g, phone: val }));
  }

  onNewGuestEmailInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.newGuest.update((g) => ({ ...g, email: val }));
  }

  onNewGuestCityInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.newGuest.update((g) => ({ ...g, city: val }));
  }

  onCheckInChange(event: Event | string): void {
    const val = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.checkInDate.set(val);
  }

  onCheckOutChange(event: Event | string): void {
    const val = typeof event === 'string' ? event : (event.target as HTMLInputElement).value;
    this.checkOutDate.set(val);
  }

  onRoomChange(event: Event | string): void {
    const roomNum = typeof event === 'string' ? event : (event.target as HTMLSelectElement).value;
    this.selectedRoomNumber.set(roomNum);
    const r = this.modalService.getRoomByNumber(roomNum);
    if (r) {
      this.updateRoomImage(r.number, r.category);
    }
  }

  onSpecialRequestsInput(event: Event): void {
    const val = (event.target as HTMLTextAreaElement).value;
    this.specialRequests.set(val);
  }

  toggleSpecialRequests(): void {
    this.isSpecialRequestsOpen.update((v) => !v);
  }

  toggleMobileSummary(): void {
    this.isMobileSummaryOpen.update((v) => !v);
  }

  incrementAdults(): void {
    if (this.adultsCount() < 8) this.adultsCount.update((v) => v + 1);
  }

  decrementAdults(): void {
    if (this.adultsCount() > 1) this.adultsCount.update((v) => v - 1);
  }

  incrementChildren(): void {
    if (this.childrenCount() < 6) this.childrenCount.update((v) => v + 1);
  }

  decrementChildren(): void {
    if (this.childrenCount() > 0) this.childrenCount.update((v) => v - 1);
  }

  selectCategory(category: RoomCategoryType): void {
    this.selectedCategory.set(category);
    const rooms = this.modalService.getRoomsForCategory(category);
    const currentRoom = this.modalService.getRoomByNumber(this.selectedRoomNumber());
    if (!currentRoom || currentRoom.category !== category) {
      if (rooms.length > 0) {
        this.selectedRoomNumber.set(rooms[0].number);
        this.updateRoomImage(rooms[0].number, category);
      }
    } else {
      this.updateRoomImage(currentRoom.number, category);
    }
  }

  private updateRoomImage(roomNumber: string, category: RoomCategoryType): void {
    const slugCat = category === 'Standard' ? 'standard' : category === 'Deluxe' ? 'deluxe' : 'suite';
    this.roomImageUrl.set(`/assets/images/chambres/chambre-${roomNumber}-${slugCat}-800w.webp`);
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.src = '/assets/images/chambres/chambre-201-deluxe.jpg';
  }

  onDepositInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const rawVal = input.value.replace(/\D/g, '');
    const num = parseInt(rawVal, 10);
    if (!isNaN(num) && num >= 0) {
      this.depositAmountFcfa.set(num);
    }
  }

  setPaymentStatus(status: PaymentStatusType): void {
    this.paymentStatus.set(status);
  }

  setPaymentChannel(channel: PaymentChannelType): void {
    this.paymentChannel.set(channel);
  }

  formatMoney(amount: number): string {
    return `${new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, '\u202f')}\u202fFCFA`;
  }

  formatAmountNumberOnly(amount: number): string {
    return new Intl.NumberFormat('fr-FR').format(amount).replace(/\s/g, '\u202f');
  }

  onClose(): void {
    if (this.isFormDirty()) {
      const confirmClose =
        typeof window !== 'undefined' && typeof window.confirm === 'function'
          ? window.confirm('Des modifications sont en cours. Voulez-vous vraiment fermer ?')
          : true;
      if (!confirmClose) {
        return;
      }
    }
    this.modalService.close();
  }

  handleEscape(): void {
    this.onClose();
  }

  // --- Soumission ---

  buildPayload(): ReservationSubmitPayload {
    const breakdown: ReservationCostBreakdown = {
      nights: this.nightsCount(),
      ratePerNightFcfa: this.currentCategoryOption().ratePerNightFcfa,
      accommodationTotalFcfa: this.accommodationTotalFcfa(),
      breakfastIncluded: true,
      extraChildBedFcfa: this.extraChildBedFcfa(),
      airportShuttleFcfa: this.airportShuttleFcfa(),
      cityTaxFcfa: this.cityTaxFcfa(),
      totalStayTtcFcfa: this.totalStayTtcFcfa(),
      depositAmountFcfa: this.depositAmountFcfa(),
      depositPercentage: this.depositPercentage(),
      remainingBalanceFcfa: this.remainingBalanceFcfa()
    };

    return {
      guestMode: this.guestMode(),
      regularGuestId: this.guestMode() === 'REGULAR' ? this.selectedRegularGuest().id : undefined,
      newGuest: this.guestMode() === 'NEW' ? this.newGuest() : undefined,
      checkInDate: this.checkInDate(),
      checkOutDate: this.checkOutDate(),
      nights: this.nightsCount(),
      adultsCount: this.adultsCount(),
      childrenCount: this.childrenCount(),
      category: this.selectedCategory(),
      roomNumber: this.selectedRoomNumber(),
      depositAmountFcfa: this.depositAmountFcfa(),
      paymentStatus: this.paymentStatus(),
      paymentChannel: this.paymentChannel(),
      airportShuttleIncluded: this.airportShuttleIncluded(),
      specialRequests: this.specialRequests(),
      breakdown
    };
  }

  onConfirm(): void {
    if (this.isSubmitDisabled()) return;
    const payload = this.buildPayload();
    this.modalService.confirmReservation(payload);
  }

  onSaveDraft(): void {
    const payload = this.buildPayload();
    this.modalService.saveDraftOption(payload);
  }
}
