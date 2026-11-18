import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { csvCell, toCsv } from '@/lib/csv';
import { parseVideoUrl } from '@/lib/video';
import { parseAmount, parseDecimal } from '@/lib/numbers';
import { campaignSchema, payoutSchema, rejectSchema, submissionSchema } from '@/lib/validation/ambassador';
import { AMBASSADOR_ERROR_CODES, ambassadorErrorKey } from '@/lib/ambassador/errors';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { localized } from '@/lib/localized';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

const UUID = '3f1c2a4e-8b7d-4c3a-9e2f-1a2b3c4d5e6f';

describe('export CSV', () => {
  it('BOM UTF-8, séparateur « ; » et fins de ligne Windows (Excel FR)', () => {
    const csv = toCsv([{ a: 'x', b: 2 }], [
      { header: 'A', value: (r) => r.a },
      { header: 'B', value: (r) => r.b },
    ]);
    expect(csv).toBe('﻿A;B\r\nx;2\r\n');
  });

  it('échappe guillemets, séparateurs et retours à la ligne', () => {
    expect(csvCell('Dupont; "Jo"')).toBe('"Dupont; ""Jo"""');
    expect(csvCell('ligne1\nligne2')).toBe('"ligne1\nligne2"');
    expect(csvCell(null)).toBe('');
  });

  it('neutralise l’injection de formules', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+33612')).toBe("'+33612");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
    // Les nombres négatifs (valeurs numériques) ne sont pas modifiés.
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('liens vidéo', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('YouTube : %s', (url, id) => {
    const v = parseVideoUrl(url);
    expect(v?.provider).toBe('youtube');
    expect(v?.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
  });

  it('Google Drive (lien de partage)', () => {
    const v = parseVideoUrl('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing');
    expect(v).toMatchObject({ provider: 'drive', embedUrl: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview' });
  });

  it('TikTok (lien complet, format vertical)', () => {
    const v = parseVideoUrl('https://www.tiktok.com/@csc.academy/video/7301234567890123456?lang=fr');
    expect(v).toMatchObject({ provider: 'tiktok', embedUrl: 'https://www.tiktok.com/embed/v2/7301234567890123456', vertical: true });
  });

  it('Vimeo', () => {
    expect(parseVideoUrl('https://vimeo.com/76979871')).toMatchObject({ provider: 'vimeo', embedUrl: 'https://player.vimeo.com/video/76979871' });
  });

  it.each([
    'https://vm.tiktok.com/ZMabc123/',
    'https://www.tiktok.com/@csc/video/<script>',
    'http://youtu.be/dQw4w9WgXcQ',
    'https://evil.example/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=<script>',
    'javascript:alert(1)',
    'pas une url',
  ])('refuse %s', (url) => {
    expect(parseVideoUrl(url)).toBeNull();
  });
});

describe('saisie des nombres', () => {
  it.each([
    ['2000', 2000],
    ['2 000', 2000],
    ['2 000', 2000],
  ])('montant %s', (input, expected) => expect(parseAmount(input)).toBe(expected));

  it.each(['0', '-5', '12,5', 'abc', ''])('montant invalide %s', (input) => expect(parseAmount(input)).toBeNull());

  it.each([
    ['1500', 1500],
    ['1 234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['1.234,5', 1234.5],
    ['0', 0],
  ])('volume %s', (input, expected) => expect(parseDecimal(input)).toBe(expected));

  it.each(['1,2,3', '12.345', '-1', 'x'])('volume invalide %s', (input) => expect(parseDecimal(input)).toBeNull());
});

describe('schémas de validation', () => {
  it('soumission : normalise l’ID Binance et le volume', () => {
    const r = submissionSchema.parse({ campaign_id: UUID, binance_uid: ' 123 456 789 ', trading_volume: '1 500,5' });
    expect(r).toEqual({ campaign_id: UUID, binance_uid: '123456789', trading_volume: 1500.5 });
  });

  it('soumission : refuse un ID Binance non numérique', () => {
    const r = submissionSchema.safeParse({ campaign_id: UUID, binance_uid: 'abc123', trading_volume: '10' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe('validation.binanceUidInvalid');
  });

  it('campagne : une seule langue de saisie (FR par défaut), champs facultatifs vides → null', () => {
    const ok = campaignSchema.parse({ title: 'Campagne', amount_per_account: '2 500' });
    expect(ok).toMatchObject({ source_locale: 'fr', amount_per_account: 2500, min_volume: null, video_url: null, ends_on: null, summary: '' });
    expect(campaignSchema.parse({ title: 'Campaign', amount_per_account: '1', source_locale: 'en' }).source_locale).toBe('en');
    expect(campaignSchema.safeParse({ title: 'Campagne', amount_per_account: '1', source_locale: 'de' }).success).toBe(false);

    const bad = campaignSchema.safeParse({ title: 'Campagne', amount_per_account: '1000', video_url: 'https://vimeo.com/1' });
    expect(bad.error?.issues[0].message).toBe('validation.videoUrlInvalid');
  });

  it('campagne : montant obligatoire et entier', () => {
    expect(campaignSchema.safeParse({ title: 'Campagne', amount_per_account: '' }).success).toBe(false);
    expect(campaignSchema.safeParse({ title: 'Campagne', amount_per_account: '12.5' }).success).toBe(false);
  });

  it('rejet : motif obligatoire', () => {
    expect(rejectSchema.safeParse({ id: UUID, reason: '  ' }).success).toBe(false);
  });

  it('paiement : moyen de paiement dans la liste', () => {
    expect(payoutSchema.safeParse({ campaign_id: UUID, ambassador_id: UUID, amount: '1000', method: 'orange_money' }).success).toBe(true);
    expect(payoutSchema.safeParse({ campaign_id: UUID, ambassador_id: UUID, amount: '1000', method: 'paypal' }).success).toBe(false);
  });
});

describe('erreurs métier', () => {
  it('traduit un code SQL en clé de message', () => {
    expect(ambassadorErrorKey({ message: 'binance_uid_taken' })).toBe('ambassador.errors.binance_uid_taken');
    expect(ambassadorErrorKey({ message: 'forbidden' })).toBe('errors.forbidden');
    expect(ambassadorErrorKey({ message: 'connection reset' })).toBe('errors.generic');
  });

  it('chaque code a un message en français et en anglais', () => {
    const frErr = (fr as { ambassador: { errors: Record<string, string> } }).ambassador.errors;
    const enErr = (en as { ambassador: { errors: Record<string, string> } }).ambassador.errors;
    for (const code of AMBASSADOR_ERROR_CODES.filter((c) => c !== 'forbidden')) {
      expect(frErr[code], `fr: ${code}`).toBeTruthy();
      expect(enErr[code], `en: ${code}`).toBeTruthy();
    }
  });

  it('chaque code levé par la migration est connu de l’application', () => {
    const sql = [
      '20261116000200_ambassador.sql',
      '20261116000500_payout_confirmation.sql',
      '20261116000600_participation_lock.sql',
    ]
      .map((f) => readFileSync(path.resolve(__dirname, '../../supabase/migrations', f), 'utf8'))
      .join('\n');
    const raised = [...sql.matchAll(/raise exception '([a-z_]+)'/g)].map((m) => m[1]);
    expect(raised.length).toBeGreaterThan(10);
    for (const code of new Set(raised)) {
      if (code === 'unauthorized') continue; // session expirée : message générique
      expect(AMBASSADOR_ERROR_CODES as readonly string[], code).toContain(code);
    }
  });
});

describe('traductions', () => {
  function keys(obj: object, prefix = ''): string[] {
    return Object.entries(obj).flatMap(([k, v]) => (typeof v === 'object' && v ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]));
  }
  it('le français et l’anglais ont exactement les mêmes clés', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });
});

describe('contenus bilingues', () => {
  it('replie sur l’autre langue si la traduction est vide (dans les deux sens)', () => {
    expect(localized('en', 'Titre', '')).toBe('Titre');
    expect(localized('fr', '', 'Title')).toBe('Title');
    expect(localized('en', 'Titre', 'Title')).toBe('Title');
    expect(localized('fr', 'Titre', 'Title')).toBe('Titre');
  });
  it('libellés des moyens de paiement', () => {
    expect(payoutMethodLabel('cash', 'fr')).toBe('Espèces');
    expect(payoutMethodLabel('cash', 'en')).toBe('Cash');
    expect(payoutMethodLabel('inconnu', 'fr')).toBe('inconnu');
  });
});
