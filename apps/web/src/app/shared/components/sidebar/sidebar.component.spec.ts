import { signal } from '@angular/core';
import { SidebarComponent } from './sidebar.component';
import { ModuleConfigService } from '../../../core/services/module-config.service';
import { Role } from '@residence-blue/shared';

describe('SidebarComponent - Navigation et Menu Paramètres', () => {
  function createMockAuthService(role: Role | null, isDirector: boolean) {
    const userSig = signal<any>(
      role
        ? {
            id: 'test-user-id',
            email: 'directeur@residenceblue.sn',
            fullName: 'Aïssatou Ba',
            role,
            isPrimaryAdmin: isDirector,
            screenAccess: {
              accueil: 'ECRITURE',
              planning: 'ECRITURE',
              chambres: 'ECRITURE',
              clients: 'ECRITURE',
              facturation: 'ECRITURE',
              rapports: 'ECRITURE',
              restaurant: 'ECRITURE',
              cuisine: 'AUCUN',
            },
          }
        : null,
    );

    return {
      currentUser: userSig,
      currentRole: signal(role),
      isDirector: () => isDirector,
      hasScreen: (screen: string) => screen !== 'cuisine',
      logout: jest.fn(),
    } as any;
  }

  it('affiche le menu "Paramètres" pour un utilisateur ayant le rôle DIRECTION', () => {
    const mockAuth = createMockAuthService(Role.DIRECTION, true);
    const moduleConfig = new ModuleConfigService(mockAuth);
    const sidebar = new SidebarComponent(undefined, mockAuth, moduleConfig);

    const items = sidebar.activeMenuItems();
    const parametresItem = items.find((i) => i.id === 'parametres' || i.route === '/parametres');

    expect(parametresItem).toBeDefined();
    expect(parametresItem?.label).toBe('Paramètres');
    expect(parametresItem?.route).toBe('/parametres');
    expect(parametresItem?.icon).toBe('settings');

    const adminItem = items.find((i) => i.id === 'administration' || i.route === '/administration');
    expect(adminItem).toBeDefined();
  });

  it('ne propose PAS le menu "Paramètres" pour un utilisateur RECEPTION', () => {
    const mockAuth = createMockAuthService(Role.RECEPTION, false);
    const moduleConfig = new ModuleConfigService(mockAuth);
    const sidebar = new SidebarComponent(undefined, mockAuth, moduleConfig);

    const items = sidebar.activeMenuItems();
    const parametresItem = items.find((i) => i.id === 'parametres' || i.route === '/parametres');
    const adminItem = items.find((i) => i.id === 'administration' || i.route === '/administration');

    expect(parametresItem).toBeUndefined();
    expect(adminItem).toBeUndefined();
  });

  it('retourne une liste vide si aucun utilisateur n’est connecté', () => {
    const mockAuth = createMockAuthService(null, false);
    const moduleConfig = new ModuleConfigService(mockAuth);
    const sidebar = new SidebarComponent(undefined, mockAuth, moduleConfig);

    expect(sidebar.activeMenuItems()).toEqual([]);
  });
});
