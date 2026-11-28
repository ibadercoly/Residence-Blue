import {
  AfterViewInit,
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
import { SCROLLBAR_SIDE, ScrollbarSide } from '../../core/config/reservation-modal.config';
import {
  AvailableRoomItem,
  CreateReservationPayload,
  GuestQuickSearchItem,
  HotelRatesConfig,
  PaymentMethodType,
  ReservationSourceType,
  RoomCategoryType,
} from '../../core/models/reservation-modal.model';
import { ReservationModalService } from '../../core/services/reservation-modal.service';
import { TariffsService } from '../../core/services/tariffs.service';
import {
  ReservationPriceQuoteDto,
  normalizeTariffCategoryCode,
} from '@residence-blue/shared';

const SENEGAL_PHONE_REGEX = /^(?:\+221|00221)?[\s.-]?(?:77|78|76|70|75|33)(?:[\s.-]?\d){7}$/;
const CARD_PAN_REGEX = /(?:\d[\s-]?){13,19}/;
const MAX_VISIBLE_ROOMS = 6;

function addDaysIso(baseIso: string, days: number): string {
  const [y, m, d] = baseIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function computeNights(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const start = Date.parse(`${checkIn}T00:00:00Z`);
  const end = Date.parse(`${checkOut}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 86400000);
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Component({
  selector: 'app-reservation-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './reservation-modal.component.css',
  template: `
    <div
      class="rb-res-backdrop"
      role="presentation"
      (click)="onBackdropClick($event)"
      data-testid="reservation-modal-backdrop"
    >
      <div
        #dialogEl
        class="rb-res-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rb-res-title"
        data-testid="reservation-modal-dialog"
      >
        <!-- Zone 1 : En-tête fixe -->
        <header class="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200 bg-white">
          <div class="min-w-0">
            <h2 id="rb-res-title" class="text-lg font-extrabold text-slate-900 leading-tight">
              Nouvelle réservation
            </h2>
            <p class="text-xs text-slate-600 mt-0.5" data-testid="reservation-modal-subtitle">
              {{ headerSubtitle() }}
            </p>
          </div>
          <button
            type="button"
            class="rb-res-btn px-3 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 font-semibold text-sm flex items-center justify-center shrink-0"
            aria-label="Fermer la fenêtre"
            data-testid="reservation-modal-close"
            (click)="requestClose()"
          >
            ✕
          </button>
        </header>

        <!-- Zone 2 : Corps défilant avec barre verticale toujours visible -->
        <div
          #scrollBody
          class="rb-res-scroll-body"
          [class.scrollbar-left]="scrollbarSide === 'left'"
          data-testid="reservation-modal-body"
        >
          <div class="rb-res-scroll-content">
            @if (modalService.errorMessage() || localError()) {
              <div
                role="alert"
                class="mb-4 p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 text-sm font-medium"
                data-testid="reservation-modal-error"
              >
                {{ localError() || modalService.errorMessage() }}
              </div>
            }

            <div class="rb-res-grid">
              <!-- Colonne gauche : Formulaire en 3 sections numérotées et empilées -->
              <form class="space-y-5 min-w-0" (ngSubmit)="submitForm()" novalidate>
                <!-- SECTION 1 : SÉJOUR -->
                <section class="p-4 rounded-xl border border-slate-200 bg-slate-50/60" aria-labelledby="sec-sejour">
                  <div class="flex items-center justify-between gap-2 mb-3">
                    <h3 id="sec-sejour" class="text-sm font-bold text-slate-900">1. Séjour</h3>
                    <span class="text-xs font-semibold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full">
                      {{ nights() > 0 ? nights() + (nights() > 1 ? ' nuits' : ' nuit') : 'Dates requises' }}
                    </span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label for="res-checkin" class="block text-xs font-semibold text-slate-700 mb-1">
                        Arrivée
                      </label>
                      <input
                        #firstFocusEl
                        id="res-checkin"
                        name="checkInDate"
                        type="date"
                        [min]="todayIso"
                        [ngModel]="checkInDate()"
                        (ngModelChange)="onCheckInChange($event)"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                        data-testid="res-checkin-input"
                        required
                      />
                    </div>
                    <div>
                      <label for="res-checkout" class="block text-xs font-semibold text-slate-700 mb-1">
                        Départ
                      </label>
                      <input
                        id="res-checkout"
                        name="checkOutDate"
                        type="date"
                        [min]="minCheckOutIso()"
                        [ngModel]="checkOutDate()"
                        (ngModelChange)="onCheckOutChange($event)"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-teal-700"
                        data-testid="res-checkout-input"
                        required
                      />
                    </div>
                  </div>

                  <!-- Pastilles de durée -->
                  <div class="flex flex-wrap gap-2 mb-4" role="group" aria-label="Durée rapide">
                    @for (d of durationOptions; track d.days) {
                      <button
                        type="button"
                        (click)="applyDuration(d.days)"
                        class="rb-res-btn px-3 rounded-lg text-xs font-semibold border whitespace-nowrap"
                        [class.bg-teal-800]="nights() === d.days"
                        [class.text-white]="nights() === d.days"
                        [class.border-teal-800]="nights() === d.days"
                        [class.bg-white]="nights() !== d.days"
                        [class.text-slate-700]="nights() !== d.days"
                        [class.border-slate-300]="nights() !== d.days"
                        [attr.data-testid]="'duration-pill-' + d.days"
                      >
                        {{ d.label }}
                      </button>
                    }
                  </div>

                  <!-- Voyageurs -->
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <div class="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg">
                      <span class="text-sm font-medium text-slate-800">Adultes</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="rb-res-btn w-10 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold disabled:opacity-40"
                          [disabled]="adultsCount() <= 1"
                          (click)="changeAdults(-1)"
                          aria-label="Retirer un adulte"
                          data-testid="adults-minus"
                        >
                          −
                        </button>
                        <span class="w-6 text-center text-sm font-bold text-slate-900" data-testid="adults-value">
                          {{ adultsCount() }}
                        </span>
                        <button
                          type="button"
                          class="rb-res-btn w-10 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold disabled:opacity-40"
                          [disabled]="adultsCount() >= 6"
                          (click)="changeAdults(1)"
                          aria-label="Ajouter un adulte"
                          data-testid="adults-plus"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div class="flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg">
                      <span class="text-sm font-medium text-slate-800">Enfants</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="rb-res-btn w-10 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold disabled:opacity-40"
                          [disabled]="childrenCount() <= 0"
                          (click)="changeChildren(-1)"
                          aria-label="Retirer un enfant"
                          data-testid="children-minus"
                        >
                          −
                        </button>
                        <span class="w-6 text-center text-sm font-bold text-slate-900" data-testid="children-value">
                          {{ childrenCount() }}
                        </span>
                        <button
                          type="button"
                          class="rb-res-btn w-10 rounded-lg border border-slate-300 bg-white text-slate-800 font-bold disabled:opacity-40"
                          [disabled]="childrenCount() >= 4"
                          (click)="changeChildren(1)"
                          aria-label="Ajouter un enfant"
                          data-testid="children-plus"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Filtre catégorie + Chambres libres -->
                  <div>
                    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span class="text-xs font-semibold text-slate-700">
                        Chambres libres ({{ availableRooms().length }})
                      </span>
                      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par catégorie">
                        @for (cat of categoryFilters; track cat.value) {
                          <button
                            type="button"
                            (click)="selectCategory(cat.value)"
                            class="rb-res-btn px-2.5 rounded-lg text-xs font-semibold border whitespace-nowrap"
                            [class.bg-slate-900]="categoryFilter() === cat.value"
                            [class.text-white]="categoryFilter() === cat.value"
                            [class.border-slate-900]="categoryFilter() === cat.value"
                            [class.bg-white]="categoryFilter() !== cat.value"
                            [class.text-slate-700]="categoryFilter() !== cat.value"
                            [class.border-slate-300]="categoryFilter() !== cat.value"
                            [attr.data-testid]="'category-filter-' + cat.value"
                          >
                            {{ cat.label }}
                          </button>
                        }
                      </div>
                    </div>

                    @if (roomsLoading()) {
                      <p class="text-xs text-slate-600 py-2">Chargement des chambres libres…</p>
                    } @else if (visibleRooms().length === 0) {
                      <p class="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        Aucune chambre libre pour ces dates dans cette catégorie.
                      </p>
                    } @else {
                      <div class="space-y-2" data-testid="available-rooms-list">
                        @for (room of visibleRooms(); track room.id) {
                          <button
                            type="button"
                            (click)="selectRoom(room)"
                            class="rb-res-room-row w-full text-left px-3 py-2.5 rounded-lg border flex flex-wrap items-center justify-between gap-2"
                            [class.border-teal-700]="selectedRoom()?.id === room.id"
                            [class.bg-teal-50]="selectedRoom()?.id === room.id"
                            [class.border-slate-300]="selectedRoom()?.id !== room.id"
                            [class.bg-white]="selectedRoom()?.id !== room.id"
                            [attr.data-testid]="'room-option-' + room.number"
                          >
                            <div class="min-w-0">
                              <span class="text-sm font-bold text-slate-900">
                                Chambre {{ room.number }} · {{ room.category }}
                              </span>
                              <span class="block text-xs text-slate-600">
                                @if (room.isUnclassified || room.category === 'À classer') {
                                  <strong class="text-amber-800">À classer par la direction</strong>
                                } @else {
                                  Capacité {{ room.adultsCapacity }} ad.{{ room.childrenCapacity > 0 ? ' + ' + room.childrenCapacity + ' enf.' : '' }}
                                }
                              </span>
                            </div>
                            @if (canViewAmounts()) {
                              <span class="text-sm font-bold text-teal-800 whitespace-nowrap">
                                @if (room.pricePerNight !== null && room.pricePerNight > 0) {
                                  dès {{ formatFcfa(room.pricePerNight) }} / nuit
                                } @else {
                                  Tarif à définir
                                }
                              </span>
                            }
                          </button>
                        }
                      </div>

                      @if (filteredRooms().length > visibleRooms().length) {
                        <button
                          type="button"
                          (click)="showAllRooms.set(true)"
                          class="rb-res-btn mt-2 w-full px-3 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-100"
                          data-testid="show-more-rooms"
                        >
                          Voir plus de chambres ({{ filteredRooms().length - visibleRooms().length }})
                        </button>
                      }
                    }

                    <!-- Sélecteur du nombre de chambres utilisées (uniquement pour Appartement) -->
                    @if (isSelectedApartment()) {
                      <div class="mt-3 p-3 rounded-lg border border-teal-200 bg-teal-50/60" data-testid="apartment-rooms-used-group">
                        <span class="block text-xs font-bold text-slate-800 mb-2">
                          Nombre de chambres utilisées dans l’appartement
                        </span>
                        <div class="grid grid-cols-3 gap-2">
                          @for (rc of [1, 2, 3]; track rc) {
                            <button
                              type="button"
                              (click)="setRoomsUsed(rc)"
                              [attr.data-testid]="'rooms-used-' + rc"
                              class="rb-res-btn px-2 rounded-lg text-xs font-bold border whitespace-nowrap"
                              [class.bg-teal-800]="roomsUsed() === rc"
                              [class.text-white]="roomsUsed() === rc"
                              [class.border-teal-800]="roomsUsed() === rc"
                              [class.bg-white]="roomsUsed() !== rc"
                              [class.text-slate-700]="roomsUsed() !== rc"
                              [class.border-slate-300]="roomsUsed() !== rc"
                            >
                              {{ rc }} {{ rc > 1 ? 'chambres' : 'chambre' }}
                            </button>
                          }
                        </div>
                      </div>
                    }

                    <!-- Ligne claire de tarif ou message d'erreur si aucun tarif n'existe -->
                    @if (selectedRoom() && nights() > 0) {
                      @if (tariffErrorMessage(); as errMsg) {
                        <div
                          role="alert"
                          data-testid="reservation-tariff-error"
                          class="mt-3 p-3 rounded-lg border border-rose-300 bg-rose-50 text-rose-900 text-sm font-semibold"
                        >
                          {{ errMsg }}
                        </div>
                      } @else if (tariffSummaryLine(); as line) {
                        <div
                          data-testid="reservation-tariff-summary-line"
                          class="mt-3 p-3 rounded-lg border border-teal-300 bg-teal-50 text-teal-950 text-sm font-bold"
                        >
                          {{ line }}
                        </div>
                      }
                    }

                    <!-- Surcharge manuelle du tarif : strictement réservée à la DIRECTION (jamais affichée à la réception) -->
                    @if (isDirector() && selectedRoom() && nights() > 0) {
                      <div class="mt-3 p-3 rounded-lg border border-amber-300 bg-amber-50/70 space-y-2.5" data-testid="director-price-override-box">
                        <label class="flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                          <input
                            type="checkbox"
                            [ngModel]="useDirectorOverride()"
                            (ngModelChange)="toggleDirectorOverride($event)"
                            name="useDirectorOverride"
                            data-testid="toggle-director-override"
                            class="w-4 h-4 accent-teal-800"
                          />
                          <span>Prix négocié (fixer un tarif manuel — Direction uniquement)</span>
                        </label>
                        @if (useDirectorOverride()) {
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div>
                              <label for="res-override-price" class="block text-xs font-semibold text-amber-950 mb-1">
                                Prix par nuit (FCFA)
                              </label>
                              <input
                                id="res-override-price"
                                name="overridePricePerNightFcfa"
                                type="number"
                                min="1"
                                step="1000"
                                [ngModel]="overridePricePerNightFcfa()"
                                (ngModelChange)="onOverridePriceChange($event)"
                                data-testid="input-director-override-price"
                                class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-amber-400 rounded-lg text-slate-900 font-bold"
                              />
                            </div>
                            <div>
                              <label for="res-override-reason" class="block text-xs font-semibold text-amber-950 mb-1">
                                Motif obligatoire
                              </label>
                              <input
                                id="res-override-reason"
                                name="priceOverrideReason"
                                type="text"
                                maxlength="300"
                                [ngModel]="priceOverrideReason()"
                                (ngModelChange)="onOverrideReasonChange($event)"
                                placeholder="Ex. Convention entreprise"
                                data-testid="input-director-override-reason"
                                class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-amber-400 rounded-lg text-slate-900"
                              />
                            </div>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </section>

                <!-- SECTION 2 : CLIENT -->
                <section class="p-4 rounded-xl border border-slate-200 bg-slate-50/60" aria-labelledby="sec-client">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 id="sec-client" class="text-sm font-bold text-slate-900">2. Client</h3>
                    <button
                      type="button"
                      (click)="toggleQuickGuest()"
                      class="rb-res-btn px-3 rounded-lg border border-teal-700 text-teal-800 bg-white hover:bg-teal-50 text-xs font-semibold whitespace-nowrap"
                      data-testid="toggle-quick-guest"
                    >
                      {{ isQuickGuestMode() ? 'Chercher un client existant' : '+ Nouveau client rapide' }}
                    </button>
                  </div>

                  @if (isQuickGuestMode()) {
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="quick-guest-form">
                      <div>
                        <label for="res-new-guest-name" class="block text-xs font-semibold text-slate-700 mb-1">
                          Nom complet
                        </label>
                        <input
                          id="res-new-guest-name"
                          name="newGuestName"
                          type="text"
                          [ngModel]="newGuestName()"
                          (ngModelChange)="onNewGuestNameChange($event)"
                          placeholder="Ex. Fatou Ndiaye"
                          class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                          data-testid="quick-guest-name"
                        />
                      </div>
                      <div>
                        <label for="res-new-guest-phone" class="block text-xs font-semibold text-slate-700 mb-1">
                          Téléphone (Sénégal)
                        </label>
                        <input
                          id="res-new-guest-phone"
                          name="newGuestPhone"
                          type="tel"
                          [ngModel]="newGuestPhone()"
                          (ngModelChange)="onNewGuestPhoneChange($event)"
                          placeholder="+221 77 123 45 67"
                          class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                          data-testid="quick-guest-phone"
                        />
                        @if (newGuestPhone().trim() && !isQuickPhoneValid()) {
                          <p class="text-xs text-red-700 mt-1">
                            Format requis : +221 77/78/76/70/75 XX XX XX
                          </p>
                        }
                      </div>
                    </div>
                  } @else {
                    <div>
                      <label for="res-guest-search" class="block text-xs font-semibold text-slate-700 mb-1">
                        Rechercher un client (nom ou téléphone)
                      </label>
                      <input
                        id="res-guest-search"
                        name="guestSearch"
                        type="search"
                        [ngModel]="guestQuery()"
                        (ngModelChange)="onGuestQueryChange($event)"
                        placeholder="Saisissez un nom ou numéro…"
                        autocomplete="off"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        data-testid="guest-search-input"
                      />

                      @if (selectedGuest(); as guest) {
                        <div
                          class="mt-2 p-2.5 rounded-lg border border-teal-700 bg-teal-50 flex flex-wrap items-center justify-between gap-2"
                          data-testid="selected-guest-badge"
                        >
                          <div class="text-sm">
                            <span class="font-bold text-slate-900">{{ guest.fullName }}</span>
                            <span class="text-slate-700 ml-2">{{ guest.phone }}</span>
                          </div>
                          <button
                            type="button"
                            (click)="clearSelectedGuest()"
                            class="rb-res-btn px-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold whitespace-nowrap"
                          >
                            Changer
                          </button>
                        </div>
                      } @else if (guestsLoading()) {
                        <p class="text-xs text-slate-600 mt-2">Recherche en cours…</p>
                      } @else if (guestResults().length > 0) {
                        <div class="mt-2 space-y-1.5" data-testid="guest-search-results">
                          @for (g of guestResults(); track g.id) {
                            <button
                              type="button"
                              (click)="selectGuest(g)"
                              class="rb-res-btn w-full text-left px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 flex flex-wrap items-center justify-between gap-2"
                              [attr.data-testid]="'guest-result-' + g.id"
                            >
                              <span class="text-sm font-semibold text-slate-900">{{ g.fullName }}</span>
                              <span class="text-xs text-slate-600">{{ g.phone }}</span>
                            </button>
                          }
                        </div>
                      } @else if (guestQuery().trim().length >= 1) {
                        <p class="text-xs text-slate-600 mt-2">
                          Aucun client trouvé. Utilisez « + Nouveau client rapide ».
                        </p>
                      }
                    </div>
                  }
                </section>

                <!-- SECTION 3 : PAIEMENT ET NOTES -->
                <section class="p-4 rounded-xl border border-slate-200 bg-slate-50/60" aria-labelledby="sec-paiement">
                  <h3 id="sec-paiement" class="text-sm font-bold text-slate-900 mb-3">
                    3. Paiement et notes
                  </h3>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label for="res-deposit" class="block text-xs font-semibold text-slate-700 mb-1">
                        Acompte (FCFA, facultatif)
                      </label>
                      <input
                        id="res-deposit"
                        name="depositFcfa"
                        type="number"
                        min="0"
                        step="1"
                        [ngModel]="depositFcfa()"
                        (ngModelChange)="onDepositChange($event)"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        data-testid="res-deposit-input"
                      />
                    </div>
                    <div>
                      <label for="res-payment-method" class="block text-xs font-semibold text-slate-700 mb-1">
                        Mode de paiement
                      </label>
                      <select
                        id="res-payment-method"
                        name="paymentMethod"
                        [ngModel]="paymentMethod()"
                        (ngModelChange)="onPaymentMethodChange($event)"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        data-testid="res-payment-method"
                      >
                        <option value="CASH">Espèces</option>
                        <option value="ORANGE_MONEY">Orange Money</option>
                        <option value="WAVE">Wave</option>
                        <option value="CARD">Carte</option>
                        <option value="BANK_TRANSFER">Virement</option>
                      </select>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <label for="res-tx-ref" class="block text-xs font-semibold text-slate-700 mb-1">
                        Référence transaction (facultatif)
                      </label>
                      <input
                        id="res-tx-ref"
                        name="transactionRef"
                        type="text"
                        maxlength="80"
                        [ngModel]="transactionRef()"
                        (ngModelChange)="onTransactionRefChange($event)"
                        placeholder="Ex. OM-2026-991"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        data-testid="res-tx-ref"
                      />
                      @if (hasCardPanRisk()) {
                        <p class="text-xs text-red-700 mt-1" role="alert">
                          Ne saisissez jamais un numéro de carte bancaire complet.
                        </p>
                      }
                    </div>
                    <div>
                      <label for="res-discount" class="block text-xs font-semibold text-slate-700 mb-1">
                        Remise (FCFA, facultatif)
                      </label>
                      <input
                        id="res-discount"
                        name="discountFcfa"
                        type="number"
                        min="0"
                        step="1"
                        [ngModel]="discountFcfa()"
                        (ngModelChange)="onDiscountChange($event)"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        data-testid="res-discount-input"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div>
                      <span class="block text-xs font-semibold text-slate-700 mb-1">
                        Petit-déjeuner inclus
                      </span>
                      <div class="flex gap-2">
                        <button
                          type="button"
                          (click)="setBreakfast(true)"
                          class="rb-res-btn flex-1 px-3 rounded-lg text-xs font-semibold border whitespace-nowrap"
                          [class.bg-teal-800]="breakfastIncluded()"
                          [class.text-white]="breakfastIncluded()"
                          [class.border-teal-800]="breakfastIncluded()"
                          [class.bg-white]="!breakfastIncluded()"
                          [class.text-slate-700]="!breakfastIncluded()"
                          [class.border-slate-300]="!breakfastIncluded()"
                          data-testid="breakfast-yes"
                        >
                          Oui
                        </button>
                        <button
                          type="button"
                          (click)="setBreakfast(false)"
                          class="rb-res-btn flex-1 px-3 rounded-lg text-xs font-semibold border whitespace-nowrap"
                          [class.bg-teal-800]="!breakfastIncluded()"
                          [class.text-white]="!breakfastIncluded()"
                          [class.border-teal-800]="!breakfastIncluded()"
                          [class.bg-white]="breakfastIncluded()"
                          [class.text-slate-700]="breakfastIncluded()"
                          [class.border-slate-300]="breakfastIncluded()"
                          data-testid="breakfast-no"
                        >
                          Non
                        </button>
                      </div>
                    </div>

                    <div>
                      <label for="res-source" class="block text-xs font-semibold text-slate-700 mb-1">
                        Source
                      </label>
                      <select
                        id="res-source"
                        name="source"
                        [ngModel]="source()"
                        (ngModelChange)="onSourceChange($event)"
                        class="w-full min-h-[40px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                        data-testid="res-source-select"
                      >
                        <option value="RECEPTION">Réception</option>
                        <option value="TELEPHONE">Téléphone</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="EN_LIGNE">En ligne</option>
                        <option value="ENTREPRISE">Entreprise</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label for="res-notes" class="block text-xs font-semibold text-slate-700 mb-1">
                      Note interne courte
                    </label>
                    <textarea
                      id="res-notes"
                      name="notes"
                      rows="2"
                      maxlength="300"
                      [ngModel]="notes()"
                      (ngModelChange)="onNotesChange($event)"
                      placeholder="Demande particulière, heure d'arrivée…"
                      class="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900"
                      data-testid="res-notes-input"
                    ></textarea>
                  </div>
                </section>
              </form>

              <!-- Colonne droite desktop : Récapitulatif fixe pendant le défilement -->
              <aside
                class="hidden md:block rb-res-summary-sticky p-4 rounded-xl border border-slate-200 bg-slate-50"
                aria-label="Récapitulatif de la réservation"
                data-testid="reservation-summary-desktop"
              >
                <h3 class="text-sm font-bold text-slate-900 pb-2 mb-3 border-b border-slate-200">
                  Récapitulatif
                </h3>
                <dl class="space-y-2 text-xs text-slate-700">
                  <div class="flex justify-between gap-2">
                    <dt>Client</dt>
                    <dd class="font-semibold text-slate-900 text-right">{{ summaryGuestLabel() }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Chambre</dt>
                    <dd class="font-semibold text-slate-900 text-right">{{ summaryRoomLabel() }}</dd>
                  </div>
                  <div class="flex justify-between gap-2">
                    <dt>Durée</dt>
                    <dd class="font-semibold text-slate-900">{{ nights() }} {{ nights() > 1 ? 'nuits' : 'nuit' }}</dd>
                  </div>
                  @if (canViewAmounts()) {
                    <div class="flex justify-between gap-2">
                      <dt>Tarif / nuit</dt>
                      <dd class="font-semibold text-slate-900">{{ hasValidTariff() ? formatFcfa(ratePerNight()) : '—' }}</dd>
                    </div>
                    <div class="flex justify-between gap-2">
                      <dt>Sous-total</dt>
                      <dd class="font-semibold text-slate-900">{{ hasValidTariff() ? formatFcfa(subtotalFcfa()) : '—' }}</dd>
                    </div>
                    <div class="flex justify-between gap-2">
                      <dt>Taxe de séjour</dt>
                      <dd class="font-semibold text-slate-900">{{ formatFcfa(tourismTaxFcfa()) }}</dd>
                    </div>
                    @if (discountFcfa() > 0) {
                      <div class="flex justify-between gap-2 text-emerald-800">
                        <dt>Remise</dt>
                        <dd class="font-semibold">− {{ formatFcfa(appliedDiscountFcfa()) }}</dd>
                      </div>
                    }
                    <div class="flex justify-between gap-2 pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                      <dt>Total</dt>
                      <dd data-testid="summary-total">{{ hasValidTariff() ? formatFcfa(totalFcfa()) : '—' }}</dd>
                    </div>
                    <div class="flex justify-between gap-2">
                      <dt>Acompte</dt>
                      <dd class="font-semibold text-teal-800">{{ formatFcfa(depositFcfa()) }}</dd>
                    </div>
                    <div class="flex justify-between gap-2 font-bold text-slate-900">
                      <dt>Reste à payer</dt>
                      <dd data-testid="summary-remaining">{{ hasValidTariff() ? formatFcfa(remainingFcfa()) : '—' }}</dd>
                    </div>
                  }
                </dl>
              </aside>
            </div>
          </div>
        </div>

        <!-- Barre récapitulatif mobile fixée au-dessus du pied -->
        <div
          class="md:hidden shrink-0 px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 text-xs"
          data-testid="reservation-summary-mobile"
        >
          <div>
            <span class="font-bold text-slate-900">{{ summaryRoomLabel() }}</span>
            <span class="text-slate-600 ml-1">· {{ nights() }} {{ nights() > 1 ? 'nuits' : 'nuit' }}</span>
          </div>
          @if (canViewAmounts()) {
            <div class="text-right">
              <span class="font-extrabold text-slate-900">
                Total {{ hasValidTariff() ? formatFcfa(totalFcfa()) : '—' }}
              </span>
              <span class="block text-slate-600">
                Reste {{ hasValidTariff() ? formatFcfa(remainingFcfa()) : '—' }}
              </span>
            </div>
          }
        </div>

        <!-- Zone 3 : Pied de fenêtre fixe -->
        <footer class="shrink-0 px-4 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            (click)="requestClose()"
            class="rb-res-btn px-4 rounded-lg border border-slate-300 bg-white text-slate-800 hover:bg-slate-100 text-sm font-semibold whitespace-nowrap"
            data-testid="reservation-cancel-btn"
          >
            Annuler
          </button>
          <button
            type="button"
            [disabled]="!canSubmit() || modalService.isSubmitting()"
            (click)="submitForm()"
            class="rb-res-btn px-5 rounded-lg bg-teal-800 text-white hover:bg-teal-900 disabled:opacity-45 disabled:cursor-not-allowed text-sm font-bold whitespace-nowrap"
            data-testid="reservation-confirm-btn"
          >
            {{ modalService.isSubmitting() ? 'Enregistrement…' : 'Confirmer la réservation' }}
          </button>
        </footer>
      </div>
    </div>
  `,
})
export class ReservationModalComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly modalService: ReservationModalService;
  private readonly tariffsService: TariffsService | null;
  readonly scrollbarSide: ScrollbarSide = SCROLLBAR_SIDE;

  readonly todayIso = getTodayIso();
  readonly durationOptions = [
    { label: '1 nuit', days: 1 },
    { label: '2 nuits', days: 2 },
    { label: '3 nuits', days: 3 },
    { label: '1 semaine', days: 7 },
  ];
  readonly categoryFilters: ReadonlyArray<{ label: string; value: 'ALL' | RoomCategoryType }> = [
    { label: 'Toutes', value: 'ALL' },
    { label: 'Standard', value: 'Standard' },
    { label: 'Confort', value: 'Confort' },
    { label: 'Appartement', value: 'Appartement' },
  ];

  readonly checkInDate = signal<string>(this.todayIso);
  readonly checkOutDate = signal<string>(addDaysIso(this.todayIso, 2));
  readonly adultsCount = signal<number>(1);
  readonly childrenCount = signal<number>(0);
  readonly roomsUsed = signal<number>(1);
  readonly categoryFilter = signal<'ALL' | RoomCategoryType>('ALL');

  readonly availableRooms = signal<AvailableRoomItem[]>([]);
  readonly roomsLoading = signal<boolean>(false);
  readonly showAllRooms = signal<boolean>(false);
  readonly selectedRoom = signal<AvailableRoomItem | null>(null);
  readonly liveQuote = signal<ReservationPriceQuoteDto | null>(null);
  readonly rates = signal<HotelRatesConfig>({
    tourismTaxPerNightPerPerson: 1000,
    tourismTaxIncludesChildren: false,
    vatRatePercent: 10,
  });

  readonly useDirectorOverride = signal<boolean>(false);
  readonly overridePricePerNightFcfa = signal<number>(0);
  readonly priceOverrideReason = signal<string>('');

  constructor(modalService?: ReservationModalService, tariffsService?: TariffsService) {
    this.modalService = modalService ?? inject(ReservationModalService);
    let injectedTariffs: TariffsService | null = null;
    if (!tariffsService) {
      try {
        injectedTariffs = inject(TariffsService, { optional: true });
      } catch {
        injectedTariffs = null;
      }
    }
    this.tariffsService = tariffsService ?? injectedTariffs;
    this.rates.set(this.modalService.getCachedRates());
  }

  readonly isQuickGuestMode = signal<boolean>(false);
  readonly guestQuery = signal<string>('');
  readonly guestResults = signal<GuestQuickSearchItem[]>([]);
  readonly guestsLoading = signal<boolean>(false);
  readonly selectedGuest = signal<GuestQuickSearchItem | null>(null);
  readonly newGuestName = signal<string>('');
  readonly newGuestPhone = signal<string>('');

  readonly depositFcfa = signal<number>(0);
  readonly discountFcfa = signal<number>(0);
  readonly paymentMethod = signal<PaymentMethodType>('CASH');
  readonly transactionRef = signal<string>('');
  readonly breakfastIncluded = signal<boolean>(true);
  readonly source = signal<ReservationSourceType>('RECEPTION');
  readonly notes = signal<string>('');
  readonly localError = signal<string | null>(null);
  readonly isDirty = signal<boolean>(false);

  private previousActiveEl: HTMLElement | null = null;
  private guestDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private keydownListener: ((ev: KeyboardEvent) => void) | null = null;
  private preferredRoomNumber: string | null = null;
  private preferredRoomId: string | null = null;

  readonly minCheckOutIso = computed(() => addDaysIso(this.checkInDate() || this.todayIso, 1));
  readonly nights = computed(() => computeNights(this.checkInDate(), this.checkOutDate()));

  readonly filteredRooms = computed(() => {
    const cat = this.categoryFilter();
    const list = this.availableRooms();
    return cat === 'ALL' ? list : list.filter((r) => r.category === cat);
  });

  readonly visibleRooms = computed(() => {
    const list = this.filteredRooms();
    return this.showAllRooms() ? list : list.slice(0, MAX_VISIBLE_ROOMS);
  });

  readonly isDirector = computed(() => this.modalService.isDirector());
  readonly canViewAmounts = computed(() => this.modalService.canViewAmounts());
  readonly totalGuests = computed(() => this.adultsCount() + this.childrenCount());

  readonly isSelectedApartment = computed(() => {
    const room = this.selectedRoom();
    if (!room) return false;
    const code = normalizeTariffCategoryCode(room.tariffCategoryCode || room.category);
    return code === 'APPARTEMENT';
  });

  /** Calcul local instantané depuis la grille réelle (toujours confirmé par /api/tariffs/quote et le serveur) */
  private readonly localTariffEvaluation = computed<{
    available: boolean;
    ratePerNightFcfa: number | null;
    summaryLine: string | null;
    errorMessage: string | null;
  }>(() => {
    const room = this.selectedRoom();
    const n = this.nights();
    if (!room || n <= 0) {
      return { available: false, ratePerNightFcfa: null, summaryLine: null, errorMessage: null };
    }

    const code = normalizeTariffCategoryCode(room.tariffCategoryCode || room.category);
    const guests = this.totalGuests();
    const usedRooms = code === 'APPARTEMENT' ? this.roomsUsed() : 1;

    // Surcharge direction
    if (this.isDirector() && this.useDirectorOverride()) {
      const manual = Math.round(this.overridePricePerNightFcfa());
      const reason = this.priceOverrideReason().trim();
      if (manual <= 0 || reason.length < 3) {
        return {
          available: false,
          ratePerNightFcfa: null,
          summaryLine: null,
          errorMessage: 'Saisissez un prix entier positif en FCFA et un motif (3 caractères minimum).',
        };
      }
      const totalAcc = manual * n;
      return {
        available: true,
        ratePerNightFcfa: manual,
        summaryLine: `Prix fixé par la direction : ${this.formatFcfa(manual)} par nuit, total ${this.formatFcfa(totalAcc)} pour ${n} ${n > 1 ? 'nuits' : 'nuit'}`,
        errorMessage: null,
      };
    }

    // Priorité au devis autoritaire retourné par le serveur s'il correspond aux paramètres courants
    const quote = this.liveQuote();
    if (
      quote &&
      quote.guestsCount === guests &&
      quote.nights === n &&
      quote.roomsUsed === usedRooms &&
      (quote.categoryCode === code || (!quote.categoryCode && !code))
    ) {
      return {
        available: quote.available,
        ratePerNightFcfa: quote.ratePerNightFcfa,
        summaryLine: quote.summaryLine,
        errorMessage: quote.errorMessage,
      };
    }

    if (!code) {
      return {
        available: false,
        ratePerNightFcfa: null,
        summaryLine: null,
        errorMessage:
          "Cette chambre n'est pas encore classée (À classer). Demandez à la direction de définir sa catégorie avant de réserver.",
      };
    }

    const grid = this.tariffsService?.tariffs() ?? [];
    if (grid.length > 0) {
      const catRows = grid.filter(
        (t) => t.isActive && normalizeTariffCategoryCode(t.categoryCode || t.categoryName) === code,
      );
      const matched =
        code === 'APPARTEMENT'
          ? (catRows.find((t) => t.guestsCount === guests && t.roomsUsed === usedRooms) ??
            catRows.find((t) => t.guestsCount === guests && t.roomsUsed === null))
          : catRows.find((t) => t.guestsCount === guests);

      const categoryName =
        code === 'STANDARD' ? 'Standard' : code === 'CONFORT' ? 'Confort' : 'Appartement';
      const personWord = guests > 1 ? 'personnes' : 'personne';

      if (!matched) {
        const msg =
          code === 'APPARTEMENT'
            ? `Pas de tarif pour ${guests} ${personWord} (${usedRooms} ${usedRooms > 1 ? 'chambres' : 'chambre'}) en Appartement. Choisissez une autre formule ou demandez à la direction.`
            : `Pas de tarif pour ${guests} ${personWord} en chambre ${categoryName}. Choisissez un appartement ou demandez à la direction.`;
        return { available: false, ratePerNightFcfa: null, summaryLine: null, errorMessage: msg };
      }

      if (matched.pricePerNightFcfa === null || matched.pricePerNightFcfa <= 0) {
        const roomDetail =
          code === 'APPARTEMENT'
            ? ` (${usedRooms} ${usedRooms > 1 ? 'chambres' : 'chambre'})`
            : '';
        return {
          available: false,
          ratePerNightFcfa: null,
          summaryLine: null,
          errorMessage: `Tarif non défini pour ${guests} ${personWord}${roomDetail} en ${code === 'APPARTEMENT' ? 'Appartement' : `chambre ${categoryName}`}. Demandez à la direction de fixer ce tarif.`,
        };
      }

      const rate = matched.pricePerNightFcfa;
      const acc = rate * n;
      const prefix = code === 'APPARTEMENT' ? 'Appartement' : `Chambre ${categoryName}`;
      const roomsPart =
        code === 'APPARTEMENT' ? `, ${usedRooms} ${usedRooms > 1 ? 'chambres' : 'chambre'}` : '';
      const bfastPart = this.breakfastIncluded() ? ', petit-déjeuner inclus' : '';
      const nightsPart = `${n} ${n > 1 ? 'nuits' : 'nuit'}`;
      const fmt = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return {
        available: true,
        ratePerNightFcfa: rate,
        summaryLine: `${prefix}, ${guests} ${personWord}${roomsPart}${bfastPart} : ${fmt(rate)} FCFA par nuit, total ${fmt(acc)} FCFA pour ${nightsPart}`,
        errorMessage: null,
      };
    }

    // Repli lecture seule uniquement si la grille n'est pas encore chargée (ex. tests unitaires sans TariffsService)
    if (typeof room.pricePerNight === 'number' && room.pricePerNight > 0) {
      const rate = room.pricePerNight;
      const acc = rate * n;
      const fmt = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return {
        available: true,
        ratePerNightFcfa: rate,
        summaryLine: `Chambre ${room.category}, ${guests} ${guests > 1 ? 'personnes' : 'personne'}${this.breakfastIncluded() ? ', petit-déjeuner inclus' : ''} : ${fmt(rate)} FCFA par nuit, total ${fmt(acc)} FCFA pour ${n} ${n > 1 ? 'nuits' : 'nuit'}`,
        errorMessage: null,
      };
    }

    return {
      available: false,
      ratePerNightFcfa: null,
      summaryLine: null,
      errorMessage: 'Chargement du tarif en cours…',
    };
  });

  readonly tariffSummaryLine = computed(() => this.localTariffEvaluation().summaryLine);
  readonly tariffErrorMessage = computed(() => this.localTariffEvaluation().errorMessage);
  readonly hasValidTariff = computed(() => this.localTariffEvaluation().available);

  readonly ratePerNight = computed(() => this.localTariffEvaluation().ratePerNightFcfa ?? 0);
  readonly subtotalFcfa = computed(() => Math.round(this.ratePerNight() * this.nights()));
  readonly tourismTaxFcfa = computed(() => {
    if (!this.selectedRoom() || this.nights() <= 0) return 0;
    const includesChildren = this.rates().tourismTaxIncludesChildren ?? false;
    const guests = includesChildren ? this.adultsCount() + this.childrenCount() : this.adultsCount();
    return Math.round(this.nights() * guests * this.rates().tourismTaxPerNightPerPerson);
  });
  readonly appliedDiscountFcfa = computed(() =>
    Math.min(this.subtotalFcfa(), Math.max(0, Math.round(this.discountFcfa()))),
  );
  readonly totalFcfa = computed(() =>
    Math.max(0, this.subtotalFcfa() + this.tourismTaxFcfa() - this.appliedDiscountFcfa()),
  );
  readonly remainingFcfa = computed(() =>
    Math.max(0, this.totalFcfa() - Math.max(0, Math.round(this.depositFcfa()))),
  );

  readonly isQuickPhoneValid = computed(() =>
    SENEGAL_PHONE_REGEX.test(this.newGuestPhone().trim()),
  );
  readonly hasCardPanRisk = computed(() =>
    CARD_PAN_REGEX.test(this.transactionRef().trim()),
  );

  readonly headerSubtitle = computed(() => {
    const room = this.selectedRoom();
    const n = this.nights();
    if (room && n > 0) {
      return `${this.checkInDate()} → ${this.checkOutDate()} (${n} ${n > 1 ? 'nuits' : 'nuit'}) · Chambre ${room.number}`;
    }
    return 'Séjour, chambre et client • Résidence Blue';
  });

  readonly summaryGuestLabel = computed(() => {
    if (this.isQuickGuestMode()) {
      return this.newGuestName().trim() || 'Nouveau client';
    }
    return this.selectedGuest()?.fullName || 'À sélectionner';
  });

  readonly summaryRoomLabel = computed(() => {
    const room = this.selectedRoom();
    return room ? `Ch. ${room.number} (${room.category})` : 'À sélectionner';
  });

  readonly canSubmit = computed(() => {
    const room = this.selectedRoom();
    if (!room || this.nights() <= 0 || !this.hasValidTariff()) return false;
    if (!this.isSelectedApartment() && !this.isRoomCapacityValid(room)) return false;
    if (this.hasCardPanRisk()) return false;
    if (this.depositFcfa() < 0 || this.discountFcfa() < 0) return false;
    if (this.isQuickGuestMode()) {
      return this.newGuestName().trim().length >= 2 && this.isQuickPhoneValid();
    }
    return Boolean(this.selectedGuest()?.id);
  });

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      this.previousActiveEl = document.activeElement as HTMLElement | null;
      this.keydownListener = (ev: KeyboardEvent) => this.handleKeyDown(ev);
      document.addEventListener('keydown', this.keydownListener);
    }

    const params = this.modalService.currentParams();
    if (params?.checkInDate) {
      const normalizedIn = params.checkInDate >= this.todayIso ? params.checkInDate : this.todayIso;
      this.checkInDate.set(normalizedIn);
      const nextOut =
        params.checkOutDate && params.checkOutDate > normalizedIn
          ? params.checkOutDate
          : addDaysIso(normalizedIn, 2);
      this.checkOutDate.set(nextOut);
    }
    if (params?.category) {
      this.categoryFilter.set(params.category);
    }
    if (params?.roomNumber) this.preferredRoomNumber = params.roomNumber;
    if (params?.roomId) this.preferredRoomId = params.roomId;

    if (params?.guestId) {
      if (params.guestName) {
        this.selectedGuest.set({
          id: params.guestId,
          fullName: params.guestName,
          phone: params.guestPhone || '',
        });
      } else {
        void this.preloadGuest(params.guestId);
      }
    }

    void this.tariffsService?.fetchGrid();
    void this.loadAvailableRooms();
  }

  ngAfterViewInit(): void {
    if (typeof requestAnimationFrame !== 'undefined' && typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="res-checkin-input"]');
        el?.focus();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.guestDebounceTimer) {
      clearTimeout(this.guestDebounceTimer);
      this.guestDebounceTimer = null;
    }
    if (this.keydownListener && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this.keydownListener);
      this.keydownListener = null;
    }
    this.modalService.abortPendingRequests();
    if (this.previousActiveEl && typeof this.previousActiveEl.focus === 'function') {
      this.previousActiveEl.focus();
    }
  }

  formatFcfa(value: number): string {
    return `${Math.round(value).toLocaleString('fr-FR')} FCFA`;
  }

  isRoomCapacityValid(room: AvailableRoomItem): boolean {
    return (
      this.adultsCount() <= room.adultsCapacity &&
      this.childrenCount() <= room.childrenCapacity &&
      this.adultsCount() + this.childrenCount() <= room.capacity
    );
  }

  onCheckInChange(val: string): void {
    if (!val) return;
    this.isDirty.set(true);
    this.localError.set(null);
    this.checkInDate.set(val);
    if (this.checkOutDate() <= val) {
      this.checkOutDate.set(addDaysIso(val, 1));
    }
    void this.loadAvailableRooms();
  }

  onCheckOutChange(val: string): void {
    if (!val) return;
    this.isDirty.set(true);
    this.localError.set(null);
    this.checkOutDate.set(val);
    void this.loadAvailableRooms();
  }

  applyDuration(days: number): void {
    this.isDirty.set(true);
    this.localError.set(null);
    const start = this.checkInDate() || this.todayIso;
    this.checkInDate.set(start);
    this.checkOutDate.set(addDaysIso(start, days));
    void this.loadAvailableRooms();
  }

  changeAdults(delta: number): void {
    const next = Math.min(6, Math.max(1, this.adultsCount() + delta));
    if (next === this.adultsCount()) return;
    this.isDirty.set(true);
    this.adultsCount.set(next);
    void this.refreshLiveQuote();
  }

  changeChildren(delta: number): void {
    const next = Math.min(4, Math.max(0, this.childrenCount() + delta));
    if (next === this.childrenCount()) return;
    this.isDirty.set(true);
    this.childrenCount.set(next);
    void this.refreshLiveQuote();
  }

  setRoomsUsed(count: number): void {
    const next = Math.min(3, Math.max(1, Math.round(count)));
    this.isDirty.set(true);
    this.roomsUsed.set(next);
    void this.refreshLiveQuote();
  }

  toggleDirectorOverride(enabled: boolean): void {
    this.isDirty.set(true);
    this.useDirectorOverride.set(Boolean(enabled));
    if (enabled && this.overridePricePerNightFcfa() <= 0 && this.ratePerNight() > 0) {
      this.overridePricePerNightFcfa.set(this.ratePerNight());
    }
  }

  onOverridePriceChange(val: number | string): void {
    this.isDirty.set(true);
    this.overridePricePerNightFcfa.set(Math.max(0, Math.round(Number(val) || 0)));
  }

  onOverrideReasonChange(val: string): void {
    this.isDirty.set(true);
    this.priceOverrideReason.set(val);
  }

  selectCategory(cat: 'ALL' | RoomCategoryType): void {
    this.categoryFilter.set(cat);
    this.showAllRooms.set(false);
  }

  selectRoom(room: AvailableRoomItem): void {
    this.isDirty.set(true);
    this.localError.set(null);
    this.selectedRoom.set(room);
    this.breakfastIncluded.set(room.breakfastIncluded);
    const isApt = normalizeTariffCategoryCode(room.tariffCategoryCode || room.category) === 'APPARTEMENT';
    if (!isApt) {
      this.roomsUsed.set(1);
    } else if (this.totalGuests() >= 3 && this.roomsUsed() < 2) {
      this.roomsUsed.set(2);
    }
    void this.refreshLiveQuote();
  }

  toggleQuickGuest(): void {
    this.isDirty.set(true);
    this.localError.set(null);
    const next = !this.isQuickGuestMode();
    this.isQuickGuestMode.set(next);
    if (next) {
      this.selectedGuest.set(null);
      this.guestResults.set([]);
    }
  }

  onGuestQueryChange(val: string): void {
    this.isDirty.set(true);
    this.guestQuery.set(val);
    if (this.guestDebounceTimer) {
      clearTimeout(this.guestDebounceTimer);
      this.guestDebounceTimer = null;
    }
    const q = val.trim();
    if (!q) {
      this.guestResults.set([]);
      this.guestsLoading.set(false);
      return;
    }
    this.guestsLoading.set(true);
    this.guestDebounceTimer = setTimeout(() => {
      this.guestDebounceTimer = null;
      void this.executeGuestSearch(q);
    }, 250);
  }

  selectGuest(guest: GuestQuickSearchItem): void {
    this.isDirty.set(true);
    this.localError.set(null);
    this.selectedGuest.set(guest);
    this.guestResults.set([]);
  }

  clearSelectedGuest(): void {
    this.isDirty.set(true);
    this.selectedGuest.set(null);
  }

  onNewGuestNameChange(val: string): void {
    this.isDirty.set(true);
    this.newGuestName.set(val);
  }

  onNewGuestPhoneChange(val: string): void {
    this.isDirty.set(true);
    this.newGuestPhone.set(val);
  }

  onDepositChange(val: number | string): void {
    this.isDirty.set(true);
    const parsed = Math.max(0, Math.round(Number(val) || 0));
    this.depositFcfa.set(parsed);
  }

  onDiscountChange(val: number | string): void {
    this.isDirty.set(true);
    const parsed = Math.max(0, Math.round(Number(val) || 0));
    this.discountFcfa.set(parsed);
  }

  onPaymentMethodChange(val: PaymentMethodType): void {
    this.isDirty.set(true);
    this.paymentMethod.set(val);
  }

  onTransactionRefChange(val: string): void {
    this.isDirty.set(true);
    this.transactionRef.set(val);
  }

  setBreakfast(val: boolean): void {
    this.isDirty.set(true);
    this.breakfastIncluded.set(val);
    void this.refreshLiveQuote();
  }

  onSourceChange(val: ReservationSourceType): void {
    this.isDirty.set(true);
    this.source.set(val);
  }

  onNotesChange(val: string): void {
    this.isDirty.set(true);
    this.notes.set(val);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.requestClose();
    }
  }

  requestClose(): void {
    if (this.modalService.isSubmitting()) return;
    if (
      this.isDirty() &&
      typeof window !== 'undefined' &&
      !window.confirm(
        'Vous avez des modifications non enregistrées. Voulez-vous vraiment fermer cette fenêtre ?',
      )
    ) {
      return;
    }
    this.modalService.close();
  }

  async submitForm(): Promise<void> {
    if (!this.canSubmit() || this.modalService.isSubmitting()) return;
    const room = this.selectedRoom();
    if (!room) return;

    this.localError.set(null);
    const payload: CreateReservationPayload = {
      roomId: room.id,
      roomNumber: room.number,
      checkInDate: this.checkInDate(),
      checkOutDate: this.checkOutDate(),
      adultsCount: this.adultsCount(),
      childrenCount: this.childrenCount(),
      roomsUsed: this.isSelectedApartment() ? this.roomsUsed() : 1,
      depositFcfa: Math.max(0, Math.round(this.depositFcfa())),
      discountFcfa: Math.max(0, Math.round(this.discountFcfa())),
      paymentMethod: this.depositFcfa() > 0 ? this.paymentMethod() : undefined,
      transactionRef: this.transactionRef().trim() || undefined,
      breakfastIncluded: this.breakfastIncluded(),
      source: this.source(),
      notes: this.notes().trim() || undefined,
      ...(this.isDirector() && this.useDirectorOverride()
        ? {
            overridePricePerNightFcfa: Math.round(this.overridePricePerNightFcfa()),
            priceOverrideReason: this.priceOverrideReason().trim(),
          }
        : {}),
      ...(this.isQuickGuestMode()
        ? {
            newGuest: {
              fullName: this.newGuestName().trim(),
              phone: this.newGuestPhone().trim(),
            },
          }
        : { guestId: this.selectedGuest()!.id }),
    };

    const result = await this.modalService.confirmReservation(payload);
    if (!result.ok && result.conflict) {
      this.selectedRoom.set(null);
      void this.loadAvailableRooms();
    }
  }

  private async refreshLiveQuote(): Promise<void> {
    const room = this.selectedRoom();
    const n = this.nights();
    if (!room || n <= 0 || !this.tariffsService) {
      this.liveQuote.set(null);
      return;
    }
    const quote = await this.tariffsService.fetchQuote({
      roomId: room.id,
      guestsCount: this.totalGuests(),
      roomsUsed: this.isSelectedApartment() ? this.roomsUsed() : 1,
      nights: n,
      adultsCount: this.adultsCount(),
      childrenCount: this.childrenCount(),
      breakfastIncluded: this.breakfastIncluded(),
    });
    if (quote) {
      this.liveQuote.set(quote);
    }
  }

  private async loadAvailableRooms(): Promise<void> {
    if (this.nights() <= 0) {
      this.availableRooms.set([]);
      this.selectedRoom.set(null);
      this.liveQuote.set(null);
      return;
    }
    this.roomsLoading.set(true);
    try {
      const resp = await this.modalService.fetchAvailableRooms(
        this.checkInDate(),
        this.checkOutDate(),
      );
      if (resp.rates) {
        this.rates.set(resp.rates);
      }
      this.availableRooms.set(resp.items);

      const currentId = this.selectedRoom()?.id;
      const match =
        resp.items.find((r) => this.preferredRoomId && r.id === this.preferredRoomId) ??
        resp.items.find((r) => this.preferredRoomNumber && r.number === this.preferredRoomNumber) ??
        resp.items.find((r) => currentId && r.id === currentId) ??
        null;

      if (match) {
        this.selectedRoom.set(match);
        this.breakfastIncluded.set(match.breakfastIncluded);
        this.preferredRoomId = null;
        this.preferredRoomNumber = null;
        void this.refreshLiveQuote();
      } else {
        this.selectedRoom.set(null);
        this.liveQuote.set(null);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        this.localError.set(err?.message || 'Impossible de charger les chambres libres.');
      }
    } finally {
      this.roomsLoading.set(false);
    }
  }

  private async executeGuestSearch(query: string): Promise<void> {
    try {
      const items = await this.modalService.searchGuests(query);
      this.guestResults.set(items.slice(0, 5));
    } catch {
      // Ignorer AbortError quand une frappe suivante annule la requête
    } finally {
      this.guestsLoading.set(false);
    }
  }

  private async preloadGuest(guestId: string): Promise<void> {
    const guest = await this.modalService.fetchGuestById(guestId);
    if (guest) {
      this.selectedGuest.set(guest);
    }
  }

  private handleKeyDown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      this.requestClose();
      return;
    }

    if (
      ev.key === 'Enter' &&
      !ev.shiftKey &&
      (ev.target as HTMLElement | null)?.tagName !== 'TEXTAREA' &&
      (ev.target as HTMLElement | null)?.tagName !== 'BUTTON' &&
      this.canSubmit()
    ) {
      ev.preventDefault();
      void this.submitForm();
      return;
    }

    if (ev.key === 'Tab') {
      this.trapFocus(ev);
    }
  }

  private trapFocus(ev: KeyboardEvent): void {
    if (typeof document === 'undefined') return;
    const dialog = document.querySelector<HTMLElement>('[data-testid="reservation-modal-dialog"]');
    if (!dialog) return;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);

    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (ev.shiftKey && (active === first || !dialog.contains(active))) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && (active === last || !dialog.contains(active))) {
      ev.preventDefault();
      first.focus();
    }
  }
}
