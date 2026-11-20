import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { passwordChecks, passwordStrength, passwordValid } from '@/lib/validation/password';
import { passwordSchema, changePasswordSchema } from '@/lib/validation/auth';
import { IDLE_MS, MAX_SESSION_MS, asSessionCookie, sessionVerdict } from '@/lib/session-policy';

describe('Mot de passe — règles affichées en direct', () => {
  it('les mêmes règles que le serveur', () => {
    for (const pw of ['', 'abc', 'abcdefgh', '12345678', 'abcdefg1', 'Motdepasse2026', 'a1b2c3d4']) {
      expect(passwordValid(pw)).toBe(passwordSchema.safeParse(pw).success);
    }
    expect(passwordChecks('abc1')).toEqual({ length: false, letter: true, digit: true });
  });

  it('robustesse croissante', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefg1')).toBe(2);
    expect(passwordStrength('abcdefghijk1')).toBe(3);
    expect(passwordStrength('Abcdefghijk1!')).toBe(4);
  });

  it('changement : actuel exigé, nouveau différent, confirmation identique', () => {
    const ok = { current_password: 'Ancien2025', password: 'Nouveau2026', password_confirm: 'Nouveau2026' };
    expect(changePasswordSchema.safeParse(ok).success).toBe(true);
    expect(changePasswordSchema.safeParse({ ...ok, current_password: '' }).success).toBe(false);
    const same = changePasswordSchema.safeParse({ ...ok, password: 'Ancien2025', password_confirm: 'Ancien2025' });
    expect(same.error?.issues.map((i) => i.message)).toContain('validation.passwordSameAsOld');
    const mismatch = changePasswordSchema.safeParse({ ...ok, password_confirm: 'Autre2026' });
    expect(mismatch.error?.issues[0].path).toEqual(['password_confirm']);
  });
});

describe('Session — inactivité et durée maximale', () => {
  const now = Date.parse('2026-11-20T12:00:00Z');
  it('30 min sans activité → déconnexion', () => {
    expect(sessionVerdict(now, String(now - IDLE_MS + 1000), String(now - 3600_000))).toBe('ok');
    expect(sessionVerdict(now, String(now - IDLE_MS - 1000), String(now - 3600_000))).toBe('inactivite');
  });
  it('7 jours au plus, même avec de l’activité', () => {
    expect(sessionVerdict(now, String(now), String(now - MAX_SESSION_MS - 1000))).toBe('expiree');
  });
  it('session antérieure à la règle (pas d’horodatage) : pas de déconnexion', () => {
    expect(sessionVerdict(now, undefined, undefined)).toBe('ok');
    expect(sessionVerdict(now, 'n’importe quoi', '')).toBe('ok');
  });
  it('« Rester connecté » décoché : cookies sans durée, suppression intacte', () => {
    expect(asSessionCookie({ path: '/', maxAge: 3600, httpOnly: true })).toEqual({ path: '/', httpOnly: true });
    expect(asSessionCookie({ path: '/', maxAge: 0 })).toEqual({ path: '/', maxAge: 0 });
  });
});

/**
 * Garde-fou : React 19 vide un `<form action={fonction}>` après chaque envoi,
 * même en cas d'erreur (saisie perdue). Les formulaires avec des champs
 * doivent passer par `onSubmit` (useFormSubmit). Seuls des formulaires SANS
 * saisie (un simple bouton) peuvent garder `action=`.
 */
describe('Formulaires — la saisie n’est jamais effacée en cas d’erreur', () => {
  const ALLOWED = new Set(['src/app/(app)/notifications/page.tsx', 'src/components/layout/app-shell.tsx']);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) files.push(p);
    }
  };
  walk(path.resolve(__dirname, '../../src'));

  it('aucun formulaire de saisie n’utilise <form action={…}>', () => {
    const offenders = files
      .map((f) => path.relative(path.resolve(__dirname, '../..'), f).replace(/\\/g, '/'))
      .filter((rel) => !ALLOWED.has(rel))
      .filter((rel) => {
        const src = readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');
        // Un formulaire GET vers une adresse (filtres) n'est pas concerné.
        return [...src.matchAll(/<(?:form|Box component="form")[^>]*\baction=\{[^>]*>/g)].some((m) => !/method="get"/.test(m[0]));
      });
    expect(offenders).toEqual([]);
  });
});
