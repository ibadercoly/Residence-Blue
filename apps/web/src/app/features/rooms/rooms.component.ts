import { Component, HostListener, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RoomsService, RoomUiItem } from '../../core/services/rooms.service';
import { NetworkService } from '../../core/offline/network.service';
import { OutboxService } from '../../core/offline/outbox.service';
import { RoomStatus, Role, CreateRoomDto, UpdateRoomDto } from '@residence-blue/shared';
import { RoomStatusCardComponent } from '../../shared/components/room-status-card/room-status-card.component';
import { processAndOptimizeImage } from '../../core/utils/image-processor.util';

@Component({
  selector: 'app-rooms',
  standalone: true,
  imports: [CommonModule, FormsModule, RoomStatusCardComponent],
  host: { class: 'block w-full max-w-full overflow-x-hidden' },
  template: `
    <div class="rooms-page flex flex-col gap-6 pb-16 w-full max-w-full overflow-x-hidden" data-testid="rooms-page">
      <!-- 2. NOUVEL EN-TÊTE DE L'ÉCRAN CHAMBRES -->
      <header class="rooms-header bg-surface-container-lowest rounded-2xl border border-outline-variant/60 p-4 sm:p-5 md:p-6 shadow-sm flex flex-col gap-4 w-full max-w-full" data-testid="rooms-header">
        <!-- Ligne 1 : Titre & sous-titre à gauche, Bouton "+ Ajouter une chambre" et pastille de connexion à droite -->
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="font-headline-md text-2xl md:text-3xl font-serif font-bold text-on-surface tracking-tight" data-testid="rooms-page-title">
              Chambres
            </h1>
            <p class="font-body-sm text-xs md:text-sm text-on-surface-variant mt-1" data-testid="rooms-page-subtitle">
              {{ roomsService.totalCount() }} chambres · Grand Standing, Thiès
            </p>
          </div>

          <div class="flex items-center gap-3 flex-wrap">
            <!-- Bouton principal "+ Ajouter une chambre" (Réservé strictement à DIRECTION) -->
            @if (roomsService.currentRole() === Role.DIRECTION) {
              <button
                type="button"
                (click)="openAddDrawer()"
                data-testid="btn-add-room"
                class="h-10 px-4 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-lg text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              >
                <span class="material-symbols-outlined text-[18px]">add</span>
                <span>+ Ajouter une chambre</span>
              </button>
            }

            <!-- Pastille de statut de connexion (hauteur 40px, grille de 8px) -->
            @if (outbox.pendingCount() > 0) {
              <button
                type="button"
                (click)="syncNow()"
                [disabled]="!network.isOnline() || outbox.isSyncing()"
                data-testid="sync-pending-indicator"
                class="h-10 px-3.5 rounded-xl bg-amber-500/15 text-amber-800 border border-amber-300 font-label-md text-xs font-semibold inline-flex items-center gap-2 hover:bg-amber-500/25 transition-all cursor-pointer shadow-sm"
                title="Cliquez pour synchroniser immédiatement"
              >
                <span class="material-symbols-outlined text-[16px] animate-spin text-amber-600">sync</span>
                <span>{{ outbox.pendingCount() }} en attente de sync</span>
              </button>
            } @else if (network.isOnline()) {
              <div
                class="h-10 px-3.5 rounded-xl bg-emerald-500/15 text-emerald-800 border border-emerald-300 font-label-md text-xs font-semibold inline-flex items-center gap-2"
                data-testid="network-online-indicator"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>En ligne</span>
              </div>
            } @else {
              <div
                class="h-10 px-3.5 rounded-xl bg-rose-500/15 text-rose-800 border border-rose-300 font-label-md text-xs font-semibold inline-flex items-center gap-2"
                data-testid="network-offline-indicator"
              >
                <span class="w-2 h-2 rounded-full bg-rose-500"></span>
                <span>Hors-ligne</span>
              </div>
            }
          </div>
        </div>

        <!-- Ligne 2 : Barre de filtres unique sur une ligne (pastilles d'état à gauche, listes et recherche à droite) -->
        <div class="filters-bar flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-outline-variant/40">
          <!-- Pastilles d'état avec point coloré et compteur -->
          <div class="status-pills-row flex items-center gap-2 flex-wrap">
            <!-- Toutes -->
            <button
              type="button"
              (click)="setFilter('ALL')"
              class="filter-pill h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              [class.active]="roomsService.selectedFilter() === 'ALL'"
              data-testid="filter-pill-all"
            >
              <span>Toutes</span>
              <span class="pill-badge"> ({{ roomsService.counts().total }})</span>
            </button>

            <!-- Libres -->
            <button
              type="button"
              (click)="setFilter(RoomStatus.FREE)"
              class="filter-pill h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              [class.active]="roomsService.selectedFilter() === RoomStatus.FREE"
              data-testid="filter-pill-free"
            >
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Libres</span>
              <span class="pill-badge"> ({{ roomsService.counts().free }})</span>
            </button>

            <!-- Occupées -->
            <button
              type="button"
              (click)="setFilter(RoomStatus.OCCUPIED)"
              class="filter-pill h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              [class.active]="roomsService.selectedFilter() === RoomStatus.OCCUPIED"
              data-testid="filter-pill-occupied"
            >
              <span class="w-2 h-2 rounded-full bg-[#00666f]"></span>
              <span>Occupées</span>
              <span class="pill-badge"> ({{ roomsService.counts().occupied }})</span>
            </button>

            <!-- Ménage -->
            <button
              type="button"
              (click)="setFilter(RoomStatus.CLEANING)"
              class="filter-pill h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              [class.active]="roomsService.selectedFilter() === RoomStatus.CLEANING"
              data-testid="filter-pill-cleaning"
            >
              <span class="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>Ménage</span>
              <span class="pill-badge"> ({{ roomsService.counts().cleaning }})</span>
            </button>

            <!-- Maintenance -->
            <button
              type="button"
              (click)="setFilter(RoomStatus.MAINTENANCE)"
              class="filter-pill h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
              [class.active]="roomsService.selectedFilter() === RoomStatus.MAINTENANCE"
              data-testid="filter-pill-maintenance"
            >
              <span class="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Maintenance</span>
              <span class="pill-badge"> ({{ roomsService.counts().maintenance }})</span>
            </button>

            <!-- Inactives (Visible uniquement si au moins 1 chambre est désactivée) -->
            @if (roomsService.counts().inactive > 0) {
              <button
                type="button"
                (click)="setFilter('INACTIVE')"
                class="filter-pill h-10 px-3.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 border transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
                [class.active]="roomsService.selectedFilter() === 'INACTIVE'"
                data-testid="filter-pill-inactive"
              >
                <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                <span>Inactives</span>
                <span class="pill-badge"> ({{ roomsService.counts().inactive }})</span>
              </button>
            }
          </div>

          <!-- Filtres de droite : Étage, Catégorie et Recherche (hauteur 40px uniforme, 8px de gap) -->
          <div class="filters-controls-row flex items-center gap-2 flex-wrap flex-1 sm:flex-initial justify-end">
            <!-- Liste déroulante Étage (Dynamique) -->
            <div class="relative">
              <select
                [ngModel]="roomsService.selectedFloor()"
                (ngModelChange)="onFloorChange($event)"
                data-testid="select-filter-floor"
                class="h-10 px-3 pr-8 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                aria-label="Filtrer par étage"
              >
                <option [ngValue]="null">Tous les étages</option>
                @for (floor of roomsService.floors(); track floor) {
                  <option [ngValue]="floor">Étage {{ floor }}</option>
                }
              </select>
              <span class="material-symbols-outlined text-[16px] text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>

            <!-- Liste déroulante Catégorie (Dynamique) -->
            <div class="relative">
              <select
                [ngModel]="roomsService.selectedCategory()"
                (ngModelChange)="onCategoryChange($event)"
                data-testid="select-filter-category"
                class="h-10 px-3 pr-8 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                aria-label="Filtrer par catégorie"
              >
                <option [ngValue]="null">Toutes catégories</option>
                @for (cat of roomsService.categories(); track cat) {
                  <option [ngValue]="cat">{{ cat }}</option>
                }
              </select>
              <span class="material-symbols-outlined text-[16px] text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                expand_more
              </span>
            </div>

            <!-- Champ de recherche par numéro ou catégorie (40px) -->
            <div class="relative w-full sm:w-56">
              <span class="material-symbols-outlined text-[18px] text-outline absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                type="text"
                [ngModel]="roomsService.searchQuery()"
                (ngModelChange)="roomsService.setSearchQuery($event)"
                placeholder="Rechercher une chambre..."
                data-testid="input-search-room"
                class="h-10 w-full pl-9 pr-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface placeholder:text-outline text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
        </div>

        <!-- Bannières de retour utilisateur & messages de conflits -->
        @if (roomsService.errorMessage()) {
          <div
            class="alert-banner error p-3.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-800 text-xs font-medium flex items-start justify-between gap-3 whitespace-pre-line"
            id="alert-error"
            data-testid="room-alert-error"
          >
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-[18px] text-rose-600 flex-shrink-0 mt-0.5">error</span>
              <div>{{ roomsService.errorMessage() }}</div>
            </div>
            <button
              type="button"
              (click)="dismissError()"
              class="text-rose-600 hover:text-rose-900 cursor-pointer"
              aria-label="Fermer l'alerte"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        }

        @if (roomsService.successMessage()) {
          <div
            class="alert-banner success p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium flex items-center justify-between gap-3"
            id="alert-success"
            data-testid="room-alert-success"
          >
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
              <span>{{ roomsService.successMessage() }}</span>
            </div>
            <button
              type="button"
              (click)="dismissSuccess()"
              class="text-emerald-600 hover:text-emerald-900 cursor-pointer"
              aria-label="Fermer la confirmation"
            >
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        }
      </header>

      <!-- 4. GRILLE DES CHAMBRES SANS SCROLL HORIZONTAL -->
      <div class="rooms-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" data-testid="rooms-grid">
        @for (room of roomsService.filteredRooms(); track room.id) {
          <app-room-status-card
            [room]="room"
            [currentRole]="roomsService.currentRole()"
            [isHighlighted]="roomsService.justHighlightedRoomId() === room.id"
            (onEdit)="openEditDrawer(room)"
            (onDeactivate)="deactivateRoom(room)"
            (onReactivate)="reactivateRoom(room)"
            (onView)="openEditDrawer(room)"
            (onStatusChange)="changeStatus(room.id, $event.status, $event.reason)"
          ></app-room-status-card>
        } @empty {
          <div class="col-span-full py-12 text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl border border-outline-variant/60">
            <span class="material-symbols-outlined text-[36px] text-outline mb-2">meeting_room</span>
            <p class="font-medium text-sm">Aucune chambre ne correspond à vos filtres.</p>
          </div>
        }
      </div>

      <!-- 3. TIROIR D'AJOUT ET MODIFICATION DE CHAMBRE (Drawer) -->
      @if (roomsService.isDrawerOpen()) {
        <!-- Backdrop -->
        <div
          class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity"
          (click)="closeDrawer()"
          aria-hidden="true"
        ></div>

        <!-- Tiroir (Right sheet sur PC / Bottom sheet sous 768px) -->
        <aside
          class="room-drawer fixed z-50 bg-surface shadow-2xl flex flex-col overflow-hidden transition-transform duration-300
                 inset-x-0 bottom-0 max-h-[92dvh] rounded-t-3xl md:inset-x-auto md:bottom-auto md:top-0 md:right-0 md:h-full md:max-h-full md:w-[560px] md:rounded-l-3xl md:rounded-tr-none border-t md:border-t-0 md:border-l border-outline-variant/60"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="drawerTitle()"
          data-testid="room-drawer"
          (click)="$event.stopPropagation()"
        >
          <!-- En-tête fixe du tiroir -->
          <div class="drawer-header p-5 border-b border-outline-variant/40 flex items-center justify-between flex-shrink-0 bg-surface">
            <div>
              <h2 class="font-title-lg text-lg font-serif font-bold text-on-surface" data-testid="drawer-title">
                {{ drawerTitle() }}
              </h2>
              <p class="text-xs text-on-surface-variant mt-0.5">
                Configuration des caractéristiques, tarifs et équipements
              </p>
            </div>
            <button
              type="button"
              (click)="closeDrawer()"
              class="w-9 h-9 rounded-full bg-surface-container-high hover:bg-surface-variant text-on-surface flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Fermer"
              data-testid="btn-close-drawer"
            >
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Corps défilant du formulaire (4 sections) -->
          <div class="drawer-body flex-1 overflow-y-auto p-5 space-y-6">
            <!-- SECTION 1 : IDENTIFICATION -->
            <section class="space-y-4">
              <div class="flex items-center gap-2 pb-1 border-b border-outline-variant/30">
                <span class="material-symbols-outlined text-primary text-[18px]">domain</span>
                <h3 class="font-title-sm text-xs font-bold uppercase tracking-wider text-primary">
                  1. Identification de la chambre
                </h3>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Numéro ou nom (obligatoire, unique) -->
                <div>
                  <label for="room-number" class="block text-xs font-semibold text-on-surface mb-1">
                    Numéro / Nom de la chambre <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="room-number"
                    type="text"
                    [(ngModel)]="formNumber"
                    (input)="onNumberInput()"
                    placeholder="Ex: 401"
                    data-testid="input-room-number"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    [class.border-rose-500]="formNumberError()"
                  />
                  @if (formNumberError()) {
                    <p class="text-[11px] text-rose-600 font-medium mt-1" data-testid="error-room-number">
                      {{ formNumberError() }}
                    </p>
                  }
                </div>

                <!-- Étage (nombre, obligatoire) -->
                <div>
                  <label for="room-floor" class="block text-xs font-semibold text-on-surface mb-1">
                    Étage <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="room-floor"
                    type="number"
                    [(ngModel)]="formFloor"
                    placeholder="1"
                    data-testid="input-room-floor"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Catégorie (Standard, Deluxe, Suite ou à la volée) -->
                <div>
                  <label for="room-category" class="block text-xs font-semibold text-on-surface mb-1">
                    Catégorie <span class="text-rose-500">*</span>
                  </label>
                  <select
                    id="room-category"
                    [(ngModel)]="formCategory"
                    data-testid="select-room-category"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Standard">Standard</option>
                    <option value="Deluxe">Deluxe</option>
                    <option value="Suite">Suite</option>
                    <option value="Autre">Autre catégorie (créée à la volée)...</option>
                  </select>

                  @if (formCategory === 'Autre') {
                    <input
                      type="text"
                      [(ngModel)]="formCustomCategory"
                      placeholder="Nom de la nouvelle catégorie"
                      data-testid="input-room-category-custom"
                      class="w-full h-10 px-3 mt-2 rounded-xl bg-surface-container-lowest border border-primary text-on-surface text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  }
                </div>

                <!-- Statut initial (Libre ou Maintenance) -->
                <div>
                  <label for="room-status" class="block text-xs font-semibold text-on-surface mb-1">
                    Statut initial
                  </label>
                  <select
                    id="room-status"
                    [(ngModel)]="formStatus"
                    data-testid="select-room-status"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option [value]="RoomStatus.FREE">Libre</option>
                    <option [value]="RoomStatus.MAINTENANCE">En maintenance</option>
                  </select>
                </div>
              </div>
            </section>

            <!-- SECTION 2 : CAPACITÉ ET CONFORT -->
            <section class="space-y-4">
              <div class="flex items-center gap-2 pb-1 border-b border-outline-variant/30">
                <span class="material-symbols-outlined text-primary text-[18px]">bed</span>
                <h3 class="font-title-sm text-xs font-bold uppercase tracking-wider text-primary">
                  2. Capacité & Confort
                </h3>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <!-- Adultes (1 à 6) -->
                <div>
                  <label for="room-adults" class="block text-xs font-semibold text-on-surface mb-1">Adultes (1-6)</label>
                  <input
                    id="room-adults"
                    type="number"
                    min="1"
                    max="6"
                    [(ngModel)]="formAdults"
                    data-testid="input-room-adults"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <!-- Enfants (0 à 4) -->
                <div>
                  <label for="room-children" class="block text-xs font-semibold text-on-surface mb-1">Enfants (0-4)</label>
                  <input
                    id="room-children"
                    type="number"
                    min="0"
                    max="4"
                    [(ngModel)]="formChildren"
                    data-testid="input-room-children"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <!-- Nombre de lits -->
                <div>
                  <label for="room-beds-count" class="block text-xs font-semibold text-on-surface mb-1">Nb de lits</label>
                  <input
                    id="room-beds-count"
                    type="number"
                    min="1"
                    [(ngModel)]="formBedsCount"
                    data-testid="input-room-beds-count"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <!-- Surface en m² -->
                <div>
                  <label for="room-surface" class="block text-xs font-semibold text-on-surface mb-1">Surface (m²)</label>
                  <input
                    id="room-surface"
                    type="number"
                    min="10"
                    [(ngModel)]="formSurfaceM2"
                    data-testid="input-room-surface"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Type de lit -->
                <div>
                  <label for="room-bed-type" class="block text-xs font-semibold text-on-surface mb-1">Type de lit</label>
                  <select
                    id="room-bed-type"
                    [(ngModel)]="formBedType"
                    data-testid="select-room-bed-type"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="simple">Lit simple</option>
                    <option value="double">Lit double</option>
                    <option value="queen">Queen Size (160 cm)</option>
                    <option value="king">King Size (180 cm)</option>
                    <option value="lits jumeaux">Lits jumeaux</option>
                  </select>
                </div>

                <!-- Vue -->
                <div>
                  <label for="room-view" class="block text-xs font-semibold text-on-surface mb-1">Vue</label>
                  <select
                    id="room-view"
                    [(ngModel)]="formView"
                    data-testid="select-room-view"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="jardin">Jardin intérieur</option>
                    <option value="ville">Ville (Thiès)</option>
                    <option value="piscine">Piscine & Patio</option>
                    <option value="cour">Cour fleurie</option>
                    <option value="mer">Mer (panoramique)</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Fumeur ou non-fumeur -->
                <div>
                  <span class="block text-xs font-semibold text-on-surface mb-1">Usage tabac</span>
                  <div class="flex items-center gap-3 h-10">
                    <label class="flex items-center gap-2 text-xs font-medium text-on-surface cursor-pointer">
                      <input
                        type="radio"
                        name="smoking"
                        [value]="false"
                        [(ngModel)]="formSmoking"
                        data-testid="input-room-nonsmoking"
                      />
                      <span>Non-fumeur</span>
                    </label>
                    <label class="flex items-center gap-2 text-xs font-medium text-on-surface cursor-pointer">
                      <input
                        type="radio"
                        name="smoking"
                        [value]="true"
                        [(ngModel)]="formSmoking"
                        data-testid="input-room-smoking"
                      />
                      <span>Fumeur autorisé</span>
                    </label>
                  </div>
                </div>

                <!-- Chambre communicante -->
                <div>
                  <label for="room-connecting" class="block text-xs font-semibold text-on-surface mb-1">
                    Chambre communicante (facultatif)
                  </label>
                  <input
                    id="room-connecting"
                    type="text"
                    [(ngModel)]="formConnectingRoom"
                    placeholder="Ex: Chambre 402"
                    data-testid="input-room-connecting"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </section>

            <!-- SECTION 3 : ÉQUIPEMENTS -->
            <section class="space-y-4">
              <div class="flex items-center gap-2 pb-1 border-b border-outline-variant/30">
                <span class="material-symbols-outlined text-primary text-[18px]">verified</span>
                <h3 class="font-title-sm text-xs font-bold uppercase tracking-wider text-primary">
                  3. Équipements de la chambre
                </h3>
              </div>

              <!-- Jetons cliquables -->
              <div class="flex flex-wrap gap-2">
                @for (amenity of availableAmenities; track amenity) {
                  <button
                    type="button"
                    (click)="toggleAmenity(amenity)"
                    data-testid="amenity-chip"
                    class="px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5"
                    [class.bg-primary]="isAmenitySelected(amenity)"
                    [class.text-on-primary]="isAmenitySelected(amenity)"
                    [class.border-primary]="isAmenitySelected(amenity)"
                    [class.bg-surface-container-lowest]="!isAmenitySelected(amenity)"
                    [class.text-on-surface]="!isAmenitySelected(amenity)"
                    [class.border-outline-variant]="!isAmenitySelected(amenity)"
                  >
                    @if (isAmenitySelected(amenity)) {
                      <span class="material-symbols-outlined text-[14px]">check</span>
                    }
                    <span>{{ amenity }}</span>
                  </button>
                }
              </div>

              <!-- Ajout d'équipement personnalisé -->
              <div class="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  [(ngModel)]="formCustomAmenity"
                  placeholder="Autre équipement personnalisé..."
                  data-testid="input-custom-amenity"
                  class="flex-1 h-9 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  (keyup.enter)="addCustomAmenity()"
                />
                <button
                  type="button"
                  (click)="addCustomAmenity()"
                  data-testid="btn-add-custom-amenity"
                  class="h-9 px-3 rounded-xl bg-surface-container-high hover:bg-surface-variant text-on-surface text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <span class="material-symbols-outlined text-[16px]">add</span>
                  <span>Ajouter</span>
                </button>
              </div>
            </section>

            <!-- SECTION 4 : TARIFS ET PRÉSENTATION -->
            <section class="space-y-4">
              <div class="flex items-center gap-2 pb-1 border-b border-outline-variant/30">
                <span class="material-symbols-outlined text-primary text-[18px]">payments</span>
                <h3 class="font-title-sm text-xs font-bold uppercase tracking-wider text-primary">
                  4. Tarifs & Présentation
                </h3>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <!-- Prix standard par nuit (obligatoire, entier positif FCFA) -->
                <div>
                  <label for="room-price" class="block text-xs font-semibold text-on-surface mb-1">
                    Prix par nuit (FCFA) <span class="text-rose-500">*</span>
                  </label>
                  <input
                    id="room-price"
                    type="number"
                    min="1"
                    step="1000"
                    [(ngModel)]="formPrice"
                    data-testid="input-room-price"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-bold text-primary outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <!-- Tarif haute saison -->
                <div>
                  <label for="room-price-high" class="block text-xs font-semibold text-on-surface mb-1">
                    Haute saison (FCFA)
                  </label>
                  <input
                    id="room-price-high"
                    type="number"
                    min="0"
                    step="1000"
                    [(ngModel)]="formHighSeasonPrice"
                    placeholder="Optionnel"
                    data-testid="input-room-price-high"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <!-- Tarif entreprise -->
                <div>
                  <label for="room-price-corporate" class="block text-xs font-semibold text-on-surface mb-1">
                    Entreprise (FCFA)
                  </label>
                  <input
                    id="room-price-corporate"
                    type="number"
                    min="0"
                    step="1000"
                    [(ngModel)]="formCorporatePrice"
                    placeholder="Optionnel"
                    data-testid="input-room-price-corporate"
                    class="w-full h-10 px-3 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <!-- Petit-déjeuner inclus -->
              <div class="flex items-center gap-2">
                <input
                  id="room-breakfast"
                  type="checkbox"
                  [(ngModel)]="formBreakfastIncluded"
                  data-testid="input-room-breakfast"
                  class="w-4 h-4 rounded text-primary focus:ring-primary"
                />
                <label for="room-breakfast" class="text-xs font-medium text-on-surface cursor-pointer">
                  Petit-déjeuner buffet inclus dans le tarif de la nuitée
                </label>
              </div>

              <!-- Photo principale (Upload avec redimensionnement automatique client via image-processor) -->
              <div>
                <label for="room-photo" class="block text-xs font-semibold text-on-surface mb-1">
                  Photo principale de la chambre
                </label>
                <div class="flex items-center gap-3">
                  <input
                    id="room-photo"
                    type="file"
                    accept="image/*"
                    (change)="onPhotoSelected($event)"
                    data-testid="input-room-photo"
                    class="text-xs text-on-surface-variant file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-container-high file:text-on-surface hover:file:bg-surface-variant cursor-pointer"
                  />
                  @if (formImageProcessing()) {
                    <span class="text-xs text-primary font-medium flex items-center gap-1">
                      <span class="material-symbols-outlined text-[16px] animate-spin">sync</span>
                      Traitement WebP...
                    </span>
                  }
                </div>

                @if (formImagePreview) {
                  <div class="mt-2 relative w-32 h-20 rounded-xl overflow-hidden border border-outline-variant/60">
                    <img [src]="formImagePreview" alt="Aperçu chambre" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      (click)="removePhoto()"
                      class="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                      title="Supprimer la photo"
                    >
                      ×
                    </button>
                  </div>
                }
              </div>

              <!-- Description courte (200 car max avec compteur) -->
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label for="room-description" class="text-xs font-semibold text-on-surface">
                    Description courte
                  </label>
                  <span
                    class="text-[11px] font-medium"
                    [class.text-rose-600]="formDescription.length > 200"
                    [class.text-on-surface-variant]="formDescription.length <= 200"
                  >
                    {{ formDescription.length }} / 200 caractères
                  </span>
                </div>
                <textarea
                  id="room-description"
                  rows="2"
                  maxlength="200"
                  [(ngModel)]="formDescription"
                  placeholder="Description commerciale synthétique (vue, agencement, atouts)..."
                  data-testid="input-room-description"
                  class="w-full p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                ></textarea>
              </div>

              <!-- Note interne pour le personnel -->
              <div>
                <label for="room-internal-note" class="block text-xs font-semibold text-on-surface mb-1">
                  Note interne (réservée au personnel d'étage et technique)
                </label>
                <textarea
                  id="room-internal-note"
                  rows="2"
                  [(ngModel)]="formInternalNote"
                  placeholder="Informations d'exploitation, réglages climatisation, historique..."
                  data-testid="input-room-note"
                  class="w-full p-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/60 text-on-surface text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                ></textarea>
              </div>
            </section>
          </div>

          <!-- Pied fixe du tiroir avec boutons d'action -->
          <div class="drawer-footer p-4 border-t border-outline-variant/40 flex items-center justify-end gap-3 flex-shrink-0 bg-surface">
            <button
              type="button"
              (click)="closeDrawer()"
              data-testid="btn-cancel-room"
              class="h-10 px-4 rounded-xl border border-outline-variant/60 hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              (click)="saveRoom()"
              [disabled]="!isFormValid() || isSubmitting()"
              data-testid="btn-save-room"
              class="h-10 px-5 rounded-xl bg-primary hover:bg-primary-container disabled:opacity-40 disabled:pointer-events-none text-on-primary text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              {{ isSubmitting() ? 'Enregistrement...' : (roomsService.editingRoom() ? 'Enregistrer les modifications' : 'Enregistrer la chambre') }}
            </button>
          </div>
        </aside>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
    .filter-pill {
      background: var(--color-surface-container-lowest);
      border-color: var(--color-outline-variant);
      color: var(--color-on-surface);
    }
    .filter-pill:hover {
      background: var(--color-surface-container-high);
    }
    .filter-pill.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .filter-pill.active .pill-badge {
      color: var(--color-on-primary);
      opacity: 0.9;
    }
    .pill-badge {
      font-size: 0.75rem;
      opacity: 0.75;
    }
  `]
})
export class RoomsComponent {
  readonly RoomStatus = RoomStatus;
  readonly Role = Role;

