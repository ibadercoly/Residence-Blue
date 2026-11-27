import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomInterventionStatus, RoomStatus } from '@residence-blue/shared';
import { RoomsService, RoomUiItem } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import {
  INTERVENTION_PROBLEM_CHOICES,
  InterventionProblemChoice,
  ReportInterventionModalComponent,
} from '../../shared/components/report-intervention-modal/report-intervention-modal.component';

export type ProblemChoiceOption = InterventionProblemChoice;
export const MENAGE_PROBLEM_CHOICES: ProblemChoiceOption[] = INTERVENTION_PROBLEM_CHOICES;

@Component({
  selector: 'app-menage-chambres',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent, ReportInterventionModalComponent],
  host: { class: 'block w-full max-w-full overflow-x-hidden' },
  template: `
    <div
      class="menage-page flex flex-col gap-6 pb-16 w-full max-w-full overflow-x-hidden"
      data-testid="menage-chambres-page"
    >
      <!-- En-tête simple -->
      <header class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-4 sm:p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div class="min-w-0">
          <h1
            class="font-serif font-bold text-on-surface text-2xl sm:text-3xl tracking-tight break-words"
            data-testid="menage-page-title"
          >
            Chambres à nettoyer
          </h1>
          <p class="text-[20px] leading-snug text-on-surface-variant mt-1">
            {{ cleaningRooms().length }} à nettoyer maintenant · {{ occupiedRooms().length }} occupées · {{ freeRooms().length }} propres
          </p>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
          @if (outbox.pendingCount() > 0) {
            <button
              type="button"
              (click)="syncNow()"
              [disabled]="!network.isOnline() || outbox.isSyncing()"
              data-testid="menage-sync-pending-indicator"
              class="min-h-[48px] px-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-[20px] font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <span class="material-symbols-outlined text-[22px] animate-spin text-amber-700">sync</span>
              <span>En attente de synchronisation</span>
            </button>
          } @else if (!network.isOnline()) {
            <div
              class="min-h-[48px] px-4 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-[20px] font-semibold inline-flex items-center gap-2"
              data-testid="menage-offline-indicator"
            >
              <span class="material-symbols-outlined text-[22px] text-rose-700">cloud_off</span>
              <span>Hors ligne</span>
            </div>
          }
        </div>
      </header>

      <!-- Feedback succès / erreur -->
      @if (roomsService.errorMessage()) {
        <div
          class="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-[20px] font-semibold flex items-center justify-between gap-3"
          role="alert"
          data-testid="menage-alert-error"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="material-symbols-outlined text-[26px] text-rose-700 shrink-0">error</span>
            <span class="break-words">{{ roomsService.errorMessage() }}</span>
          </div>
          <button
            type="button"
            (click)="roomsService.errorMessage.set(null)"
            class="min-h-[44px] min-w-[44px] rounded-xl text-rose-800 hover:bg-rose-100 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Fermer l'alerte"
          >
            <span class="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
      }

      @if (roomsService.successMessage()) {
        <div
          class="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-[20px] font-semibold flex items-center justify-between gap-3"
          role="status"
          data-testid="menage-alert-success"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span class="material-symbols-outlined text-[26px] text-emerald-700 shrink-0">check_circle</span>
            <span class="break-words">{{ roomsService.successMessage() }}</span>
          </div>
          <button
            type="button"
            (click)="roomsService.successMessage.set(null)"
            class="min-h-[44px] min-w-[44px] rounded-xl text-emerald-900 hover:bg-emerald-100 flex items-center justify-center shrink-0 cursor-pointer"
            aria-label="Fermer la confirmation"
          >
            <span class="material-symbols-outlined text-[24px]">close</span>
          </button>
        </div>
      }

      <!-- 1) À NETTOYER MAINTENANT -->
      <section class="flex flex-col gap-4" data-testid="menage-group-cleaning">
        <h2 class="text-[22px] font-bold text-on-surface flex items-center gap-2.5">
          <span class="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true"></span>
          <span>À nettoyer maintenant</span>
          <span class="text-on-surface-variant font-semibold">({{ cleaningRooms().length }})</span>
        </h2>

        @if (cleaningRooms().length === 0) {
          <div
            class="p-6 sm:p-8 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-[22px] font-bold flex items-center gap-3"
            data-testid="menage-empty-cleaning"
          >
            <span class="material-symbols-outlined text-[32px] text-emerald-700 shrink-0">done_all</span>
            <span>Aucune chambre à nettoyer, merci !</span>
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            @for (room of cleaningRooms(); track room.id) {
              <article
                class="menage-cleaning-card p-5 sm:p-6 rounded-2xl bg-surface-container-lowest border-2 border-amber-300 shadow-sm flex flex-col gap-4 min-w-0"
                [attr.data-testid]="'menage-card-cleaning-' + room.number"
                [attr.data-room-number]="room.number"
              >
                <div class="flex items-start justify-between gap-3 flex-wrap">
                  <div class="min-w-0">
                    <div class="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight break-words">
                      Chambre {{ room.number }}
                    </div>
                    <div class="text-[20px] text-on-surface-variant font-medium mt-1">
                      Étage {{ room.floor }} · {{ room.category || room.type?.name || 'Standard' }}
                    </div>
                  </div>
                  <span class="px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-[20px] font-bold shrink-0">
                    À nettoyer
                  </span>
                </div>

                <div class="flex flex-col sm:flex-row gap-3 w-full">
                  <button
                    type="button"
                    (click)="markCleaned(room)"
                    [disabled]="isRoomBusy(room.id)"
                    [attr.data-testid]="'menage-btn-cleaned-' + room.number"
                    class="flex-1 min-h-[64px] px-5 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-[20px] font-bold inline-flex items-center justify-center gap-2.5 shadow-sm transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[26px]" aria-hidden="true">check_circle</span>
                    <span>J'ai nettoyé</span>
                  </button>

                  @if (hasPendingIntervention(room)) {
                    <button
                      type="button"
                      disabled
                      [attr.data-testid]="'menage-btn-pending-director-' + room.number"
                      class="min-h-[64px] px-5 py-3 rounded-2xl border-2 border-stone-300 bg-stone-200 text-stone-600 text-[18px] font-bold inline-flex items-center justify-center gap-2.5 cursor-not-allowed"
                    >
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">hourglass_top</span>
                      <span>En attente d'accord du Directeur</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="openProblemModal(room)"
                      [disabled]="isRoomBusy(room.id)"
                      [attr.data-testid]="'menage-btn-report-' + room.number"
                      class="min-h-[64px] px-5 py-3 rounded-2xl border-2 border-rose-300 bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-900 text-[20px] font-bold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[26px]" aria-hidden="true">report_problem</span>
                      <span>Signaler un problème</span>
                    </button>
                  }
                </div>
              </article>
            }
          </div>
        }
      </section>

      <!-- 2) CLIENT PRÉSENT -->
      <section class="flex flex-col gap-4" data-testid="menage-group-occupied">
        <h2 class="text-[22px] font-bold text-on-surface flex items-center gap-2.5">
          <span class="w-3.5 h-3.5 rounded-full bg-[#00666f] shrink-0" aria-hidden="true"></span>
          <span>Client présent</span>
          <span class="text-on-surface-variant font-semibold">({{ occupiedRooms().length }})</span>
        </h2>

        @if (occupiedRooms().length === 0) {
          <div class="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-on-surface-variant text-[20px]">
            Aucune chambre occupée pour le moment.
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (room of occupiedRooms(); track room.id) {
              <article
                class="menage-occupied-card p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 shadow-xs flex flex-col justify-between gap-4 min-w-0"
                [attr.data-testid]="'menage-card-occupied-' + room.number"
                [attr.data-room-number]="room.number"
              >
                <div class="flex items-start justify-between gap-2 flex-wrap">
                  <div class="min-w-0">
                    <div class="text-2xl font-bold text-on-surface break-words">
                      Chambre {{ room.number }}
                    </div>
                    <div class="text-[20px] text-on-surface-variant">
                      Étage {{ room.floor }}
                    </div>
                  </div>
                  <span class="px-3 py-1 rounded-full bg-[#e6f4f5] border border-[#99d5da] text-[#003b41] text-[20px] font-bold shrink-0">
                    Client présent
                  </span>
                </div>

                @if (hasPendingIntervention(room)) {
                  <button
                    type="button"
                    disabled
                    [attr.data-testid]="'menage-btn-pending-director-' + room.number"
                    class="w-full min-h-[64px] px-4 py-3 rounded-2xl border-2 border-stone-300 bg-stone-200 text-stone-600 text-[18px] font-bold inline-flex items-center justify-center gap-2.5 cursor-not-allowed"
                  >
                    <span class="material-symbols-outlined text-[24px]" aria-hidden="true">hourglass_top</span>
                    <span>En attente d'accord du Directeur</span>
                  </button>
                } @else {
                  <button
                    type="button"
                    (click)="openProblemModal(room)"
                    [disabled]="isRoomBusy(room.id)"
                    [attr.data-testid]="'menage-btn-report-' + room.number"
                    class="w-full min-h-[64px] px-4 py-3 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest hover:bg-rose-50 hover:border-rose-300 text-on-surface text-[20px] font-bold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[24px] text-rose-700" aria-hidden="true">report_problem</span>
                    <span>Signaler un problème</span>
                  </button>
                }
              </article>
            }
          </div>
        }
      </section>

      <!-- 3) PROPRES -->
      <section class="flex flex-col gap-4" data-testid="menage-group-free">
        <h2 class="text-[22px] font-bold text-on-surface flex items-center gap-2.5">
          <span class="w-3.5 h-3.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true"></span>
          <span>Propres</span>
          <span class="text-on-surface-variant font-semibold">({{ freeRooms().length }})</span>
        </h2>

        @if (freeRooms().length === 0) {
          <div class="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-on-surface-variant text-[20px]">
            Aucune chambre propre pour le moment.
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (room of freeRooms(); track room.id) {
              <article
                class="menage-free-card p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 shadow-xs flex flex-col justify-between gap-4 min-w-0"
                [attr.data-testid]="'menage-card-free-' + room.number"
                [attr.data-room-number]="room.number"
              >
                <div class="flex items-start justify-between gap-2 flex-wrap">
                  <div class="min-w-0">
                    <div class="text-2xl font-bold text-on-surface break-words">
                      Chambre {{ room.number }}
                    </div>
                    <div class="text-[20px] text-on-surface-variant">
                      Étage {{ room.floor }}
                    </div>
                  </div>
                  <span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-950 text-[20px] font-bold shrink-0">
                    Propre
                  </span>
                </div>

                <div class="flex flex-col gap-2.5 w-full">
                  <button
                    type="button"
                    (click)="markNeedsCleaning(room)"
                    [disabled]="isRoomBusy(room.id)"
                    [attr.data-testid]="'menage-btn-dirty-' + room.number"
                    class="w-full min-h-[64px] px-4 py-3 rounded-2xl border-2 border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-950 text-[20px] font-bold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[24px]" aria-hidden="true">cleaning_services</span>
                    <span>À nettoyer</span>
                  </button>

                  @if (hasPendingIntervention(room)) {
                    <button
                      type="button"
                      disabled
                      [attr.data-testid]="'menage-btn-pending-director-' + room.number"
                      class="w-full min-h-[64px] px-4 py-3 rounded-2xl border-2 border-stone-300 bg-stone-200 text-stone-600 text-[18px] font-bold inline-flex items-center justify-center gap-2.5 cursor-not-allowed"
                    >
                      <span class="material-symbols-outlined text-[24px]" aria-hidden="true">hourglass_top</span>
                      <span>En attente d'accord du Directeur</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="openProblemModal(room)"
                      [disabled]="isRoomBusy(room.id)"
                      [attr.data-testid]="'menage-btn-report-' + room.number"
                      class="w-full min-h-[64px] px-4 py-3 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest hover:bg-rose-50 hover:border-rose-300 text-on-surface text-[20px] font-bold inline-flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[24px] text-rose-700" aria-hidden="true">report_problem</span>
                      <span>Signaler un problème</span>
                    </button>
                  }
                </div>
              </article>
            }
          </div>
        }
      </section>

      <!-- Information en lecture seule des chambres déjà signalées en panne (sans bouton Remettre en service) -->
      @if (maintenanceRooms().length > 0) {
        <section class="flex flex-col gap-3" data-testid="menage-group-reported">
          <h2 class="text-[22px] font-bold text-on-surface-variant flex items-center gap-2.5">
            <span class="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0" aria-hidden="true"></span>
            <span>Problèmes déjà signalés ({{ maintenanceRooms().length }})</span>
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            @for (room of maintenanceRooms(); track room.id) {
              <div
                class="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 text-rose-950 text-[20px] flex flex-col gap-1 min-w-0"
                [attr.data-testid]="'menage-card-reported-' + room.number"
              >
                <span class="font-bold">Chambre {{ room.number }}</span>
                <span class="break-words [overflow-wrap:anywhere]">
                  Hors service : {{ room.maintenanceReason || 'Problème signalé' }}
                </span>
              </div>
            }
          </div>
        </section>
      }

      <!-- Modale « Signaler un problème » partagée entre Ménage et Assistant de Réception -->
      <app-report-intervention-modal
        [isOpen]="problemModalRoom() !== null"
        [room]="problemModalRoom()"
        [isSubmitting]="isSubmittingProblem()"
        testId="menage-problem-modal"
        (closed)="closeProblemModal()"
        (submitted)="submitProblemDescription($event)"
      ></app-report-intervention-modal>
    </div>
  `,
})
export class MenageChambresComponent {
  readonly roomsService: RoomsService;
  readonly network: NetworkService;
  readonly outbox: OutboxService;

