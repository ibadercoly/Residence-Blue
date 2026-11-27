import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalShellComponent } from '../modal-shell/modal-shell.component';
import { RoomUiItem } from '../../../core/services/rooms.service';

export interface InterventionProblemChoice {
  id: string;
  label: string;
  icon: string;
}

export const INTERVENTION_PROBLEM_CHOICES: InterventionProblemChoice[] = [
  { id: 'fuite', label: "Fuite d'eau", icon: 'water_drop' },
  { id: 'electricite', label: 'Ampoule ou électricité', icon: 'lightbulb' },
  { id: 'climatisation', label: 'Climatisation', icon: 'ac_unit' },
  { id: 'autre', label: 'Autre', icon: 'build' },
];

/**
 * Fenêtre modale unique et partagée entre l'espace Ménage et l'espace Assistant de Réception
 * pour signaler un problème technique dans une chambre (soumis à validation de la Direction).
 */
@Component({
  selector: 'app-report-intervention-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  template: `
    @if (isOpen && room) {
      <app-modal-shell
        [isOpen]="isOpen"
        title="Signaler un problème"
        [subtitle]="'Chambre ' + room.number + ' · Étage ' + room.floor"
        icon="report_problem"
        [testId]="testId"
        (close)="onCancel()"
        (closed)="onCancel()"
      >
        <div modal-body class="flex flex-col gap-5">
          <div class="text-lg sm:text-[20px] font-bold text-on-surface">
            Quel est le problème ?
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="intervention-problem-choices">
            @for (opt of problemChoices; track opt.id) {
              <button
                type="button"
                (click)="selectedChoice.set(opt.label)"
                [attr.data-testid]="'intervention-choice-' + opt.id"
                [class]="
                  selectedChoice() === opt.label
                    ? 'min-h-[64px] px-4 py-3 rounded-2xl border-2 border-primary bg-primary/10 text-primary text-base sm:text-[18px] font-bold flex items-center gap-3 text-left cursor-pointer transition-colors'
                    : 'min-h-[64px] px-4 py-3 rounded-2xl border-2 border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low text-on-surface text-base sm:text-[18px] font-semibold flex items-center gap-3 text-left cursor-pointer transition-colors'
                "
              >
                <span class="material-symbols-outlined text-[26px] shrink-0" aria-hidden="true">{{ opt.icon }}</span>
                <span class="break-words">{{ opt.label }}</span>
              </button>
            }
          </div>

          <div class="flex flex-col gap-2">
            <label for="intervention-problem-note" class="text-base sm:text-[18px] font-semibold text-on-surface">
              Précision (facultatif)
            </label>
            <textarea
              id="intervention-problem-note"
              rows="2"
              maxlength="180"
              [ngModel]="details()"
              (ngModelChange)="details.set($event)"
              placeholder="Exemple : robinet qui coule, ampoule grillée..."
              data-testid="input-intervention-description"
              class="w-full p-3.5 rounded-2xl bg-surface-container-lowest border border-outline-variant text-on-surface text-base sm:text-[18px] outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            ></textarea>
          </div>

          <div
            class="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-sm sm:text-[17px] font-semibold flex items-start gap-3"
            data-testid="intervention-problem-warning"
          >
            <span class="material-symbols-outlined text-[24px] text-amber-700 shrink-0 mt-0.5" aria-hidden="true">info</span>
            <span>Votre demande sera transmise à la Direction pour validation avant toute intervention technique.</span>
          </div>
        </div>

        <div modal-footer class="w-full flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            (click)="onCancel()"
            data-testid="btn-cancel-intervention"
            class="min-h-[52px] px-5 rounded-2xl border-2 border-outline-variant bg-surface-container-high hover:bg-surface-variant text-on-surface text-base font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
            <span>Annuler</span>
          </button>
          <button
            type="button"
            (click)="onSubmit()"
            [disabled]="!selectedChoice() || isSubmitting"
            data-testid="btn-submit-intervention"
            class="min-h-[52px] px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-base font-bold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">send</span>
            <span>{{ isSubmitting ? 'Envoi...' : 'Envoyer' }}</span>
          </button>
        </div>
      </app-modal-shell>
    }
  `,
})
export class ReportInterventionModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() room: RoomUiItem | null = null;
  @Input() isSubmitting = false;
  @Input() testId = 'modal-report-intervention';

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<string>();

  readonly problemChoices = INTERVENTION_PROBLEM_CHOICES;
  readonly selectedChoice = signal<string | null>("Fuite d'eau");
  readonly details = signal<string>('');

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['isOpen'] && this.isOpen) || (changes['room'] && this.room)) {
      this.selectedChoice.set("Fuite d'eau");
      this.details.set('');
    }
  }

  onCancel(): void {
    this.closed.emit();
  }

  onSubmit(): void {
    const choice = this.selectedChoice();
    if (!choice || this.isSubmitting) return;
    const note = this.details().trim();
    const description = note ? `${choice} — ${note}` : choice;
    this.submitted.emit(description);
  }
}
