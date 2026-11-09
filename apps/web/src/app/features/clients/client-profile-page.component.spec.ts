import { ClientProfilePageComponent } from './client-profile-page.component';
import { GuestProfileService } from '../../core/services/guest-profile.service';
import { ReservationModalService } from '../../core/services/reservation-modal.service';

describe('ClientProfilePageComponent', () => {
  let component: ClientProfilePageComponent;
  let guestService: GuestProfileService;
  let modalService: ReservationModalService;

  beforeEach(() => {
    guestService = new GuestProfileService();
    modalService = new ReservationModalService();
    const routeMock = {
      snapshot: {
        paramMap: {
          get: (key: string) => (key === 'id' ? 'c1' : null)
        }
      }
    } as any;

    component = new ClientProfilePageComponent(guestService, routeMock, modalService);
    component.ngOnInit();
  });

  it('devrait être initialisé correctement avec le profil par défaut', () => {
    expect(component).toBeTruthy();
    expect(component.profile().fullName).toBe('M. Mamadou Diop');
    expect(component.activeTab()).toBe('historique');
  });

  it('devrait afficher le numéro de passeport masqué par défaut', () => {
    expect(component.isPassportRevealed()).toBe(false);
    expect(component.maskedPassport()).toBe('SN••••••1-B');
  });

  it('devrait basculer l\'affichage du passeport pour un utilisateur autorisé', () => {
    // Par défaut le rôle de l'utilisateur connecté est DIRECTRICE
    component.togglePassportVisibility();
    expect(component.isPassportRevealed()).toBe(true);

    component.togglePassportVisibility();
    expect(component.isPassportRevealed()).toBe(false);
  });

  it('ne devrait pas afficher le passeport si l\'utilisateur n\'a pas les droits', () => {
    component.currentUserRole.set('SERVEUR');

    component.togglePassportVisibility();
    expect(component.isPassportRevealed()).toBe(false);
    expect(component.toastMessage()).toContain('Accès restreint');
  });

  it('devrait changer d\'onglet lors de la sélection', () => {
    expect(component.activeTab()).toBe('historique');

    component.setTab('preferences');
    expect(component.activeTab()).toBe('preferences');

    component.setTab('factures');
    expect(component.activeTab()).toBe('factures');

    component.setTab('notes');
    expect(component.activeTab()).toBe('notes');
  });

  it('devrait formater l\'équivalent en euros avec le taux fixe', () => {
    // 3 850 000 FCFA / 655.957 ≈ 5 870 €
    expect(component.euroEquivalentFormatted()).toBe('5\u202f870');
  });

  it('devrait ajouter une note interne et réinitialiser le champ', () => {
    const initialNotesCount = component.profile().notes.length;
    component.newNoteContent = 'Prévoir une bouteille d\'eau gazéifiée en chambre.';

    component.saveNewNote();

    expect(component.profile().notes.length).toBe(initialNotesCount + 1);
    expect(component.profile().notes[0].content).toBe('Prévoir une bouteille d\'eau gazéifiée en chambre.');
    expect(component.newNoteContent).toBe('');
    expect(component.toastMessage()).toContain('Consigne enregistrée');
  });

  it('ne devrait pas ajouter une note vide', () => {
    const initialNotesCount = component.profile().notes.length;
    component.newNoteContent = '   ';

    component.saveNewNote();

    expect(component.profile().notes.length).toBe(initialNotesCount);
  });

  it('devrait ouvrir la modale de réservation lors de l\'action dédiée', () => {
    const openSpy = jest.spyOn(modalService, 'open');
    component.openNewReservationModal();
    expect(openSpy).toHaveBeenCalled();
  });

  it('devrait afficher un toast informatif pour les boutons de contact inactifs', () => {
    component.handleInactiveContact('WhatsApp');
    expect(component.toastMessage()).toContain('Bouton WhatsApp inactif');
    expect(component.contactMenuOpen()).toBe(false);
  });
});
