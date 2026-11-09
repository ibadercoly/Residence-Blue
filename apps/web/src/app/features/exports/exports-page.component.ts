import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  EXPORT_DEFINITIONS,
  ExportDocumentType
} from '@residence-blue/shared';
import { ExportService } from '../../core/services/export.service';
import { AuthMockService } from '../../core/services/auth-mock.service';

@Component({
  selector: 'app-exports-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-6xl mx-auto font-['Manrope'] pb-12">
      <!-- En-tête de la page -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-stone-200 gap-4 mb-6">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-blue-50 text-[#135bec] flex items-center justify-center font-bold">
            <span class="material-symbols-outlined text-3xl">file_download</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold text-stone-900 tracking-tight">
              Exports &amp; Rapports Officiels
            </h1>
            <p class="text-xs text-stone-500">
              Résidence Blue &bull; Documents d'exploitation certifiés PDF et Tableur Excel
            </p>
          </div>
        </div>

        <!-- Profil opérateur -->
        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-200 text-xs text-stone-700">
          <span class="material-symbols-outlined text-base text-stone-500">account_circle</span>
          <span class="font-bold">{{ authService.currentUser()?.fullName || 'Direction' }}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-[#135bec]">
            {{ authService.currentUser()?.role || 'DIRECTION' }}
          </span>
        </div>
      </div>

      <!-- Notification / Feedback -->
      <div *ngIf="successMessage()" class="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 text-emerald-800 text-sm font-semibold animate-fadeIn">
        <span class="material-symbols-outlined text-xl text-emerald-600">check_circle</span>
        <span>{{ successMessage() }}</span>
      </div>

      <div *ngIf="errorMessage()" class="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-rose-800 text-sm font-semibold animate-fadeIn">
        <span class="material-symbols-outlined text-xl text-rose-600">error</span>
        <span>{{ errorMessage() }}</span>
      </div>

      <!-- Grille Principale (Sélection Document + Paramètres Période) -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <!-- Colonne Gauche : Choix du document (7 cols) -->
        <div class="lg:col-span-7 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
          <h2 class="text-base font-bold text-stone-900">
            1. Choisissez le document à générer
          </h2>

          <div class="space-y-2.5">
            <div
              *ngFor="let doc of availableDocuments()"
              (click)="selectedDocument.set(doc.type)"
              [attr.data-testid]="'doc-card-' + doc.type"
              class="p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5"
              [class.border-[#135bec]]="selectedDocument() === doc.type"
              [class.bg-blue-50/40]="selectedDocument() === doc.type"
              [class.border-stone-200]="selectedDocument() !== doc.type"
              [class.hover:border-stone-300]="selectedDocument() !== doc.type"
            >
              <div
                class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                [class.bg-[#135bec]]="selectedDocument() === doc.type"
                [class.text-white]="selectedDocument() === doc.type"
                [class.bg-stone-100]="selectedDocument() !== doc.type"
                [class.text-stone-600]="selectedDocument() !== doc.type"
              >
                <span class="material-symbols-outlined text-xl">{{ doc.icon }}</span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <h3 class="text-sm font-bold text-stone-900 leading-tight">
                    {{ doc.title }}
                  </h3>
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0"
                    [class.bg-rose-100]="doc.format === 'PDF'"
                    [class.text-rose-800]="doc.format === 'PDF'"
                    [class.bg-emerald-100]="doc.format === 'EXCEL'"
                    [class.text-emerald-800]="doc.format === 'EXCEL'"
                  >
                    {{ doc.format }}
                  </span>
                </div>
                <p class="text-xs text-stone-500 mt-1 line-clamp-2">
                  {{ doc.description }}
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Colonne Droite : Période et Déclenchement (5 cols) -->
        <div class="lg:col-span-5 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-5 sticky top-6">
          <h2 class="text-base font-bold text-stone-900">
            2. Période &amp; Téléchargement
          </h2>

          <!-- Document actuellement sélectionné -->
          <div class="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs">
            <span class="text-stone-500 font-medium">Document sélectionné :</span>
            <div class="font-bold text-stone-900 text-sm mt-0.5">
              {{ currentDocDef().title }}
            </div>
            <div class="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Format certifié : <strong class="text-stone-700">{{ currentDocDef().format }}</strong>
            </div>
          </div>

          <!-- Filtres de date si requis -->
          <div *ngIf="currentDocDef().requiresDateRange" class="space-y-3">
            <div class="text-xs font-bold text-stone-700 uppercase tracking-wider">
              Plage de dates (12 mois maximum)
            </div>

            <!-- Raccourcis rapides -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                (click)="setDatePreset('today')"
                class="px-2.5 py-1 text-xs rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
              >
                Aujourd'hui
              </button>
              <button
                type="button"
                (click)="setDatePreset('7days')"
                class="px-2.5 py-1 text-xs rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
              >
                7 derniers jours
              </button>
              <button
                type="button"
                (click)="setDatePreset('month')"
                class="px-2.5 py-1 text-xs rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium transition-colors"
              >
                Ce mois
              </button>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label class="block text-[11px] font-bold text-stone-500 mb-1">Du</label>
                <input
                  type="date"
                  [(ngModel)]="startDate"
                  class="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:bg-white"
                />
              </div>
              <div>
                <label class="block text-[11px] font-bold text-stone-500 mb-1">Au</label>
                <input
                  type="date"
                  [(ngModel)]="endDate"
                  class="w-full px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:bg-white"
                />
              </div>
            </div>
          </div>

          <!-- Sécurité : mention neutralisation formules tableur -->
          <div class="p-3 bg-blue-50/50 rounded-xl border border-blue-100 text-[11px] text-blue-900 flex items-start gap-2">
            <span class="material-symbols-outlined text-base text-[#135bec] mt-0.5">verified_user</span>
            <span>
              Sécurité certifiée : neutralisation automatique des formules de tableur (=, +, -, @) et masquage des données sensibles.
            </span>
          </div>

          <!-- Bouton principal de génération (>= 44px) -->
          <button
            type="button"
            (click)="generateDocument()"
            [disabled]="isGenerating()"
            data-testid="btn-generate-export"
            class="w-full h-12 rounded-xl bg-[#135bec] hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <span *ngIf="!isGenerating()" class="material-symbols-outlined text-xl">download</span>
            <span *ngIf="isGenerating()" class="material-symbols-outlined text-xl animate-spin">progress_activity</span>
            <span>{{ isGenerating() ? 'Génération en cours...' : 'Générer et Télécharger' }}</span>
          </button>
        </div>
      </div>

      <!-- Journal d'Audit des Exports Récents -->
      <div class="mt-10 bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
        <div class="flex items-center justify-between pb-4 border-b border-stone-200 mb-4">
          <div>
            <h3 class="text-base font-bold text-stone-900">
              Journal d'audit des exports
            </h3>
            <p class="text-xs text-stone-500">
              Historique certifié des extractions de données (horodatage, opérateur, volume)
            </p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-stone-100 text-stone-600">
            {{ exportService.auditLogs().length }} exports enregistrés
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs text-stone-700">
            <thead class="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th class="px-3 py-2.5">Date &amp; Heure</th>
                <th class="px-3 py-2.5">Document</th>
                <th class="px-3 py-2.5">Format</th>
                <th class="px-3 py-2.5">Opérateur</th>
                <th class="px-3 py-2.5 text-right">Lignes</th>
                <th class="px-3 py-2.5 text-right">Taille</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              <tr *ngFor="let log of exportService.auditLogs()" class="hover:bg-stone-50/50">
                <td class="px-3 py-2.5 font-mono text-stone-500">
                  {{ log.timestamp | date:'dd/MM/yyyy HH:mm' }}
                </td>
                <td class="px-3 py-2.5 font-bold text-stone-900">
                  {{ definitions[log.documentType]?.title || log.documentType }}
                </td>
                <td class="px-3 py-2.5">
                  <span
                    class="px-2 py-0.5 rounded text-[10px] font-bold"
                    [class.bg-rose-100]="log.format === 'PDF'"
                    [class.text-rose-800]="log.format === 'PDF'"
                    [class.bg-emerald-100]="log.format === 'EXCEL'"
                    [class.text-emerald-800]="log.format === 'EXCEL'"
                  >
                    {{ log.format }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-stone-600">
                  {{ log.userFullName }} ({{ log.userRole }})
                </td>
                <td class="px-3 py-2.5 text-right font-mono font-bold">
                  {{ log.rowCount }}
                </td>
                <td class="px-3 py-2.5 text-right font-mono text-stone-500">
                  {{ (log.fileSizeBytes / 1024) | number:'1.1-1' }} Ko
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class ExportsPageComponent {
  readonly exportService = inject(ExportService);
  readonly authService = inject(AuthMockService);

  readonly definitions = EXPORT_DEFINITIONS;
  readonly availableDocuments = this.exportService.availableDocuments;

  readonly selectedDocument = signal<ExportDocumentType>('DAILY_SALES_CLOSURE_PDF');
  readonly isGenerating = signal<boolean>(false);
  readonly successMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  startDate = new Date().toISOString().slice(0, 10);
  endDate = new Date().toISOString().slice(0, 10);

  readonly currentDocDef = computed(() => {
    return EXPORT_DEFINITIONS[this.selectedDocument()];
  });

  setDatePreset(preset: 'today' | '7days' | 'month'): void {
    const today = new Date();
    this.endDate = today.toISOString().slice(0, 10);

    if (preset === 'today') {
      this.startDate = this.endDate;
    } else if (preset === '7days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      this.startDate = d.toISOString().slice(0, 10);
    } else if (preset === 'month') {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      this.startDate = d.toISOString().slice(0, 10);
    }
  }

  async generateDocument(): Promise<void> {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.isGenerating.set(true);

    try {
      const res = await this.exportService.generateExport(
        this.selectedDocument(),
        this.startDate,
        this.endDate
      );
      this.successMessage.set(`Export « ${res.fileName} » généré avec succès (${res.rowCount} lignes).`);
      setTimeout(() => this.successMessage.set(null), 5000);
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Erreur lors de la génération du document.');
    } finally {
      this.isGenerating.set(false);
    }
  }
}
