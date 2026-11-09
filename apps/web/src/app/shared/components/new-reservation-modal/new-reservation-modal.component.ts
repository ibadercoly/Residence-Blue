import {
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
  WritableSignal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { formatFcfa } from '@residence-blue/shared';
import { ReservationModalService } from '../../../core/services/reservation-modal.service';
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
  imports: [CommonModule],
  template: `
    @if (modalService.isOpen()) {
      <!-- Modal Backdrop Overlay -->
      <div
        class="fixed inset-0 bg-inverse-surface/65 backdrop-blur-md z-50 flex items-center justify-center p-space-sm lg:p-space-lg overflow-y-auto"
        (click)="onBackdropClick($event)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-reservation-title"
        data-testid="modal-nouvelle-reservation"
      >
        <!-- Modal Window Container -->
        <div
          #modalContainer
          class="relative w-full max-w-6xl my-auto bg-surface-container-lowest text-on-surface rounded-2xl shadow-[0_24px_48px_-12px_rgba(10,37,64,0.28)] overflow-hidden flex flex-col max-h-[942px]"
          (click)="$event.stopPropagation()"
        >
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-space-xl py-space-lg bg-surface-container-low/60 shrink-0">
            <div class="flex items-center gap-space-md">
              <div class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[24px]" aria-hidden="true">calendar_add_on</span>
              </div>
              <div>
                <div class="flex items-center gap-space-sm">
                  <h2 id="modal-reservation-title" class="font-headline-md text-headline-md tracking-tight text-on-surface">
                    Nouvelle réservation
                  </h2>
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-label-md font-label-md bg-secondary-fixed text-on-secondary-container">
                    <span class="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Boutique 12 Clés
                  </span>
                </div>
                <p class="font-body-sm text-body-sm text-outline" data-adapted-zone="thies-header">
                  Enregistrement séjour &amp; émission du bon de confirmation • Thiès Grand Standing
                </p>
              </div>
            </div>
            <button
              #closeButton
              type="button"
              (click)="onClose()"
              aria-label="Fermer la fenêtre de réservation"
              data-testid="btn-close-modal"
              class="w-10 h-10 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
            </button>
          </div>

          <!-- Modal Body (Two-Column Layout) -->
          <div class="flex-1 overflow-y-auto px-space-xl py-space-lg grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            <!-- LEFT COLUMN: Saisie Opérationnelle (65% ~ 8 cols) -->
            <div class="lg:col-span-7 xl:col-span-8 flex flex-col gap-space-xl pr-0 lg:pr-space-xs">
              <!-- 1. Client Section -->
              <section class="flex flex-col gap-space-md" data-testid="section-client">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-space-sm">
                    <span class="w-6 h-6 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center">1</span>
                    <h3 class="font-title-lg text-title-lg text-on-surface">Client &amp; Contact</h3>
                  </div>
                  <!-- Segmented Control -->
                  <div class="inline-flex p-1 rounded-xl bg-surface-container text-label-md font-label-md">
                    <button
                      type="button"
                      (click)="setGuestMode('REGULAR')" data-testid="guest-mode-regular"
                      [class]="guestMode() === 'REGULAR'
                        ? 'px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary shadow-sm font-semibold transition-all cursor-pointer'
                        : 'px-space-md py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'"
                    >
                      Client régulier
                    </button>
                    <button
                      type="button"
                      (click)="setGuestMode('NEW')" data-testid="guest-mode-new"
                      [class]="guestMode() === 'NEW'
                        ? 'px-space-md py-1.5 rounded-lg bg-surface-container-lowest text-primary shadow-sm font-semibold transition-all cursor-pointer'
                        : 'px-space-md py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface transition-all cursor-pointer'"
                    >
                      + Nouveau client
                    </button>
                  </div>
                </div>

                <!-- Existing Client Card (Active selection) -->
                @if (guestMode() === 'REGULAR') {
                  <div class="p-space-md rounded-xl bg-surface-container-low shadow-[0_2px_12px_-2px_rgba(10,37,64,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
                    <div class="flex items-center gap-space-md">
                      <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-lg text-title-lg shrink-0">
                        {{ selectedRegularGuest().initials }}
                      </div>
                      <div class="flex flex-col">
                        <div class="flex items-center gap-space-xs flex-wrap">
                          <span class="font-title-md text-title-md text-on-surface">{{ selectedRegularGuest().name }}</span>
                          @if (selectedRegularGuest().vipBadge) {
                            <span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md flex items-center gap-1">
                              <span class="material-symbols-outlined text-[14px]" aria-hidden="true">{{ selectedRegularGuest().vipIcon || 'star' }}</span>
                              {{ selectedRegularGuest().vipBadge }}
                            </span>
                          }
                        </div>
                        <div class="flex flex-wrap items-center gap-x-space-md gap-y-0.5 text-body-sm font-body-sm text-outline mt-0.5">
                          <span class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">call</span>
                            {{ selectedRegularGuest().phone }}
                          </span>
                          <span>•</span>
                          <span class="flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">mail</span>
                            {{ selectedRegularGuest().email }}
                          </span>
                          <span>•</span>
                          <span>{{ selectedRegularGuest().city }}</span>
                        </div>
                      </div>
                    </div>
                    <div class="relative">
                      <button
                        type="button"
                        (click)="toggleChangeGuestMenu()"
                        class="self-start sm:self-auto px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface-variant font-label-md text-label-md transition-colors cursor-pointer"
                      >
                        Changer de client
                      </button>
                      @if (isChangingGuest()) {
                        <div class="absolute right-0 top-full mt-1 w-64 bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/30 py-1 z-30">
                          @for (guest of modalService.regularGuests; track guest.id) {
                            <button
                              type="button"
                              (click)="selectRegularGuest(guest)"
                              class="w-full text-left px-3 py-2 text-body-sm hover:bg-surface-container flex items-center justify-between"
                            >
                              <span>{{ guest.name }}</span>
                              <span class="text-xs text-outline">{{ guest.vipBadge || 'Standard' }}</span>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                } @else {
                  <!-- Nouveau client Form -->
                  <div class="p-space-md rounded-xl bg-surface-container-low shadow-[0_2px_12px_-2px_rgba(10,37,64,0.04)] grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                    <div>
                      <label for="new-guest-name" class="block font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
                        Nom complet *
                      </label>
                      <input
                        id="new-guest-name"
                        type="text"
                        [value]="newGuest().fullName"
                        (input)="onNewGuestFullNameInput($event)"
                        placeholder="Ex: M. Ousmane Sonko"
                        class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm outline-none border border-outline-variant/40 focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label for="new-guest-phone" class="block font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
                        Téléphone *
                      </label>
                      <input
                        id="new-guest-phone"
                        type="tel"
                        [value]="newGuest().phone"
                        (input)="onNewGuestPhoneInput($event)"
                        placeholder="Ex: +221 77 000 00 00"
                        class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm outline-none border border-outline-variant/40 focus:border-primary"
                        required
                      />
                    </div>
                    <div>
                      <label for="new-guest-email" class="block font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
                        E-mail
                      </label>
                      <input
                        id="new-guest-email"
                        type="email"
                        [value]="newGuest().email"
                        (input)="onNewGuestEmailInput($event)"
                        placeholder="client@domaine.sn"
                        class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm outline-none border border-outline-variant/40 focus:border-primary"
                      />
                    </div>
                    <div>
                      <label for="new-guest-city" class="block font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
                        Ville / Résidence
                      </label>
                      <input
                        id="new-guest-city"
                        type="text"
                        [value]="newGuest().city"
                        (input)="onNewGuestCityInput($event)"
                        placeholder="Dakar, Thiès, Somone..."
                        class="w-full h-10 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm outline-none border border-outline-variant/40 focus:border-primary"
                      />
                    </div>
                  </div>
                }
              </section>

              <!-- 2. Séjour & Dates Section -->
              <section class="flex flex-col gap-space-md" data-testid="section-sejour">
                <div class="flex items-center gap-space-sm">
                  <span class="w-6 h-6 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center">2</span>
                  <h3 class="font-title-lg text-title-lg text-on-surface">Séjour &amp; Occupants</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-space-md items-center">
                  <!-- Date Arrivée -->
                  <div class="sm:col-span-5 p-space-md rounded-xl bg-surface-container-low">
                    <label for="input-date-checkin" class="block font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
                      Date d'arrivée
                    </label>
                    <div class="flex items-center gap-space-sm text-on-surface">
                      <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">flight_land</span>
                      <div class="flex-1">
                        <input
                          id="input-date-checkin"
                          type="date"
                          [value]="checkInDate()"
                          (input)="onCheckInChange($event)"
                          class="bg-transparent font-title-md text-title-md text-on-surface outline-none cursor-pointer w-full"
                        />
                        <span class="font-body-sm text-body-sm text-outline block">Check-in dès 15:00</span>
                      </div>
                    </div>
                  </div>
                  <!-- Nights count badge -->
                  <div class="sm:col-span-2 flex flex-col items-center justify-center">
                    <span class="px-3 py-1 rounded-full bg-primary-container text-on-primary-container font-label-md text-label-md font-bold shadow-sm whitespace-nowrap">
                      {{ nightsCount() }} nuits
                    </span>
                    <span class="material-symbols-outlined text-primary text-[18px] rotate-90 sm:rotate-0 mt-1" aria-hidden="true">
                      arrow_forward
                    </span>
                  </div>
                  <!-- Date Départ -->
                  <div class="sm:col-span-5 p-space-md rounded-xl bg-surface-container-low">
                    <label for="input-date-checkout" class="block font-label-md text-label-md text-outline uppercase tracking-wider mb-1">
                      Date de départ
                    </label>
                    <div class="flex items-center gap-space-sm text-on-surface">
                      <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">flight_takeoff</span>
                      <div class="flex-1">
                        <input
                          id="input-date-checkout"
                          type="date"
                          [value]="checkOutDate()"
                          (input)="onCheckOutChange($event)"
                          class="bg-transparent font-title-md text-title-md text-on-surface outline-none cursor-pointer w-full"
                        />
                        <span class="font-body-sm text-body-sm text-outline block">Check-out avant 12:00</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Occupants Steppers -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                  <div class="p-space-md rounded-xl bg-surface-container-low flex items-center justify-between">
                    <div>
                      <span class="font-title-md text-title-md block text-on-surface">Adultes</span>
                      <span class="font-body-sm text-body-sm text-outline">+12 ans</span>
                    </div>
                    <div class="flex items-center gap-space-md bg-surface-container-lowest rounded-lg p-1">
                      <button
                        type="button"
                        (click)="decrementAdults()"
                        [disabled]="adultsCount() <= 1"
                        class="w-8 h-8 rounded bg-surface-container hover:bg-surface-variant disabled:opacity-40 flex items-center justify-center text-on-surface font-bold cursor-pointer"
                        aria-label="Diminuer le nombre d'adultes"
                      >
                        -
                      </button>
                      <span class="font-title-md text-title-md w-4 text-center font-bold">{{ adultsCount() }}</span>
                      <button
                        type="button"
                        (click)="incrementAdults()"
                        class="w-8 h-8 rounded bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface font-bold cursor-pointer"
                        aria-label="Augmenter le nombre d'adultes"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div class="p-space-md rounded-xl bg-surface-container-low flex items-center justify-between">
                    <div>
                      <span class="font-title-md text-title-md block text-on-surface">Enfants</span>
                      <span class="font-body-sm text-body-sm text-outline">
                        {{ childrenCount() }} enfant{{ childrenCount() > 1 ? 's' : '' }} (lit supp.)
                      </span>
                    </div>
                    <div class="flex items-center gap-space-md bg-surface-container-lowest rounded-lg p-1">
                      <button
                        type="button"
                        (click)="decrementChildren()"
                        [disabled]="childrenCount() <= 0"
                        class="w-8 h-8 rounded bg-surface-container hover:bg-surface-variant disabled:opacity-40 flex items-center justify-center text-on-surface font-bold cursor-pointer"
                        aria-label="Diminuer le nombre d'enfants"
                      >
                        -
                      </button>
                      <span class="font-title-md text-title-md w-4 text-center font-bold">{{ childrenCount() }}</span>
                      <button
                        type="button"
                        (click)="incrementChildren()"
                        class="w-8 h-8 rounded bg-surface-container hover:bg-surface-variant flex items-center justify-center text-on-surface font-bold cursor-pointer"
                        aria-label="Augmenter le nombre d'enfants"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 3. Choix de la chambre & Catégorie -->
              <section class="flex flex-col gap-space-md" data-testid="section-categorie">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-space-sm">
                    <span class="w-6 h-6 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center">3</span>
                    <h3 class="font-title-lg text-title-lg text-on-surface">Catégorie &amp; Attribution Clé</h3>
                  </div>
                  <span class="font-body-sm text-body-sm text-primary font-semibold">Taux d'occupation : 75%</span>
                </div>

                <!-- Categories Radio Grid (3 catégories physiques de l'hôtel) -->
                <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                  <!-- Option 1: Standard -->
                  <label
                    (click)="selectCategory('Standard')" data-testid="category-card-Standard"
                    [class]="selectedCategory() === 'Standard'
                      ? 'cursor-pointer rounded-xl p-space-md bg-primary-fixed/20 shadow-[0_4px_16px_-2px_rgba(0,102,111,0.18)] transition-all flex flex-col justify-between h-full relative overflow-hidden'
                      : 'cursor-pointer rounded-xl p-space-md bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between h-full'"
                  >
                    <input type="radio" name="room_category" value="Standard" [checked]="selectedCategory() === 'Standard'" class="sr-only" />
                    <div class="flex items-start justify-between">
                      <span class="font-label-md text-label-md px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant">2 dispo</span>
                      <div
                        [class]="selectedCategory() === 'Standard'
                          ? 'w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary'
                          : 'w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center'"
                      >
                        @if (selectedCategory() === 'Standard') {
                          <span class="material-symbols-outlined text-[14px]">check</span>
                        }
                      </div>
                    </div>
                    <div class="mt-space-md">
                      <span [class]="selectedCategory() === 'Standard' ? 'font-headline-sm text-headline-sm block text-primary font-bold' : 'font-headline-sm text-headline-sm block text-on-surface'">
                        Standard
                      </span>
                      <span class="font-body-sm text-body-sm text-outline">Jardin tropical</span>
                      <span [class]="selectedCategory() === 'Standard' ? 'font-label-currency text-label-currency block text-primary mt-2' : 'font-label-currency text-label-currency block text-on-surface mt-2'">
                        85 000 <span class="font-body-sm text-body-sm text-outline font-normal">FCFA/nuit</span>
                      </span>
                    </div>
                  </label>

                  <!-- Option 2: Deluxe Balcon (Selected by default) -->
                  <label
                    (click)="selectCategory('Deluxe')" data-testid="category-card-Deluxe"
                    [class]="selectedCategory() === 'Deluxe'
                      ? 'cursor-pointer rounded-xl p-space-md bg-primary-fixed/20 shadow-[0_4px_16px_-2px_rgba(0,102,111,0.18)] transition-all flex flex-col justify-between h-full relative overflow-hidden'
                      : 'cursor-pointer rounded-xl p-space-md bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between h-full'"
                  >
                    <input type="radio" name="room_category" value="Deluxe" [checked]="selectedCategory() === 'Deluxe'" class="sr-only" />
                    <div class="flex items-start justify-between">
                      <span class="font-label-md text-label-md px-2 py-0.5 rounded-full bg-primary text-on-primary font-medium">Recommandé</span>
                      <div
                        [class]="selectedCategory() === 'Deluxe'
                          ? 'w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary'
                          : 'w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center'"
                      >
                        @if (selectedCategory() === 'Deluxe') {
                          <span class="material-symbols-outlined text-[14px]">check</span>
                        }
                      </div>
                    </div>
                    <div class="mt-space-md">
                      <span [class]="selectedCategory() === 'Deluxe' ? 'font-headline-sm text-headline-sm block text-primary font-bold' : 'font-headline-sm text-headline-sm block text-on-surface'" data-adapted-zone="deluxe-title">
                        Deluxe Mer
                      </span>
                      <span class="font-body-sm text-body-sm text-on-surface-variant" data-adapted-zone="deluxe-desc">Front d'océan &amp; Balcon</span>
                      <span [class]="selectedCategory() === 'Deluxe' ? 'font-label-currency text-label-currency block text-primary mt-2' : 'font-label-currency text-label-currency block text-on-surface mt-2'">
                        130 000 <span class="font-body-sm text-body-sm text-outline font-normal">FCFA/nuit</span>
                      </span>
                    </div>
                  </label>

                  <!-- Option 3: Suite Panoramique -->
                  <label
                    (click)="selectCategory('Suite')" data-testid="category-card-Suite"
                    [class]="selectedCategory() === 'Suite'
                      ? 'cursor-pointer rounded-xl p-space-md bg-primary-fixed/20 shadow-[0_4px_16px_-2px_rgba(0,102,111,0.18)] transition-all flex flex-col justify-between h-full relative overflow-hidden'
                      : 'cursor-pointer rounded-xl p-space-md bg-surface-container-low hover:bg-surface-container transition-all flex flex-col justify-between h-full'"
                  >
                    <input type="radio" name="room_category" value="Suite" [checked]="selectedCategory() === 'Suite'" class="sr-only" />
                    <div class="flex items-start justify-between">
                      <span class="font-label-md text-label-md px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-medium">Dernière clé</span>
                      <div
                        [class]="selectedCategory() === 'Suite'
                          ? 'w-5 h-5 rounded-full bg-primary flex items-center justify-center text-on-primary'
                          : 'w-5 h-5 rounded-full bg-surface-container-high flex items-center justify-center'"
                      >
                        @if (selectedCategory() === 'Suite') {
                          <span class="material-symbols-outlined text-[14px]">check</span>
                        }
                      </div>
                    </div>
                    <div class="mt-space-md">
                      <span [class]="selectedCategory() === 'Suite' ? 'font-headline-sm text-headline-sm block text-primary font-bold' : 'font-headline-sm text-headline-sm block text-on-surface'">
                        Suite Panoramique
                      </span>
                      <span class="font-body-sm text-body-sm text-outline">Terrasse privée rooftop</span>
                      <span [class]="selectedCategory() === 'Suite' ? 'font-label-currency text-label-currency block text-primary mt-2' : 'font-label-currency text-label-currency block text-on-surface mt-2'">
                        210 000 <span class="font-body-sm text-body-sm text-outline font-normal">FCFA/nuit</span>
                      </span>
                    </div>
                  </label>
                </div>

                <!-- Specific Room Assignment Dropdown -->
                <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-space-md">
                  <div class="flex items-center gap-space-md">
                    <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">key</span>
                    </div>
                    <div>
                      <span class="font-label-md text-label-md uppercase tracking-wider text-outline block">
                        Attribution de la chambre spécifique
                      </span>
                      <span class="font-title-md text-title-md text-on-surface" data-adapted-zone="room-assigned">
                        Chambre {{ currentRoomOption().number }} - {{ currentRoomOption().label }} ({{ currentRoomOption().floor }})
                      </span>
                    </div>
                  </div>
                  <div class="relative">
                    <select
                      data-testid="select-room"
                      [value]="selectedRoomNumber()"
                      (change)="onRoomChange($event)"
                      class="inline-flex items-center gap-1.5 px-space-md py-2 rounded-lg bg-surface-container-lowest text-primary font-label-md text-label-md shadow-sm border-none outline-none cursor-pointer pr-8"
                      aria-label="Sélectionner une chambre physique spécifique"
                    >
                      @for (room of availableRoomsForCategory(); track room.number) {
                        <option [value]="room.number" [selected]="room.number === selectedRoomNumber()">
                          Chambre {{ room.number }} - {{ room.category }} ({{ room.floor }})
                        </option>
                      }
                    </select>
                  </div>
                </div>
              </section>

              <!-- 4. Règlement & Acompte -->
              <section class="flex flex-col gap-space-md" data-testid="section-acompte">
                <div class="flex items-center gap-space-sm">
                  <span class="w-6 h-6 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center">4</span>
                  <h3 class="font-title-lg text-title-lg text-on-surface">Acompte &amp; Mode de Règlement</h3>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                  <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
                    <label for="input-deposit-amount" class="font-label-md text-label-md text-outline uppercase tracking-wider">
                      Montant de l'acompte (FCFA)
                    </label>
                    <div class="flex items-center justify-between">
                      <input
                        id="input-deposit-amount"
                        type="text"
                        [value]="depositInputFormatted()"
                        (change)="onDepositInputChange($event)"
                        class="bg-surface-container-lowest text-on-surface font-headline-sm text-headline-sm px-3 py-2 rounded-lg w-full max-w-[200px] outline-none"
                      />
                      <span class="px-2.5 py-1 rounded-full bg-surface-variant font-label-md text-label-md text-on-surface-variant font-medium">
                        ~{{ depositPercentage() }}% du total
                      </span>
                    </div>
                  </div>
                  <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between">
                    <span class="font-label-md text-label-md text-outline uppercase tracking-wider mb-2">
                      Statut du versement
                    </span>
                    <div class="flex items-center gap-space-sm">
                      <button
                        type="button"
                        (click)="setPaymentStatus('PERCU')"
                        [class]="paymentStatus() === 'PERCU'
                          ? 'flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1 shadow-sm cursor-pointer'
                          : 'flex-1 py-2 px-3 rounded-lg bg-surface-container-highest text-on-surface-variant font-label-md text-label-md flex items-center justify-center cursor-pointer'"
                      >
                        <span class="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span>
                        Perçu maintenant
                      </button>
                      <button
                        type="button"
                        (click)="setPaymentStatus('EN_ATTENTE')"
                        [class]="paymentStatus() === 'EN_ATTENTE'
                          ? 'flex-1 py-2 px-3 rounded-lg bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1 shadow-sm cursor-pointer'
                          : 'flex-1 py-2 px-3 rounded-lg bg-surface-container-highest text-on-surface-variant font-label-md text-label-md flex items-center justify-center cursor-pointer'"
                      >
                        En attente
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Payment Methods Selectors -->
                <div>
                  <span class="font-label-md text-label-md text-outline uppercase tracking-wider block mb-space-sm">
                    Canal d'encaissement
                  </span>
                  <div class="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                    <!-- Wave (Selected by default) -->
                    <button
                      type="button"
                      (click)="setPaymentChannel('WAVE')"
                      [class]="paymentChannel() === 'WAVE'
                        ? 'p-space-md rounded-xl bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-1.5 transition-transform cursor-pointer'
                        : 'p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex flex-col items-center gap-1.5 transition-colors cursor-pointer'"
                    >
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">send_to_mobile</span>
                      <span class="font-title-md text-title-md font-bold">Wave</span>
                      <span [class]="paymentChannel() === 'WAVE' ? 'font-label-md text-label-md text-primary-fixed text-center' : 'font-label-md text-label-md text-outline text-center'">
                        Sans frais • Instantané
                      </span>
                    </button>

                    <!-- Orange Money -->
                    <button
                      type="button"
                      (click)="setPaymentChannel('ORANGE_MONEY')"
                      [class]="paymentChannel() === 'ORANGE_MONEY'
                        ? 'p-space-md rounded-xl bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-1.5 transition-transform cursor-pointer'
                        : 'p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex flex-col items-center gap-1.5 transition-colors cursor-pointer'"
                    >
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">smartphone</span>
                      <span class="font-title-md text-title-md font-bold">Orange Money</span>
                      <span class="font-label-md text-label-md text-outline">Paiement Mobile</span>
                    </button>

                    <!-- Carte TPE -->
                    <button
                      type="button"
                      (click)="setPaymentChannel('CARTE_TPE')"
                      [class]="paymentChannel() === 'CARTE_TPE'
                        ? 'p-space-md rounded-xl bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-1.5 transition-transform cursor-pointer'
                        : 'p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex flex-col items-center gap-1.5 transition-colors cursor-pointer'"
                    >
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">credit_card</span>
                      <span class="font-title-md text-title-md font-bold">Carte TPE</span>
                      <span class="font-label-md text-label-md text-outline">Visa / Mastercard</span>
                    </button>

                    <!-- Espèces -->
                    <button
                      type="button"
                      (click)="setPaymentChannel('ESPECES')"
                      [class]="paymentChannel() === 'ESPECES'
                        ? 'p-space-md rounded-xl bg-primary-container text-on-primary-container shadow-sm flex flex-col items-center gap-1.5 transition-transform cursor-pointer'
                        : 'p-space-md rounded-xl bg-surface-container-low hover:bg-surface-container text-on-surface flex flex-col items-center gap-1.5 transition-colors cursor-pointer'"
                    >
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">payments</span>
                      <span class="font-title-md text-title-md font-bold">Espèces</span>
                      <span class="font-label-md text-label-md text-outline">Caisse front-desk</span>
                    </button>
                  </div>
                </div>
              </section>

              <!-- 5. Notes & Demandes spéciales -->
              <section class="flex flex-col gap-space-sm pb-space-md" data-testid="section-notes">
                <div class="flex items-center gap-space-sm">
                  <span class="w-6 h-6 rounded-full bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center">5</span>
                  <h3 class="font-title-lg text-title-lg text-on-surface">Demandes Particulières &amp; Conciergerie</h3>
                </div>
                <textarea
                  [value]="specialRequests()"
                  (input)="onSpecialRequestsInput($event)"
                  rows="3"
                  placeholder="Indiquez les détails de vol, allergies, attentions personnalisées..."
                  class="w-full p-space-md rounded-xl bg-surface-container-low text-on-surface font-body-md text-body-md outline-none focus:bg-surface-container-lowest transition-all placeholder:text-outline border border-transparent focus:border-primary/20"
                ></textarea>
              </section>
            </div>

            <!-- RIGHT COLUMN: Récapitulatif Tarifaire en Direct (35% ~ 4-5 cols) -->
            <div class="lg:col-span-5 xl:col-span-4 flex flex-col" data-testid="live-breakdown-panel">
              <div class="sticky top-0 bg-surface-container-low rounded-2xl p-space-lg flex flex-col gap-space-md shadow-[0_4px_24px_-4px_rgba(10,37,64,0.06)]">
                <!-- Room preview & summary title -->
                <div class="flex items-center gap-space-md pb-space-sm">
                  <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 shadow-sm" data-photo-zone="room-preview-photo">
                    <img
                      [src]="roomImageUrl()"
                      [alt]="'Photo de la ' + currentRoomOption().label"
                      class="w-full h-full object-cover"
                      (error)="onImageError($event)"
                    />
                  </div>
                  <div class="min-w-0">
                    <span class="font-label-md text-label-md uppercase tracking-wider text-primary font-bold">
                      Résidence Blue • Thiès (Grand Standing)
                    </span>
                    <h4 class="font-headline-sm text-headline-sm text-on-surface truncate" data-adapted-zone="summary-room-title">
                      Ch. {{ currentRoomOption().number }} - {{ currentRoomOption().category === 'Deluxe' ? 'Deluxe Mer' : currentRoomOption().label }}
                    </h4>
                    <p class="font-body-sm text-body-sm text-outline" data-adapted-zone="summary-room-sub">
                      {{ currentRoomOption().category === 'Deluxe' ? "Balcon privé • Face océan" : currentRoomOption().details }}
                    </p>
                  </div>
                </div>

                <!-- Key stay attributes -->
                <div class="bg-surface-container-lowest p-space-md rounded-xl flex flex-col gap-space-xs">
                  <div class="flex items-center justify-between text-body-sm font-body-sm">
                    <span class="text-outline flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">calendar_month</span>
                      Séjour
                    </span>
                    <span class="font-title-md text-title-md text-on-surface">
                      {{ stayDateRangeFormatted() }} ({{ nightsCount() }} nuit{{ nightsCount() > 1 ? 's' : '' }})
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-body-sm font-body-sm">
                    <span class="text-outline flex items-center gap-1.5">
                      <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">group</span>
                      Occupants
                    </span>
                    <span class="font-title-md text-title-md text-on-surface">
                      {{ adultsCount() }} Adulte{{ adultsCount() > 1 ? 's' : '' }}{{ childrenCount() > 0 ? ', ' + childrenCount() + ' Enfant' + (childrenCount() > 1 ? 's' : '') : '' }}
                    </span>
                  </div>
                </div>

                <!-- Live breakdown calculation -->
                <div class="flex flex-col gap-space-sm py-space-xs">
                  <div class="flex items-center justify-between font-body-md text-body-md">
                    <span class="text-on-surface-variant">
                      Hébergement ({{ nightsCount() }} × {{ formatMoney(currentCategoryOption().ratePerNightFcfa) }})
                    </span>
                    <span class="font-semibold text-on-surface">
                      {{ formatMoney(accommodationTotalFcfa()) }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between font-body-md text-body-md">
                    <span class="text-on-surface-variant flex items-center gap-1">
                      Petit-déjeuner Teranga (buffet)
                    </span>
                    <span class="font-label-md text-label-md font-bold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">
                      Inclus
                    </span>
                  </div>
                  @if (extraChildBedFcfa() > 0) {
                    <div class="flex items-center justify-between font-body-md text-body-md">
                      <span class="text-on-surface-variant">Lit supplémentaire enfant (séjour)</span>
                      <span class="font-semibold text-on-surface">{{ formatMoney(extraChildBedFcfa()) }}</span>
                    </div>
                  }
                  @if (airportShuttleFcfa() > 0) {
                    <div class="flex items-center justify-between font-body-md text-body-md">
                      <span class="text-on-surface-variant">Navette aéroport AIBD / DSS (aller)</span>
                      <span class="font-semibold text-on-surface">{{ formatMoney(airportShuttleFcfa()) }}</span>
                    </div>
                  }
                  <div class="flex items-center justify-between font-body-md text-body-md">
                    <span class="text-on-surface-variant">Taxe de séjour (1 000/adulte/nuit)</span>
                    <span class="font-semibold text-on-surface">{{ formatMoney(cityTaxFcfa()) }}</span>
                  </div>
                </div>

                <!-- Totals & Balances -->
                <div class="bg-surface-container-lowest p-space-md rounded-xl flex flex-col gap-space-sm">
                  <div class="flex items-baseline justify-between">
                    <span class="font-title-md text-title-md text-on-surface">Total Séjour TTC</span>
                    <span class="font-display-lg-mobile text-display-lg-mobile text-primary font-bold tracking-tight" data-testid="total-ttc-amount">
                      {{ formatAmountNumberOnly(totalStayTtcFcfa()) }}
                      <span class="font-label-md text-label-md text-outline">FCFA</span>
                    </span>
                  </div>
                  <div class="flex items-center justify-between text-body-sm font-body-sm pt-space-xs">
                    <span class="text-outline flex items-center gap-1">
                      <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">verified</span>
                      Acompte {{ paymentChannelLabel() }} {{ paymentStatus() === 'PERCU' ? 'perçu' : 'en attente' }}
                    </span>
                    <span class="font-semibold text-primary">
                      {{ paymentStatus() === 'PERCU' ? '- ' : '' }}{{ formatMoney(depositAmountFcfa()) }}
                    </span>
                  </div>
                  <!-- Solde restant (Highlighted Amber Tag) -->
                  <div class="p-space-sm rounded-lg bg-secondary-fixed/50 flex items-center justify-between mt-1">
                    <div class="flex flex-col">
                      <span class="font-label-md text-label-md uppercase tracking-wider text-on-secondary-fixed-variant">
                        Solde dû au check-in
                      </span>
                      <span class="font-title-lg text-title-lg font-bold text-on-secondary-container" data-testid="remaining-balance-amount">
                        {{ formatMoney(remainingBalanceFcfa()) }}
                      </span>
                    </div>
                    <span class="material-symbols-outlined text-secondary text-[24px]" aria-hidden="true">receipt</span>
                  </div>
                </div>

                <!-- Status Indicator -->
                <div class="p-space-sm rounded-xl bg-surface-variant/40 flex items-center gap-space-sm">
                  <span class="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                  <span class="font-label-md text-label-md text-on-surface-variant">
                    Prêt à confirmer avec envoi immédiat SMS/WhatsApp
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- MODAL FOOTER -->
          <div class="px-space-xl py-space-md bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-space-md shrink-0">
            <button
              type="button"
              (click)="onSaveDraft()"
              class="w-full sm:w-auto inline-flex items-center justify-center gap-space-xs px-space-md py-2.5 rounded-xl bg-surface-container-highest hover:bg-surface-variant text-on-surface font-label-lg text-label-lg transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">bookmark_add</span>
              <span>Option temporaire (Devis 48h)</span>
            </button>
            <div class="flex items-center gap-space-md w-full sm:w-auto">
              <button
                type="button"
                (click)="onClose()"
                class="flex-1 sm:flex-initial px-space-lg py-3 rounded-xl bg-surface-container-highest hover:bg-surface-variant text-on-surface-variant font-label-lg text-label-lg transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                (click)="onConfirm()"
                [disabled]="isSubmitDisabled()"
                data-testid="btn-submit-reservation"
                [class]="isSubmitDisabled()
                  ? 'flex-1 sm:flex-initial inline-flex items-center justify-center gap-space-sm px-space-xl py-3 rounded-xl bg-outline-variant/60 text-surface-container-highest font-label-lg text-label-lg shadow-none cursor-not-allowed'
                  : 'flex-1 sm:flex-initial inline-flex items-center justify-center gap-space-sm px-space-xl py-3 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg shadow-md transition-all cursor-pointer'"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">done_all</span>
                <span>Confirmer la réservation</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    @if (modalService.feedbackMessage(); as msg) {
      <div
        class="fixed bottom-6 right-6 z-50 bg-primary text-on-primary px-space-lg py-space-md rounded-2xl shadow-xl flex items-center gap-space-md animate-fade-in"
        data-testid="toast-reservation-success"
        role="alert"
      >
        <div class="w-10 h-10 rounded-xl bg-on-primary/10 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-[24px]">verified</span>
        </div>
        <div class="flex flex-col">
          <span class="font-title-md text-title-md font-bold">Réservation confirmée avec succès !</span>
          <span class="font-body-sm text-body-sm opacity-90">
            {{ msg }}
          </span>
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
  readonly specialRequests = signal<string>(
    "Arrivée tardive par vol Air Sénégal (atterrissage DSS 21h30). Prévoir navette aéroport AIBD et lit d'appoint enfant préparé. Panier de fruits de bienvenue et jus de bissap frais en chambre."
  );

  // Image de la chambre
  readonly roomImageUrl = signal<string>('/assets/images/chambres/chambre-201-deluxe-800w.webp');

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
    // 1 000 FCFA par adulte par nuit (conforme taxe communale Thiès / ADAPTATION-THIES.md)
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
    if (this.nightsCount() < 1) return true;
    if (this.adultsCount() < 1) return true;
    if (this.totalStayTtcFcfa() <= 0) return true;
    if (this.guestMode() === 'NEW') {
      const g = this.newGuest();
      if (!g.fullName.trim() || !g.phone.trim()) return true;
    }
    return false;
  });

  // --- Handlers & Actions ---

  setGuestMode(mode: GuestMode): void {
    this.guestMode.set(mode);
    this.isChangingGuest.set(false);
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
    return formatFcfa(amount);
  }

  formatAmountNumberOnly(amount: number): string {
    return formatFcfa(amount).replace(' FCFA', '');
  }

  onClose(): void {
    this.modalService.close();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  // --- Accessibilité : Focus Trap & Touche Échap ---

  @HostListener('window:keydown.escape')
  handleEscape(): void {
    if (this.modalService.isOpen()) {
      this.onClose();
    }
  }

  @HostListener('keydown', ['$event'])
  handleTab(event: KeyboardEvent): void {
    if (!this.modalService.isOpen() || event.key !== 'Tab') return;

    const container = typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>('[data-testid="modal-nouvelle-reservation"]')
      : null;
    if (!container) return;

    const focusableSelectors =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusableElements = Array.from(
      container.querySelectorAll<HTMLElement>(focusableSelectors)
    ).filter((el) => el.offsetParent !== null);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
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
