/**
 * Lecture d'une plage horaire PostgreSQL (`tstzrange`) renvoyée sous forme de
 * texte par Supabase, ex. `["2026-12-01 07:00:00+00","2026-12-01 17:00:00+00")`.
 *
 * Piège corrigé : Postgres écrit le décalage horaire « +00 » ou « +01 » (sans
 * les minutes), format que `new Date()` refuse (« Invalid time value »). On
 * normalise donc chaque borne en ISO 8601 strict avant de la lire. Une plage
 * illisible, vide ou infinie renvoie null : la page l'ignore au lieu de planter.
 */
const BOUND = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?)(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/** Une borne Postgres → ISO 8601 (UTC), ou null si illisible. */
export function pgTimestampToIso(value: string): string | null {
  const m = BOUND.exec(value.trim().replace(/^"|"$/g, ''));
  if (!m) return null;
  const [, date, time, zone] = m;
  let offset = 'Z';
  if (zone && zone !== 'Z') {
    const sign = zone[0];
    const digits = zone.slice(1).replace(':', '');
    offset = `${sign}${digits.slice(0, 2)}:${digits.slice(2, 4) || '00'}`;
  }
  // Millisecondes : JavaScript n'en garde que 3.
  const [hms, frac] = time.split('.');
  const t = new Date(`${date}T${hms.length === 5 ? `${hms}:00` : hms}${frac ? `.${frac.slice(0, 3).padEnd(3, '0')}` : ''}${offset}`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}

/** Plage `tstzrange` (texte) → [début, fin] en ISO, ou null. */
export function parseTstzRange(range: string | null | undefined): [string, string] | null {
  if (!range || range === 'empty') return null;
  const inner = range.trim().replace(/^[[(]|[\])]$/g, '');
  const parts = inner.split(',');
  if (parts.length !== 2) return null;
  const start = pgTimestampToIso(parts[0]);
  const end = pgTimestampToIso(parts[1]);
  return start && end ? [start, end] : null;
}
