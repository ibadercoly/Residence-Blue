import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  BillingLineCategory,
  BillingLineDetail,
  BillingPaymentDetail,
  BillingPaymentMethod,
} from '@residence-blue/shared';
import { FacturationService } from '../services/facturation.service';
import {
  BILLING_CATEGORY_OPTIONS,
  BILLING_PAYMENT_METHOD_OPTIONS,
  formatFcfaPlain,
  hasPotentialCardPan,
} from '../models/facturation.model';

interface GroupedCategoryLines {
  category: BillingLineCategory;
  label: string;
  lines: BillingLineDetail[];
  subtotalFcfa: number;
}

@Component({
  selector: 'app-note-sejour-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
        min-width: 0;
        background-color: #f3fafe;
        color: #161d20;
        font-family: 'Manrope', sans-serif;
      }

      .rb-wrap {
        width: 100%;
        max-width: 1380px;
        margin: 0 auto;
        padding: 16px 16px 152px;
        box-sizing: border-box;
      }

      @media (min-width: 1024px) {
        .rb-wrap {
          padding: 24px 28px 36px;
        }
      }

      .rb-title {
        font-family: 'Newsreader', serif;
        color: #161d20;
        letter-spacing: -0.01em;
      }

      .rb-grid-note {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 20px;
        align-items: start;
      }

      @media (min-width: 1024px) {
        .rb-grid-note {
          grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
          gap: 24px;
        }
      }

      .rb-sticky-panel {
        min-width: 0;
      }

      @media (min-width: 1024px) {
        .rb-sticky-panel {
          position: sticky;
          top: 20px;
        }
      }

      .rb-card {
        background-color: #ffffff;
        border: 1px solid #bdc9ca;
        border-radius: 12px;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .rb-btn {
        min-height: 44px;
        padding: 9px 14px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        line-height: 1.2;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        text-decoration: none;
        box-sizing: border-box;
        transition: background-color 150ms ease, border-color 150ms ease;
      }

      .rb-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .rb-btn-primary {
        background-color: #00666f;
        color: #ffffff;
        border: 1px solid #00666f;
      }

      .rb-btn-primary:hover:not(:disabled) {
        background-color: #005158;
      }

      .rb-btn-outline {
        background-color: #ffffff;
        color: #00666f;
        border: 1px solid #00666f;
      }

      .rb-btn-outline:hover:not(:disabled) {
        background-color: #e6f3f4;
      }

      .rb-btn-danger-outline {
        background-color: #ffffff;
        color: #93000a;
        border: 1px solid #ba1a1a;
      }

      .rb-btn-danger-outline:hover:not(:disabled) {
        background-color: #ffdad6;
      }

      @media (prefers-reduced-motion: reduce) {
        * {
          transition: none !important;
          animation: none !important;
        }
      }

      @media print {
        .no-print {
          display: none !important;
        }
        .rb-wrap {
          padding: 0;
        }
      }
    `,
  ],
  template: `
    <div class="rb-wrap" data-testid="facturation-note-page">
      <!-- En-tête de la note -->
      <header class="rb-card mb-6 p-4 md:p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 space-y-2">
            <div class="flex flex-wrap items-center gap-2.5">
              <a
                routerLink="/facturation"
                data-testid="back-to-comptoir"
                class="no-print rb-btn rb-btn-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                  >arrow_back</span
                >
                <span>Retour</span>
              </a>

              @if (note(); as n) {
                <h1 class="rb-title text-2xl md:text-3xl font-bold" data-testid="note-display-number">
                  {{ n.displayNumber }}
                </h1>

                <span
                  data-testid="note-status-badge"
                  class="inline-flex min-h-[28px] items-center rounded-full px-3 py-1 text-xs font-extrabold"
                  [class.bg-[#d8f0f2]]="n.status === 'PAID'"
                  [class.text-[#004f56]]="n.status === 'PAID'"
                  [class.bg-[#fef3c7]]="n.status === 'PARTIAL'"
                  [class.text-[#78350f]]="n.status === 'PARTIAL'"
                  [class.bg-[#ffdad6]]="n.status === 'OPEN' || n.status === 'CANCELLED'"
                  [class.text-[#93000a]]="n.status === 'OPEN' || n.status === 'CANCELLED'"
                >
                  {{ statusLabel(n) }}
                </span>

                @if (n.isIssued) {
                  <span
                    class="inline-flex min-h-[28px] items-center rounded-full bg-[#e3ecee] px-3 py-1 text-xs font-bold text-[#161d20]"
                  >
                    Facture verrouillée
                  </span>
                }
              }
            </div>

            @if (note(); as n) {
              <div class="text-sm font-semibold text-[#161d20]" data-testid="note-guest-summary">
                {{ n.guestName }} • Ch. {{ n.roomNumber }}
                @if (n.roomCategory) {
                  <span class="text-[#3d494a]">({{ n.roomCategory }})</span>
                }
                @if (n.phone) {
                  <span class="text-[#3d494a]">• {{ n.phone }}</span>
                }
              </div>
              <div class="text-xs font-medium text-[#3d494a]">
                Séjour : {{ n.stayLabel }} ({{ n.nights }} nuit(s), {{ n.adultsCount }} adulte(s))
              </div>
              @if (n.parentInvoiceId) {
                <div class="text-xs font-bold text-[#93000a]">
                  Avoir rattaché à la facture
                  <a
                    [routerLink]="['/facturation', n.parentInvoiceId]"
                    class="underline text-[#00666f]"
                  >
                    {{ n.parentInvoiceNumber || 'd’origine' }}
                  </a>
                  @if (n.reason) {
                    <span> — Motif : {{ n.reason }}</span>
                  }
                </div>
              }
            }
          </div>

          @if (note(); as n) {
            <div class="no-print flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="btn-download-pdf"
                (click)="service.downloadInvoicePdf(n.id, n.displayNumber)"
                class="rb-btn rb-btn-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                  >picture_as_pdf</span
                >
                <span>Télécharger le PDF</span>
              </button>

              <button
                type="button"
                data-testid="btn-print-note"
                (click)="printPage()"
                class="rb-btn rb-btn-outline"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">print</span>
                <span>Imprimer</span>
              </button>

              @if (!n.isIssued && n.documentType !== 'CREDIT_NOTE') {
                <button
                  type="button"
                  data-testid="btn-checkout"
                  [disabled]="service.busyAction() || !n.canCheckout"
                  (click)="runCheckout()"
                  class="rb-btn rb-btn-primary"
                  [title]="
                    n.canCheckout
                      ? 'Émettre la facture, clôturer le séjour et passer la chambre en Ménage'
                      : 'Reste à payer non nul : soldez la note avant le check-out'
                  "
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                    >check_circle</span
                  >
                  <span>Check-out</span>
                </button>
              }

              @if (service.canManageCreditsAndExport() && n.isIssued && n.documentType !== 'CREDIT_NOTE') {
                <button
                  type="button"
                  data-testid="btn-open-credit-note"
                  (click)="showCreditForm.set(!showCreditForm())"
                  class="rb-btn rb-btn-danger-outline"
                >
                  <span class="material-symbols-outlined text-[18px]" aria-hidden="true"
                    >assignment_return</span
                  >
                  <span>Créer un avoir</span>
                </button>
              }
            </div>
          }
        </div>

        <!-- Panneau Check-out forcé (DIRECTION uniquement quand reste > 0) -->
        @if (note(); as n) {
          @if (!n.isIssued && n.documentType !== 'CREDIT_NOTE' && !n.canCheckout && service.isDirection()) {
            <div
              class="no-print mt-4 rounded-xl border border-[#e0b878] bg-[#fff8ec] p-3.5"
              data-testid="forced-checkout-box"
            >
              <div class="text-xs font-extrabold uppercase tracking-wide text-[#78350f]">
                Check-out forcé (réservé DIRECTION — solde restant : {{ formatFcfa(n.balanceFcfa) }})
              </div>
              <div class="mt-2 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  data-testid="forced-checkout-reason"
                  [ngModel]="forcedCheckoutReason()"
                  (ngModelChange)="forcedCheckoutReason.set($event)"
                  placeholder="Motif obligatoire du check-out avec solde impayé..."
                  class="min-h-[42px] flex-1 rounded-lg border border-[#b78f48] bg-white px-3 text-sm text-[#161d20]"
                />
                <button
                  type="button"
                  data-testid="btn-confirm-forced-checkout"
                  [disabled]="service.busyAction() || forcedCheckoutReason().trim().length < 3"
                  (click)="runForcedCheckout()"
                  class="rb-btn rb-btn-danger-outline"
                >
                  Forcer le check-out
                </button>
              </div>
            </div>
          }

          <!-- Panneau Création d'avoir (DIRECTION & COMPTABLE sur facture émise) -->
          @if (showCreditForm() && service.canManageCreditsAndExport() && n.isIssued && n.documentType !== 'CREDIT_NOTE') {
            <div
              class="no-print mt-4 rounded-xl border border-[#ba1a1a] bg-[#fff5f5] p-4"
              data-testid="credit-note-form"
            >
              <h2 class="text-sm font-extrabold text-[#93000a]">
                Émettre un avoir sur {{ n.displayNumber }}
              </h2>
              <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div class="md:col-span-2">
                  <label for="credit-reason" class="block text-xs font-bold text-[#161d20]">
                    Motif obligatoire
                  </label>
                  <input
                    id="credit-reason"
                    data-testid="credit-note-reason"
                    type="text"
                    [ngModel]="creditReason()"
                    (ngModelChange)="creditReason.set($event)"
                    placeholder="Ex: Erreur de facturation nuitée / geste commercial"
                    class="mt-1 min-h-[42px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  />
                </div>
                <div>
                  <label for="credit-amount" class="block text-xs font-bold text-[#161d20]">
                    Montant FCFA (vide = total {{ formatFcfa(n.totalFcfa) }})
                  </label>
                  <input
                    id="credit-amount"
                    data-testid="credit-note-amount"
                    type="number"
                    min="1"
                    step="1"
                    [ngModel]="creditAmount()"
                    (ngModelChange)="creditAmount.set($event)"
                    placeholder="Total"
                    class="mt-1 min-h-[42px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                  />
                </div>
              </div>
              <div class="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="btn-submit-credit-note"
                  [disabled]="service.busyAction() || creditReason().trim().length < 3"
                  (click)="submitCreditNote()"
                  class="rb-btn rb-btn-primary"
                >
                  Confirmer la création de l'avoir
                </button>
                <button
                  type="button"
                  (click)="showCreditForm.set(false)"
                  class="rb-btn rb-btn-outline"
                >
                  Annuler
                </button>
              </div>
            </div>
          }

          @if (n.creditNotes && n.creditNotes.length > 0) {
            <div class="mt-4 rounded-xl border border-[#bdc9ca] bg-[#f8fbfc] p-3 text-xs font-semibold text-[#161d20]">
              <span class="font-extrabold">Avoirs associés :</span>
              @for (cn of n.creditNotes; track cn.id) {
                <a
                  [routerLink]="['/facturation', cn.id]"
                  class="ml-2 inline-flex items-center rounded bg-[#ffdad6] px-2 py-0.5 font-bold text-[#93000a] underline"
                >
                  {{ cn.invoiceNumber || 'Avoir' }} ({{ formatFcfa(cn.totalFcfa) }})
                </a>
              }
            </div>
          }
        }
      </header>

      <!-- Messages retour serveur -->
      @if (service.errorMessage()) {
        <div
          role="alert"
          data-testid="note-error-banner"
          class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ba1a1a] bg-[#ffdad6] px-4 py-3 text-sm font-semibold text-[#410002]"
        >
          <span>{{ service.errorMessage() }}</span>
          <button
            type="button"
            (click)="service.clearMessages()"
            class="min-h-[40px] rounded-lg border border-[#ba1a1a] bg-white px-3 text-xs font-bold text-[#93000a]"
          >
            Fermer
          </button>
        </div>
      }

      @if (service.successMessage()) {
        <div
          role="status"
          data-testid="note-success-banner"
          class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#00666f] bg-[#d8f0f2] px-4 py-3 text-sm font-semibold text-[#004f56]"
        >
          <span>{{ service.successMessage() }}</span>
          <button
            type="button"
            (click)="service.clearMessages()"
            class="min-h-[40px] rounded-lg border border-[#00666f] bg-white px-3 text-xs font-bold text-[#00666f]"
          >
            Fermer
          </button>
        </div>
      }

      @if (service.loadingNote() && !note()) {
        <div class="rb-card p-8 text-center text-sm font-semibold text-[#3d494a]">
          Chargement de la note de séjour...
        </div>
      } @else if (note(); as n) {
        <div class="rb-grid-note">
          <!-- COLONNE GAUCHE (7/12) : Ticket de caisse -->
          <section aria-label="Détail des prestations" class="space-y-5 min-w-0">
            <div class="rb-card p-4 md:p-6">
              <div class="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#d6e2e4] pb-3">
                <h2 class="rb-title text-xl font-bold text-[#161d20]">
                  Ticket détaillé des prestations
                </h2>
                <span class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                  Montants en entiers FCFA
                </span>
              </div>

              @for (group of groupedLines(); track group.category) {
                <div class="mb-5 last:mb-0" [attr.data-testid]="'category-group-' + group.category">
                  <div class="mb-2 flex items-center justify-between border-b border-[#e3ecee] pb-1.5">
                    <h3 class="text-xs font-extrabold uppercase tracking-wider text-[#00666f]">
                      {{ group.label }}
                    </h3>
                    <span class="text-xs font-extrabold text-[#161d20]">
                      Sous-total : {{ formatFcfa(group.subtotalFcfa) }}
                    </span>
                  </div>

                  <div class="divide-y divide-[#eef3f4]">
                    @for (line of group.lines; track line.id) {
                      <div class="flex flex-wrap items-center justify-between gap-2 py-2.5">
                        <div class="min-w-0 flex-1">
                          <div class="text-sm font-bold text-[#161d20]">
                            {{ line.description }}
                          </div>
                          <div class="text-xs font-medium text-[#3d494a]">
                            {{ line.dateLabel }} • Qté : {{ line.quantity }} ×
                            {{ formatFcfa(line.unitPriceFcfa) }}
                            @if (line.subDescription) {
                              <span> • {{ line.subDescription }}</span>
                            }
                          </div>
                        </div>

                        <div class="flex items-center gap-3">
                          <span class="text-sm font-extrabold text-[#161d20]">
                            {{ formatFcfa(line.totalPriceFcfa) }}
                          </span>
                          @if (!n.isIssued && n.documentType !== 'CREDIT_NOTE' && !line.isSystem) {
                            <button
                              type="button"
                              (click)="removeLine(line.id)"
                              [disabled]="service.busyAction()"
                              class="no-print min-h-[40px] rounded-lg border border-[#ba1a1a] px-2.5 text-xs font-bold text-[#93000a] hover:bg-[#ffdad6]"
                              [attr.aria-label]="'Supprimer la ligne ' + line.description"
                            >
                              Supprimer
                            </button>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (groupedLines().length === 0) {
                <p class="py-4 text-sm text-[#3d494a]">Aucune prestation enregistrée.</p>
              }

              <!-- Bloc des Totaux -->
              <div
                class="mt-6 rounded-xl border border-[#bdc9ca] bg-[#f8fbfc] p-4 space-y-2"
                data-testid="note-totals-block"
              >
                <div class="flex items-center justify-between text-sm font-medium text-[#3d494a]">
                  <span>Sous-total HT</span>
                  <span class="font-bold text-[#161d20]" data-testid="total-ht">{{
                    formatFcfa(n.subtotalHtFcfa)
                  }}</span>
                </div>
                <div class="flex items-center justify-between text-sm font-medium text-[#3d494a]">
                  <span>Remise</span>
                  <span class="font-bold text-[#161d20]" data-testid="total-discount">{{
                    n.discountFcfa > 0 ? '-' + formatFcfa(n.discountFcfa) : formatFcfa(0)
                  }}</span>
                </div>
                <div class="flex items-center justify-between text-sm font-medium text-[#3d494a]">
                  <span>Service ({{ n.serviceRatePercent }}%)</span>
                  <span class="font-bold text-[#161d20]" data-testid="total-service">{{
                    formatFcfa(n.serviceAmountFcfa)
                  }}</span>
                </div>
                <div class="flex items-center justify-between text-sm font-medium text-[#3d494a]">
                  <span>TVA ({{ n.vatRatePercent }}%)</span>
                  <span class="font-bold text-[#161d20]" data-testid="total-vat">{{
                    formatFcfa(n.vatAmountFcfa)
                  }}</span>
                </div>
                <div class="flex items-center justify-between text-sm font-medium text-[#3d494a]">
                  <span>Taxe de séjour</span>
                  <span class="font-bold text-[#161d20]" data-testid="total-tourism-tax">{{
                    formatFcfa(n.tourismTaxFcfa)
                  }}</span>
                </div>
                <div class="flex items-center justify-between border-t border-[#bdc9ca] pt-2.5">
                  <span class="rb-title text-lg font-bold text-[#161d20]">TOTAL TTC</span>
                  <span class="rb-title text-2xl font-bold text-[#00666f]" data-testid="total-ttc">
                    {{ formatFcfa(n.totalFcfa) }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-xs font-bold text-[#3d494a]">
                  <span>Déjà encaissé : {{ formatFcfa(n.paidAmountFcfa) }}</span>
                  <span [class.text-[#ba1a1a]]="n.balanceFcfa > 0">
                    Reste à payer : {{ formatFcfa(n.balanceFcfa) }}
                  </span>
                </div>
                @if (n.totalInWordsFr) {
                  <p class="pt-1 text-xs italic text-[#3d494a]">
                    Arrêté à : {{ n.totalInWordsFr }}
                  </p>
                }
              </div>

              <!-- Remise en ligne si note ouverte -->
              @if (!n.isIssued && n.documentType !== 'CREDIT_NOTE') {
                <div class="no-print mt-4 rounded-xl border border-[#d6e2e4] bg-white p-4">
                  <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <h3 class="text-xs font-extrabold uppercase tracking-wider text-[#161d20]">
                      Remise commerciale
                    </h3>
                    <span class="text-xs font-medium text-[#3d494a]">
                      Seuil standard : {{ n.settings.discountThresholdPercent ?? 0 }}% (au-delà : DIRECTION)
                    </span>
                  </div>
                  <div class="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      data-testid="discount-input"
                      [ngModel]="discountInput()"
                      (ngModelChange)="discountInput.set($event)"
                      placeholder="Remise en FCFA"
                      class="min-h-[42px] flex-1 rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                    />
                    <button
                      type="button"
                      data-testid="btn-apply-discount"
                      [disabled]="service.busyAction()"
                      (click)="applyDiscount()"
                      class="rb-btn rb-btn-outline"
                    >
                      Appliquer la remise
                    </button>
                  </div>
                </div>
              }
            </div>

            <!-- Formulaire visible Ajouter une ligne tant que note ouverte -->
            @if (!n.isIssued && n.documentType !== 'CREDIT_NOTE') {
              <div class="no-print rb-card p-4 md:p-6" data-testid="add-line-card">
                <h2 class="rb-title text-lg font-bold text-[#161d20]">Ajouter une ligne</h2>
                <p class="mt-0.5 text-xs font-medium text-[#3d494a]">
                  Ajoutez directement une prestation à cette note ouverte (montant en entiers FCFA).
                </p>

                <div class="mt-4 space-y-4">
                  <div>
                    <label for="line-description" class="block text-xs font-bold text-[#161d20]">
                      Libellé de la prestation
                    </label>
                    <input
                      id="line-description"
                      data-testid="add-line-description"
                      type="text"
                      [ngModel]="newLineDescription()"
                      (ngModelChange)="newLineDescription.set($event)"
                      placeholder="Ex: Blanchisserie express / Navette aéroport / Pass Piscine"
                      class="mt-1 min-h-[44px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                    />
                  </div>

                  <div>
                    <span class="block text-xs font-bold text-[#161d20] mb-1.5">Catégorie</span>
                    <div class="flex flex-wrap gap-2">
                      @for (cat of categoryOptions; track cat.value) {
                        <button
                          type="button"
                          [attr.data-testid]="'cat-btn-' + cat.value"
                          (click)="newLineCategory.set(cat.value)"
                          class="rb-btn"
                          [class.rb-btn-primary]="newLineCategory() === cat.value"
                          [class.rb-btn-outline]="newLineCategory() !== cat.value"
                        >
                          {{ cat.label }}
                        </button>
                      }
                    </div>
                  </div>

                  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label for="line-qty" class="block text-xs font-bold text-[#161d20]">
                        Quantité
                      </label>
                      <input
                        id="line-qty"
                        data-testid="add-line-qty"
                        type="number"
                        min="1"
                        step="1"
                        [ngModel]="newLineQty()"
                        (ngModelChange)="newLineQty.set($event)"
                        class="mt-1 min-h-[44px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                      />
                    </div>
                    <div>
                      <label for="line-price" class="block text-xs font-bold text-[#161d20]">
                        Prix unitaire (FCFA)
                      </label>
                      <input
                        id="line-price"
                        data-testid="add-line-price"
                        type="number"
                        min="1"
                        step="1"
                        [ngModel]="newLineUnitPrice()"
                        (ngModelChange)="newLineUnitPrice.set($event)"
                        placeholder="Ex: 5000"
                        class="mt-1 min-h-[44px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                      />
                    </div>
                  </div>

                  <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <span class="text-sm font-bold text-[#3d494a]">
                      Total ligne estimé :
                      <strong class="text-[#161d20]">{{ formatFcfa(estimatedLineTotal()) }}</strong>
                    </span>
                    <button
                      type="button"
                      data-testid="btn-submit-line"
                      [disabled]="service.busyAction() || !canSubmitNewLine()"
                      (click)="submitNewLine()"
                      class="rb-btn rb-btn-primary"
                    >
                      Ajouter la ligne
                    </button>
                  </div>
                </div>
              </div>
            }
          </section>

          <!-- COLONNE DROITE (5/12) : Panneau Encaissement fixe + Historique -->
          <aside class="rb-sticky-panel space-y-5">
            <div id="encaissement" class="no-print rb-card p-4 md:p-6" data-testid="encaissement-panel">
              <h2 class="rb-title text-xl font-bold text-[#161d20]">Encaissement</h2>

              <div class="mt-3 rounded-xl border border-[#d6e2e4] bg-[#f8fbfc] p-4">
                <div class="text-xs font-bold uppercase tracking-wider text-[#3d494a]">
                  Reste à payer
                </div>
                <div
                  class="rb-title mt-1 text-3xl font-bold"
                  [class.text-[#ba1a1a]]="n.balanceFcfa > 0"
                  [class.text-[#00666f]]="n.balanceFcfa <= 0"
                  data-testid="encaissement-balance"
                >
                  {{ formatFcfa(n.balanceFcfa) }}
                </div>
              </div>

              @if (service.pendingOfflinePaymentKeys().length > 0) {
                <div
                  class="mt-3 rounded-lg border border-[#b78f48] bg-[#fff8ec] px-3 py-2 text-xs font-bold text-[#78350f]"
                  data-testid="offline-pending-badge"
                >
                  {{ service.pendingOfflinePaymentKeys().length }} encaissement(s) en attente de synchronisation
                </div>
              }

              @if (n.documentType === 'CREDIT_NOTE') {
                <p class="mt-4 text-sm font-medium text-[#3d494a]">
                  Cet avoir est un document comptable définitif.
                </p>
              } @else if (n.balanceFcfa <= 0) {
                <div class="mt-4 rounded-xl border border-[#00666f] bg-[#e6f3f4] p-3 text-sm font-bold text-[#004f56]">
                  Cette note est entièrement soldée.
                  @if (!n.isIssued) {
                    <span>Vous pouvez procéder au Check-out dans l'en-tête.</span>
                  }
                </div>
              } @else {
                <div class="mt-4 space-y-4">
                  <!-- 5 grands boutons de mode de paiement toujours visibles -->
                  <div>
                    <span class="block text-xs font-bold text-[#161d20] mb-1.5">
                      Mode de paiement
                    </span>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="payment-method-buttons">
                      @for (m of paymentMethodOptions; track m.value) {
                        <button
                          type="button"
                          [attr.data-testid]="'pay-method-' + m.value"
                          (click)="selectedMethod.set(m.value)"
                          class="rb-btn text-center"
                          [class.rb-btn-primary]="selectedMethod() === m.value"
                          [class.rb-btn-outline]="selectedMethod() !== m.value"
                        >
                          {{ m.label }}
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Montant + bouton Solder -->
                  <div>
                    <label for="pay-amount" class="block text-xs font-bold text-[#161d20]">
                      Montant encaissé (FCFA)
                    </label>
                    <div class="mt-1 flex gap-2">
                      <input
                        id="pay-amount"
                        data-testid="payment-amount-input"
                        type="number"
                        min="1"
                        step="1"
                        [max]="n.balanceFcfa"
                        [ngModel]="paymentAmount()"
                        (ngModelChange)="paymentAmount.set($event)"
                        class="min-h-[44px] min-w-0 flex-1 rounded-lg border border-[#7c8c8e] bg-white px-3 text-base font-bold text-[#161d20]"
                      />
                      <button
                        type="button"
                        data-testid="btn-solder"
                        (click)="fillBalance(n.balanceFcfa)"
                        class="rb-btn rb-btn-outline"
                      >
                        Solder
                      </button>
                    </div>
                  </div>

                  <!-- Référence de transaction (sans aucun PAN carte) -->
                  <div>
                    <label for="pay-ref" class="block text-xs font-bold text-[#161d20]">
                      Référence de transaction (Orange Money, Wave, Virement)
                    </label>
                    <input
                      id="pay-ref"
                      data-testid="payment-ref-input"
                      type="text"
                      [ngModel]="paymentRef()"
                      (ngModelChange)="paymentRef.set($event)"
                      placeholder="Ex: WAV-2026-001 (jamais de numéro de carte)"
                      class="mt-1 min-h-[44px] w-full rounded-lg border border-[#7c8c8e] bg-white px-3 text-sm text-[#161d20]"
                    />
                    @if (panWarning()) {
                      <p class="mt-1 text-xs font-bold text-[#93000a]" role="alert">
                        Interdit : ne saisissez jamais un numéro complet de carte bancaire.
                      </p>
                    }
                  </div>

                  <button
                    type="button"
                    data-testid="btn-submit-payment"
                    [disabled]="service.busyAction() || !canSubmitPayment(n.balanceFcfa)"
                    (click)="submitPayment(n.id)"
                    class="rb-btn rb-btn-primary w-full text-base"
                  >
                    Encaisser {{ paymentAmountNum() > 0 ? formatFcfa(paymentAmountNum()) : '' }}
                  </button>
                </div>
              }
            </div>

            <!-- Historique des paiements -->
            <div class="rb-card p-4 md:p-6" data-testid="payment-history-card">
              <h2 class="rb-title text-lg font-bold text-[#161d20]">Historique des paiements</h2>

              @if (n.payments.length === 0) {
                <p class="mt-3 text-sm text-[#3d494a]">Aucun règlement enregistré pour le moment.</p>
              } @else {
                <div class="mt-3 divide-y divide-[#e3ecee]">
                  @for (pay of n.payments; track pay.id) {
                    <div class="py-3 space-y-1.5" [attr.data-testid]="'payment-row-' + pay.id">
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-sm font-extrabold text-[#161d20]">
                          {{ pay.methodLabel }}
                        </span>
                        <span
                          class="text-sm font-extrabold"
                          [class.text-[#93000a]]="pay.isReversal"
                          [class.text-[#00666f]]="!pay.isReversal"
                        >
                          {{ formatFcfa(pay.amountFcfa) }}
                        </span>
                      </div>

                      <div class="text-xs font-medium text-[#3d494a]">
                        {{ formatDate(pay.paidAt) }} • Encaissé par : {{ pay.receivedByName }}
                        @if (pay.transactionRef) {
                          <span> • Réf : {{ pay.transactionRef }}</span>
                        }
                      </div>

                      @if (pay.isReversal && pay.reversalReason) {
                        <div class="text-xs font-bold text-[#93000a]">
                          Écriture inverse — Motif : {{ pay.reversalReason }}
                        </div>
                      }

                      @if (
                        service.isDirection() &&
                        !pay.isReversal &&
                        !pay.alreadyReversed &&
                        !isAlreadyReversed(pay, n.payments)
                      ) {
                        <div class="no-print pt-1">
                          @if (reversingPaymentId() === pay.id) {
                            <div class="flex flex-col gap-2 rounded-lg border border-[#ba1a1a] bg-[#fff5f5] p-2.5">
                              <input
                                type="text"
                                data-testid="reversal-reason-input"
                                [ngModel]="reversalReason()"
                                (ngModelChange)="reversalReason.set($event)"
                                placeholder="Motif obligatoire d'annulation..."
                                class="min-h-[40px] w-full rounded border border-[#7c8c8e] bg-white px-2.5 text-xs text-[#161d20]"
                              />
                              <div class="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  data-testid="btn-confirm-reversal"
                                  [disabled]="service.busyAction() || reversalReason().trim().length < 3"
                                  (click)="confirmReversal(n.id, pay.id)"
                                  class="rb-btn rb-btn-danger-outline"
                                >
                                  Confirmer écriture inverse
                                </button>
                                <button
                                  type="button"
                                  (click)="cancelReversalForm()"
                                  class="rb-btn rb-btn-outline"
                                >
                                  Annuler
                                </button>
                              </div>
                            </div>
                          } @else {
                            <button
                              type="button"
                              [attr.data-testid]="'btn-reverse-payment-' + pay.id"
                              (click)="startReversal(pay.id)"
                              class="min-h-[40px] rounded-lg border border-[#ba1a1a] bg-white px-2.5 text-xs font-bold text-[#93000a] hover:bg-[#ffdad6]"
                            >
                              Annuler par écriture inverse (DIRECTION)
                            </button>
                          }
                        </div>
                      }
                    </div>
                  }
                </div>
              }
            </div>
          </aside>
        </div>

        <!-- Barre fixe en bas mobile (< 1024 px), au-dessus de la barre de navigation mobile (< 768 px) -->
        <div
          class="no-print lg:hidden fixed bottom-[64px] md:bottom-0 left-0 right-0 z-20 border-t border-[#bdc9ca] bg-white px-4 py-2.5 shadow-lg"
          data-testid="mobile-sticky-encaissement"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] font-bold uppercase text-[#3d494a]">Reste à payer</div>
              <div
                class="rb-title text-lg font-bold"
                [class.text-[#ba1a1a]]="n.balanceFcfa > 0"
                [class.text-[#00666f]]="n.balanceFcfa <= 0"
              >
                {{ formatFcfa(n.balanceFcfa) }}
              </div>
            </div>
            <button
              type="button"
              data-testid="mobile-scroll-encaisser"
              (click)="scrollToEncaissement()"
              class="rb-btn rb-btn-primary"
            >
              Encaisser
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class NoteSejourPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly service = inject(FacturationService);

  readonly categoryOptions = BILLING_CATEGORY_OPTIONS;
  readonly paymentMethodOptions = BILLING_PAYMENT_METHOD_OPTIONS;

  readonly note = this.service.currentNote;

  // Formulaire ajout de ligne
  readonly newLineDescription = signal<string>('');
  readonly newLineCategory = signal<BillingLineCategory>('AUTRES');
  readonly newLineQty = signal<number | string>(1);
  readonly newLineUnitPrice = signal<number | string>('');

  // Formulaire remise
  readonly discountInput = signal<number | string>(0);

  // Formulaire encaissement
  readonly selectedMethod = signal<BillingPaymentMethod>('CASH');
  readonly paymentAmount = signal<number | string>('');
  readonly paymentRef = signal<string>('');

  // Check-out forcé & avoir & écriture inverse
  readonly forcedCheckoutReason = signal<string>('');
  readonly showCreditForm = signal<boolean>(false);
  readonly creditReason = signal<string>('');
  readonly creditAmount = signal<number | string>('');
  readonly reversingPaymentId = signal<string | null>(null);
  readonly reversalReason = signal<string>('');

  readonly groupedLines = computed<GroupedCategoryLines[]>(() => {
    const n = this.note();
    if (!n) return [];
    const groups: GroupedCategoryLines[] = [];
    for (const opt of this.categoryOptions) {
      const catLines = n.lines.filter(
        (l) => l.rawCategory !== 'TAX' && l.category === opt.value,
      );
      if (catLines.length > 0) {
        groups.push({
          category: opt.value,
          label: opt.label,
          lines: catLines,
          subtotalFcfa: catLines.reduce((acc, l) => acc + l.totalPriceFcfa, 0),
        });
      }
    }
    return groups;
  });

  readonly estimatedLineTotal = computed<number>(() => {
    const q = Math.max(0, Math.round(Number(this.newLineQty()) || 0));
    const p = Math.max(0, Math.round(Number(this.newLineUnitPrice()) || 0));
    return q * p;
  });

  readonly canSubmitNewLine = computed<boolean>(() => {
    const desc = this.newLineDescription().trim();
    const q = Math.round(Number(this.newLineQty()) || 0);
    const p = Math.round(Number(this.newLineUnitPrice()) || 0);
    return desc.length >= 2 && q >= 1 && p >= 1;
  });

  readonly paymentAmountNum = computed<number>(() => {
    return Math.round(Number(this.paymentAmount()) || 0);
  });

  readonly panWarning = computed<boolean>(() => hasPotentialCardPan(this.paymentRef()));

  constructor() {
    effect(() => {
      const n = this.note();
      if (n) {
        this.discountInput.set(n.discountFcfa);
        if (n.balanceFcfa > 0) {
          this.paymentAmount.set(n.balanceFcfa);
        }
      }
    });
  }

  ngOnInit(): void {
    this.route?.paramMap?.subscribe?.((params) => {
      const id = params.get('id');
      if (id) {
        this.service.loadNote(id);
      }
    });
  }

  statusLabel(n: { status: string; documentType: string }): string {
    if (n.documentType === 'CREDIT_NOTE') return 'Avoir';
    switch (n.status) {
      case 'PAID':
        return 'Soldée';
      case 'PARTIAL':
        return 'Partielle';
      case 'CANCELLED':
        return 'Annulée';
      default:
        return 'À régler';
    }
  }

  formatFcfa(amount: number): string {
    return formatFcfaPlain(amount);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  canSubmitPayment(balanceFcfa: number): boolean {
    const amt = this.paymentAmountNum();
    return amt >= 1 && amt <= balanceFcfa && !this.panWarning();
  }

  fillBalance(balanceFcfa: number): void {
    this.paymentAmount.set(Math.max(0, Math.round(balanceFcfa)));
  }

  async submitNewLine(): Promise<void> {
    const n = this.note();
    if (!n || !this.canSubmitNewLine()) return;
    const ok = await this.service.addLine(n.id, {
      description: this.newLineDescription().trim(),
      category: this.newLineCategory(),
      quantity: Math.round(Number(this.newLineQty())),
      unitPriceFcfa: Math.round(Number(this.newLineUnitPrice())),
    });
    if (ok) {
      this.newLineDescription.set('');
      this.newLineQty.set(1);
      this.newLineUnitPrice.set('');
    }
  }

  async removeLine(lineId: string): Promise<void> {
    const n = this.note();
    if (!n) return;
    this.service.busyAction.set(true);
    this.service.clearMessages();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-role': this.service.currentRole(),
        'x-user-name': this.service.currentUserName(),
      };
      const res = await fetch(
        `/api/invoices/${encodeURIComponent(n.id)}/lines/${encodeURIComponent(lineId)}`,
        { method: 'DELETE', headers },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        this.service.errorMessage.set(body?.message || 'Suppression impossible.');
        return;
      }
      const updated = await res.json();
      this.service.currentNote.set(updated);
      this.service.successMessage.set('Ligne supprimée.');
    } catch {
      this.service.errorMessage.set('Erreur réseau lors de la suppression.');
    } finally {
      this.service.busyAction.set(false);
    }
  }

  async applyDiscount(): Promise<void> {
    const n = this.note();
    if (!n) return;
    const val = Math.max(0, Math.round(Number(this.discountInput()) || 0));
    await this.service.updateDiscount(n.id, val);
  }

  async submitPayment(invoiceId: string): Promise<void> {
    const n = this.note();
    if (!n || !this.canSubmitPayment(n.balanceFcfa)) return;
    const ok = await this.service.recordPayment(invoiceId, {
      method: this.selectedMethod(),
      amountFcfa: this.paymentAmountNum(),
      transactionRef: this.paymentRef().trim() || undefined,
    });
    if (ok) {
      this.paymentRef.set('');
    }
  }

  isAlreadyReversed(pay: BillingPaymentDetail, all: BillingPaymentDetail[]): boolean {
    return all.some((other) => other.reversedPaymentId === pay.id);
  }

  startReversal(paymentId: string): void {
    this.reversingPaymentId.set(paymentId);
    this.reversalReason.set('');
  }

  cancelReversalForm(): void {
    this.reversingPaymentId.set(null);
    this.reversalReason.set('');
  }

  async confirmReversal(invoiceId: string, paymentId: string): Promise<void> {
    const reason = this.reversalReason().trim();
    if (reason.length < 3) return;
    const ok = await this.service.reversePayment(invoiceId, paymentId, reason);
    if (ok) {
      this.cancelReversalForm();
    }
  }

  async runCheckout(): Promise<void> {
    const n = this.note();
    if (!n || !n.canCheckout) return;
    await this.service.checkout(n.id);
  }

  async runForcedCheckout(): Promise<void> {
    const n = this.note();
    if (!n || this.forcedCheckoutReason().trim().length < 3) return;
    const ok = await this.service.checkout(n.id, {
      force: true,
      reason: this.forcedCheckoutReason().trim(),
    });
    if (ok) {
      this.forcedCheckoutReason.set('');
    }
  }

  async submitCreditNote(): Promise<void> {
    const n = this.note();
    const reason = this.creditReason().trim();
    if (!n || reason.length < 3) return;
    const rawAmt = Number(this.creditAmount());
    const amountFcfa = rawAmt > 0 ? Math.round(rawAmt) : undefined;
    const created = await this.service.createCreditNote(n.id, reason, amountFcfa);
    if (created) {
      this.showCreditForm.set(false);
      this.creditReason.set('');
      this.creditAmount.set('');
      this.router.navigate(['/facturation', created.id]);
    }
  }

  printPage(): void {
    if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }

  scrollToEncaissement(): void {
    if (typeof document === 'undefined') return;
    const el = document.getElementById('encaissement');
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }
}
