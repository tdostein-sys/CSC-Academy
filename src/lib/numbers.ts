/**
 * Lecture des nombres saisis par les utilisateurs (formats FR et EN) :
 * « 2 000 », « 2000 », « 1 234,56 », « 1,234.56 » (espaces insécables inclus).
 */
const SPACES = /[\s  ]/g;

/** Décimal ≥ 0 avec au plus 2 décimales ; null si invalide. */
export function parseDecimal(input: string): number | null {
  let v = input.replace(SPACES, '');
  if (v === '') return null;
  if (v.includes(',') && v.includes('.')) {
    // Le dernier séparateur est le séparateur décimal.
    v = v.lastIndexOf(',') > v.lastIndexOf('.') ? v.replace(/\./g, '').replace(',', '.') : v.replace(/,/g, '');
  } else {
    v = v.replace(',', '.');
  }
  if (!/^\d+(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n < 1e15 ? n : null;
}

/** Entier > 0 (montants en FCFA, sans centimes) ; null si invalide. */
export function parseAmount(input: string): number | null {
  const v = input.replace(SPACES, '');
  if (!/^\d{1,12}$/.test(v)) return null;
  const n = Number(v);
  return n > 0 ? n : null;
}
