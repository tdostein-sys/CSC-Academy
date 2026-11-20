import { describe, expect, it } from 'vitest';
import { activeNavKey, navSections } from '@/lib/navigation';
import { cameFromCatalogue, studentBreadcrumbs } from '@/lib/academy/origin';
import { distinctFrom } from '@/lib/text';

describe('Menu — source unique', () => {
  it('membre : 7 entrées en 3 groupes, sans doublon ni « Contact »', () => {
    const s = navSections({ isAdmin: false });
    expect(s.map((x) => x.key)).toEqual(['main', 'activities', 'account']);
    const keys = s.flatMap((x) => x.items.map((i) => i.key));
    expect(keys).toEqual(['overview', 'academy', 'ambassador', 'consulting', 'ga', 'notifications', 'profile']);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('administrateur : groupe Administration en plus ; visiteur : accueil, activités, contact', () => {
    expect(navSections({ isAdmin: true }).at(-1)?.key).toBe('admin');
    const visitor = navSections(null).flatMap((x) => x.items.map((i) => i.key));
    expect(visitor).toEqual(['home', 'academy', 'ambassador', 'consulting', 'ga', 'contact']);
  });

  it('l’entrée du module reste active sur toutes ses sous-pages', () => {
    const s = navSections({ isAdmin: true });
    expect(activeNavKey('/academy', s)).toBe('academy');
    expect(activeNavKey('/academy/3f1c2a4e-1b2c-4d5e-8f90-112233445566', s)).toBe('academy');
    expect(activeNavKey('/student/abc', s)).toBe('academy');
    expect(activeNavKey('/consulting/bookings/abc/live', s)).toBe('consulting');
    expect(activeNavKey('/ambassador/campaigns/x', s)).toBe('ambassador');
    expect(activeNavKey('/admin', s)).toBe('admin');
    expect(activeNavKey('/admin/academy/courses', s)).toBe('admin-academy');
    expect(activeNavKey('/auth/change-password', s)).toBe('profile');
  });
});

describe('Retour cohérent avec l’origine (/student/[id])', () => {
  const course = '3f1c2a4e-1b2c-4d5e-8f90-112233445566';
  const labels = { academy: 'Academy', catalogue: 'Catalogue', myCourses: 'Mes formations', mySpace: 'Mon espace formation' };

  it('venu du catalogue : retour vers la fiche de la formation', () => {
    expect(cameFromCatalogue({ from: 'catalogue', course }, course)).toBe(true);
    const crumbs = studentBreadcrumbs({ fromCatalogue: true, courseId: course, courseTitle: 'Binance', labels });
    expect(crumbs.map((c) => c.href)).toEqual(['/academy', '/academy', `/academy/${course}`, undefined]);
  });

  it('origine invalide ou absente : « Mes formations » (aucune adresse arbitraire)', () => {
    expect(cameFromCatalogue({}, course)).toBe(false);
    expect(cameFromCatalogue({ from: 'https://evil.example', course }, course)).toBe(false);
    expect(cameFromCatalogue({ from: 'catalogue', course: '//evil.example' }, course)).toBe(false);
    expect(cameFromCatalogue({ from: 'catalogue', course: '00000000-0000-4000-8000-000000000000' }, course)).toBe(false);
    const crumbs = studentBreadcrumbs({ fromCatalogue: false, courseId: course, courseTitle: 'Binance', labels });
    expect(crumbs.map((c) => c.href)).toEqual(['/academy', '/student', undefined]);
  });
});

describe('Textes répétés', () => {
  it('une description identique au titre n’est pas répétée', () => {
    expect(distinctFrom('Organisation Master class Binance.', 'Organisation master class binance')).toBe('');
    expect(distinctFrom('Déclarez vos comptes Binance.', 'Master class')).toBe('Déclarez vos comptes Binance.');
    expect(distinctFrom('', 'x')).toBe('');
  });
});
