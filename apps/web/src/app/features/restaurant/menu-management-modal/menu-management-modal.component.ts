import {
  Component,
  EventEmitter,
  Input,
  Output,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ALLERGEN_LABELS,
  Allergen,
  DISH_TAG_LABELS,
  DishCategory,
  DishItem,
  DishOption,
  DishTag,
  MEAL_SLOT_LABELS,
  MealSlot,
  PREP_STATION_LABELS,
  PrepStation
} from '@residence-blue/shared';
import { ModalShellComponent } from '../../../shared/components/modal-shell/modal-shell.component';
import { MenuManagementService, CsvValidationReport } from '../../../core/services/menu-management.service';
import { processAndOptimizeImage, validateImageFile } from '../../../core/utils/image-processor.util';
import { PhotoStorageService } from '../../../core/services/photo-storage.service';

export type ManagementTab = 'LIST' | 'FORM' | 'CATEGORIES' | 'IMPORT_EXPORT';

@Component({
  selector: 'app-menu-management-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalShellComponent],
  templateUrl: './menu-management-modal.component.html'
})
export class MenuManagementModalComponent {
  @Input() isOpen = false;
  @Output() closed = new EventEmitter<void>();

  readonly menuService = inject(MenuManagementService);
  readonly photoStorage = inject(PhotoStorageService);

  // Onglet actif
  readonly activeTab = signal<ManagementTab>('LIST');

  // Confirmation modale
  readonly confirmAction = signal<{
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
  } | null>(null);

  // État formulaire plat
  readonly isEditing = signal<boolean>(false);
  readonly editingDishId = signal<string | null>(null);
  readonly hasUnsavedChanges = signal<boolean>(false);

  // Champs du formulaire plat
  readonly formName = signal<string>('');
  readonly formDescription = signal<string>('');
  readonly formCategoryId = signal<string>('');
  readonly formPrice = signal<number>(3000);
  readonly formHalfPortionPrice = signal<number | null>(null);
  readonly formTags = signal<DishTag[]>([]);
  readonly formAllergens = signal<Allergen[]>([]);
  readonly formPrepTime = signal<number>(20);
  readonly formPrepStation = signal<PrepStation>('CUISINE');
  readonly formAvailabilityType = signal<'ALWAYS' | 'SLOTS'>('ALWAYS');
  readonly formSlots = signal<MealSlot[]>(['LUNCH', 'DINNER']);
  readonly formDays = signal<number[]>([1, 2, 3, 4, 5, 6, 0]);
  readonly formOptions = signal<DishOption[]>([]);
  readonly formDisplayOrder = signal<number>(1);
  readonly formPhotoUrl = signal<string | null>(null);
  readonly photoError = signal<string | null>(null);
  readonly isProcessingPhoto = signal<boolean>(false);

  // Gestion des catégories
  readonly newCategoryName = signal<string>('');
  readonly inlineNewCategoryName = signal<string>('');
  readonly showInlineNewCategory = signal<boolean>(false);

  // Import CSV
  readonly csvReport = signal<CsvValidationReport | null>(null);
  readonly csvFileName = signal<string | null>(null);
  readonly isImportingCsv = signal<boolean>(false);

  // Dictionnaires de labels
  readonly tagLabels = DISH_TAG_LABELS;
  readonly allergenLabels = ALLERGEN_LABELS;
  readonly prepStationLabels = PREP_STATION_LABELS;
  readonly mealSlotLabels = MEAL_SLOT_LABELS;

  readonly allTags: DishTag[] = [
    'LOCAL_SPECIALTY',
    'POPULAR',
    'DISH_OF_DAY',
    'VEGETARIAN',
    'SPICY',
    'SIGNATURE_BAR',
    'NEW'
  ];

  readonly allAllergens: Allergen[] = [
    'PEANUT',
    'GLUTEN',
    'MILK',
    'EGG',
    'FISH',
    'CRUSTACEAN',
    'SOY',
    'NUTS',
    'CELERY',
    'MUSTARD',
    'SESAME'
  ];

