import { DashboardMockService } from './dashboard-mock.service';
import { ThemeService } from './theme.service';
import { SidebarComponent } from '../../shared/components/sidebar/sidebar.component';
import { LayoutComponent } from '../../shared/components/layout/layout.component';
import { MobileDashboardComponent } from '../../features/dashboard/components/mobile-dashboard/mobile-dashboard.component';

describe('DashboardMockService', () => {
  let service: DashboardMockService;

  beforeEach(() => {
    service = new DashboardMockService();
  });

  it('doit retourner exactement les données de la maquette tableau_de_bord avec montants entiers en FCFA', done => {
    const data = service.data();

    expect(data.user.name).toBe('Aïssatou Ba');
    expect(data.user.role).toBe('Directrice Générale');
    expect(data.hero.title).toBe('Bienvenue à la Résidence Blue');
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

    service.getDashboardData().subscribe(obsData => {
      expect(obsData).toEqual(data);
      done();
    });
  });
});

describe('ThemeService', () => {
  it('doit être strictement verrouillé en mode clair sans mode sombre', () => {
    const themeService = new ThemeService();
    expect(themeService.theme()).toBe('light');
    expect(themeService.isDark()).toBe(false);
  });
});

describe('SidebarComponent & LayoutComponent', () => {
  it('doit exposer les 10 routes de navigation dans SidebarComponent', () => {
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