  constructor(
    roomsService?: RoomsService,
    network?: NetworkService,
    outbox?: OutboxService,
  ) {
    this.roomsService = roomsService ?? inject(RoomsService);
    this.network = network ?? inject(NetworkService);
    this.outbox = outbox ?? inject(OutboxService);
  }

  readonly problemChoices = MENAGE_PROBLEM_CHOICES;
  readonly busyRoomIds = signal<Set<string>>(new Set());

  isRoomBusy(roomId: string): boolean {
    return this.busyRoomIds().has(roomId);
  }

  private setRoomBusy(roomId: string, busy: boolean): void {
    this.busyRoomIds.update((set) => {
      const next = new Set(set);
      if (busy) next.add(roomId);
      else next.delete(roomId);
      return next;
    });
  }
  readonly problemModalRoom = signal<RoomUiItem | null>(null);
  readonly selectedProblemChoice = signal<string | null>(null);
  readonly problemDetails = signal<string>('');
  readonly isSubmittingProblem = signal<boolean>(false);

  readonly cleaningRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.status === RoomStatus.CLEANING),
  );

  readonly occupiedRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.status === RoomStatus.OCCUPIED),
  );

  readonly freeRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.status === RoomStatus.FREE),
  );

  readonly maintenanceRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.status === RoomStatus.MAINTENANCE),
  );

  async syncNow(): Promise<void> {
    await this.roomsService.syncOutbox();
  }

  async markCleaned(room: RoomUiItem): Promise<void> {
    if (this.isRoomBusy(room.id)) return;
    this.setRoomBusy(room.id, true);
    try {
      await this.roomsService.changeRoomStatus(
        room.id,
        RoomStatus.FREE,
        'Chambre nettoyée et prête',
      );
    } finally {
      this.setRoomBusy(room.id, false);
    }
  }

  async markNeedsCleaning(room: RoomUiItem): Promise<void> {
    if (this.isRoomBusy(room.id)) return;
    this.setRoomBusy(room.id, true);
    try {
      await this.roomsService.changeRoomStatus(
        room.id,
        RoomStatus.CLEANING,
        'Chambre marquée à nettoyer',
      );
    } finally {
      this.setRoomBusy(room.id, false);
    }
  }

  openProblemModal(room: RoomUiItem): void {
    this.problemModalRoom.set(room);
    this.selectedProblemChoice.set("Fuite d'eau");
    this.problemDetails.set('');
  }

  closeProblemModal(): void {
    this.problemModalRoom.set(null);
    this.selectedProblemChoice.set(null);
    this.problemDetails.set('');
  }

  hasPendingIntervention(room: RoomUiItem): boolean {
    const onRoom = (room.activeInterventions || []).some(
      (i) => i.status === RoomInterventionStatus.PENDING_DIRECTOR,
    );
    if (onRoom) return true;
    const pendingList =
      typeof this.roomsService.pendingInterventions === 'function'
        ? this.roomsService.pendingInterventions()
        : [];
    return pendingList.some((i) => i.roomId === room.id);
  }

  async submitProblemDescription(description: string): Promise<void> {
    const room = this.problemModalRoom();
    const clean = (description || '').trim();
    if (!room || !clean || this.isSubmittingProblem()) return;

    this.isSubmittingProblem.set(true);
    try {
      const ok = await this.roomsService.requestIntervention(room.id, clean);
      if (ok) {
        this.closeProblemModal();
      }
    } finally {
      this.isSubmittingProblem.set(false);
    }
  }

  async submitProblem(): Promise<void> {
    const choice = this.selectedProblemChoice();
    if (!choice) return;
    const note = this.problemDetails().trim();
    const reason = note ? `${choice} — ${note}` : choice;
    await this.submitProblemDescription(reason);
  }
}