  // Validation dynamique du nom
  readonly nameError = computed(() => {
    const name = this.formName().trim();
    if (!name) return 'Le nom du plat est obligatoire.';
    if (name.length < 2) return 'Le nom doit comporter au moins 2 caractères.';
    if (name.length > 80) return 'Le nom ne peut pas dépasser 80 caractères.';
    if (this.menuService.isDishNameTaken(name, this.editingDishId() || undefined)) {
      return `Un plat nommé « ${name} » existe déjà dans le menu.`;
    }
    return null;
  });

  // Validation dynamique du prix
  readonly priceError = computed(() => {
    const p = this.formPrice();
    if (p === null || p === undefined || isNaN(p)) return 'Le prix en FCFA est obligatoire.';
    if (p < 0) return 'Le prix ne peut pas être négatif.';
    if (p > 1000000) return 'Le prix ne peut excéder 1 000 000 FCFA.';
    if (!Number.isInteger(p)) return 'Le prix doit être un nombre entier en FCFA.';
    return null;
  });

  // Validation de la catégorie
  readonly categoryError = computed(() => {
    if (!this.formCategoryId()) return 'Veuillez sélectionner une catégorie.';
    return null;
  });

  // Validité globale du formulaire plat
  readonly isFormValid = computed(() => {
    return !this.nameError() && !this.priceError() && !this.categoryError();
  });

  // ==========================================
  // NAVIGATION ONGLETS & FERMETURE
  // ==========================================

  setTab(tab: ManagementTab): void {
    if (this.activeTab() === 'FORM' && this.hasUnsavedChanges()) {
      this.confirmAction.set({
        title: 'Modifications non enregistrées',
        message: 'Vous avez des modifications en cours sur ce plat. Voulez-vous quitter sans enregistrer ?',
        confirmText: 'Quitter sans enregistrer',
        cancelText: 'Continuer la saisie',
        onConfirm: () => {
          this.confirmAction.set(null);
          this.hasUnsavedChanges.set(false);
          this.activeTab.set(tab);
        }
      });
      return;
    }
    this.activeTab.set(tab);
  }

  handleClose(): void {
    if (this.activeTab() === 'FORM' && this.hasUnsavedChanges()) {
      this.confirmAction.set({
        title: 'Quitter la gestion du menu ?',
        message: 'Des modifications non enregistrées sont en cours. Les abandonner ?',
        confirmText: 'Abandonner',
        cancelText: 'Rester',
        onConfirm: () => {
          this.confirmAction.set(null);
          this.hasUnsavedChanges.set(false);
          this.closed.emit();
        }
      });
      return;
    }
    this.closed.emit();
  }

  // ==========================================
  // FORMULAIRE PLAT (AJOUT / MODIFICATION)
  // ==========================================

  openNewDishForm(): void {
    this.isEditing.set(false);
    this.editingDishId.set(null);
    this.formName.set('');
    this.formDescription.set('');

    const firstCat = this.menuService.categories()[0];
    this.formCategoryId.set(firstCat ? firstCat.id : '');
    this.formPrice.set(3500);
    this.formHalfPortionPrice.set(null);
    this.formTags.set([]);
    this.formAllergens.set([]);
    this.formPrepTime.set(20);
    this.formPrepStation.set('CUISINE');
    this.formAvailabilityType.set('ALWAYS');
    this.formSlots.set(['LUNCH', 'DINNER']);
    this.formDays.set([1, 2, 3, 4, 5, 6, 0]);
    this.formOptions.set([]);
    this.formDisplayOrder.set(this.menuService.allDishes().length + 1);
    this.formPhotoUrl.set(null);
    this.photoError.set(null);
    this.hasUnsavedChanges.set(false);

    this.activeTab.set('FORM');
  }

  openEditDishForm(dish: DishItem): void {
    this.isEditing.set(true);
    this.editingDishId.set(dish.id);
    this.formName.set(dish.name);
    this.formDescription.set(dish.description || '');
    this.formCategoryId.set(dish.categoryId);
    this.formPrice.set(dish.priceFcfa);
    this.formHalfPortionPrice.set(dish.halfPortionPriceFcfa || null);
    this.formTags.set([...dish.tags]);
    this.formAllergens.set([...dish.allergens]);
    this.formPrepTime.set(dish.prepTimeMinutes || 20);
    this.formPrepStation.set(dish.prepStation || 'CUISINE');
    this.formAvailabilityType.set(dish.availability?.type || 'ALWAYS');
    this.formSlots.set(dish.availability?.slots || ['LUNCH', 'DINNER']);
    this.formDays.set(dish.availability?.days || [1, 2, 3, 4, 5, 6, 0]);
    this.formOptions.set(dish.options ? dish.options.map((o) => ({ ...o })) : []);
    this.formDisplayOrder.set(dish.displayOrder || 1);
    this.formPhotoUrl.set(dish.photoUrl || null);
    this.photoError.set(null);
    this.hasUnsavedChanges.set(false);

    this.activeTab.set('FORM');
  }

