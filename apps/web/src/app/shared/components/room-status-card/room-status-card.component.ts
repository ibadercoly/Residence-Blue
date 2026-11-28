import {
  Component,
  Input,
  Output,
  EventEmitter,
  signal,
  HostListener,
  ElementRef,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoomUiItem } from '../../../core/services/rooms.service';
import {
  RoomStatus,
  Role,
  RoomInterventionRequestDto,
  RoomInterventionStatus,
  formatFcfa,
} from '@residence-blue/shared';
import { ImageComponent } from '../image/image.component';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { ActionButtonComponent } from '../action-button/action-button.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-room-status-card',
  standalone: true,
  imports: [CommonModule, ImageComponent, StatusBadgeComponent, ActionButtonComponent],
  template: `
    @if (room) {
      <div
        class="room-card group relative"
        [class.highlight-card]="isHighlighted"
        [class.opacity-75]="room.isActive === false"
        [class.z-40]="isMenuOpen()"
        [attr.data-room-id]="room.id"
        [attr.data-room-number]="room.number"
        [attr.data-room-status]="room.status"
        [attr.data-is-active]="room.isActive !== false"
      >
        <!-- En-tête de carte épuré : titre et catégorie à gauche (pleine largeur restante), bouton ⋯ à droite -->
        <div class="card-header flex items-center justify-between gap-2 p-3.5 bg-surface-container-lowest border-b border-outline-variant/30 min-w-0 w-full rounded-t-2xl">
          <!-- Titre et catégorie prenant toute la largeur restante, sans troncature (pas de truncate ni ellipsis) -->
          <div class="room-title-group min-w-0 flex-1 flex flex-col mr-1">
            <span
              class="room-title font-headline-sm font-bold text-on-surface text-base leading-tight break-words [overflow-wrap:anywhere]"
              [title]="'Chambre ' + room.number"
              data-testid="room-card-title"
            >
              Chambre {{ room.number }}
            </span>
            <span class="room-category text-xs text-on-surface-variant font-medium leading-normal break-words [overflow-wrap:anywhere]">
              {{ room.category || room.type?.name || 'À classer' }} • Étage {{ room.floor }}
            </span>
            @if (isUnclassified) {
              <span
                class="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[11px] font-bold text-amber-950"
                [attr.data-testid]="'room-unclassified-badge-' + room.number"
              >
                <span class="material-symbols-outlined text-[13px]" aria-hidden="true">label_off</span>
                <span>À classer</span>
              </span>
            }
          </div>

          <!-- Bouton discret « ⋯ » (zone cliquable 40 x 40 px) avec menu déroulant s'ouvrant vers la gauche -->
          <div class="relative shrink-0">
            <button
              #menuTrigger
              type="button"
              (click)="toggleMenu($event)"
              (keydown)="onTriggerKeydown($event)"
              class="menu-btn-trigger w-10 h-10 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              [attr.data-testid]="'room-menu-btn-' + room.number"
              data-testid="room-menu-btn"
              aria-label="Options chambre"
              aria-haspopup="menu"
              [attr.aria-expanded]="isMenuOpen()"
            >
              <span class="material-symbols-outlined text-[20px]">more_horiz</span>
            </button>

            <!-- Menu déroulant d'actions : min-width 220px, aligné à droite du bouton (ouvre vers la gauche) -->
            @if (isMenuOpen()) {
              <div
                #menuDropdown
                class="room-menu-dropdown absolute right-0 top-11 min-w-[220px] bg-surface rounded-xl shadow-2xl border border-outline-variant/60 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                role="menu"
                [attr.aria-labelledby]="'room-menu-btn-' + room.number"
                (keydown)="onMenuKeydown($event)"
                (click)="$event.stopPropagation()"
              >
                <!-- 1. Voir la fiche -->
                <button
                  type="button"
                  role="menuitem"
                  tabindex="0"
                  (click)="onActionView()"
                  class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  data-testid="menu-action-details"
                >
                  <span class="material-symbols-outlined text-[16px] text-on-surface-variant">visibility</span>
                  <span>Voir la fiche</span>
                </button>

                <!-- 2. Modifier (DIRECTION uniquement) -->
                @if (currentRole === Role.DIRECTION) {
                  <button
                    type="button"
                    role="menuitem"
                    tabindex="0"
                    (click)="onActionEdit()"
                    class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    data-testid="menu-action-edit"
                  >
                    <span class="material-symbols-outlined text-[16px] text-primary">edit</span>
                    <span>Modifier</span>
                  </button>
                }

                <!-- 3. État de la chambre (non cliquable, affiche la pastille d'état actuelle) -->
                <div
                  class="menu-item-status px-3 py-2 flex items-center justify-between gap-3 text-xs font-medium text-on-surface-variant select-none whitespace-nowrap"
                  role="none"
                  data-testid="menu-item-status"
                >
                  <span class="text-on-surface-variant font-medium">État</span>
                  <app-status-badge
                    [status]="room.status"
                    [isActive]="room.isActive !== false"
                    [testId]="'room-status-badge-' + room.number"
                  ></app-status-badge>
                </div>

                <!-- Séparation fine avant la dernière entrée -->
                @if (currentRole === Role.DIRECTION) {
                  <div class="border-t border-outline-variant/40 my-1" role="separator" aria-hidden="true"></div>

                  <!-- 4. Désactiver / Réactiver (en rouge / vert) -->
                  @if (room.isActive !== false) {
                    <button
                      type="button"
                      role="menuitem"
                      tabindex="0"
                      (click)="onActionDeactivate()"
                      class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                      data-testid="menu-action-deactivate"
                    >
                      <span class="material-symbols-outlined text-[16px] text-rose-500">block</span>
                      <span>Désactiver</span>
                    </button>
                  } @else {
                    <button
                      type="button"
                      role="menuitem"
                      tabindex="0"
                      (click)="onActionReactivate()"
                      class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-emerald-600 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                      data-testid="menu-action-reactivate"
                    >
                      <span class="material-symbols-outlined text-[16px] text-emerald-500">check_circle</span>
                      <span>Réactiver</span>
                    </button>
                  }

                  <!-- Trait fin de séparation avant Supprimer -->
                  <div class="border-t border-outline-variant/40 my-1" role="separator" aria-hidden="true"></div>

                  <!-- 5. Supprimer (en rouge, en dernière position) -->
                  <button
                    type="button"
                    role="menuitem"
                    tabindex="0"
                    (click)="onActionDelete()"
                    class="menu-item-action w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 focus:bg-rose-50 focus:outline-none flex items-center gap-2 cursor-pointer whitespace-nowrap"
                    data-testid="menu-action-delete"
                  >
                    <span class="material-symbols-outlined text-[16px] text-rose-500">delete</span>
                    <span>Supprimer</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>

        <!-- Zone visuelle : Photo épurée sans superposition de texte ni pastille -->
        <div class="card-visual relative h-44 overflow-hidden bg-surface-container">
          <app-image
            [src]="room.imageUrl || room.image || 'assets/images/chambres/chambre-fallback.jpg'"
            [alt]="room.imageAlt || ('Chambre ' + room.number + ' - ' + (room.type?.name || 'Standard'))"
            cssClass="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          ></app-image>
        </div>

        <!-- Corps de la carte : Tarifs, Équipements et Sync -->
        <div class="card-body p-4 bg-surface-container-lowest flex flex-col justify-between flex-1">
          <div>
            @if (shouldShowPrice) {
              <div class="price-row flex items-baseline justify-between mb-2" data-testid="room-card-price">
                <span class="price-amount font-label-currency text-xl font-bold text-primary">
                  {{ formatPrice(displayedPrice!) }}
                </span>
                <span class="price-unit text-xs text-on-surface-variant font-medium">dès / nuitée</span>
              </div>
            }

            <!-- Choix rapide de la catégorie (DIRECTION uniquement) -->
            @if (currentRole === Role.DIRECTION) {
              <div class="mb-2.5 flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-1.5 border border-outline-variant/40">
                <label
                  [attr.for]="'card-cat-' + room.number"
                  class="text-[11px] font-semibold text-on-surface-variant shrink-0"
                >
                  Catégorie
                </label>
                <select
                  [id]="'card-cat-' + room.number"
                  [value]="normalizedSelectCategory"
                  (change)="onCategorySelectChange($event)"
                  [attr.data-testid]="'room-category-select-' + room.number"
                  class="min-h-[32px] max-w-[140px] rounded-lg border border-outline-variant/70 bg-white px-2 py-1 text-xs font-semibold text-on-surface outline-none focus:ring-2 focus:ring-primary/25 cursor-pointer"
                >
                  <option value="À classer">À classer</option>
                  <option value="Standard">Standard</option>
                  <option value="Confort">Confort</option>
                  <option value="Appartement">Appartement</option>
                </select>
              </div>
            }

            <!-- Équipements clés -->
            <div class="amenities-list flex flex-wrap gap-1 mb-3">
              @for (amenity of (room.amenities || []); track amenity) {
                <span class="amenity-chip text-[11px] bg-surface-container-low text-on-surface-variant px-2 py-0.5 rounded-md font-medium">
                  {{ amenity }}
                </span>
              }
            </div>

            <!-- Badge motif de panne / hors service (visible pour Réception / Direction / Technique) -->
            @if (room.status === RoomStatus.MAINTENANCE) {
              <div
                class="maintenance-reason-badge flex items-start gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-lg mb-2 font-semibold break-words [overflow-wrap:anywhere]"
                [attr.data-testid]="'room-card-maintenance-reason-' + room.number"
                data-testid="room-card-maintenance-reason"
              >
                <span class="material-symbols-outlined text-[15px] text-rose-600 shrink-0 mt-0.5">warning</span>
                <span>Hors service : {{ room.maintenanceReason || 'Problème signalé' }}</span>
              </div>
            }

            <!-- Workflow intervention technique : demande en attente d'accord Direction -->
            @if (pendingIntervention; as pending) {
              <div
                class="flex flex-col gap-2 px-2.5 py-2 bg-amber-50 border border-amber-300 text-amber-950 text-xs rounded-lg mb-2"
                [attr.data-testid]="'room-card-pending-intervention-' + room.number"
              >
                <div class="flex items-start justify-between gap-1.5 font-bold">
                  <div class="flex items-start gap-1.5">
                    <span class="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">hourglass_top</span>
                    <span>En attente d'accord du Directeur</span>
                  </div>
                  @if (isReportedByHousekeeping(pending) && currentRole === Role.RECEPTION) {
                    <span
                      class="px-1.5 py-0.5 rounded bg-stone-200 text-stone-700 text-[10px] font-semibold shrink-0"
                      [attr.data-testid]="'room-card-readonly-housekeeping-' + room.number"
                    >
                      Lecture seule
                    </span>
                  }
                </div>
                @if (isReportedByHousekeeping(pending)) {
                  <span class="text-[11px] font-semibold text-amber-800">
                    Signalé par le Ménage{{ pending.reportedByName ? ' (' + pending.reportedByName + ')' : '' }}
                  </span>
                }
                <p class="text-[11px] text-amber-900 break-words">{{ pending.issueDescription }}</p>
                @if (isReportedByHousekeeping(pending) && currentRole === Role.RECEPTION) {
                  <span class="text-[10px] text-stone-600 italic">
                    Consultation uniquement — aucune action disponible sur un signalement du Ménage.
                  </span>
                }
                @if (currentRole === Role.DIRECTION) {
                  <div class="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      type="button"
                      (click)="onApproveIntervention.emit(pending.id)"
                      [attr.data-testid]="'card-btn-approve-' + pending.id"
                      class="h-8 px-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[14px]">check</span>
                      <span>Approuver</span>
                    </button>
                    <button
                      type="button"
                      (click)="onRejectIntervention.emit(pending)"
                      [attr.data-testid]="'card-btn-reject-' + pending.id"
                      class="h-8 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span class="material-symbols-outlined text-[14px]">close</span>
                      <span>Refuser</span>
                    </button>
                  </div>
                }
              </div>
            }

            <!-- Workflow intervention technique : ordre approuvé visible pour MAINTENANCE -->
            @if (approvedIntervention; as approved) {
              @if (currentRole === Role.MAINTENANCE) {
                <div
                  class="flex flex-col gap-2 px-2.5 py-2 bg-blue-50 border border-blue-300 text-blue-950 text-xs rounded-lg mb-2"
                  [attr.data-testid]="'room-card-approved-intervention-' + room.number"
                >
                  <div class="flex items-start gap-1.5 font-bold">
                    <span class="material-symbols-outlined text-[16px] text-blue-700 shrink-0 mt-0.5">build</span>
                    <span>Intervention approuvée</span>
                  </div>
                  <p class="text-[11px] text-blue-900 break-words">{{ approved.issueDescription }}</p>
                  <button
                    type="button"
                    (click)="onCompleteIntervention.emit(approved.id)"
                    [attr.data-testid]="'card-btn-complete-' + approved.id"
                    class="w-full h-9 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span class="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Marquer comme réparé</span>
                  </button>
                </div>
              }
            }

            <!-- Alerte modification hors ligne -->
            @if (room.syncPending) {
              <div class="sync-pending-card-alert flex items-center gap-1.5 p-1.5 bg-amber-50 text-amber-800 text-xs rounded-lg mb-2 font-medium">
                <span class="material-symbols-outlined text-[16px] text-amber-600 animate-spin">sync</span>
                <span>Modifié hors-ligne • En attente de sync</span>
              </div>
            }

            <!-- Alerte chambre inactive -->
            @if (room.isActive === false) {
              <div class="inactive-card-alert flex items-center gap-1.5 p-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg mb-2 font-medium" data-testid="room-inactive-alert">
                <span class="material-symbols-outlined text-[16px] text-slate-500">block</span>
                <span>Chambre désactivée (Inactive)</span>
              </div>
            }
          </div>
        </div>

        <!-- DÉFAUT 1 CORRIGÉ : Pied de carte sans libellé parasite -->
        <!-- Grille pleine largeur : max 2 boutons, même largeur, empilement sur 2 lignes sous 260px -->
        @if (showActions && room.isActive !== false) {
          <div class="actions-footer p-3.5 pt-0 bg-surface-container-lowest rounded-b-2xl border-t-0" data-testid="room-card-actions">
            <div class="actions-grid">
              @switch (room.status) {
                @case (RoomStatus.FREE) {
                  @if (currentRole === Role.DIRECTION || currentRole === Role.RECEPTION) {
                    <!-- Action principale : Check-in -->
                    <app-action-button
                      label="Check-in"
                      icon="login"
                      variant="solid"
                      color="success"
                      [attr.data-action]="'check-in-' + room.number"
                      [testId]="'action-btn-check-in-' + room.number"
                      (action)="onStatusChange.emit({ status: RoomStatus.OCCUPIED, reason: 'Check-in client' })"
                    ></app-action-button>
                  }
                  @if (canReportProblem) {
                    @if (pendingIntervention) {
                      <button
                        type="button"
                        disabled
                        [attr.data-testid]="'btn-pending-director-' + room.number"
                        class="h-10 px-3 rounded-xl bg-stone-200 text-stone-500 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <span class="material-symbols-outlined text-[16px]">hourglass_top</span>
                        <span>En attente d'accord du Directeur</span>
                      </button>
                    } @else {
                      <app-action-button
                        label="Signaler un problème"
                        icon="report_problem"
                        variant="outline"
                        [attr.data-action]="'report-problem-' + room.number"
                        [testId]="'btn-report-problem-' + room.number"
                        (action)="onReportProblem.emit(room)"
                      ></app-action-button>
                    }
                  }
                }

                @case (RoomStatus.OCCUPIED) {
                  @if (currentRole === Role.DIRECTION || currentRole === Role.RECEPTION) {
                    <!-- Action principale : Check-out -->
                    <app-action-button
                      label="Check-out"
                      icon="logout"
                      variant="solid"
                      color="primary"
                      [attr.data-action]="'check-out-' + room.number"
                      [testId]="'action-btn-check-out-' + room.number"
                      (action)="onStatusChange.emit({ status: RoomStatus.CLEANING, reason: 'Check-out client' })"
                    ></app-action-button>
                  }
                  @if (canReportProblem) {
                    @if (pendingIntervention) {
                      <button
                        type="button"
                        disabled
                        [attr.data-testid]="'btn-pending-director-' + room.number"
                        class="h-10 px-3 rounded-xl bg-stone-200 text-stone-500 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <span class="material-symbols-outlined text-[16px]">hourglass_top</span>
                        <span>En attente d'accord du Directeur</span>
                      </button>
                    } @else {
                      <app-action-button
                        label="Signaler un problème"
                        icon="report_problem"
                        variant="outline"
                        [attr.data-action]="'report-problem-' + room.number"
                        [testId]="'btn-report-problem-' + room.number"
                        (action)="onReportProblem.emit(room)"
                      ></app-action-button>
                    }
                  }
                }

                @case (RoomStatus.CLEANING) {
                  @if (currentRole !== Role.MAINTENANCE) {
                    <!-- Action principale : Marquer propre -->
                    <app-action-button
                      label="Marquer propre"
                      icon="done_all"
                      variant="solid"
                      color="success"
                      [attr.data-action]="'mark-free-' + room.number"
                      [testId]="'action-btn-mark-clean-' + room.number"
                      (action)="onStatusChange.emit({ status: RoomStatus.FREE, reason: 'Ménage achevé et contrôlé' })"
                    ></app-action-button>
                  }
                  @if (canReportProblem) {
                    @if (pendingIntervention) {
                      <button
                        type="button"
                        disabled
                        [attr.data-testid]="'btn-pending-director-' + room.number"
                        class="h-10 px-3 rounded-xl bg-stone-200 text-stone-500 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-not-allowed"
                      >
                        <span class="material-symbols-outlined text-[16px]">hourglass_top</span>
                        <span>En attente d'accord du Directeur</span>
                      </button>
                    } @else {
                      <app-action-button
                        label="Signaler un problème"
                        icon="report_problem"
                        variant="outline"
                        [attr.data-action]="'report-problem-' + room.number"
                        [testId]="'btn-report-problem-' + room.number"
                        (action)="onReportProblem.emit(room)"
                      ></app-action-button>
                    }
                  }
                }

                @case (RoomStatus.MAINTENANCE) {
                  @if (canRestoreFromMaintenance) {
                    <app-action-button
                      label="Remettre en service"
                      icon="check_circle"
                      variant="solid"
                      color="primary"
                      [attr.data-action]="'restore-' + room.number"
                      [testId]="'action-btn-restore-' + room.number"
                      (action)="onStatusChange.emit({ status: RoomStatus.FREE, reason: 'Petite intervention validée' })"
                    ></app-action-button>
                    <app-action-button
                      label="À nettoyer"
                      icon="cleaning_services"
                      variant="outline"
                      [attr.data-action]="'cleaning-' + room.number"
                      [testId]="'action-btn-cleaning-' + room.number"
                      (action)="onStatusChange.emit({ status: RoomStatus.CLEANING, reason: 'Travaux achevés, nettoyage requis' })"
                    ></app-action-button>
                  } @else {
                    <div
                      class="col-span-full text-center text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 rounded-xl py-2 px-3"
                      data-testid="maintenance-restricted-notice"
                    >
                      Remise en service réservée au directeur ou au service technique
                    </div>
                  }
                }
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .room-card {
      display: flex;
      flex-direction: column;
      height: 100%;
      border-radius: 1rem;
      border: 1px solid rgba(203, 213, 225, 0.6);
      background: var(--color-surface-container-lowest);
      box-shadow: 0 2px 8px rgba(10, 37, 64, 0.05);
      transition: transform 0.2s, box-shadow 0.2s;
      overflow: visible;
    }
    .room-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(10, 37, 64, 0.08);
    }
    .highlight-card {
      outline: 3px solid var(--color-primary);
      box-shadow: 0 0 0 6px rgba(0, 102, 111, 0.2), 0 8px 24px rgba(0, 102, 111, 0.25);
      animation: pulse-ring 2s infinite ease-in-out;
    }
    @keyframes pulse-ring {
      0%, 100% { outline-color: var(--color-primary); }
      50% { outline-color: rgba(0, 102, 111, 0.4); }
    }

    .room-title {
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }
    .room-category {
      overflow-wrap: anywhere;
      word-break: break-word;
      white-space: normal;
    }

    .menu-btn-trigger {
      width: 40px;
      height: 40px;
      box-sizing: border-box;
    }

    .room-menu-dropdown {
      min-width: 220px;
      box-sizing: border-box;
    }

    /* Grille d'actions selon spécification */
    .actions-footer {
      container-type: inline-size;
      width: 100%;
      box-sizing: border-box;
    }
    .actions-grid {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
      width: 100%;
      align-items: center;
    }

    /* Empilement automatique sur 2 lignes pleine largeur si carte trop étroite (< 260px) */
    @container (max-width: 259px) {
      .actions-grid {
        grid-template-columns: 1fr !important;
      }
    }
  `]
})
export class RoomStatusCardComponent {
  private readonly elementRef = inject(ElementRef, { optional: true });
  private readonly authService = inject(AuthService, { optional: true });

