import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { getStarterProfileLabel } from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { AdministrationService, ManagedAccount } from './administration.service';

@Component({
  selector: 'app-administration-comptes-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: [
    `
      .accounts-table-view {
        display: none;
      }

      .accounts-cards-view {
        display: block;
      }

      @media (min-width: 1180px) {
        .accounts-table-view {
          display: block;
        }

        .accounts-cards-view {
          display: none;
        }
      }

      .accounts-scroll-box {
        height: 820px;
        max-height: 820px;
        overflow-y: scroll;
        overflow-x: hidden;
        scrollbar-gutter: stable;
      }

      .accounts-fixed-table {
        table-layout: fixed;
        width: 100%;
        border-collapse: collapse;
      }

      .accounts-fixed-table thead,
      .accounts-fixed-table thead th {
        position: sticky;
        top: 0;
        z-index: 10;
        background-color: #f1f5f9;
        white-space: nowrap;
      }

      .accounts-fixed-table tbody tr {
        min-height: 72px;
      }

      .clamp-2-anywhere {
        overflow-wrap: anywhere;
        word-break: break-word;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
    `,
  ],
  template: `
    @if (!isDirector()) {
      <section
        data-testid="admin-forbidden-403"
        class="mx-auto max-w-xl my-12 rounded-2xl border border-rose-200 bg-white p-8 shadow-sm text-center"
      >
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <span class="material-symbols-outlined text-[30px]" aria-hidden="true">lock</span>
        </div>
        <h1 class="font-headline text-2xl font-bold text-[#0A2540]">Accès refusé (403)</h1>
        <p class="mt-2 text-base text-slate-600">
          L’administration des comptes est réservée uniquement au compte directeur.
        </p>
        <a
          [routerLink]="firstAuthorizedRoute()"
          class="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#005e6a] px-5 py-2.5 text-base font-semibold text-white hover:bg-[#004c56]"
        >
          <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
          Retour à mon espace
        </a>
      </section>
    } @else {
      <div class="mx-auto w-full max-w-[1380px] min-w-0 space-y-5 overflow-x-hidden">
        <!-- En-tête -->
        <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold uppercase tracking-wider text-[#005e6a]">
              Administration
            </p>
            <h1 class="mt-1 font-headline text-2xl sm:text-3xl font-bold text-[#0A2540]">
              Comptes et accès de l’équipe
            </h1>
            <p class="mt-1 text-base text-slate-600">
              Créez un compte, choisissez ce que chaque personne peut voir et agir, en toute simplicité.
            </p>
          </div>
          <a
            routerLink="/administration/comptes/nouveau"
            data-testid="btn-create-account"
            class="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#005e6a] px-5 py-2.5 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#004c56] focus:outline-none focus:ring-2 focus:ring-[#005e6a] focus:ring-offset-2"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">person_add</span>
            <span>+ Créer un compte</span>
          </a>
        </header>

        @if (feedbackMessage()) {
          <div
            role="status"
            data-testid="admin-feedback-banner"
            class="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
          >
            <span>{{ feedbackMessage() }}</span>
            <button
              type="button"
              (click)="feedbackMessage.set(null)"
              class="min-h-[44px] min-w-[44px] rounded-lg px-2 text-emerald-800 hover:bg-emerald-100"
              aria-label="Fermer le message"
            >
              Fermer
            </button>
          </div>
        }

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="admin-error-banner"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-medium text-rose-900"
          >
            {{ errorMessage() }}
          </div>
        }

        <!-- Barre de recherche et compteur (hors de la zone qui défile) -->
        <div
          data-testid="accounts-search-bar"
          class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="relative flex-1 min-w-0">
            <label for="search-accounts" class="sr-only">Rechercher un compte par nom ou e-mail</label>
            <span
              class="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[22px] text-slate-400"
              aria-hidden="true"
            >
              search
            </span>
            <input
              id="search-accounts"
              data-testid="admin-search-input"
              type="search"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              placeholder="Rechercher par nom ou e-mail..."
              class="min-h-[44px] w-full rounded-xl border border-slate-300 bg-slate-50/70 pl-11 pr-4 py-2 text-base text-[#0A2540] placeholder:text-slate-400 focus:border-[#005e6a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
            />
          </div>
          <div
            data-testid="accounts-count"
            class="text-base font-semibold text-slate-700 shrink-0 whitespace-nowrap"
          >
            {{ filteredAccounts().length }} compte(s)
          </div>
        </div>

        @if (loading()) {
          <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-base text-slate-600 shadow-sm">
            Chargement des comptes de l’établissement...
          </div>
        } @else if (filteredAccounts().length === 0) {
          <div class="rounded-2xl border border-slate-200 bg-white p-10 text-center text-base text-slate-600 shadow-sm">
            Aucun compte ne correspond à votre recherche.
          </div>
        } @else {
          <!-- Tableau (>= 1180 px) : table-layout fixed, 5 colonnes, scrollbar verticale visible, en-tête collant -->
          <div
            data-testid="accounts-table-container"
            class="accounts-table-view w-full min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <div class="accounts-scroll-box w-full" data-testid="accounts-scroll-box">
              <table class="accounts-fixed-table text-left">
                <colgroup>
                  <col style="width: 40%" />
                  <col style="width: 18%" />
                  <col style="width: 10%" />
                  <col style="width: 14%" />
                  <col style="width: 18%" />
                </colgroup>
                <thead class="border-b border-slate-200">
                  <tr>
                    <th scope="col" class="px-3.5 py-3 text-base font-bold text-[#0A2540]">Compte</th>
                    <th scope="col" class="px-3 py-3 text-base font-bold text-[#0A2540]">Profil</th>
                    <th scope="col" class="px-3 py-3 text-base font-bold text-[#0A2540]">État</th>
                    <th scope="col" class="px-3 py-3 text-base font-bold text-[#0A2540]">Connexion</th>
                    <th scope="col" class="px-3 py-3 text-base font-bold text-[#0A2540]">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (acc of filteredAccounts(); track acc.id) {
                    <tr
                      [attr.data-testid]="'account-row-' + acc.email"
                      class="hover:bg-slate-50/80 transition-colors align-middle"
                    >
                      <!-- 1. Compte (40%) : nom en gras + e-mail en dessous -->
                      <td class="px-3.5 py-2.5 align-middle min-w-0">
                        <div class="flex items-start gap-2 min-w-0">
                          @if (acc.isProtectedDirector) {
                            <span
                              class="material-symbols-outlined mt-0.5 text-[20px] text-amber-600 shrink-0"
                              title="Compte directeur protégé"
                              aria-label="Compte directeur protégé"
                            >
                              lock
                            </span>
                          }
                          <div class="min-w-0 flex-1">
                            <div
                              tabindex="0"
                              [title]="acc.fullName"
                              [attr.aria-label]="acc.fullName"
                              class="clamp-2-anywhere text-base font-bold text-[#0A2540] leading-snug focus:outline-none focus:ring-2 focus:ring-[#005e6a]/40 rounded"
                            >
                              {{ acc.fullName }}
                            </div>
                            <div
                              tabindex="0"
                              [title]="acc.email"
                              [attr.aria-label]="acc.email"
                              class="clamp-2-anywhere mt-0.5 text-base text-slate-600 leading-snug focus:outline-none focus:ring-2 focus:ring-[#005e6a]/40 rounded"
                            >
                              {{ acc.email }}
                            </div>
                          </div>
                        </div>
                      </td>

                      <!-- 2. Profil (18%) : pastille compacte sur 1 ligne, nom complet en infobulle -->
                      <td class="px-3 py-2.5 align-middle">
                        <span
                          tabindex="0"
                          [title]="profileLabel(acc)"
                          [attr.aria-label]="profileLabel(acc)"
                          class="inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-base font-semibold text-[#0A2540] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/40"
                        >
                          {{ compactProfileLabel(acc) }}
                        </span>
                      </td>

                      <!-- 3. État (10%) -->
                      <td class="px-3 py-2.5 align-middle">
                        @if (acc.isActive) {
                          <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-base font-semibold text-emerald-800">
                            <span class="h-2 w-2 rounded-full bg-emerald-600 shrink-0"></span>
                            <span>Actif</span>
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-200 px-2.5 py-1 text-base font-semibold text-slate-700">
                            <span class="h-2 w-2 rounded-full bg-slate-500 shrink-0"></span>
                            <span>Désactivé</span>
                          </span>
                        }
                      </td>

                      <!-- 4. Connexion (14%) : format court sur 1 ligne -->
                      <td class="px-3 py-2.5 align-middle text-base text-slate-700 whitespace-nowrap">
                        {{ formatShortLastLogin(acc.lastLoginAt) }}
                      </td>

                      <!-- 5. Actions (18%) : 3 boutons visibles min-h 44px, icône + mot, max 2 lignes alignées à gauche -->
                      <td class="px-1.5 py-2 align-middle">
                        <div class="flex flex-wrap items-center justify-start gap-1">
                          @if (acc.isProtectedDirector) {
                            <a
                              routerLink="/administration/directeur"
                              data-testid="btn-edit-director-credentials"
                              class="inline-flex min-h-[44px] max-w-full items-center gap-1.5 rounded-xl border border-[#005e6a]/35 bg-[#005e6a]/5 px-2.5 py-1 text-[14px] font-semibold text-[#005e6a] leading-tight hover:bg-[#005e6a]/10 focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                            >
                              <span class="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">key</span>
                              <span class="break-words">Modifier l’e-mail et le mot de passe</span>
                            </a>
                          } @else {
                            <a
                              [routerLink]="['/administration/comptes', acc.id]"
                              [attr.data-testid]="'btn-edit-' + acc.id"
                              class="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-slate-300 bg-white px-1.5 py-1 text-[13px] font-semibold text-[#0A2540] whitespace-nowrap hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                            >
                              <span class="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">edit</span>
                              <span>Modifier</span>
                            </a>
                            @if (acc.isActive) {
                              <button
                                type="button"
                                (click)="openDeactivateModal(acc)"
                                [attr.data-testid]="'btn-deactivate-' + acc.id"
                                class="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-1.5 py-1 text-[13px] font-semibold text-amber-900 whitespace-nowrap hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-600"
                              >
                                <span class="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">person_off</span>
                                <span>Désactiver</span>
                              </button>
                            } @else {
                              <button
                                type="button"
                                (click)="reactivateAccount(acc)"
                                [attr.data-testid]="'btn-reactivate-' + acc.id"
                                class="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-emerald-300 bg-emerald-50 px-1.5 py-1 text-[13px] font-semibold text-emerald-900 whitespace-nowrap hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                              >
                                <span class="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">person_check</span>
                                <span>Réactiver</span>
                              </button>
                            }
                            <button
                              type="button"
                              (click)="openDeleteModal(acc)"
                              [attr.data-testid]="'btn-delete-' + acc.id"
                              class="inline-flex min-h-[44px] items-center gap-1 rounded-xl border border-rose-300 bg-rose-50 px-1.5 py-1 text-[13px] font-semibold text-rose-800 whitespace-nowrap hover:bg-rose-100 focus:outline-none focus:ring-2 focus:ring-rose-600"
                            >
                              <span class="material-symbols-outlined text-[16px] shrink-0" aria-hidden="true">delete</span>
                              <span>Supprimer</span>
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Cartes (< 1180 px) : nom/e-mail + profil + état sur 1re ligne, connexion, puis 3 boutons visibles -->
          <div class="accounts-cards-view space-y-3.5" data-testid="accounts-mobile-cards">
            @for (acc of filteredAccounts(); track acc.id) {
              <article
                [attr.data-testid]="'account-card-' + acc.email"
                class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 min-w-0"
              >
                <div class="flex flex-wrap items-start justify-between gap-2.5 min-w-0">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start gap-2 min-w-0">
                      @if (acc.isProtectedDirector) {
                        <span class="material-symbols-outlined mt-0.5 text-[20px] text-amber-600 shrink-0" aria-hidden="true">lock</span>
                      }
                      <h2
                        [title]="acc.fullName"
                        class="clamp-2-anywhere text-base font-bold text-[#0A2540]"
                      >
                        {{ acc.fullName }}
                      </h2>
                    </div>
                    <p
                      [title]="acc.email"
                      class="clamp-2-anywhere mt-0.5 text-base text-slate-600"
                    >
                      {{ acc.email }}
                    </p>
                  </div>

                  <div class="flex flex-wrap items-center gap-2 shrink-0">
                    <span
                      [title]="profileLabel(acc)"
                      class="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-base font-semibold text-[#0A2540]"
                    >
                      {{ compactProfileLabel(acc) }}
                    </span>
                    @if (acc.isActive) {
                      <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1 text-base font-semibold text-emerald-800">
                        <span class="h-2 w-2 rounded-full bg-emerald-600"></span>
                        Actif
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-200 px-2.5 py-1 text-base font-semibold text-slate-700">
                        <span class="h-2 w-2 rounded-full bg-slate-500"></span>
                        Désactivé
                      </span>
                    }
                  </div>
                </div>

                <div class="text-base text-slate-700">
                  <span class="font-semibold">Connexion :</span> {{ formatShortLastLogin(acc.lastLoginAt) }}
                </div>

                <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                  @if (acc.isProtectedDirector) {
                    <a
                      routerLink="/administration/directeur"
                      class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#005e6a]/30 bg-[#005e6a]/5 px-3.5 py-2 text-base font-semibold text-[#005e6a]"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">key</span>
                      <span>Modifier l’e-mail et le mot de passe</span>
                    </a>
                  } @else {
                    <a
                      [routerLink]="['/administration/comptes', acc.id]"
                      class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-semibold text-[#0A2540]"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
                      <span>Modifier</span>
                    </a>
                    @if (acc.isActive) {
                      <button
                        type="button"
                        (click)="openDeactivateModal(acc)"
                        class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-base font-semibold text-amber-900"
                      >
                        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">person_off</span>
                        <span>Désactiver</span>
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="reactivateAccount(acc)"
                        class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-base font-semibold text-emerald-900"
                      >
                        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">person_check</span>
                        <span>Réactiver</span>
                      </button>
                    }
                    <button
                      type="button"
                      (click)="openDeleteModal(acc)"
                      class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-base font-semibold text-rose-800"
                    >
                      <span class="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                      <span>Supprimer</span>
                    </button>
                  }
                </div>
              </article>
            }
          </div>
        }

        <!-- Modale Désactivation -->
        <app-modal-shell
          [isOpen]="deactivateTarget() !== null"
          title="Désactiver ce compte ?"
          subtitle="Cette action est réversible à tout moment"
          icon="person_off"
          maxWidth="540px"
          testId="modal-deactivate-account"
          (closed)="deactivateTarget.set(null)"
        >
          <div modal-body class="space-y-3 text-base text-slate-700">
            <p>
              Le compte de <strong class="text-[#0A2540]">{{ deactivateTarget()?.fullName }}</strong>
              ne pourra plus se connecter.
            </p>
            <p>
              Toutes ses sessions ouvertes et ses écrans en temps réel seront fermés immédiatement, tout en conservant son historique.
            </p>
          </div>
          <div modal-footer class="flex w-full flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              (click)="deactivateTarget.set(null)"
              class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              [disabled]="actionBusy()"
              data-testid="confirm-deactivate-btn"
              (click)="confirmDeactivate()"
              class="min-h-[44px] rounded-xl bg-amber-600 px-5 py-2 text-base font-bold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              {{ actionBusy() ? 'Désactivation...' : 'Confirmer la désactivation' }}
            </button>
          </div>
        </app-modal-shell>

        <!-- Modale Suppression sécurisée -->
        <app-modal-shell
          [isOpen]="deleteTarget() !== null"
          title="Supprimer définitivement ce compte ?"
          subtitle="L’historique des factures, paiements et commandes reste conservé"
          icon="delete_forever"
          maxWidth="580px"
          testId="modal-delete-account"
          (closed)="closeDeleteModal()"
        >
          <div modal-body class="space-y-4 text-base text-slate-700">
            <p>
              Le compte de <strong class="text-[#0A2540]">{{ deleteTarget()?.fullName }}</strong>
              sera retiré de la liste et son e-mail sera libéré. Les factures, paiements, commandes, réservations et le journal garderont son nom suivi de <strong>« (compte supprimé) »</strong>.
            </p>

            @if (modalError()) {
              <div role="alert" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-medium text-rose-800">
                {{ modalError() }}
              </div>
            }

            <div class="space-y-1.5">
              <label for="delete-confirm-name" class="block text-base font-semibold text-[#0A2540]">
                1. Recopiez le nom exact du compte : « {{ deleteTarget()?.fullName }} »
              </label>
              <input
                id="delete-confirm-name"
                data-testid="delete-confirm-name"
                type="text"
                [value]="deleteConfirmName()"
                (input)="deleteConfirmName.set($any($event.target).value)"
                class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-rose-500 focus:outline-none"
                autocomplete="off"
              />
            </div>

            <div class="space-y-1.5">
              <label for="delete-director-password" class="block text-base font-semibold text-[#0A2540]">
                2. Saisissez votre mot de passe de directeur
              </label>
              <input
                id="delete-director-password"
                data-testid="delete-director-password"
                type="password"
                [value]="deleteDirectorPassword()"
                (input)="deleteDirectorPassword.set($any($event.target).value)"
                class="min-h-[44px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-rose-500 focus:outline-none"
                autocomplete="current-password"
              />
            </div>
          </div>

          <div modal-footer class="flex w-full flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              (click)="closeDeleteModal()"
              class="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              [disabled]="actionBusy()"
              data-testid="confirm-delete-btn"
              (click)="confirmDelete()"
              class="min-h-[44px] rounded-xl bg-rose-600 px-5 py-2 text-base font-bold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {{ actionBusy() ? 'Suppression...' : 'Supprimer le compte' }}
            </button>
          </div>
        </app-modal-shell>
      </div>
    }
  `,
})
export class AdministrationComptesPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdministrationService);

  readonly isDirector = computed(() => this.authService.isDirector());
  readonly firstAuthorizedRoute = computed(() => this.authService.getFirstAuthorizedRoute());

  readonly accounts = signal<ManagedAccount[]>([]);
  readonly loading = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly deactivateTarget = signal<ManagedAccount | null>(null);
  readonly deleteTarget = signal<ManagedAccount | null>(null);
  readonly deleteConfirmName = signal<string>('');
  readonly deleteDirectorPassword = signal<string>('');
  readonly modalError = signal<string | null>(null);
  readonly actionBusy = signal<boolean>(false);

  readonly filteredAccounts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.accounts();
    if (!q) return list;
    return list.filter(
      (a) =>
        a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  });

  async ngOnInit(): Promise<void> {
    if (!this.isDirector()) return;
    await this.loadAccounts();
  }

  async loadAccounts(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const list = await this.adminService.listAccounts();
      this.accounts.set(list);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Erreur lors du chargement des comptes.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement)?.value ?? '';
    this.searchQuery.set(val);
  }

  profileLabel(acc: ManagedAccount): string {
    return getStarterProfileLabel(acc.starterProfile, acc.role);
  }

  compactProfileLabel(acc: ManagedAccount): string {
    if (acc.isProtectedDirector || acc.role === 'DIRECTION') return 'Directeur';
    switch (acc.starterProfile) {
      case 'ASSISTANT_RECEPTION':
        return 'Réception';
      case 'ASSISTANT_RESTAURANT':
        return 'Restaurant';
      case 'CUISINIER':
        return 'Cuisinier';
      case 'MENAGE':
        return 'Ménage';
      case 'TECHNIQUE':
        return 'Technique';
      case 'COMPTABLE':
        return 'Comptable';
      default: {
        const full = this.profileLabel(acc);
        if (full.includes('réception')) return 'Réception';
        if (full.includes('restaurant')) return 'Restaurant';
        return full;
      }
    }
  }

  formatShortLastLogin(iso: string | null): string {
    if (!iso) return 'Jamais connecté';
    try {
      const d = new Date(iso);
      const dayMonth = new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Africa/Dakar',
      }).format(d);
      const time = new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Dakar',
      }).format(d);
      return `${dayMonth} ${time}`;
    } catch {
      return iso;
    }
  }

  openDeactivateModal(acc: ManagedAccount): void {
    this.deactivateTarget.set(acc);
  }

  async confirmDeactivate(): Promise<void> {
    const target = this.deactivateTarget();
    if (!target) return;
    this.actionBusy.set(true);
    this.errorMessage.set(null);
    try {
      await this.adminService.deactivateAccount(target.id);
      this.deactivateTarget.set(null);
      this.feedbackMessage.set(
        `Le compte de ${target.fullName} a été désactivé et ses sessions ont été fermées.`,
      );
      await this.loadAccounts();
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible de désactiver ce compte.',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  async reactivateAccount(acc: ManagedAccount): Promise<void> {
    this.actionBusy.set(true);
    this.errorMessage.set(null);
    try {
      await this.adminService.reactivateAccount(acc.id);
      this.feedbackMessage.set(`Le compte de ${acc.fullName} est à nouveau actif.`);
      await this.loadAccounts();
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible de réactiver ce compte.',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }

  openDeleteModal(acc: ManagedAccount): void {
    this.deleteTarget.set(acc);
    this.deleteConfirmName.set('');
    this.deleteDirectorPassword.set('');
    this.modalError.set(null);
  }

  closeDeleteModal(): void {
    this.deleteTarget.set(null);
    this.modalError.set(null);
    this.deleteDirectorPassword.set('');
  }

  async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    if (!this.deleteConfirmName().trim() || !this.deleteDirectorPassword()) {
      this.modalError.set('Saisissez le nom exact du compte et votre mot de passe.');
      return;
    }
    this.actionBusy.set(true);
    this.modalError.set(null);
    try {
      const res = await this.adminService.deleteAccount(
        target.id,
        this.deleteConfirmName().trim(),
        this.deleteDirectorPassword(),
      );
      this.closeDeleteModal();
      this.feedbackMessage.set(
        `Compte supprimé : l’historique reste enregistré sous « ${res.deletedDisplayName} ».`,
      );
      await this.loadAccounts();
    } catch (err) {
      this.modalError.set(
        err instanceof Error ? err.message : 'Échec de la suppression du compte.',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }
}
