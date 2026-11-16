import { z } from 'zod';
import { parseAmount, parseDecimal } from '@/lib/numbers';
import { parseVideoUrl } from '@/lib/video';

/** Messages = clés de traduction. Les mêmes schémas servent au navigateur et au serveur. */
const optionalText = (max: number) => z.string().trim().max(max, 'validation.tooLong').default('');

const amount = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .transform((v, ctx) => {
    const n = parseAmount(v);
    if (n === null || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'validation.amountInvalid' });
      return z.NEVER;
    }
    return n;
  });

const optionalDecimal = z
  .string()
  .trim()
  .default('')
  .transform((v, ctx) => {
    if (v === '') return null;
    const n = parseDecimal(v);
    if (n === null) {
      ctx.addIssue({ code: 'custom', message: 'validation.numberInvalid' });
      return z.NEVER;
    }
    return n;
  });

const uuid = z.uuid('errors.generic');

/** Langue dans laquelle l'admin saisit le contenu (l'autre est traduite automatiquement). */
export const sourceLocale = z.enum(['fr', 'en'], 'errors.generic').default('fr');

export const campaignSchema = z.object({
  source_locale: sourceLocale,
  title: z.string().trim().min(3, 'validation.titleTooShort').max(120, 'validation.tooLong'),
  summary: optionalText(500),
  modop: optionalText(20000),
  video_url: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || parseVideoUrl(v) !== null, 'validation.videoUrlInvalid')
    .transform((v) => (v === '' ? null : v)),
  amount_per_account: amount,
  min_volume: optionalDecimal,
  ends_on: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), 'validation.dateInvalid')
    .transform((v) => (v === '' ? null : v)),
  remove_file: z.string().optional(),
});
export type CampaignInput = z.infer<typeof campaignSchema>;

/** Fichier de mode opératoire : PDF ou image, 5 Mo maximum. */
export const MODOP_MAX_BYTES = 5 * 1024 * 1024;
export const MODOP_MIME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function checkModopFile(file: File): string | null {
  if (file.size > MODOP_MAX_BYTES) return 'validation.fileTooLarge';
  if (!(file.type in MODOP_MIME_TYPES)) return 'validation.fileType';
  return null;
}

/** ID Binance : chiffres uniquement (6 à 12), espaces tolérés à la saisie. */
export function normalizeBinanceUid(v: string): string {
  return v.replace(/[\s  ]/g, '');
}

export const submissionSchema = z.object({
  campaign_id: uuid,
  binance_uid: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .transform(normalizeBinanceUid)
    .refine((v) => /^\d{6,12}$/.test(v), 'validation.binanceUidInvalid'),
  trading_volume: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .transform((v, ctx) => {
      const n = parseDecimal(v);
      if (n === null) {
        ctx.addIssue({ code: 'custom', message: 'validation.numberInvalid' });
        return z.NEVER;
      }
      return n;
    }),
});

export const rejectSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(3, 'validation.reasonRequired').max(500, 'validation.tooLong'),
});

export const PAYOUT_METHODS = ['orange_money', 'mtn_momo', 'binance_pay', 'bank_transfer', 'cash', 'other'] as const;

export const payoutSchema = z.object({
  campaign_id: uuid,
  ambassador_id: uuid,
  amount,
  method: z.enum(PAYOUT_METHODS, 'validation.methodRequired'),
  reference: optionalText(120),
});

export const suspendSchema = z.object({
  user_id: uuid,
  reason: z.string().trim().min(3, 'validation.reasonRequired').max(300, 'validation.tooLong'),
});