  markChanged(): void {
    this.hasUnsavedChanges.set(true);
  }

  toggleTag(tag: DishTag): void {
    this.markChanged();
    const current = this.formTags();
    if (current.includes(tag)) {
      this.formTags.set(current.filter((t) => t !== tag));
    } else {
      this.formTags.set([...current, tag]);
    }
  }

  toggleAllergen(allergen: Allergen): void {
    this.markChanged();
    const current = this.formAllergens();
    if (current.includes(allergen)) {
      this.formAllergens.set(current.filter((a) => a !== allergen));
    } else {
      this.formAllergens.set([...current, allergen]);
    }
  }

  toggleSlot(slot: MealSlot): void {
    this.markChanged();
    const current = this.formSlots();
    if (current.includes(slot)) {
      this.formSlots.set(current.filter((s) => s !== slot));
    } else {
      this.formSlots.set([...current, slot]);
    }
  }

  toggleDay(day: number): void {
    this.markChanged();
    const current = this.formDays();
    if (current.includes(day)) {
      this.formDays.set(current.filter((d) => d !== day));
    } else {
      this.formDays.set([...current, day]);
    }
  }

  addOption(): void {
    this.markChanged();
    this.formOptions.set([
      ...this.formOptions(),
      {
        id: `opt-${Date.now()}`,
        name: '',
        priceFcfa: 0
      }
    ]);
  }

  removeOption(index: number): void {
    this.markChanged();
    const list = [...this.formOptions()];
    list.splice(index, 1);
    this.formOptions.set(list);
  }

  createInlineCategory(): void {
    const name = this.inlineNewCategoryName().trim();
    if (!name) return;
    const cat = this.menuService.createCategory(name);
    this.formCategoryId.set(cat.id);
    this.inlineNewCategoryName.set('');
    this.showInlineNewCategory.set(false);
    this.markChanged();
  }

  // ==========================================
  // GESTION DES PHOTOS
  // ==========================================

