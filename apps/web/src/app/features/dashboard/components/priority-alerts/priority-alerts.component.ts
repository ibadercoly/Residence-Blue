import { Component, input } from '@angular/core';

export interface AlertItem {
  id: string;
  category: string;
  meta: string;
  title: string;
  description: string;
  buttonLabel: string;
  buttonIcon: string;
  variant: 'warning' | 'urgent' | 'info';
}

@Component({
  selector: 'app-priority-alerts',
  standalone: true,
  template: `
    <section class="bg-surface-container-lowest rounded-2xl p-space-lg shadow-sm space-y-space-md" aria-labelledby="priority-alerts-title">
      <div class="flex items-center justify-between pb-space-xs">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-secondary text-[22px]" aria-hidden="true">notifications_active</span>
          <h2 id="priority-alerts-title" class="font-headline-sm text-headline-sm text-on-surface">Actions prioritaires</h2>
        </div>
        <span class="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-label-md text-label-md font-semibold">
          {{ alerts().length }} alertes
        </span>
      </div>

      <!-- Alert 1: Stock bas (Ambre) -->
      <div class="p-space-md rounded-xl bg-secondary-fixed/30 flex flex-col gap-space-xs relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5 font-label-md text-label-md text-on-secondary-fixed-variant font-bold uppercase tracking-wider">
            <span class="w-2 h-2 rounded-full bg-secondary" aria-hidden="true"></span>
            Stock Épicerie • Alerte
          </span>
          <span class="font-label-md text-label-md text-outline">Il y a 30m</span>
        </div>
        <h4 class="font-title-md text-title-md text-on-surface font-semibold">Café Touba &amp; Vins de réserve bas</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Seuil critique atteint au Bar Teranga. Réapprovisionnement nécessaire avant le service du dîner.
        </p>
        <div class="pt-2 flex justify-end">
          <button
            class="h-8 px-3 rounded-lg bg-secondary hover:bg-secondary/90 text-on-secondary font-label-md text-label-md flex items-center gap-1 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-secondary"
            type="button"
          >
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">shopping_cart</span>
            Commander
          </button>
        </div>
      </div>

      <!-- Alert 2: Ticket maintenance urgent (Rouge) -->
      <div class="p-space-md rounded-xl bg-error-container/40 flex flex-col gap-space-xs relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5 font-label-md text-label-md text-error font-bold uppercase tracking-wider">
            <span class="w-2 h-2 rounded-full bg-error animate-ping" aria-hidden="true"></span>
            Technique • Urgent
          </span>
          <span class="font-label-md text-label-md text-outline">Ch. 12</span>
        </div>
        <h4 class="font-title-md text-title-md text-on-surface font-semibold">Climatisation Suite Filaos</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Dysfonctionnement signalé ce matin. Technicien froid convoqué sur place pour 15h00.
        </p>
        <div class="pt-2 flex justify-end">
          <button
            class="h-8 px-3 rounded-lg bg-error hover:bg-error/90 text-on-error font-label-md text-label-md flex items-center gap-1 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-error"
            type="button"
          >
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">build</span>
            Suivre le ticket
          </button>
        </div>
      </div>

      <!-- Alert 3: Factures impayées (Info/Or) -->
      <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-space-xs relative overflow-hidden group">
        <div class="flex items-center justify-between">
          <span class="inline-flex items-center gap-1.5 font-label-md text-label-md text-primary font-bold uppercase tracking-wider">
            <span class="w-2 h-2 rounded-full bg-primary" aria-hidden="true"></span>
            Facturation en suspens
          </span>
          <span class="font-label-md text-label-md text-primary font-semibold">145 000 FCFA</span>
        </div>
        <h4 class="font-title-md text-title-md text-on-surface font-semibold">Folios en attente de clôture</h4>
        <p class="font-body-sm text-body-sm text-on-surface-variant">
          Règlements extras piscine &amp; restaurant pour Ch. 03 (M. Diallo) et Ch. 07 (Mme Ndiaye).
        </p>
        <div class="pt-2 flex justify-end">
          <button
            class="h-8 px-3 rounded-lg bg-surface-container-highest hover:bg-surface-variant text-on-surface font-label-md text-label-md flex items-center gap-1 transition-all focus-visible:ring-2 focus-visible:ring-primary"
            type="button"
          >
            <span class="material-symbols-outlined text-[14px]" aria-hidden="true">visibility</span>
            Voir folios
          </button>
        </div>
      </div>
    </section>
  `
})
export class PriorityAlertsComponent {
  readonly alerts = input<AlertItem[]>([
    {
      id: 'alert-1',
      category: 'Stock Épicerie • Alerte',
      meta: 'Il y a 30m',
      title: 'Café Touba & Vins de réserve bas',
      description: 'Seuil critique atteint au Bar Teranga. Réapprovisionnement nécessaire avant le service du dîner.',
      buttonLabel: 'Commander',
      buttonIcon: 'shopping_cart',
      variant: 'warning'
    },
    {
      id: 'alert-2',
      category: 'Technique • Urgent',
      meta: 'Ch. 12',
      title: 'Climatisation Suite Filaos',
      description: 'Dysfonctionnement signalé ce matin. Technicien froid convoqué sur place pour 15h00.',
      buttonLabel: 'Suivre le ticket',
      buttonIcon: 'build',
      variant: 'urgent'
    },
    {
      id: 'alert-3',
      category: 'Facturation en suspens',
      meta: '145 000 FCFA',
      title: 'Folios en attente de clôture',
      description: 'Règlements extras piscine & restaurant pour Ch. 03 (M. Diallo) et Ch. 07 (Mme Ndiaye).',
      buttonLabel: 'Voir folios',
      buttonIcon: 'visibility',
      variant: 'info'
    }
  ]);
}
