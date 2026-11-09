import { GuestProfileService } from './guest-profile.service';

describe('GuestProfileService', () => {
  let service: GuestProfileService;

  beforeEach(() => {
    service = new GuestProfileService();
  });

  it('devrait retourner le profil complet de M. Mamadou Diop', (done) => {
    service.getGuestProfile('c1').subscribe((profile) => {
      expect(profile).toBeDefined();
      expect(profile.fullName).toBe('M. Mamadou Diop');
      expect(profile.vipTier).toBe('VIP Gold');
      expect(profile.loyaltyStayCount).toBe(4);
      expect(profile.totalSpentFcfa).toBe(3850000);
      expect(profile.stays.length).toBe(4);
      expect(profile.preferences.length).toBe(3);
      expect(profile.folios.length).toBe(4);
      expect(profile.notes.length).toBe(2);
      done();
    });
  });

  it('devrait convertir les montants FCFA en Euros avec le taux fixe officiel (655.957)', () => {
    // 3 850 000 / 655.957 = 5869.29...
    const approxEuro = service.convertFcfaToEuro(3850000, true);
    expect(approxEuro).toBe(5870);

    const exactEuro = service.convertFcfaToEuro(3850000, false);
    expect(exactEuro).toBe(5869);
  });

  it('devrait restreindre l affichage du passeport aux rôles autorisés (DIRECTRICE, RECEPTIONNISTE)', () => {
    expect(service.canRevealPassport('DIRECTRICE')).toBe(true);
    expect(service.canRevealPassport('RECEPTIONNISTE')).toBe(true);
    expect(service.canRevealPassport('ADMIN')).toBe(true);
    expect(service.canRevealPassport('GOUVERNANTE')).toBe(false);
    expect(service.canRevealPassport('SERVEUR')).toBe(false);
    expect(service.canRevealPassport('MAINTENANCE')).toBe(false);
  });

  it('devrait permettre d ajouter une nouvelle note d équipe', (done) => {
    service.addNote('Client demande un départ tardif à 14h', 'Aïssatou Ba', 'Direction');

    service.getGuestProfile('c1').subscribe((profile) => {
      expect(profile.notes.length).toBe(3);
      expect(profile.notes[0].content).toBe('Client demande un départ tardif à 14h');
      expect(profile.notes[0].department).toBe('Direction');
      done();
    });
  });
});
