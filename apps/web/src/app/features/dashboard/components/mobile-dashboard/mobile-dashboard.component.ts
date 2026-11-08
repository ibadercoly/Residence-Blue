import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface MobileRoomCard {
  number: string;
  name: string;
  nameColorClass: string;
  status: 'Occupée' | 'Libre' | 'Ménage' | 'Maint.';
  footerText: string;
  footerType: 'guest' | 'ready-gold' | 'ready-teal' | 'cleaning' | 'maintenance';
  footerIcon: string;
}

@Component({
  selector: 'app-mobile-dashboard',
  standalone: true,
  imports: [RouterLink],
  host: { class: 'block w-full' },
  template: `
    <div class="flex flex-col w-full px-margin-sm space-y-space-md">
      <!-- 1. En-tête d'accueil & Action rapide -->
      <section class="flex flex-col gap-space-sm pt-space-xs">
        <div class="flex items-start justify-between gap-space-sm">
          <div class="flex flex-col min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-secondary font-title-md text-title-md">Bonjour Aïssatou</span>
              <span class="material-symbols-outlined text-secondary text-[18px]" aria-hidden="true">waving_hand</span>
            </div>
            <p class="text-on-surface-variant font-body-sm text-body-sm flex items-center gap-1 mt-0.5">
              <span class="material-symbols-outlined text-[15px] text-secondary" aria-hidden="true">wb_sunny</span>
              <span>Vendredi 24 Mai • Saly Portudal, 29°C</span>
            </p>
          </div>
          <!-- Quick Action: Nouvelle réservation -->
          <a
            routerLink="/reservations/nouvelle"
            class="flex items-center gap-1.5 bg-primary hover:bg-primary-container active:scale-95 text-on-primary font-label-lg text-label-lg px-3.5 py-2.5 rounded-xl shadow-md transition-all flex-shrink-0 cursor-pointer"
          >
            <span class="material-symbols-outlined text-[19px]" aria-hidden="true">add</span>
            <span>Nouvelle résa</span>
          </a>
        </div>
        <!-- Ambiance maritime & status strip -->
        <div class="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary/10 via-surface-container-high to-secondary/10 p-space-sm flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-primary animate-ping" aria-hidden="true"></span>
            <span class="font-body-sm text-body-sm text-on-surface font-semibold">Petite Côte • Marée haute à 16h40</span>
          </div>
          <span class="font-label-md text-label-md text-primary font-medium tracking-wide">12 Clés Actives</span>
        </div>
      </section>

      <!-- 2. Indicateurs Clés (KPIs) en grille mobile 2 colonnes -->
      <section class="grid grid-cols-2 gap-space-sm" aria-label="Indicateurs clés">
        <!-- KPI 1 : Occupation -->
        <div class="bg-surface-container-lowest p-space-sm rounded-xl shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-on-surface-variant">
            <span class="font-label-md text-label-md">Occupation</span>
            <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">hotel</span>
          </div>
          <div class="my-1.5">
            <div class="flex items-baseline gap-1.5">
              <span class="font-headline-lg-mobile text-headline-lg-mobile text-on-surface font-bold">83%</span>
              <span class="inline-flex items-center text-[11px] font-semibold text-primary">
                <span class="material-symbols-outlined text-[13px]" aria-hidden="true">arrow_upward</span>+8%
              </span>
            </div>
            <p class="font-body-sm text-[11px] text-on-surface-variant leading-tight">10 sur 12 chambres occupées</p>
          </div>
          <div class="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
            <div class="bg-primary h-full rounded-full" style="width: 83.3%;"></div>
          </div>
        </div>

        <!-- KPI 2 : Revenus du Jour -->
        <div class="bg-surface-container-lowest p-space-sm rounded-xl shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-on-surface-variant">
            <span class="font-label-md text-label-md">Revenus du jour</span>
            <span class="material-symbols-outlined text-secondary text-[20px]" aria-hidden="true">payments</span>
          </div>
          <div class="my-1.5">
            <div class="font-label-currency text-label-currency text-on-surface font-bold truncate">
              1 420 000 <span class="text-[11px] font-medium text-on-surface-variant">FCFA</span>
            </div>
            <div class="flex flex-col text-[10px] text-on-surface-variant mt-1 leading-tight space-y-0.5">
              <div class="flex justify-between"><span>Héberg.</span> <span class="font-medium text-on-surface">1 180k</span></div>
              <div class="flex justify-between"><span>Resto</span> <span class="font-medium text-on-surface">240k</span></div>
            </div>
          </div>
          <div class="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
            <div class="bg-secondary h-full rounded-full" style="width: 75%;"></div>
          </div>
        </div>

        <!-- KPI 3 : Arrivées -->
        <div class="bg-surface-container-lowest p-space-sm rounded-xl shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-on-surface-variant">
            <span class="font-label-md text-label-md">Arrivées</span>
            <span class="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">luggage</span>
          </div>
          <div class="mt-1">
            <div class="font-headline-sm text-headline-sm text-on-surface font-semibold">4 prévues</div>
            <p class="font-body-sm text-[11px] text-on-surface-variant mt-0.5">2 enregistrées • 2 attendues</p>
          </div>
          <div class="flex items-center gap-1 mt-2">
            <span class="h-2 w-1/2 bg-primary rounded-full"></span>
            <span class="h-2 w-1/2 bg-surface-container-high rounded-full"></span>
          </div>
        </div>

        <!-- KPI 4 : Départs -->
        <div class="bg-surface-container-lowest p-space-sm rounded-xl shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col justify-between">
          <div class="flex items-center justify-between text-on-surface-variant">
            <span class="font-label-md text-label-md">Départs</span>
            <span class="material-symbols-outlined text-tertiary text-[20px]" aria-hidden="true">flight_takeoff</span>
          </div>
          <div class="mt-1">
            <div class="font-headline-sm text-headline-sm text-on-surface font-semibold">3 prévus</div>
            <p class="font-body-sm text-[11px] text-primary font-medium mt-0.5 flex items-center gap-1">
              <span class="material-symbols-outlined text-[13px]" aria-hidden="true">check_circle</span>
              <span>Tous libérés à 11h</span>
            </p>
          </div>
          <div class="w-full bg-primary/20 rounded-full h-1.5 mt-2 overflow-hidden">
            <div class="bg-primary h-full rounded-full w-full"></div>
          </div>
        </div>
      </section>

      <!-- 3. Alertes Opérationnelles & Housekeeping -->
      <section class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between">
          <span class="font-title-md text-title-md text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-secondary text-[20px]" aria-hidden="true">notifications_active</span>
            Alertes en cours
          </span>
          <span class="font-label-md text-label-md bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-full font-semibold">2 urgences</span>
        </div>

        <!-- Alerte 1: Housekeeping Chambre 10 -->
        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex items-start gap-3 relative overflow-hidden">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary-container"></div>
          <div class="w-9 h-9 rounded-lg bg-secondary-fixed/50 flex items-center justify-center flex-shrink-0 text-on-secondary-container">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">cleaning_services</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h4 class="font-title-md text-body-md text-on-surface font-bold truncate">Chambre 10 • Priorité Check-in 18h</h4>
              <span class="font-label-md text-[11px] text-secondary font-bold">14:15</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5 line-clamp-2">
              Ménage &amp; dressage pour l'arrivée de Mlle Diagne. Équipe Aminata affectée.
            </p>
            <div class="flex items-center gap-2 mt-2">
              <button type="button" class="bg-surface-container-high hover:bg-surface-container text-primary font-label-md text-label-md px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer">
                <span class="material-symbols-outlined text-[14px]" aria-hidden="true">done</span> Confirmer prêt
              </button>
            </div>
          </div>
        </div>

        <!-- Alerte 2: Restaurant Note en chambre -->
        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex items-start gap-3 relative overflow-hidden">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-primary"></div>
          <div class="w-9 h-9 rounded-lg bg-primary-fixed/40 flex items-center justify-center flex-shrink-0 text-primary">
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">restaurant</span>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between">
              <h4 class="font-title-md text-body-md text-on-surface font-bold truncate">Table 4 • Restaurant La Teranga</h4>
              <span class="font-label-currency text-[13px] text-primary font-bold">45 000 F</span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
              Report de note sur Folio Chambre 01 (M. Ndiaye). À valider avant clôture de service.
            </p>
            <div class="flex items-center gap-2 mt-2">
              <button type="button" class="bg-primary text-on-primary font-label-md text-label-md px-3 py-1 rounded-lg transition-colors cursor-pointer">
                Valider sur folio
              </button>
              <button type="button" class="text-on-surface-variant font-label-md text-label-md hover:text-error px-2 py-1 transition-colors cursor-pointer">
                Contester
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Vue en direct des 12 chambres -->
      <section class="flex flex-col gap-space-sm">
        <div class="flex flex-col gap-1">
          <div class="flex items-center justify-between">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">État des 12 Chambres</h3>
            <span class="font-label-md text-label-md text-primary font-semibold">12 / 12 actives</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Vue en direct de la résidence bord de mer</p>
        </div>

        <!-- Légende interactive des pastilles -->
        <div class="flex items-center justify-between bg-surface-container-lowest px-space-sm py-2 rounded-xl text-[11px] font-body-sm overflow-x-auto gap-2">
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>
            <span class="text-on-surface-variant font-medium">Libre (2)</span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm"></span>
            <span class="text-on-surface-variant font-medium">Occupée (8)</span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm"></span>
            <span class="text-on-surface-variant font-medium">Ménage (1)</span>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-slate-500 shadow-sm"></span>
            <span class="text-on-surface-variant font-medium">Maint. (1)</span>
          </div>
        </div>

        <!-- Grille des 12 Chambres -->
        <div class="grid grid-cols-2 gap-space-sm" id="roomsMatrix">
          @for (room of rooms; track room.number) {
            <div
              (click)="toggleRoomSelection(room.number)"
              [class.ring-2]="selectedRooms().has(room.number)"
              [class.ring-primary]="selectedRooms().has(room.number)"
              class="bg-surface-container-lowest p-space-sm rounded-xl shadow-[0_2px_8px_rgba(10,37,64,0.04)] flex flex-col justify-between relative cursor-pointer active:bg-surface-container-low transition-colors"
            >
              <div class="flex items-start justify-between">
                <div class="flex flex-col">
                  <span class="font-headline-sm text-[17px] text-on-surface font-semibold">{{ room.number }}</span>
                  <span class="font-label-md text-[11px] truncate max-w-[80px]" [class]="room.nameColorClass">{{ room.name }}</span>
                </div>
                @switch (room.status) {
                  @case ('Occupée') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Occupée
                    </span>
                  }
                  @case ('Libre') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Libre
                    </span>
                  }
                  @case ('Ménage') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[10px] font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span> Ménage
                    </span>
                  }
                  @case ('Maint.') {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                      <span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Maint.
                    </span>
                  }
                }
              </div>

              @switch (room.footerType) {
                @case ('guest') {
                  <div class="mt-3 pt-2 bg-surface-container-low/60 -mx-space-sm -mb-space-sm px-space-sm py-1.5 rounded-b-xl flex items-center justify-between">
                    <span class="font-body-sm text-[12px] font-semibold text-on-surface truncate">{{ room.footerText }}</span>
                    <span class="material-symbols-outlined text-[15px] text-on-surface-variant">{{ room.footerIcon }}</span>
                  </div>
                }
                @case ('ready-gold') {
                  <div class="mt-3 pt-2 bg-emerald-50/70 -mx-space-sm -mb-space-sm px-space-sm py-1.5 rounded-b-xl flex items-center justify-between">
                    <span class="font-body-sm text-[11px] font-bold text-secondary truncate">{{ room.footerText }}</span>
                    <span class="material-symbols-outlined text-[15px] text-secondary">{{ room.footerIcon }}</span>
                  </div>
                }
                @case ('ready-teal') {
                  <div class="mt-3 pt-2 bg-emerald-50/70 -mx-space-sm -mb-space-sm px-space-sm py-1.5 rounded-b-xl flex items-center justify-between">
                    <span class="font-body-sm text-[11px] font-bold text-primary truncate">{{ room.footerText }}</span>
                    <span class="material-symbols-outlined text-[15px] text-primary">{{ room.footerIcon }}</span>
                  </div>
                }
                @case ('cleaning') {
                  <div class="mt-3 pt-2 bg-amber-50/70 -mx-space-sm -mb-space-sm px-space-sm py-1.5 rounded-b-xl flex items-center justify-between">
                    <span class="font-body-sm text-[11px] font-semibold text-amber-800 truncate">{{ room.footerText }}</span>
                    <span class="material-symbols-outlined text-[15px] text-amber-800">{{ room.footerIcon }}</span>
                  </div>
                }
                @case ('maintenance') {
                  <div class="mt-3 pt-2 bg-surface-container-high/60 -mx-space-sm -mb-space-sm px-space-sm py-1.5 rounded-b-xl flex items-center justify-between">
                    <span class="font-body-sm text-[11px] text-on-surface-variant font-medium truncate">{{ room.footerText }}</span>
                    <span class="material-symbols-outlined text-[15px] text-tertiary">{{ room.footerIcon }}</span>
                  </div>
                }
              }
            </div>
          }
        </div>
      </section>

      <!-- 5. Mouvements du jour (Arrivées attendues avec Actions Rapides) -->
      <section class="flex flex-col gap-space-sm pb-space-lg">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Arrivées du Jour</h3>
            <span class="w-6 h-6 rounded-full bg-primary text-on-primary text-label-md flex items-center justify-center font-bold">3</span>
          </div>
          <div class="flex items-center gap-1 bg-surface-container-high p-0.5 rounded-lg text-[12px] font-body-sm">
            <button type="button" class="bg-surface-container-lowest text-primary px-2.5 py-1 rounded font-semibold shadow-xs">Aujourd'hui</button>
            <button type="button" class="text-on-surface-variant px-2.5 py-1 hover:text-on-surface">Demain</button>
          </div>
        </div>

        <div class="flex flex-col gap-space-sm">
          <!-- Arrivée 1 : Babacar Sylla (VIP) -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-sm shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col gap-space-sm relative">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <div class="w-11 h-11 rounded-xl bg-secondary-fixed/50 flex flex-col items-center justify-center flex-shrink-0 text-on-secondary-container">
                  <span class="font-title-md text-title-md font-bold leading-tight">14</span>
                  <span class="text-[10px] font-bold uppercase leading-none">h 00</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <div class="flex items-center gap-2">
                    <h4 class="font-title-md text-title-md text-on-surface font-bold truncate">Babacar Sylla</h4>
                    <span class="inline-flex items-center gap-0.5 bg-amber-50 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      <span class="material-symbols-outlined text-[13px] text-amber-500 fill-1">star</span> VIP Gold
                    </span>
                  </div>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Ch. 04 Suite Baobab • 2 nuits (370 000 FCFA)
                  </p>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between bg-emerald-50/60 rounded-xl px-3 py-2 text-emerald-800 text-body-sm font-medium">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-emerald-600 text-[17px]">verified</span>
                <span>Chambre prête • Arrivée imminente</span>
              </div>
              <span class="text-[11px] font-bold bg-white text-emerald-800 px-2 py-0.5 rounded-full shadow-2xs">Clé générée</span>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                (click)="checkedInSylla.set(true)"
                [class.bg-primary]="!checkedInSylla()"
                [class.bg-emerald-600]="checkedInSylla()"
                class="hover:bg-primary-container active:scale-95 text-on-primary font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                @if (checkedInSylla()) {
                  <span class="material-symbols-outlined text-[16px]">check</span>
                  <span>Enregistré !</span>
                } @else {
                  <span class="material-symbols-outlined text-[18px]">how_to_reg</span>
                  <span>Check-in rapide</span>
                }
              </button>
              <a class="bg-surface-container-high hover:bg-surface-container active:scale-95 text-on-surface font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all text-center" href="tel:+221770000000">
                <span class="material-symbols-outlined text-[18px] text-primary">call</span>
                <span>Appeler client</span>
              </a>
            </div>
          </div>

          <!-- Arrivée 2 : Sophie Martin & Laurent -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-sm shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col gap-space-sm relative">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <div class="w-11 h-11 rounded-xl bg-surface-container-high flex flex-col items-center justify-center flex-shrink-0 text-on-surface">
                  <span class="font-title-md text-title-md font-bold leading-tight">15</span>
                  <span class="text-[10px] font-bold uppercase leading-none">h 30</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <h4 class="font-title-md text-title-md text-on-surface font-bold truncate">Sophie &amp; Laurent Martin</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Ch. 11 Vue Piscine • 4 nuits (520 000 FCFA)
                  </p>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between bg-surface-container-low rounded-xl px-3 py-2 text-on-surface text-body-sm font-medium">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-primary text-[17px]">local_taxi</span>
                <span>Transfert aéroport DSS en route (Chauffeur Moussa)</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-0.5">
              <button type="button" class="bg-primary hover:bg-primary-container active:scale-95 text-on-primary font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                <span class="material-symbols-outlined text-[18px]">badge</span>
                <span>Prép. Folio</span>
              </button>
              <button type="button" class="bg-surface-container-high hover:bg-surface-container active:scale-95 text-on-surface font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                <span class="material-symbols-outlined text-[18px] text-primary">chat</span>
                <span>SMS Teranga</span>
              </button>
            </div>
          </div>

          <!-- Arrivée 3 : Fatou Diagne -->
          <div class="bg-surface-container-lowest rounded-2xl p-space-sm shadow-[0_4px_16px_-2px_rgba(10,37,64,0.05)] flex flex-col gap-space-sm relative">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <div class="w-11 h-11 rounded-xl bg-amber-50 flex flex-col items-center justify-center flex-shrink-0 text-amber-800">
                  <span class="font-title-md text-title-md font-bold leading-tight">18</span>
                  <span class="text-[10px] font-bold uppercase leading-none">h 00</span>
                </div>
                <div class="flex flex-col min-w-0">
                  <h4 class="font-title-md text-title-md text-on-surface font-bold truncate">Fatou Diagne</h4>
                  <p class="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
                    Ch. 10 Bungalow Alizé • 1 nuit (145 000 FCFA)
                  </p>
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between bg-amber-50/70 rounded-xl px-3 py-2 text-amber-900 text-body-sm font-medium">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-amber-600 text-[17px]">hourglass_top</span>
                <span>En cours de préparation • Nettoyage à 60%</span>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-0.5">
              <button type="button" class="bg-surface-container-high hover:bg-surface-container active:scale-95 text-on-surface font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer">
                <span class="material-symbols-outlined text-[18px] text-amber-700">timer</span>
                <span>Alerter Housekeeping</span>
              </button>
              <a class="bg-surface-container-high hover:bg-surface-container active:scale-95 text-on-surface font-label-md text-label-md py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all text-center" href="tel:+221771112233">
                <span class="material-symbols-outlined text-[18px] text-primary">call</span>
                <span>Contacter</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  `
})
export class MobileDashboardComponent {
  readonly checkedInSylla = signal(false);
  readonly selectedRooms = signal<Set<string>>(new Set());

