import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomProblemType, RoomStatus } from '@residence-blue/shared';
import { RoomsService, RoomUiItem } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { ProblemReportModalComponent } from '../../shared/components/problem-report-modal/problem-report-modal.component';

export interface ProblemChoiceOption {
  id: string;
  label: string;
  icon: string;
  type: RoomProblemType;
}

export const MENAGE_PROBLEM_CHOICES: ProblemChoiceOption[] = [
  { id: 'climatisation', label: 'Climatisation', icon: 'ac_unit', type: 'CLIMATISATION' },
  { id: 'fuite', label: "Fuite d'eau", icon: 'water_drop', type: 'FUITE_EAU' },
  { id: 'electricite', label: 'Électricité', icon: 'bolt', type: 'ELECTRICITE' },
  { id: 'ampoule', label: 'Ampoule', icon: 'lightbulb', type: 'AMPOULE' },
  { id: 'autre', label: 'Autre', icon: 'build', type: 'AUTRE' },
];

@Component({
  selector: 'app-menage-chambres',
  standalone: true,
  imports: [CommonModule, FormsModule, ProblemReportModalComponent],
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
            {{ roomsToCleanNow().length }} à nettoyer maintenant · {{ otherRooms().length }} autres chambres
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

      <!-- 1) LISTE : À NETTOYER MAINTENANT (Chambres libres sales & chambres occupées sales) -->
      <section class="flex flex-col gap-4" data-testid="menage-group-cleaning">
        <h2 class="text-[22px] font-bold text-on-surface flex items-center gap-2.5">
          <span class="w-3.5 h-3.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true"></span>
          <span>À nettoyer maintenant</span>
          <span class="text-on-surface-variant font-semibold">({{ roomsToCleanNow().length }})</span>
        </h2>

        @if (roomsToCleanNow().length === 0) {
          <div
            class="p-6 sm:p-8 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-[22px] font-bold flex items-center gap-3"
            data-testid="menage-empty-cleaning"
          >
            <span class="material-symbols-outlined text-[32px] text-emerald-700 shrink-0">done_all</span>
            <span>Toutes les chambres prioritaires sont propres, merci !</span>
          </div>
        } @else {
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            @for (room of roomsToCleanNow(); track room.id) {
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

                  <div class="flex items-center gap-2 flex-wrap">
                    @if (isOccupied(room)) {
                      <span
                        class="px-3.5 py-1.5 rounded-full bg-[#e6f4f5] border border-[#99d5da] text-[#003b41] text-[20px] font-bold shrink-0"
                        data-testid="menage-badge-occupied"
                      >
                        Client présent
                      </span>
                    }
                    <span
                      class="px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-950 text-[20px] font-bold shrink-0"
                      data-testid="menage-badge-cleaning"
                    >
                      À nettoyer
                    </span>
                  </div>
                </div>

                @if (hasActiveProblem(room)) {
                  <div class="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-sm font-semibold flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px] text-rose-700 shrink-0">report_problem</span>
                    <span>Problème en cours : {{ getProblemSummary(room) }}</span>
                  </div>
                }

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
                </div>
              </article>
            }
          </div>
        }
      </section>

      <!-- 2) LISTE : AUTRES CHAMBRES (Chambres déjà propres) -->
      <section class="flex flex-col gap-4" data-testid="menage-group-other">
        <h2 class="text-[22px] font-bold text-on-surface flex items-center gap-2.5">
          <span class="w-3.5 h-3.5 rounded-full bg-emerald-600 shrink-0" aria-hidden="true"></span>
          <span>Autres chambres</span>
          <span class="text-on-surface-variant font-semibold">({{ otherRooms().length }})</span>
        </h2>

        @if (otherRooms().length === 0) {
          <div class="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/50 text-on-surface-variant text-[20px]">
            Aucune autre chambre propre pour le moment.
          </div>
        } @else {
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (room of otherRooms(); track room.id) {
              <article
                class="menage-other-card p-4 sm:p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 shadow-xs flex flex-col justify-between gap-4 min-w-0"
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

                  <div class="flex items-center gap-2 flex-wrap">
                    @if (isOccupied(room)) {
                      <span
                        class="px-3 py-1 rounded-full bg-[#e6f4f5] border border-[#99d5da] text-[#003b41] text-[20px] font-bold shrink-0"
                        data-testid="menage-badge-occupied"
                      >
                        Client présent
                      </span>
                    }
                    <span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-950 text-[20px] font-bold shrink-0">
                      Propre
                    </span>
                  </div>
                </div>

                @if (hasActiveProblem(room)) {
                  <div class="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs font-semibold flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-[18px] text-rose-700 shrink-0">report_problem</span>
                    <span>Problème : {{ getProblemSummary(room) }}</span>
                  </div>
                }

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
                </div>
              </article>
            }
          </div>
        }
      </section>

      <!-- Modale de signalement de problème partagée avec texte dynamique selon occupation -->
      <app-problem-report-modal
        [room]="problemModalRoom()"
        [isOpen]="problemModalRoom() !== null"
        (close)="closeProblemModal()"
        (problemReported)="onProblemReported()"
      ></app-problem-report-modal>
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

  /**
   * 1. « À nettoyer maintenant » : chambres sales (qu'elles soient libres ou occupées)
   */
  readonly roomsToCleanNow = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.isClean === false || r.status === RoomStatus.CLEANING),
  );

  /**
   * 2. « Autres chambres » : chambres déjà propres (libres ou occupées)
   */
  readonly otherRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.isClean !== false && r.status !== RoomStatus.CLEANING),
  );

  // Signaux rétrocompatibles pour tests existants
  readonly cleaningRooms = this.roomsToCleanNow;
  readonly freeRooms = this.otherRooms;
  readonly occupiedRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.status === RoomStatus.OCCUPIED),
  );
  readonly maintenanceRooms = computed(() =>
    this.roomsService.activeRooms().filter((r) => r.status === RoomStatus.MAINTENANCE),
  );

  isOccupied(room: RoomUiItem): boolean {
    return room.status === RoomStatus.OCCUPIED;
  }

  hasActiveProblem(room: RoomUiItem): boolean {
    return (room.activeProblems || []).some((p) => p.status === 'REPORTED' || p.status === 'IN_PROGRESS');
  }

  getProblemSummary(room: RoomUiItem): string {
    const active = (room.activeProblems || []).filter((p) => p.status === 'REPORTED' || p.status === 'IN_PROGRESS');
    if (active.length === 0) {
      return room.maintenanceReason || 'Signalé';
    }
    return active.map((p) => p.typeLabel || p.type).join(', ');
  }

  async syncNow(): Promise<void> {
    await this.roomsService.syncOutbox();
  }

  async markCleaned(room: RoomUiItem): Promise<void> {
    if (this.isRoomBusy(room.id)) return;
    this.setRoomBusy(room.id, true);
    try {
      await this.roomsService.updateCleanliness(room.id, true);
    } finally {
      this.setRoomBusy(room.id, false);
    }
  }

  async markNeedsCleaning(room: RoomUiItem): Promise<void> {
    if (this.isRoomBusy(room.id)) return;
    this.setRoomBusy(room.id, true);
    try {
      await this.roomsService.updateCleanliness(room.id, false);
    } finally {
      this.setRoomBusy(room.id, false);
    }
  }

  openProblemModal(room: RoomUiItem): void {
    this.problemModalRoom.set(room);
  }

  closeProblemModal(): void {
    this.problemModalRoom.set(null);
  }

  onProblemReported(): void {
    this.closeProblemModal();
  }

  async submitProblem(): Promise<void> {
    const room = this.problemModalRoom();
    if (!room || this.isSubmittingProblem()) return;

    this.isSubmittingProblem.set(true);
    try {
      await this.roomsService.reportProblem(room.id, {
        type: 'AUTRE',
        description: this.problemDetails().trim() || undefined,
      });
      this.closeProblemModal();
    } finally {
      this.isSubmittingProblem.set(false);
    }
  }
}
