import { z } from 'zod';
import { parseAmount } from '@/lib/numbers';
import { PAYOUT_METHODS, sourceLocale } from '@/lib/validation/ambassador';
import { CONSULTING_CATEGORIES, CONSULTING_MODES } from '@/lib/consulting/types';

/** Messages = clés de traduction. Les mêmes schémas servent au navigateur et au serveur. */
const optionalText = (max: number) => z.string().trim().max(max, 'validation.tooLong').default('');
const title = z.string().trim().min(3, 'validation.titleTooShort').max(120, 'validation.tooLong');
const uuid = z.uuid('errors.generic');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const date = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine((v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)), 'validation.dateInvalid');

/** Date et heure locales (Cameroun) au format du champ « datetime-local ». */
const localDateTime = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine((v) => LOCAL_DATETIME.test(v) && !Number.isNaN(Date.parse(`${v}:00+01:00`)), 'validation.dateInvalid');

/** Instant ISO complet (créneau choisi dans la liste proposée par la base). */
const isoInstant = z
  .string()
  .trim()
  .min(1, 'consulting.errors.slot_required')
  .refine((v) => !Number.isNaN(Date.parse(v)) && /T/.test(v), 'consulting.errors.slot_required');

const intBetween = (min: number, max: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(max, message);

const price = z
  .string()
  .trim()
  .default('0')
  .transform((v, ctx) => {
    const n = v === '' ? 0 : parseAmount(v);
    if (n === null || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'validation.amountInvalid' });
      return z.NEVER;
    }
    return n;
  });

const amount = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .transform((v, ctx) => {
    const n = parseAmount(v);
    if (n === null || n <= 0 || n > 100_000_000) {
      ctx.addIssue({ code: 'custom', message: 'validation.amountInvalid' });
      return z.NEVER;
    }
    return n;
  });

const checkbox = z
  .string()
  .optional()
  .transform((v) => v === 'on' || v === '1' || v === 'true');

// -----------------------------------------------------------------------------
// Offres
// -----------------------------------------------------------------------------
export const offerSchema = z
  .object({
    source_locale: sourceLocale,
    title,
    description: optionalText(20000),
    conditions: optionalText(2000),
    category: z.enum(CONSULTING_CATEGORIES, 'errors.generic'),
    mode: z.enum(CONSULTING_MODES, 'errors.generic'),
    location: optionalText(300),
    duration_minutes: intBetween(15, 240, 'validation.consultingDurationInvalid'),
    price,
    once_per_client: checkbox,
  })
  .refine((d) => d.mode !== 'in_person' || d.location.length >= 3, { message: 'validation.locationRequired', path: ['location'] });
export type OfferInput = z.infer<typeof offerSchema>;

export const offerStatusSchema = z.object({
  id: uuid,
  status: z.enum(['draft', 'published', 'archived'], 'errors.generic'),
});

// -----------------------------------------------------------------------------
// Réglages, conseillers, disponibilités
// -----------------------------------------------------------------------------
export const settingsSchema = z.object({
  source_locale: sourceLocale,
  hold_hours: intBetween(1, 72, 'validation.holdHoursInvalid'),
  min_notice_hours: intBetween(0, 168, 'validation.noticeHoursInvalid'),
  horizon_days: intBetween(7, 90, 'validation.horizonInvalid'),
  cancel_limit_hours: intBetween(0, 168, 'validation.cancelLimitInvalid'),
  slot_step_minutes: z.enum(['15', '30', '60'], 'errors.generic').transform(Number),
  payment_instructions: optionalText(2000),
});

export const advisorSchema = z.object({
  email: z.string().trim().toLowerCase().max(254, 'validation.tooLong').pipe(z.email('validation.emailInvalid')),
  display_name: z.string().trim().min(2, 'validation.nameTooShort').max(120, 'validation.tooLong'),
});

