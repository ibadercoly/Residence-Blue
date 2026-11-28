import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ExtraServiceItemDto,
  RoomTariffDto,
  TARIFF_GRID_ROWS,
  TariffCategoryCode,
  TariffGridRowDefinition,
} from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { TariffsService } from '../../core/services/tariffs.service';

interface EditableExtraDraft {
  id: string;
  name: string;
  unit: 'DAY' | 'PERSON';
  priceFcfa: string;
  isActive: boolean;
}

@Component({
  selector: 'app-administration-tarifs-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0 overflow-x-hidden' },
  template: `
    @if (!isDirector()) {
      <section
        data-testid="admin-forbidden-403"
        class="mx-auto max-w-xl my-12 rounded-2xl border border-rose-200 bg-white p-8 shadow-sm text-center"
      >
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <span class="material-symbols-outlined text-[30px]" aria-hidden="true">lock</span>
        </div>
        <h1 class="font-headline text-2xl font-bold text-[#0A2540]">Accès refusé (403)</h1>
        <p class="mt-2 text-base text-slate-600">
          La gestion des tarifs de location est réservée uniquement à la direction.
        </p>
        <a
          [routerLink]="firstAuthorizedRoute()"
          class="mt-6 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#005e6a] px-5 py-2.5 text-base font-semibold text-white hover:bg-[#004c56]"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
          Retour à mon espace
        </a>
      </section>
    } @else {
      <div
        class="mx-auto w-full max-w-[1380px] min-w-0 space-y-6 pb-12 overflow-x-hidden"
        data-testid="admin-tarifs-page"
      >
        <!-- En-tête -->
        <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0">
          <div class="min-w-0 space-y-1">
            <a
              routerLink="/administration/comptes"
              class="inline-flex min-h-[44px] items-center gap-1.5 text-base font-semibold text-[#005e6a] hover:underline"
              data-testid="back-to-admin"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
              <span>Retour à l’administration</span>
            </a>
            <h1 class="font-headline text-2xl sm:text-3xl font-bold text-[#0A2540]">
              Tarifs publics et prestations
            </h1>
            <p class="text-base text-slate-700 leading-relaxed" data-testid="tarifs-scope-notice">
              Les changements de tarifs ne s’appliquent qu’aux <strong>nouvelles réservations</strong> ; les réservations et factures déjà enregistrées ne bougent pas.
            </p>
          </div>
        </header>

        @if (tariffsService.errorMessage() || localError()) {
          <div
            role="alert"
            data-testid="tarifs-error-banner"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-medium text-rose-900"
          >
            {{ localError() || tariffsService.errorMessage() }}
          </div>
        }

        @if (tariffsService.successMessage()) {
          <div
            role="status"
            data-testid="tarifs-success-banner"
            class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
          >
            {{ tariffsService.successMessage() }}
          </div>
        }

        <!-- 1. GRILLE TARIFAIRE HÉBERGEMENT (B&B, FCFA / nuit) -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4 min-w-0"
          aria-labelledby="tarifs-grid-heading"
          data-testid="tarifs-grid-section"
        >
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <h2 id="tarifs-grid-heading" class="text-xl font-bold text-[#0A2540]">
                Grille des chambres et appartements (nuit avec petit-déjeuner, FCFA)
              </h2>
              <p class="text-base text-slate-600 mt-0.5">
                Laissez vide une case marquée « À définir » si le prix n’est pas encore arrêté.
              </p>
            </div>
            @if (hasGridChanges()) {
              <span class="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-base font-semibold text-amber-900 shrink-0">
                Modifications non enregistrées
              </span>
            }
          </div>

          @if (tariffsService.loading() && tariffsService.tariffs().length === 0) {
            <p class="py-6 text-center text-base text-slate-600">Chargement de la grille des tarifs…</p>
          } @else {
            <!-- Vue Desktop & Tablette (>= 768px) : tableau 4 colonnes fidèle au document papier, sans défilement horizontal -->
            <div class="hidden md:block w-full min-w-0">
              <table class="w-full table-fixed border-collapse text-base" data-testid="tarifs-desktop-table">
                <thead>
                  <tr class="border-b-2 border-slate-200 bg-slate-50 text-left text-[#0A2540]">
                    <th class="w-[34%] py-3 px-3 font-bold">Situation</th>
                    <th class="w-[22%] py-3 px-3 font-bold">Chambre Standard</th>
                    <th class="w-[22%] py-3 px-3 font-bold">Chambre Confort</th>
                    <th class="w-[22%] py-3 px-3 font-bold">Appartement</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                  @for (row of gridRows; track row.key) {
                    <tr class="align-middle hover:bg-slate-50/70">
                      <td class="py-3 px-3 font-semibold text-[#0A2540] break-words">
                        {{ row.label }}
                      </td>
                      @for (col of columns; track col.code) {
                        <td class="py-3 px-3 min-w-0">
                          @if (findCellTariff(row, col.code); as cell) {
                            <div class="flex flex-col gap-1 min-w-0">
                              <div class="flex items-center gap-1.5 min-w-0">
                                <input
                                  type="text"
                                  inputmode="numeric"
                                  [attr.data-testid]="'tariff-input-' + col.code + '-' + row.key"
                                  [attr.aria-label]="col.label + ' — ' + row.label"
                                  [ngModel]="getDraftPrice(cell.id)"
                                  (ngModelChange)="setDraftPrice(cell.id, $event)"
                                  placeholder="À définir"
                                  class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-2.5 py-2 text-base font-bold text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
                                />
                                <span class="text-base font-semibold text-slate-600 shrink-0">FCFA</span>
                              </div>
                              @if (!getDraftPrice(cell.id).trim()) {
                                <span
                                  class="inline-flex w-fit items-center rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-base font-semibold text-amber-900"
                                  [attr.data-testid]="'tariff-undefined-badge-' + col.code + '-' + row.key"
                                >
                                  À définir
                                </span>
                              }
                            </div>
                          } @else {
                            <span
                              class="inline-flex items-center rounded-lg bg-slate-100 px-3 py-1.5 text-base font-medium text-slate-600"
                              [attr.data-testid]="'tariff-not-offered-' + col.code + '-' + row.key"
                            >
                              Non proposé
                            </span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            <!-- Vue Mobile (< 768px) : cartes empilées garantissant scrollWidth <= clientWidth à 360px -->
            <div class="md:hidden space-y-3" data-testid="tarifs-mobile-cards">
              @for (row of gridRows; track row.key) {
                <article class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3 min-w-0">
                  <h3 class="text-base font-bold text-[#0A2540] break-words">{{ row.label }}</h3>
                  <div class="space-y-2.5">
                    @for (col of columns; track col.code) {
                      <div class="flex flex-col gap-1 rounded-lg bg-white border border-slate-200 p-2.5 min-w-0">
                        <span class="text-base font-semibold text-slate-700">{{ col.label }}</span>
                        @if (findCellTariff(row, col.code); as cell) {
                          <div class="flex items-center gap-2 min-w-0">
                            <input
                              type="text"
                              inputmode="numeric"
                              [attr.data-testid]="'mobile-tariff-input-' + col.code + '-' + row.key"
                              [attr.aria-label]="col.label + ' — ' + row.label"
                              [ngModel]="getDraftPrice(cell.id)"
                              (ngModelChange)="setDraftPrice(cell.id, $event)"
                              placeholder="À définir"
                              class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-bold text-[#0A2540] focus:border-[#005e6a] focus:outline-none"
                            />
                            <span class="text-base font-semibold text-slate-600 shrink-0">FCFA</span>
                          </div>
                          @if (!getDraftPrice(cell.id).trim()) {
                            <span class="text-base font-semibold text-amber-800">À définir</span>
                          }
                        } @else {
                          <span class="text-base font-medium text-slate-600">Non proposé</span>
                        }
                      </div>
                    }
                  </div>
                </article>
              }
            </div>

            <!-- Boutons Enregistrer / Annuler les changements -->
            <div class="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                type="button"
                (click)="cancelGridChanges()"
                [disabled]="!hasGridChanges() || tariffsService.saving()"
                data-testid="btn-cancel-tariffs"
                class="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-[#0A2540] hover:bg-slate-50 disabled:opacity-45 cursor-pointer"
              >
                Annuler les changements
              </button>
              <button
                type="button"
                (click)="saveGridChanges()"
                [disabled]="!hasGridChanges() || tariffsService.saving()"
                data-testid="btn-save-tariffs"
                class="inline-flex min-h-[48px] w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-[#005e6a] px-6 py-2.5 text-base font-bold text-white hover:bg-[#004c56] disabled:opacity-45 cursor-pointer"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">save</span>
                <span>{{ tariffsService.saving() ? 'Enregistrement…' : 'Enregistrer' }}</span>
              </button>
            </div>
          }
        </section>

        <!-- 2. LISTE DES PRESTATIONS (Autres ventes : salle de séminaire, pauses) -->
        <section
          class="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm space-y-4 min-w-0"
          aria-labelledby="extra-services-heading"
          data-testid="extra-services-section"
        >
          <div class="min-w-0">
            <h2 id="extra-services-heading" class="text-xl font-bold text-[#0A2540]">
              Prestations (salle de séminaire et pauses)
            </h2>
            <p class="text-base text-slate-600 mt-0.5">
              Disponibles dans Facturation (catalogue des autres ventes) pour une note de séjour, une facture d’entreprise ou un client de passage.
            </p>
          </div>

          <div class="space-y-3">
            @for (svc of extraDrafts(); track svc.id) {
              <div
                class="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end min-w-0"
                [attr.data-testid]="'extra-service-row-' + svc.id"
              >
                <label class="block min-w-0 space-y-1">
                  <span class="block text-base font-semibold text-[#0A2540]">Prestation</span>
                  <input
                    type="text"
                    [ngModel]="svc.name"
                    (ngModelChange)="updateExtraDraft(svc.id, 'name', $event)"
                    class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-[#0A2540]"
                  />
                </label>

                <label class="block min-w-0 space-y-1">
                  <span class="block text-base font-semibold text-[#0A2540]">Unité</span>
                  <select
                    [ngModel]="svc.unit"
                    (ngModelChange)="updateExtraDraft(svc.id, 'unit', $event)"
                    class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-[#0A2540]"
                  >
                    <option value="DAY">Par journée</option>
                    <option value="PERSON">Par personne</option>
                  </select>
                </label>

                <label class="block min-w-0 space-y-1">
                  <span class="block text-base font-semibold text-[#0A2540]">Prix (FCFA)</span>
                  <input
                    type="text"
                    inputmode="numeric"
                    [attr.data-testid]="'extra-price-' + svc.id"
                    [ngModel]="svc.priceFcfa"
                    (ngModelChange)="updateExtraDraft(svc.id, 'priceFcfa', $event)"
                    class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-bold text-[#0A2540]"
                  />
                </label>

                <button
                  type="button"
                  (click)="saveExtraService(svc)"
                  [disabled]="tariffsService.saving()"
                  [attr.data-testid]="'btn-save-extra-' + svc.id"
                  class="inline-flex min-h-[44px] w-full md:w-auto items-center justify-center rounded-xl bg-[#005e6a] px-4 py-2 text-base font-bold text-white hover:bg-[#004c56] disabled:opacity-45 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            }
          </div>

          <!-- Ajouter une nouvelle prestation -->
          <div class="border-t border-slate-200 pt-4 space-y-3">
            <h3 class="text-base font-bold text-[#0A2540]">Ajouter une prestation</h3>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end min-w-0">
              <label class="block min-w-0 space-y-1">
                <span class="block text-base font-semibold text-slate-700">Nom</span>
                <input
                  type="text"
                  data-testid="new-extra-name"
                  [ngModel]="newExtraName()"
                  (ngModelChange)="newExtraName.set($event)"
                  placeholder="Ex. Location sonorisation"
                  class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-[#0A2540]"
                />
              </label>
              <label class="block min-w-0 space-y-1">
                <span class="block text-base font-semibold text-slate-700">Unité</span>
                <select
                  data-testid="new-extra-unit"
                  [ngModel]="newExtraUnit()"
                  (ngModelChange)="newExtraUnit.set($event)"
                  class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base text-[#0A2540]"
                >
                  <option value="DAY">Par journée</option>
                  <option value="PERSON">Par personne</option>
                </select>
              </label>
              <label class="block min-w-0 space-y-1">
                <span class="block text-base font-semibold text-slate-700">Prix (FCFA)</span>
                <input
                  type="text"
                  inputmode="numeric"
                  data-testid="new-extra-price"
                  [ngModel]="newExtraPrice()"
                  (ngModelChange)="newExtraPrice.set($event)"
                  placeholder="Ex. 25000"
                  class="min-h-[44px] w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-bold text-[#0A2540]"
                />
              </label>
              <button
                type="button"
                (click)="addExtraService()"
                [disabled]="tariffsService.saving()"
                data-testid="btn-add-extra"
                class="inline-flex min-h-[44px] w-full md:w-auto items-center justify-center rounded-xl border border-[#005e6a] bg-white px-4 py-2 text-base font-bold text-[#005e6a] hover:bg-[#005e6a]/5 disabled:opacity-45 cursor-pointer"
              >
                + Ajouter
              </button>
            </div>
          </div>
        </section>
      </div>
    }
  `,
})
export class AdministrationTarifsPageComponent implements OnInit {
  private readonly authService: AuthService;
  readonly tariffsService: TariffsService;

