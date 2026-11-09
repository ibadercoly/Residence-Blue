import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import {
  Allergen,
  DishCategory,
  DishItem,
  DishOption,
  DishStatus,
  DishTag,
  MealSlot,
  PrepStation
} from '@residence-blue/shared';
import { RestaurantMockService } from './restaurant-mock.service';
import { HotelSettingsService } from './hotel-settings.service';
import { PhotoStorageService } from './photo-storage.service';

export interface CsvImportError {
  line: number;
  field: string;
  value: string;
  message: string;
}

export interface CsvImportRow {
  line: number;
  name: string;
  categoryName: string;
  priceFcfa: number;
  halfPortionPriceFcfa?: number;
  status: DishStatus;
  description: string;
  prepStation: PrepStation;
  tags: DishTag[];
  allergens: Allergen[];
  options: DishOption[];
  isValid: boolean;
  errors: string[];
}

export interface CsvValidationReport {
  success: boolean;
  isValid: boolean;
  totalLines: number;
  totalRows: number;
  validRows: CsvImportRow[];
  errors: CsvImportError[];
  errorRows: { lineNumber: number; errors: string[]; rawLine?: string }[];
  globalErrors: string[];
  rejectionReason?: string;
}

@Injectable({
  providedIn: 'root'
})
export class MenuManagementService {
  private readonly restaurantService: RestaurantMockService;
  private readonly hotelSettings: HotelSettingsService;
  private readonly photoStorage: PhotoStorageService;

  // Filtres actifs pour la table d'administration
  readonly filterCategory = signal<string>('ALL');
  readonly filterStatus = signal<string>('ALL');
  readonly searchQuery = signal<string>('');
  readonly sortBy = signal<'name' | 'price' | 'order'>('order');
  readonly sortDirection = signal<'asc' | 'desc'>('asc');

  // Signaux réactifs initialisés dans le constructeur
  readonly categories: Signal<DishCategory[]>;
  readonly allDishes: Signal<DishItem[]>;
  readonly defaultVatRate: Signal<number>;
  readonly managedDishes: Signal<DishItem[]>;
  readonly filteredDishes: Signal<DishItem[]>;
  readonly categoryFilter = this.filterCategory;
  readonly statusFilter = this.filterStatus;

  constructor(
    restaurantService?: RestaurantMockService,
    hotelSettings?: HotelSettingsService,
    photoStorage?: PhotoStorageService
  ) {
    const safeInject = <T>(token: any, fallback: () => T): T => {
      try {
        if (typeof inject === 'function') {
          const val = inject(token, { optional: true });
          if (val) return val as T;
        }
      } catch {
        // Ignorer si hors contexte d'injection Angular
      }
      return fallback();
    };

    this.restaurantService =
      restaurantService ?? safeInject(RestaurantMockService, () => new RestaurantMockService());
    this.hotelSettings =
      hotelSettings ?? safeInject(HotelSettingsService, () => new HotelSettingsService());
    this.photoStorage =
      photoStorage ?? safeInject(PhotoStorageService, () => new PhotoStorageService());

    this.categories = this.restaurantService.categories;
    this.allDishes = this.restaurantService.dishes;

    this.defaultVatRate = computed(() => {
      return this.hotelSettings.settings().vatRatePercent;
    });

    this.managedDishes = computed(() => {
      const dishes = this.allDishes();
      const cat = this.filterCategory();
      const stat = this.filterStatus();
      const query = this.searchQuery().trim().toLowerCase();
      const sort = this.sortBy();
      const dir = this.sortDirection();

      return dishes
        .filter((d) => {
          if (cat !== 'ALL' && d.categoryId !== cat) return false;
          if (stat !== 'ALL' && d.status !== stat) return false;
          if (query) {
            const matchName = d.name.toLowerCase().includes(query);
            const matchDesc = d.description.toLowerCase().includes(query);
            const matchCat = d.categoryName.toLowerCase().includes(query);
            return matchName || matchDesc || matchCat;
          }
          return true;
        })
        .sort((a, b) => {
          let cmp = 0;
          if (sort === 'name') {
            cmp = a.name.localeCompare(b.name, 'fr');
          } else if (sort === 'price') {
            cmp = a.priceFcfa - b.priceFcfa;
          } else {
            cmp = a.displayOrder - b.displayOrder;
          }
          return dir === 'asc' ? cmp : -cmp;
        });
    });

    this.filteredDishes = this.managedDishes;
  }

  setSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  setCategoryFilter(cat: string): void {
    this.filterCategory.set(cat);
  }

  setStatusFilter(status: string): void {
    this.filterStatus.set(status);
  }

  setSortBy(sort: 'name' | 'price' | 'order'): void {
    this.sortBy.set(sort);
  }

  getCategoryName(id: string): string {
    const cat = this.categories().find((c) => c.id === id);
    return cat ? cat.name : 'Sans catégorie';
  }

  getDishCountByCategory(id: string): number {
    return this.allDishes().filter(
      (d) => d.categoryId === id && d.status !== 'ARCHIVED'
    ).length;
  }

  // ==========================================
  // GESTION DES PLATS (CRUD)
  // ==========================================

  /**
   * Vérifie si un nom de plat est déjà pris (insensible à la casse / trim).
   */
  isDishNameTaken(name: string, excludeId?: string): boolean {
    const clean = name.trim().toLowerCase();
    return this.allDishes().some(
      (d) => d.id !== excludeId && d.name.trim().toLowerCase() === clean
    );
  }

  /**
   * Ajoute un nouveau plat au menu.
   */
  addDish(dishData: {
    name: string;
    description: string;
    categoryId: string;
    priceFcfa: number;
    halfPortionPriceFcfa?: number;
    tags?: DishTag[];
    allergens?: Allergen[];
    prepTimeMinutes?: number;
    prepStation?: PrepStation;
    availability?: { type: 'ALWAYS' | 'SLOTS'; slots?: MealSlot[]; days?: number[] };
    options?: DishOption[];
    displayOrder?: number;
    photoUrl?: string;
  }): { success: boolean; error?: string; dish?: DishItem } {
    const cleanName = dishData.name.trim();

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      return { success: false, error: 'Le nom du plat doit comporter entre 2 et 80 caractères.' };
    }

    if (this.isDishNameTaken(cleanName)) {
      return { success: false, error: `Un plat nommé « ${cleanName} » existe déjà dans le menu.` };
    }

    if (dishData.priceFcfa < 0 || dishData.priceFcfa > 1000000 || !Number.isInteger(dishData.priceFcfa)) {
      return { success: false, error: 'Le prix doit être un entier positif inférieur ou égal à 1 000 000 FCFA.' };
    }

    const category = this.categories().find((c) => c.id === dishData.categoryId);
    if (!category) {
      return { success: false, error: 'La catégorie sélectionnée est introuvable.' };
    }

    const newDish: DishItem = {
      id: `dish-${crypto.randomUUID()}`,
      name: cleanName,
      description: dishData.description.trim().slice(0, 300),
      categoryId: category.id,
      categoryName: category.name,
      priceFcfa: Math.round(dishData.priceFcfa),
      halfPortionPriceFcfa: dishData.halfPortionPriceFcfa ? Math.round(dishData.halfPortionPriceFcfa) : undefined,
      tags: dishData.tags || [],
      allergens: dishData.allergens || [],
      prepTimeMinutes: dishData.prepTimeMinutes || 15,
      prepStation: dishData.prepStation || 'CUISINE',
      availability: dishData.availability || { type: 'ALWAYS' },
      options: dishData.options || [],
      vatRatePercent: this.defaultVatRate(),
      displayOrder: dishData.displayOrder || this.allDishes().length + 1,
      photoUrl: dishData.photoUrl,
      status: 'AVAILABLE'
    };

