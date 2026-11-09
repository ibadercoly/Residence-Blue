import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface KitchenTicket {
  id: string;
  orderNumber: string;
  destination: string; // Table 4 ou Suite 301
  createdAt: string;
  status: 'RECEIVED' | 'PREPARING' | 'READY';
  items: Array<{ name: string; quantity: number; notes?: string; station: 'CUISINE' | 'BAR' | 'PATISSERIE' }>;
}

@Component({
  selector: 'app-kitchen-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 max-w-7xl mx-auto font-['Manrope'] min-h-screen bg-[#f8fafc]">
      <!-- Header Écran Cuisine -->
      <div class="flex items-center justify-between pb-6 border-b border-stone-200 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
            <span class="material-symbols-outlined text-3xl">soup_kitchen</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-stone-900 tracking-tight">
              Écran Cuisine & Bar • La Teranga
            </h1>
            <p class="text-xs text-stone-500">
              Résidence Blue &bull; Commandes en cours de préparation en temps réel
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {{ pendingOrders().length }} commande(s) active(s)
          </span>

          <button
            type="button"
            (click)="refreshTickets()"
            class="h-11 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">refresh</span>
            Actualiser
          </button>
        </div>
      </div>

      <!-- Grille des Bons de Commande Cuisine -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <div
          *ngFor="let ticket of tickets()"
          class="bg-white rounded-2xl border shadow-sm flex flex-col justify-between overflow-hidden transition-all"
          [class.border-amber-300]="ticket.status === 'RECEIVED'"
          [class.border-blue-300]="ticket.status === 'PREPARING'"
          [class.border-emerald-300]="ticket.status === 'READY'"
        >
          <!-- Entête du Bon -->
          <div
            class="px-5 py-3 border-b flex items-center justify-between"
            [class.bg-amber-50]="ticket.status === 'RECEIVED'"
            [class.bg-blue-50]="ticket.status === 'PREPARING'"
            [class.bg-emerald-50]="ticket.status === 'READY'"
          >
            <div>
              <div class="flex items-center gap-2">
                <span class="font-mono font-bold text-sm text-stone-900">#{{ ticket.orderNumber }}</span>
                <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-white text-stone-800 border border-stone-200">
                  {{ ticket.destination }}
                </span>
              </div>
              <span class="text-[11px] text-stone-500">{{ ticket.createdAt }}</span>
            </div>

            <!-- Badge statut -->
            <span
              class="px-2.5 py-1 rounded-full text-xs font-bold"
              [class.bg-amber-200]="ticket.status === 'RECEIVED'"
              [class.text-amber-900]="ticket.status === 'RECEIVED'"
              [class.bg-blue-200]="ticket.status === 'PREPARING'"
              [class.text-blue-900]="ticket.status === 'PREPARING'"
              [class.bg-emerald-200]="ticket.status === 'READY'"
              [class.text-emerald-900]="ticket.status === 'READY'"
            >
              {{ statusLabels[ticket.status] }}
            </span>
          </div>

          <!-- Lignes du Bon -->
          <div class="p-5 flex-1 space-y-3">
            <div
              *ngFor="let item of ticket.items"
              class="flex items-start justify-between gap-3 pb-2 border-b border-stone-100 last:border-0"
            >
              <div class="flex items-start gap-2.5">
                <span class="w-7 h-7 rounded-lg bg-stone-100 font-mono font-bold text-stone-800 text-sm flex items-center justify-center shrink-0">
                  {{ item.quantity }}
                </span>
                <div>
                  <div class="text-sm font-bold text-stone-900 leading-snug">{{ item.name }}</div>
                  <div *ngIf="item.notes" class="text-xs text-amber-700 font-medium italic mt-0.5">
                    Note : {{ item.notes }}
                  </div>
                </div>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-600">
                {{ item.station }}
              </span>
            </div>
          </div>

          <!-- Bouton d'action Rapide (au moins 44px) -->
          <div class="p-4 bg-stone-50 border-t border-stone-200">
            <button
              *ngIf="ticket.status === 'RECEIVED'"
              type="button"
              (click)="updateStatus(ticket.id, 'PREPARING')"
              class="w-full h-11 rounded-xl bg-[#135bec] hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <span class="material-symbols-outlined text-lg">skillet</span>
              Lancer en préparation
            </button>

            <button
              *ngIf="ticket.status === 'PREPARING'"
              type="button"
              (click)="updateStatus(ticket.id, 'READY')"
              class="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm cursor-pointer"
            >
              <span class="material-symbols-outlined text-lg">check_circle</span>
              Prêt à servir
            </button>

            <button
              *ngIf="ticket.status === 'READY'"
              type="button"
              (click)="removeTicket(ticket.id)"
              class="w-full h-11 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span class="material-symbols-outlined text-lg">archive</span>
              Archiver le bon
            </button>
          </div>
        </div>
      </div>

      <!-- Aucun bon en attente -->
      <div *ngIf="tickets().length === 0" class="text-center py-20 text-stone-400">
        <span class="material-symbols-outlined text-6xl text-stone-300 mb-2">soup_kitchen</span>
        <h3 class="text-lg font-bold text-stone-700">Toutes les commandes sont prêtes !</h3>
        <p class="text-sm mt-1">Aucun nouveau bon de commande n'est en attente de préparation.</p>
      </div>
    </div>
  `
})
export class KitchenScreenComponent {
  readonly statusLabels = {
    RECEIVED: 'Reçu',
    PREPARING: 'En préparation',
    READY: 'Prêt'
  };

  readonly tickets = signal<KitchenTicket[]>([
    {
      id: 'k-101',
      orderNumber: 'CMD-1041',
      destination: 'Table 4 (Terrasse)',
      createdAt: '13:15',
      status: 'RECEIVED',
      items: [
        { name: 'Thiéboudienne Royale (Penda Mbaye)', quantity: 2, notes: 'Sauce piquante à part', station: 'CUISINE' },
        { name: 'Jus de Bissap Maison', quantity: 2, station: 'BAR' }
      ]
    },
    {
      id: 'k-102',
      orderNumber: 'CMD-1042',
      destination: 'Chambre 201 (Deluxe)',
      createdAt: '13:22',
      status: 'PREPARING',
      items: [
        { name: 'Yassa Poulet Fermier', quantity: 1, station: 'CUISINE' },
        { name: 'Dibi d’Agneau du Baol', quantity: 1, notes: 'Bien cuit', station: 'CUISINE' },
        { name: 'Cocktail Saloum Sunset', quantity: 2, station: 'BAR' }
      ]
    },
    {
      id: 'k-103',
      orderNumber: 'CMD-1043',
      destination: 'Table 2 (Restaurant)',
      createdAt: '13:28',
      status: 'READY',
      items: [
        { name: 'Poisson Grillé du Jour (Somone)', quantity: 1, station: 'CUISINE' },
        { name: 'Thiakry Onctueux', quantity: 1, station: 'PATISSERIE' }
      ]
    }
  ]);

  readonly pendingOrders = computed(() => {
    return this.tickets().filter(t => t.status !== 'READY');
  });

  updateStatus(id: string, newStatus: 'PREPARING' | 'READY'): void {
    this.tickets.update(list =>
      list.map(t => (t.id === id ? { ...t, status: newStatus } : t))
    );
  }

  removeTicket(id: string): void {
    this.tickets.update(list => list.filter(t => t.id !== id));
  }

  refreshTickets(): void {
    // Rafraîchissement simulé
  }
}
