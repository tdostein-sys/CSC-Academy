/**
 * Normalise un numéro WhatsApp au format international E.164.
 * - 9 chiffres commençant par 6 ou 2 → numéro camerounais (+237…)
 * - « 00 » initial → « + »
 * - 237XXXXXXXXX → +237XXXXXXXXX
 * Retourne null si le numéro est invalide.
 */
export function normalizePhone(input: string): string | null {
  let v = input.trim().replace(/[\s.\-()]/g, '');
  if (v.startsWith('00')) v = `+${v.slice(2)}`;
  if (/^[62]\d{8}$/.test(v)) v = `+237${v}`;
  else if (/^237\d{9}$/.test(v)) v = `+${v}`;

  if (!/^\+[1-9]\d{7,14}$/.test(v)) return null;
  // Cameroun : 9 chiffres après l'indicatif, mobile (6) ou fixe (2).
  if (v.startsWith('+237') && !/^\+237[62]\d{8}$/.test(v)) return null;
  return v;
}