  // Champs du formulaire Drawer
  formNumber: string = '';
  formFloor: number = 1;
  formCategory: string = 'Standard';
  formCustomCategory: string = '';
  formStatus: RoomStatus = RoomStatus.FREE;
  formAdults: number = 2;
  formChildren: number = 0;
  formBedType: string = 'queen';
  formBedsCount: number = 1;
  formSurfaceM2: number = 25;
  formView: string = 'jardin';
  formSmoking: boolean = false;
  formConnectingRoom: string = '';
  formAmenities: string[] = ['Climatisation', 'Wi-Fi Fibre'];
  formCustomAmenity: string = '';
  formPrice: number = 35000;
  formHighSeasonPrice: number | null = null;
  formCorporatePrice: number | null = null;
  formBreakfastIncluded: boolean = true;
  formImageUrl: string = '';
  formImagePreview: string | null = null;
  formDescription: string = '';
  formInternalNote: string = '';

  formNumberError = signal<string | null>(null);
  formImageProcessing = signal<boolean>(false);
  isSubmitting = signal<boolean>(false);

  readonly availableAmenities: string[] = [
    'Climatisation',
    'Ventilateur',
    'Wi-Fi Fibre',
    'Télévision 4K',
    'Minibar',
    'Coffre-fort',
    'Balcon',
    'Bureau de travail',
    'Eau chaude',
    'Baignoire',
    'Douche italienne',
    'Bouilloire',
  ];

