import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HotelSettings, HotelSettingsService } from '../../../../core/services/hotel-settings.service';

@Component({
  selector: 'app-hotel-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  template: `
    <section class="mx-auto w-full max-w-4xl space-y-6 overflow-x-hidden px-1 pb-8">
      <header>
        <p class="text-sm font-bold uppercase tracking-[0.12em] text-[#005e6a]">Administration</p>
        <h1 class="mt-1 font-headline text-2xl font-bold text-[#0A2540] sm:text-3xl">Paramètres de l’hôtel</h1>
        <p class="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
          Informations légales et taxes appliquées par la Résidence Blue à Grand Standing, Thiès.
        </p>
      </header>

      @if (errorMessage()) {
        <div role="alert" data-testid="hotel-settings-error" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">
          {{ errorMessage() }}
        </div>
      }
      @if (successMessage()) {
        <div role="status" data-testid="hotel-settings-success" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {{ successMessage() }}
        </div>
      }

      @if (loading()) {
        <p role="status" data-testid="hotel-settings-loading" class="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          Chargement des paramètres…
        </p>
      } @else {
      <form (submit)="save($event)" class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div class="grid min-w-0 grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
          <label class="min-w-0 space-y-1.5">
            <span class="block text-sm font-semibold text-[#0A2540]">Nom légal</span>
            <input data-testid="hotel-legal-name" name="legalName" required maxlength="180" [value]="form().legalName" (input)="setText('legalName', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20" />
          </label>
          <div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="min-w-0 space-y-1.5">
              <span class="block text-sm font-semibold text-[#0A2540]">NINEA</span>
              <input name="ninea" maxlength="40" [value]="form().ninea" (input)="setText('ninea', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none" />
            </label>
            <label class="min-w-0 space-y-1.5">
              <span class="block text-sm font-semibold text-[#0A2540]">RCCM</span>
              <input name="rccm" maxlength="40" [value]="form().rccm" (input)="setText('rccm', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none" />
            </label>
          </div>
          <label class="min-w-0 space-y-1.5">
            <span class="block text-sm font-semibold text-[#0A2540]">Ville</span>
            <input name="city" required maxlength="100" [value]="form().city" (input)="setText('city', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none" />
          </label>
          <label class="min-w-0 space-y-1.5">
            <span class="block text-sm font-semibold text-[#0A2540]">Quartier</span>
            <input name="neighborhood" required maxlength="100" [value]="form().neighborhood" (input)="setText('neighborhood', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none" />
          </label>
          <label class="min-w-0 space-y-1.5">
            <span class="block text-sm font-semibold text-[#0A2540]">Taux de TVA (%)</span>
            <input data-testid="hotel-vat-rate" name="vatRatePercent" type="number" min="0" max="100" step="1" required [value]="form().vatRatePercent" (input)="setNumber('vatRatePercent', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none" />
          </label>
          <label class="min-w-0 space-y-1.5">
            <span class="block text-sm font-semibold text-[#0A2540]">Taxe de séjour par nuit et par personne (FCFA)</span>
            <input name="tourismTaxPerNightPerPerson" type="number" min="0" step="1" required [value]="form().tourismTaxPerNightPerPerson" (input)="setNumber('tourismTaxPerNightPerPerson', $any($event.target).value)" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none" />
          </label>
          <label class="min-w-0 space-y-1.5">
            <span class="block text-sm font-semibold text-[#0A2540]">Devise</span>
            <input name="currency" value="XOF" readonly aria-readonly="true" class="min-h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-base font-semibold text-slate-700" />
          </label>
          <label class="flex min-w-0 items-start gap-3 rounded-xl border border-slate-200 p-4 md:col-span-2">
            <input data-testid="hotel-tourism-tax-children" name="tourismTaxIncludesChildren" type="checkbox" [checked]="form().tourismTaxIncludesChildren" (change)="setChildren($any($event.target).checked)" class="mt-1 h-5 w-5 shrink-0 accent-[#005e6a]" />
            <span class="text-sm font-medium leading-6 text-[#0A2540]">La taxe de séjour s’applique aussi aux enfants</span>
          </label>
        </div>
        <div class="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-end">
          <button data-testid="hotel-settings-save" type="submit" [disabled]="saving()" class="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#005e6a] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[#004b55] disabled:cursor-wait disabled:opacity-60 sm:w-auto">
            {{ saving() ? 'Enregistrement…' : 'Enregistrer les paramètres' }}
          </button>
        </div>
      </form>
      }
    </section>
  `,
})
export class HotelSettingsPageComponent implements OnInit {
  private readonly settingsService = inject(HotelSettingsService);
  readonly form = signal<HotelSettings>({ ...this.settingsService.settings() });
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      await this.settingsService.fetchFromServer();
      this.form.set({ ...this.settingsService.settings() });
    } finally {
      this.loading.set(false);
    }
  }

  setText(key: 'legalName' | 'ninea' | 'rccm' | 'city' | 'neighborhood', value: string): void {
    this.form.update((current) => ({ ...current, [key]: value }));
  }

  setNumber(key: 'vatRatePercent' | 'tourismTaxPerNightPerPerson', value: string): void {
    this.form.update((current) => ({ ...current, [key]: value === '' ? 0 : Number(value) }));
  }

  setChildren(value: boolean): void {
    this.form.update((current) => ({ ...current, tourismTaxIncludesChildren: value }));
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    this.saving.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    try {
      const { legalName, ninea, rccm, city, neighborhood, vatRatePercent, tourismTaxPerNightPerPerson, tourismTaxIncludesChildren } = this.form();
      const result = await this.settingsService.updateSettings({
        legalName, ninea, rccm, city, neighborhood, vatRatePercent,
        tourismTaxPerNightPerPerson, tourismTaxIncludesChildren, currency: 'XOF',
      });
      this.successMessage.set(result.syncPending
        ? 'Paramètres enregistrés sur cet appareil, en attente de synchronisation.'
        : 'Les paramètres de l’hôtel ont été enregistrés.');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Les paramètres n’ont pas pu être enregistrés.');
    } finally {
      this.saving.set(false);
    }
  }
}
