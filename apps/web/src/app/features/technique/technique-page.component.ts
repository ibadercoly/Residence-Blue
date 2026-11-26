import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoomProblemDto, ROOM_PROBLEM_TYPE_META } from '@residence-blue/shared';
import { TechniqueService } from '../../core/services/technique.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';

@Component({
  selector: 'app-technique-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="technique-page flex flex-col gap-6 pb-16 w-full max-w-full overflow-x-hidden text-on-surface"
      data-testid="technique-page"
    >
      <!-- 1. En-tête -->
      <header
        class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-4 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4"
        data-testid="technique-header"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-700 flex items-center justify-center shrink-0"
          >
            <span class="material-symbols-outlined text-[28px]" aria-hidden="true">build</span>
          </div>
          <div>
            <h1 class="font-headline-md text-2xl sm:text-3xl font-bold tracking-tight text-on-surface">
              Technique & Pannes
            </h1>
            <p class="font-body-sm text-xs sm:text-sm text-outline mt-0.5">
              Maintenance des chambres • Résidence Blue Thiès
            </p>
          </div>
        </div>

        <!-- Commandes d'en-tête (Temps réel, Interrupteur Son, Actualiser) -->
        <div class="flex items-center flex-wrap gap-2.5">
          <!-- Indicateur SSE -->
          <div
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
            [class]="
              technique.sseConnected()
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                : 'bg-stone-100 text-stone-600 border border-stone-300'
            "
            data-testid="technique-sse-status"
          >
            <span
              class="w-2 h-2 rounded-full"
              [class]="technique.sseConnected() ? 'bg-emerald-600 animate-pulse' : 'bg-stone-400'"
              aria-hidden="true"
            ></span>
            <span>{{ technique.sseConnected() ? 'Temps réel actif' : 'Hors ligne' }}</span>
          </div>

          <!-- Interrupteur Son -->
          <button
            type="button"
            (click)="technique.toggleSound()"
            [attr.data-testid]="'technique-sound-toggle'"
            [attr.aria-pressed]="technique.soundEnabled()"
            class="h-10 px-3.5 rounded-xl border flex items-center gap-2 text-xs font-semibold cursor-pointer transition-colors"
            [class]="
              technique.soundEnabled()
                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                : 'bg-surface-container-high border-outline-variant/60 text-outline hover:bg-surface-variant'
            "
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">
              {{ technique.soundEnabled() ? 'volume_up' : 'volume_off' }}
            </span>
            <span>{{ technique.soundEnabled() ? 'Son activé' : 'Son muet' }}</span>
          </button>

          <!-- Bouton Actualiser -->
          <button
            type="button"
            (click)="refresh()"
            [disabled]="technique.isLoading()"
            data-testid="btn-refresh-technique"
            class="h-10 px-3.5 rounded-xl border border-outline-variant/60 bg-surface-container-high hover:bg-surface-variant text-on-surface text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <span
              class="material-symbols-outlined text-[18px]"
              [class.animate-spin]="technique.isLoading()"
              aria-hidden="true"
            >
              refresh
            </span>
            <span>Actualiser</span>
          </button>
        </div>
      </header>

      <!-- 2. Alerte en direct (bannière nouvelle panne) -->
      @if (technique.newProblemAlert(); as alert) {
        <div
          class="p-4 rounded-xl bg-amber-500 text-amber-950 font-bold text-sm sm:text-base flex items-center justify-between gap-3 shadow-md animate-bounce"
          role="alert"
          data-testid="technique-new-alert"
        >
          <div class="flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[24px]" aria-hidden="true">warning</span>
            <span>{{ alert }}</span>
          </div>
          <button
            type="button"
            (click)="technique.newProblemAlert.set(null)"
            class="px-3 py-1 rounded-lg bg-amber-950/20 hover:bg-amber-950/30 text-amber-950 text-xs font-bold"
          >
            Compris
          </button>
        </div>
      }

      <!-- Message succès ou erreur -->
      @if (technique.successMessage(); as msg) {
        <div
          class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm font-medium flex items-center gap-2.5"
          role="status"
          data-testid="technique-success-msg"
        >
          <span class="material-symbols-outlined text-emerald-700 text-[20px]">check_circle</span>
          <span>{{ msg }}</span>
        </div>
      }
      @if (technique.errorMessage(); as err) {
        <div
          class="p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-sm font-medium flex items-center gap-2.5"
          role="alert"
          data-testid="technique-error-msg"
        >
          <span class="material-symbols-outlined text-rose-700 text-[20px]">error</span>
          <span>{{ err }}</span>
        </div>
      }

      <!-- 3. GROUPE 1 : À TRAITER (chambres vides et les plus anciennes en premier) -->
      <section class="flex flex-col gap-3.5" data-testid="section-to-treat">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <h2 class="text-lg sm:text-xl font-bold tracking-tight text-on-surface">
              À traiter
            </h2>
            <span
              class="inline-flex min-w-[24px] h-[24px] px-2 items-center justify-center rounded-full text-xs font-bold"
              [class]="
                technique.toTreat().length > 0
                  ? 'bg-amber-500 text-white'
                  : 'bg-surface-container-high text-outline'
              "
              data-testid="badge-count-to-treat"
            >
              {{ technique.toTreat().length }}
            </span>
          </div>
          <span class="text-xs text-outline">Chambres vides prioritaires</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (prob of technique.toTreat(); track prob.id) {
            <article
              class="bg-surface-container-lowest rounded-2xl border-2 p-5 shadow-xs flex flex-col justify-between gap-4 transition-all"
              [class]="
                prob.isCurrentlyOccupied
                  ? 'border-amber-300 hover:border-amber-400'
                  : 'border-emerald-300 hover:border-emerald-400'
              "
              [attr.data-testid]="'card-to-treat-' + prob.id"
            >
              <div class="flex flex-col gap-3">
                <!-- En-tête de carte : Chambre en grand + Type de panne -->
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="text-xs uppercase font-extrabold tracking-wider text-outline block">
                      Chambre
                    </span>
                    <span class="font-headline-sm text-3xl font-extrabold text-on-surface">
                      {{ prob.roomNumber }}
                    </span>
                  </div>
                  <div
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface font-bold text-xs"
                  >
                    <span class="material-symbols-outlined text-[18px] text-amber-600" aria-hidden="true">
                      {{ getProblemIcon(prob.type) }}
                    </span>
                    <span>{{ getProblemLabel(prob.type) }}</span>
                  </div>
                </div>

                <!-- CADRE TRÈS VISIBLE : Client présent OU Chambre vide -->
                <div
                  class="p-3.5 rounded-xl border-2 flex items-center gap-3 font-bold text-xs sm:text-sm shadow-xs"
                  [class]="
                    prob.isCurrentlyOccupied
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  "
                  [attr.data-testid]="
                    prob.isCurrentlyOccupied
                      ? 'frame-client-present-' + prob.id
                      : 'frame-room-empty-' + prob.id
                  "
                >
                  <span
                    class="material-symbols-outlined text-[22px] shrink-0"
                    [class]="prob.isCurrentlyOccupied ? 'text-amber-700' : 'text-emerald-700'"
                    aria-hidden="true"
                  >
                    {{ prob.isCurrentlyOccupied ? 'person' : 'meeting_room' }}
                  </span>
                  <span>
                    {{
                      prob.isCurrentlyOccupied
                        ? 'Client présent : prévenir avant d’entrer'
                        : 'Chambre vide : vous pouvez entrer'
                    }}
                  </span>
                </div>

                <!-- Remarque facultative -->
                @if (prob.description) {
                  <div class="p-3 rounded-lg bg-surface-container-high text-xs text-on-surface-variant font-medium">
                    « {{ prob.description }} »
                  </div>
                }

                <!-- Heure de signalement et auteur -->
                <div class="flex items-center gap-1.5 text-[11px] text-outline font-medium">
                  <span class="material-symbols-outlined text-[14px]">schedule</span>
                  <span>
                    Signalé {{ getRelativeTime(prob.reportedAt) }} par {{ prob.reportedByName || prob.reportedByRole }}
                  </span>
                </div>
              </div>

              <!-- Un seul bouton : Je m'en occupe -->
              <div class="pt-2 border-t border-outline-variant/40">
                <button
                  type="button"
                  (click)="onTakeProblem(prob.id)"
                  [disabled]="isActionLoading(prob.id)"
                  [attr.data-testid]="'btn-take-' + prob.id"
                  class="w-full h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">handyman</span>
                  <span>Je m'en occupe</span>
                </button>
              </div>
            </article>
          } @empty {
            <div
              class="col-span-full py-10 px-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 text-center text-outline"
            >
              <span class="material-symbols-outlined text-[36px] text-emerald-600 mb-2">task_alt</span>
              <p class="font-bold text-sm text-on-surface">Aucune panne en attente de prise en charge</p>
              <p class="text-xs text-outline mt-0.5">Toutes les chambres signalées sont en cours ou réparées.</p>
            </div>
          }
        </div>
      </section>

      <!-- 4. GROUPE 2 : EN COURS -->
      <section class="flex flex-col gap-3.5 mt-4" data-testid="section-in-progress">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <h2 class="text-lg sm:text-xl font-bold tracking-tight text-on-surface">
              En cours de réparation
            </h2>
            <span
              class="inline-flex min-w-[24px] h-[24px] px-2 items-center justify-center rounded-full text-xs font-bold"
              [class]="
                technique.inProgress().length > 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-surface-container-high text-outline'
              "
              data-testid="badge-count-in-progress"
            >
              {{ technique.inProgress().length }}
            </span>
          </div>
          <span class="text-xs text-outline">Interventions entamées</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (prob of technique.inProgress(); track prob.id) {
            <article
              class="bg-surface-container-lowest rounded-2xl border-2 border-blue-300 hover:border-blue-400 p-5 shadow-xs flex flex-col justify-between gap-4 transition-all"
              [attr.data-testid]="'card-in-progress-' + prob.id"
            >
              <div class="flex flex-col gap-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="text-xs uppercase font-extrabold tracking-wider text-outline block">
                      Chambre
                    </span>
                    <span class="font-headline-sm text-3xl font-extrabold text-on-surface">
                      {{ prob.roomNumber }}
                    </span>
                  </div>
                  <div
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 font-bold text-xs"
                  >
                    <span class="material-symbols-outlined text-[18px] text-blue-600" aria-hidden="true">
                      {{ getProblemIcon(prob.type) }}
                    </span>
                    <span>{{ getProblemLabel(prob.type) }}</span>
                  </div>
                </div>

                <!-- CADRE Client présent OU Chambre vide -->
                <div
                  class="p-3.5 rounded-xl border-2 flex items-center gap-3 font-bold text-xs sm:text-sm shadow-xs"
                  [class]="
                    prob.isCurrentlyOccupied
                      ? 'bg-amber-50 border-amber-300 text-amber-950'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  "
                >
                  <span
                    class="material-symbols-outlined text-[22px] shrink-0"
                    [class]="prob.isCurrentlyOccupied ? 'text-amber-700' : 'text-emerald-700'"
                    aria-hidden="true"
                  >
                    {{ prob.isCurrentlyOccupied ? 'person' : 'meeting_room' }}
                  </span>
                  <span>
                    {{
                      prob.isCurrentlyOccupied
                        ? 'Client présent : prévenir avant d’entrer'
                        : 'Chambre vide : vous pouvez entrer'
                    }}
                  </span>
                </div>

                @if (prob.description) {
                  <div class="p-3 rounded-lg bg-surface-container-high text-xs text-on-surface-variant font-medium">
                    « {{ prob.description }} »
                  </div>
                }

                <div class="flex items-center gap-1.5 text-[11px] text-outline font-medium">
                  <span class="material-symbols-outlined text-[14px]">engineering</span>
                  <span>
                    Pris en charge {{ getRelativeTime(prob.acknowledgedAt || prob.reportedAt) }} par {{ prob.assignedToName || 'le technicien' }}
                  </span>
                </div>
              </div>

              <!-- Un seul bouton : C'est réparé -->
              <div class="pt-2 border-t border-outline-variant/40">
                <button
                  type="button"
                  (click)="openResolveModal(prob)"
                  [disabled]="isActionLoading(prob.id)"
                  [attr.data-testid]="'btn-resolve-' + prob.id"
                  class="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">check_circle</span>
                  <span>C'est réparé</span>
                </button>
              </div>
            </article>
          } @empty {
            <div
              class="col-span-full py-8 px-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 text-center text-outline"
            >
              <p class="font-medium text-xs">Aucune intervention n'est actuellement en cours.</p>
            </div>
          }
        </div>
      </section>

      <!-- 5. GROUPE 3 : RÉPARÉS AUJOURD'HUI -->
      <section class="flex flex-col gap-3.5 mt-4" data-testid="section-resolved-today">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <h2 class="text-lg sm:text-xl font-bold tracking-tight text-on-surface">
              Réparés aujourd'hui
            </h2>
            <span
              class="inline-flex min-w-[24px] h-[24px] px-2 items-center justify-center rounded-full text-xs font-bold bg-emerald-600 text-white"
              data-testid="badge-count-resolved"
            >
              {{ technique.resolvedToday().length }}
            </span>
          </div>
          <span class="text-xs text-outline">Historique de la journée</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          @for (prob of technique.resolvedToday(); track prob.id) {
            <article
              class="bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-5 shadow-xs flex flex-col justify-between gap-3 opacity-90"
              [attr.data-testid]="'card-resolved-' + prob.id"
            >
              <div class="flex flex-col gap-2.5">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <span class="text-xs uppercase font-extrabold tracking-wider text-outline block">
                      Chambre
                    </span>
                    <span class="font-headline-sm text-2xl font-extrabold text-on-surface">
                      {{ prob.roomNumber }}
                    </span>
                  </div>
                  <div
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold text-xs"
                  >
                    <span class="material-symbols-outlined text-[16px] text-emerald-600">done_all</span>
                    <span>{{ getProblemLabel(prob.type) }}</span>
                  </div>
                </div>

                @if (prob.resolutionNote) {
                  <p class="text-xs text-on-surface-variant font-medium bg-surface-container-high p-2.5 rounded-lg">
                    Intervention : {{ prob.resolutionNote }}
                  </p>
                }

                <div class="flex items-center gap-1.5 text-[11px] text-outline font-medium">
                  <span class="material-symbols-outlined text-[14px]">check</span>
                  <span>
                    Réparé {{ getRelativeTime(prob.resolvedAt) }} par {{ prob.resolvedByName || 'le technicien' }}
                  </span>
                </div>
              </div>
            </article>
          } @empty {
            <div
              class="col-span-full py-6 px-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/60 text-center text-outline text-xs"
            >
              Aucune panne réparée enregistrée pour l'instant aujourd'hui.
            </div>
          }
        </div>
      </section>

      <!-- 6. MODALE « C'EST RÉPARÉ » (ModalShellComponent) -->
      @if (resolvingProblem(); as target) {
        <app-modal-shell
          [isOpen]="true"
          [title]="'Confirmer la réparation — Chambre ' + target.roomNumber"
          icon="check_circle"
          maxWidth="560px"
          (close)="closeResolveModal()"
        >
          <div class="flex flex-col gap-4 py-2">
            <div class="p-4 rounded-xl bg-surface-container-high text-xs sm:text-sm text-on-surface flex flex-col gap-1">
              <span class="font-bold text-on-surface">
                Problème traité : {{ getProblemLabel(target.type) }}
              </span>
              @if (target.description) {
                <span class="text-outline">Remarque initiale : « {{ target.description }} »</span>
              }
            </div>

            <div class="flex flex-col gap-1.5">
              <label for="technique-resolve-note" class="text-xs font-bold uppercase tracking-wider text-outline">
                Ce qui a été fait (facultatif)
              </label>
              <textarea
                id="technique-resolve-note"
                [(ngModel)]="resolveNoteInput"
                placeholder="Ex. Filtre nettoyé, recharge gaz effectuée, disjoncteur réarmé..."
                rows="3"
                data-testid="technique-resolve-note-input"
                class="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant/80 bg-surface text-on-surface text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <div modal-footer class="w-full flex items-center justify-end gap-3">
            <button
              type="button"
              (click)="closeResolveModal()"
              data-testid="btn-cancel-resolve"
              class="h-10 px-4 rounded-xl border border-outline-variant/60 bg-surface-container-high hover:bg-surface-variant text-on-surface text-xs font-semibold cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              (click)="confirmResolve()"
              [disabled]="isConfirmingResolve()"
              data-testid="btn-confirm-resolve"
              class="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <span class="material-symbols-outlined text-[16px]">check</span>
              <span>{{ isConfirmingResolve() ? 'Validation...' : 'Confirmer la réparation' }}</span>
            </button>
          </div>
        </app-modal-shell>
      }
    </div>
  `,
})
export class TechniquePageComponent implements OnInit, OnDestroy {
  readonly technique: TechniqueService;

  readonly resolvingProblem = signal<RoomProblemDto | null>(null);
  resolveNoteInput: string = '';
  readonly isConfirmingResolve = signal<boolean>(false);
  private readonly loadingProblemIds = signal<Set<string>>(new Set());

  constructor(techniqueOverride?: TechniqueService) {
    if (techniqueOverride) {
      this.technique = techniqueOverride;
    } else {
      try {
        this.technique = inject(TechniqueService);
      } catch {
        this.technique = new TechniqueService();
      }
    }
  }

  ngOnInit(): void {
    this.refresh();
    this.technique.startSse();
  }

  ngOnDestroy(): void {
    this.technique.stopSse();
  }

  refresh(): void {
    this.technique.fetchDashboard();
  }

  getProblemIcon(type: string): string {
    return ROOM_PROBLEM_TYPE_META[type as keyof typeof ROOM_PROBLEM_TYPE_META]?.icon || 'build';
  }

  getProblemLabel(type: string): string {
    return ROOM_PROBLEM_TYPE_META[type as keyof typeof ROOM_PROBLEM_TYPE_META]?.label || type;
  }

  getRelativeTime(isoString?: string | null): string {
    if (!isoString) return "à l'instant";
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.max(0, Math.floor(diffMs / 60000));

    if (diffMin < 2) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `il y a ${diffHours} h`;
    const diffDays = Math.floor(diffHours / 24);
    return `il y a ${diffDays} j`;
  }

  isActionLoading(problemId: string): boolean {
    return this.loadingProblemIds().has(problemId);
  }

  async onTakeProblem(problemId: string): Promise<void> {
    this.loadingProblemIds.update((set) => new Set(set).add(problemId));
    try {
      await this.technique.takeProblem(problemId);
    } finally {
      this.loadingProblemIds.update((set) => {
        const next = new Set(set);
        next.delete(problemId);
        return next;
      });
    }
  }

  openResolveModal(problem: RoomProblemDto): void {
    this.resolvingProblem.set(problem);
    this.resolveNoteInput = '';
  }

  closeResolveModal(): void {
    this.resolvingProblem.set(null);
    this.resolveNoteInput = '';
  }

  async confirmResolve(): Promise<void> {
    const prob = this.resolvingProblem();
    if (!prob) return;

    this.isConfirmingResolve.set(true);
    try {
      const ok = await this.technique.resolveProblem(prob.id, this.resolveNoteInput);
      if (ok) {
        this.closeResolveModal();
      }
    } finally {
      this.isConfirmingResolve.set(false);
    }
  }
}