  readonly drawerTitle = computed(() => {
    const editing = this.roomsService.editingRoom();
    return editing ? `Modifier la chambre ${editing.number}` : 'Ajouter une chambre';
  });

  constructor(
    public readonly roomsService: RoomsService,
    public readonly network: NetworkService,
    public readonly outbox: OutboxService,
  ) {}

  @HostListener('window:keydown.escape')
  onEscape(): void {
    if (this.roomsService.isDrawerOpen()) {
      this.closeDrawer();
    }
  }

  setFilter(filter: string): void {
    this.roomsService.setFilter(filter);
  }

  onFloorChange(floor: number | null): void {
    this.roomsService.setFloor(floor);
  }

  onCategoryChange(cat: string | null): void {
    this.roomsService.setCategory(cat);
  }

  dismissError(): void {
    this.roomsService.errorMessage.set(null);
  }

  dismissSuccess(): void {
    this.roomsService.successMessage.set(null);
  }

  async syncNow(): Promise<void> {
    await this.roomsService.syncOutbox();
  }

  async changeStatus(roomId: string, targetStatus: RoomStatus, reason?: string): Promise<void> {
    await this.roomsService.changeRoomStatus(roomId, targetStatus, reason);
  }

  /**
   * Ouvre le tiroir pour ajouter une nouvelle chambre
   */
  openAddDrawer(): void {
    this.resetForm();
    this.roomsService.openAddDrawer();
  }

