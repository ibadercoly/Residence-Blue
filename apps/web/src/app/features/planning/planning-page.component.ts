import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlanningMockService } from '../../core/services/planning-mock.service';
import { PlanningRoom, PlanningReservation } from '../../core/models/planning.model';
import { formatFcfa } from '@residence-blue/shared';

@Component({
  selector: 'app-planning-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="flex flex-col w-full pb-margin" data-testid="planning-page">
      <!-- Toast Notification: Chambre déjà réservée / Alerte conflit -->
      @if (planningService.conflictBannerVisible()) {
        <div
          class="w-full mb-space-md bg-error-container text-on-error-container rounded-xl p-space-md shadow-md flex items-start justify-between gap-space-md transition-all duration-300"
          id="conflict-toast"
          role="alert"
          data-testid="conflict-toast"
        >
          <div class="flex items-start gap-space-md">
            <div class="w-10 h-10 rounded-lg bg-error text-on-error flex items-center justify-center shrink-0 shadow-sm">
              <span class="material-symbols-outlined text-[24px]" aria-hidden="true">warning</span>
            </div>
            <div class="flex flex-col">
              <div class="flex items-center gap-space-sm flex-wrap">
                <span class="font-title-md text-title-md text-error font-bold">Chambre déjà réservée sur cette période</span>
                <span class="px-2 py-0.5 rounded-full bg-error/15 text-error font-label-md text-label-md uppercase tracking-wider">
                  Conflit Tape Chart
                </span>
              </div>
              <p class="font-body-md text-body-md text-on-error-container mt-0.5" data-adapted-zone="conflict-text">
                Conflit d'attribution détecté sur <strong>Chambre 202 (Deluxe Balcon)</strong> pour la prolongation demandée (25 – 27 Mai 2024).
              </p>
              <div class="flex items-center gap-space-md mt-space-sm">
                <button
                  type="button"
                  (click)="onRelocateSuggested()"
                  class="inline-flex items-center gap-space-xs text-primary font-label-lg text-label-lg hover:underline transition-all cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>
                  <span>Voir options de relogement suggérées</span>
                </button>
                <span class="text-outline-variant">•</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant" data-adapted-zone="relocation-suggestion">
                  Chambre 203 (Deluxe Jardin) disponible en équivalence
                </span>
              </div>
            </div>
          </div>
          <button
            aria-label="Fermer le message"
            type="button"
            class="p-1 rounded-lg hover:bg-error/20 text-on-error-container transition-colors shrink-0 cursor-pointer"
            (click)="planningService.dismissConflictBanner()"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>
      }

      <!-- Feedback notification for Drag & Drop / Actions -->
      @if (planningService.lastDragEventMessage(); as dragMsg) {
        <div class="w-full mb-space-md bg-surface-container text-primary rounded-xl px-space-md py-2 text-body-sm flex items-center justify-between border border-primary/20 shadow-xs">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-[18px]">info</span>
            <span>{{ dragMsg }}</span>
          </div>
          <span class="font-label-md text-[11px] text-on-surface-variant">PMS Résidence Blue</span>
        </div>
      }

      <!-- Barre de commande & Filtres du Planning Gantt -->
      <section class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm mb-space-lg">
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
          <!-- Navigation temporelle -->
          <div class="flex flex-wrap items-center gap-space-md">
            <div class="flex items-center bg-surface-container-low rounded-xl p-1 shadow-inner">
              <button
                type="button"
                (click)="planningService.navigatePrevious()"
                class="flex items-center gap-1 px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container hover:text-primary transition-all font-label-md text-label-md cursor-pointer"
                title="Période précédente"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
                <span class="hidden sm:inline">Précédent</span>
              </button>
              <button
                type="button"
                (click)="planningService.navigateToday()"
                class="px-4 py-2 rounded-lg bg-primary text-on-primary font-label-lg text-label-lg shadow-sm hover:bg-primary-container transition-all mx-1 cursor-pointer"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                (click)="planningService.navigateNext()"
                class="flex items-center gap-1 px-3 py-2 rounded-lg text-on-surface hover:bg-surface-container hover:text-primary transition-all font-label-md text-label-md cursor-pointer"
                title="Période suivante"
              >
                <span class="hidden sm:inline">Suivant</span>
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
              </button>
            </div>

            <div class="flex items-center gap-space-sm px-space-md py-space-sm bg-surface-container-low rounded-xl">
              <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">calendar_today</span>
              <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight">{{ planningService.periodLabel() }}</span>
              <span class="font-label-md text-label-md text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">{{ planningService.weeksLabel() }}</span>
            </div>

            <!-- Sélecteur d'horizon temporel -->
            <div class="inline-flex p-1 bg-surface-container-high rounded-xl">
              <button
                type="button"
                (click)="setHorizon('14d')"
                [class]="planningService.activeHorizon() === '14d'
                  ? 'px-3 py-1.5 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-primary shadow-sm font-semibold cursor-pointer'
                  : 'px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer'"
              >
                14 Jours
              </button>
              <button
                type="button"
                (click)="setHorizon('week')"
                [class]="planningService.activeHorizon() === 'week'
                  ? 'px-3 py-1.5 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-primary shadow-sm font-semibold cursor-pointer'
                  : 'px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer'"
              >
                Semaine
              </button>
              <button
                type="button"
                (click)="setHorizon('month')"
                [class]="planningService.activeHorizon() === 'month'
                  ? 'px-3 py-1.5 rounded-lg bg-surface-container-lowest font-label-md text-label-md text-primary shadow-sm font-semibold cursor-pointer'
                  : 'px-3 py-1.5 rounded-lg text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors cursor-pointer'"
              >
                Mois
              </button>
            </div>
          </div>

          <!-- Filtres et actions rapides -->
          <div class="flex flex-wrap items-center gap-space-md">
            <!-- Filtre Catégorie -->
            <div class="relative min-w-[190px]">
              <select
                aria-label="Filtrer par catégorie de chambres"
                (change)="onCategoryChange($event)"
                class="w-full h-11 pl-3 pr-8 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none cursor-pointer focus:bg-surface-container transition-all appearance-none shadow-sm"
              >
                <option value="ALL">Toutes les clés (12 chambres)</option>
                <option value="STANDARD">Standard (101 à 106)</option>
                <option value="DELUXE">Deluxe (201 à 204)</option>
                <option value="SUITE">Suites (301 &amp; 302)</option>
              </select>
              <span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[18px]" aria-hidden="true">expand_more</span>
            </div>

            <!-- Filtre Statut -->
            <div class="relative min-w-[160px]">
              <select
                aria-label="Filtrer par statut de réservation"
                (change)="onStatusChange($event)"
                class="w-full h-11 pl-3 pr-8 rounded-xl bg-surface-container-low text-on-surface font-body-sm text-body-sm outline-none cursor-pointer focus:bg-surface-container transition-all appearance-none shadow-sm"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="OCCUPIED">Présents (En séjour)</option>
                <option value="CONFIRMED">Arrivées à venir</option>
                <option value="CONFLICT">En conflit / Option</option>
              </select>
              <span class="material-symbols-outlined absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-[18px]" aria-hidden="true">tune</span>
            </div>

            <!-- Légende opérationnelle -->
            <div class="flex items-center gap-space-md py-1 px-space-md bg-surface-container-low rounded-xl">
              <div class="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                <span class="w-3 h-3 rounded-full bg-primary-container shadow-xs"></span>
                <span>En séjour</span>
              </div>
              <div class="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                <span class="w-3 h-3 rounded-full bg-secondary-container shadow-xs"></span>
                <span>Confirmé</span>
              </div>
              <div class="flex items-center gap-1.5 font-label-md text-label-md text-on-surface">
                <span class="w-3 h-3 rounded-full bg-surface-variant"></span>
                <span>Disponible</span>
              </div>
              <div class="flex items-center gap-1.5 font-label-md text-label-md text-error">
                <span class="w-3 h-3 rounded-full bg-error"></span>
                <span>Alerte</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Zone Principale : Split Gantt Chart (Gauche/Centre) + Volet Réservation Active (Droite) -->
      <div class="grid grid-cols-1 2xl:grid-cols-12 gap-space-lg items-start">
        <!-- COLONNE GANTT (9 colonnes sur 12 en large écran) -->
        <div class="2xl:col-span-8 3xl:col-span-9 bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden flex flex-col" data-testid="tape-chart-grid">
          <!-- Sous-entête de statut global du parc -->
          <div class="px-space-lg py-space-md bg-surface-container-low flex flex-wrap items-center justify-between gap-space-md">
            <div class="flex items-center gap-space-lg">
              <div class="flex items-center gap-space-xs text-on-surface">
                <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">hotel</span>
                <span class="font-title-md text-title-md">Taux d'occupation :</span>
                <span class="font-title-lg text-title-lg text-primary">83,3%</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">(10 / 12 chambres louées)</span>
              </div>
              <div class="hidden sm:flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
                <span class="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">luggage</span>
                <span>Arrivées du jour : <strong class="text-on-surface">3</strong></span>
                <span class="text-outline-variant">•</span>
                <span>Départs du jour : <strong class="text-on-surface">2</strong></span>
              </div>
            </div>
            <div class="flex items-center gap-space-sm font-label-md text-label-md text-on-surface-variant">
              <span class="inline-flex w-2 h-2 rounded-full bg-primary animate-ping"></span>
              <span>Données en temps réel PMS Thiès</span>
            </div>
          </div>

          <!-- Conteneur Gantt à défilement horizontal fluide -->
          <div class="overflow-x-auto w-full select-none">
            <div class="min-w-[1100px] w-full flex flex-col">
              <!-- LIGNE D'ENTÊTE : CHAMBRE + 14 JOURS -->
              <div class="grid grid-cols-[210px_repeat(14,1fr)] bg-surface-container text-on-surface sticky top-0 z-20 shadow-xs">
                <div class="p-space-md flex flex-col justify-center bg-surface-container font-label-lg text-label-lg text-on-surface">
                  <span class="uppercase tracking-wider text-outline text-[11px] font-bold">Clés Résidence</span>
                  <span class="font-title-md text-title-md">Chambre / Type</span>
                </div>

                <!-- Colonnes Jours 20 Mai -> 2 Juin -->
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Lun</span>
                  <span class="font-title-md text-title-md">20</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Mar</span>
                  <span class="font-title-md text-title-md">21</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Mer</span>
                  <span class="font-title-md text-title-md">22</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Jeu</span>
                  <span class="font-title-md text-title-md">23</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center bg-primary text-on-primary rounded-t-lg shadow-sm">
                  <span class="font-label-md text-label-md uppercase tracking-wider text-primary-fixed text-[10px] font-bold">Aujourd'hui</span>
                  <span class="font-headline-sm text-headline-sm leading-none font-bold">24</span>
                  <span class="font-label-md text-label-md text-surface-bright">Ven</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-secondary font-semibold">Sam</span>
                  <span class="font-title-md text-title-md text-secondary font-bold">25</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-secondary font-semibold">Dim</span>
                  <span class="font-title-md text-title-md text-secondary font-bold">26</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Lun</span>
                  <span class="font-title-md text-title-md">27</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Mar</span>
                  <span class="font-title-md text-title-md">28</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Mer</span>
                  <span class="font-title-md text-title-md">29</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Jeu</span>
                  <span class="font-title-md text-title-md">30</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-on-surface-variant">Ven</span>
                  <span class="font-title-md text-title-md">31</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-secondary font-semibold">Sam</span>
                  <span class="font-title-md text-title-md text-secondary font-bold">01</span>
                </div>
                <div class="p-2 flex flex-col items-center justify-center text-center">
                  <span class="font-label-md text-label-md text-secondary font-semibold">Dim</span>
                  <span class="font-title-md text-title-md text-secondary font-bold">02</span>
                </div>
              </div>

              <!-- LIGNES DES 12 CHAMBRES (Fidélité 1:1 avec code.html) -->
              <div class="divide-y-0 flex flex-col">
                <!-- CHAMBRE 101 - STANDARD JARDIN -->
                @if (isRoomVisible('101')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        101
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Standard</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">RDC Jardin</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '101')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'M. Diallo', 'res-101-diallo')"
                        (click)="selectByName('M. Diallo')"
                        class="absolute top-2 bottom-2 left-[1%] w-[20%] bg-surface-variant text-on-surface rounded-xl p-2 shadow-xs flex items-center justify-between z-10 opacity-75 cursor-pointer"
                      >
                        <span class="font-label-md text-label-md font-semibold truncate">M. Diallo (Check-out)</span>
                        <span class="material-symbols-outlined text-[16px] text-outline" aria-hidden="true">done_all</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 102 - STANDARD JARDIN -->
                @if (isRoomVisible('102')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        102
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Standard</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">RDC Jardin</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '102')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'Karin Lindström', 'res-102-lindstrom')"
                        (click)="selectByName('Karin Lindström')"
                        class="absolute top-2 bottom-2 left-[50.5%] w-[28%] bg-secondary-container text-on-secondary-container rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">schedule</span>
                          <span class="font-label-md text-label-md font-bold truncate">Karin Lindström</span>
                        </div>
                        <span class="font-label-md text-label-md bg-on-secondary-container/10 px-1.5 py-0.5 rounded text-[11px] shrink-0">4n</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 103 - STANDARD PATIO -->
                @if (isRoomVisible('103')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        103
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Standard</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">RDC Patio</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '103')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'Dr. Faye', 'res-103-faye')"
                        (click)="selectByName('Dr. Faye')"
                        class="absolute top-2 bottom-2 left-[14.5%] w-[28%] bg-primary text-on-primary rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="w-2 h-2 rounded-full bg-surface-bright shrink-0"></span>
                          <span class="font-label-md text-label-md font-bold truncate">Dr. Faye</span>
                        </div>
                        <span class="font-label-md text-label-md bg-surface-bright/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">En séjour</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 104 - STANDARD PATIO -->
                @if (isRoomVisible('104')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        104
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Standard</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">RDC Patio</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '104')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'M. Sow', 'res-104-sow')"
                        (click)="selectByName('M. Sow')"
                        class="absolute top-2 bottom-2 left-[57.5%] w-[35%] bg-secondary-container text-on-secondary-container rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">flight_land</span>
                          <span class="font-label-md text-label-md font-bold truncate">M. Sow</span>
                        </div>
                        <span class="font-label-md text-label-md bg-on-secondary-container/10 px-1.5 py-0.5 rounded text-[11px] shrink-0">5n</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 105 - STANDARD VUE PISCINE -->
                @if (isRoomVisible('105')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        105
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Standard</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">Vue Piscine</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '105')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'Sophie Martin', 'res-105-martin')"
                        (click)="selectByName('Sophie Martin')"
                        class="absolute top-2 bottom-2 left-[28.5%] w-[28.5%] bg-primary text-on-primary rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="material-symbols-outlined text-[16px] text-primary-fixed" aria-hidden="true">key</span>
                          <span class="font-label-md text-label-md font-bold truncate">Sophie Martin</span>
                        </div>
                        <span class="font-label-md text-label-md bg-surface-bright/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">Arrivée auj.</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 106 - STANDARD VUE PISCINE -->
                @if (isRoomVisible('106')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        106
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Standard</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">Vue Piscine</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div class="absolute inset-y-2 left-[29%] right-[10%] rounded-xl flex items-center justify-center text-outline-variant hover:bg-surface-variant/30 hover:text-primary transition-all cursor-pointer">
                        <span class="font-label-md text-label-md flex items-center gap-1 opacity-60 hover:opacity-100">
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">add_circle</span> Libre à l'attribution
                        </span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 201 - DELUXE BALCON MER -->
                @if (isRoomVisible('201')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-primary-container text-on-primary flex flex-col items-center justify-center font-label-lg text-label-lg font-bold">
                        201
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate text-primary" data-adapted-zone="ch201-title">Deluxe Balcon</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">Étage Balcon</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '201')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'Famille Moreau', 'res-201-moreau')"
                        (click)="selectByName('Famille Moreau')"
                        class="absolute top-2 bottom-2 left-[7.2%] w-[28.5%] bg-primary text-on-primary rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="w-2 h-2 rounded-full bg-surface-bright shrink-0"></span>
                          <span class="font-label-md text-label-md font-bold truncate">Famille Moreau</span>
                        </div>
                        <span class="font-label-md text-label-md bg-surface-bright/20 px-1.5 py-0.5 rounded text-[11px] shrink-0">Départ Demain</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 202 - DELUXE BALCON MER (ZONE DE CONFLIT) -->
                @if (isRoomVisible('202')) {
                  <div
                    [class]="hasConflict202()
                      ? 'grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-error-container/20 hover:bg-error-container/30 transition-colors relative group'
                      : 'grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative group'"
                  >
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div
                        [class]="hasConflict202()
                          ? 'w-10 h-10 rounded-xl bg-error text-on-error flex flex-col items-center justify-center font-label-lg text-label-lg font-bold shadow-xs'
                          : 'w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface'"
                      >
                        202
                      </div>
                      <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-1">
                          <span
                            [class]="hasConflict202() ? 'font-title-md text-title-md leading-tight truncate text-error font-bold' : 'font-title-md text-title-md leading-tight truncate text-primary'"
                            data-adapted-zone="ch202-title"
                          >
                            Deluxe Balcon
                          </span>
                          @if (hasConflict202()) {
                            <span class="material-symbols-outlined text-[16px] text-error" aria-hidden="true">error</span>
                          }
                        </div>
                        <span
                          [class]="hasConflict202() ? 'font-label-md text-label-md text-error truncate' : 'font-label-md text-label-md text-on-surface-variant truncate'"
                          data-adapted-zone="ch202-desc"
                        >
                          {{ hasConflict202() ? 'Conflit détecté' : 'Étage Balcon' }}
                        </span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '202')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'Mme Claire Lefèvre', 'res-202-lefevre')"
                        (click)="selectByName('Mme Claire Lefèvre')"
                        class="absolute top-2 bottom-2 left-[43%] w-[28.5%] bg-secondary-container text-on-secondary-container rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer"
                      >
                        <span class="font-label-md text-label-md font-bold truncate">Mme Claire Lefèvre</span>
                        <span class="font-label-md text-label-md bg-on-secondary-container/10 px-1.5 py-0.5 rounded text-[11px] shrink-0">Arrivée 26</span>
                      </div>
                      @if (hasConflict202()) {
                        <div class="absolute top-1 bottom-1 left-[35.5%] w-[15%] bg-error/15 text-error rounded-xl flex items-center justify-center font-label-md text-label-md font-bold z-20 shadow-md">
                          <span class="material-symbols-outlined text-[16px] mr-1" aria-hidden="true">warning</span>
                          <span>Chevauchement</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- CHAMBRE 203 - DELUXE BUNGALOW ALIZÉ -->
                @if (isRoomVisible('203')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        203
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Bungalow</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate" data-adapted-zone="ch203-desc">Deluxe Jardin • Rez-de-jardin</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '203')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      @if (!isRelocated()) {
                        <div class="absolute top-2 bottom-2 left-[30%] w-[35%] bg-surface-container-low rounded-xl px-3 py-1.5 flex items-center justify-between z-10 shadow-xs">
                          <span class="font-label-md text-label-md text-primary font-semibold flex items-center gap-1" data-adapted-zone="ch203-reloctext">
                            <span class="material-symbols-outlined text-[16px]" aria-hidden="true">check_circle</span> Disponible relogement Ch. 202
                          </span>
                          <button
                            type="button"
                            (click)="onRelocate()"
                            class="bg-primary text-on-primary font-label-md text-label-md px-2 py-0.5 rounded-lg shadow-xs hover:bg-primary-container cursor-pointer"
                          >
                            Reloger ici
                          </button>
                        </div>
                      } @else {
                        <div
                          class="absolute top-2 bottom-2 left-[30%] w-[35%] bg-secondary-container text-on-secondary-container rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer"
                        >
                          <span class="font-label-md text-label-md font-bold truncate">Mme Lefèvre (Relogée)</span>
                          <span class="font-label-md text-label-md bg-on-secondary-container/10 px-1.5 py-0.5 rounded text-[11px] shrink-0">Relogé Ch. 203</span>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- CHAMBRE 204 - DELUXE BUNGALOW BAOBAB -->
                @if (isRoomVisible('204')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-low/40 hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        204
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Bungalow</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate" data-adapted-zone="ch204-desc">Deluxe Jardin • Terrasse</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '204')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'Babacar Sylla', 'res-204-sylla')"
                        (click)="selectByName('Babacar Sylla')"
                        class="absolute top-2 bottom-2 left-[36%] w-[28.5%] bg-secondary-container text-on-secondary-container rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">calendar_today</span>
                          <span class="font-label-md text-label-md font-bold truncate">Babacar Sylla</span>
                        </div>
                        <span class="font-label-md text-label-md bg-on-secondary-container/10 px-1.5 py-0.5 rounded text-[11px] shrink-0">4 nuits</span>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 301 - SUITE OCÉAN PANORAMIQUE (RÉSERVATION ACTIVE SÉLECTIONNÉE) -->
                @if (isRoomVisible('301')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-primary/10 hover:bg-primary/15 transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-primary-container text-on-primary z-10 shadow-md">
                      <div class="w-10 h-10 rounded-xl bg-surface-bright text-primary flex flex-col items-center justify-center font-label-lg text-label-lg font-bold shadow-xs">
                        301
                      </div>
                      <div class="flex flex-col min-w-0">
                        <div class="flex items-center gap-1">
                          <span class="font-title-md text-title-md leading-tight truncate font-bold text-on-primary" data-adapted-zone="ch301-title">Suite Panoramique</span>
                          <span class="material-symbols-outlined text-[16px] text-secondary-fixed" aria-hidden="true">star</span>
                        </div>
                        <span class="font-label-md text-label-md text-primary-fixed truncate">Panoramique VIP</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '301')">
                      <div class="col-start-5 col-span-1 bg-primary/10 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'M. Mamadou Diop', 'RB-2024-0894')"
                        (click)="selectByName('M. Mamadou Diop')"
                        class="absolute top-1 bottom-1 left-[21.5%] w-[28.5%] bg-primary text-on-primary rounded-xl px-3 py-1 shadow-lg flex items-center justify-between z-30 cursor-pointer scale-[1.02] ring-2 ring-secondary transition-all"
                      >
                        <div class="flex items-center gap-2 truncate">
                          <span class="material-symbols-outlined text-secondary-fixed text-[18px]" aria-hidden="true">verified</span>
                          <div class="flex flex-col truncate">
                            <span class="font-label-lg text-label-lg font-bold leading-tight truncate">M. Mamadou Diop</span>
                            <span class="text-[11px] font-label-md text-primary-fixed truncate">VIP Gold • 4 nuits (23 – 27 Mai)</span>
                          </div>
                        </div>
                        <div class="flex items-center gap-1.5 shrink-0">
                          <span class="px-2 py-0.5 rounded-full bg-surface-bright/20 text-on-primary font-label-md text-[11px]">En séjour</span>
                          <span class="px-2 py-0.5 rounded-full bg-secondary text-on-secondary font-label-md text-[11px] font-bold">Sélectionné</span>
                        </div>
                      </div>
                    </div>
                  </div>
                }

                <!-- CHAMBRE 302 - SUITE FILAOS PRESTIGE -->
                @if (isRoomVisible('302')) {
                  <div class="grid grid-cols-[210px_repeat(14,1fr)] h-16 bg-surface-container-lowest hover:bg-surface-container-low transition-colors relative group">
                    <div class="px-space-md py-2 flex items-center gap-space-md bg-surface-container-lowest group-hover:bg-surface-container-low transition-colors z-10 shadow-xs">
                      <div class="w-10 h-10 rounded-xl bg-surface-container-high flex flex-col items-center justify-center font-label-lg text-label-lg font-bold text-on-surface">
                        302
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="font-title-md text-title-md leading-tight truncate">Suite Filaos</span>
                        <span class="font-label-md text-label-md text-on-surface-variant truncate">Prestige Rooftop</span>
                      </div>
                    </div>
                    <div class="col-span-14 grid grid-cols-14 relative h-full" (dragover)="onDragOver($event)" (drop)="onDrop($event, '302')">
                      <div class="col-start-5 col-span-1 bg-primary/5 h-full pointer-events-none"></div>
                      <div
                        draggable="true"
                        (dragstart)="onDragStartByName($event, 'M. Ibrahima Diallo', 'res-302-diallo')"
                        (click)="selectByName('M. Ibrahima Diallo')"
                        class="absolute top-2 bottom-2 left-[36%] w-[50%] bg-secondary-container text-on-secondary-container rounded-xl px-3 py-1.5 shadow-sm flex items-center justify-between z-10 cursor-pointer hover:shadow-md transition-all"
                      >
                        <div class="flex items-center gap-1.5 truncate">
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">stars</span>
                          <span class="font-label-md text-label-md font-bold truncate">M. Ibrahima Diallo</span>
                        </div>
                        <span class="font-label-md text-label-md bg-on-secondary-container/10 px-2 py-0.5 rounded text-[11px] shrink-0 font-semibold">7 nuits (Semaine Prestige)</span>
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Pied du tableau Gantt : Légende & indicateur de navigation -->
          <div class="p-space-md bg-surface-container-low flex flex-wrap items-center justify-between gap-space-md text-on-surface-variant font-body-sm text-body-sm">
            <div class="flex items-center gap-space-md">
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">drag_indicator</span>
                <span>Glissez-déposez une réservation pour changer de chambre ou prolonger.</span>
              </span>
            </div>
            <div class="flex items-center gap-space-sm">
              <button
                type="button"
                (click)="onExportTapeChart()"
                class="hover:text-primary transition-colors flex items-center gap-1 font-label-md text-label-md cursor-pointer"
              >
                <span class="material-symbols-outlined text-[16px]" aria-hidden="true">file_download</span> Exporter le Tape Chart (PDF/Excel)
              </button>
            </div>
          </div>
        </div>

        <!-- VOLET DROIT : FICHE COMPLÈTE DE LA RÉSERVATION SÉLECTIONNÉE (4 colonnes sur 12) -->
        <div class="2xl:col-span-4 3xl:col-span-3 flex flex-col gap-space-lg" data-testid="reservation-detail-panel">
          <div class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-md flex flex-col relative overflow-hidden">
            <!-- Ruban supérieur décoratif Thiès Hospitality -->
            <div class="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary-fixed-dim to-secondary"></div>

            <!-- En-tête Fiche Guest -->
            <div class="flex items-start justify-between gap-space-md pt-space-xs">
              <div class="flex flex-col">
                <div class="flex items-center gap-space-xs">
                  @if (planningService.selectedDetail().vipBadge; as vip) {
                    <span class="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-md text-label-md font-bold uppercase tracking-wider flex items-center gap-1">
                      <span class="material-symbols-outlined text-[14px]" aria-hidden="true">star</span> {{ vip }}
                    </span>
                  }
                  <span class="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-label-md text-label-md font-bold">
                    {{ planningService.selectedDetail().statusBadge }}
                  </span>
                </div>
                <h2 class="font-headline-md text-headline-md text-on-surface mt-space-xs">{{ planningService.selectedDetail().guestName }}</h2>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Dossier de réservation #{{ planningService.selectedDetail().id }}</span>
              </div>
              <div class="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary shrink-0 shadow-inner">
                <span class="material-symbols-outlined text-[28px]" aria-hidden="true">bed</span>
              </div>
            </div>

            <!-- Bloc Chambre & Dates -->
            <div class="mt-space-md p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-sm">
              <div class="flex items-center justify-between">
                <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Hébergement attribué</span>
                <span class="font-label-lg text-label-lg font-bold text-primary">{{ planningService.selectedDetail().roomCategory }}</span>
              </div>
              <div class="font-title-md text-title-md text-on-surface font-semibold" data-adapted-zone="suite-title">
                {{ planningService.selectedDetail().roomDescription }}
              </div>
              <div class="h-px bg-surface-variant/60 my-1"></div>
              <div class="grid grid-cols-2 gap-space-sm pt-1">
                <div class="flex flex-col">
                  <span class="font-label-md text-label-md text-on-surface-variant">Arrivée (Check-in)</span>
                  <span class="font-title-md text-title-md text-on-surface font-bold">{{ planningService.selectedDetail().checkInDate }}</span>
                  <span class="font-body-sm text-body-sm text-outline">{{ planningService.selectedDetail().checkInDetails }}</span>
                </div>
                <div class="flex flex-col text-right">
                  <span class="font-label-md text-label-md text-on-surface-variant">Départ (Check-out)</span>
                  <span class="font-title-md text-title-md text-on-surface font-bold">{{ planningService.selectedDetail().checkOutDate }}</span>
                  <span class="font-body-sm text-body-sm text-outline">{{ planningService.selectedDetail().checkOutDetails }}</span>
                </div>
              </div>
            </div>

            <!-- Détails Séjour & Prestations -->
            <div class="mt-space-md flex flex-col gap-space-sm">
              <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Composition &amp; Formule</span>
              <div class="grid grid-cols-2 gap-space-sm">
                <div class="px-3 py-2 rounded-lg bg-surface-container-low flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">group</span>
                  <span class="font-body-sm text-body-sm text-on-surface font-semibold">{{ planningService.selectedDetail().adultsCount }} Adultes</span>
                </div>
                <div class="px-3 py-2 rounded-lg bg-surface-container-low flex items-center gap-2">
                  <span class="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">restaurant</span>
                  <span class="font-body-sm text-body-sm text-on-surface font-semibold">{{ planningService.selectedDetail().breakfastLabel }}</span>
                </div>
              </div>
              <div class="px-3 py-2 rounded-lg bg-surface-container-low flex items-center gap-2 text-on-surface font-body-sm text-body-sm">
                <span class="material-symbols-outlined text-primary text-[18px]" aria-hidden="true">directions_car</span>
                <span>{{ planningService.selectedDetail().shuttleLabel }}</span>
              </div>
            </div>

            <!-- Situation Financière / Folio -->
            <div class="mt-space-md p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs">
              <div class="flex items-center justify-between">
                <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Compte Folio &amp; Facturation</span>
                <span class="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-label-md text-label-md font-bold">
                  {{ planningService.selectedDetail().folio.depositBadge }}
                </span>
              </div>
              <div class="flex items-baseline justify-between mt-1">
                <span class="font-body-md text-body-md text-on-surface">Total séjour :</span>
                <span class="font-label-currency text-label-currency text-on-surface">
                  {{ formatAmount(planningService.selectedDetail().folio.totalFcfa) }}
                </span>
              </div>
              <div class="flex items-baseline justify-between">
                <span class="font-body-md text-body-md text-primary">Déjà réglé :</span>
                <span class="font-title-md text-title-md text-primary font-bold">
                  {{ formatAmount(planningService.selectedDetail().folio.paidFcfa) }}
                </span>
              </div>
              <div class="h-px bg-surface-variant/60 my-1"></div>
              <div class="flex items-baseline justify-between">
                <span class="font-title-md text-title-md text-error font-bold">Reste à régler :</span>
                <span class="font-headline-sm text-headline-sm text-error font-bold">
                  {{ formatAmount(planningService.selectedDetail().folio.remainingFcfa) }}
                </span>
              </div>
              <span class="font-body-sm text-body-sm text-outline mt-0.5">
                {{ planningService.selectedDetail().folio.preferredPayment }}
              </span>
            </div>

            <!-- Coordonnées Guest -->
            <div class="mt-space-md flex flex-col gap-space-xs">
              <span class="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Contact direct</span>
              <div class="flex items-center gap-space-sm text-on-surface font-body-sm text-body-sm">
                <span class="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">call</span>
                <a
                  class="hover:text-primary transition-colors font-semibold"
                  [href]="'tel:' + planningService.selectedDetail().contact.phone"
                >
                  {{ planningService.selectedDetail().contact.phone }}
                </a>
              </div>
              <div class="flex items-center gap-space-sm text-on-surface font-body-sm text-body-sm">
                <span class="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">mail</span>
                <a
                  class="hover:text-primary transition-colors truncate"
                  [href]="'mailto:' + planningService.selectedDetail().contact.email"
                >
                  {{ planningService.selectedDetail().contact.email }}
                </a>
              </div>
            </div>

            <!-- Note Conciergerie -->
            <div class="mt-space-md p-space-sm px-space-md rounded-xl bg-secondary-fixed/30 text-on-secondary-fixed-variant flex items-start gap-2">
              <span class="material-symbols-outlined text-[20px] text-secondary mt-0.5 shrink-0" aria-hidden="true">hotel_class</span>
              <div class="flex flex-col">
                <span class="font-label-md text-label-md font-bold">Consigne Conciergerie :</span>
                <span class="font-body-sm text-body-sm italic" data-adapted-zone="concierge-note">
                  {{ planningService.selectedDetail().conciergeNote }}
                </span>
              </div>
            </div>

            <!-- Boutons d'Action Principaux -->
            <div class="mt-space-lg flex flex-col gap-space-sm">
              <div class="grid grid-cols-2 gap-space-sm">
                <!-- Bouton Modifier -->
                <button
                  type="button"
                  (click)="onAction('Modifier la réservation')"
                  class="h-11 px-space-md rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface font-label-lg text-label-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
                  <span>Modifier</span>
                </button>
                <!-- Bouton Prolonger -->
                <button
                  type="button"
                  (click)="onAction('Prolonger le séjour')"
                  class="h-11 px-space-md rounded-xl bg-primary hover:bg-primary-container text-on-primary font-label-lg text-label-lg flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">date_range</span>
                  <span>Prolonger</span>
                </button>
              </div>
              <!-- Bouton Annuler / Déloger -->
              <button
                type="button"
                (click)="onAction('Annuler ou clôturer')"
                class="h-10 px-space-md rounded-xl text-error hover:bg-error-container/30 font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">cancel</span>
                <span>Annuler ou clôturer la réservation</span>
              </button>
            </div>

            <!-- Raccourcis complémentaires Réception -->
            <div class="mt-space-md pt-space-md border-t border-surface-variant/40 flex items-center justify-around text-on-surface-variant">
              <button
                type="button"
                (click)="onAction('Export Folio PDF')"
                class="flex flex-col items-center gap-1 hover:text-primary transition-colors text-center group cursor-pointer"
              >
                <div class="w-9 h-9 rounded-full bg-surface-container-low group-hover:bg-primary/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">receipt_long</span>
                </div>
                <span class="font-label-md text-label-md">Folio PDF</span>
              </button>
              <button
                type="button"
                (click)="onAction('Envoi WhatsApp')"
                class="flex flex-col items-center gap-1 hover:text-primary transition-colors text-center group cursor-pointer"
              >
                <div class="w-9 h-9 rounded-full bg-surface-container-low group-hover:bg-primary/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">chat</span>
                </div>
                <span class="font-label-md text-label-md">WhatsApp</span>
              </button>
              <button
                type="button"
                (click)="onAction('Ajout Extras')"
                class="flex flex-col items-center gap-1 hover:text-primary transition-colors text-center group cursor-pointer"
              >
                <div class="w-9 h-9 rounded-full bg-surface-container-low group-hover:bg-primary/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">room_service</span>
                </div>
                <span class="font-label-md text-label-md">Extras</span>
              </button>
              <button
                type="button"
                (click)="onAction('Programmation Badge Clé')"
                class="flex flex-col items-center gap-1 hover:text-primary transition-colors text-center group cursor-pointer"
              >
                <div class="w-9 h-9 rounded-full bg-surface-container-low group-hover:bg-primary/10 flex items-center justify-center">
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true">key</span>
                </div>
                <span class="font-label-md text-label-md">Badge Clé</span>
              </button>
            </div>
          </div>

          <!-- Carte d'Aperçu Rapide : Housekeeping & Chambres d'Honneur -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-md shadow-sm flex items-center justify-between" data-testid="housekeeping-card">
            <div class="flex items-center gap-space-md">
              <div class="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[22px]" aria-hidden="true">cleaning_services</span>
              </div>
              <div class="flex flex-col">
                <span class="font-title-md text-title-md text-on-surface font-semibold">Gouvernante Générale</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">11 chambres prêtes • 1 en recouche</span>
              </div>
            </div>
            <a routerLink="/housekeeping" class="text-primary hover:text-primary-container p-1 rounded-lg">
              <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">chevron_right</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  `
})
export class PlanningPageComponent {
  readonly planningService: PlanningMockService;

  constructor(planningService?: PlanningMockService) {
    this.planningService = planningService ?? inject(PlanningMockService);
  }

  formatAmount(amount: number): string {
    return formatFcfa(amount);
  }

  getRoomRowClasses(room: PlanningRoom): string {
    if (room.isHighlighted || room.isSelected) return 'bg-primary/10';
    if (room.isConflict) return 'bg-error-container/20';
    return '';
  }

  getRoomBadgeClasses(room: PlanningRoom): string {
    if (room.isHighlighted || room.isSelected) return 'bg-surface-bright text-primary';
    if (room.isConflict) return 'bg-error text-on-error';
    return 'bg-surface-container-high text-on-surface';
  }

  onSelectReservation(res: PlanningReservation): void {
    this.planningService.selectReservation(res);
  }

  hasConflict202(): boolean {
    const r202 = this.planningService.roomsState().find((r) => r.number === '202');
    return r202?.isConflict ?? false;
  }

  isRelocated(): boolean {
    const r203 = this.planningService.roomsState().find((r) => r.number === '203');
    return !r203?.isRelocationTarget;
  }

  isRoomVisible(roomNumber: string): boolean {
    return this.planningService.filteredRooms().some((r) => r.number === roomNumber);
  }

  onCategoryChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.planningService.setCategoryFilter(val);
  }

  onStatusChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.planningService.setStatusFilter(val);
  }

  setHorizon(horizon: string): void {
    this.planningService.setHorizon(horizon);
  }

  onRelocateSuggested(): void {
    this.planningService.lastDragEventMessage.set(
      'Option de relogement suggérée : Chambre 203 (Bungalow Deluxe Jardin) libre sans surcoût.'
    );
  }

  onRelocate(): void {
    this.planningService.reallocateConflict();
  }

  onExportTapeChart(): void {
    this.planningService.lastDragEventMessage.set(
      'Export du Tape Chart (PDF/Excel) généré pour la période 20 Mai – 2 Juin 2024.'
    );
  }

  onAction(actionName: string): void {
    this.planningService.lastDragEventMessage.set(`Action demandée : ${actionName} (Dossier PMS)`);
  }

  selectByName(guestName: string): void {
    const allReservations = this.planningService
      .roomsState()
      .flatMap((r) => r.reservations);
    const res = allReservations.find((r) => r.guestName.includes(guestName));
    if (res) {
      this.planningService.selectReservation(res);
    }
  }

  // --- Événements Glisser-Déposer (Draggable mais inactif / prévisualisation) ---
  onDragStart(event: DragEvent, res: PlanningReservation): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', JSON.stringify(res));
      event.dataTransfer.effectAllowed = 'move';
    }
    this.planningService.handleDragStart(res);
  }

  onDragStartByName(event: DragEvent, guestName: string, id: string): void {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', id);
      event.dataTransfer.effectAllowed = 'move';
    }
    const fakeRes: PlanningReservation = {
      id,
      guestName,
      roomNumber: '',
      startDayIndex: 0,
      durationDays: 1,
      leftPercent: 0,
      widthPercent: 0,
      status: 'CONFIRME',
      statusLabel: '',
      nights: 1
    };
    this.planningService.handleDragStart(fakeRes);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  onDrop(event: DragEvent, room: PlanningRoom | string): void {
    event.preventDefault();
    const roomNumber = typeof room === 'string' ? room : room.number;
    const rawData = event.dataTransfer?.getData('text/plain') || 'réservation';
    try {
      const parsed = JSON.parse(rawData);
      this.planningService.handleDrop(roomNumber, parsed.guestName || parsed.id || rawData);
    } catch {
      this.planningService.handleDrop(roomNumber, rawData);
    }
  }
}
