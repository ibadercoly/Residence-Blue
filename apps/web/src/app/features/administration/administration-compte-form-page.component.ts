import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AccessLevel,
  DIRECTOR_EXCLUSIVE_ACTIONS,
  SCREEN_DEFINITIONS,
  SPECIAL_PERMISSION_DEFINITIONS,
  STARTER_PROFILES,
  ScreenAccessMap,
  ScreenKey,
  SpecialPermissionKey,
  SpecialPermissionsMap,
  StarterProfileKey,
  createEmptyScreenAccess,
  createEmptySpecialPermissions,
} from '@residence-blue/shared';
import { AuthService } from '../../core/services/auth.service';
import { ModalShellComponent } from '../../shared/components/modal-shell/modal-shell.component';
import { AdministrationService, ManagedAccount } from './administration.service';

@Component({
  selector: 'app-administration-compte-form-page',
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
        <h1 class="font-headline text-2xl font-bold text-[#0A2540]">Accès refusé (403)</h1>
        <p class="mt-2 text-base text-slate-600">
          Seul le directeur peut créer ou modifier des comptes.
        </p>
        <a
          [routerLink]="firstAuthorizedRoute()"
          class="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-[#005e6a] px-5 py-2.5 text-base font-semibold text-white"
        >
          Retour à mon espace
        </a>
      </section>
    } @else {
      <div class="mx-auto w-full max-w-[1380px] space-y-6 overflow-x-hidden">
        <!-- Fil d'Ariane et titre -->
        <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <a
              routerLink="/administration/comptes"
              class="inline-flex min-h-[44px] items-center gap-1.5 text-base font-semibold text-[#005e6a] hover:underline"
            >
              <span class="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
              <span>Retour aux comptes</span>
            </a>
            <h1 class="mt-1 font-headline text-2xl sm:text-3xl font-bold text-[#0A2540]">
              {{ isEditMode() ? 'Modifier le compte et ses accès' : 'Créer un compte utilisateur' }}
            </h1>
          </div>
        </header>

        @if (errorMessage()) {
          <div
            role="alert"
            data-testid="account-form-error"
            class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-base font-medium text-rose-900"
          >
            {{ errorMessage() }}
          </div>
        }

        @if (successMessage()) {
          <div
            role="status"
            data-testid="account-form-success"
            class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-medium text-emerald-900"
          >
            {{ successMessage() }}
          </div>
        }

        <!-- (f) Mot de passe provisoire affiché UNE SEULE FOIS -->
        @if (provisionalPassword()) {
          <section
            data-testid="provisional-password-card"
            class="rounded-2xl border-2 border-[#005e6a] bg-white p-6 shadow-md space-y-4 print:shadow-none"
          >
            <div class="flex items-start gap-3">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#005e6a]/10 text-[#005e6a]">
                <span class="material-symbols-outlined text-[26px]" aria-hidden="true">password</span>
              </div>
              <div class="min-w-0 flex-1">
                <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                  Fiche de connexion — Affichée une seule fois
                </h2>
                <p class="mt-1 text-base text-slate-600">
                  Remettez ce mot de passe provisoire à <strong>{{ fullName() }}</strong>.
                  L’application lui demandera obligatoirement d’en choisir un personnel dès sa première connexion.
                </p>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2 border border-slate-200">
              <div>
                <p class="text-base font-semibold text-slate-600">E-mail de connexion</p>
                <p class="mt-1 text-lg font-bold text-[#0A2540] break-all">{{ email() }}</p>
              </div>
              <div>
                <p class="text-base font-semibold text-slate-600">Mot de passe provisoire</p>
                <p
                  data-testid="provisional-password-value"
                  class="mt-1 font-mono text-xl font-bold tracking-wide text-[#005e6a] select-all"
                >
                  {{ provisionalPassword() }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-3 print:hidden">
              <button
                type="button"
                data-testid="btn-copy-provisional-password"
                (click)="copyProvisionalPassword()"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#005e6a] px-4 py-2.5 text-base font-bold text-white hover:bg-[#004c56]"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">content_copy</span>
                <span>{{ copied() ? 'Copié !' : 'Copier' }}</span>
              </button>
              <button
                type="button"
                data-testid="btn-print-provisional-sheet"
                (click)="printCredentialSheet()"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base font-semibold text-[#0A2540] hover:bg-slate-50"
              >
                <span class="material-symbols-outlined text-[20px]" aria-hidden="true">print</span>
                <span>Imprimer la fiche</span>
              </button>
              <a
                routerLink="/administration/comptes"
                data-testid="btn-back-after-provisional"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[#005e6a]/30 bg-[#005e6a]/5 px-4 py-2.5 text-base font-semibold text-[#005e6a] hover:bg-[#005e6a]/10"
              >
                <span>Terminer et voir les comptes</span>
              </a>
            </div>
          </section>
        }

        @if (loadingAccount()) {
          <div class="rounded-2xl border border-slate-200 bg-white p-8 text-base text-slate-600">
            Chargement du compte...
          </div>
        } @else {
          <div class="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
            <!-- Colonne gauche : Formulaire complet -->
            <form
              (submit)="handleSubmit($event)"
              class="lg:col-span-8 space-y-6 min-w-0"
            >
              <!-- (a) Nom et e-mail -->
              <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                  1. Identité du collaborateur
                </h2>
                <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div class="space-y-1.5">
                    <label for="account-fullname" class="block text-base font-semibold text-[#0A2540]">
                      Nom complet <span class="text-rose-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="account-fullname"
                      data-testid="input-account-fullname"
                      type="text"
                      [value]="fullName()"
                      (input)="fullName.set($any($event.target).value)"
                      placeholder="Ex. Aminata Diop"
                      minlength="2"
                      maxlength="120"
                      class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
                      required
                    />
                  </div>
                  <div class="space-y-1.5">
                    <label for="account-email" class="block text-base font-semibold text-[#0A2540]">
                      Adresse e-mail <span class="text-rose-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="account-email"
                      data-testid="input-account-email"
                      type="email"
                      [value]="email()"
                      (input)="email.set($any($event.target).value)"
                      placeholder="prenom.nom&#64;residenceblue.sn"
                      class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-[#005e6a] focus:outline-none focus:ring-2 focus:ring-[#005e6a]/20"
                      required
                    />
                  </div>
                </div>
              </section>

              <!-- (b) Profil de départ -->
              <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div>
                  <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                    2. Profil de départ
                  </h2>
                  <p class="mt-1 text-base text-slate-600">
                    Choisissez un modèle ci-dessous pour préremplir les accès, puis ajustez-les si besoin.
                  </p>
                </div>

                <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  @for (prof of starterProfiles; track prof.key) {
                    <button
                      type="button"
                      [attr.data-testid]="'profile-card-' + prof.key"
                      [attr.aria-pressed]="starterProfile() === prof.key"
                      (click)="selectStarterProfile(prof.key)"
                      [class]="starterProfile() === prof.key
                        ? 'min-h-[84px] rounded-xl border-2 border-[#005e6a] bg-[#005e6a]/5 p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#005e6a]'
                        : 'min-h-[84px] rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-left hover:border-slate-300 hover:bg-white transition-all focus:outline-none focus:ring-2 focus:ring-[#005e6a]'"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-base font-bold text-[#0A2540]">{{ prof.label }}</span>
                        @if (starterProfile() === prof.key) {
                          <span class="material-symbols-outlined text-[22px] text-[#005e6a]" aria-hidden="true">check_circle</span>
                        }
                      </div>
                      <p class="mt-1 text-base text-slate-600 leading-snug">{{ prof.description }}</p>
                    </button>
                  }
                </div>
              </section>

              <!-- (c) Accès par écran -->
              <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div>
                  <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                    3. Accès par écran
                  </h2>
                  <p class="mt-1 text-base text-slate-600">
                    Réglez précisément ce que la personne peut voir ou modifier dans chaque menu.
                  </p>
                </div>

                <div class="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-x-hidden">
                  @for (scr of screens; track scr.key) {
                    <div
                      [attr.data-testid]="'row-screen-' + scr.key"
                      [class]="isScreenLockedForProfile(scr.key)
                        ? 'flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 opacity-60 min-w-0'
                        : 'flex flex-wrap items-center justify-between gap-3 p-4 bg-white min-w-0'"
                    >
                      <div class="min-w-0 shrink-0">
                        <div class="text-base font-bold text-[#0A2540]">{{ scr.label }}</div>
                        @if (scr.key !== 'chambres' && isMenageProfile()) {
                          <p data-testid="menage-locked-hint" class="text-base text-slate-600">
                            Cette personne n’a besoin que de l’écran Chambres
                          </p>
                        } @else if (scr.key === 'cuisine' && isRestaurantLockedOutOfKitchen()) {
                          <p class="text-base text-amber-800">
                            Toujours bloqué pour un(e) assistant(e) du restaurant.
                          </p>
                        } @else if (scr.key === 'rapports' && isReportsLockedForProfile()) {
                          <p data-testid="rapports-locked-hint" class="text-base text-slate-600">
                            Seul le comptable peut voir les rapports
                          </p>
                        }
                      </div>
                      <div
                        class="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1 min-w-0 max-w-full"
                        role="group"
                        [attr.aria-label]="'Niveau d’accès pour ' + scr.label"
                      >
                        @for (lvl of accessLevels; track lvl.value) {
                          <button
                            type="button"
                            [disabled]="
                              (scr.key !== 'chambres' && isMenageProfile() && lvl.value !== 'AUCUN') ||
                              (scr.key === 'cuisine' && isRestaurantLockedOutOfKitchen() && lvl.value !== 'AUCUN') ||
                              (scr.key === 'rapports' && isReportsLockedForProfile() && lvl.value !== 'AUCUN')
                            "
                            [attr.data-testid]="'screen-' + scr.key + '-' + lvl.value"
                            [attr.aria-pressed]="screenAccess()[scr.key] === lvl.value"
                            (click)="setScreenLevel(scr.key, lvl.value)"
                            [class]="screenAccess()[scr.key] === lvl.value
                              ? 'min-h-[44px] rounded-lg px-3 py-1.5 text-base font-bold shadow-sm transition-colors whitespace-nowrap ' + lvl.activeClass
                              : 'min-h-[44px] rounded-lg px-3 py-1.5 text-base font-medium text-slate-700 hover:bg-white/70 transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed'"
                          >
                            {{ lvl.label }}
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>

                <div class="rounded-xl bg-slate-50 border border-slate-200 p-4 text-base text-slate-700">
                  <strong class="text-[#0A2540]">Toujours réservés au directeur :</strong>
                  Administration, Carte (plats et prix), Apparence/Paramètres, Suppression, Avoirs, Annulation de paiement, Check-out forcé et Réinitialisation.
                </div>
              </section>

              <!-- (d) Droits particuliers -->
              <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                  4. Droits particuliers
                </h2>
                <div class="space-y-3">
                  @for (perm of specialPermissionsDefs; track perm.key) {
                    <div class="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4">
                      <div class="min-w-0">
                        <div class="text-base font-bold text-[#0A2540]">{{ perm.label }}</div>
                        <p class="mt-0.5 text-base text-slate-600">{{ perm.description }}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        [attr.aria-checked]="specialPermissions()[perm.key]"
                        [attr.aria-label]="perm.label"
                        [attr.data-testid]="'perm-toggle-' + perm.key"
                        (click)="toggleSpecialPermission(perm.key)"
                        class="relative inline-flex h-[44px] w-[72px] shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors focus:outline-none focus:ring-2 focus:ring-[#005e6a]"
                        [class.bg-[#005e6a]]="specialPermissions()[perm.key]"
                        [class.bg-slate-300]="!specialPermissions()[perm.key]"
                      >
                        <span
                          class="inline-block h-8 w-8 transform rounded-full bg-white shadow transition-transform"
                          [class.translate-x-7]="specialPermissions()[perm.key]"
                          [class.translate-x-0]="!specialPermissions()[perm.key]"
                        ></span>
                      </button>
                    </div>
                  }
                </div>
              </section>

              @if (isEditMode()) {
                <section class="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-3">
                  <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                    Mot de passe de ce compte
                  </h2>
                  <p class="text-base text-slate-600">
                    Si la personne a oublié son mot de passe, générez un nouveau mot de passe provisoire à usage unique et fermez ses sessions en cours.
                  </p>
                  <button
                    type="button"
                    [disabled]="saving()"
                    data-testid="btn-reset-user-password"
                    (click)="resetExistingPassword()"
                    class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-4 py-2.5 text-base font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-60"
                  >
                    <span class="material-symbols-outlined text-[20px]" aria-hidden="true">lock_reset</span>
                    <span>Réinitialiser le mot de passe</span>
                  </button>
                </section>
              }

              <!-- Boutons d'action -->
              <div class="flex flex-wrap items-center justify-end gap-3 pt-2">
                <a
                  routerLink="/administration/comptes"
                  class="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-base font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </a>
                <button
                  type="submit"
                  [disabled]="saving()"
                  data-testid="btn-save-account"
                  class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#005e6a] px-6 py-2.5 text-base font-bold text-white shadow-sm hover:bg-[#004c56] disabled:opacity-60"
                >
                  <span class="material-symbols-outlined text-[20px]" aria-hidden="true">save</span>
                  <span>
                    {{
                      saving()
                        ? 'Enregistrement...'
                        : isEditMode()
                          ? 'Enregistrer les modifications'
                          : 'Créer le compte'
                    }}
                  </span>
                </button>
              </div>

              @if (isEditMode() && !loadedIsProtectedDirector()) {
                <section
                  data-testid="danger-delete-account-section"
                  class="rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-5 sm:p-6 shadow-sm space-y-3"
                >
                  <div class="flex items-start gap-3">
                    <span class="material-symbols-outlined mt-0.5 text-[22px] text-rose-700 shrink-0" aria-hidden="true">
                      warning
                    </span>
                    <div class="min-w-0 space-y-1">
                      <h2 class="font-headline text-xl font-bold text-rose-900">
                        Supprimer ce compte
                      </h2>
                      <p class="text-base text-rose-900/85">
                        Action irréversible : ce collaborateur perdra définitivement son accès.
                        Les écritures passées (factures, réservations, journal) restent conservées.
                      </p>
                    </div>
                  </div>
                  <div class="pt-1 flex justify-end">
                    <button
                      type="button"
                      data-testid="btn-delete-account"
                      (click)="openDeleteModal()"
                      class="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-700 px-5 py-2.5 text-base font-bold text-white shadow-sm hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
                    >
                      <span class="material-symbols-outlined text-[20px]" aria-hidden="true">delete_forever</span>
                      <span>Supprimer ce compte</span>
                    </button>
                  </div>
                </section>
              }
            </form>

            <!-- (e) Aperçu en direct à droite : Ce que cette personne verra -->
            <aside
              data-testid="live-menu-preview"
              class="lg:col-span-4 lg:sticky lg:top-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-5"
            >
              <div>
                <h2 class="font-headline text-xl font-bold text-[#0A2540]">
                  Ce que cette personne verra
                </h2>
                <p class="mt-1 text-base text-slate-600">
                  Aperçu en direct de son menu à gauche après connexion :
                </p>
              </div>

              <!-- Aperçu barre latérale bleu nuit -->
              <div class="rounded-2xl bg-[#0A2540] p-4 text-white space-y-2 shadow-inner">
                <div class="px-2 pb-2 mb-2 border-b border-white/10 text-base font-semibold text-slate-200">
                  {{ fullName().trim() || 'Nouvel utilisateur' }}
                </div>
                @if (previewScreens().length === 0) {
                  <p class="px-2 py-3 text-base text-amber-300">
                    Aucun écran autorisé pour le moment.
                  </p>
                } @else {
                  @for (item of previewScreens(); track item.key) {
                    <div
                      [attr.data-testid]="'preview-menu-' + item.key"
                      class="flex items-center justify-between gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-base font-semibold"
                    >
                      <span>{{ item.label }}</span>
                      <span class="rounded-full bg-white/15 px-2.5 py-0.5 text-sm font-medium text-teal-200">
                        {{ screenAccess()[item.key] === 'ECRITURE' ? 'Modification' : 'Lecture' }}
                      </span>
                    </div>
                  }
                }
              </div>

              <div class="space-y-2">
                <h3 class="text-base font-bold text-[#0A2540]">Actions autorisées :</h3>
                <ul class="space-y-1.5 text-base text-slate-700">
                  @for (perm of specialPermissionsDefs; track perm.key) {
                    <li class="flex items-center gap-2">
                      <span
                        class="material-symbols-outlined text-[20px]"
                        [class.text-emerald-600]="specialPermissions()[perm.key]"
                        [class.text-slate-400]="!specialPermissions()[perm.key]"
                        aria-hidden="true"
                      >
                        {{ specialPermissions()[perm.key] ? 'check_circle' : 'cancel' }}
                      </span>
                      <span>{{ perm.label }}</span>
                    </li>
                  }
                </ul>
              </div>

              <div class="border-t border-slate-200 pt-3">
                <p class="text-base font-bold text-[#0A2540]">Jamais accessibles :</p>
                <p class="mt-1 text-base text-slate-600">
                  {{ directorExclusiveList.join(' • ') }}
                </p>
              </div>
            </aside>
          </div>
        }

        <app-modal-shell
          [isOpen]="showDeleteModal()"
          title="Supprimer ce compte définitivement ?"
          subtitle="Double vérification requise pour éviter toute erreur"
          icon="delete_forever"
          maxWidth="560px"
          testId="modal-delete-account"
          (closed)="closeDeleteModal()"
        >
          <div modal-body class="space-y-4 text-base text-slate-700">
            <p class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800">
              Attention : le compte de
              <strong>{{ expectedDeleteConfirmName() }}</strong>
              sera supprimé définitivement (ses factures et écritures restent en base pour l’audit).
            </p>
            <div class="space-y-1.5">
              <label for="delete-confirm-name" class="block font-semibold text-[#0A2540]">
                Recopiez exactement : <span class="text-rose-700">{{ expectedDeleteConfirmName() }}</span>
              </label>
              <input
                id="delete-confirm-name"
                data-testid="delete-confirm-name"
                type="text"
                [value]="deleteConfirmName()"
                (input)="deleteConfirmName.set($any($event.target).value)"
                class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-600/20"
              />
            </div>
            <div class="space-y-1.5">
              <label for="delete-director-password" class="block font-semibold text-[#0A2540]">
                Votre mot de passe directeur
              </label>
              <input
                id="delete-director-password"
                data-testid="delete-director-password"
                type="password"
                [value]="deleteDirectorPassword()"
                (input)="deleteDirectorPassword.set($any($event.target).value)"
                class="min-h-[48px] w-full rounded-xl border border-slate-300 px-3.5 py-2 text-base text-[#0A2540] focus:border-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-600/20"
              />
            </div>
            @if (deleteModalError()) {
              <p class="rounded-lg bg-rose-50 px-3 py-2 text-base font-medium text-rose-700">
                {{ deleteModalError() }}
              </p>
            }
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
              [disabled]="deleting()"
              data-testid="confirm-delete-btn"
              (click)="confirmDelete()"
              class="min-h-[44px] rounded-xl bg-rose-700 px-5 py-2 text-base font-bold text-white hover:bg-rose-800 disabled:opacity-60"
            >
              {{ deleting() ? 'Suppression...' : 'Supprimer définitivement' }}
            </button>
          </div>
        </app-modal-shell>
      </div>
    }
  `,
})
export class AdministrationCompteFormPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly adminService = inject(AdministrationService);

  readonly isDirector = computed(() => this.authService.isDirector());
  readonly firstAuthorizedRoute = computed(() => this.authService.getFirstAuthorizedRoute());

  readonly starterProfiles = STARTER_PROFILES;
  readonly screens = SCREEN_DEFINITIONS;
  readonly specialPermissionsDefs = SPECIAL_PERMISSION_DEFINITIONS;
  readonly directorExclusiveList = DIRECTOR_EXCLUSIVE_ACTIONS;

  readonly accessLevels: Array<{
    value: AccessLevel;
    label: string;
    activeClass: string;
  }> = [
    { value: 'AUCUN', label: 'Aucun accès', activeClass: 'bg-slate-700 text-white' },
    { value: 'LECTURE', label: 'Lecture', activeClass: 'bg-sky-700 text-white' },
    { value: 'ECRITURE', label: 'Lecture et modification', activeClass: 'bg-[#005e6a] text-white' },
  ];

  readonly accountId = signal<string | null>(null);
  readonly isEditMode = computed(() => this.accountId() !== null);
  readonly loadingAccount = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly provisionalPassword = signal<string | null>(null);
  readonly copied = signal<boolean>(false);
  readonly loadedIsProtectedDirector = signal<boolean>(false);

  readonly showDeleteModal = signal<boolean>(false);
  readonly deleteConfirmName = signal<string>('');
  readonly deleteDirectorPassword = signal<string>('');
  readonly deleteModalError = signal<string | null>(null);
  readonly deleting = signal<boolean>(false);
  readonly expectedDeleteConfirmName = computed(
    () => this.fullName().trim() || this.email().trim(),
  );

  readonly fullName = signal<string>('');
  readonly email = signal<string>('');
  readonly starterProfile = signal<StarterProfileKey>('ASSISTANT_RECEPTION');
  readonly screenAccess = signal<ScreenAccessMap>({ ...STARTER_PROFILES[0].screenAccess });
  readonly specialPermissions = signal<SpecialPermissionsMap>({
    ...STARTER_PROFILES[0].specialPermissions,
  });

  readonly isRestaurantLockedOutOfKitchen = computed(
    () => this.starterProfile() === 'ASSISTANT_RESTAURANT',
  );

  readonly isReportsLockedForProfile = computed(
    () => this.starterProfile() !== 'COMPTABLE',
  );

  readonly isMenageProfile = computed(() => this.starterProfile() === 'MENAGE');

  isScreenLockedForProfile(screen: ScreenKey): boolean {
    if (screen !== 'chambres' && this.isMenageProfile()) return true;
    if (screen === 'cuisine' && this.isRestaurantLockedOutOfKitchen()) return true;
    if (screen === 'rapports' && this.isReportsLockedForProfile()) return true;
    return false;
  }

  readonly previewScreens = computed(() =>
    SCREEN_DEFINITIONS.filter((s) => this.screenAccess()[s.key] !== 'AUCUN'),
  );

  async ngOnInit(): Promise<void> {
    if (!this.isDirector()) return;
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.accountId.set(idParam);
      await this.loadAccount(idParam);
    }
  }

  private async loadAccount(id: string): Promise<void> {
    this.loadingAccount.set(true);
    this.errorMessage.set(null);
    try {
      const acc: ManagedAccount = await this.adminService.getAccount(id);
      if (acc.isProtectedDirector) {
        this.loadedIsProtectedDirector.set(true);
        await this.router.navigate(['/administration/directeur']);
        return;
      }
      this.loadedIsProtectedDirector.set(false);
      this.fullName.set(acc.fullName);
      this.email.set(acc.email);
      const validProfile = STARTER_PROFILES.find((p) => p.key === acc.starterProfile)?.key;
      const nextProfile = validProfile ?? 'ASSISTANT_RECEPTION';
      this.starterProfile.set(nextProfile);
      const loadedScreens = { ...createEmptyScreenAccess(), ...acc.screenAccess };
      if (nextProfile !== 'COMPTABLE') {
        loadedScreens.rapports = 'AUCUN';
      }
      if (nextProfile === 'MENAGE') {
        loadedScreens.accueil = 'AUCUN';
        loadedScreens.planning = 'AUCUN';
        loadedScreens.clients = 'AUCUN';
        loadedScreens.facturation = 'AUCUN';
        loadedScreens.restaurant = 'AUCUN';
        loadedScreens.cuisine = 'AUCUN';
        loadedScreens.rapports = 'AUCUN';
      }
      this.screenAccess.set(loadedScreens);
      this.specialPermissions.set({
        ...createEmptySpecialPermissions(),
        ...acc.specialPermissions,
      });
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible de charger ce compte.',
      );
    } finally {
      this.loadingAccount.set(false);
    }
  }

  selectStarterProfile(key: Exclude<StarterProfileKey, 'DIRECTEUR'>): void {
    const def = STARTER_PROFILES.find((p) => p.key === key);
    if (!def) return;
    this.starterProfile.set(key);
    this.screenAccess.set({ ...def.screenAccess });
    this.specialPermissions.set({ ...def.specialPermissions });
  }

  setScreenLevel(screen: ScreenKey, level: AccessLevel): void {
    if (screen !== 'chambres' && this.isMenageProfile() && level !== 'AUCUN') {
      return;
    }
    if (screen === 'cuisine' && this.isRestaurantLockedOutOfKitchen()) {
      return;
    }
    if (screen === 'rapports' && this.isReportsLockedForProfile() && level !== 'AUCUN') {
      return;
    }
    this.screenAccess.update((curr) => ({ ...curr, [screen]: level }));
  }

  toggleSpecialPermission(key: SpecialPermissionKey): void {
    this.specialPermissions.update((curr) => ({ ...curr, [key]: !curr[key] }));
  }

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    this.errorMessage.set(null);
    this.successMessage.set(null);

    if (this.fullName().trim().length < 2) {
      this.errorMessage.set('Saisissez un nom complet d’au moins 2 caractères.');
      return;
    }
    if (!this.email().trim().includes('@')) {
      this.errorMessage.set('Saisissez une adresse e-mail valide.');
      return;
    }

    this.saving.set(true);
    try {
      const id = this.accountId();
      if (id) {
        const updated = await this.adminService.updateAccount(id, {
          fullName: this.fullName().trim(),
          email: this.email().trim().toLowerCase(),
          starterProfile: this.starterProfile(),
          screenAccess: this.screenAccess(),
          specialPermissions: this.specialPermissions(),
        });
        this.fullName.set(updated.fullName);
        this.email.set(updated.email);
        if (updated.id === this.authService.currentUser()?.id) {
          this.authService.updateLocalUser({
            fullName: updated.fullName,
            email: updated.email,
          });
        }
        this.successMessage.set('Compte et accès enregistrés. Les changements s’appliquent immédiatement.');
      } else {
        const res = await this.adminService.createAccount({
          fullName: this.fullName().trim(),
          email: this.email().trim().toLowerCase(),
          starterProfile: this.starterProfile(),
          screenAccess: this.screenAccess(),
          specialPermissions: this.specialPermissions(),
        });
        this.provisionalPassword.set(res.provisionalPassword);
        this.accountId.set(res.account.id);
        this.successMessage.set('Compte créé avec succès.');
      }
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible d’enregistrer ce compte.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async resetExistingPassword(): Promise<void> {
    const id = this.accountId();
    if (!id) return;
    this.saving.set(true);
    this.errorMessage.set(null);
    try {
      const res = await this.adminService.resetPassword(id);
      this.provisionalPassword.set(res.provisionalPassword);
      this.copied.set(false);
      this.successMessage.set(
        'Nouveau mot de passe provisoire généré. Les sessions précédentes ont été fermées.',
      );
    } catch (err) {
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Impossible de réinitialiser le mot de passe.',
      );
    } finally {
      this.saving.set(false);
    }
  }

  async copyProvisionalPassword(): Promise<void> {
    const pwd = this.provisionalPassword();
    if (!pwd || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(pwd);
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  printCredentialSheet(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  openDeleteModal(): void {
    if (!this.isEditMode() || this.loadedIsProtectedDirector()) return;
    this.deleteConfirmName.set('');
    this.deleteDirectorPassword.set('');
    this.deleteModalError.set(null);
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deleteModalError.set(null);
  }

  async confirmDelete(): Promise<void> {
    const id = this.accountId();
    if (!id || this.loadedIsProtectedDirector()) return;
    const expectedName = this.expectedDeleteConfirmName();
    if (this.deleteConfirmName().trim() !== expectedName) {
      this.deleteModalError.set(`Saisissez exactement « ${expectedName} » pour confirmer.`);
      return;
    }
    if (!this.deleteDirectorPassword().trim()) {
      this.deleteModalError.set('Saisissez votre mot de passe directeur.');
      return;
    }

    this.deleting.set(true);
    this.deleteModalError.set(null);
    try {
      const res = await this.adminService.deleteAccount(
        id,
        this.deleteConfirmName().trim(),
        this.deleteDirectorPassword(),
      );
      this.closeDeleteModal();
      await this.router.navigate(['/administration/comptes'], {
        queryParams: { deleted: res.deletedDisplayName },
      });
    } catch (err) {
      this.deleteModalError.set(
        err instanceof Error ? err.message : 'Impossible de supprimer ce compte.',
      );
    } finally {
      this.deleting.set(false);
    }
  }
}