    this.restaurantService.addDish(newDish);
    this.refreshCategoryCounts();
    return { success: true, dish: newDish };
  }

  /**
   * Modifie un plat existant.
   */
  updateDish(
    id: string,
    dishData: Partial<DishItem>
  ): { success: boolean; error?: string; dish?: DishItem } {
    const existing = this.allDishes().find((d) => d.id === id);
    if (!existing) {
      return { success: false, error: 'Plat introuvable.' };
    }

    if (dishData.name !== undefined) {
      const cleanName = dishData.name.trim();
      if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
        return { success: false, error: 'Le nom du plat doit comporter entre 2 et 80 caractères.' };
      }
      if (this.isDishNameTaken(cleanName, id)) {
        return { success: false, error: `Un plat nommé « ${cleanName} » existe déjà.` };
      }
    }

    if (dishData.priceFcfa !== undefined) {
      if (dishData.priceFcfa < 0 || dishData.priceFcfa > 1000000 || !Number.isInteger(dishData.priceFcfa)) {
        return { success: false, error: 'Le prix doit être un entier positif inférieur ou égal à 1 000 000 FCFA.' };
      }
    }

    let catName = existing.categoryName;
    if (dishData.categoryId && dishData.categoryId !== existing.categoryId) {
      const cat = this.categories().find((c) => c.id === dishData.categoryId);
      if (cat) catName = cat.name;
    }

    const updatedDish: DishItem = {
      ...existing,
      ...dishData,
      id,
      name: dishData.name !== undefined ? dishData.name.trim() : existing.name,
      description: dishData.description !== undefined ? dishData.description.trim().slice(0, 300) : existing.description,
      categoryName: catName,
      priceFcfa: dishData.priceFcfa !== undefined ? Math.round(dishData.priceFcfa) : existing.priceFcfa,
      halfPortionPriceFcfa: dishData.halfPortionPriceFcfa !== undefined
        ? (dishData.halfPortionPriceFcfa ? Math.round(dishData.halfPortionPriceFcfa) : undefined)
        : existing.halfPortionPriceFcfa,
      vatRatePercent: this.defaultVatRate()
    };

    this.restaurantService.updateDish(updatedDish);
    this.refreshCategoryCounts();
    return { success: true, dish: updatedDish };
  }

  /**
   * Duplique un plat existant (nouveau UUID, statut AVAILABLE, nom avec " (copie)").
   */
  duplicateDish(id: string): DishItem {
    const original = this.allDishes().find((d) => d.id === id);
    if (!original) throw new Error('Plat à dupliquer introuvable.');

    let baseCopyName = `${original.name} (copie)`;
    let counter = 2;
    while (this.isDishNameTaken(baseCopyName)) {
      baseCopyName = `${original.name} (copie ${counter})`;
      counter++;
    }

    const copyDish: DishItem = {
      ...original,
      id: `dish-${crypto.randomUUID()}`,
      name: baseCopyName,
      displayOrder: this.allDishes().length + 1,
      status: 'AVAILABLE'
    };

    this.restaurantService.addDish(copyDish);
    this.refreshCategoryCounts();
    return copyDish;
  }

  /**
   * Bascule le statut Épuisé en 1 clic (AVAILABLE <-> SOLD_OUT).
   */
  toggleSoldOut(id: string): void {
    const dish = this.allDishes().find((d) => d.id === id);
    if (!dish) return;
    const newStatus: DishStatus = dish.status === 'SOLD_OUT' ? 'AVAILABLE' : 'SOLD_OUT';
    this.restaurantService.updateDishStatus(id, newStatus);
  }

  /**
   * Archive un plat (ne supprime jamais définitivement pour conserver l'historique des commandes).
   */
  archiveDish(id: string): void {
    this.restaurantService.updateDishStatus(id, 'ARCHIVED');
    this.refreshCategoryCounts();
  }

  /**
   * Restaure un plat archivé en AVAILABLE.
   */
  restoreDish(id: string): void {
    this.restaurantService.updateDishStatus(id, 'AVAILABLE');
    this.refreshCategoryCounts();
  }

  // ==========================================
  // GESTION DES CATÉGORIES
  // ==========================================

  /**
   * Crée une nouvelle catégorie à la volée.
   */
  createCategory(name: string, icon = 'restaurant'): DishCategory {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Le nom de la catégorie est obligatoire.');

    const newCat: DishCategory = {
      id: `cat-${crypto.randomUUID().slice(0, 8)}`,
      name: cleanName,
      icon,
      displayOrder: this.categories().length + 1,
      isArchived: false,
      itemCount: 0
    };

    this.restaurantService.setCategories([...this.categories(), newCat]);
    return newCat;
  }

  /**
   * Renomme ou met à jour une catégorie.
   */
  renameCategory(id: string, name: string, icon?: string): void {
    const cleanName = name.trim();
    if (!cleanName) throw new Error('Le nom de la catégorie ne peut être vide.');

    const updated = this.categories().map((cat) => {
      if (cat.id === id) {
        return {
          ...cat,
          name: cleanName,
          icon: icon || cat.icon
        };
      }
      return cat;
    });

    this.restaurantService.setCategories(updated);

    // Mettre à jour categoryName sur tous les plats associés
    const updatedDishes = this.allDishes().map((dish) => {
      if (dish.categoryId === id) {
        return { ...dish, categoryName: cleanName };
      }
      return dish;
    });
    this.restaurantService.setDishes(updatedDishes);
  }

  /**
   * Réordonne la liste des catégories.
   */
  reorderCategories(orderedIds: string[]): void {
    const updated = orderedIds
      .map((id, index) => {
        const cat = this.categories().find((c) => c.id === id);
        return cat ? { ...cat, displayOrder: index + 1 } : null;
      })
      .filter((c): c is DishCategory => c !== null);

    this.restaurantService.setCategories(updated);
  }

  /**
   * Archive une catégorie. Règle absolue : Une catégorie non vide ne peut pas être supprimée, seulement archivée.
   */
  archiveCategory(id: string): { success: boolean; error?: string } {
    const activeDishesInCat = this.allDishes().filter(
      (d) => d.categoryId === id && d.status !== 'ARCHIVED'
    );

    const updated = this.categories().map((c) => (c.id === id ? { ...c, isArchived: true } : c));
    this.restaurantService.setCategories(updated);

    if (activeDishesInCat.length > 0) {
      return {
        success: true,
        error: `La catégorie a été archivée. Note : elle contient ${activeDishesInCat.length} plat(s) actif(s).`
      };
    }

    return { success: true };
  }

  private refreshCategoryCounts(): void {
    const dishes = this.allDishes();
    const updatedCats = this.categories().map((cat) => {
      const count = dishes.filter((d) => d.categoryId === cat.id && d.status !== 'ARCHIVED').length;
      return { ...cat, itemCount: count };
    });
    this.restaurantService.setCategories(updatedCats);
  }

  // ==========================================
  // EXPORT CSV & EXCEL (AVEC SÉCURISATION FORMULES)
  // ==========================================

  /**
   * Neutralise les cellules commençant par =, +, -, @ (protection contre l'injection de formules / CSV Injection).
   */
  sanitizeForCsv(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '""';
    const str = String(value);

    // Si commence par un caractère d'injection de formule, préfixer avec un apostrophe
    if (/^[=+\-@]/.test(str)) {
      const sanitized = "'" + str;
      return `"${sanitized.replace(/"/g, '""')}"`;
    }

    return `"${str.replace(/"/g, '""')}"`;
  }

  /**
   * Génère le flux CSV du menu.
   */
  generateMenuCsv(): string {
    const headers = [
      'Nom',
      'Catégorie',
      'Prix FCFA',
      'Demi-portion FCFA',
      'Statut',
      'Poste',
      'Description',
      'Étiquettes',
      'Allergènes'
    ];

    const rows = this.allDishes().map((d) => [
      this.sanitizeForCsv(d.name),
      this.sanitizeForCsv(d.categoryName),
      this.sanitizeForCsv(d.priceFcfa),
      this.sanitizeForCsv(d.halfPortionPriceFcfa || ''),
      this.sanitizeForCsv(d.status),
      this.sanitizeForCsv(d.prepStation),
      this.sanitizeForCsv(d.description),
      this.sanitizeForCsv(d.tags.join('; ')),
      this.sanitizeForCsv(d.allergens.join('; '))
    ]);

    // UTF-8 BOM pour compatibilité Excel
    return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  }

  /**
   * Déclenche le téléchargement du fichier CSV ou Excel.
   */
  downloadMenuExport(format: 'csv' | 'excel'): void {
    const csvContent = this.generateMenuCsv();
    const mimeType = format === 'excel' ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8';
    const extension = format === 'excel' ? 'xls' : 'csv';
    const blob = new Blob([csvContent], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `menu_la_teranga_${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ==========================================
  // IMPORT CSV (VALIDATION STRICTE < 2 Mo, 500 LIGNES)
  // ==========================================

  /**
   * Valide et prévisualise un fichier CSV d'importation de menu.
   */
  parseAndValidateCsv(content: string, fileSizeBytes: number): CsvValidationReport {
    // 1. Contrôle taille < 2 Mo
    if (fileSizeBytes > 2 * 1024 * 1024) {
      const msg = 'Le fichier dépasse la limite de 2 Mo. Importation refusée.';
      return {
        success: false,
        isValid: false,
        totalLines: 0,
        totalRows: 0,
        validRows: [],
        errors: [],
        errorRows: [],
        globalErrors: [msg],
        rejectionReason: msg
      };
    }

    // Retirer le BOM si présent
    const cleanContent = content.startsWith('\uFEFF') ? content.slice(1) : content;
    const rawLines = cleanContent.split(/\r?\n/).filter((l) => l.trim().length > 0);

    // 2. Contrôle max 500 lignes
    if (rawLines.length > 501) {
      // 1 entête + 500 données max
      const msg = `Le fichier comporte ${rawLines.length - 1} lignes de données. La limite maximale autorisée est de 500 lignes.`;
      return {
        success: false,
        isValid: false,
        totalLines: rawLines.length,
        totalRows: rawLines.length - 1,
        validRows: [],
        errors: [],
        errorRows: [],
        globalErrors: [msg],
        rejectionReason: msg
      };
    }

    if (rawLines.length <= 1) {
      const msg = 'Le fichier CSV est vide ou ne contient aucune ligne de données.';
      return {
        success: false,
        isValid: false,
        totalLines: rawLines.length,
        totalRows: 0,
        validRows: [],
        errors: [],
        errorRows: [],
        globalErrors: [msg],
        rejectionReason: msg
      };
    }

    const errors: CsvImportError[] = [];
    const validRows: CsvImportRow[] = [];

    // Analyse ligne par ligne (à partir de la ligne 2)
    for (let i = 1; i < rawLines.length; i++) {
      const lineNum = i + 1;
      const line = rawLines[i];
      const cols = this.parseCsvLine(line);

      const name = (cols[0] || '').trim();
      const catName = (cols[1] || '').trim();
      const priceStr = (cols[2] || '').trim();
      const halfPriceStr = (cols[3] || '').trim();
      const statusStr = (cols[4] || 'AVAILABLE').trim().toUpperCase();
      const stationStr = (cols[5] || 'CUISINE').trim().toUpperCase();
      const desc = (cols[6] || '').trim();

      const rowErrors: string[] = [];

      // Validation Nom
      if (!name || name.length < 2 || name.length > 80) {
        rowErrors.push('Nom manquant ou longueur invalide (doit avoir entre 2 et 80 caractères).');
        errors.push({
          line: lineNum,
          field: 'Nom',
          value: name,
          message: 'Nom obligatoire, de 2 à 80 caractères.'
        });
      }

      // Validation Prix
      const price = parseInt(priceStr, 10);
      if (isNaN(price) || price < 0 || price > 1000000) {
        rowErrors.push('Prix invalide (doit être un entier positif entre 0 et 1 000 000 FCFA).');
        errors.push({
          line: lineNum,
          field: 'Prix FCFA',
          value: priceStr,
          message: 'Prix entier invalide.'
        });
      }

      // Validation Demi-portion
      let halfPrice: number | undefined;
      if (halfPriceStr) {
        halfPrice = parseInt(halfPriceStr, 10);
        if (isNaN(halfPrice) || halfPrice < 0) {
          rowErrors.push('Prix demi-portion invalide.');
        }
      }

      // Validation Catégorie
      const knownCategory = this.categories().find(
        (c) => c.name.toLowerCase() === catName.toLowerCase()
      );
      const isNewCategory = !knownCategory && Boolean(catName);
      if (isNewCategory) {
        rowErrors.push(`Catégorie « ${catName} » nouvelle (créée à la volée).`);
      } else if (!catName) {
        rowErrors.push('Catégorie manquante.');
        errors.push({
          line: lineNum,
          field: 'Catégorie',
          value: catName,
          message: 'Catégorie obligatoire.'
        });
      }

      const isBlockingError = errors.some((e) => e.line === lineNum);

      let status: DishStatus = 'AVAILABLE';
      if (statusStr === 'SOLD_OUT' || statusStr === 'ARCHIVED') {
        status = statusStr;
      }

      let prepStation: PrepStation = 'CUISINE';
      if (stationStr === 'BAR' || stationStr === 'PATISSERIE') {
        prepStation = stationStr;
      }

      validRows.push({
        line: lineNum,
        name,
        categoryName: catName || 'Autre',
        priceFcfa: isNaN(price) ? 0 : price,
        halfPortionPriceFcfa: halfPrice,
        status,
        description: desc.slice(0, 300),
        prepStation,
        tags: [],
        allergens: [],
        options: [],
        isValid: !isBlockingError,
        errors: rowErrors
      });
    }

    const errorRowsMap = new Map<number, string[]>();
    for (const e of errors) {
      if (!errorRowsMap.has(e.line)) errorRowsMap.set(e.line, []);
      errorRowsMap.get(e.line)!.push(`${e.field}: ${e.message}`);
    }
    const errorRows = Array.from(errorRowsMap.entries()).map(([lineNumber, errs]) => ({
      lineNumber,
      errors: errs,
      rawLine: rawLines[lineNumber - 1] || ''
    }));

    return {
      success: errors.length === 0,
      isValid: errors.length === 0,
      totalLines: rawLines.length - 1,
      totalRows: rawLines.length - 1,
      validRows,
      errors,
      errorRows,
      globalErrors: []
    };
  }

  /**
   * Valide et importe définitivement les lignes valides.
   */
  commitCsvImport(rows: CsvImportRow[]): { importedCount: number } {
    let imported = 0;

    for (const r of rows) {
      if (!r.isValid) continue;

      // Trouver ou créer la catégorie
      let cat = this.categories().find(
        (c) => c.name.toLowerCase() === r.categoryName.toLowerCase()
      );
      if (!cat) {
        cat = this.createCategory(r.categoryName);
      }

      // Si le nom existe déjà, on met à jour, sinon on ajoute
      const existing = this.allDishes().find(
        (d) => d.name.toLowerCase() === r.name.toLowerCase()
      );

      if (existing) {
        this.updateDish(existing.id, {
          priceFcfa: r.priceFcfa,
          halfPortionPriceFcfa: r.halfPortionPriceFcfa,
          description: r.description,
          categoryId: cat.id,
          categoryName: cat.name,
          prepStation: r.prepStation,
          status: r.status
        });
      } else {
        this.addDish({
          name: r.name,
          description: r.description,
          categoryId: cat.id,
          priceFcfa: r.priceFcfa,
          halfPortionPriceFcfa: r.halfPortionPriceFcfa,
          prepStation: r.prepStation
        });
      }
      imported++;
    }

    this.refreshCategoryCounts();
    return { importedCount: imported };
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }
}
