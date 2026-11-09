import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { GuestProfile, GuestStay } from '@residence-blue/shared';
import { GuestProfileService } from '../../core/services/guest-profile.service';
import { ReservationModalService } from '../../core/services/reservation-modal.service';

type ActiveTab = 'historique' | 'preferences' | 'factures' | 'notes';

@Component({
  selector: 'app-client-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="flex flex-col w-full pb-16" data-testid="client-profile-container">
      <!-- Toast Notification -->
      @if (toastMessage()) {
        <div
          class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-inverse-surface text-inverse-on-surface shadow-lg text-body-sm flex items-center gap-2 border border-outline-variant/30 animate-fade-in"
          role="status"
          data-testid="toast-notification"
        >
          <span class="material-symbols-outlined text-[18px] text-secondary">info</span>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      <!-- Top Breadcrumb & Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md mb-space-lg">
        <div class="flex flex-col">
          <div class="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
            <a class="hover:text-primary transition-colors cursor-pointer" routerLink="/tableau-de-bord">Clients</a>
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">chevron_right</span>
            <span class="text-on-surface font-title-md">{{ profile().fullName }}</span>
            <span class="ml-space-xs px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
              {{ profile().vipTier }}
            </span>
          </div>
          <h1 class="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-0.5">Fiche Voyageur</h1>
        </div>

        <!-- Quick Action Hub -->
        <div class="flex items-center flex-wrap gap-space-sm">
          <button
            class="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-sm transition-all font-title-md text-title-md cursor-pointer border border-surface-variant/40"
            type="button"
            data-testid="btn-edit-profile"
            (click)="showToast('Édition du profil voyageur bientôt disponible (TODO: API clients)')"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
            <span>Éditer le profil</span>
          </button>

          <!-- Dropdown Contact / Message -->
          <div class="relative inline-block text-left" id="contactDropdownWrapper">
            <button
              class="inline-flex items-center gap-space-xs px-space-md py-2.5 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-surface-container shadow-sm transition-all font-title-md text-title-md cursor-pointer border border-surface-variant/40"
              id="contactButton"
              type="button"
              data-testid="btn-message-dropdown"
              (click)="toggleContactMenu()"
              [attr.aria-expanded]="contactMenuOpen()"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
              <span>Message</span>
              <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">expand_more</span>
            </button>

            @if (contactMenuOpen()) {
              <div
                class="absolute right-0 mt-2 w-64 rounded-xl bg-surface-container-lowest shadow-xl z-30 p-1.5 flex flex-col gap-0.5 border border-surface-variant/40"
                id="contactMenu"
                data-testid="contact-dropdown-menu"
              >
                <button
                  class="flex items-center gap-space-sm px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container text-body-sm transition-colors text-left cursor-pointer w-full"
                  type="button"
                  data-testid="btn-whatsapp"
                  (click)="handleInactiveContact('WhatsApp (+221 77...)')"
                >
                  <span class="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">perm_phone_msg</span>
                  <div class="flex flex-col">
                    <span>WhatsApp (+221 77...)</span>
                    <span class="text-[11px] text-outline">Inactif (TODO notifications WhatsApp)</span>
                  </div>
                </button>

                <button
                  class="flex items-center gap-space-sm px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container text-body-sm transition-colors text-left cursor-pointer w-full"
                  type="button"
                  data-testid="btn-email"
                  (click)="handleInactiveContact('Email formel')"
                >
                  <span class="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">mail</span>
                  <div class="flex flex-col">
                    <span>Email formel</span>
                    <span class="text-[11px] text-outline">Inactif (TODO notifications SMTP)</span>
                  </div>
                </button>

                <button
                  class="w-full flex items-center gap-space-sm px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container text-body-sm transition-colors text-left cursor-pointer"
                  type="button"
                  data-testid="btn-sms"
                  (click)="handleInactiveContact('SMS d\\'accueil')"
                >
                  <span class="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">sms</span>
                  <div class="flex flex-col">
                    <span>SMS d'accueil</span>
                    <span class="text-[11px] text-outline">Inactif (TODO passerelle SMS)</span>
                  </div>
                </button>
              </div>
            }
          </div>

          <!-- New Reservation CTA Button -->
          <button
            class="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-xl bg-primary text-on-primary hover:bg-primary-container shadow-md transition-all font-title-md text-title-md cursor-pointer"
            type="button"
            data-testid="btn-new-reservation-guest"
            (click)="openNewReservationModal()"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">bookmark_add</span>
            <span>Nouvelle réservation</span>
          </button>
        </div>
      </div>

      <!-- Main Grid: Left Profile Bar & Right Operational Records -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <!-- LEFT COLUMN : Guest Passport & Synthesis (approx 380px) -->
        <div class="lg:col-span-4 xl:col-span-4 flex flex-col gap-gutter">
          <!-- Primary Identity Card -->
          <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col relative overflow-hidden">
            <!-- Golden Corner Accent for VIP Gold -->
            <div class="absolute -right-12 -top-12 w-28 h-28 rounded-full bg-secondary-fixed/50 pointer-events-none" aria-hidden="true"></div>

            <div class="flex items-start gap-space-md mb-space-lg relative">
              <div class="relative flex-shrink-0">
                <img
                  class="w-20 h-20 rounded-2xl object-cover shadow-md"
                  [src]="profile().avatarUrl"
                  [alt]="'Photo de profil ' + profile().fullName"
                  data-testid="guest-avatar"
                />
                <span class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-sm" title="Client VIP Gold">
                  <span class="material-symbols-outlined text-[14px]" aria-hidden="true">star</span>
                </span>
              </div>
              <div class="flex flex-col min-w-0 flex-1">
                <div class="flex items-center gap-space-xs">
                  <span class="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md uppercase tracking-wider inline-flex items-center gap-1">
                    <span class="material-symbols-outlined text-[12px]" aria-hidden="true">workspace_premium</span>
                    {{ profile().vipTier }}
                  </span>
                </div>
                <h2 class="font-headline-md text-headline-md text-on-surface truncate leading-tight mt-1" data-testid="guest-fullname">
                  {{ profile().fullName }}
                </h2>
                <p class="font-label-md text-label-md text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <span class="material-symbols-outlined text-[14px] text-primary" aria-hidden="true">verified</span>
                  <span>Client fidèle • {{ profile().loyaltyStayCount }} séjours</span>
                </p>
              </div>
            </div>

            <!-- Contact & Demographic Matrix -->
            <div class="flex flex-col gap-space-sm bg-surface-container-low rounded-xl p-space-md mb-space-md">
              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">flag</span>
                  Nationalité
                </span>
                <span class="font-title-md text-on-surface flex items-center gap-1.5" data-testid="guest-nationality">
                  <span class="inline-block w-3.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-600 via-amber-400 to-rose-600" aria-hidden="true"></span>
                  {{ profile().nationality }}
                </span>
              </div>

              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">call</span>
                  Téléphone
                </span>
                <div class="flex items-center gap-1">
                  <a class="font-title-md text-primary hover:underline" [href]="'tel:' + profile().phone" data-testid="guest-phone">
                    {{ profile().phone }}
                  </a>
                  <button
                    class="p-1 text-outline hover:text-on-surface cursor-pointer rounded"
                    (click)="copyToClipboard(profile().phone, 'Numéro de téléphone copié')"
                    title="Copier le numéro"
                    type="button"
                    aria-label="Copier le numéro de téléphone"
                  >
                    <span class="material-symbols-outlined text-[14px]" aria-hidden="true">content_copy</span>
                  </button>
                </div>
              </div>

              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">mail</span>
                  Email
                </span>
                <a
                  class="font-body-sm text-on-surface hover:text-primary truncate max-w-[180px]"
                  [href]="'mailto:' + profile().email"
                  [title]="profile().email"
                  data-testid="guest-email"
                >
                  {{ profile().email }}
                </a>
              </div>

              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">apartment</span>
                  Affiliation
                </span>
                <span class="font-body-sm text-on-surface text-right" data-testid="guest-affiliation">
                  {{ profile().affiliationCompany }} <span class="text-outline-variant">•</span> {{ profile().affiliationRole }}
                </span>
              </div>

              <div class="flex items-center justify-between text-body-sm">
                <span class="text-on-surface-variant flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">home_pin</span>
                  Résidence
                </span>
                <span class="font-body-sm text-on-surface" data-testid="guest-residence">
                  {{ profile().residenceCity }}
                </span>
              </div>
            </div>

            <!-- Official Identity Document Block (Écart voulu : passeport masqué par défaut avec bouton afficher) -->
            <div class="bg-surface-container rounded-xl p-space-md flex items-center justify-between mb-space-md" data-testid="passport-block">
              <div class="flex items-center gap-space-sm">
                <div class="w-9 h-9 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center shadow-sm">
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">badge</span>
                </div>
                <div class="flex flex-col">
                  <div class="flex items-center gap-2">
                    <span class="font-label-md text-label-md text-on-surface-variant" data-testid="passport-number-display">
                      Passeport N° {{ isPassportRevealed() ? profile().passportNumber : maskedPassport() }}
                    </span>
                    <button
                      type="button"
                      class="text-xs text-primary hover:text-primary-container font-semibold underline cursor-pointer px-1 py-0.5"
                      data-testid="toggle-passport-btn"
                      (click)="togglePassportVisibility()"
                      [attr.aria-label]="isPassportRevealed() ? 'Masquer le numéro de passeport' : 'Afficher le numéro de passeport'"
                    >
                      {{ isPassportRevealed() ? 'Masquer' : 'Afficher' }}
                    </button>
                  </div>
                  <span class="font-body-sm text-body-sm text-on-surface">Valide jusqu'au {{ profile().passportExpiry }}</span>
                </div>
              </div>

              <!-- Scan PDF Button (Inactif selon l'écart voulu TODO) -->
              <button
                class="inline-flex items-center gap-1 text-primary hover:text-primary-container font-label-md text-label-md cursor-pointer"
                type="button"
                data-testid="btn-scan-pdf"
                (click)="showToast('Scan PDF inactif (TODO fonctionnalité d\\'envoi sécurisé de fichiers)')"
                title="Consulter le document numérisé"
              >
                <span>Scan PDF</span>
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
              </button>
            </div>

            <!-- Tags & Hospitality Care (ADAPTATION-THIES.md) -->
            <div class="flex flex-col gap-space-xs">
              <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Instructions permanentes</span>
              <div class="flex flex-wrap gap-1.5 mt-1">
                @for (inst of profile().permanentInstructions; track inst.text) {
                  <span
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-body-sm"
                    [ngClass]="{
                      'bg-secondary-fixed/40 text-on-secondary-fixed-variant': inst.variant === 'secondary',
                      'bg-surface-container text-on-surface-variant': inst.variant === 'surface',
                      'bg-primary/10 text-primary': inst.variant === 'primary'
                    }"
                  >
                    <span class="material-symbols-outlined text-[14px]" aria-hidden="true">{{ inst.icon }}</span>
                    <span>{{ inst.text }}</span>
                  </span>
                }
              </div>
            </div>
          </div>

          <!-- Financial & Loyalty KPI Card -->
          <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col">
            <div class="flex items-center justify-between mb-space-md">
              <span class="font-headline-sm text-headline-sm text-on-surface">Synthèse Clientèle</span>
              <span class="font-label-md text-label-md text-primary font-semibold">{{ profile().totalNights }} nuits au total</span>
            </div>

            <!-- Big Highlight Total Spend (FCFA en entiers stricts + conversion euros lue dans les paramètres) -->
            <div class="p-space-md rounded-xl bg-gradient-to-br from-surface-container-low to-surface-container flex flex-col mb-space-md">
              <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Total Dépensé (Chambres &amp; Folios)</span>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="font-headline-lg text-headline-lg text-primary font-semibold tracking-tight" data-testid="total-spent-amount">
                  {{ formatAmount(profile().totalSpentFcfa) }}
                </span>
                <span class="font-label-currency text-label-currency text-on-surface">FCFA</span>
              </div>
              <span class="font-body-sm text-body-sm text-outline mt-1" data-testid="euro-conversion-display">
                Équivalent approx. {{ euroEquivalentFormatted() }} €
              </span>
            </div>

            <div class="grid grid-cols-2 gap-space-sm mb-space-md">
              <div class="p-space-sm bg-surface-container-low rounded-xl flex flex-col">
                <span class="font-label-md text-label-md text-on-surface-variant">Panier moyen</span>
                <span class="font-title-lg text-title-lg text-on-surface font-semibold mt-0.5">
                  {{ formatAmount(profile().averageBasketFcfa) }} <span class="font-label-md text-label-md text-outline">FCFA</span>
                </span>
                <span class="text-body-sm text-outline mt-0.5">Par séjour de ~{{ profile().averageStayNights }} nuits</span>
              </div>

              <div class="p-space-sm bg-surface-container-low rounded-xl flex flex-col">
                <span class="font-label-md text-label-md text-on-surface-variant">Client depuis</span>
                <span class="font-title-lg text-title-lg text-on-surface font-semibold mt-0.5">{{ profile().memberSinceDate }}</span>
                <span class="text-body-sm text-outline mt-0.5">{{ profile().memberSinceDuration }}</span>
              </div>
            </div>

            <!-- Spending Breakdown Sparkline -->
            <div class="flex flex-col gap-1.5 pt-2">
              <div class="flex justify-between items-center text-body-sm">
                <span class="text-on-surface-variant">Répartition des dépenses</span>
                <span class="text-on-surface font-title-md">
                  Hébergement {{ profile().lodgingRatioPercent }}% • F&amp;B {{ profile().fbRatioPercent }}%
                </span>
              </div>
              <div class="w-full h-2 rounded-full bg-surface-container flex overflow-hidden">
                <div
                  class="h-full bg-primary"
                  [style.width.%]="profile().lodgingRatioPercent"
                  title="Hébergement: 78%"
                ></div>
                <div
                  class="h-full bg-secondary-container"
                  [style.width.%]="profile().fbRatioPercent"
                  title="Extras Resto &amp; Spa: 22%"
                ></div>
              </div>
            </div>
          </div>

          <!-- Quick Room Preference Mini-Hero (Thiès Grand Standing) -->
          <div class="relative rounded-xl overflow-hidden shadow-sm h-48 flex flex-col justify-end p-space-md" data-testid="favorite-room-hero">
            <img
              class="absolute inset-0 w-full h-full object-cover"
              [src]="profile().favoriteRoom.photoUrl"
              [alt]="profile().favoriteRoom.name"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/90 via-inverse-surface/40 to-transparent"></div>
            <div class="relative z-10 flex flex-col text-on-primary">
              <span class="font-label-md text-label-md uppercase tracking-wider text-secondary-fixed">Chambre Fétiche</span>
              <span class="font-headline-sm text-headline-sm leading-snug">{{ profile().favoriteRoom.name }}</span>
              <span class="font-body-sm text-body-sm text-surface-container-low opacity-90">{{ profile().favoriteRoom.reason }}</span>
            </div>
          </div>
        </div>

        <!-- RIGHT COLUMN : Tabbed Workspace (History, Preferences, Invoices, Team Notes) -->
        <div class="lg:col-span-8 xl:col-span-8 flex flex-col gap-space-lg">
          <!-- Refined Tab Navigation Bar -->
          <div class="bg-surface-container-lowest rounded-xl p-1.5 shadow-sm flex items-center justify-between overflow-x-auto border border-surface-variant/30">
            <div class="flex items-center gap-1 min-w-max" role="tablist">
              <button
                class="tab-button inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg font-title-md text-title-md transition-all cursor-pointer"
                [ngClass]="activeTab() === 'historique' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container'"
                (click)="setTab('historique')"
                data-tab="historique"
                data-testid="tab-historique"
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === 'historique'"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">history</span>
                <span>Historique des séjours ({{ profile().stays.length }})</span>
              </button>

              <button
                class="tab-button inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg font-title-md text-title-md transition-all cursor-pointer"
                [ngClass]="activeTab() === 'preferences' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container'"
                (click)="setTab('preferences')"
                data-tab="preferences"
                data-testid="tab-preferences"
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === 'preferences'"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">room_service</span>
                <span>Préférences &amp; Habitudes</span>
              </button>

              <button
                class="tab-button inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg font-title-md text-title-md transition-all cursor-pointer"
                [ngClass]="activeTab() === 'factures' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container'"
                (click)="setTab('factures')"
                data-tab="factures"
                data-testid="tab-factures"
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === 'factures'"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">receipt_long</span>
                <span>Factures &amp; Folios ({{ profile().folios.length }})</span>
              </button>

              <button
                class="tab-button inline-flex items-center gap-2 px-space-md py-2.5 rounded-lg font-title-md text-title-md transition-all cursor-pointer"
                [ngClass]="activeTab() === 'notes' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface hover:bg-surface-container'"
                (click)="setTab('notes')"
                data-tab="notes"
                data-testid="tab-notes"
                type="button"
                role="tab"
                [attr.aria-selected]="activeTab() === 'notes'"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">comment</span>
                <span>Notes &amp; Conciergerie ({{ profile().notes.length }})</span>
              </button>
            </div>

            <button
              class="hidden sm:flex items-center gap-1 px-3 py-1.5 text-on-surface-variant hover:text-primary font-label-md text-label-md cursor-pointer"
              type="button"
              data-testid="btn-print-profile"
              (click)="printProfile()"
            >
              <span class="material-symbols-outlined text-[16px]" aria-hidden="true">print</span>
              <span>Imprimer fiche</span>
            </button>
          </div>

          <!-- TAB CONTENT CONTAINER -->
          <div class="flex flex-col gap-space-lg" data-testid="tab-content">
            <!-- TAB 1 : HISTORIQUE DES SÉJOURS -->
            @if (activeTab() === 'historique') {
              <!-- Live Stay Highlight Banner (Present Stay) -->
              @if (currentStay(); as current) {
                <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm relative overflow-hidden" data-testid="live-stay-banner">
                  <div class="absolute left-0 top-0 bottom-0 w-2 bg-primary"></div>
                  <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                    <div class="flex items-start gap-space-md pl-space-xs">
                      <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <span class="material-symbols-outlined text-[28px]" aria-hidden="true">key</span>
                      </div>
                      <div class="flex flex-col">
                        <div class="flex items-center gap-space-sm flex-wrap">
                          <span class="font-headline-sm text-headline-sm text-on-surface">
                            Séjour en cours : {{ current.roomName }} (Ch. {{ current.roomNumber }})
                          </span>
                          <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-label-md text-label-md">
                            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true"></span>
                            En séjour
                          </span>
                        </div>
                        <p class="font-body-md text-body-md text-on-surface-variant mt-1">
                          {{ current.datesLabel }} • Départ prévu dans 2 jours (11:00) • {{ current.adults }} Adultes
                        </p>
                      </div>
                    </div>

                    <div class="flex flex-col md:items-end gap-1 pl-space-xs md:pl-0">
                      <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Solde restant à régler</span>
                      <span class="font-headline-md text-headline-md text-error font-bold">
                        {{ formatAmount(current.remainingFcfa) }} <span class="font-label-currency text-label-currency">FCFA</span>
                      </span>
                      <span class="font-body-sm text-body-sm text-outline">{{ current.paymentInfo }}</span>
                    </div>
                  </div>

                  <!-- Quick Micro Actions for current stay -->
                  <div class="flex flex-wrap items-center gap-space-sm mt-space-md pt-space-md bg-surface-container-low -mx-space-lg -mb-space-lg px-space-lg py-3">
                    <span class="font-label-md text-label-md text-on-surface-variant flex items-center gap-1">
                      <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">room_service</span>
                      Actions rapides chambre :
                    </span>
                    <button
                      class="px-3 py-1 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary font-body-sm text-body-sm shadow-xs transition-colors cursor-pointer"
                      type="button"
                      data-testid="btn-quick-resto-extra"
                      (click)="showToast('Ajout d\\'extra Restaurant La Teranga (TODO: Point de Vente)')"
                    >
                      + Ajouter un extra Resto
                    </button>
                    <button
                      class="px-3 py-1 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary font-body-sm text-body-sm shadow-xs transition-colors cursor-pointer"
                      type="button"
                      data-testid="btn-quick-view-folio"
                      (click)="setTab('factures')"
                    >
                      Consulter le folio actif (#RB-2024-0894)
                    </button>
                    <button
                      class="px-3 py-1 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary font-body-sm text-body-sm shadow-xs transition-colors cursor-pointer"
                      type="button"
                      data-testid="btn-quick-late-checkout"
                      (click)="showToast('Demande de départ tardif enregistrée pour la gouvernance')"
                    >
                      Programmer Late Check-out
                    </button>
                  </div>
                </div>
              }

              <!-- Vertical Timeline of Past & Current Stays -->
              <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col" data-testid="stays-timeline">
                <div class="flex items-center justify-between mb-space-lg">
                  <div class="flex items-center gap-space-sm">
                    <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">timeline</span>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">Historique complet des séjours</h3>
                  </div>
                  <span class="font-body-sm text-body-sm text-outline">{{ profile().stays.length }} réservations enregistrées</span>
                </div>

                <!-- Timeline Container -->
                <div class="relative pl-6 md:pl-8 flex flex-col gap-space-xl">
                  <!-- Timeline vertical connector bar -->
                  <div class="absolute left-2.5 md:left-3.5 top-3 bottom-6 w-0.5 bg-surface-variant" aria-hidden="true"></div>

                  @for (stay of profile().stays; track stay.id) {
                    <div class="relative flex flex-col gap-space-sm" [attr.data-testid]="'stay-item-' + stay.order">
                      <!-- Bullet icon -->
                      <div
                        class="absolute -left-6 md:-left-8 top-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ring-4 ring-surface-container-lowest"
                        [ngClass]="stay.isCurrent ? 'bg-primary text-on-primary' : 'bg-surface-dim text-on-surface-variant'"
                      >
                        <span class="material-symbols-outlined text-[14px]" aria-hidden="true">
                          {{ stay.isCurrent ? 'hotel' : 'check' }}
                        </span>
                      </div>

                      <!-- Stay Content Card -->
                      <div class="bg-surface-container-low rounded-xl p-space-md flex flex-col lg:flex-row lg:items-center justify-between gap-space-md hover:bg-surface-container transition-colors">
                        <div class="flex flex-col">
                          <div class="flex items-center gap-space-sm flex-wrap">
                            <span class="font-title-lg text-title-lg text-on-surface">{{ stay.periodTitle }}</span>
                            <span
                              class="px-2.5 py-0.5 rounded-full font-label-md text-label-md"
                              [ngClass]="stay.isCurrent ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-on-surface-variant'"
                            >
                              {{ stay.statusBadge }}
                            </span>
                            <span class="font-body-sm text-body-sm text-outline">Réf: {{ stay.reference }}</span>
                          </div>
                          <div class="flex items-center gap-space-sm text-body-md text-on-surface-variant mt-1 flex-wrap">
                            <span>{{ stay.datesLabel }}</span>
                            <span>•</span>
                            <span class="font-medium text-on-surface">{{ stay.roomName }}</span>
                            <span>•</span>
                            <span class="text-outline">{{ stay.extrasSummary }}</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-space-md justify-between lg:justify-end">
                          <div class="flex flex-col text-left lg:text-right">
                            <span class="font-label-currency text-label-currency text-on-surface font-bold">
                              {{ formatAmount(stay.totalFcfa) }} FCFA
                            </span>
                            @if (stay.remainingFcfa > 0) {
                              <span class="text-body-sm text-error">Reste {{ formatAmount(stay.remainingFcfa) }} FCFA</span>
                            } @else {
                              <span class="text-body-sm text-emerald-700 flex items-center gap-1 justify-end">
                                <span class="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
                                {{ stay.paymentInfo }}
                              </span>
                            }
                          </div>

                          <div class="flex items-center gap-1.5">
                            <button
                              class="p-2 rounded-lg bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-on-surface shadow-xs transition-colors cursor-pointer"
                              title="Voir folio PDF"
                              type="button"
                              (click)="showToast('Génération du folio PDF (' + stay.reference + ')') "
                            >
                              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
                                {{ stay.isCurrent ? 'receipt' : 'download' }}
                              </span>
                            </button>
                            <button
                              class="px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container text-on-surface text-body-sm font-semibold shadow-xs transition-colors cursor-pointer"
                              type="button"
                              (click)="showStayDetails(stay)"
                            >
                              Détails
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>

              <!-- Dual Bento Box: Preferences & Team Operational Log (identique à la maquette) -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-gutter">
                <!-- Box 1: Core Preferences Overview -->
                <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between mb-space-md">
                      <div class="flex items-center gap-space-sm">
                        <span class="material-symbols-outlined text-secondary text-[22px]" aria-hidden="true">favorite</span>
                        <h4 class="font-headline-sm text-headline-sm text-on-surface">Habitudes &amp; Préférences</h4>
                      </div>
                      <button
                        class="font-label-md text-label-md text-primary hover:underline cursor-pointer"
                        type="button"
                        (click)="setTab('preferences')"
                      >
                        Gérer
                      </button>
                    </div>

                    <div class="flex flex-col gap-space-sm">
                      @for (pref of profile().preferences; track pref.id) {
                        <div class="flex items-start gap-space-sm p-space-sm rounded-lg bg-surface-container-low">
                          <span class="material-symbols-outlined text-primary text-[18px] mt-0.5" aria-hidden="true">{{ pref.icon }}</span>
                          <div class="flex flex-col">
                            <span class="font-title-md text-title-md text-on-surface">{{ pref.title }}</span>
                            <span class="text-body-sm text-on-surface-variant">{{ pref.description }}</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>

                  <div class="mt-space-md pt-space-sm text-body-sm text-outline flex items-center justify-between border-t border-surface-variant/30">
                    <span>Régime alimentaire : {{ profile().dietaryPreferences.diet }}</span>
                    <span>Allergies : {{ profile().dietaryPreferences.allergies }}</span>
                  </div>
                </div>

                <!-- Box 2: Team Internal Notes & Observations -->
                <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col justify-between">
                  <div>
                    <div class="flex items-center justify-between mb-space-md">
                      <div class="flex items-center gap-space-sm">
                        <span class="material-symbols-outlined text-primary text-[22px]" aria-hidden="true">quick_reference_all</span>
                        <h4 class="font-headline-sm text-headline-sm text-on-surface">Notes de l'Équipe</h4>
                      </div>
                      <span class="px-2 py-0.5 rounded-full bg-surface-container text-outline text-label-md" data-testid="notes-count-badge">
                        {{ profile().notes.length }} notes
                      </span>
                    </div>

                    <!-- Note list -->
                    <div class="flex flex-col gap-space-sm">
                      @for (note of profile().notes.slice(0, 2); track note.id) {
                        <div class="p-space-sm rounded-lg bg-surface-container-low flex flex-col gap-1">
                          <div class="flex items-center justify-between text-body-sm">
                            <div class="flex items-center gap-1.5">
                              <span class="font-title-md text-on-surface">{{ note.authorName }}</span>
                              <span class="text-outline">• {{ note.department }}</span>
                            </div>
                            <span class="text-label-md text-outline">{{ note.timeAgo }}</span>
                          </div>
                          <p class="text-body-sm text-on-surface-variant italic">
                            « {{ note.content }} »
                          </p>
                        </div>
                      }
                    </div>
                  </div>

                  <!-- Add quick note action bar -->
                  <div class="mt-space-md pt-space-sm flex items-center gap-2 border-t border-surface-variant/30">
                    <input
                      class="flex-1 bg-surface-container-low text-body-sm text-on-surface px-3 py-2 rounded-lg outline-none focus:ring-1 focus:ring-primary border border-surface-variant/20"
                      placeholder="Ajouter une consigne pour l'équipe..."
                      type="text"
                      [(ngModel)]="newNoteContent"
                      (keydown.enter)="saveNewNote()"
                      data-testid="input-quick-note"
                    />
                    <button
                      class="px-3 py-2 rounded-lg bg-primary text-on-primary text-body-sm font-title-md hover:bg-primary-container transition-colors cursor-pointer"
                      type="button"
                      data-testid="btn-save-quick-note"
                      (click)="saveNewNote()"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              </div>
            }

            <!-- TAB 2 : PRÉFÉRENCES & HABITUDES -->
            @if (activeTab() === 'preferences') {
              <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg" data-testid="tab-preferences-content">
                <div class="flex items-center justify-between border-b border-surface-variant/40 pb-space-md">
                  <div>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">Préférences de Séjour &amp; Habitudes d'Accueil</h3>
                    <p class="text-body-sm text-on-surface-variant mt-0.5">
                      Personnalisation du service pour garantir l'excellence hôtelière de la Résidence Blue.
                    </p>
                  </div>
                  <span class="px-3 py-1 rounded-full bg-secondary-fixed/50 text-on-secondary-fixed font-label-md text-label-md">
                    Cardex Personnalisé
                  </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-space-md">
                  @for (pref of profile().preferences; track pref.id) {
                    <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col justify-between border border-surface-variant/30">
                      <div class="flex flex-col gap-2">
                        <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <span class="material-symbols-outlined text-[22px]" aria-hidden="true">{{ pref.icon }}</span>
                        </div>
                        <h4 class="font-title-lg text-title-lg text-on-surface">{{ pref.title }}</h4>
                        <p class="text-body-sm text-on-surface-variant">{{ pref.description }}</p>
                      </div>
                    </div>
                  }
                </div>

                <!-- Dietary requirements & Specific Care -->
                <div class="bg-surface-container-low rounded-xl p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md">
                  <div class="flex items-center gap-space-md">
                    <span class="material-symbols-outlined text-primary text-[28px]" aria-hidden="true">restaurant_menu</span>
                    <div class="flex flex-col">
                      <span class="font-title-md text-title-md text-on-surface">Exigences Culinaires &amp; Allergies</span>
                      <span class="text-body-sm text-on-surface-variant">
                        Régime : {{ profile().dietaryPreferences.diet }} • Allergies : {{ profile().dietaryPreferences.allergies }}
                      </span>
                    </div>
                  </div>
                  <button
                    class="px-4 py-2 rounded-xl bg-surface-container-lowest text-primary font-title-md text-title-md hover:bg-surface-container shadow-xs cursor-pointer border border-surface-variant/40"
                    type="button"
                    (click)="showToast('Modification des préférences alimentaires (TODO)')"
                  >
                    Modifier
                  </button>
                </div>
              </div>
            }

            <!-- TAB 3 : FACTURES & FOLIOS -->
            @if (activeTab() === 'factures') {
              <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-md" data-testid="tab-factures-content">
                <div class="flex items-center justify-between border-b border-surface-variant/40 pb-space-md">
                  <div>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">Factures &amp; Folios d'Exploitation</h3>
                    <p class="text-body-sm text-on-surface-variant mt-0.5">
                      Historique des règlements (Wave, Carte TPE, Virement, Espèces) et soldes en cours.
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-label-md text-label-md text-on-surface-variant">Cumul facturé :</span>
                    <span class="font-title-lg text-title-lg text-primary font-bold">
                      {{ formatAmount(profile().totalSpentFcfa) }} FCFA
                    </span>
                  </div>
                </div>

                <!-- Folios List -->
                <div class="flex flex-col gap-space-sm">
                  @for (folio of profile().folios; track folio.id) {
                    <div
                      class="p-space-md rounded-xl bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-space-md hover:bg-surface-container transition-colors border border-surface-variant/30"
                      [attr.data-testid]="'folio-card-' + folio.id"
                    >
                      <div class="flex items-start gap-space-md">
                        <div class="w-10 h-10 rounded-xl bg-surface-container-lowest text-primary flex items-center justify-center flex-shrink-0 shadow-xs">
                          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">receipt_long</span>
                        </div>
                        <div class="flex flex-col">
                          <div class="flex items-center gap-space-sm flex-wrap">
                            <span class="font-title-lg text-title-lg text-on-surface font-semibold">{{ folio.reference }}</span>
                            <span
                              class="px-2.5 py-0.5 rounded-full font-label-md text-label-md"
                              [ngClass]="folio.status === 'PAID' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'"
                            >
                              {{ folio.status === 'PAID' ? 'Soldé' : 'Solde partiel' }}
                            </span>
                            <span class="text-body-sm text-outline">{{ folio.stayDate }}</span>
                          </div>
                          <span class="text-body-sm text-on-surface-variant mt-0.5">
                            {{ folio.roomLabel }} • Règlement : {{ folio.paymentMethod }}
                          </span>
                        </div>
                      </div>

                      <div class="flex items-center gap-space-lg justify-between md:justify-end">
                        <div class="flex flex-col text-left md:text-right">
                          <span class="font-title-lg text-title-lg text-on-surface font-bold">
                            {{ formatAmount(folio.totalAmountFcfa) }} FCFA
                          </span>
                          @if (folio.balanceFcfa > 0) {
                            <span class="text-body-sm text-error font-medium">
                              Reste dû : {{ formatAmount(folio.balanceFcfa) }} FCFA
                            </span>
                          } @else {
                            <span class="text-body-sm text-emerald-700">Intégralement réglé</span>
                          }
                        </div>

                        <button
                          class="p-2.5 rounded-xl bg-surface-container-lowest text-on-surface hover:bg-primary hover:text-on-primary transition-colors shadow-xs cursor-pointer"
                          type="button"
                          (click)="showToast('Téléchargement du folio ' + folio.reference + ' (TODO PDF)')"
                          [title]="'Télécharger ' + folio.reference"
                        >
                          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- TAB 4 : NOTES & CONCIERGERIE -->
            @if (activeTab() === 'notes') {
              <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col gap-space-lg" data-testid="tab-notes-content">
                <div class="flex items-center justify-between border-b border-surface-variant/40 pb-space-md">
                  <div>
                    <h3 class="font-headline-sm text-headline-sm text-on-surface">Journal des Notes &amp; Consignes d'Équipe</h3>
                    <p class="text-body-sm text-on-surface-variant mt-0.5">
                      Transmissions internes entre la Réception, la Conciergerie, le Housekeeping et la Direction.
                    </p>
                  </div>
                  <span class="px-3 py-1 rounded-full bg-surface-container text-outline font-label-md text-label-md">
                    {{ profile().notes.length }} notes enregistrées
                  </span>
                </div>

                <!-- Note addition box -->
                <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-3 border border-surface-variant/40">
                  <span class="font-title-md text-title-md text-on-surface">Ajouter une nouvelle consigne</span>
                  <div class="flex flex-col sm:flex-row gap-2">
                    <input
                      class="flex-1 bg-surface-container-lowest text-body-sm text-on-surface px-4 py-2.5 rounded-xl outline-none focus:ring-2 focus:ring-primary/20 border border-surface-variant/40"
                      placeholder="Saisissez une observation, consigne chambre ou requête de conciergerie..."
                      type="text"
                      [(ngModel)]="newNoteContent"
                      (keydown.enter)="saveNewNote()"
                      data-testid="input-tab-note"
                    />
                    <button
                      class="px-5 py-2.5 rounded-xl bg-primary text-on-primary text-body-sm font-title-md hover:bg-primary-container transition-all cursor-pointer shadow-sm flex items-center justify-center gap-1.5"
                      type="button"
                      data-testid="btn-save-tab-note"
                      (click)="saveNewNote()"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">send</span>
                      <span>Enregistrer</span>
                    </button>
                  </div>
                </div>

                <!-- Complete Notes list -->
                <div class="flex flex-col gap-space-md">
                  @for (note of profile().notes; track note.id) {
                    <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2 border border-surface-variant/30" [attr.data-testid]="'note-item-' + note.id">
                      <div class="flex items-center justify-between text-body-sm">
                        <div class="flex items-center gap-2">
                          <div class="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                            {{ note.authorName.charAt(0) }}
                          </div>
                          <span class="font-title-md text-on-surface">{{ note.authorName }}</span>
                          <span class="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs">
                            {{ note.department }}
                          </span>
                        </div>
                        <span class="text-label-md text-outline">{{ note.timeAgo }}</span>
                      </div>
                      <p class="text-body-md text-on-surface-variant pl-9">
                        « {{ note.content }} »
                      </p>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class ClientProfilePageComponent implements OnInit {
  guestService: GuestProfileService;
  route: ActivatedRoute | null;
  reservationModalService: ReservationModalService;

  readonly profile: ReturnType<typeof signal<GuestProfile>>;
  readonly activeTab = signal<ActiveTab>('historique');
  readonly isPassportRevealed = signal<boolean>(false);
  readonly contactMenuOpen = signal<boolean>(false);
  readonly toastMessage = signal<string>('');

  newNoteContent = '';

  // Rôle de l'utilisateur connecté (par défaut Directrice dans le PMS démo)
  readonly currentUserRole = signal<string>('DIRECTRICE');

  constructor(
    guestService?: GuestProfileService,
    route?: ActivatedRoute,
    reservationModalService?: ReservationModalService
  ) {
    this.guestService = guestService ?? inject(GuestProfileService, { optional: true }) ?? new GuestProfileService();
    this.route = route ?? inject(ActivatedRoute, { optional: true });
    this.reservationModalService = reservationModalService ?? inject(ReservationModalService, { optional: true }) ?? new ReservationModalService();
    this.profile = signal<GuestProfile>(this.guestService['defaultProfile']);
  }

  // Euro conversion dynamique depuis les paramètres (1 EUR = 655.957 FCFA)
  readonly euroEquivalentFormatted = computed(() => {
    const euroVal = this.guestService.convertFcfaToEuro(this.profile().totalSpentFcfa, true);
    return new Intl.NumberFormat('fr-FR').format(euroVal);
  });

  // Séjour actif en cours
  readonly currentStay = computed<GuestStay | undefined>(() => {
    return this.profile().stays.find((s) => s.isCurrent || s.status === 'ACTIVE');
  });

  ngOnInit(): void {
    const id = this.route?.snapshot?.paramMap?.get('id') || 'c1';
    this.guestService.getGuestProfile(id).subscribe((prof) => {
      this.profile.set(prof);
    });
  }

  setTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  toggleContactMenu(): void {
    this.contactMenuOpen.update((v) => !v);
  }

  handleInactiveContact(channel: string): void {
    this.contactMenuOpen.set(false);
    this.showToast(`Bouton ${channel} inactif (TODO notifications, nécessitent internet)`);
  }

  /**
   * Bascule le masquage du numéro de passeport avec contrôle des droits (sécurité)
   */
  togglePassportVisibility(): void {
    if (!this.isPassportRevealed()) {
      const canReveal = this.guestService.canRevealPassport(this.currentUserRole());
      if (!canReveal) {
        this.showToast('Accès restreint aux rôles autorisés (Directrice, Réceptionniste)');
        return;
      }
      this.isPassportRevealed.set(true);
    } else {
      this.isPassportRevealed.set(false);
    }
  }

  /**
   * Retourne la version masquée du passeport (ex: SN••••••482 ou ••••••••••)
   */
  maskedPassport(): string {
    const num = this.profile().passportNumber;
    if (!num) return '••••••••••';
    if (num.length <= 4) return '••••';
    return `${num.slice(0, 2)}••••••${num.slice(-3)}`;
  }

  formatAmount(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0
    }).format(amount);
  }

  openNewReservationModal(): void {
    this.reservationModalService.open();
  }

  saveNewNote(): void {
    if (!this.newNoteContent || !this.newNoteContent.trim()) return;
    this.guestService.addNote(this.newNoteContent, 'Aïssatou Ba', 'Direction');
    this.newNoteContent = '';
    this.showToast('Consigne enregistrée dans le dossier voyageur');
    // Rafraîchir le profil
    this.guestService.getGuestProfile(this.profile().id).subscribe((p) => this.profile.set(p));
  }

  showStayDetails(stay: GuestStay): void {
    this.showToast(`Détails du séjour ${stay.reference} (${stay.roomName})`);
  }

  printProfile(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  copyToClipboard(text: string, message: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.showToast(message);
    }
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 4000);
  }
}