  constructor(authOverride?: AuthService, tariffsOverride?: TariffsService) {
    this.authService = authOverride ?? inject(AuthService);
    this.tariffsService = tariffsOverride ?? inject(TariffsService);
  }

  readonly isDirector = computed(() => this.authService.isDirector());
  readonly firstAuthorizedRoute = computed(() => this.authService.getFirstAuthorizedRoute());

  readonly gridRows = TARIFF_GRID_ROWS;
  readonly columns: ReadonlyArray<{ code: TariffCategoryCode; label: string }> = [
    { code: 'STANDARD', label: 'Chambre Standard' },
    { code: 'CONFORT', label: 'Chambre Confort' },
    { code: 'APPARTEMENT', label: 'Appartement' },
  ];

  readonly draftPrices = signal<Record<string, string>>({});
  readonly extraDrafts = signal<EditableExtraDraft[]>([]);
  readonly localError = signal<string | null>(null);

  readonly newExtraName = signal<string>('');
  readonly newExtraUnit = signal<'DAY' | 'PERSON'>('DAY');
  readonly newExtraPrice = signal<string>('');

  readonly hasGridChanges = computed(() => {
    const drafts = this.draftPrices();
    return this.tariffsService.tariffs().some((t) => {
      const original = t.pricePerNightFcfa !== null ? String(t.pricePerNightFcfa) : '';
      const current = (drafts[t.id] ?? original).trim();
      return current !== original;
    });
  });

