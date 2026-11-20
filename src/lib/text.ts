/** Comparaison « humaine » : casse, accents, ponctuation et espaces ignorés. */
export function normalizeForCompare(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Renvoie `text`, ou une chaîne vide s'il répète l'un des textes déjà affichés
 * (ex. description identique au titre d'une campagne : on ne l'affiche pas trois fois).
 */
export function distinctFrom(text: string, ...shown: string[]): string {
  const n = normalizeForCompare(text);
  if (!n) return '';
  return shown.some((s) => s && normalizeForCompare(s) === n) ? '' : text;
}
