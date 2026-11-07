import { assertFcfaInteger, formatFcfa, parseFcfa } from '../currency';

describe('Devise FCFA - Règle Entiers Stricts', () => {
  it('doit accepter les montants entiers positifs', () => {
    expect(() => assertFcfaInteger(40000)).not.toThrow();
    expect(() => assertFcfaInteger(0)).not.toThrow();
    expect(() => assertFcfaInteger(110000)).not.toThrow();
  });

  it('doit rejeter catégoriquement les nombres décimaux', () => {
    expect(() => assertFcfaInteger(40000.5)).toThrow(/doit obligatoirement être un entier/);
    expect(() => assertFcfaInteger(12.99)).toThrow(/doit obligatoirement être un entier/);
    expect(() => assertFcfaInteger(0.01)).toThrow(/doit obligatoirement être un entier/);
  });

  it('doit rejeter les montants négatifs par défaut', () => {
    expect(() => assertFcfaInteger(-500)).toThrow(/ne peut pas être négatif/);
  });

  it('doit autoriser les montants négatifs entiers si allowNegative=true', () => {
    expect(() => assertFcfaInteger(-500, true)).not.toThrow();
  });

  it('doit formater correctement en FCFA avec séparateurs', () => {
    const formatted = formatFcfa(65000);
    // Peut contenir un espace insécable ou normal selon la locale fr-FR
    expect(formatted).toMatch(/65[\s\u202f\u00a0]000 FCFA/);
  });

  it('doit parser correctement une chaîne avec FCFA', () => {
    expect(parseFcfa('45 000 FCFA')).toBe(45000);
    expect(parseFcfa('110000')).toBe(110000);
    expect(() => parseFcfa('45 000.50 FCFA')).toThrow();
  });
});