  async ngOnInit(): Promise<void> {
    if (!this.isDirector()) return;
    await this.tariffsService.fetchGrid();
    this.syncDraftsFromServer();
  }

  private syncDraftsFromServer(): void {
    const nextMap: Record<string, string> = {};
    for (const t of this.tariffsService.tariffs()) {
      nextMap[t.id] = t.pricePerNightFcfa !== null ? String(t.pricePerNightFcfa) : '';
    }
    this.draftPrices.set(nextMap);

    this.extraDrafts.set(
      this.tariffsService.extraServices().map((s: ExtraServiceItemDto) => ({
        id: s.id,
        name: s.name,
        unit: s.unit === 'DAY' ? 'DAY' : 'PERSON',
        priceFcfa: String(s.priceFcfa),
        isActive: s.isActive,
      })),
    );
  }

  findCellTariff(
    row: TariffGridRowDefinition,
    categoryCode: TariffCategoryCode,
  ): RoomTariffDto | null {
    if (categoryCode === 'STANDARD' && !row.standardSupported) return null;
    if (categoryCode === 'CONFORT' && !row.confortSupported) return null;
    if (categoryCode === 'APPARTEMENT' && !row.appartementSupported) return null;

    const list = this.tariffsService.tariffs();
    if (categoryCode === 'APPARTEMENT') {
      return (
        list.find(
          (t) =>
            t.categoryCode === 'APPARTEMENT' &&
            t.guestsCount === row.guestsCount &&
            t.roomsUsed === row.apartmentRoomsUsed,
        ) ?? null
      );
    }
    return (
      list.find(
        (t) => t.categoryCode === categoryCode && t.guestsCount === row.guestsCount,
      ) ?? null
    );
  }

