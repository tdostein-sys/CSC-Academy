import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/lib/phone';
import { safeNextPath, isProtectedPath } from '@/lib/routes';
import { isEmailIdentifier, loginSchema, newPasswordSchema, registerSchema } from '@/lib/validation/auth';
import { fromZodError } from '@/lib/forms';

describe('normalizePhone', () => {
  it.each([
    ['690000000', '+237690000000'],
    ['6 90 00 00 00', '+237690000000'],
    ['237690000000', '+237690000000'],
    ['00237690000000', '+237690000000'],
    ['+237 6-90-00-00-00', '+237690000000'],
    ['222000000', '+237222000000'],
    ['+33612345678', '+33612345678'],
  ])('%s → %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['', 'abc', '12345', '+237590000000', '+2376900000', '0690000000'])('rejette %s', (input) => {
    expect(normalizePhone(input)).toBeNull();
  });
});

describe('safeNextPath (anti redirection ouverte)', () => {
  it('accepte un chemin interne', () => expect(safeNextPath('/admin/users?x=1')).toBe('/admin/users?x=1'));
  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', undefined, 42])('refuse %s', (v) => {
    expect(safeNextPath(v)).toBe('/dashboard');
  });
});

describe('routes protégées', () => {
  it('protège les espaces privés, pas les pages publiques', () => {
    expect(isProtectedPath('/admin')).toBe(true);
    expect(isProtectedPath('/admin/users')).toBe(true);
    expect(isProtectedPath('/dashboard')).toBe(true);
    expect(isProtectedPath('/academy')).toBe(false);
    expect(isProtectedPath('/')).toBe(false);
    expect(isProtectedPath('/administrator-fake')).toBe(false);
  });
});

describe('schémas de formulaires', () => {
  const valid = {
    first_name: 'Stein',
    last_name: 'Djoumessi',
    email: '  Test@Example.COM ',
    phone_whatsapp: '690 00 00 00',
    password: 'motdepasse1',
    password_confirm: 'motdepasse1',
    accept_terms: 'on',
  };

  it('inscription valide : e-mail normalisé, téléphone au format international', () => {
    const r = registerSchema.parse(valid);
    expect(r.email).toBe('test@example.com');
    expect(r.phone_whatsapp).toBe('+237690000000');
  });

  it('inscription : erreurs traduisibles par champ', () => {
    const r = registerSchema.safeParse({ ...valid, password: 'court', password_confirm: 'autre', phone_whatsapp: '12', accept_terms: undefined });
    expect(r.success).toBe(false);
    const state = fromZodError(r.error!);
    expect(state.fieldErrors?.password).toBe('validation.passwordTooShort');
    expect(state.fieldErrors?.phone_whatsapp).toBe('validation.phoneInvalid');
    expect(state.fieldErrors?.accept_terms).toBe('validation.acceptTerms');
  });

  it('mot de passe : lettre ET chiffre obligatoires', () => {
    expect(newPasswordSchema.safeParse({ password: 'abcdefgh', password_confirm: 'abcdefgh' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: '12345678', password_confirm: '12345678' }).success).toBe(false);
    expect(newPasswordSchema.safeParse({ password: 'abcd1234', password_confirm: 'abcd1234' }).success).toBe(true);
    const mismatch = newPasswordSchema.safeParse({ password: 'abcd1234', password_confirm: 'abcd12345' });
    expect(fromZodError(mismatch.error!).fieldErrors?.password_confirm).toBe('validation.passwordMismatch');
  });

  it('connexion par e-mail ou par nom d’utilisateur', () => {
    expect(loginSchema.safeParse({ identifier: 'csc_admin', password: 'x' }).success).toBe(true);
    expect(isEmailIdentifier('csc_admin')).toBe(false);
    expect(isEmailIdentifier('a@b.cm')).toBe(true);
  });
});