  async onPhotoFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    await this.processSelectedPhoto(file);
    input.value = '';
  }

  async onPhotoDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    await this.processSelectedPhoto(file);
  }

  onPhotoDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  async processSelectedPhoto(file: File): Promise<void> {
    this.photoError.set(null);
    this.isProcessingPhoto.set(true);

    try {
      const validation = await validateImageFile(file);
      if (!validation.valid && validation.error) {
        this.photoError.set(validation.error.message);
        this.isProcessingPhoto.set(false);
        return;
      }

      const processed = await processAndOptimizeImage(file);
      // Stockage local IndexedDB et prévisualisation
      const dishId = this.editingDishId() || `temp-${Date.now()}`;
      const savedUrl = await this.photoStorage.saveDishPhoto(dishId, processed);

      this.formPhotoUrl.set(savedUrl);
      this.markChanged();
    } catch (err: any) {
      this.photoError.set(err.message || 'Erreur lors du traitement de la photo.');
    } finally {
      this.isProcessingPhoto.set(false);
    }
  }

  removePhoto(): void {
    this.formPhotoUrl.set(null);
    this.photoError.set(null);
    this.markChanged();
  }

  saveDish(): void {
    if (!this.isFormValid()) return;

    const dishData = {
      name: this.formName().trim(),
      description: this.formDescription().trim(),
      categoryId: this.formCategoryId(),
      priceFcfa: Math.round(this.formPrice()),
      halfPortionPriceFcfa: this.formHalfPortionPrice() ? Math.round(this.formHalfPortionPrice()!) : undefined,
      tags: this.formTags(),
      allergens: this.formAllergens(),
      prepTimeMinutes: this.formPrepTime(),
      prepStation: this.formPrepStation(),
      availability: {
        type: this.formAvailabilityType(),
        slots: this.formAvailabilityType() === 'SLOTS' ? this.formSlots() : undefined,
        days: this.formAvailabilityType() === 'SLOTS' ? this.formDays() : undefined
      },
      options: this.formOptions().filter((o) => o.name.trim().length > 0),
      displayOrder: this.formDisplayOrder(),
      photoUrl: this.formPhotoUrl() || undefined
    };

    if (this.isEditing() && this.editingDishId()) {
      this.menuService.updateDish(this.editingDishId()!, dishData);
    } else {
      this.menuService.addDish(dishData);
    }

    this.hasUnsavedChanges.set(false);
    this.activeTab.set('LIST');
  }

  // ==========================================
  // ACTIONS RAPIDES LISTE
  // ==========================================

  duplicateDish(dish: DishItem): void {
    this.menuService.duplicateDish(dish.id);
  }

  toggleSoldOut(dish: DishItem): void {
    this.menuService.toggleSoldOut(dish.id);
  }

  confirmArchiveDish(dish: DishItem): void {
    this.confirmAction.set({
      title: 'Archiver le plat',
      message: `Êtes-vous sûr de vouloir archiver « ${dish.name} » ? Le plat ne sera plus affiché sur la caisse mais restera conservé pour l'historique comptable.`,
      confirmText: 'Archiver',
      cancelText: 'Annuler',
      onConfirm: () => {
        this.menuService.archiveDish(dish.id);
        this.confirmAction.set(null);
      }
    });
  }

  restoreDish(dish: DishItem): void {
    this.menuService.restoreDish(dish.id);
  }

  // ==========================================
  // GESTION CATÉGORIES
  // ==========================================

  addCategory(): void {
    const name = this.newCategoryName().trim();
    if (!name) return;
    this.menuService.createCategory(name);
    this.newCategoryName.set('');
  }

  renameCategory(cat: DishCategory, newName: string): void {
    const clean = newName.trim();
    if (!clean || clean === cat.name) return;
    this.menuService.renameCategory(cat.id, clean);
  }

  moveCategory(index: number, direction: 'up' | 'down'): void {
    const cats = [...this.menuService.categories()];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= cats.length) return;

    const temp = cats[index];
    cats[index] = cats[targetIdx];
    cats[targetIdx] = temp;

    this.menuService.reorderCategories(cats.map((c) => c.id));
  }

  archiveCategory(cat: DishCategory): void {
    this.confirmAction.set({
      title: 'Archiver la catégorie',
      message: `Voulez-vous archiver la catégorie « ${cat.name} » ? Les catégories ne peuvent être supprimées définitivement si elles contiennent des plats.`,
      confirmText: 'Archiver',
      cancelText: 'Annuler',
      onConfirm: () => {
        this.menuService.archiveCategory(cat.id);
        this.confirmAction.set(null);
      }
    });
  }

  // ==========================================
  // IMPORT / EXPORT CSV & EXCEL
  // ==========================================

  exportCsv(): void {
    this.menuService.downloadMenuExport('csv');
  }

  exportExcel(): void {
    this.menuService.downloadMenuExport('excel');
  }

  async onCsvFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    await this.processCsvFile(file);
    input.value = '';
  }

  async onCsvDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0) return;
    const file = event.dataTransfer.files[0];
    await this.processCsvFile(file);
  }

  async processCsvFile(file: File): Promise<void> {
    this.csvFileName.set(file.name);
    const content = await file.text();
    const report = this.menuService.parseAndValidateCsv(content, file.size);
    this.csvReport.set(report);
  }

  applyCsvImport(): void {
    const report = this.csvReport();
    if (!report || report.validRows.length === 0) return;

    this.isImportingCsv.set(true);
    this.menuService.commitCsvImport(report.validRows);
    this.isImportingCsv.set(false);
    this.csvReport.set(null);
    this.csvFileName.set(null);
    this.activeTab.set('LIST');
  }

  cancelCsvImport(): void {
    this.csvReport.set(null);
    this.csvFileName.set(null);
  }

  formatFcfa(amount: number): string {
    const clean = Math.round(amount || 0);
    return clean.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }
}
