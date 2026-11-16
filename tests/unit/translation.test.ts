import { describe, expect, it, vi } from 'vitest';
import { bilingual, DeepLTranslator, getTranslator, translateFields, type Translator } from '@/lib/translation';
import { contentSchema } from '@/lib/validation/content';

/** Faux traducteur : met le texte en majuscules et compte les appels. */
function fakeTranslator() {
  const calls: { texts: string[]; from: string; to: string }[] = [];
  const t: Translator = {
    name: 'fake',
    async translate(texts, from, to) {
      calls.push({ texts, from, to });
      return texts.map((x) => `[${to}] ${x.toUpperCase()}`);
    },
  };
  return { t, calls };
}

describe('traduction automatique des contenus', () => {
  it('préserve la structure Markdown (titres, listes, lignes vides)', async () => {
    const { t, calls } = fakeTranslator();
    const md = '## Étapes\n\n- Créer le compte\n1. Faire le KYC\n\nTexte **gras**.';
    const out = await translateFields(t, { modop: md }, 'fr', 'en');
    expect(out.modop).toBe('## [en] ÉTAPES\n\n- [en] CRÉER LE COMPTE\n1. [en] FAIRE LE KYC\n\n[en] TEXTE **GRAS**.');
    // Les lignes vides ne partent pas au service.
    expect(calls[0].texts).toEqual(['Étapes', 'Créer le compte', 'Faire le KYC', 'Texte **gras**.']);
  });

  it('regroupe tous les champs en un seul appel et laisse les champs vides vides', async () => {
    const { t, calls } = fakeTranslator();
    const out = await translateFields(t, { title: 'Campagne', summary: '', modop: 'Étape' }, 'fr', 'en');
    expect(calls).toHaveLength(1);
    expect(out).toEqual({ title: '[en] CAMPAGNE', summary: '', modop: '[en] ÉTAPE' });
  });

  it('remplit les colonnes _fr / _en selon la langue de saisie', async () => {
    const { t } = fakeTranslator();
    const fromFr = await bilingual({ title: 'Campagne' }, 'fr', t);
    expect(fromFr).toEqual({ columns: { title_fr: 'Campagne', title_en: '[en] CAMPAGNE' }, translated: true });
    const fromEn = await bilingual({ title: 'Campaign' }, 'en', t);
    expect(fromEn.columns).toEqual({ title_en: 'Campaign', title_fr: '[fr] CAMPAIGN' });
  });

  it('sans service ou en cas d’échec : la langue d’origine est enregistrée, l’autre reste vide', async () => {
    expect(await bilingual({ title: 'Campagne' }, 'fr', null)).toEqual({
      columns: { title_fr: 'Campagne', title_en: '' },
      translated: false,
    });
    const failing: Translator = { name: 'ko', translate: () => Promise.reject(new Error('quota')) };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await bilingual({ title: 'Campaign' }, 'en', failing);
    expect(r).toEqual({ columns: { title_en: 'Campaign', title_fr: '' }, translated: false });
  });

  it('DeepL : requête conforme (clé gratuite « :fx », lots de 50 textes)', async () => {
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { text: string[] };
      return new Response(JSON.stringify({ translations: body.text.map((x) => ({ text: `EN:${x}` })) }), { status: 200 });
    });
    const deepl = new DeepLTranslator('abc:fx', fetchMock as unknown as typeof fetch);
    const texts = Array.from({ length: 60 }, (_, i) => `t${i}`);
    const out = await deepl.translate(texts, 'fr', 'en');
    expect(out[59]).toBe('EN:t59');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api-free.deepl.com/v2/translate');
    expect((init?.headers as Record<string, string>).Authorization).toBe('DeepL-Auth-Key abc:fx');
    expect(JSON.parse(String(init?.body))).toMatchObject({ source_lang: 'FR', target_lang: 'EN-GB', preserve_formatting: true });
    expect(new DeepLTranslator('pro-key').endpoint).toBe('https://api.deepl.com/v2/translate');
  });

  it('DeepL : une erreur HTTP est remontée (pour basculer sur le repli)', async () => {
    const fetchMock = vi.fn(async () => new Response('Quota exceeded', { status: 456 }));
    await expect(new DeepLTranslator('k:fx', fetchMock as unknown as typeof fetch).translate(['x'], 'en', 'fr')).rejects.toThrow(/456/);
  });

  it('aucun traducteur sans DEEPL_API_KEY', () => {
    expect(getTranslator({} as NodeJS.ProcessEnv)).toBeNull();
    expect(getTranslator({ DEEPL_API_KEY: 'k:fx' } as unknown as NodeJS.ProcessEnv)?.name).toBe('deepl');
  });

  it('charte : un seul champ de saisie', () => {
    expect(contentSchema.parse({ key: 'ambassador_charter', body: 'Texte' })).toEqual({
      key: 'ambassador_charter',
      source_locale: 'fr',
      body: 'Texte',
    });
  });
});
