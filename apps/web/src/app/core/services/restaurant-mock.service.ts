import { Injectable, computed, inject, signal } from '@angular/core';
import {
  DishCategory,
  DishItem,
  OrderTicketItem
} from '@residence-blue/shared';
import { HotelSettingsService } from './hotel-settings.service';

@Injectable({
  providedIn: 'root'
})
export class RestaurantMockService {
  private readonly hotelSettingsService: HotelSettingsService;

  constructor(hotelSettingsService?: HotelSettingsService) {
    let injected: HotelSettingsService | null = null;
    try {
      if (typeof inject === 'function') {
        injected = inject(HotelSettingsService, { optional: true });
      }
    } catch {
      // Ignorer si hors contexte d'injection
    }
    this.hotelSettingsService = hotelSettingsService ?? injected ?? new HotelSettingsService();
  }

  // Catégories de plats
  private readonly _categories = signal<DishCategory[]>([
    { id: 'cat-1', name: 'Plats sénégalais & Mer', icon: 'dinner_dining', displayOrder: 1, isArchived: false, itemCount: 5 },
    { id: 'cat-2', name: 'Boissons & Cocktails', icon: 'local_bar', displayOrder: 2, isArchived: false, itemCount: 2 },
    { id: 'cat-3', name: 'Desserts Teranga', icon: 'icecream', displayOrder: 3, isArchived: false, itemCount: 1 },
    { id: 'cat-4', name: 'Petit-déjeuner', icon: 'bakery_dining', displayOrder: 4, isArchived: false, itemCount: 0 },
    { id: 'cat-5', name: 'Entrées & Tapas', icon: 'tapas', displayOrder: 5, isArchived: false, itemCount: 0 }
  ]);
  readonly categories = this._categories.asReadonly();

  // Catalogue de plats (données initiales adaptées Thiès)
  private readonly _dishes = signal<DishItem[]>([
    {
      id: 'dish-1',
      name: 'Thiéboudienne Royale',
      description: 'Riz rouge traditionnel Penda Mbaye, mérou blanc frais de Somone, légumes mijotés, gueye & tamarin.',
      categoryId: 'cat-1',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 4500,
      tags: ['LOCAL_SPECIALTY'],
      allergens: ['FISH'],
      prepTimeMinutes: 25,
      prepStation: 'CUISINE',
      availability: { type: 'ALWAYS' },
      options: [
        { id: 'opt-1-1', name: 'Piment frais à part', priceFcfa: 0 },
        { id: 'opt-1-2', name: 'Supplément riz rouge', priceFcfa: 1000 }
      ],
      vatRatePercent: 10,
      displayOrder: 1,
      photoUrl: 'assets/images/restaurant/thieboudienne.jpg',
      status: 'AVAILABLE'
    },
    {
      id: 'dish-2',
      name: 'Yassa Poulet Fermier',
      description: 'Poulet fermier mariné au citron vert de Casamance, oignons doux caramélisés et riz blanc parfumé.',
      categoryId: 'cat-1',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 4000,
      tags: ['POPULAR'],
      allergens: ['MUSTARD'],
      prepTimeMinutes: 20,
      prepStation: 'CUISINE',
      availability: { type: 'ALWAYS' },
      options: [
        { id: 'opt-2-1', name: 'Sauce oignons extra', priceFcfa: 500 }
      ],
      vatRatePercent: 10,
      displayOrder: 2,
      photoUrl: 'assets/images/restaurant/yassa.jpg',
      status: 'AVAILABLE'
    },
    {
      id: 'dish-3',
      name: 'Poisson Grillé du Jour',
      description: 'Thiof ou Capitaine au feu de bois, sauce braisée pimentée douce, accompagnement aloco & attiéké.',
      categoryId: 'cat-1',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 6000,
      tags: ['LOCAL_SPECIALTY'],
      allergens: ['FISH'],
      prepTimeMinutes: 30,
      prepStation: 'CUISINE',
      availability: { type: 'ALWAYS' },
      options: [
        { id: 'opt-3-1', name: 'Accompagnement Aloco', priceFcfa: 0 },
        { id: 'opt-3-2', name: 'Accompagnement Attiéké', priceFcfa: 0 }
      ],
      vatRatePercent: 10,
      displayOrder: 3,
      photoUrl: 'assets/images/restaurant/poisson-grille.jpg',
      status: 'SOLD_OUT'
    },
    {
      id: 'dish-4',
      name: 'Jus de Bissap Maison',
      description: "Infusion fraîche de fleurs d'hibiscus bio, menthe du jardin côtier et subtile pointe de vanille bourbon.",
      categoryId: 'cat-2',
      categoryName: 'Boissons & Cocktails',
      priceFcfa: 1500,
      tags: ['POPULAR'],
      allergens: [],
      prepTimeMinutes: 5,
      prepStation: 'BAR',
      availability: { type: 'ALWAYS' },
      options: [],
      vatRatePercent: 10,
      displayOrder: 4,
      photoUrl: 'assets/images/restaurant/bissap.jpg',
      status: 'AVAILABLE'
    },
    {
      id: 'dish-5',
      name: 'Mafé de Bœuf Fondant',
      description: "Sauce pâte d'arachide dakaroise onctueuse, mijoté de bœuf tendre, légumes du potager et riz brisé.",
      categoryId: 'cat-1',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 4500,
      tags: [],
      allergens: ['PEANUT'],
      prepTimeMinutes: 25,
      prepStation: 'CUISINE',
      availability: { type: 'ALWAYS' },
      options: [],
      vatRatePercent: 10,
      displayOrder: 5,
      photoUrl: 'assets/images/restaurant/mafe.jpg',
      status: 'AVAILABLE'
    },
    {
      id: 'dish-6',
      name: 'Cocktail Saloum Sunset',
      description: 'Rhum ambré, purée de mangue fraîche, nectar de bouye (pain de singe) et infusion de citronnelle.',
      categoryId: 'cat-2',
      categoryName: 'Boissons & Cocktails',
      priceFcfa: 3500,
      tags: ['SIGNATURE_BAR'],
      allergens: [],
      prepTimeMinutes: 5,
      prepStation: 'BAR',
      availability: { type: 'ALWAYS' },
      options: [],
      vatRatePercent: 10,
      displayOrder: 6,
      photoUrl: 'assets/images/restaurant/saloum-sunset.jpg',
      status: 'AVAILABLE'
    },
    {
      id: 'dish-7',
      name: 'Crevettes Sautées à l’Ail',
      description: 'Gambas de Somone sautées persillade minute, frites croustillantes de patate douce et mayonnaise pimentée.',
      categoryId: 'cat-1',
      categoryName: 'Plats sénégalais & Mer',
      priceFcfa: 6500,
      tags: [],
      allergens: ['CRUSTACEAN', 'EGG'],
      prepTimeMinutes: 15,
      prepStation: 'CUISINE',
      availability: { type: 'ALWAYS' },
      options: [],
      vatRatePercent: 10,
      displayOrder: 7,
      photoUrl: 'assets/images/restaurant/crevettes.jpg',
      status: 'AVAILABLE'
    },
    {
      id: 'dish-8',
      name: 'Thiakry & Mangue Rôtie',
      description: "Couscous de mil fin au yaourt onctueux parfumé à la muscade, fleur d'oranger et mangues caramélisées.",
      categoryId: 'cat-3',
      categoryName: 'Desserts Teranga',
      priceFcfa: 2500,
      tags: [],
      allergens: ['MILK'],
      prepTimeMinutes: 10,
      prepStation: 'PATISSERIE',
      availability: { type: 'ALWAYS' },
      options: [],
      vatRatePercent: 10,
      displayOrder: 8,
      photoUrl: 'assets/images/restaurant/thiakry.jpg',
      status: 'AVAILABLE'
    }
  ]);
  readonly dishes = this._dishes.asReadonly();

