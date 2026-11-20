/**
 * Règles du mot de passe, affichées en direct pendant la saisie. Ce sont les
 * MÊMES règles que `passwordSchema` (validation/auth.ts), vérifiée par le
 * serveur : 8 caractères minimum, au moins une lettre et un chiffre.
 */
export const PASSWORD_MIN = 8;

export type PasswordRule = 'length' | 'letter' | 'digit';

export function passwordChecks(pw: string): Record<PasswordRule, boolean> {
  return {
    length: pw.length >= PASSWORD_MIN,
    letter: /[A-Za-z]/.test(pw),
    digit: /\d/.test(pw),
  };
}

export function passwordValid(pw: string): boolean {
  const c = passwordChecks(pw);
  return c.length && c.letter && c.digit && pw.length <= 72;
}

/**
 * Robustesse indicative, de 0 (vide) à 4 (forte) : longueur, mélange de
 * minuscules / majuscules, chiffres et caractères spéciaux.
 */
export function passwordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  if (!passwordValid(pw)) return 1;
  let score = 2;
  if (pw.length >= 12) score += 1;
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (variety >= 3) score += 1;
  return Math.min(score, 4) as 2 | 3 | 4;
}
