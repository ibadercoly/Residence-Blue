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
import { AuthService } from '../../core/services/auth.service';
import { AdministrationService } from './administration.service';

@Component({
  selector: 'app-administration-directeur-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full min-w-0' },
  template: `
    @if (!isDirector()) {
      <section
        data-testid="admin-forbidden-403"
        class="mx-auto max-w-xl my-12 rounded-2xl border border-rose-200 bg-white p-8 shadow-sm text-center"
      >
        <h1 class="font-headline text-2xl font-bold text-[#0A2540]">Accès refusé (403)</h1>
        <p class="mt-2 text-base text-slate-600">
          Cette page est réservée uniquement au compte directeur.
        </p>
        <a
          [routerLink]="firstAuthorizedRoute()"
          class="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-[#005e6a] px-5 py-2.5 text-base font-semibold text-white"
        >
          Retour à mon espace
        </a>
      </section>
    } @else {
      <div class="mx-auto w-full max-w-2xl space-y-6 overflow-x-hidden">
        <header>
          <a
            routerLink="/administration/comptes"
            class="inline-flex min-h-[44px] items-center gap-1.5 text-base font-semibold text-[#005e6a] hover:underline"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
            <span>Retour aux comptes</span>
          </a>
          <div class="mt-2 flex items-center gap-2.5">
            <span class="material-symbols-outlined text-[26px] text-amber-600" aria-hidden="true">lock</span>
            <h1 class="font-headline text-2xl sm:text-3xl font-bold text-[#0A2540]">
              Nom, e-mail et mot de passe du directeur
            </h1>
          </div>
          <p class="mt-1 text-base text-slate-600">
            Ce compte administrateur principal est protégé. Vous pouvez modifier votre nom, votre e-mail et votre mot de passe.
          </p>
        </header>

        @if (errorMessage()) {
          <div role="alert" data-testid="director-error" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-medium text-rose-900">
            {{ errorMessage() }}
          </div>
        }

        @if (successMessage()) {
          <div role="status" data-testid="director-success" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900">
            {{ successMessage() }}
          </div>
        }

        <form (submit)="handleSave($event)" class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div class="space-y-1.5">
            <label for="director-fullname" class="block text-base font-semibold text-[#0A2540]">
              Nom complet <span class="text-rose-600" aria-hidden="true">*</span>
            </label>
            <input
              id="director-fullname"
              data-testid="director-fullname-input"
              type="text"
              [value]="fullName()"
              (input)="fullName.set($any($event.target).value)"
              placeholder="Ex. Ibader Coly"
              minlength="2"
              maxlength="120"
              required
              class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
            />
          </div>

          <div class="space-y-1.5">
            <label for="director-email" class="block text-base font-semibold text-[#0A2540]">
              Adresse e-mail
            </label>
            <input
              id="director-email"
              data-testid="director-email-input"
              type="email"
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <label for="director-new-password" class="block text-base font-semibold text-[#0A2540]">
                Nouveau mot de passe (optionnel)
              </label>
              <input
                id="director-new-password"
                data-testid="director-new-password-input"
                type="password"
                [value]="newPassword()"
                (input)="newPassword.set($any($event.target).value)"
                placeholder="10 caractères minimum"
                autocomplete="new-password"
                class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none"
              />
            </div>

            <div class="space-y-1.5">
              <label for="director-confirm-password" class="block text-base font-semibold text-[#0A2540]">
                Confirmer le nouveau mot de passe
              </label>
              <input
                id="director-confirm-password"
                data-testid="director-confirm-password-input"
                type="password"
                [value]="confirmPassword()"
                (input)="confirmPassword.set($any($event.target).value)"
                autocomplete="new-password"
                class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none"
              />
            </div>
          </div>

          <div class="border-t border-slate-200 pt-4 space-y-4">
            <div class="space-y-1.5">
              <label for="director-current-password" class="block text-base font-semibold text-[#0A2540]">
                Mot de passe actuel (obligatoire pour valider)
              </label>
              <input
                id="director-current-password"
                data-testid="director-current-password-input"
                type="password"
                [value]="currentPassword()"
                (input)="currentPassword.set($any($event.target).value)"
                required
                autocomplete="current-password"
                class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none"
              />
            </div>

            @if (currentUser()?.totpEnabled) {
              <div class="space-y-1.5">
                <label for="director-totp" class="block text-base font-semibold text-[#0A2540]">
                  Code de double authentification (6 chiffres)
                </label>
                <input
                  id="director-totp"
                  data-testid="director-totp-input"
                  type="text"
                  inputmode="numeric"
                  [value]="totpCode()"
                  (input)="totpCode.set($any($event.target).value)"
                  class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540]"
                />
              </div>
            }
          </div>

          <p class="text-base text-slate-600">
            Toutes les autres sessions actives de ce compte sur d’autres appareils seront fermées après la modification.
          </p>

          <div class="flex flex-wrap justify-end gap-3">
            <a
              routerLink="/administration/comptes"
              class="inline-flex min-h-[48px] items-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </a>
            <button
              type="submit"
              [disabled]="saving()"
              data-testid="btn-save-director-credentials"
              class="inline-flex min-h-[48px] items-center rounded-xl bg-[#005e6a] px-6 py-2.5 text-base font-bold text-white hover:bg-[#004c56] disabled:opacity-60"
            >
              {{ saving() ? 'Enregistrement...' : 'Enregistrer les changements' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class AdministrationDirecteurPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdministrationService);

  readonly currentUser = this.authService.currentUser;
  readonly isDirector = computed(() => this.authService.isDirector());
  readonly firstAuthorizedRoute = computed(() => this.authService.getFirstAuthorizedRoute());

  readonly fullName = signal<string>(this.authService.currentUser()?.fullName || '');
  readonly email = signal<string>(this.authService.currentUser()?.email || '');
  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly currentPassword = signal<string>('');
  readonly totpCode = signal<string>('');

  readonly saving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  ngOnInit(): void {
    const cur = this.authService.currentUser();
    if (cur) {
      if (!this.fullName().trim() && cur.fullName) {
        this.fullName.set(cur.fullName);
      }
      if (!this.email().trim() && cur.email) {
        this.email.set(cur.email);
      }
    }
  }

  async handleSave(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const nextFullName = this.fullName().trim();
    const currentFullName = (this.authService.currentUser()?.fullName || '').trim();
    const fullNameChanged = nextFullName !== currentFullName;
    const nextEmail = this.email().trim().toLowerCase();
    const currentEmail = this.authService.currentUser()?.email || '';
    const emailChanged = nextEmail !== currentEmail;
    const pwd = this.newPassword();

    if (nextFullName.length < 2) {
      this.errorMessage.set('Saisissez un nom complet d’au moins 2 caractères.');
      return;
    }
    if (!fullNameChanged && !emailChanged && !pwd) {
      this.errorMessage.set('Modifiez votre nom, l’e-mail ou saisissez un nouveau mot de passe.');
      return;
    }
    if (pwd && pwd.length < 10) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 10 caractères.');
      return;
    }
    if (pwd && pwd !== this.confirmPassword()) {
      this.errorMessage.set('La confirmation du mot de passe ne correspond pas.');
      return;
    }
    if (!this.currentPassword()) {
      this.errorMessage.set('Saisissez votre mot de passe actuel.');
      return;
    }

    this.saving.set(true);
    try {
      const res = await this.adminService.updateDirectorCredentials({
        currentPassword: this.currentPassword(),
        ...(this.totpCode().trim() ? { totpCode: this.totpCode().trim() } : {}),
        ...(fullNameChanged ? { fullName: nextFullName } : {}),
        ...(emailChanged ? { email: nextEmail } : {}),
        ...(pwd ? { newPassword: pwd } : {}),
      });
      this.fullName.set(res.user.fullName);
      this.email.set(res.user.email);
      this.authService.updateLocalUser({
        fullName: res.user.fullName,
        email: res.user.email,
      });
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.currentPassword.set('');
      this.totpCode.set('');
      this.successMessage.set(
        `Profil mis à jour (${res.otherSessionsRevoked} autre(s) session(s) fermée(s)).`,
      );
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Erreur lors de la mise à jour.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
