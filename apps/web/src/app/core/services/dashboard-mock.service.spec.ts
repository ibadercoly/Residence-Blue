import { DashboardMockService } from './dashboard-mock.service';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { MobileDashboardComponent } from '../../features/dashboard/components/mobile-dashboard/mobile-dashboard.component';

describe('DashboardMockService', () => {
  let service: DashboardMockService;

  beforeEach(() => {
    service = new DashboardMockService();
  });

  it('doit retourner les données adaptées à Thiès avec montants entiers en FCFA', done => {
    const data = service.data();

    expect(data.user.name).toBe('Aïssatou Ba');
    expect(data.user.role).toBe('Directrice Générale');
    expect(data.hero.title).toBe('Bienvenue à la Résidence Blue');
    expect(data.hero.weatherTag).toContain('Thiès');
    expect(data.hero.subtitle).toContain('Grand Standing, Thiès');
    expect(data.hero.subtitle).not.toContain('Petite Côte');
    expect(data.kpis.occupancyRate.value).toBe(75);
    expect(data.kpis.occupiedRooms.occupied).toBe(9);
    expect(data.kpis.occupiedRooms.total).toBe(12);

    // Montants FCFA strictement entiers
    expect(Number.isInteger(data.kpis.todayRevenue.amount)).toBe(true);
    expect(data.kpis.todayRevenue.amount).toBe(485000);
    expect(Number.isInteger(data.kpis.todayRevenue.lodgingAmount)).toBe(true);
    expect(data.kpis.todayRevenue.lodgingAmount).toBe(395000);
    expect(Number.isInteger(data.kpis.todayRevenue.restaurantAmount)).toBe(true);
    expect(data.kpis.todayRevenue.restaurantAmount).toBe(90000);
    expect(Number.isInteger(data.weeklyRevenue.totalEstimated)).toBe(true);
    expect(data.weeklyRevenue.totalEstimated).toBe(3465000);

    expect(data.weeklyRevenue.days).toHaveLength(7);
    expect(data.arrivals).toHaveLength(2);
    expect(data.priorityAlerts).toHaveLength(3);

    // Météo continentale Thiès
    expect(data.thiesWeather.title).toBe('Climat & Espaces Extérieurs');
    expect(data.thiesWeather.locationBadge).toBe('Grand Standing');
    expect(data.thiesWeather.temperature).toContain('29°C');

    // Absence stricte des termes côtiers/maritimes dans la météo et la bannière
    const serialized = JSON.stringify({
      hero: data.hero,
      thiesWeather: data.thiesWeather
    });
    expect(serialized).not.toContain('Petite Côte');
    expect(serialized).not.toContain('Marée haute');
    expect(serialized).not.toContain('Eau de mer');
    expect(serialized).not.toContain('Brise côtière');
    expect(serialized).not.toContain('Plage Privée');

    service.getDashboardData().subscribe(obsData => {
      expect(obsData).toEqual(data);
      done();
    });
  });
});

describe('SidebarComponent & LayoutComponent', () => {
  it('doit exposer les 10 routes de navigation dans SidebarComponent avec ancrage Thiès', () => {
    const sidebar = new SidebarComponent();
    expect(sidebar.navItems).toHaveLength(10);
    expect(sidebar.navItems[0]).toEqual({
      path: '/tableau-de-bord',
      label: 'Tableau de bord',
      icon: 'dashboard'
    });
    expect(sidebar.navItems[9]).toEqual({
      path: '/parametres',
      label: 'Paramètres',
      icon: 'settings'
    });
  });

  it('doit exposer les 5 onglets de navigation mobile dans LayoutComponent', () => {
    const layout = new LayoutComponent();
    expect(layout.mobileNavItems).toHaveLength(5);
    expect(layout.mobileNavItems.map(i => i.label)).toEqual([
      'Bord',
      'Planning',
      'Chambres',
      'Résas',
      'Plus'
    ]);
  });
});

describe('MobileDashboardComponent', () => {
  it('doit lister les 12 chambres et gérer la sélection ainsi que le check-in rapide', () => {
    const mobile = new MobileDashboardComponent();
    expect(mobile.rooms).toHaveLength(12);
    expect(mobile.checkedInSylla()).toBe(false);

    mobile.toggleRoomSelection('Ch. 01');
    expect(mobile.selectedRooms().has('Ch. 01')).toBe(true);

    mobile.toggleRoomSelection('Ch. 01');
    expect(mobile.selectedRooms().has('Ch. 01')).toBe(false);

    mobile.checkedInSylla.set(true);
    expect(mobile.checkedInSylla()).toBe(true);
  });
});