  readonly rooms: MobileRoomCard[] = [
    { number: 'Ch. 01', name: 'Suite Océan', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'M. Ndiaye', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 02', name: 'Deluxe Plage', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'Fam. Moreau', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 03', name: 'Bungalow Jardin', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'M. Sow', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 04', name: 'Suite Baobab', nameColorClass: 'text-primary', status: 'Libre', footerText: 'Prête • 14h00', footerType: 'ready-gold', footerIcon: 'star' },
    { number: 'Ch. 05', name: 'Deluxe Plage', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'Dr. Faye', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 06', name: 'Bungalow Dune', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'Mme Dubois', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 07', name: 'Suite Saloum', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'M. Touré', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 08', name: 'Bungalow Alizé', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'M. Leroy', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 09', name: 'Deluxe Balcon', nameColorClass: 'text-primary', status: 'Occupée', footerText: 'Mme Cissé', footerType: 'guest', footerIcon: 'chevron_right' },
    { number: 'Ch. 10', name: 'Bungalow Alizé', nameColorClass: 'text-primary', status: 'Ménage', footerText: 'Équipe Aminata', footerType: 'cleaning', footerIcon: 'mop' },
    { number: 'Ch. 11', name: 'Vue Piscine', nameColorClass: 'text-primary', status: 'Libre', footerText: 'Prête • 15h30', footerType: 'ready-teal', footerIcon: 'directions_car' },
    { number: 'Ch. 12', name: 'Suite Filaos', nameColorClass: 'text-tertiary', status: 'Maint.', footerText: 'Révision clim', footerType: 'maintenance', footerIcon: 'ac_unit' }
  ];

  toggleRoomSelection(roomNumber: string): void {
    const next = new Set(this.selectedRooms());
    if (next.has(roomNumber)) {
      next.delete(roomNumber);
    } else {
      next.add(roomNumber);
    }
    this.selectedRooms.set(next);
  }
}
