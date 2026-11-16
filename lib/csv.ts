/**
 * Génération CSV compatible Excel (FR) : séparateur « ; », BOM UTF-8,
 * guillemets échappés, et protection contre l'injection de formules
 * (une cellule commençant par = + - @ est préfixée d'une apostrophe).
 */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  if (typeof value === 'string' && FORMULA_START.test(s)) s = `'${s}`;
  if (/[";\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((c) => csvCell(c.header)).join(';')];
  for (const row of rows) lines.push(columns.map((c) => csvCell(c.value(row))).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}