  // Filtres actifs
  readonly activeCategoryId = signal<string>('cat-1');
  readonly searchQuery = signal<string>('');
  readonly activeTagFilter = signal<string | null>(null);

  // Plats filtrés affichés dans le catalogue
  readonly filteredDishes = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const catId = this.activeCategoryId();
    const tag = this.activeTagFilter();

    return this._dishes().filter(dish => {
      // Les plats archivés n'apparaissent jamais sur la caisse
      if (dish.status === 'ARCHIVED') return false;

      // Filtre catégorie
      if (catId && dish.categoryId !== catId) return false;

      // Filtre tag secondaire
      if (tag === 'SPECIALTY' && !dish.tags.includes('LOCAL_SPECIALTY')) return false;
      if (tag === 'POPULAR' && !dish.tags.includes('POPULAR')) return false;
      if (tag === 'VEGETARIAN' && !dish.tags.includes('VEGETARIAN')) return false;

      // Recherche textuelle
      if (q) {
        const matchName = dish.name.toLowerCase().includes(q);
        const matchDesc = dish.description.toLowerCase().includes(q);
        return matchName || matchDesc;
      }

      return true;
    });
  });

  // Ticket de commande actif
  private readonly _ticketItems = signal<OrderTicketItem[]>([
    {
      id: 'item-1',
      dishId: 'dish-1',
      name: 'Thiéboudienne Royale',
      quantity: 1,
      unitPriceFcfa: 4500,
      totalPriceFcfa: 4500,
      prepStation: 'CUISINE'
    },
    {
      id: 'item-2',
      dishId: 'dish-3',
      name: 'Poisson Grillé du Jour',
      quantity: 1,
      unitPriceFcfa: 6000,
      totalPriceFcfa: 6000,
      selectedOptions: ['Aloco'],
      notes: 'Bien grillé, piment à part',
      prepStation: 'CUISINE'
    },
    {
      id: 'item-3',
      dishId: 'dish-4',
      name: 'Jus de Bissap Maison',
      quantity: 2,
      unitPriceFcfa: 1500,
      totalPriceFcfa: 3000,
      prepStation: 'BAR'
    },
    {
      id: 'item-4',
      dishId: 'dish-6',
      name: 'Cocktail Saloum Sunset',
      quantity: 1,
      unitPriceFcfa: 3500,
      totalPriceFcfa: 3500,
      prepStation: 'BAR'
    }
  ]);
  readonly ticketItems = this._ticketItems.asReadonly();

  // Métadonnées du ticket
  readonly destinationType = signal<'TABLE' | 'ROOM'>('TABLE');
  readonly selectedTable = signal<string>('T4 (Piscine)');
  readonly serverName = signal<string>('Moussa Fall');
  readonly ticketNumber = signal<string>('#CMD-0428');

  // Client rattaché (Chambre 301)
  readonly linkedGuest = signal({
    roomNumber: '301',
    roomName: 'Chambre 301 — Suite Panoramique',
    guestName: 'M. Mamadou Diop',
    vipTier: 'VIP Gold'
  });

  // Totaux financiers réactifs
  readonly ticketTotalTtcFcfa = computed(() => {
    return this._ticketItems().reduce((acc, it) => acc + it.totalPriceFcfa, 0);
  });

  readonly ticketSubtotalHtFcfa = computed(() => {
    const vatRate = this.hotelSettingsService.settings().vatRatePercent / 100;
    return Math.round(this.ticketTotalTtcFcfa() / (1 + vatRate));
  });

  readonly ticketVatAmountFcfa = computed(() => {
    return this.ticketTotalTtcFcfa() - this.ticketSubtotalHtFcfa();
  });

  // Actions métier sur le ticket
  addDishToTicket(dish: DishItem): void {
    // Si le plat est épuisé, action bloquée
    if (dish.status === 'SOLD_OUT') return;

    this._ticketItems.update(items => {
      const existingIdx = items.findIndex(it => it.dishId === dish.id);
      if (existingIdx >= 0) {
        const existing = items[existingIdx];
        const updated = [...items];
        const newQty = existing.quantity + 1;
        updated[existingIdx] = {
          ...existing,
          quantity: newQty,
          totalPriceFcfa: newQty * existing.unitPriceFcfa
        };
        return updated;
      }

      return [
        ...items,
        {
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          dishId: dish.id,
          name: dish.name,
          quantity: 1,
          unitPriceFcfa: dish.priceFcfa,
          totalPriceFcfa: dish.priceFcfa,
          prepStation: dish.prepStation
        }
      ];
    });
  }

  incrementItem(itemId: string): void {
    this._ticketItems.update(items =>
      items.map(it => {
        if (it.id === itemId) {
          const newQty = it.quantity + 1;
          return { ...it, quantity: newQty, totalPriceFcfa: newQty * it.unitPriceFcfa };
        }
        return it;
      })
    );
  }

  decrementItem(itemId: string): void {
    this._ticketItems.update(items => {
      const target = items.find(it => it.id === itemId);
      if (!target) return items;
      if (target.quantity <= 1) {
        return items.filter(it => it.id !== itemId);
      }
      return items.map(it => {
        if (it.id === itemId) {
          const newQty = it.quantity - 1;
          return { ...it, quantity: newQty, totalPriceFcfa: newQty * it.unitPriceFcfa };
        }
        return it;
      });
    });
  }

  clearTicket(): void {
    this._ticketItems.set([]);
  }

  setDestinationType(type: 'TABLE' | 'ROOM'): void {
    this.destinationType.set(type);
  }

  setSelectedTable(table: string): void {
    this.selectedTable.set(table);
  }

  setActiveCategory(catId: string): void {
    this.activeCategoryId.set(catId);
  }

  setSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  setTagFilter(tag: string | null): void {
    this.activeTagFilter.set(this.activeTagFilter() === tag ? null : tag);
  }

  // Fonctions de mutation du menu (utilisées par la gestion de menu)
  setDishes(dishes: DishItem[]): void {
    this._dishes.set(dishes);
  }

  setCategories(cats: DishCategory[]): void {
    this._categories.set(cats);
  }

  updateDishStatus(dishId: string, status: 'AVAILABLE' | 'SOLD_OUT' | 'ARCHIVED'): void {
    this._dishes.update(list =>
      list.map(d => (d.id === dishId ? { ...d, status } : d))
    );
  }

  addDish(dish: DishItem): void {
    this._dishes.update(list => [...list, dish]);
  }

  updateDish(dish: DishItem): void {
    this._dishes.update(list =>
      list.map(d => (d.id === dish.id ? dish : d))
    );
  }
}
