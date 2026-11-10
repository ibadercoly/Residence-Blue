import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FacturationMockService, FacturationTab } from '../../core/services/facturation-mock.service';
import { HotelSettingsService } from '../../core/services/hotel-settings.service';
import { StatusBadgeComponent } from '../../shared/components/status-badge/status-badge.component';
import { ActionButtonComponent } from '../../shared/components/action-button/action-button.component';

@Component({
  selector: 'app-facturation-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, StatusBadgeComponent, ActionButtonComponent],
  template: `
    <div class="flex flex-col w-full pb-16 font-body-md" data-testid="facturation-container">
      <!-- Toast Notification -->
      @if (toastMessage()) {
        <div
          class="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-inverse-surface text-surface-bright shadow-lg text-body-sm flex items-center gap-2 border border-outline-variant/30 print:hidden"
          role="status"
          data-testid="toast-notification"
        >
          <span class="material-symbols-outlined text-[18px] text-secondary">info</span>
          <span>{{ toastMessage() }}</span>
        </div>
      }

      <!-- Top Navigation & Folio Header Strip -->
      <section class="flex flex-col gap-space-md mb-space-lg print:hidden">
        <!-- Breadcrumb & Mode Pills -->
        <div class="flex flex-wrap items-center justify-between gap-space-md">
          <div class="flex items-center gap-space-xs font-body-sm text-body-sm text-on-surface-variant">
            <a class="hover:text-primary transition-colors flex items-center gap-1 cursor-pointer" routerLink="/facturation">
              <span class="material-symbols-outlined text-[16px]">receipt_long</span>
              Facturation &amp; Caisse
            </a>
            <span class="material-symbols-outlined text-[14px] text-outline">chevron_right</span>
            <span class="text-on-surface font-title-md">
              {{ activeTab() === 'folio' ? 'Folio Invité en cours' : 'Rapport & Clôture de Caisse' }}
            </span>
          </div>

          <!-- Main Navigation Tabs -->
          <div class="flex items-center gap-space-xs bg-surface-container-low p-1.5 rounded-xl shadow-sm" role="tablist">
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'folio'"
              data-testid="tab-folio"
              class="flex items-center gap-space-sm px-space-md py-2 rounded-lg font-title-md text-title-md transition-all cursor-pointer"
              [ngClass]="activeTab() === 'folio' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'"
              (click)="selectTab('folio')"
            >
              <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              <span>Folio en cours ({{ folio().invoiceNumber }})</span>
            </button>
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'z-caisse'"
              data-testid="tab-z-caisse"
              class="flex items-center gap-space-sm px-space-md py-2 rounded-lg font-title-md text-title-md transition-all cursor-pointer"
              [ngClass]="activeTab() === 'z-caisse' ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'"
              (click)="selectTab('z-caisse')"
            >
              <span class="material-symbols-outlined text-[18px]">point_of_sale</span>
              <span>Clôture de caisse (Z de caisse)</span>
              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-label-md font-label-md bg-secondary-fixed text-on-secondary-fixed">
                Session active
              </span>
            </button>
          </div>
        </div>

        @if (activeTab() === 'folio') {
          <!-- Context Card: Room Selection & Checkout State -->
          <div class="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col xl:flex-row xl:items-center justify-between gap-space-lg">
            <div class="flex flex-wrap items-center gap-space-lg">
              <!-- Room Badge Graphic -->
              <div class="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-primary-container flex flex-col items-center justify-center text-on-primary shadow-md shrink-0">
                <span class="font-headline-md text-headline-md leading-none">{{ folio().roomNumber }}</span>
                <span class="font-label-md text-label-md tracking-widest uppercase opacity-85">{{ folio().roomCategory }}</span>
              </div>

              <!-- Room & Guest Title -->
              <div class="flex flex-col gap-0.5">
                <div class="flex flex-wrap items-center gap-space-sm">
                  <h1 class="font-headline-md text-headline-md text-on-surface">
                    {{ folio().roomName }}
                  </h1>
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-primary font-label-md text-label-md transition-colors cursor-pointer"
                    title="Changer de chambre"
                    data-testid="btn-swap-room"
                    (click)="showToast('Bascule de chambre en cours de développement')"
                  >
                    <span class="material-symbols-outlined text-[16px]">swap_horiz</span>
                    <span>Bascule</span>
                  </button>
                </div>
                <div class="flex flex-wrap items-center gap-space-md font-body-md text-body-md text-on-surface-variant">
                  <span class="flex items-center gap-1.5 text-on-surface font-title-md">
                    <span class="material-symbols-outlined text-[18px] text-primary">person</span>
                    {{ folio().guestName }}
                  </span>
                  @if (folio().vipTier) {
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
                      <span class="material-symbols-outlined text-[14px]">star</span> {{ folio().vipTier }}
                    </span>
                  }
                  <span class="text-outline-variant">•</span>
                  <span>{{ folio().staySummary }}</span>
                </div>
              </div>
            </div>

            <!-- Status Pills and Checkout Timing -->
            <div class="flex flex-wrap items-center gap-space-sm">
              <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-error-container text-on-error-container font-label-lg text-label-lg shadow-sm">
                <span class="w-2 h-2 rounded-full bg-error animate-pulse"></span>
                Départ aujourd'hui (12:00)
              </span>

              @if (folio().isPaid) {
                <app-status-badge status="FREE" label="Compte soldé" testId="badge-folio-paid"></app-status-badge>
              } @else {
                <app-status-badge status="CLEANING" label="Solde débiteur" testId="badge-folio-pending"></app-status-badge>
              }
            </div>
          </div>
        }
      </section>

      <!-- TAB 1: FOLIO VIEW -->
      @if (activeTab() === 'folio') {
        <!-- 2-Column Split: Detailed Invoice & Multi-payment Gateway -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start print:block">
          <!-- LEFT COLUMN: Detailed Hotel Guest Folio (7 Cols) -->
          <section class="lg:col-span-7 flex flex-col gap-space-lg print:w-full print:block" id="printableInvoiceArea">
            <div class="bg-surface-container-lowest rounded-xl shadow-sm overflow-hidden print:shadow-none print:border print:border-outline-variant/50">
              <!-- Folio Official Top Brand Strip -->
              <div class="p-space-lg bg-surface-container-low flex flex-col sm:flex-row justify-between gap-space-md print:bg-white print:border-b print:border-outline-variant/30">
                <div class="flex items-start gap-space-md">
                  <div class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm shrink-0">
                    <span class="material-symbols-outlined text-[28px]">tsunami</span>
                  </div>
                  <div class="flex flex-col">
                    <span class="font-headline-sm text-headline-sm text-on-surface tracking-tight">{{ hotelSettings().hotelName }}</span>
                    <span class="font-body-sm text-body-sm text-on-surface-variant">{{ hotelSettings().tagline }}</span>
                    <span class="font-label-md text-label-md text-outline mt-0.5">{{ hotelSettings().fullAddress }}</span>
                    <span class="font-label-md text-label-md text-outline">
                      NINEA : {{ hotelSettings().ninea }} • RCCM : {{ hotelSettings().rccm }}
                    </span>
                  </div>
                </div>

                <div class="flex flex-col sm:items-end text-left sm:text-right font-body-sm text-body-sm">
                  <span class="font-label-lg text-label-lg text-primary uppercase tracking-wider">Folio Client Résident</span>
                  <span class="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight" data-testid="invoice-number">
                    {{ folio().invoiceNumber }}
                  </span>
                  <span class="text-on-surface-variant text-label-md font-label-md mt-1">Date d'émission : {{ folio().issueDate }}</span>
                  <span class="text-on-surface-variant text-label-md font-label-md">Heure locale : {{ folio().issueTime }}</span>
                </div>
              </div>

              <!-- Guest Details & Billing Entity -->
              <div class="p-space-lg bg-surface-container-lowest grid grid-cols-1 sm:grid-cols-2 gap-space-md print:p-space-md">
                <div class="p-space-md bg-surface-container-low rounded-xl print:bg-transparent print:border print:border-outline-variant/30">
                  <div class="font-label-md text-label-md uppercase tracking-wider text-outline mb-1">Titulaire de la réservation</div>
                  <div class="font-title-lg text-title-lg text-on-surface">{{ folio().guestName }}</div>
                  <!-- RÈGLE STRICTE: Le passeport NE DOIT PAS apparaître sur l'impression ! -->
                  <div class="font-body-sm text-body-sm text-on-surface-variant print:hidden" data-testid="passport-screen-display">
                    Passeport SN : {{ folio().passportNumber }}
                  </div>
                  <div class="font-body-sm text-body-sm text-on-surface-variant">Téléphone : {{ folio().phone }}</div>
                </div>

                <div class="p-space-md bg-surface-container-low rounded-xl print:bg-transparent print:border print:border-outline-variant/30">
                  <div class="font-label-md text-label-md uppercase tracking-wider text-outline mb-1">Entité de facturation fiscale</div>
                  <div class="font-title-lg text-title-lg text-on-surface">{{ folio().billingEntity.companyName }}</div>
                  <div class="font-body-sm text-body-sm text-on-surface-variant">NINEA Client : {{ folio().billingEntity.ninea }}</div>
                  <div class="font-body-sm text-body-sm text-on-surface-variant">{{ folio().billingEntity.address }}</div>
                </div>
              </div>

              <!-- Line Item Services & Accommodations Table -->
              <div class="px-space-lg pb-space-lg print:p-space-md">
                <div class="flex items-center justify-between py-2 mb-space-sm">
                  <span class="font-title-md text-title-md text-on-surface">Détail des prestations &amp; consommations</span>
                  <span class="font-label-md text-label-md text-outline">{{ folio().items.length }} lignes au compte</span>
                </div>
                <div class="overflow-x-auto">
                  <table class="w-full text-left font-body-sm text-body-sm" data-testid="invoice-items-table">
                    <thead>
                      <tr class="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider print:bg-gray-100">
                        <th class="py-3 px-3 rounded-l-lg">Date</th>
                        <th class="py-3 px-3">Description du service</th>
                        <th class="py-3 px-3 text-center">Qté</th>
                        <th class="py-3 px-3 text-right">P.U. (FCFA)</th>
                        <th class="py-3 px-3 rounded-r-lg text-right">Total (FCFA)</th>
                      </tr>
                    </thead>
                    <tbody class="text-on-surface divide-y divide-surface-variant/30">
                      @for (item of folio().items; track item.id) {
                        <tr class="hover:bg-surface-container-low/50 transition-colors">
                          <td class="py-3.5 px-3 text-on-surface-variant font-medium whitespace-nowrap">{{ item.date }}</td>
                          <td class="py-3.5 px-3">
                            <div class="flex items-center gap-2">
                              @if (item.category === 'ROOM') {
                                <span class="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                              } @else if (item.icon) {
                                <span
                                  class="material-symbols-outlined text-[16px]"
                                  [ngClass]="{
                                    'text-secondary': item.category === 'RESTAURANT',
                                    'text-tertiary': item.category === 'CONCIERGE' || item.category === 'HOUSEKEEPING',
                                    'text-outline': item.category === 'TAX'
                                  }"
                                >{{ item.icon }}</span>
                              }
                              <span class="font-title-md text-title-md">{{ item.description }}</span>
                            </div>
                            <span class="font-label-md text-label-md text-outline block pl-4 sm:pl-6">{{ item.subDescription }}</span>
                          </td>
                          <td class="py-3.5 px-3 text-center font-medium whitespace-nowrap">{{ item.quantity }}</td>
                          <td class="py-3.5 px-3 text-right font-label-currency text-label-currency whitespace-nowrap">
                            {{ formatNumber(item.unitPriceFcfa) }}
                          </td>
                          <td
                            class="py-3.5 px-3 text-right font-label-currency text-label-currency whitespace-nowrap"
                            [ngClass]="item.category === 'ROOM' ? 'text-primary' : 'text-on-surface'"
                          >
                            {{ formatNumber(item.totalPriceFcfa) }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>

              <!-- High-Contrast Financial Totals and Balance Block -->
              <div class="p-space-lg bg-surface-container-low print:bg-white print:border-t print:border-outline-variant/30">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-space-lg">
                  <!-- Left: Accounting Breakdown -->
                  <div class="flex flex-col gap-2 font-body-sm text-body-sm">
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span>Sous-total HT Prestations :</span>
                      <span class="font-label-currency text-label-currency text-on-surface">
                        {{ formatNumber(folio().subtotalHtFcfa) }} FCFA
                      </span>
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span class="flex items-center gap-1">
                        TVA sénégalaise ({{ folio().vatRatePercent }}% taux réduit hôtellerie) :
                        <span class="material-symbols-outlined text-[14px] text-outline print:hidden" title="Taux d'imposition officiel applicable">info</span>
                      </span>
                      <span class="font-label-currency text-label-currency text-on-surface">
                        {{ formatNumber(folio().vatAmountFcfa) }} FCFA
                      </span>
                    </div>
                    <div class="flex justify-between items-center text-on-surface-variant">
                      <span>Taxe de séjour (collectée pour l'État) :</span>
                      <span class="font-label-currency text-label-currency text-on-surface">
                        {{ formatNumber(folio().tourismTaxAmountFcfa) }} FCFA
                      </span>
                    </div>
                    <div class="pt-2 mt-1 flex justify-between items-center font-title-lg text-title-lg text-on-surface border-t border-surface-variant/40">
                      <span>Total TTC du séjour :</span>
                      <span class="font-label-currency text-label-currency text-primary">
                        {{ formatNumber(folio().totalTtcFcfa) }} FCFA
                      </span>
                    </div>
                    <div class="flex justify-between items-center p-2.5 rounded-lg bg-surface-container-lowest text-on-surface-variant shadow-sm mt-1 print:bg-transparent print:border print:border-outline-variant/30">
                      <span class="flex items-center gap-1.5 text-primary">
                        <span class="material-symbols-outlined text-[18px]">verified</span>
                        {{ folio().depositLabel }} :
                      </span>
                      <span class="font-label-currency text-label-currency text-on-surface">
                        - {{ formatNumber(folio().depositAmountFcfa) }} FCFA
                      </span>
                    </div>
                  </div>

                  <!-- Right: Prominent Outstanding Balance Frame -->
                  <div class="p-space-md rounded-xl bg-surface-container-lowest shadow-sm flex flex-col justify-between print:border print:border-outline-variant/30">
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <span class="font-label-md text-label-md uppercase tracking-wider text-error font-bold">Reste à régler au départ</span>
                        <span class="material-symbols-outlined text-error text-[20px] print:hidden">notifications_active</span>
                      </div>
                      <div class="font-headline-lg text-headline-lg text-on-surface font-semibold tracking-tight text-primary">
                        {{ formatNumber(folio().isPaid ? 0 : folio().targetDueFcfa) }} <span class="font-title-md text-title-md font-bold text-on-surface">FCFA</span>
                      </div>
                      <p class="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        {{ folio().isPaid ? "Ce compte a été intégralement soldé et acquitté au guichet." : "Ce montant clôture l'intégralité du compte de la Suite 301 et valide le départ officiel." }}
                      </p>
                    </div>

                    <!-- Quick Document Actions (Hidden on print) -->
                    <div class="flex items-center gap-2 pt-space-md mt-space-md print:hidden">
                      <app-action-button
                        label="Imprimer Folio (PDF)"
                        icon="print"
                        variant="outline"
                        testId="btn-print-invoice"
                        (action)="printInvoice()"
                      ></app-action-button>
                      <app-action-button
                        label="WhatsApp / Email"
                        icon="share"
                        variant="outline"
                        testId="btn-share-invoice"
                        (action)="showToast('Envoi WhatsApp / E-mail bientôt disponible (TODO: Notifications)')"
                      ></app-action-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- RIGHT COLUMN: Multi-Method Checkout Gateway / Split Payments (5 Cols) (Hidden on print) -->
          <section class="lg:col-span-5 flex flex-col gap-space-lg print:hidden">
            <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-lg">
              <!-- Header & Target Amount Banner -->
              <div class="flex flex-col gap-space-xs">
                <div class="flex items-center justify-between">
                  <h2 class="font-headline-sm text-headline-sm text-on-surface">Règlement &amp; Clôture</h2>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-fixed text-on-primary-fixed font-label-md text-label-md">
                    <span class="material-symbols-outlined text-[14px]">bolt</span> Guichet Direct
                  </span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Ventilation des règlements par moyen de paiement (Split Payments)</span>
              </div>

              <!-- Big Highlight Balance Box -->
              <div class="p-space-md rounded-xl bg-gradient-to-r from-surface-container-low to-surface-container flex items-center justify-between shadow-sm">
                <div>
                  <span class="font-label-md text-label-md uppercase tracking-wider text-outline">Solde exigible</span>
                  <div class="font-headline-md text-headline-md text-on-surface">
                    {{ formatNumber(targetDue()) }} FCFA
                  </div>
                </div>

                <!-- Balance Status Badge -->
                <app-status-badge
                  [status]="reconStatus() === 'BALANCED' ? 'FREE' : (reconStatus() === 'UNDERPAID' ? 'CLEANING' : 'MAINTENANCE')"
                  [label]="reconStatus() === 'BALANCED' ? 'Compte équilibré' : (reconStatus() === 'UNDERPAID' ? 'À ventiler' : 'Dépassement')"
                  testId="balance-status-badge"
                ></app-status-badge>
              </div>

              <!-- Split Payment Controls Section -->
              <div class="flex flex-col gap-space-md">
                <!-- Method 1: Wave Mobile Money -->
                <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-lowest text-primary flex items-center justify-center font-bold text-lg shadow-sm">
                        <span class="material-symbols-outlined text-[20px]">water_drop</span>
                      </div>
                      <div>
                        <span class="font-title-md text-title-md text-on-surface">Wave Sénégal</span>
                        <span class="font-label-md text-label-md text-outline block">Paiement sans frais QR / Push</span>
                      </div>
                    </div>
                    <span class="font-label-md text-label-md px-2 py-0.5 rounded-md bg-surface-container-lowest text-primary">Préféré</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 mt-1">
                    <div class="sm:col-span-7 relative">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        class="payment-input w-full h-11 px-3 pr-16 rounded-lg bg-surface-container-lowest text-on-surface font-label-currency text-label-currency shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0"
                        data-testid="input-wave"
                        [ngModel]="waveAmount()"
                        (ngModelChange)="onWaveChange($event)"
                      />
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-outline">FCFA</span>
                    </div>
                    <div class="sm:col-span-5">
                      <input
                        type="text"
                        class="w-full h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Réf transaction"
                        title="Référence de la transaction Wave"
                        data-testid="input-wave-ref"
                        [ngModel]="waveRef()"
                        (ngModelChange)="facturationService.setWaveRef($event)"
                      />
                    </div>
                  </div>
                </div>

                <!-- Method 2: Espèces (Cash) with Change Calculator -->
                <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-lowest text-secondary flex items-center justify-center shadow-sm">
                        <span class="material-symbols-outlined text-[20px]">payments</span>
                      </div>
                      <div>
                        <span class="font-title-md text-title-md text-on-surface">Espèces (FCFA)</span>
                        <span class="font-label-md text-label-md text-outline block">Caisse réception physique</span>
                      </div>
                    </div>
                    <span class="font-label-md text-label-md px-2 py-0.5 rounded-md bg-surface-container-lowest text-on-surface-variant">Billetage</span>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 mt-1">
                    <div class="sm:col-span-6 relative">
                      <label class="block font-label-md text-label-md text-outline mb-0.5">Montant imputé</label>
                      <div class="relative">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          class="payment-input w-full h-11 px-3 pr-14 rounded-lg bg-surface-container-lowest text-on-surface font-label-currency text-label-currency shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="0"
                          data-testid="input-cash"
                          [ngModel]="cashAmount()"
                          (ngModelChange)="onCashChange($event)"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-outline">FCFA</span>
                      </div>
                    </div>
                    <div class="sm:col-span-6 relative">
                      <label class="block font-label-md text-label-md text-outline mb-0.5">Reçu du client</label>
                      <div class="relative">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          class="w-full h-11 px-3 pr-14 rounded-lg bg-surface-container-lowest text-on-surface font-label-currency text-label-currency shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          placeholder="Reçu"
                          data-testid="input-received"
                          [ngModel]="cashReceived()"
                          (ngModelChange)="onReceivedChange($event)"
                        />
                        <span class="absolute right-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-outline">FCFA</span>
                      </div>
                    </div>
                  </div>

                  <!-- Change Return Box -->
                  <div class="mt-1 p-2 rounded-lg bg-surface-container-lowest flex items-center justify-between font-body-sm text-body-sm shadow-sm">
                    <span class="text-on-surface-variant flex items-center gap-1">
                      <span class="material-symbols-outlined text-[16px] text-primary">price_change</span>
                      Monnaie à rendre :
                    </span>
                    <span class="font-label-currency text-label-currency text-primary" data-testid="change-return">
                      {{ formatNumber(changeReturn()) }} FCFA
                    </span>
                  </div>
                </div>

                <!-- Method 3: Orange Money Sénégal -->
                <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-lg bg-secondary text-on-secondary flex items-center justify-center font-bold text-xs shadow-sm">
                        OM
                      </div>
                      <div>
                        <span class="font-title-md text-title-md text-on-surface">Orange Money Sénégal</span>
                        <span class="font-label-md text-label-md text-outline block">Passerelle marchande Sonatel</span>
                      </div>
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 mt-1">
                    <div class="sm:col-span-7 relative">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        class="payment-input w-full h-11 px-3 pr-16 rounded-lg bg-surface-container-lowest text-on-surface font-label-currency text-label-currency shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="0"
                        data-testid="input-om"
                        [ngModel]="omAmount()"
                        (ngModelChange)="onOMChange($event)"
                      />
                      <span class="absolute right-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-outline">FCFA</span>
                    </div>
                    <div class="sm:col-span-5">
                      <input
                        type="text"
                        class="w-full h-11 px-3 rounded-lg bg-surface-container-lowest text-on-surface font-body-sm text-body-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        placeholder="Réf code transfert"
                        data-testid="input-om-ref"
                        [ngModel]="omRef()"
                        (ngModelChange)="facturationService.setOMRef($event)"
                      />
                    </div>
                  </div>
                </div>

                <!-- Method 4: Carte Bancaire (Terminal TPE) -->
                <div class="p-space-md rounded-xl bg-surface-container-low flex flex-col gap-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-lg bg-surface-container-lowest text-tertiary flex items-center justify-center shadow-sm">
                        <span class="material-symbols-outlined text-[20px]">credit_card</span>
                      </div>
                      <div>
                        <span class="font-title-md text-title-md text-on-surface">Carte Bancaire (TPE UBA / CBAO)</span>
                        <span class="font-label-md text-label-md text-outline block">Visa • Mastercard • GIM-UEMOA</span>
                      </div>
                    </div>
                  </div>

                  <div class="relative mt-1">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      class="payment-input w-full h-11 px-3 pr-16 rounded-lg bg-surface-container-lowest text-on-surface font-label-currency text-label-currency shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="0"
                      data-testid="input-card"
                      [ngModel]="cardAmount()"
                      (ngModelChange)="onCardChange($event)"
                    />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 font-label-md text-label-md text-outline">FCFA</span>
                  </div>
                </div>
              </div>

              <!-- Live Reconciliation Status Banner -->
              <div class="p-space-md rounded-xl bg-surface-container flex flex-col gap-2 shadow-sm">
                <div class="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
                  <span>Total ventilé :</span>
                  <span class="font-label-currency text-label-currency text-on-surface" data-testid="allocated-total">
                    {{ formatNumber(allocatedTotal()) }} FCFA
                  </span>
                </div>
                <div class="flex justify-between items-center font-body-sm text-body-sm text-on-surface-variant">
                  <span>Reste non assigné :</span>
                  <span
                    class="font-label-currency text-label-currency"
                    data-testid="remaining-balance"
                    [ngClass]="{
                      'text-primary': remainingBalance() === 0,
                      'text-secondary': remainingBalance() > 0,
                      'text-error': remainingBalance() < 0
                    }"
                  >
                    @if (remainingBalance() < 0) {
                      -{{ formatNumber(abs(remainingBalance())) }} FCFA (Trop-perçu)
                    } @else {
                      {{ formatNumber(remainingBalance()) }} FCFA
                    }
                  </span>
                </div>

                <!-- Alert Banner -->
                <div
                  class="p-2 rounded-lg flex items-center gap-2 font-label-md text-label-md"
                  data-testid="reconciliation-banner"
                  [ngClass]="{
                    'bg-primary/10 text-primary': reconStatus() === 'BALANCED',
                    'bg-secondary/10 text-secondary': reconStatus() === 'UNDERPAID',
                    'bg-error-container text-on-error-container': reconStatus() === 'OVERPAID'
                  }"
                >
                  <span class="material-symbols-outlined text-[18px]">
                    {{ reconStatus() === 'BALANCED' ? 'check_circle' : reconStatus() === 'UNDERPAID' ? 'warning' : 'error' }}
                  </span>
                  <span>
                    @if (reconStatus() === 'BALANCED') {
                      Montant parfaitement équilibré. L'encaissement peut être validé.
                    } @else if (reconStatus() === 'UNDERPAID') {
                      Il reste encore {{ formatNumber(remainingBalance()) }} FCFA à répartir.
                    } @else {
                      Dépassement de {{ formatNumber(abs(remainingBalance())) }} FCFA. Ajustez la répartition.
                    }
                  </span>
                </div>
              </div>

              <!-- Invoicing & Tax Selection Option -->
              <div class="flex items-start gap-3 p-space-md rounded-xl bg-surface-container-low shadow-sm">
                <input
                  type="checkbox"
                  id="taxInvoice"
                  class="mt-1 w-4 h-4 rounded text-primary focus:ring-primary cursor-pointer"
                  data-testid="tax-invoice-checkbox"
                  [ngModel]="taxInvoiceChecked()"
                  (ngModelChange)="facturationService.setTaxInvoiceChecked($event)"
                />
                <label for="taxInvoice" class="font-body-sm text-body-sm text-on-surface cursor-pointer">
                  <span class="font-title-md text-title-md block text-on-surface">Émettre la facture fiscale nominative (VGE)</span>
                  <span class="text-on-surface-variant">Attribution société Teranga Group Dakar (NINEA 0029103) avec quittance d'encaissement officielle certifiée.</span>
                </label>
              </div>

              <!-- Big Checkout Action Button -->
              <button
                type="button"
                id="btnCheckout"
                data-testid="btn-checkout"
                [disabled]="!isCheckoutAllowed()"
                class="w-full h-14 rounded-xl font-title-lg text-title-lg shadow-md transition-all flex items-center justify-center gap-space-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                [ngClass]="{
                  'bg-primary hover:bg-primary-container text-on-primary hover:shadow-lg': isCheckoutAllowed() && !folio().isPaid,
                  'bg-primary-container text-on-primary': folio().isPaid,
                  'bg-surface-container-high text-outline cursor-not-allowed': !isCheckoutAllowed() && !folio().isPaid
                }"
                (click)="onCheckout()"
              >
                @if (isCheckingOut()) {
                  <span class="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
                  <span>Encaissement en cours...</span>
                } @else if (folio().isPaid) {
                  <span class="material-symbols-outlined text-[24px]">done_all</span>
                  <span>Paiement validé • Chambre 301 clôturée !</span>
                } @else {
                  <span class="material-symbols-outlined text-[24px]">key_off</span>
                  <span>Encaisser et libérer la chambre 301</span>
                }
              </button>
            </div>

            <!-- Quick Reception Shift Summary / Petty Cash Card -->
            <div
              class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex items-center justify-between gap-space-md cursor-pointer hover:bg-surface-container-low transition-colors"
              data-testid="shift-summary-card"
              (click)="selectTab('z-caisse')"
            >
              <div class="flex items-center gap-space-md">
                <div class="w-10 h-10 rounded-xl bg-surface-container text-primary flex items-center justify-center shrink-0 shadow-sm">
                  <span class="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <div class="flex flex-col">
                  <span class="font-title-md text-title-md text-on-surface">Caisse Réception • Session du Jour</span>
                  <span class="font-body-sm text-body-sm text-on-surface-variant">
                    Opératrice : {{ zReport().operatorName }} • Fond initial : {{ formatNumber(zReport().openingFloatFcfa) }} FCFA
                  </span>
                </div>
              </div>
              <div class="text-right">
                <span class="font-label-md text-label-md uppercase tracking-wider text-outline block">Encaissé ce jour</span>
                <span class="font-label-currency text-label-currency text-primary" data-testid="today-collected-amount">
                  {{ formatNumber(totalCollectedToday()) }} FCFA
                </span>
              </div>
            </div>
          </section>
        </div>
      }

      <!-- TAB 2: Z DE CAISSE (CLÔTURE DE CAISSE) -->
      @if (activeTab() === 'z-caisse') {
        <section class="flex flex-col gap-space-lg" data-testid="z-caisse-view">
          <!-- Shift Overview Banner -->
          <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col md:flex-row md:items-center justify-between gap-space-md">
            <div class="flex items-center gap-space-md">
              <div class="w-14 h-14 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                <span class="material-symbols-outlined text-[32px]">point_of_sale</span>
              </div>
              <div class="flex flex-col">
                <div class="flex items-center gap-2">
                  <h2 class="font-headline-sm text-headline-sm text-on-surface">Journal de Caisse (Rapport Z)</h2>
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-md text-label-md">
                    Session {{ zReport().shiftId }}
                  </span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                  Directrice / Caissière : <strong class="text-on-surface">{{ zReport().operatorName }}</strong> • Date : {{ zReport().date }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-space-sm">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 h-11 px-space-md rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-title-md text-title-md transition-colors cursor-pointer"
                data-testid="btn-print-z"
                (click)="printInvoice()"
              >
                <span class="material-symbols-outlined text-[20px]">print</span>
                <span>Imprimer Z de Caisse</span>
              </button>
              <button
                type="button"
                class="inline-flex items-center gap-1.5 h-11 px-space-md rounded-xl bg-primary hover:bg-primary-container text-on-primary font-title-md text-title-md shadow-sm transition-all cursor-pointer"
                data-testid="btn-close-shift"
                (click)="showToast('Clôture définitive de la session enregistrée dans le journal d audit')"
              >
                <span class="material-symbols-outlined text-[20px]">lock</span>
                <span>Clôturer la session</span>
              </button>
            </div>
          </div>

          <!-- 4 KPI Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
            <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col justify-between">
              <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Fond Initial</span>
              <div class="font-headline-sm text-headline-sm text-on-surface mt-2 font-semibold">
                {{ formatNumber(zReport().openingFloatFcfa) }} FCFA
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant mt-1">Monnaie d'ouverture au tiroir</span>
            </div>

            <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col justify-between">
              <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Encaissé ce Jour</span>
              <div class="font-headline-sm text-headline-sm text-primary mt-2 font-semibold">
                {{ formatNumber(totalCollectedToday()) }} FCFA
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant mt-1">{{ zReport().transactionsCount }} transactions enregistrées</span>
            </div>

            <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col justify-between">
              <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Espèces physiques</span>
              <div class="font-headline-sm text-headline-sm text-secondary mt-2 font-semibold">
                {{ formatNumber(physicalCashInDrawer()) }} FCFA
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant mt-1">Fond initial + billetage perçu</span>
            </div>

            <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-md flex flex-col justify-between">
              <span class="font-label-md text-label-md text-outline uppercase tracking-wider">Monnaie électronique</span>
              <div class="font-headline-sm text-headline-sm text-tertiary mt-2 font-semibold">
                {{ formatNumber(electronicTotal()) }} FCFA
              </div>
              <span class="font-body-sm text-body-sm text-on-surface-variant mt-1">Wave, Orange Money &amp; CB TPE</span>
            </div>
          </div>

          <!-- Method Breakdown Table -->
          <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md">
            <h3 class="font-title-lg text-title-lg text-on-surface">Ventilation par Moyen de Paiement</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left font-body-sm text-body-sm">
                <thead>
                  <tr class="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
                    <th class="py-3 px-4 rounded-l-lg">Moyen de Règlement</th>
                    <th class="py-3 px-4">Canal &amp; Passerelle</th>
                    <th class="py-3 px-4 text-right">Montant Encaissé (FCFA)</th>
                    <th class="py-3 px-4 rounded-r-lg text-right">Part (%)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-variant/30 text-on-surface">
                  <tr>
                    <td class="py-3.5 px-4 font-title-md flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full bg-primary"></span>
                      <span>Wave Sénégal</span>
                    </td>
                    <td class="py-3.5 px-4 text-on-surface-variant">Paiement QR / Push marchand direct</td>
                    <td class="py-3.5 px-4 text-right font-label-currency">{{ formatNumber(zReport().collectedByMethod.wave) }}</td>
                    <td class="py-3.5 px-4 text-right font-medium">
                      {{ calculatePercent(zReport().collectedByMethod.wave, totalCollectedToday()) }}%
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3.5 px-4 font-title-md flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full bg-secondary"></span>
                      <span>Espèces (Billetage Caisse)</span>
                    </td>
                    <td class="py-3.5 px-4 text-on-surface-variant">Tiroir caisse réception physique</td>
                    <td class="py-3.5 px-4 text-right font-label-currency">{{ formatNumber(zReport().collectedByMethod.cash) }}</td>
                    <td class="py-3.5 px-4 text-right font-medium">
                      {{ calculatePercent(zReport().collectedByMethod.cash, totalCollectedToday()) }}%
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3.5 px-4 font-title-md flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full bg-secondary-fixed-dim"></span>
                      <span>Orange Money Sénégal</span>
                    </td>
                    <td class="py-3.5 px-4 text-on-surface-variant">Passerelle marchande Sonatel</td>
                    <td class="py-3.5 px-4 text-right font-label-currency">{{ formatNumber(zReport().collectedByMethod.orangeMoney) }}</td>
                    <td class="py-3.5 px-4 text-right font-medium">
                      {{ calculatePercent(zReport().collectedByMethod.orangeMoney, totalCollectedToday()) }}%
                    </td>
                  </tr>
                  <tr>
                    <td class="py-3.5 px-4 font-title-md flex items-center gap-2">
                      <span class="w-3 h-3 rounded-full bg-tertiary"></span>
                      <span>Cartes Bancaires (TPE)</span>
                    </td>
                    <td class="py-3.5 px-4 text-on-surface-variant">Terminal UBA / CBAO (Visa, Mastercard)</td>
                    <td class="py-3.5 px-4 text-right font-label-currency">{{ formatNumber(zReport().collectedByMethod.card) }}</td>
                    <td class="py-3.5 px-4 text-right font-medium">
                      {{ calculatePercent(zReport().collectedByMethod.card, totalCollectedToday()) }}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Folios Closed List -->
          <div class="bg-surface-container-lowest rounded-xl shadow-sm p-space-lg flex flex-col gap-space-md">
            <h3 class="font-title-lg text-title-lg text-on-surface">Historique des Folios &amp; Encaissements Clôturés</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left font-body-sm text-body-sm">
                <thead>
                  <tr class="bg-surface-container-low text-on-surface-variant font-label-md text-label-md uppercase tracking-wider">
                    <th class="py-3 px-4 rounded-l-lg">Heure</th>
                    <th class="py-3 px-4">Facture / Folio</th>
                    <th class="py-3 px-4">Chambre / Compte</th>
                    <th class="py-3 px-4">Client / Titulaire</th>
                    <th class="py-3 px-4">Moyen de Paiement</th>
                    <th class="py-3 px-4 rounded-r-lg text-right">Montant (FCFA)</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-variant/30 text-on-surface">
                  @for (folioTx of zReport().closedFolios; track folioTx.id) {
                    <tr class="hover:bg-surface-container-low/50 transition-colors">
                      <td class="py-3 px-4 text-on-surface-variant font-medium whitespace-nowrap">{{ folioTx.time }}</td>
                      <td class="py-3 px-4 font-semibold text-primary whitespace-nowrap">{{ folioTx.invoiceNumber }}</td>
                      <td class="py-3 px-4">Chambre {{ folioTx.roomNumber }}</td>
                      <td class="py-3 px-4 font-medium">{{ folioTx.guestName }}</td>
                      <td class="py-3 px-4 text-on-surface-variant">
                        {{ folioTx.method }}
                        @if (folioTx.reference) {
                          <span class="text-xs text-outline block">({{ folioTx.reference }})</span>
                        }
                      </td>
                      <td class="py-3 px-4 text-right font-label-currency text-primary whitespace-nowrap">
                        {{ formatNumber(folioTx.amountFcfa) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </section>
      }
    </div>
  `,
  styles: [`
    @media print {
      :host {
        display: block;
        background: #ffffff !important;
        color: #000000 !important;
      }
      @page {
        size: A4 portrait;
        margin: 1.2cm;
      }
      .print\\:hidden {
        display: none !important;
      }
      #printableInvoiceArea {
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  `]
})
export class FacturationPageComponent {
  readonly facturationService = inject(FacturationMockService);
  readonly hotelSettingsService = inject(HotelSettingsService);