  /**
   * Ouvre le tiroir pour modifier une chambre existante
   */
  openEditDrawer(room: RoomUiItem): void {
    this.populateForm(room);
    this.roomsService.openEditDrawer(room);
  }

  closeDrawer(): void {
    this.roomsService.closeDrawer();
    this.resetForm();
  }

  resetForm(): void {
    this.formNumber = '';
    this.formFloor = 1;
    this.formCategory = 'Standard';
    this.formCustomCategory = '';
    this.formStatus = RoomStatus.FREE;
    this.formAdults = 2;
    this.formChildren = 0;
    this.formBedType = 'queen';
    this.formBedsCount = 1;
    this.formSurfaceM2 = 25;
    this.formView = 'jardin';
    this.formSmoking = false;
    this.formConnectingRoom = '';
    this.formAmenities = ['Climatisation', 'Wi-Fi Fibre'];
    this.formCustomAmenity = '';
    this.formPrice = 35000;
    this.formHighSeasonPrice = null;
    this.formCorporatePrice = null;
    this.formBreakfastIncluded = true;
    this.formImageUrl = '';
    this.formImagePreview = null;
    this.formDescription = '';
    this.formInternalNote = '';
    this.formNumberError.set(null);
    this.isSubmitting.set(false);
  }

  populateForm(room: RoomUiItem): void {
    this.formNumber = room.number;
    this.formFloor = room.floor;
    const cat = room.category || room.type?.name || 'Standard';
    if (['Standard', 'Deluxe', 'Suite'].includes(cat)) {
      this.formCategory = cat;
      this.formCustomCategory = '';
    } else {
      this.formCategory = 'Autre';
      this.formCustomCategory = cat;
    }
    this.formStatus = room.status;
    this.formAdults = room.adultsCapacity || 2;
    this.formChildren = room.childrenCapacity || 0;
    this.formBedType = room.bedType || 'queen';
    this.formBedsCount = room.bedsCount || 1;
    this.formSurfaceM2 = room.surfaceM2 || 25;
    this.formView = room.view || 'jardin';
    this.formSmoking = Boolean(room.smoking);
    this.formConnectingRoom = room.connectingRoom || '';
    this.formAmenities = room.amenities ? [...room.amenities] : ['Climatisation', 'Wi-Fi Fibre'];
    this.formCustomAmenity = '';
    this.formPrice = room.type?.pricePerNight || 35000;
    this.formHighSeasonPrice = room.highSeasonPricePerNight || null;
    this.formCorporatePrice = room.corporatePricePerNight || null;
    this.formBreakfastIncluded = room.breakfastIncluded ?? true;
    this.formImageUrl = room.imageUrl || room.image || '';
    this.formImagePreview = room.imageUrl || room.image || null;
    this.formDescription = room.description || '';
    this.formInternalNote = room.internalNote || '';
    this.formNumberError.set(null);
    this.isSubmitting.set(false);
  }

