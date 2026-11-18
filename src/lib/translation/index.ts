import type { Locale } from '@/lib/types';

/**
 * Traduction automatique des contenus saisis par l'admin (une seule langue
 * de saisie). La traduction est faite UNE FOIS, à l'enregistrement ; les deux
 * versions sont stockées en base, l'affichage ne dépend donc d'aucun service
 * externe.
 */
export interface Translator {
  readonly name: string;
  /** Traduit une liste de textes (l'ordre est conservé). */
  translate(texts: string[], from: Locale, to: Locale): Promise<string[]>;
}

/** DeepL API (offre Free : 500 000 caractères / mois). */
export class DeepLTranslator implements Translator {
  readonly name = 'deepl';
  private static readonly BATCH = 50; // limite DeepL : 50 textes par requête

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  /** Les clés de l'offre gratuite se terminent par « :fx ». */
  get endpoint(): string {
    return this.apiKey.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate';
  }

  async translate(texts: string[], from: Locale, to: Locale): Promise<string[]> {
    const out: string[] = [];
    for (let i = 0; i < texts.length; i += DeepLTranslator.BATCH) {
      const chunk = texts.slice(i, i + DeepLTranslator.BATCH);
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { Authorization: `DeepL-Auth-Key ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: chunk,
          source_lang: from.toUpperCase(),
          target_lang: to === 'en' ? 'EN-GB' : 'FR',
          preserve_formatting: true,
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`DeepL ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = (await res.json()) as { translations?: { text: string }[] };
      if (!json.translations || json.translations.length !== chunk.length) throw new Error('DeepL: réponse inattendue');
      out.push(...json.translations.map((t) => t.text));
    }
    return out;
  }
}

/** Traducteur configuré, ou null si aucun (le contenu reste alors dans sa langue d'origine). */
export function getTranslator(env: NodeJS.ProcessEnv = process.env): Translator | null {
  const key = env.DEEPL_API_KEY?.trim();
  return key ? new DeepLTranslator(key) : null;
}

export const otherLocale = (l: Locale): Locale => (l === 'fr' ? 'en' : 'fr');

// -----------------------------------------------------------------------------
// Markdown : on traduit le TEXTE de chaque ligne en conservant la structure
// (« ## », « - », « 1. », lignes vides), pour que le rendu reste identique.
// -----------------------------------------------------------------------------
const LINE = /^(\s*(?:#{1,6}\s+|[-*]\s+|\d+[.)]\s+)?)(.*)$/;

interface Piece {
  prefix: string;
  text: string;
}

function splitMarkdown(src: string): Piece[] {
  return src
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const m = LINE.exec(line)!;
      return { prefix: m[1], text: m[2] };
    });
}

/**
 * Traduit plusieurs champs (texte simple ou Markdown) en un minimum d'appels.
 * Les champs vides restent vides.
 */
export async function translateFields<K extends string>(
  translator: Translator,
  fields: Record<K, string>,
  from: Locale,
  to: Locale,
): Promise<Record<K, string>> {
  const keys = Object.keys(fields) as K[];
  const pieces = keys.map((k) => splitMarkdown(fields[k]));
  // Seuls les segments contenant du texte partent à la traduction.
  const queue: string[] = [];
  for (const list of pieces) for (const p of list) if (p.text.trim()) queue.push(p.text);

  const translated = queue.length ? await translator.translate(queue, from, to) : [];
  let i = 0;
  const result = {} as Record<K, string>;
  keys.forEach((k, idx) => {
    result[k] = pieces[idx].map((p) => (p.text.trim() ? p.prefix + translated[i++] : p.prefix + p.text)).join('\n');
  });
  return result;
}

/**
 * Prépare les colonnes *_fr / *_en à partir d'une saisie dans une seule
 * langue. En cas d'échec de traduction, l'autre langue reste vide (repli
 * automatique sur la langue d'origine à l'affichage) et `translated` = false.
 */
export async function bilingual<K extends string>(
  fields: Record<K, string>,
  source: Locale,
  translator: Translator | null = getTranslator(),
): Promise<{ columns: Record<`${K}_fr` | `${K}_en`, string>; translated: boolean }> {
  const target = otherLocale(source);
  let other: Record<K, string> | null = null;
  if (translator) {
    try {
      other = await translateFields(translator, fields, source, target);
    } catch (e) {
      console.error('[translation] échec', (e as Error).message);
    }
  }
  const columns = {} as Record<string, string>;
  for (const k of Object.keys(fields) as K[]) {
    columns[`${k}_${source}`] = fields[k];
    columns[`${k}_${target}`] = other?.[k] ?? '';
  }
  return { columns: columns as Record<`${K}_fr` | `${K}_en`, string>, translated: other !== null };
}
