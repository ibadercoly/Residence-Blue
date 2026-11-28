import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { getStarterProfileLabel } from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { AdministrationService, ManagedAccount } from './administration.service';

interface FilterPill {
  key: string;
  label: string;
  count: number;
}

@Component({
  selector: 'app-administration-liste-comptes-page',
  standalone: true,
  imports: [CommonModule, RouterLink, ModalShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  styles: [
    `
      .accounts-scroll-zone {
        max-height: 680px;
        overflow-y: scroll;
        overflow-x: hidden;
        scrollbar-gutter: stable;
        padding-right: 4px;
      }

      .accounts-cards-grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        gap: 16px;
      }

      @media (min-width: 900px) {
        .accounts-cards-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      .wrap-anywhere {
        overflow-wrap: anywhere;
        word-break: break-word;
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
        <!-- En-tête : titre + bouton + Créer un compte (56 px) -->
        <header class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0">
            <p class="text-sm font-semibold uppercase tracking-wider text-[#005e6a]">
              Administration
            </p>
            <h1 class="mt-1 font-headline text-2xl sm:text-3xl font-bold text-[#0A2540]">
              Comptes de l’équipe
            </h1>
          </div>
          <a
            routerLink="/administration/comptes/nouveau"
            data-testid="btn-create-account"
            class="inline-flex h-[56px] min-h-[56px] shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#005e6a] px-6 text-base font-bold text-white shadow-sm transition-colors hover:bg-[#004c56] focus:outline-none focus:ring-2 focus:ring-[#005e6a] focus:ring-offset-2"
          >
            <span class="material-symbols-outlined text-[22px]" aria-hidden="true">person_add</span>
            <span>+ Créer un compte</span>
          </a>
        </header>

        <!-- Carte Tarifs (DIRECTION uniquement — aucune nouvelle entrée de menu latéral) -->
        <section
          data-testid="admin-tarifs-card"
          class="rounded-2xl border border-[#005e6a]/25 bg-white p-5 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0"
        >
          <div class="flex items-start gap-3.5 min-w-0">
            <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#005e6a]/10 text-[#005e6a]">
              <span class="material-symbols-outlined text-[26px]" aria-hidden="true">payments</span>
            </div>
            <div class="min-w-0">
              <h2 class="text-xl font-bold text-[#0A2540]">Tarifs</h2>
              <p class="mt-0.5 text-base text-slate-600">
                Gérer la grille des chambres (Standard, Confort, Appartement) et les prestations (salle de séminaire, pauses).
              </p>
            </div>
          </div>
          <a
            routerLink="/administration/tarifs"
            data-testid="btn-open-admin-tarifs"
            class="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[#005e6a] px-5 py-2.5 text-base font-bold text-white hover:bg-[#004c56] focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
          >
            <span>Gérer les tarifs</span>
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_forward</span>
          </a>
        </section>

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

        <!-- Filtres et recherche (hors de la zone qui défile) -->
        <section class="space-y-3" data-testid="accounts-controls">
          <div class="relative w-full">
            <label for="search-accounts" class="sr-only">Rechercher par nom ou e-mail</label>
            <span
              class="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[22px] text-slate-400"
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
              class="h-[52px] min-h-[52px] w-full rounded-2xl border border-slate-300 bg-white pl-12 pr-4 text-[17px] text-[#0A2540] shadow-sm placeholder:text-slate-400 focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
            />
          </div>

          <div
            class="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Filtrer les comptes"
            data-testid="accounts-filter-pills"
          >
            @for (pill of filterPills(); track pill.key) {
              <button
                type="button"
                [attr.data-testid]="'filter-pill-' + pill.key"
                [attr.aria-pressed]="activeFilter() === pill.key"
                (click)="activeFilter.set(pill.key)"
                [class]="activeFilter() === pill.key
                  ? 'inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#0A2540] px-4 py-2 text-base font-bold text-white shadow-sm transition-colors'
                  : 'inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-[#0A2540] hover:bg-slate-50 transition-colors'"
              >
                <span>{{ pill.label }}</span>
                <span
                  [class]="activeFilter() === pill.key
                    ? 'rounded-full bg-white/20 px-2 py-0.5 text-sm font-bold text-white'
                    : 'rounded-full bg-slate-100 px-2 py-0.5 text-sm font-bold text-slate-700'"
                >
                  {{ pill.count }}
                </span>
              </button>
            }
          </div>
        </section>

        @if (loading()) {
          <div class="rounded-[22px] border border-slate-200 bg-white p-10 text-center text-base text-slate-600 shadow-sm">
            Chargement des comptes de l’établissement...
          </div>
        } @else if (filteredAccounts().length === 0) {
          <div class="rounded-[22px] border border-slate-200 bg-white p-10 text-center text-base text-slate-600 shadow-sm">
            Aucun compte ne correspond à votre filtre ou recherche.
          </div>
        } @else {
          <!-- Zone défilante des cartes (seule zone qui défile, barre verticale visible) -->
          <div class="accounts-scroll-zone" data-testid="accounts-scroll-zone">
            <div class="accounts-cards-grid" data-testid="accounts-cards-grid">
              @for (acc of filteredAccounts(); track acc.id) {
                <article
                  [attr.data-testid]="'account-card-' + acc.email"
                  [class]="acc.isActive
                    ? 'rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-4 min-w-0'
                    : 'rounded-[22px] border border-slate-200 bg-slate-50 p-5 opacity-75 shadow-sm flex flex-col justify-between gap-4 min-w-0'"
                >
                  <div class="space-y-3 min-w-0">
                    <!-- Identité : rond 56 px + nom 22 px + e-mail 17 px une seule fois -->
                    <div class="flex items-start gap-3.5 min-w-0">
                      <div
                        [class]="'h-[56px] w-[56px] rounded-full shrink-0 flex items-center justify-center text-lg font-bold ' + avatarClass(acc)"
                        aria-hidden="true"
                      >
                        {{ initialsFor(acc) }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-start gap-2 min-w-0">
                          @if (acc.isProtectedDirector) {
                            <span
                              class="material-symbols-outlined mt-1 text-[20px] text-amber-600 shrink-0"
                              title="Administrateur principal protégé"
                              aria-label="Administrateur principal protégé"
                            >
                              lock
                            </span>
                          }
                          <h2 class="wrap-anywhere text-[22px] font-bold leading-snug text-[#0A2540]">
                            {{ displayName(acc) }}
                          </h2>
                        </div>
                        <p class="wrap-anywhere mt-0.5 text-[17px] leading-snug text-slate-600">
                          {{ acc.email }}
                        </p>
                      </div>
                    </div>

                    <!-- Pastilles profil + état + protégé + connexion -->
                    <div class="flex flex-wrap items-center gap-2">
                      <span
                        [title]="fullProfileLabel(acc)"
                        class="inline-flex items-center whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-base font-semibold text-[#0A2540]"
                      >
                        {{ shortProfileLabel(acc) }}
                      </span>

                      @if (acc.isActive) {
                        <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-base font-semibold text-emerald-800">
                          <span class="h-2 w-2 rounded-full bg-emerald-600"></span>
                          Actif
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-slate-200 px-3 py-1 text-base font-semibold text-slate-700">
                          <span class="h-2 w-2 rounded-full bg-slate-500"></span>
                          Désactivé
                        </span>
                      }

                      @if (acc.isProtectedDirector) {
                        <span
                          data-testid="badge-protected-director"
                          class="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-amber-100 px-3 py-1 text-base font-semibold text-amber-900"
                        >
                          <span class="material-symbols-outlined text-[16px]" aria-hidden="true">verified_user</span>
                          <span>Compte protégé</span>
                        </span>
                      }

                      <span class="text-base text-slate-600">
                        {{ formatRelativeLastLogin(acc.lastLoginAt) }}
                      </span>
                    </div>
                  </div>

                  <!-- Actions : 1 bouton pour le directeur, 2 boutons égaux de 48 px pour les autres -->
                  <div class="pt-3 border-t border-slate-100">
                    @if (acc.isProtectedDirector) {
                      <a
                        routerLink="/administration/directeur"
                        data-testid="btn-edit-director-credentials"
                        class="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#005e6a]/35 bg-[#005e6a]/5 px-4 py-2 text-center text-base font-semibold leading-snug text-[#005e6a] whitespace-normal hover:bg-[#005e6a]/10 focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                      >
                        <span class="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">key</span>
                        <span>Modifier mon nom, e-mail et mot de passe</span>
                      </a>
                    } @else {
                      <div class="grid grid-cols-2 gap-3">
                        <a
                          [routerLink]="['/administration/comptes', acc.id]"
                          [attr.data-testid]="'btn-edit-' + acc.id"
                          class="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-[#005e6a] px-3 py-2 text-base font-bold text-white hover:bg-[#004c56] focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                        >
                          Modifier
                        </a>
                        @if (acc.isActive) {
                          <button
                            type="button"
                            (click)="openDeactivateModal(acc)"
                            [attr.data-testid]="'btn-deactivate-' + acc.id"
                            class="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-base font-semibold text-[#0A2540] hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                          >
                            Désactiver
                          </button>
                        } @else {
                          <button
                            type="button"
                            (click)="reactivateAccount(acc)"
                            [attr.data-testid]="'btn-reactivate-' + acc.id"
                            class="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-[#005e6a] bg-white px-3 py-2 text-base font-semibold text-[#005e6a] hover:bg-[#005e6a]/5 focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                          >
                            Réactiver
                          </button>
                        }
                      </div>
                    }
                  </div>
                </article>
              }
            </div>
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
              Le compte de <strong class="text-[#0A2540]">{{ deactivateTarget()?.fullName || deactivateTarget()?.email }}</strong>
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
              class="min-h-[44px] rounded-xl bg-[#005e6a] px-5 py-2 text-base font-bold text-white hover:bg-[#004c56] disabled:opacity-60"
            >
              {{ actionBusy() ? 'Désactivation...' : 'Confirmer la désactivation' }}
            </button>
          </div>
        </app-modal-shell>
      </div>
    }
  `,
})
export class AdministrationListeComptesPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdministrationService);
  private readonly route = inject(ActivatedRoute);

  readonly isDirector = computed(() => this.authService.isDirector());
  readonly firstAuthorizedRoute = computed(() => this.authService.getFirstAuthorizedRoute());

  readonly accounts = signal<ManagedAccount[]>([]);
  readonly loading = signal<boolean>(false);
  readonly searchQuery = signal<string>('');
  readonly activeFilter = signal<string>('ALL');
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);

  readonly deactivateTarget = signal<ManagedAccount | null>(null);
  readonly actionBusy = signal<boolean>(false);

  readonly filterPills = computed<FilterPill[]>(() => {
    const list = this.accounts();
    const pills: FilterPill[] = [{ key: 'ALL', label: 'Tous', count: list.length }];

    const profileMap = new Map<string, { label: string; count: number }>();
    for (const acc of list) {
      const lbl = this.shortProfileLabel(acc);
      const key = `PROFILE:${lbl}`;
      const existing = profileMap.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        profileMap.set(key, { label: lbl, count: 1 });
      }
    }

    for (const [key, info] of profileMap.entries()) {
      pills.push({ key, label: info.label, count: info.count });
    }

    const inactiveCount = list.filter((a) => !a.isActive).length;
    pills.push({ key: 'INACTIVE', label: 'Désactivés', count: inactiveCount });
    return pills;
  });

  readonly filteredAccounts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const filter = this.activeFilter();
    return this.accounts().filter((acc) => {
      if (filter === 'INACTIVE' && acc.isActive) return false;
      if (filter.startsWith('PROFILE:')) {
        const expectedLabel = filter.slice('PROFILE:'.length);
        if (this.shortProfileLabel(acc) !== expectedLabel) return false;
      }
      if (!q) return true;
      return (
        acc.fullName.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q)
      );
    });
  });

  async ngOnInit(): Promise<void> {
    const deletedMsg = this.route.snapshot.queryParamMap.get('deleted');
    if (deletedMsg) {
      this.feedbackMessage.set(
        `Le compte a été supprimé ; l’historique reste enregistré sous « ${deletedMsg} ».`,
      );
    }
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

  displayName(acc: ManagedAccount): string {
    const cleanName = (acc.fullName || '').trim();
    if (!cleanName || cleanName.toLowerCase() === acc.email.toLowerCase()) {
      return 'Compte sans nom';
    }
    return cleanName;
  }

  initialsFor(acc: ManagedAccount): string {
    const source = this.displayName(acc);
    if (source === 'Compte sans nom') {
      return acc.email.slice(0, 2).toUpperCase();
    }
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }

  fullProfileLabel(acc: ManagedAccount): string {
    if (acc.starterProfile === 'NON_PRINCIPAL_DIRECTION') {
      return 'Compte technique ou test (non principal)';
    }
    return getStarterProfileLabel(acc.starterProfile, acc.role);
  }

  shortProfileLabel(acc: ManagedAccount): string {
    if (acc.isProtectedDirector) {
      const title = (acc.jobTitle || '').toLowerCase();
      return title.includes('directrice') || (acc.fullName || '').toLowerCase().includes('aïssatou')
        ? 'Directrice'
        : 'Directeur';
    }
    if (acc.starterProfile === 'NON_PRINCIPAL_DIRECTION') {
      return 'Accès test';
    }
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
        const full = getStarterProfileLabel(acc.starterProfile, acc.role);
        if (full.includes('réception')) return 'Réception';
        if (full.includes('restaurant')) return 'Restaurant';
        return full;
      }
    }
  }

  avatarClass(acc: ManagedAccount): string {
    const lbl = this.shortProfileLabel(acc);
    switch (lbl) {
      case 'Directrice':
      case 'Directeur':
        return 'bg-amber-100 text-amber-900 border border-amber-200';
      case 'Réception':
        return 'bg-teal-100 text-[#005e6a] border border-teal-200';
      case 'Restaurant':
        return 'bg-orange-100 text-orange-900 border border-orange-200';
      case 'Cuisinier':
        return 'bg-lime-100 text-lime-900 border border-lime-200';
      case 'Ménage':
        return 'bg-violet-100 text-violet-900 border border-violet-200';
      case 'Technique':
        return 'bg-sky-100 text-sky-900 border border-sky-200';
      case 'Comptable':
        return 'bg-rose-100 text-rose-900 border border-rose-200';
      default:
        return 'bg-slate-200 text-slate-800 border border-slate-300';
    }
  }

  formatRelativeLastLogin(iso: string | null): string {
    if (!iso) return 'Jamais connecté';
    try {
      const d = new Date(iso);
      const toDakarDay = (dt: Date) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Africa/Dakar',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(dt);

      const now = new Date();
      const loginDay = toDakarDay(d);
      const today = toDakarDay(now);
      const yesterday = toDakarDay(new Date(now.getTime() - 86_400_000));

      if (loginDay === today) return 'Vu aujourd’hui';
      if (loginDay === yesterday) return 'Vue hier';

      return `Vu le ${new Intl.DateTimeFormat('fr-FR', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Africa/Dakar',
      }).format(d)}`;
    } catch {
      return 'Jamais connecté';
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
        `Le compte de ${target.fullName || target.email} a été désactivé et ses sessions ont été fermées.`,
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
      this.feedbackMessage.set(
        `Le compte de ${acc.fullName || acc.email} est à nouveau actif.`,
      );
      await this.loadAccounts();
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible de réactiver ce compte.',
      );
    } finally {
      this.actionBusy.set(false);
    }
  }
}