  getDraftPrice(tariffId: string): string {
    return this.draftPrices()[tariffId] ?? '';
  }

  setDraftPrice(tariffId: string, rawValue: string): void {
    this.localError.set(null);
    const cleaned = String(rawValue ?? '').replace(/[^\d]/g, '');
    this.draftPrices.update((map) => ({ ...map, [tariffId]: cleaned }));
  }

  cancelGridChanges(): void {
    this.localError.set(null);
    this.tariffsService.errorMessage.set(null);
    this.tariffsService.successMessage.set(null);
    this.syncDraftsFromServer();
  }

  async saveGridChanges(): Promise<void> {
    this.localError.set(null);
    const drafts = this.draftPrices();
    const payload: Array<{ id: string; pricePerNightFcfa: number | null }> = [];

    for (const t of this.tariffsService.tariffs()) {
      const original = t.pricePerNightFcfa !== null ? String(t.pricePerNightFcfa) : '';
      const raw = (drafts[t.id] ?? original).trim();
      if (raw === original) continue;

      if (raw === '') {
        payload.push({ id: t.id, pricePerNightFcfa: null });
      } else {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          this.localError.set(
            `Montant invalide pour « ${t.categoryName} — ${t.label} » : saisissez un entier positif en FCFA ou laissez « À définir ».`,
          );
          return;
        }
        payload.push({ id: t.id, pricePerNightFcfa: parsed });
      }
    }