  @Input({ required: true }) room!: RoomUiItem;
  @Input() currentRole: Role = Role.DIRECTION;
  @Input() canViewAmounts: boolean | null = null;
  @Input() showActions: boolean = true;
  @Input() isHighlighted: boolean = false;

  @Output() onStatusChange = new EventEmitter<{ status: RoomStatus; reason?: string }>();
  @Output() onEdit = new EventEmitter<RoomUiItem>();
  @Output() onDeactivate = new EventEmitter<RoomUiItem>();
  @Output() onReactivate = new EventEmitter<RoomUiItem>();
  @Output() onDelete = new EventEmitter<RoomUiItem>();
  @Output() onView = new EventEmitter<RoomUiItem>();
  @Output() onReportProblem = new EventEmitter<RoomUiItem>();
  @Output() onApproveIntervention = new EventEmitter<string>();
  @Output() onRejectIntervention = new EventEmitter<RoomInterventionRequestDto>();
  @Output() onCompleteIntervention = new EventEmitter<string>();
  @Output() onAssignCategory = new EventEmitter<string>();

  readonly RoomStatus = RoomStatus;
  readonly Role = Role;
  readonly isMenuOpen = signal<boolean>(false);

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.isMenuOpen()) {
      this.closeMenu(true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event?: MouseEvent): void {
    if (this.isMenuOpen() && event && this.elementRef?.nativeElement) {
      const target = event.target as Node;
      if (!this.elementRef.nativeElement.contains(target)) {
        this.closeMenu(false);
      }
    } else if (this.isMenuOpen() && !event) {
      this.closeMenu(false);
    }
  }

  toggleMenu(event?: MouseEvent | KeyboardEvent): void {
    if (event?.stopPropagation) {
      event.stopPropagation();
    }
    const willOpen = !this.isMenuOpen();
    this.isMenuOpen.set(willOpen);
    if (willOpen && this.elementRef?.nativeElement) {
      setTimeout(() => {
        const firstAction = this.elementRef?.nativeElement?.querySelector?.('.menu-item-action') as HTMLElement | null;
        firstAction?.focus();
      }, 0);
    }
  }

  closeMenu(restoreFocus = false): void {
    this.isMenuOpen.set(false);
    if (restoreFocus && this.elementRef?.nativeElement) {
      setTimeout(() => {
        const btn = this.elementRef?.nativeElement?.querySelector?.('[data-testid^="room-menu-btn"]') as HTMLElement | null;
        btn?.focus();
      }, 0);
    }
  }

  onTriggerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!this.isMenuOpen()) {
        this.toggleMenu(event);
      }
    } else if (event.key === 'Escape' && this.isMenuOpen()) {
      event.preventDefault();
      this.closeMenu(true);
    }
  }

  onMenuKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation?.();
      this.closeMenu(true);
      return;
    }

    if (!this.elementRef?.nativeElement) return;
    const actions = Array.from(
      this.elementRef.nativeElement.querySelectorAll('.menu-item-action')
    ) as HTMLElement[];

    if (actions.length === 0) return;
    const currentIndex = actions.indexOf(document.activeElement as HTMLElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < actions.length - 1 ? currentIndex + 1 : 0;
      actions[nextIndex]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : actions.length - 1;
      actions[prevIndex]?.focus();
    } else if (event.key === 'Tab') {
      this.closeMenu(false);
    }
  }

  onActionView(): void {
    this.closeMenu(true);
    this.onView.emit(this.room);
  }

  onActionEdit(): void {
    this.closeMenu(true);
    this.onEdit.emit(this.room);
  }

  onActionDeactivate(): void {
    this.closeMenu(true);
    this.onDeactivate.emit(this.room);
  }

  onActionReactivate(): void {
    this.closeMenu(true);
    this.onReactivate.emit(this.room);
  }

  onActionDelete(): void {
    this.closeMenu(true);
    this.onDelete.emit(this.room);
  }

  get canReportProblem(): boolean {
    return this.currentRole === Role.RECEPTION || this.currentRole === Role.HOUSEKEEPING;
  }

  isReportedByHousekeeping(intervention: RoomInterventionRequestDto | null): boolean {
    return String(intervention?.reportedByRole || '').toUpperCase() === Role.HOUSEKEEPING;
  }

  get pendingIntervention(): RoomInterventionRequestDto | null {
    // L'équipe Technique (MAINTENANCE) ne doit JAMAIS voir une demande en attente d'accord Direction
    if (this.currentRole === Role.MAINTENANCE) {
      return null;
    }
    return (
      (this.room?.activeInterventions || []).find(
        (i) => i.status === RoomInterventionStatus.PENDING_DIRECTOR,
      ) || null
    );
  }

  get approvedIntervention(): RoomInterventionRequestDto | null {
    return (
      (this.room?.activeInterventions || []).find(
        (i) => i.status === RoomInterventionStatus.APPROVED,
      ) || null
    );
  }

  get canRestoreFromMaintenance(): boolean {
    return this.currentRole === Role.DIRECTION || this.currentRole === Role.MAINTENANCE;
  }

  get isUnclassified(): boolean {
    if (this.room?.isUnclassified === true) return true;
    const cat = (this.room?.category || this.room?.type?.name || '').trim();
    return !cat || cat === 'À classer' || !['Standard', 'Confort', 'Appartement'].includes(cat);
  }

  get normalizedSelectCategory(): string {
    const cat = (this.room?.tariffCategory?.name || this.room?.category || '').trim();
    if (['Standard', 'Confort', 'Appartement'].includes(cat)) return cat;
    return 'À classer';
  }

  onCategorySelectChange(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value;
    if (value) {
      this.onAssignCategory.emit(value);
    }
  }

  get displayedPrice(): number | null {
    const candidates = [
      this.room?.minTariffFcfa,
      this.room?.pricePerNight,
      this.room?.type?.pricePerNight,
    ];
    for (const p of candidates) {
      if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
        return p;
      }
    }
    return null;
  }

  get shouldShowPrice(): boolean {
    if (this.canViewAmounts === false) return false;
    if (this.canViewAmounts === null && this.authService && typeof this.authService.hasPermission === 'function') {
      if (!this.authService.hasPermission('voir_montants')) return false;
    }
    return this.displayedPrice !== null;
  }

  formatPrice(amount: number): string {
    return formatFcfa(amount);
  }
}
