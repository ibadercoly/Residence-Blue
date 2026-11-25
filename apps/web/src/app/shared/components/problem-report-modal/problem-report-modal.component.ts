import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomProblemType, RoomStatus } from '@residence-blue/shared';
import { RoomsService, RoomUiItem } from '../../../core/services/rooms.service';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';

export interface ProblemTypeChoice {
  type: RoomProblemType;
  label: string;
  icon: string;
}

export const PROBLEM_TYPE_CHOICES: ProblemTypeChoice[] = [
  { type: 'CLIMATISATION', label: 'Climatisation', icon: 'ac_unit' },
  { type: 'FUITE_EAU', label: "Fuite d'eau", icon: 'water_drop' },
  { type: 'ELECTRICITE', label: 'Électricité', icon: 'bolt' },
  { type: 'AMPOULE', label: 'Ampoule', icon: 'lightbulb' },
  { type: 'AUTRE', label: 'Autre', icon: 'build' },
];

@Component({
  selector: 'app-problem-report-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  template: `
    <app-modal-shell
      [isOpen]="isOpen"
      [title]="'Signaler un problème — Chambre ' + (room?.number || '')"
      icon="report_problem"
      maxWidth="640px"
      (close)="onCancel()"
    >
      <div class="flex flex-col gap-5 py-2">
        <!-- Message d'information clair selon l'occupation -->
        @if (isRoomOccupied()) {
          <div
            class="p-4 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-950 font-medium text-sm sm:text-base flex items-center gap-3 shadow-xs"
            role="alert"
            data-testid="problem-info-occupied"
          >
            <span class="material-symbols-outlined text-[24px] text-cyan-700 shrink-0" aria-hidden="true">info</span>
            <span>Le client reste dans la chambre. L'équipe technique est prévenue.</span>
          </div>
        } @else {
          <div
            class="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 font-medium text-sm sm:text-base flex items-center gap-3 shadow-xs"
            role="alert"
            data-testid="problem-info-free"
          >
            <span class="material-symbols-outlined text-[24px] text-amber-700 shrink-0" aria-hidden="true">warning</span>
            <span>Cette chambre ne pourra plus être louée tant qu'elle n'est pas réparée</span>
          </div>
        }

        <!-- Liste des boutons radio pour le type -->
        <fieldset class="flex flex-col gap-2">
          <legend class="font-bold text-on-surface text-sm sm:text-base mb-1">
            Type de problème constaté
          </legend>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            @for (choice of choices; track choice.type) {
              <label
                class="flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer text-sm font-semibold select-none"
                [class.border-rose-500]="selectedType() === choice.type"
                [class.bg-rose-50]="selectedType() === choice.type"
                [class.text-rose-950]="selectedType() === choice.type"
                [class.border-outline-variant]="selectedType() !== choice.type"
                [class.bg-surface-container-lowest]="selectedType() !== choice.type"
                [class.text-on-surface]="selectedType() !== choice.type"
                [class.hover:bg-surface-container-low]="selectedType() !== choice.type"
                [attr.data-testid]="'problem-radio-' + choice.type.toLowerCase()"
              >
                <input
                  type="radio"
                  name="problemType"
                  [value]="choice.type"
                  [checked]="selectedType() === choice.type"
                  (change)="selectedType.set(choice.type)"
                  class="sr-only"
                />
                <span
                  class="material-symbols-outlined text-[20px] shrink-0"
                  [class.text-rose-700]="selectedType() === choice.type"
                  [class.text-outline]="selectedType() !== choice.type"
                >
                  {{ choice.icon }}
                </span>
                <span class="flex-1 truncate">{{ choice.label }}</span>
                @if (selectedType() === choice.type) {
                  <span class="material-symbols-outlined text-[18px] text-rose-600 shrink-0">check_circle</span>
                }
              </label>
            }
          </div>
        </fieldset>

        <!-- Champ texte libre optionnel "Préciser le problème" -->
        <div class="flex flex-col gap-1.5">
          <label for="problem-description" class="font-bold text-on-surface text-sm">
            Préciser le problème <span class="font-normal text-on-surface-variant">(optionnel)</span>
          </label>
          <textarea
            id="problem-description"
            rows="3"
            [(ngModel)]="description"
            placeholder="Ex : Robinet de douche qui fuit, télécommande ne répond pas..."
            data-testid="problem-description-input"
            class="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/60 text-on-surface placeholder:text-outline text-sm focus:outline-none focus:border-primary transition-colors resize-none"
          ></textarea>
        </div>
      </div>

      <!-- Pied de modale : Annuler et Confirmer le signalement -->
      <div modal-footer class="flex items-center justify-end gap-3 w-full">
        <button
          type="button"
          (click)="onCancel()"
          [disabled]="isSubmitting()"
          data-testid="problem-cancel-button"
          class="min-h-[48px] px-5 rounded-xl border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface font-bold text-sm transition-colors cursor-pointer disabled:opacity-50"
        >
          Annuler
        </button>

        <button
          type="button"
          (click)="onConfirm()"
          [disabled]="isSubmitting() || !selectedType()"
          data-testid="problem-submit-button"
          class="min-h-[48px] px-6 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold text-sm inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
        >
          @if (isSubmitting()) {
            <span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            <span>Enregistrement...</span>
          } @else {
            <span class="material-symbols-outlined text-[18px]">report_problem</span>
            <span>Confirmer le signalement</span>
          }
        </button>
      </div>
    </app-modal-shell>
  `,
})
export class ProblemReportModalComponent {
  private readonly roomsService: RoomsService;

  constructor(roomsService?: RoomsService) {
    this.roomsService = roomsService ?? inject(RoomsService);
  }

  @Input({ required: true }) room: RoomUiItem | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() problemReported = new EventEmitter<void>();

  readonly choices = PROBLEM_TYPE_CHOICES;
  readonly selectedType = signal<RoomProblemType>('CLIMATISATION');
  readonly description = signal<string>('');
  readonly isSubmitting = signal<boolean>(false);

  isRoomOccupied(): boolean {
    return this.room?.status === RoomStatus.OCCUPIED;
  }

  onCancel(): void {
    if (this.isSubmitting()) return;
    this.close.emit();
  }

  async onConfirm(): Promise<void> {
    if (!this.room || !this.selectedType() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    try {
      const ok = await this.roomsService.reportProblem(this.room.id, {
        type: this.selectedType(),
        description: this.description().trim() || undefined,
      });

      if (ok) {
        this.description.set('');
        this.problemReported.emit();
        this.close.emit();
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