    if (payload.length === 0) return;

    const ok = await this.tariffsService.saveTariffGrid(payload);
    if (ok) {
      this.syncDraftsFromServer();
    }
  }

  updateExtraDraft(
    id: string,
    field: keyof EditableExtraDraft,
    value: string | boolean,
  ): void {
    this.localError.set(null);
    this.extraDrafts.update((list) =>
      list.map((item) => {
        if (item.id !== id) return item;
        if (field === 'priceFcfa') {
          return { ...item, priceFcfa: String(value ?? '').replace(/[^\d]/g, '') };
        }
        return { ...item, [field]: value };
      }),
    );
  }

  async saveExtraService(svc: EditableExtraDraft): Promise<void> {
    this.localError.set(null);
    const name = svc.name.trim();
    const price = Number(svc.priceFcfa.trim());
    if (name.length < 2) {
      this.localError.set('Le nom de la prestation doit contenir au moins 2 caractères.');
      return;
    }
    if (!Number.isInteger(price) || price <= 0) {
      this.localError.set('Le prix de la prestation doit être un entier positif en FCFA.');
      return;
    }
    const ok = await this.tariffsService.updateExtraService(svc.id, {
      name,
      unit: svc.unit,
      priceFcfa: price,
      isActive: svc.isActive,
    });
    if (ok) {
      this.syncDraftsFromServer();
    }
  }

  async addExtraService(): Promise<void> {
    this.localError.set(null);
    const name = this.newExtraName().trim();
    const price = Number(this.newExtraPrice().replace(/[^\d]/g, ''));
    if (name.length < 2) {
      this.localError.set('Saisissez un nom pour la nouvelle prestation.');
      return;
    }
    if (!Number.isInteger(price) || price <= 0) {
      this.localError.set('Saisissez un prix entier positif en FCFA.');
      return;
    }
    const ok = await this.tariffsService.createExtraService({
      name,
      unit: this.newExtraUnit(),
      priceFcfa: price,
    });
    if (ok) {
      this.newExtraName.set('');
      this.newExtraPrice.set('');
      this.syncDraftsFromServer();
    }
  }
}