  onNumberInput(): void {
    const num = this.formNumber.trim();
    if (!num) {
      this.formNumberError.set('Le numéro de la chambre est obligatoire.');
      return;
    }
    const editing = this.roomsService.editingRoom();
    const isDuplicate = this.roomsService.rooms().some((r) => {
      if (editing && r.id === editing.id) return false;
      return r.number.trim().toLowerCase() === num.toLowerCase();
    });
    if (isDuplicate) {
      this.formNumberError.set(`La chambre "${num}" existe déjà. Veuillez renseigner un numéro unique.`);
    } else {
      this.formNumberError.set(null);
    }
  }

  isAmenitySelected(amenity: string): boolean {
    return this.formAmenities.includes(amenity);
  }

  toggleAmenity(amenity: string): void {
    if (this.isAmenitySelected(amenity)) {
      this.formAmenities = this.formAmenities.filter((a) => a !== amenity);
    } else {
      this.formAmenities.push(amenity);
    }
  }

  addCustomAmenity(): void {
    const trimmed = this.formCustomAmenity.trim();
    if (trimmed && !this.formAmenities.includes(trimmed)) {
      this.formAmenities.push(trimmed);
      this.formCustomAmenity = '';
    }
  }

  async onPhotoSelected(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.formImageProcessing.set(true);
    try {
      const result = await processAndOptimizeImage(file);
      this.formImageUrl = result.mediumDataUrl;
      this.formImagePreview = result.mediumDataUrl;
      this.formNumberError.set(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors du traitement de l'image.";
      this.roomsService.errorMessage.set(msg);
    } finally {
      this.formImageProcessing.set(false);
    }
  }

  removePhoto(): void {
    this.formImageUrl = '';
    this.formImagePreview = null;
  }

  isFormValid(): boolean {
    const cleanNum = this.formNumber.trim();
    if (!cleanNum) return false;
    if (this.formNumberError()) return false;
    const floor = Number(this.formFloor);
    if (isNaN(floor)) return false;
    const price = Number(this.formPrice);
    if (isNaN(price) || price <= 0) return false;
    if (this.formDescription.length > 200) return false;
    if (this.formCategory === 'Autre' && !this.formCustomCategory.trim()) return false;
    return true;
  }

  async saveRoom(): Promise<void> {
    if (!this.isFormValid() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    try {
      const categoryName = this.formCategory === 'Autre'
        ? this.formCustomCategory.trim() || 'Standard'
        : this.formCategory;

      const editing = this.roomsService.editingRoom();

      if (editing) {
        const dto: UpdateRoomDto = {
          number: this.formNumber.trim(),
          floor: Number(this.formFloor),
          category: categoryName,
          status: this.formStatus,
          pricePerNight: Math.round(Number(this.formPrice)),
          highSeasonPricePerNight: this.formHighSeasonPrice ? Math.round(Number(this.formHighSeasonPrice)) : undefined,
          corporatePricePerNight: this.formCorporatePrice ? Math.round(Number(this.formCorporatePrice)) : undefined,
          breakfastIncluded: this.formBreakfastIncluded,
          adultsCapacity: Number(this.formAdults),
          childrenCapacity: Number(this.formChildren),
          bedType: this.formBedType,
          bedsCount: Number(this.formBedsCount),
          surfaceM2: Number(this.formSurfaceM2),
          view: this.formView,
          smoking: this.formSmoking,
          connectingRoom: this.formConnectingRoom.trim(),
          amenities: this.formAmenities,
          imageUrl: this.formImageUrl || editing.imageUrl,
          description: this.formDescription.trim(),
          internalNote: this.formInternalNote.trim(),
        };

        await this.roomsService.updateRoom(editing.id, dto);
      } else {
        const dto: CreateRoomDto = {
          number: this.formNumber.trim(),
          floor: Number(this.formFloor),
          category: categoryName,
          status: this.formStatus,
          pricePerNight: Math.round(Number(this.formPrice)),
          highSeasonPricePerNight: this.formHighSeasonPrice ? Math.round(Number(this.formHighSeasonPrice)) : undefined,
          corporatePricePerNight: this.formCorporatePrice ? Math.round(Number(this.formCorporatePrice)) : undefined,
          breakfastIncluded: this.formBreakfastIncluded,
          adultsCapacity: Number(this.formAdults),
          childrenCapacity: Number(this.formChildren),
          bedType: this.formBedType,
          bedsCount: Number(this.formBedsCount),
          surfaceM2: Number(this.formSurfaceM2),
          view: this.formView,
          smoking: this.formSmoking,
          connectingRoom: this.formConnectingRoom.trim(),
          amenities: this.formAmenities,
          imageUrl: this.formImageUrl,
          description: this.formDescription.trim(),
          internalNote: this.formInternalNote.trim(),
        };

        await this.roomsService.addRoom(dto);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async deactivateRoom(room: RoomUiItem): Promise<void> {
    const confirmDeactivation =
      typeof window !== 'undefined' && typeof window.confirm === 'function'
        ? window.confirm(
            `Voulez-vous vraiment désactiver la chambre ${room.number} ? Elle ne sera plus proposée aux réservations.`
          )
        : true;

    if (!confirmDeactivation) return;
    await this.roomsService.deactivateRoom(room.id);
  }

  async reactivateRoom(room: RoomUiItem): Promise<void> {
    await this.roomsService.reactivateRoom(room.id);
  }
}
