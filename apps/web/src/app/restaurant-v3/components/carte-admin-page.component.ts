import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DishItem } from '@residence-blue/shared';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { RESTAURANT_SCROLL_STYLES, formatFcfa } from '../models/restaurant-v3.model';
import { RestaurantV3Service } from '../services/restaurant-v3.service';

@Component({
  selector: 'app-carte-admin-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [RESTAURANT_SCROLL_STYLES],
  template: `
    <app-layout>
      <div class="mx-auto max-w-[1440px] px-3 py-4 sm:px-6 sm:py-6 space-y-5" data-testid="carte-admin-page">
        <header class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-[#006875]">
              Direction • Gestion de la carte
            </p>
            <h1 class="rb-serif text-2xl sm:text-3xl font-bold text-[#161d20]">
              Carte du Restaurant &amp; Bar
            </h1>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <a routerLink="/restaurant" data-testid="link-back-pos" class="rb-btn rb-btn-outline">
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              <span>Prise de commande</span>
            </a>
            @if (service.isDirection()) {
              <button
                type="button"
                data-testid="btn-new-product"
                [disabled]="!service.isOnline()"
                (click)="openNewForm()"
                class="rb-btn rb-btn-primary"
              >
                + Nouveau produit
              </button>
            }
          </div>
        </header>

        @if (!service.isDirection()) {
          <div
            role="alert"
            data-testid="carte-forbidden-banner"
            class="rounded-2xl border border-[#b81d1d]/40 bg-[#fde8e8] p-6 text-sm font-bold text-[#9b1c1c]"
          >
            Accès refusé : la gestion de la carte est réservée au rôle Direction.
          </div>
        } @else {
          @if (!service.isOnline()) {
            <div
              role="alert"
              data-testid="carte-offline-banner"
              class="rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] px-4 py-3 text-sm font-bold text-[#9b1c1c]"
            >
              La modification de la carte est indisponible hors ligne : reconnectez-vous pour enregistrer des changements.
            </div>
          }

          @if (service.errorMessage(); as err) {
            <div
              role="alert"
              data-testid="carte-error-banner"
              class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#b81d1d]/40 bg-[#fde8e8] px-4 py-3 text-sm font-bold text-[#9b1c1c]"
            >
              <span>{{ err }}</span>
              <div class="flex flex-wrap gap-2">
                @if (conflictProduct(); as cp) {
                  <button
                    type="button"
                    data-testid="btn-deactivate-after-409"
                    (click)="deactivateProduct(cp)"
                    class="rb-btn rb-btn-sm rb-btn-secondary"
                  >
                    Désactiver « {{ cp.name }} »
                  </button>
                }
                <button type="button" (click)="service.clearMessages()" class="rb-btn rb-btn-sm rb-btn-danger-outline">
                  Fermer
                </button>
              </div>
            </div>
          }

          @if (service.successMessage(); as ok) {
            <div
              role="status"
              data-testid="carte-success-banner"
              class="flex items-center justify-between gap-3 rounded-xl border border-[#116b41]/35 bg-[#e3f5ec] px-4 py-3 text-sm font-bold text-[#116b41]"
            >
              <span>{{ ok }}</span>
              <button type="button" (click)="service.clearMessages()" class="rb-btn rb-btn-sm rb-btn-outline">
                OK
              </button>
            </div>
          }

          <!-- Formulaire en pleine page (jamais de modale cachée ou tronquée) -->
          @if (formVisible()) {
            <section
              aria-label="Formulaire produit"
              data-testid="carte-product-form"
              class="rounded-2xl border-2 border-[#006875] bg-white p-4 sm:p-6 space-y-4"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h2 class="rb-serif text-xl font-bold text-[#161d20]">
                  {{ editingId() ? 'Modifier le produit' : 'Nouveau produit de la carte' }}
                </h2>
                <button
                  type="button"
                  data-testid="btn-cancel-form"
                  (click)="closeForm()"
                  class="rb-btn rb-btn-sm rb-btn-outline"
                >
                  Annuler (Échap)
                </button>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label for="prod-name" class="block text-xs font-bold text-[#161d20]">
                    Nom du produit *
                  </label>
                  <input
                    id="prod-name"
                    data-testid="input-prod-name"
                    type="text"
                    [ngModel]="formName()"
                    (ngModelChange)="formName.set($event)"
                    placeholder="Ex: Thiof braisé de Thiès"
                    class="mt-1 min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  />
                </div>

                <div>
                  <label for="prod-price" class="block text-xs font-bold text-[#161d20]">
                    Prix (FCFA entier) *
                  </label>
                  <input
                    id="prod-price"
                    data-testid="input-prod-price"
                    type="number"
                    min="0"
                    step="1"
                    [ngModel]="formPrice()"
                    (ngModelChange)="formPrice.set($event)"
                    class="mt-1 min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  />
                </div>

                <div>
                  <label for="prod-cat-select" class="block text-xs font-bold text-[#161d20]">
                    Catégorie existante
                  </label>
                  <select
                    id="prod-cat-select"
                    data-testid="select-prod-category"
                    [ngModel]="formCategoryId()"
                    (ngModelChange)="formCategoryId.set($event)"
                    class="mt-1 min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  >
                    @for (cat of service.categories(); track cat.id) {
                      <option [value]="cat.id">{{ cat.name }}</option>
                    }
                  </select>
                </div>

                <div>
                  <label for="prod-new-cat" class="block text-xs font-bold text-[#161d20]">
                    Ou créer une nouvelle catégorie
                  </label>
                  <input
                    id="prod-new-cat"
                    data-testid="input-prod-new-category"
                    type="text"
                    [ngModel]="formNewCategoryName()"
                    (ngModelChange)="formNewCategoryName.set($event)"
                    placeholder="Laisser vide pour utiliser la catégorie sélectionnée"
                    class="mt-1 min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  />
                </div>

                <div>
                  <label for="prod-station" class="block text-xs font-bold text-[#161d20]">
                    Poste de préparation
                  </label>
                  <select
                    id="prod-station"
                    data-testid="select-prod-station"
                    [ngModel]="formStation()"
                    (ngModelChange)="formStation.set($event)"
                    class="mt-1 min-h-[44px] w-full rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  >
                    <option value="CUISINE">Cuisine</option>
                    <option value="BAR">Bar</option>
                    <option value="PATISSERIE">Pâtisserie</option>
                  </select>
                </div>

                <div class="flex items-end pb-2">
                  <label class="inline-flex items-center gap-2.5 text-sm font-bold text-[#161d20] cursor-pointer min-h-[40px]">
                    <input
                      type="checkbox"
                      data-testid="checkbox-prod-available"
                      [ngModel]="formAvailable()"
                      (ngModelChange)="formAvailable.set($event)"
                      class="h-5 w-5 accent-[#006875]"
                    />
                    <span>Produit disponible immédiatement à la vente</span>
                  </label>
                </div>

                <div class="md:col-span-2 space-y-2">
                  <label for="prod-photo" class="block text-xs font-bold text-[#161d20]">
                    Photo facultative (JPEG, PNG, WebP — max 2 Mo, miniature 200 px générée côté serveur)
                  </label>
                  <div class="flex flex-wrap items-center gap-3">
                    <input
                      id="prod-photo"
                      data-testid="input-prod-photo"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      (change)="onFileSelected($event)"
                      class="text-xs font-semibold text-[#161d20]"
                    />
                    @if (existingThumbUrl()) {
                      <img
                        [src]="existingThumbUrl()"
                        alt="Aperçu miniature produit"
                        class="h-14 w-14 rounded-lg border border-[#d6e2e4] object-cover"
                      />
                      <button
                        type="button"
                        data-testid="btn-remove-photo"
                        (click)="removeExistingPhoto()"
                        class="rb-btn rb-btn-sm rb-btn-danger-outline"
                      >
                        Retirer la photo
                      </button>
                    }
                  </div>
                  @if (fileError()) {
                    <p class="text-xs font-bold text-[#9b1c1c]">{{ fileError() }}</p>
                  }
                </div>
              </div>

              <div class="flex flex-wrap justify-end gap-2 pt-2 border-t border-[#e6f0f2]">
                <button
                  type="button"
                  data-testid="btn-save-product"
                  [disabled]="!canSaveForm() || !service.isOnline() || service.busyAction()"
                  (click)="saveForm()"
                  class="rb-btn rb-btn-primary"
                >
                  Enregistrer le produit
                </button>
              </div>
            </section>
          }

          <!-- Filtres visibles -->
          <section class="rounded-2xl border border-[#d6e2e4] bg-white p-3 sm:p-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              data-testid="carte-search-input"
              [ngModel]="searchQuery()"
              (ngModelChange)="searchQuery.set($event)"
              placeholder="Rechercher un produit..."
              class="min-h-[42px] w-full sm:w-64 rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
            />
            <select
              data-testid="carte-filter-category"
              [ngModel]="filterCategoryId()"
              (ngModelChange)="filterCategoryId.set($event)"
              class="min-h-[42px] rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm font-semibold text-[#161d20]"
            >
              <option value="ALL">Toutes catégories</option>
              @for (cat of service.categories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
              }
            </select>
            <select
              data-testid="carte-filter-status"
              [ngModel]="filterStatus()"
              (ngModelChange)="filterStatus.set($event)"
              class="min-h-[42px] rounded-xl border border-[#7c8c8e] bg-white px-3 text-sm font-semibold text-[#161d20]"
            >
              <option value="ACTIVE">Actifs (Disponibles &amp; Épuisés)</option>
              <option value="ARCHIVED">Désactivés uniquement</option>
              <option value="ALL">Tous (y compris désactivés)</option>
            </select>
          </section>

          <!-- Tableau Carte à défilement vertical interne -->
          <section class="rounded-2xl border border-[#d6e2e4] bg-white p-3 sm:p-4">
            <div
              data-testid="carte-table-scroll"
              class="rb-scroll-box max-h-[540px] rounded-xl border border-[#d6e2e4]"
            >
              <div
                class="hidden md:grid rb-carte-grid sticky top-0 z-10 min-h-[48px] px-3 border-b border-[#d6e2e4] bg-[#f0f5f6] text-xs font-extrabold uppercase tracking-wider text-[#161d20]"
                role="row"
              >
                <div>Photo</div>
                <div>Produit</div>
                <div>Catégorie</div>
                <div>Prix</div>
                <div class="text-right">État &amp; Actions</div>
              </div>

              <div data-testid="carte-rows">
                @if (filteredProducts().length === 0) {
                  <div class="p-6 text-center text-sm font-medium text-[#3d494a]">
                    Aucun produit ne correspond à ce filtre.
                  </div>
                } @else {
                  @for (prod of filteredProducts(); track prod.id) {
                    <!-- Desktop row -->
                    <div
                      role="row"
                      [attr.data-testid]="'carte-row-' + prod.id"
                      class="hidden md:grid rb-carte-grid min-h-[56px] px-3 py-2 border-b border-[#e6f0f2] text-sm hover:bg-[#f8fbfc]"
                    >
                      <div>
                        @if (prod.thumbnailUrl || prod.photoUrl) {
                          <img
                            [src]="prod.thumbnailUrl || prod.photoUrl"
                            [alt]="prod.name"
                            class="h-11 w-11 rounded-lg border border-[#d6e2e4] object-cover"
                          />
                        } @else {
                          <div class="h-11 w-11 rounded-lg border border-[#d6e2e4] bg-[#f0f5f6] flex items-center justify-center text-[#4f6264]">
                            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">restaurant</span>
                          </div>
                        }
                      </div>
                      <div class="font-bold text-[#161d20] break-words">
                        {{ prod.name }}
                        @if (prod.status === 'ARCHIVED') {
                          <span class="ml-1.5 rounded-full bg-[#e2e8ea] px-2 py-0.5 text-[10px] font-bold text-[#3d494a]">
                            Désactivé
                          </span>
                        }
                      </div>
                      <div class="font-medium text-[#3d494a] break-words">
                        {{ prod.categoryName }}
                      </div>
                      <div class="font-extrabold text-[#161d20]">
                        {{ formatFcfa(prod.priceFcfa) }}
                      </div>
                      <div class="flex flex-wrap justify-end gap-1.5">
                        @if (prod.status !== 'ARCHIVED') {
                          <button
                            type="button"
                            [attr.data-testid]="'btn-toggle-avail-' + prod.id"
                            [disabled]="!service.isOnline() || service.busyAction()"
                            (click)="toggleAvailability(prod)"
                            [class]="prod.status === 'AVAILABLE'
                              ? 'rb-btn rb-btn-sm bg-[#e3f5ec] text-[#116b41] border border-[#116b41]/35'
                              : 'rb-btn rb-btn-sm bg-[#f1f5f6] text-[#3d494a] border border-[#7c8c8e]'"
                          >
                            {{ prod.status === 'AVAILABLE' ? 'Disponible' : 'Épuisé' }}
                          </button>
                        }
                        <button
                          type="button"
                          [attr.data-testid]="'btn-edit-prod-' + prod.id"
                          [disabled]="!service.isOnline() || service.busyAction()"
                          (click)="openEditForm(prod)"
                          class="rb-btn rb-btn-sm rb-btn-outline"
                        >
                          Modifier
                        </button>
                        @if (prod.status !== 'ARCHIVED') {
                          <button
                            type="button"
                            [attr.data-testid]="'btn-deactivate-prod-' + prod.id"
                            [disabled]="!service.isOnline() || service.busyAction()"
                            (click)="deactivateProduct(prod)"
                            class="rb-btn rb-btn-sm rb-btn-outline"
                          >
                            Désactiver
                          </button>
                        } @else {
                          <button
                            type="button"
                            [attr.data-testid]="'btn-reactivate-prod-' + prod.id"
                            [disabled]="!service.isOnline() || service.busyAction()"
                            (click)="reactivateProduct(prod)"
                            class="rb-btn rb-btn-sm rb-btn-outline"
                          >
                            Réactiver
                          </button>
                        }
                        <button
                          type="button"
                          [attr.data-testid]="'btn-delete-prod-' + prod.id"
                          [disabled]="!service.isOnline() || service.busyAction()"
                          (click)="tryDeleteProduct(prod)"
                          class="rb-btn rb-btn-sm rb-btn-danger-outline"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    <!-- Mobile card -->
                    <div class="md:hidden border-b border-[#e6f0f2] p-3 space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                          <div class="text-sm font-bold text-[#161d20] break-words">{{ prod.name }}</div>
                          <div class="text-xs font-medium text-[#3d494a]">{{ prod.categoryName }}</div>
                        </div>
                        <span class="text-sm font-extrabold text-[#161d20] whitespace-nowrap">
                          {{ formatFcfa(prod.priceFcfa) }}
                        </span>
                      </div>
                      <div class="flex flex-wrap gap-1.5">
                        @if (prod.status !== 'ARCHIVED') {
                          <button
                            type="button"
                            [disabled]="!service.isOnline() || service.busyAction()"
                            (click)="toggleAvailability(prod)"
                            class="rb-btn rb-btn-sm rb-btn-outline"
                          >
                            {{ prod.status === 'AVAILABLE' ? 'Disponible' : 'Épuisé' }}
                          </button>
                        }
                        <button
                          type="button"
                          [disabled]="!service.isOnline() || service.busyAction()"
                          (click)="openEditForm(prod)"
                          class="rb-btn rb-btn-sm rb-btn-outline"
                        >
                          Modifier
                        </button>
                        @if (prod.status !== 'ARCHIVED') {
                          <button
                            type="button"
                            [disabled]="!service.isOnline() || service.busyAction()"
                            (click)="deactivateProduct(prod)"
                            class="rb-btn rb-btn-sm rb-btn-danger-outline"
                          >
                            Désactiver
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>
            </div>
          </section>
        }
      </div>
    </app-layout>
  `,
})
export class CarteAdminPageComponent implements OnInit {
  readonly service = inject(RestaurantV3Service);