  readonly toastMessage = signal<string | null>(null);

  readonly activeTab = this.facturationService.activeTab;
  readonly folio = this.facturationService.currentFolio;
  readonly hotelSettings = this.hotelSettingsService.settings;
  readonly zReport = this.facturationService.cashierShiftZReport;

  readonly targetDue = this.facturationService.targetDueFcfa;
  readonly waveAmount = this.facturationService.inputWave;
  readonly waveRef = this.facturationService.inputWaveRef;
  readonly cashAmount = this.facturationService.inputCash;
  readonly cashReceived = this.facturationService.inputReceived;
  readonly omAmount = this.facturationService.inputOM;
  readonly omRef = this.facturationService.inputOMRef;
  readonly cardAmount = this.facturationService.inputCard;
  readonly taxInvoiceChecked = this.facturationService.taxInvoiceChecked;

  readonly allocatedTotal = this.facturationService.allocatedTotal;
  readonly remainingBalance = this.facturationService.remainingBalance;
  readonly changeReturn = this.facturationService.changeReturn;
  readonly reconStatus = this.facturationService.reconciliationStatus;
  readonly isCheckoutAllowed = this.facturationService.isCheckoutAllowed;
  readonly isCheckingOut = this.facturationService.isCheckingOut;

  readonly totalCollectedToday = this.facturationService.totalCollectedTodayFcfa;
  readonly physicalCashInDrawer = this.facturationService.totalPhysicalCashInDrawer;

