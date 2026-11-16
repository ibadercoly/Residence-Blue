import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-changer-mot-de-passe-page',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen w-full bg-[#f5f7fa] flex items-center justify-center p-4">
      <div class="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-md space-y-6">
        <div class="space-y-2 text-center">
          <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#005e6a]/10 text-[#005e6a]">
            <span class="material-symbols-outlined text-[30px]" aria-hidden="true">lock_person</span>
          </div>
          <p class="text-base font-semibold text-[#005e6a]">Première connexion</p>
          <h1 class="font-headline text-2xl sm:text-3xl font-bold text-[#0A2540]">
            Choisissez votre mot de passe personnel
          </h1>
          <p class="text-base text-slate-600">
            Avant d’ouvrir votre espace, remplacez le mot de passe provisoire par un mot de passe que vous seul connaissez (10 caractères minimum).
          </p>
        </div>

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="initial-password-error"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-medium text-rose-900"
          >
            {{ errorMessage() }}
          </div>
        }

        <form (submit)="handleSubmit($event)" class="space-y-4">
          <div class="space-y-1.5">
            <label for="new-initial-pwd" class="block text-base font-semibold text-[#0A2540]">
              Nouveau mot de passe
            </label>
            <input
              id="new-initial-pwd"
              data-testid="initial-password-new"
              type="password"
              [value]="newPassword()"
              (input)="newPassword.set($any($event.target).value)"
              placeholder="Au moins 10 caractères"
              autocomplete="new-password"
              required
              class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
            />
          </div>

          <div class="space-y-1.5">
            <label for="confirm-initial-pwd" class="block text-base font-semibold text-[#0A2540]">
              Confirmez le nouveau mot de passe
            </label>
            <input
              id="confirm-initial-pwd"
              data-testid="initial-password-confirm"
              type="password"
              [value]="confirmPassword()"
              (input)="confirmPassword.set($any($event.target).value)"
              placeholder="Retapez le même mot de passe"
              autocomplete="new-password"
              required
              class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
            />
          </div>

          <button
            type="submit"
            [disabled]="saving()"
            data-testid="btn-save-initial-password"
            class="mt-2 min-h-[48px] w-full rounded-xl bg-[#005e6a] px-6 py-3 text-base font-bold text-white shadow-sm hover:bg-[#004c56] disabled:opacity-60"
          >
            {{ saving() ? 'Enregistrement...' : 'Valider et accéder à mon espace' }}
          </button>
        </form>
      </div>
    </div>
  `,
})
export class ChangerMotDePassePageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly newPassword = signal<string>('');
  readonly confirmPassword = signal<string>('');
  readonly saving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);

    const pwd = this.newPassword();
    if (pwd.length < 10) {
      this.errorMessage.set('Le mot de passe doit contenir au moins 10 caractères.');
      return;
    }
    if (pwd !== this.confirmPassword()) {
      this.errorMessage.set('Les deux mots de passe ne sont pas identiques.');
      return;
    }

    this.saving.set(true);
    try {
      await this.authService.changeInitialPassword(pwd);
      await this.router.navigate([this.authService.getFirstAuthorizedRoute()]);
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible d’enregistrer le mot de passe.',
      );
    } finally {
      this.saving.set(false);
    }
  }
}