export const advisorStatusSchema = z.object({
  user_id: uuid,
  display_name: z.string().trim().min(2, 'validation.nameTooShort').max(120, 'validation.tooLong'),
  active: z.enum(['1', '0'], 'errors.generic').transform((v) => v === '1'),
});

export const availabilitySchema = z
  .object({
    advisor_id: uuid,
    weekday: intBetween(1, 7, 'errors.generic'),
    start_time: z.string().trim().regex(TIME, 'validation.timeInvalid'),
    end_time: z.string().trim().regex(TIME, 'validation.timeInvalid'),
  })
  .refine((d) => d.end_time > d.start_time, { message: 'validation.endBeforeStart', path: ['end_time'] });

export const unavailabilitySchema = z
  .object({
    advisor_id: uuid,
    starts_at: localDateTime,
    ends_at: localDateTime,
    reason: optionalText(300),
  })
  .refine((d) => d.ends_at > d.starts_at, { message: 'validation.endBeforeStart', path: ['ends_at'] });

// -----------------------------------------------------------------------------
// Rendez-vous (client)
// -----------------------------------------------------------------------------
export const bookSchema = z.object({
  offer_id: uuid,
  starts_at: isoInstant,
  message: optionalText(2000),
});

export const cancelSchema = z.object({
  id: uuid,
  reason: optionalText(500),
});

export const rescheduleSchema = z.object({
  id: uuid,
  starts_at: isoInstant,
});

/** Report par l'administrateur : date et heure libres (heure du Cameroun). */
export const adminRescheduleSchema = z.object({
  id: uuid,
  starts_at: localDateTime,
});

// -----------------------------------------------------------------------------
// Paiements (administrateur)
// -----------------------------------------------------------------------------
export const paymentSchema = z
  .object({
    booking_id: uuid,
    amount,
    method: z.enum(PAYOUT_METHODS, 'validation.methodRequired'),
    reference: optionalText(120),
    paid_on: date,
  })
  .refine((d) => d.method === 'cash' || d.reference.length >= 2, { message: 'consulting.errors.reference_required', path: ['reference'] });

export const refundSchema = z.object({
  payment_id: uuid,
  booking_id: uuid,
  reference: z.string().trim().min(2, 'consulting.errors.reference_required').max(120, 'validation.tooLong'),
  reason: optionalText(500),
});

// -----------------------------------------------------------------------------
// Comptes rendus
// -----------------------------------------------------------------------------
export const reportSchema = z.object({
  booking_id: uuid,
  consultation_date: date,
  subject: z.string().trim().min(3, 'validation.titleTooShort').max(200, 'validation.tooLong'),
  summary: optionalText(20000),
  recommendations: optionalText(20000),
  observations: optionalText(5000),
});

export const reportFileSchema = z.object({
  booking_id: uuid,
  title: z.string().trim().min(2, 'validation.titleTooShort').max(120, 'validation.tooLong'),
});

/**
 * Pièces jointes et justificatifs : PDF ou image, 4 Mo maximum. Les fichiers
 * transitent par une action serveur : Vercel limite le corps d'une requête à
 * 4,5 Mo (le stockage, lui, accepte jusqu'à 10 Mo).
 */
export const FILE_MAX_BYTES = 4 * 1024 * 1024;
export const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const;

export function checkConsultingFile(file: File): string | null {
  if (file.size > FILE_MAX_BYTES) return 'validation.consultingFileTooLarge';
  if (!(FILE_TYPES as readonly string[]).includes(file.type)) return 'validation.pdfOrImageOnly';
  return null;
}

/** Extension de fichier sûre d'après le type (le nom d'origine n'est jamais réutilisé). */
export function fileExtension(type: string): string {
  return { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[type] ?? 'bin';
}

/** « 2027-01-15T18:00 » saisi au Cameroun (UTC+1, sans heure d'été) → ISO UTC. */
export function doualaLocalToIso(v: string): string {
  return new Date(`${v}:00+01:00`).toISOString();
}
