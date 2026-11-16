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
      <div class="mx-auto w-full max-w-[1380px] space-y-6 overflow-x-hidden">
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

        <!-- Barre de recherche -->
        <div class="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
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
          <div class="text-base font-medium text-slate-600 shrink-0">
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
          <!-- Tableau Desktop & Tablette (>= 768 px) : défilement vertical interne 15 lignes visibles, en-tête collant -->
          <div
            data-testid="accounts-table-container"
            class="hidden md:block rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
          >
            <div class="max-h-[840px] overflow-y-auto [scrollbar-gutter:stable]">
              <table class="w-full border-collapse text-left">
                <thead class="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th scope="col" class="px-4 py-3.5 text-base font-bold text-[#0A2540]">Nom</th>
                    <th scope="col" class="px-4 py-3.5 text-base font-bold text-[#0A2540]">E-mail</th>
                    <th scope="col" class="px-4 py-3.5 text-base font-bold text-[#0A2540]">Profil</th>
                    <th scope="col" class="px-4 py-3.5 text-base font-bold text-[#0A2540]">État</th>
                    <th scope="col" class="px-4 py-3.5 text-base font-bold text-[#0A2540]">Dernière connexion</th>
                    <th scope="col" class="px-4 py-3.5 text-base font-bold text-[#0A2540] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (acc of filteredAccounts(); track acc.id) {
                    <tr
                      [attr.data-testid]="'account-row-' + acc.email"
                      class="hover:bg-slate-50/80 transition-colors"
                    >
                      <td class="px-4 py-3.5 text-base font-semibold text-[#0A2540]">
                        <div class="flex items-center gap-2">
                          @if (acc.isProtectedDirector) {
                            <span
                              class="material-symbols-outlined text-[20px] text-amber-600 shrink-0"
                              title="Compte directeur protégé"
                              aria-label="Compte directeur protégé"
                            >
                              lock
                            </span>
                          }
                          <span>{{ acc.fullName }}</span>
                        </div>
                      </td>
                      <td class="px-4 py-3.5 text-base text-slate-700">
                        {{ acc.email }}
                      </td>
                      <td class="px-4 py-3.5 text-base text-slate-700">
                        {{ profileLabel(acc) }}
                      </td>
                      <td class="px-4 py-3.5 text-base">
                        @if (acc.isActive) {
                          <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-800">
                            <span class="h-2 w-2 rounded-full bg-emerald-600"></span>
                            Actif
                          </span>
                        } @else {
                          <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-base font-semibold text-slate-700">
                            <span class="h-2 w-2 rounded-full bg-slate-500"></span>
                            Désactivé
                          </span>
                        }
                      </td>
                      <td class="px-4 py-3.5 text-base text-slate-600">
                        {{ formatLastLogin(acc.lastLoginAt) }}
                      </td>
                      <td class="px-4 py-3.5">
                        <div class="flex flex-wrap items-center justify-end gap-2">
                          @if (acc.isProtectedDirector) {
                            <a
                              routerLink="/administration/directeur"
                              data-testid="btn-edit-director-credentials"
                              class="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[#005e6a]/30 bg-[#005e6a]/5 px-3.5 py-2 text-base font-semibold text-[#005e6a] hover:bg-[#005e6a]/10"
                            >
                              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">key</span>
                              <span>Modifier l’e-mail et le mot de passe</span>
                            </a>
                          } @else {
                            <a
                              [routerLink]="['/administration/comptes', acc.id]"
                              [attr.data-testid]="'btn-edit-' + acc.id"
                              class="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-base font-semibold text-[#0A2540] hover:bg-slate-50"
                            >
                              Modifier
                            </a>
                            @if (acc.isActive) {
                              <button
                                type="button"
                                (click)="openDeactivateModal(acc)"
                                [attr.data-testid]="'btn-deactivate-' + acc.id"
                                class="inline-flex min-h-[44px] items-center rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-base font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Désactiver
                              </button>
                            } @else {
                              <button
                                type="button"
                                (click)="reactivateAccount(acc)"
                                [attr.data-testid]="'btn-reactivate-' + acc.id"
                                class="inline-flex min-h-[44px] items-center rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-base font-semibold text-emerald-900 hover:bg-emerald-100"
                              >
                                Réactiver
                              </button>
                            }
                            <button
                              type="button"
                              (click)="openDeleteModal(acc)"
                              [attr.data-testid]="'btn-delete-' + acc.id"
                              class="inline-flex min-h-[44px] items-center rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2 text-base font-semibold text-rose-800 hover:bg-rose-100"
                            >
                              Supprimer
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

          <!-- Cartes Mobile (< 768 px) -->
          <div class="md:hidden space-y-4" data-testid="accounts-mobile-cards">
            @for (acc of filteredAccounts(); track acc.id) {
              <article class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      @if (acc.isProtectedDirector) {
                        <span class="material-symbols-outlined text-[20px] text-amber-600" aria-hidden="true">lock</span>
                      }
                      <h2 class="text-base font-bold text-[#0A2540] truncate">{{ acc.fullName }}</h2>
                    </div>
                    <p class="mt-0.5 text-base text-slate-600 break-all">{{ acc.email }}</p>
                  </div>
                  @if (acc.isActive) {
                    <span class="shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-800">
                      Actif
                    </span>
                  } @else {
                    <span class="shrink-0 rounded-full bg-slate-200 px-3 py-1 text-base font-semibold text-slate-700">
                      Désactivé
                    </span>
                  }
                </div>

                <div class="text-base text-slate-700 space-y-1">
                  <p><span class="font-semibold">Profil :</span> {{ profileLabel(acc) }}</p>
                  <p><span class="font-semibold">Dernière connexion :</span> {{ formatLastLogin(acc.lastLoginAt) }}</p>
                </div>

                <div class="flex flex-col gap-2 pt-2 border-t border-slate-100">
                  @if (acc.isProtectedDirector) {
                    <a
                      routerLink="/administration/directeur"
                      class="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-[#005e6a]/30 bg-[#005e6a]/5 px-4 py-2 text-base font-semibold text-[#005e6a]"
                    >
                      Modifier l’e-mail et le mot de passe
                    </a>
                  } @else {
                    <a
                      [routerLink]="['/administration/comptes', acc.id]"
                      class="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-[#0A2540]"
                    >
                      Modifier
                    </a>
                    @if (acc.isActive) {
                      <button
                        type="button"
                        (click)="openDeactivateModal(acc)"
                        class="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-base font-semibold text-amber-900"
                      >
                        Désactiver
                      </button>
                    } @else {
                      <button
                        type="button"
                        (click)="reactivateAccount(acc)"
                        class="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-base font-semibold text-emerald-900"
                      >
                        Réactiver
                      </button>
                    }
                    <button
                      type="button"
                      (click)="openDeleteModal(acc)"
                      class="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-base font-semibold text-rose-800"
                    >
                      Supprimer
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

  formatLastLogin(iso: string | null): string {
    if (!iso) return 'Jamais connecté';
    try {
      return new Intl.DateTimeFormat('fr-FR', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(iso));
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
