import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReservationModalService } from '../../../../core/services/reservation-modal.service';
import { ModuleConfigService } from '../../../../core/services/module-config.service';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  host: { class: 'block w-full' },
  template: `
    <div class="p-4 sm:p-6 max-w-7xl mx-auto font-['Manrope'] pb-16 space-y-6">

      <!-- 1. Bandeau Mode Démonstration -->
      <div class="bg-blue-50/70 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-[#135bec] text-white flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-2xl">verified</span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold text-stone-900">Mode Démonstration Actif</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#135bec]">
                Version 1 Minimale
              </span>
            </div>
            <p class="text-xs text-stone-600 mt-0.5">
              Données réalistes pour l'hôtel Résidence Blue (12 chambres, restaurant La Teranga &amp; piscine).
            </p>
          </div>
        </div>

        <button
          type="button"
          (click)="confirmResetDemo()"
          class="h-11 min-h-[44px] px-4 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
          data-testid="btn-reset-demo"
        >
          <span class="material-symbols-outlined text-base">restart_alt</span>
          Réinitialiser les données
        </button>
      </div>

      <!-- Feedback Toast Notification -->
      <div
        *ngIf="toastMessage()"
        class="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn"
        data-testid="dashboard-toast"
      >
        <span class="material-symbols-outlined text-base text-emerald-600">check_circle</span>
        <span>{{ toastMessage() }}</span>
      </div>

      <!-- 2. Titre Clair sans Jargon -->
      <div class="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-stone-200 pb-4">
        <div>
          <h1 class="text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
            Accueil &amp; Activité du jour
          </h1>
          <p class="text-xs text-stone-500 mt-1">
            Résidence Blue &bull; Grand Standing, Thiès &bull; 12 Chambres
          </p>
        </div>
        <div class="text-xs text-stone-500 font-mono">
          {{ todayDateFormatted() }}
        </div>
      </div>

      <!-- 3. Les 4 Chiffres Clés (Kpi Cards) -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpis-section">
        <!-- Chiffre 1 : Occupation -->
        <div class="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-stone-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Taux d'occupation</span>
            <span class="material-symbols-outlined text-xl text-[#135bec]">hotel</span>
          </div>
          <div>
            <div class="text-3xl font-black text-stone-900 tracking-tight font-mono">
              75 %
            </div>
            <div class="text-xs text-stone-500 mt-1">
              <strong class="text-emerald-700 font-bold">9 chambres occupées</strong> sur 12
            </div>
          </div>
        </div>

        <!-- Chiffre 2 : Arrivées prévues -->
        <div class="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-stone-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Arrivées prévues</span>
            <span class="material-symbols-outlined text-xl text-emerald-600">login</span>
          </div>
          <div>
            <div class="text-3xl font-black text-stone-900 tracking-tight font-mono">
              3
            </div>
            <div class="text-xs text-stone-500 mt-1">
              Clients attendus cet après-midi
            </div>
          </div>
        </div>

        <!-- Chiffre 3 : Départs prévus -->
        <div class="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-stone-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Départs prévus</span>
            <span class="material-symbols-outlined text-xl text-amber-600">logout</span>
          </div>
          <div>
            <div class="text-3xl font-black text-stone-900 tracking-tight font-mono">
              2
            </div>
            <div class="text-xs text-stone-500 mt-1">
              Dont 1 chambre déjà libérée
            </div>
          </div>
        </div>

        <!-- Chiffre 4 : Recette encaissée du jour -->
        <div class="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between text-stone-500 mb-2">
            <span class="text-xs font-bold uppercase tracking-wider">Recette du jour</span>
            <span class="material-symbols-outlined text-xl text-emerald-600">payments</span>
          </div>
          <div>
            <div class="text-2xl sm:text-3xl font-black text-[#135bec] tracking-tight font-mono">
              385 000 <span class="text-xs font-semibold text-stone-500">FCFA</span>
            </div>
            <div class="text-xs text-stone-500 mt-1">
              Chambres, restaurant &amp; piscine
            </div>
          </div>
        </div>
      </div>

      <!-- 4. Les 5 Boutons d'Action Principaux (>= 44px) -->
      <div class="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <div>
          <h2 class="text-base font-bold text-stone-900">
            Actions rapides d'exploitation
          </h2>
          <p class="text-xs text-stone-500">
            Effectuez les opérations courantes de l'hôtel en un clic
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" data-testid="action-buttons-group">
          <!-- Action 1 : Nouvelle réservation -->
          <button
            type="button"
            (click)="openNewReservation()"
            data-testid="btn-action-reservation"
            class="h-14 min-h-[44px] px-4 rounded-xl bg-[#135bec] hover:bg-blue-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-xl">add_circle</span>
            <span>Nouvelle réservation</span>
          </button>

          <!-- Action 2 : Arrivée (Check-in) -->
          <button
            type="button"
            (click)="openArrivalModal()"
            data-testid="btn-action-arrival"
            class="h-14 min-h-[44px] px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-xl">key</span>
            <span>Arrivée (Check-in)</span>
          </button>

          <!-- Action 3 : Départ (Check-out) -->
          <button
            type="button"
            (click)="openDepartureModal()"
            data-testid="btn-action-departure"
            class="h-14 min-h-[44px] px-4 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98]"
          >
            <span class="material-symbols-outlined text-xl">meeting_room</span>
            <span>Départ (Check-out)</span>
          </button>

          <!-- Action 4 : Commande en chambre -->
          <a
            routerLink="/restaurant"
            data-testid="btn-action-room-service"
            class="h-14 min-h-[44px] px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer active:scale-[0.98] text-center no-underline"
          >
            <span class="material-symbols-outlined text-xl">room_service</span>
            <span>Commande en chambre</span>
          </a>

          <!-- Action 5 : Encaisser -->
          <a
            routerLink="/facturation"
            data-testid="btn-action-encaissement"
            class="h-14 min-h-[44px] px-4 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-900 border border-stone-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.98] text-center no-underline"
          >
            <span class="material-symbols-outlined text-xl text-emerald-600">point_of_sale</span>
            <span>Encaisser</span>
          </a>
        </div>
      </div>

      <!-- 5. Dialogue de confirmation Modal / Action Simple -->
      <div
        *ngIf="activeModal()"
        class="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
        data-testid="dashboard-action-modal"
      >
        <div class="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 animate-scaleUp">
          <div class="flex items-center gap-3 mb-3">
            <span class="material-symbols-outlined text-2xl text-[#135bec]">{{ activeModal()!.icon }}</span>
            <h3 class="text-base font-bold text-stone-900" data-testid="modal-title">
              {{ activeModal()!.title }}
            </h3>
          </div>
          <p class="text-sm text-stone-600 mb-6" data-testid="modal-message">
            {{ activeModal()!.message }}
          </p>

          <div class="flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="activeModal.set(null)"
              class="h-11 min-h-[44px] px-4 rounded-xl text-stone-600 hover:text-stone-900 text-xs font-semibold cursor-pointer"
              data-testid="btn-modal-cancel"
            >
              Annuler
            </button>
            <button
              type="button"
              (click)="activeModal()!.onConfirm()"
              class="h-11 min-h-[44px] px-5 rounded-xl bg-[#135bec] hover:bg-blue-700 text-white font-bold text-xs shadow-sm cursor-pointer"
              data-testid="btn-modal-confirm"
            >
              {{ activeModal()!.confirmText }}
            </button>
          </div>
        </div>
      </div>

    </div>
  `
})
export class DashboardPageComponent {
  private readonly router = inject(Router);
  private readonly reservationModal = inject(ReservationModalService);
  private readonly moduleConfig = inject(ModuleConfigService);