  readonly electronicTotal = computed(() => {
    const z = this.zReport();
    return z.collectedByMethod.wave + z.collectedByMethod.orangeMoney + z.collectedByMethod.card;
  });

  selectTab(tab: FacturationTab): void {
    this.facturationService.setActiveTab(tab);
  }

  onWaveChange(val: number | string): void {
    const num = typeof val === 'string' ? parseInt(val, 10) || 0 : val;
    this.facturationService.setWaveAmount(num);
  }

  onCashChange(val: number | string): void {
    const num = typeof val === 'string' ? parseInt(val, 10) || 0 : val;
    this.facturationService.setCashAmount(num);
  }

  onReceivedChange(val: number | string): void {
    const num = typeof val === 'string' ? parseInt(val, 10) || 0 : val;
    this.facturationService.setCashReceived(num);
  }

  onOMChange(val: number | string): void {
    const num = typeof val === 'string' ? parseInt(val, 10) || 0 : val;
    this.facturationService.setOMAmount(num);
  }

  onCardChange(val: number | string): void {
    const num = typeof val === 'string' ? parseInt(val, 10) || 0 : val;
    this.facturationService.setCardAmount(num);
  }

  async onCheckout(): Promise<void> {
    const success = await this.facturationService.processCheckout();
    if (success) {
      this.showToast('Paiement validé avec succès ! Chambre 301 libérée.');
    }
  }

  printInvoice(): void {
    this.facturationService.printInvoice();
  }

  formatNumber(val: number): string {
    const clean = Math.round(val || 0);
    return clean.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }

  calculatePercent(amount: number, total: number): number {
    if (!total || total <= 0) return 0;
    return Math.round((amount / total) * 100);
  }

  abs(val: number): number {
    return Math.abs(val || 0);
  }

  showToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3500);
  }
}
