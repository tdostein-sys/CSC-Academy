import { describe, expect, it } from 'vitest';
import { CONTACT_STATUSES, CONTACT_SUBJECTS, contactErrorKey, contactSchema, contactSettingsSchema, whatsappLink } from '@/lib/contact';
import { renderNotification } from '@/lib/notifications/templates';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

const valid = { name: 'Awa Ndiaye', email: 'Awa@Test.Local', phone: '690 00 00 00', subject: 'payment', message: 'Bonjour, je veux payer ma tranche.' };

describe('formulaire de contact', () => {
  it('accepte un message correct et normalise e-mail et téléphone', () => {
    const r = contactSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.email).toBe('awa@test.local');
    expect(r.data.phone).toBe('+237690000000');
    expect(r.data.enrollment_id).toBeNull();
  });

  it('téléphone facultatif', () => {
    const r = contactSchema.safeParse({ ...valid, phone: '' });
    expect(r.success && r.data.phone).toBe('');
  });

  it.each([
    ['name', { name: 'A' }, 'validation.nameTooShort'],
    ['email', { email: 'pas-un-email' }, 'validation.emailInvalid'],
    ['phone', { phone: '123' }, 'validation.phoneInvalid'],
    ['subject', { subject: 'spam' }, 'validation.required'],
    ['message', { message: 'court' }, 'contact.validation.messageTooShort'],
    ['message', { message: 'x'.repeat(2001) }, 'validation.tooLong'],
  ])('refuse un champ %s invalide', (field, over, key) => {
    const r = contactSchema.safeParse({ ...valid, ...over });
    expect(r.success).toBe(false);
    if (r.success) return;
    const issue = r.error.issues.find((i) => i.path[0] === field);
    expect(issue?.message).toBe(key);
  });

  it('identifiant d’inscription ignoré s’il n’a pas le bon format', () => {
    const ok = contactSchema.safeParse({ ...valid, enrollment_id: '0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b' });
    const bad = contactSchema.safeParse({ ...valid, enrollment_id: "1' or 1=1" });
    expect(ok.success && ok.data.enrollment_id).toBe('0f1e2d3c-4b5a-6978-8a9b-0c1d2e3f4a5b');
    expect(bad.success && bad.data.enrollment_id).toBeNull();
  });

  it('erreurs de la base traduites sans détail technique', () => {
    expect(contactErrorKey({ message: 'contact_rate_limited' })).toBe('contact.errors.rateLimited');
    expect(contactErrorKey({ message: 'contact_invalid' })).toBe('errors.checkForm');
    expect(contactErrorKey({ message: 'relation "x" does not exist' })).toBe('errors.generic');
  });
});

describe('coordonnées et lien WhatsApp', () => {
  it('coordonnées : champs vides autorisés, formats contrôlés', () => {
    expect(contactSettingsSchema.safeParse({ whatsapp: '', phone: '', email: '' }).success).toBe(true);
    const r = contactSettingsSchema.safeParse({ whatsapp: '690000000', phone: '', email: 'Contact@CSC.cm' });
    expect(r.success && r.data).toEqual({ whatsapp: '+237690000000', phone: '', email: 'contact@csc.cm' });
    expect(contactSettingsSchema.safeParse({ whatsapp: '12', phone: '', email: '' }).success).toBe(false);
    expect(contactSettingsSchema.safeParse({ whatsapp: '', phone: '', email: 'pas-un-email' }).success).toBe(false);
  });

  it('lien wa.me avec message déjà écrit (encodé)', () => {
    expect(whatsappLink('+237690000000')).toBe('https://wa.me/237690000000');
    expect(whatsappLink('+237690000000', 'Bonjour CSC, « Trading » & paiement ?')).toBe(
      `https://wa.me/237690000000?text=${encodeURIComponent('Bonjour CSC, « Trading » & paiement ?')}`,
    );
    expect(whatsappLink('')).toBeNull();
    expect(whatsappLink(null)).toBeNull();
    expect(whatsappLink('123')).toBeNull();
  });
});

describe('notification aux administrateurs', () => {
  it('sujet traduit et extrait du message', () => {
    const p = { name: 'Awa', subject: 'payment' as const, excerpt: 'Je veux payer.', course: 'Trading (Session 1)' };
    const f = renderNotification('contact.new_request', 'fr', p);
    const e = renderNotification('contact.new_request', 'en', p);
    expect(f.title).toContain('Paiement');
    expect(f.body).toContain('Je veux payer.');
    expect(f.body).toContain('Trading (Session 1)');
    expect(e.title).toContain('Payment');
  });
});

describe('traductions de la page Contact', () => {
  type Tree = Record<string, unknown>;
  const get = (tree: Tree, key: string) => key.split('.').reduce<unknown>((n, p) => (n as Tree | undefined)?.[p], tree);
  const keys = [
    'nav.contact',
    'admin.nav.contact',
    'admin.content.keys.contact_page',
    'contact.sent',
    'contact.errors.rateLimited',
    'contact.whatsappPayment',
    'student.payWhatsapp',
    'student.payContact',
    ...CONTACT_SUBJECTS.flatMap((s) => [`contact.subjects.${s}`, `adminContact.subjects.${s}`]),
    ...CONTACT_STATUSES.map((s) => `adminContact.status.${s}`),
  ];
  it.each(keys)('%s existe en français et en anglais', (key) => {
    expect(typeof get(fr as Tree, key)).toBe('string');
    expect(typeof get(en as Tree, key)).toBe('string');
  });
});