  readonly formVisible = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);
  readonly formName = signal<string>('');
  readonly formPrice = signal<number | string>(0);
  readonly formCategoryId = signal<string>('');
  readonly formNewCategoryName = signal<string>('');
  readonly formStation = signal<string>('CUISINE');
  readonly formAvailable = signal<boolean>(true);
  readonly selectedFile = signal<File | null>(null);
  readonly existingThumbUrl = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);

  readonly searchQuery = signal<string>('');
  readonly filterCategoryId = signal<string>('ALL');
  readonly filterStatus = signal<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE');
  readonly conflictProduct = signal<DishItem | null>(null);

  readonly formatFcfa = formatFcfa;

  readonly filteredProducts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const cat = this.filterCategoryId();
    const st = this.filterStatus();
    return this.service.products().filter((p) => {
      if (st === 'ACTIVE' && p.status === 'ARCHIVED') return false;
      if (st === 'ARCHIVED' && p.status !== 'ARCHIVED') return false;
      if (cat !== 'ALL' && p.categoryId !== cat) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.categoryName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  });

  readonly canSaveForm = computed(() => {
    const price = Math.round(Number(this.formPrice()));
    return (
      this.formName().trim().length >= 2 &&
      Number.isInteger(price) &&
      price >= 0 &&
      (Boolean(this.formCategoryId()) || this.formNewCategoryName().trim().length >= 2)
    );
  });

  async ngOnInit(): Promise<void> {
    if (!this.service.isDirection()) return;
    await this.service.loadCatalog();
    const firstCat = this.service.categories()[0];
    if (firstCat && !this.formCategoryId()) {
      this.formCategoryId.set(firstCat.id);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.formVisible()) {
      this.closeForm();
    }
  }

  openNewForm(): void {
    this.editingId.set(null);
    this.formName.set('');
    this.formPrice.set(2500);
    this.formCategoryId.set(this.service.categories()[0]?.id || '');
    this.formNewCategoryName.set('');
    this.formStation.set('CUISINE');
    this.formAvailable.set(true);
    this.selectedFile.set(null);
    this.existingThumbUrl.set(null);
    this.fileError.set(null);
    this.formVisible.set(true);
  }

  openEditForm(prod: DishItem): void {
    this.editingId.set(prod.id);
    this.formName.set(prod.name);
    this.formPrice.set(prod.priceFcfa);
    this.formCategoryId.set(prod.categoryId);
    this.formNewCategoryName.set('');
    this.formStation.set(prod.prepStation || 'CUISINE');
    this.formAvailable.set(prod.status !== 'SOLD_OUT');
    this.selectedFile.set(null);
    this.existingThumbUrl.set(prod.thumbnailUrl || prod.photoUrl || null);
    this.fileError.set(null);
    this.formVisible.set(true);
  }

  closeForm(): void {
    this.formVisible.set(false);
    this.selectedFile.set(null);
    this.fileError.set(null);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.fileError.set(null);
    if (!file) {
      this.selectedFile.set(null);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      this.fileError.set('La photo dépasse 2 Mo.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.fileError.set('Format accepté : JPEG, PNG ou WebP uniquement.');
      this.selectedFile.set(null);
      input.value = '';
      return;
    }
    this.selectedFile.set(file);
  }

  async removeExistingPhoto(): Promise<void> {
    const id = this.editingId();
    if (!id) return;
    const ok = await this.service.deleteProductImage(id);
    if (ok) {
      this.existingThumbUrl.set(null);
    }
  }

  async saveForm(): Promise<void> {
    if (!this.canSaveForm()) return;
    const newCat = this.formNewCategoryName().trim();
    const saved = await this.service.saveProduct(
      this.editingId(),
      {
        name: this.formName().trim(),
        priceFcfa: Math.round(Number(this.formPrice())),
        ...(newCat ? { categoryName: newCat } : { categoryId: this.formCategoryId() }),
        prepStation: this.formStation(),
        status: this.formAvailable() ? 'AVAILABLE' : 'SOLD_OUT',
      },
      this.selectedFile(),
    );
    if (saved) {
      this.closeForm();
    }
  }

  async toggleAvailability(prod: DishItem): Promise<void> {
    const next = prod.status === 'AVAILABLE' ? 'SOLD_OUT' : 'AVAILABLE';
    await this.service.toggleProductStatus(prod, next);
  }

  async deactivateProduct(prod: DishItem): Promise<void> {
    this.conflictProduct.set(null);
    await this.service.toggleProductStatus(prod, 'ARCHIVED');
  }

  async reactivateProduct(prod: DishItem): Promise<void> {
    await this.service.toggleProductStatus(prod, 'AVAILABLE');
  }

  async tryDeleteProduct(prod: DishItem): Promise<void> {
    this.conflictProduct.set(null);
    const res = await this.service.deleteProduct(prod.id);
    if (res.conflict409) {
      this.conflictProduct.set(prod);
    }
  }
}
