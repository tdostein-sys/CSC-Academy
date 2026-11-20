/**
 * Programme d'une formation : l'administrateur le saisit en texte libre
 * (souvent « Chapitre 1 Introduction… 1h Chapitre 2 … 1.5h »). Ce parseur en
 * extrait une liste structurée : numéro, titre, durée. S'il ne reconnaît pas
 * au moins deux chapitres, il renvoie null et la page affiche le texte tel
 * quel (aucune perte d'information).
 *
 * Formats reconnus :
 *   - « Chapitre N », « Module N », « Partie N », « Séance N », « Leçon N »
 *     (avec ou sans « : », « - », « . »), sur une ou plusieurs lignes ;
 *   - une ligne par chapitre commençant par « 1. », « 1) », « 1 - », « - », « • » ;
 *   - durées : « 1h », « 1 h », « 1.5h », « 1,5 h », « 1h30 », « 1 h 30 »,
 *     « 90 min », « 2 heures », éventuellement entre parenthèses.
 */
export interface ProgramChapter {
  title: string;
  /** Durée en minutes (null si non indiquée). */
  minutes: number | null;
}

export interface ParsedProgram {
  chapters: ProgramChapter[];
  /** Somme des durées connues (null si aucune durée). */
  totalMinutes: number | null;
}

const LABEL = '(?:chapitre|chapter|module|partie|part|s[ée]ance|session|le[cç]on|lesson)';
// Un numéro de chapitre n'est jamais suivi d'une unité de durée (« chapitre 1h » n'est pas un chapitre).
const NUM = '\\d+(?![.,]?\\d*\\s*(?:h|heures?|hours?|min|mn)(?![a-zà-ÿ]))';
const SPLIT_LABEL = new RegExp(`(?=\\b${LABEL}\\s*${NUM})`, 'i');
const LEADING_LABEL = new RegExp(`^\\s*${LABEL}\\s*${NUM}\\s*[:.\\-–—)]?\\s*`, 'i');
const LINE_ITEM = /^\s*(?:\d{1,2}\s*[.)\-–—]|[-•*])\s+/;
const DURATION = /\(?\s*(?:(\d+(?:[.,]\d+)?)\s*(?:h|heures?|hours?)(?![a-zà-ÿ])\s*(\d{1,2})?\s*(?:min)?|(\d{1,3})\s*(?:min|minutes?|mn)(?![a-zà-ÿ]))\s*\)?/i;

/** Durée en minutes depuis un texte (« 1h30 », « 1.5h », « 90 min »). */
export function parseDuration(text: string): { minutes: number; match: string } | null {
  const m = DURATION.exec(text);
  if (!m) return null;
  let minutes: number;
  if (m[1] !== undefined) {
    const hours = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(hours) || hours > 24) return null;
    minutes = Math.round(hours * 60) + (m[2] ? Number(m[2]) : 0);
  } else {
    minutes = Number(m[3]);
  }
  if (!minutes || minutes > 24 * 60) return null;
  return { minutes, match: m[0] };
}

function clean(title: string): string {
  return title
    .replace(/\s+/g, ' ')
    .replace(/^[\s:.\-–—•*]+|[\s:.\-–—•*,;]+$/g, '')
    .replace(/\(\s*\)/g, '')
    .trim();
}

function toChapter(chunk: string): ProgramChapter | null {
  let text = chunk.replace(LEADING_LABEL, '').replace(LINE_ITEM, '');
  const d = parseDuration(text);
  if (d) text = text.replace(d.match, ' ');
  const title = clean(text.replace(/\*\*/g, '').replace(/^#+\s*/, ''));
  if (!title) return null;
  return { title, minutes: d?.minutes ?? null };
}

export function parseProgram(source: string): ParsedProgram | null {
  const text = (source ?? '').trim();
  if (!text) return null;

  let chunks: string[];
  if (SPLIT_LABEL.test(text) && text.split(SPLIT_LABEL).filter((c) => c.trim()).length >= 2) {
    // « Chapitre 1 … Chapitre 2 … » : sur une ligne ou plusieurs.
    chunks = text.split(SPLIT_LABEL).filter((c) => new RegExp(`^\\s*${LABEL}\\s*${NUM}`, 'i').test(c));
  } else {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    const items = lines.filter((l) => LINE_ITEM.test(l));
    if (items.length < 2 || items.length < lines.length * 0.6) return null;
    chunks = items;
  }

  const chapters = chunks.map(toChapter).filter((c): c is ProgramChapter => c !== null);
  if (chapters.length < 2) return null;
  const known = chapters.filter((c) => c.minutes !== null);
  return { chapters, totalMinutes: known.length ? known.reduce((s, c) => s + (c.minutes ?? 0), 0) : null };
}

/** « 1 h », « 1 h 30 », « 45 min » (et « 14 h » pour un total). */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}
