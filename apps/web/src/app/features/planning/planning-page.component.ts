import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanningMockService } from '../../core/services/planning-mock.service';
import { ReservationModalService } from '../../core/services/reservation-modal.service';
import { PlanningDay, PlanningReservation, PlanningRoom, ReservationStatusType } from '../../core/models/planning.model';
import { formatFcfa } from '@residence-blue/shared';

@Component({
  selector: 'app-planning-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col w-full max-w-full overflow-x-hidden pb-16 text-on-surface" data-testid="planning-page">
      <!-- 1. EN-TÊTE : Titre et bouton principal Nouvelle réservation -->
      <header class="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 class="font-headline-md text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
            Planning
          </h1>
          <p class="font-body-sm text-xs sm:text-sm text-outline mt-0.5">
            Occupation des 12 chambres • Résidence Blue Thiès
          </p>
        </div>
        <button
          type="button"
          (click)="openNewReservation()"
          data-testid="header-new-reservation-btn"
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-on-primary font-title-sm text-sm font-semibold shadow-sm hover:bg-primary-container hover:text-on-primary-container transition-all cursor-pointer shrink-0"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          <span>+ Nouvelle réservation</span>
        </button>
      </header>

      <!-- 2. BANDE DE 3 CHIFFRES DU JOUR : Arrivées, Départs, Chambres libres (Rien d'autre) -->
      <section
        class="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6"
        aria-label="Chiffres clés du jour"
        data-testid="planning-daily-metrics"
      >
        <!-- Arrivées aujourd'hui -->
        <div class="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-label-md text-xs uppercase tracking-wider text-outline font-semibold">
              Arrivées aujourd'hui
            </span>
            <span class="font-headline-md text-2xl sm:text-3xl font-bold text-on-surface mt-1" data-testid="metric-arrivals">
              {{ planningService.dailyMetrics().arrivalsToday }}
            </span>
          </div>
          <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">login</span>
          </div>
        </div>

        <!-- Départs aujourd'hui -->
        <div class="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-label-md text-xs uppercase tracking-wider text-outline font-semibold">
              Départs aujourd'hui
            </span>
            <span class="font-headline-md text-2xl sm:text-3xl font-bold text-on-surface mt-1" data-testid="metric-departures">
              {{ planningService.dailyMetrics().departuresToday }}
            </span>
          </div>
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">logout</span>
          </div>
        </div>

        <!-- Chambres libres -->
        <div class="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/20 shadow-xs flex items-center justify-between">
          <div class="flex flex-col">
            <span class="font-label-md text-xs uppercase tracking-wider text-outline font-semibold">
              Chambres libres
            </span>
            <span class="font-headline-md text-2xl sm:text-3xl font-bold text-emerald-700 mt-1" data-testid="metric-free">
              {{ planningService.dailyMetrics().freeRoomsToday }}
            </span>
          </div>
          <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">hotel</span>
          </div>
        </div>
      </section>

      <!-- 3. BARRE D'OUTILS SUR UNE SEULE LIGNE : Navigation période, recherche, filtre unique -->
      <section
        class="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-3 shadow-xs mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full"
        data-testid="planning-toolbar"
      >
        <!-- Navigation de période : ◀ Aujourd'hui ▶ avec intitulé -->
        <div class="flex items-center gap-2 shrink-0">
          <div class="inline-flex items-center bg-surface-container-low rounded-lg p-0.5 border border-outline-variant/15">
            <button
              type="button"
              (click)="planningService.navigatePrevious()"
              title="Semaine précédente"
              aria-label="Semaine précédente"
              data-testid="btn-prev-week"
              class="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container hover:text-primary transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <button
              type="button"
              (click)="planningService.navigateToday()"
              data-testid="btn-today"
              class="px-2.5 h-8 rounded text-xs font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors cursor-pointer"
            >
              Aujourd'hui
            </button>
            <button
              type="button"
              (click)="planningService.navigateNext()"
              title="Semaine suivante"
              aria-label="Semaine suivante"
              data-testid="btn-next-week"
              class="w-8 h-8 rounded flex items-center justify-center text-on-surface hover:bg-surface-container hover:text-primary transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
          <span class="font-title-sm text-sm font-bold text-on-surface whitespace-nowrap ml-1" data-testid="planning-period-label">
            {{ planningService.periodLabel() }}
          </span>
        </div>

        <!-- Recherche par nom de client ou numéro de chambre -->
        <div class="relative flex-1 min-w-0 max-w-md">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px] pointer-events-none">
            search
          </span>
          <input
            type="search"
            placeholder="Rechercher par nom de client ou chambre..."
            [value]="planningService.searchQuery()"
            (input)="onSearchInput($event)"
            data-testid="planning-search-input"
            class="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-xs sm:text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <!-- Un seul filtre : Toutes / Libres / Occupées -->
        <div
          class="inline-flex p-0.5 rounded-lg bg-surface-container-low border border-outline-variant/15 text-xs font-semibold shrink-0"
          role="group"
          aria-label="Filtre d'occupation"
          data-testid="planning-filter-group"
        >
          <button
            type="button"
            (click)="planningService.setFilterMode('ALL')"
            data-testid="filter-all"
            [class]="planningService.filterMode() === 'ALL'
              ? 'px-3 py-1 rounded bg-surface-container-lowest text-primary shadow-xs'
              : 'px-3 py-1 rounded text-outline hover:text-on-surface'"
          >
            Toutes
          </button>
          <button
            type="button"
            (click)="planningService.setFilterMode('FREE')"
            data-testid="filter-free"
            [class]="planningService.filterMode() === 'FREE'
              ? 'px-3 py-1 rounded bg-surface-container-lowest text-primary shadow-xs'
              : 'px-3 py-1 rounded text-outline hover:text-on-surface'"
          >
            Libres
          </button>
          <button
            type="button"
            (click)="planningService.setFilterMode('OCCUPIED')"
            data-testid="filter-occupied"
            [class]="planningService.filterMode() === 'OCCUPIED'
              ? 'px-3 py-1 rounded bg-surface-container-lowest text-primary shadow-xs'
              : 'px-3 py-1 rounded text-outline hover:text-on-surface'"
          >
            Occupées
          </button>
        </div>
      </section>

      <!-- Feedback opérateur (Toast rapide) -->
      @if (planningService.feedbackMessage(); as feedback) {
        <div
          class="mb-4 p-3 rounded-xl bg-primary/10 text-primary border border-primary/20 text-xs sm:text-sm font-medium flex items-center justify-between shadow-xs"
          role="status"
          data-testid="planning-feedback-message"
        >
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[20px]">info</span>
            <span>{{ feedback }}</span>
          </div>
          <button
            type="button"
            (click)="planningService.feedbackMessage.set(null)"
            class="text-primary hover:opacity-75 cursor-pointer"
            aria-label="Fermer le message"
          >
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      }

      <!-- 4. GRILLE PRINCIPALE, VUE SEMAINE (7 JOURS) - Visible sur Desktop (>= 768px) -->
      <section
        class="hidden md:block w-full max-w-full bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden shadow-xs relative"
        aria-label="Grille hebdomadaire du planning"
        data-testid="planning-desktop-grid"
      >
        <!-- En-tête des jours collant (sticky) pour rester visible pendant le scroll vertical -->
        <div
          class="sticky top-0 z-20 bg-surface grid grid-cols-[8rem_repeat(7,minmax(0,1fr))] border-b border-outline-variant/20 shadow-xs"
          data-testid="grid-header"
        >
          <!-- 1ère colonne : Chambre -->
          <div class="h-12 px-3 flex items-center bg-surface-container-low border-r border-outline-variant/20 font-label-md text-xs uppercase tracking-wider text-outline font-bold truncate">
            Chambre
          </div>

          <!-- 7 colonnes de jours (se partagent 100% de la largeur disponible sans débordement) -->
          @for (day of planningService.currentDays(); track day.dateIso) {
            <div
              class="h-12 px-2 flex flex-col justify-center items-center text-center border-r border-outline-variant/15 min-w-0"
              [class.bg-primary-container]="day.isToday"
              [class.text-on-primary-container]="day.isToday"
              [class.bg-surface-container-low]="day.isWeekend && !day.isToday"
              [class.font-bold]="day.isToday"
              [attr.data-testid]="'day-header-' + day.dayIndex"
            >
              <span class="text-[11px] uppercase tracking-wider truncate w-full" [class.text-primary]="day.isToday">
                {{ day.name }}
              </span>
              <span class="text-xs sm:text-sm font-semibold truncate w-full" [class.text-primary]="day.isToday">
                {{ day.number }}
              </span>
            </div>
          }
        </div>

        <!-- Lignes = Chambres (12 clés de l'hôtel) -->
        <div class="flex flex-col divide-y divide-outline-variant/15" data-testid="grid-body">
          @for (room of planningService.filteredRooms(); track room.number) {
            <div
              class="grid grid-cols-[8rem_repeat(7,minmax(0,1fr))] relative h-14 items-stretch group hover:bg-surface-container-low/30 transition-colors"
              [attr.data-testid]="'room-row-' + room.number"
            >
              <!-- 1ère colonne = numéro + catégorie de la chambre -->
              <div
                class="col-start-1 col-end-2 h-full px-3 py-1.5 flex flex-col justify-center bg-surface-container-low/50 border-r border-outline-variant/20 min-w-0"
                style="grid-row: 1;"
              >
                <span class="font-title-sm text-xs sm:text-sm font-bold text-on-surface truncate">
                  Ch. {{ room.number }}
                </span>
                <span class="font-label-md text-[10px] text-outline uppercase tracking-wider truncate">
                  {{ room.category }}
                </span>
              </div>

              <!-- 7 cases de jours vides (clic sur une case vide : ouvre Nouvelle réservation) -->
              @for (day of planningService.currentDays(); track day.dateIso) {
                <div
                  [style.grid-column]="(day.dayIndex + 2) + ' / ' + (day.dayIndex + 3)"
                  style="grid-row: 1;"
                  class="h-full border-r border-outline-variant/10 cursor-pointer hover:bg-primary/5 transition-colors min-w-0"
                  [class.bg-primary-container]="day.isToday"
                  [class.bg-surface-container-low]="day.isWeekend && !day.isToday"
                  title="Cliquer pour réserver la chambre {{ room.number }} le {{ day.dateIso }}"
                  (click)="onEmptySlotClick(room.number, day.dateIso)"
                  [attr.data-testid]="'slot-' + room.number + '-' + day.dayIndex"
                ></div>
              }

              <!-- Barres de réservations (clic sur une barre : ouvre le panneau de détail) -->
              @for (res of room.reservations; track res.id) {
                <div
                  [style.grid-column]="(res.startDayIndex + 2) + ' / ' + (res.startDayIndex + res.durationDays + 2)"
                  style="grid-row: 1;"
                  class="z-10 self-center mx-1 h-9 rounded-lg px-2.5 flex items-center justify-between cursor-pointer shadow-xs transition-transform hover:scale-[1.01] min-w-0"
                  [ngClass]="getReservationColorClass(res.status)"
                  (click)="onReservationClick(res.id, $event)"
                  [title]="res.guestName + ' (' + res.status + ') - Cliquer pour ouvrir le détail'"
                  [attr.data-testid]="'res-bar-' + res.id"
                >
                  <span class="truncate text-xs font-semibold block w-full select-none" data-testid="res-guest-name">
                    {{ res.guestName }}
                  </span>
                </div>
              }
            </div>
          } @empty {
            <div class="p-8 text-center text-outline text-sm">
              Aucune chambre ne correspond aux critères de recherche.
            </div>
          }
        </div>
      </section>

      <!-- Légende sous la grille (3 couleurs seulement : confirmée, en séjour, départ aujourd'hui) -->
      <div
        class="hidden md:flex items-center gap-6 mt-3 px-2 text-xs text-outline font-medium"
        data-testid="planning-legend"
      >
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-blue-500 shrink-0"></span>
          <span>Confirmée</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-emerald-600 shrink-0"></span>
          <span>En séjour</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full bg-amber-500 shrink-0"></span>
          <span>Départ aujourd'hui</span>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- VERSION MOBILE (ÉCRAN < 768 px)                          -->
      <!-- La grille disparaît. Remplacée par liste verticale par   -->
      <!-- jour avec sélecteur 7 pastilles et 3 sections.           -->
      <!-- ======================================================== -->
      <section class="block md:hidden w-full max-w-full" data-testid="planning-mobile-view">
        <!-- Sélecteur de jour : 7 pastilles qui tiennent sur la largeur -->
        <div class="grid grid-cols-7 gap-1 mb-4" data-testid="mobile-day-selector">
          @for (day of planningService.currentDays(); track day.dateIso) {
            <button
              type="button"
              (click)="selectedMobileDayIndex.set(day.dayIndex)"
              [class]="selectedMobileDayIndex() === day.dayIndex
                ? 'bg-primary text-on-primary font-bold py-2 rounded-xl shadow-xs flex flex-col items-center'
                : 'bg-surface-container-low text-on-surface py-2 rounded-xl flex flex-col items-center hover:bg-surface-container'"
              [attr.data-testid]="'mobile-pill-' + day.dayIndex"
            >
              <span class="text-[10px] uppercase font-semibold">{{ day.name }}</span>
              <span class="text-xs font-bold">{{ day.number }}</span>
            </button>
          }
        </div>

        <!-- 3 sections pour le jour choisi : Arrivées, Départs, En séjour -->
        <div class="flex flex-col gap-4">
          <!-- Section 1 : Arrivées du jour -->
          <div class="p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
            <div class="flex items-center justify-between mb-2">
              <span class="font-title-sm text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">login</span>
                Arrivées ({{ mobileSectionReservations().arrivals.length }})
              </span>
            </div>
            <div class="flex flex-col gap-2">
              @for (res of mobileSectionReservations().arrivals; track res.id) {
                <div
                  (click)="planningService.openDetail(res.id)"
                  class="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 flex items-center justify-between cursor-pointer hover:bg-surface-container"
                  [attr.data-testid]="'mobile-card-' + res.id"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs text-on-surface truncate">{{ res.guestName }}</span>
                    <span class="text-[11px] text-outline">Chambre {{ res.roomNumber }}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-900 border border-blue-200">
                    Arrivée
                  </span>
                </div>
              } @empty {
                <span class="text-[11px] text-outline italic">Aucune arrivée prévue ce jour.</span>
              }
            </div>
          </div>

          <!-- Section 2 : Départs du jour -->
          <div class="p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
            <div class="flex items-center justify-between mb-2">
              <span class="font-title-sm text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">logout</span>
                Départs ({{ mobileSectionReservations().departures.length }})
              </span>
            </div>
            <div class="flex flex-col gap-2">
              @for (res of mobileSectionReservations().departures; track res.id) {
                <div
                  (click)="planningService.openDetail(res.id)"
                  class="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 flex items-center justify-between cursor-pointer hover:bg-surface-container"
                  [attr.data-testid]="'mobile-card-' + res.id"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs text-on-surface truncate">{{ res.guestName }}</span>
                    <span class="text-[11px] text-outline">Chambre {{ res.roomNumber }}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                    Départ
                  </span>
                </div>
              } @empty {
                <span class="text-[11px] text-outline italic">Aucun départ prévu ce jour.</span>
              }
            </div>
          </div>

          <!-- Section 3 : En séjour -->
          <div class="p-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl">
            <div class="flex items-center justify-between mb-2">
              <span class="font-title-sm text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">bed</span>
                En séjour ({{ mobileSectionReservations().staying.length }})
              </span>
            </div>
            <div class="flex flex-col gap-2">
              @for (res of mobileSectionReservations().staying; track res.id) {
                <div
                  (click)="planningService.openDetail(res.id)"
                  class="p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/15 flex items-center justify-between cursor-pointer hover:bg-surface-container"
                  [attr.data-testid]="'mobile-card-' + res.id"
                >
                  <div class="flex flex-col min-w-0">
                    <span class="font-bold text-xs text-on-surface truncate">{{ res.guestName }}</span>
                    <span class="text-[11px] text-outline">Chambre {{ res.roomNumber }}</span>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-900 border border-emerald-200">
                    En séjour
                  </span>
                </div>
              } @empty {
                <span class="text-[11px] text-outline italic">Aucun client en séjour ce jour.</span>
              }
            </div>
          </div>
        </div>

        <!-- Bouton « + Nouvelle réservation » fixé en bas sur mobile -->
        <div class="fixed bottom-4 right-4 z-40 md:hidden">
          <button
            type="button"
            (click)="openNewReservation()"
            data-testid="mobile-floating-new-btn"
            class="px-4 py-3 rounded-full bg-primary text-on-primary font-bold shadow-lg flex items-center gap-2 text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <span class="material-symbols-outlined text-[20px]">add</span>
            <span>+ Nouvelle réservation</span>
          </button>
        </div>
      </section>

      <!-- ======================================================== -->
      <!-- 5. PANNEAU DE DÉTAIL (TIROIR DESKTOP / FENÊTRE BAS MOBILE) -->
      <!-- Client, chambre, dates, nombre de nuits, total, reste à  -->
      <!-- payer, et 4 boutons : Modifier, Prolonger, Check-in/out, -->
      <!-- Annuler. Rien d'autre.                                   -->
      <!-- ======================================================== -->
      @if (planningService.selectedReservation(); as detail) {
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/40 z-40 backdrop-blur-xs transition-opacity"
          (click)="planningService.closeDetail()"
          data-testid="drawer-backdrop"
        ></div>

        <!-- Drawer -->
        <aside
          role="dialog"
          aria-modal="true"
          aria-labelledby="drawer-title"
          data-testid="planning-detail-drawer"
          class="fixed right-0 top-0 bottom-0 w-full sm:w-96 max-w-full bg-surface z-50 shadow-2xl flex flex-col justify-between border-l border-outline-variant/20 p-6 overflow-y-auto"
          [class.max-md:bottom-0]="true"
          [class.max-md:top-auto]="true"
          [class.max-md:max-h-[85vh]]="true"
          [class.max-md:rounded-t-2xl]="true"
          [class.max-md:border-t]="true"
        >
          <!-- En-tête du tiroir -->
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <span id="drawer-title" class="font-label-md text-xs uppercase tracking-wider text-outline font-semibold">
                Détail de la réservation
              </span>
              <button
                type="button"
                (click)="planningService.closeDetail()"
                data-testid="drawer-close-btn"
                class="w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center text-outline hover:text-on-surface cursor-pointer"
                aria-label="Fermer le panneau"
              >
                <span class="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <!-- Fiche d'information stricte (6 champs demandés) -->
            <div class="flex flex-col gap-3 py-2 border-y border-outline-variant/15 text-sm">
              <!-- 1. Client -->
              <div class="flex flex-col">
                <span class="text-xs text-outline font-medium">Client</span>
                <span class="font-bold text-base text-on-surface" data-testid="drawer-client-name">
                  {{ detail.guestName }}
                </span>
              </div>

              <!-- 2. Chambre -->
              <div class="flex flex-col">
                <span class="text-xs text-outline font-medium">Chambre</span>
                <span class="font-semibold text-on-surface" data-testid="drawer-room-number">
                  {{ detail.roomCategory }}
                </span>
              </div>

              <!-- 3. Dates -->
              <div class="flex flex-col">
                <span class="text-xs text-outline font-medium">Dates du séjour</span>
                <span class="font-semibold text-on-surface" data-testid="drawer-dates">
                  Du {{ detail.checkInDate }} au {{ detail.checkOutDate }}
                </span>
              </div>

              <!-- 4. Nombre de nuits -->
              <div class="flex flex-col">
                <span class="text-xs text-outline font-medium">Nombre de nuits</span>
                <span class="font-semibold text-on-surface" data-testid="drawer-nights">
                  {{ detail.nights }} nuit{{ detail.nights > 1 ? 's' : '' }}
                </span>
              </div>

              <!-- 5. Total -->
              <div class="flex items-center justify-between">
                <span class="text-xs text-outline font-medium">Total séjour</span>
                <span class="font-bold text-on-surface" data-testid="drawer-total">
                  {{ formatAmount(detail.folio.totalFcfa) }}
                </span>
              </div>

              <!-- 6. Reste à payer -->
              <div class="flex items-center justify-between">
                <span class="text-xs text-outline font-medium">Reste à payer</span>
                <span
                  class="font-bold"
                  [class.text-error]="detail.folio.remainingFcfa > 0"
                  [class.text-emerald-700]="detail.folio.remainingFcfa === 0"
                  data-testid="drawer-remaining"
                >
                  {{ formatAmount(detail.folio.remainingFcfa) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 4 BOUTONS STRICTS : Modifier, Prolonger, Check-in / Check-out, Annuler -->
          <div class="flex flex-col gap-2.5 pt-4 mt-auto" data-testid="drawer-actions">
            <!-- Bouton 1 : Modifier -->
            <button
              type="button"
              (click)="onModifier(detail.id)"
              data-testid="drawer-btn-modifier"
              class="w-full py-2.5 px-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-container font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">edit</span>
              <span>Modifier</span>
            </button>

            <!-- Bouton 2 : Prolonger -->
            <button
              type="button"
              (click)="onProlonger(detail.id)"
              data-testid="drawer-btn-prolonger"
              class="w-full py-2.5 px-4 rounded-xl border border-outline-variant/30 text-on-surface hover:bg-surface-container font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">more_time</span>
              <span>Prolonger (+1 nuit)</span>
            </button>

            <!-- Bouton 3 : Check-in ou Check-out selon l'état -->
            <button
              type="button"
              (click)="onToggleCheckInOut(detail.id)"
              data-testid="drawer-btn-checkin-checkout"
              [class]="detail.status === 'EN_SEJOUR'
                ? 'w-full py-2.5 px-4 rounded-xl bg-amber-600 text-white hover:bg-amber-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors'
                : 'w-full py-2.5 px-4 rounded-xl bg-emerald-700 text-white hover:bg-emerald-800 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors'"
            >
              <span class="material-symbols-outlined text-[18px]">
                {{ detail.status === 'EN_SEJOUR' ? 'logout' : 'login' }}
              </span>
              <span>{{ detail.status === 'EN_SEJOUR' ? 'Check-out' : 'Check-in' }}</span>
            </button>

            <!-- Bouton 4 : Annuler -->
            <button
              type="button"
              (click)="onAnnuler(detail.id)"
              data-testid="drawer-btn-annuler"
              class="w-full py-2.5 px-4 rounded-xl text-error hover:bg-error-container/20 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <span class="material-symbols-outlined text-[18px]">cancel</span>
              <span>Annuler la réservation</span>
            </button>
          </div>
        </aside>
      }
    </div>
  `
})
export class PlanningPageComponent {
  readonly planningService: PlanningMockService;
  readonly modalService: ReservationModalService;

  constructor(
    planningService?: PlanningMockService,
    modalService?: ReservationModalService
  ) {
    this.planningService = planningService ?? inject(PlanningMockService);
    this.modalService = modalService ?? inject(ReservationModalService);
  }

  /** Index du jour actif sur mobile (0 à 6) */
  readonly selectedMobileDayIndex = signal<number>(0);

  /** Calcul des sections pour le jour mobile actif */
  readonly mobileSectionReservations = computed(() => {
    const dayIndex = this.selectedMobileDayIndex();
    const days = this.planningService.currentDays();
    if (days.length === 0) {
      return { arrivals: [], departures: [], staying: [] };
    }

    const currentDayIso = days[dayIndex]?.dateIso || '2026-11-10';
    const all = this.planningService.allReservations();

    const arrivals = all.filter(r => r.checkInDate === currentDayIso);
    const departures = all.filter(r => r.checkOutDate === currentDayIso || (r.status === 'DEPART_AUJ' && dayIndex === 0));
    const staying = all.filter(r => {
      if (r.checkInDate === currentDayIso || r.checkOutDate === currentDayIso) return false;
      return r.checkInDate < currentDayIso && r.checkOutDate > currentDayIso;
    });

    return { arrivals, departures, staying };
  });

  /** Écoute de la touche Échap pour fermer le panneau de détail */
  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.planningService.selectedReservationId()) {
      this.planningService.closeDetail();
    }
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.planningService.setSearchQuery(input.value);
  }

  onEmptySlotClick(roomNumber: string, dateIso: string): void {
    const nextDay = new Date(dateIso);
    nextDay.setDate(nextDay.getDate() + 1);
    const checkOutIso = nextDay.toISOString().split('T')[0];

    const category = this.getCategoryForRoom(roomNumber);
    this.modalService.open({
      roomNumber,
      category,
      arrivalDate: dateIso,
      departureDate: checkOutIso
    });
  }

  openNewReservation(roomNumber?: string, dateIso?: string): void {
    const arrival = dateIso || '2026-11-10';
    const nextDay = new Date(arrival);
    nextDay.setDate(nextDay.getDate() + 1);
    const departure = nextDay.toISOString().split('T')[0];

    this.modalService.open({
      roomNumber: roomNumber || '101',
      category: roomNumber ? this.getCategoryForRoom(roomNumber) : 'Standard',
      arrivalDate: arrival,
      departureDate: departure
    });
  }

  onReservationClick(reservationId: string, event: Event): void {
    event.stopPropagation();
    this.planningService.openDetail(reservationId);
  }

  // --- 4 Actions du Tiroir ---

  onModifier(reservationId: string): void {
    const res = this.planningService.modifyReservation(reservationId);
    if (!res) return;

    this.planningService.closeDetail();
    this.modalService.open({
      roomNumber: res.roomNumber,
      category: this.getCategoryForRoom(res.roomNumber),
      arrivalDate: res.checkInDate,
      departureDate: res.checkOutDate
    });
  }

  onProlonger(reservationId: string): void {
    this.planningService.extendReservation(reservationId, 1);
  }

  onToggleCheckInOut(reservationId: string): void {
    this.planningService.toggleCheckInCheckOut(reservationId);
  }

  onAnnuler(reservationId: string): void {
    const confirmCancel =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm('Voulez-vous vraiment annuler cette réservation ?')
        : true;

    if (confirmCancel) {
      this.planningService.cancelReservation(reservationId);
    }
  }

  getReservationColorClass(status: ReservationStatusType): string {
    switch (status) {
      case 'EN_SEJOUR':
        return 'bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200';
      case 'DEPART_AUJ':
      case 'CHECKOUT':
        return 'bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-200';
      case 'CONFIRME':
      case 'ARRIVEE_AUJ':
      default:
        return 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/40 dark:text-blue-200';
    }
  }

  formatAmount(amount: number): string {
    return formatFcfa(amount);
  }

  private getCategoryForRoom(roomNumber: string): 'Standard' | 'Deluxe' | 'Suite' {
    const num = parseInt(roomNumber, 10);
    if (num >= 300) return 'Suite';
    if (num >= 200) return 'Deluxe';
    return 'Standard';
  }
}