  readonly toastMessage = signal<string | null>(null);

  readonly activeModal = signal<{
    title: string;
    message: string;
    icon: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  todayDateFormatted = computed(() => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  });

  // Action 1 : Nouvelle réservation
  openNewReservation(): void {
    this.reservationModal.isOpen.set(true);
  }

  // Action 2 : Arrivée (Check-in)
  openArrivalModal(): void {
    this.activeModal.set({
      title: 'Enregistrer une arrivée (Check-in)',
      message: 'Confirmer l’arrivée de M. Mamadou Diop pour la Suite 301 et remettre la clé ?',
      icon: 'key',
      confirmText: 'Confirmer l’arrivée',
      onConfirm: () => {
        this.activeModal.set(null);
        this.showToast('Arrivée confirmée : M. Mamadou Diop est installé dans la Suite 301.');
      }
    });
  }

  // Action 3 : Départ (Check-out)
  openDepartureModal(): void {
    this.activeModal.set({
      title: 'Enregistrer un départ (Check-out)',
      message: 'Confirmer la libération de la Chambre 101 (Jean-Paul Mercier) avec solde réglé ?',
      icon: 'meeting_room',
      confirmText: 'Confirmer le départ',
      onConfirm: () => {
        this.activeModal.set(null);
        this.showToast('Départ confirmé : Chambre 101 libérée et passée en statut recouche.');
      }
    });
  }

  // Action 4 : Commande en chambre
  goToRoomService(): void {
    this.router.navigate(['/restaurant']);
  }

  // Action 5 : Encaisser
  goToFacturation(): void {
    this.router.navigate(['/facturation']);
  }

  // Mode Démonstration
  confirmResetDemo(): void {
    this.activeModal.set({
      title: 'Réinitialiser les données de démonstration ?',
      message: 'Toutes les réservations, chambres et folios de démonstration seront remis à leur état initial en un clic.',
      icon: 'restart_alt',
      confirmText: 'Réinitialiser',
      onConfirm: () => {
        this.moduleConfig.resetDemoData();
        this.activeModal.set(null);
        this.showToast('Données de démonstration réinitialisées avec succès.');
      }
    });
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 4000);
  }
}
