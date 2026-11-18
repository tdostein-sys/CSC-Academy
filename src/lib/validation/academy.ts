import { z } from 'zod';
import { parseAmount, parseDecimal } from '@/lib/numbers';
import { parseVideoUrl } from '@/lib/video';
import { PAYOUT_METHODS, sourceLocale } from '@/lib/validation/ambassador';

/** Messages = clés de traduction. Les mêmes schémas servent au navigateur et au serveur. */
const optionalText = (max: number) => z.string().trim().max(max, 'validation.tooLong').default('');
const title = z.string().trim().min(3, 'validation.titleTooShort').max(120, 'validation.tooLong');
const uuid = z.uuid('errors.generic');
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const date = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .refine((v) => ISO_DATE.test(v) && !Number.isNaN(Date.parse(v)), 'validation.dateInvalid');

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

const httpsUrl = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .max(500, 'validation.tooLong')
  .refine((v) => {
    try {
      return new URL(v).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'validation.urlInvalid');

export const courseSchema = z.object({
  source_locale: sourceLocale,
  title,
  summary: optionalText(500),
  program: optionalText(20000),
  level: z.enum(['beginner', 'intermediate', 'advanced'], 'errors.generic'),
});
export type CourseInput = z.infer<typeof courseSchema>;

export const courseStatusSchema = z.object({
  id: uuid,
  status: z.enum(['draft', 'published', 'archived'], 'errors.generic'),
});

export const sessionSchema = z
  .object({
    course_id: uuid,
    source_locale: sourceLocale,
    label: title,
    payment_instructions: optionalText(2000),
    trainer_name: optionalText(120),
    starts_on: date,
    ends_on: date,
    seats: z
      .string()
      .trim()
      .min(1, 'validation.required')
      .transform((v, ctx) => {
        const n = parseAmount(v);
        if (n === null || n < 1 || n > 10000) {
          ctx.addIssue({ code: 'custom', message: 'validation.seatsInvalid' });
          return z.NEVER;
        }
        return n;
      }),
    commission_rate: z
      .string()
      .trim()
      .default('0')
      .transform((v, ctx) => {
        const n = v === '' ? 0 : parseDecimal(v);
        if (n === null || n > 100) {
          ctx.addIssue({ code: 'custom', message: 'validation.rateInvalid' });
          return z.NEVER;
        }
        return n;
      }),
  })
  .refine((d) => d.ends_on >= d.starts_on, { message: 'validation.endBeforeStart', path: ['ends_on'] });
export type SessionInput = z.infer<typeof sessionSchema>;

/** Échéancier : jusqu'à 12 tranches, montants > 0, dates strictement croissantes. */
export const MAX_INSTALLMENTS = 12;

export function parseSchedule(fd: Record<string, string>): { amounts: number[]; dates: string[] } | { error: string } {
  const amounts: number[] = [];
  const dates: string[] = [];
  for (let i = 1; i <= MAX_INSTALLMENTS; i++) {
    const a = (fd[`amount_${i}`] ?? '').trim();
    const d = (fd[`due_${i}`] ?? '').trim();
    if (a === '' && d === '') continue;
    const n = parseAmount(a);
    if (n === null || n > 100_000_000) return { error: 'validation.amountInvalid' };
    if (!ISO_DATE.test(d) || Number.isNaN(Date.parse(d))) return { error: 'validation.dateInvalid' };
    if (dates.length && d <= dates[dates.length - 1]) return { error: 'academy.errors.schedule_dates_order' };
    amounts.push(n);
    dates.push(d);
  }
  if (amounts.length === 0) return { error: 'academy.errors.schedule_invalid' };
  return { amounts, dates };
}

/** Code de parrainage facultatif : numéro d'ambassadeur « CSC-AMB-0001 ». */
export const REFERRAL_CODE = /^CSC-AMB-\d{4,}$/;

export const enrollSchema = z.object({
  session_id: uuid,
  referral_code: z
    .string()
    .trim()
    .default('')
    .transform((v) => v.replace(/\s/g, '').toUpperCase())
    .refine((v) => v === '' || REFERRAL_CODE.test(v), 'validation.referralInvalid'),
});

export const paymentSchema = z.object({
  enrollment_id: uuid,
  amount,
  method: z.enum(PAYOUT_METHODS, 'validation.methodRequired'),
  reference: optionalText(120),
  paid_on: date,
});

export const extensionSchema = z.object({
  enrollment_id: uuid,
  rank: z.coerce.number('errors.generic').int('errors.generic').min(1, 'errors.generic').max(MAX_INSTALLMENTS, 'errors.generic'),
  due_on: date,
  reason: optionalText(500),
});

export const meetingSchema = z.object({
  session_id: uuid,
  source_locale: sourceLocale,
  title,
  /** Date et heure locales (Cameroun) au format du champ « datetime-local ». */
  starts_at: z
    .string()
    .trim()
    .min(1, 'validation.required')
    .refine((v) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), 'validation.dateInvalid'),
  duration_minutes: z.coerce
    .number('validation.durationInvalid')
    .int('validation.durationInvalid')
    .min(15, 'validation.durationInvalid')
    .max(60, 'validation.durationInvalid'),
  external_url: z
    .string()
    .trim()
    .default('')
    .refine((v) => v === '' || httpsUrl.safeParse(v).success, 'validation.urlInvalid')
    .transform((v) => (v === '' ? null : v)),
});

/** « 2027-01-15T18:00 » saisi au Cameroun (UTC+1, sans heure d'été) → ISO UTC. */
export function doualaLocalToIso(v: string): string {
  return new Date(`${v}:00+01:00`).toISOString();
}

export const linkResourceSchema = z
  .object({
    session_id: uuid,
    source_locale: sourceLocale,
    kind: z.enum(['link', 'video'], 'errors.generic'),
    title,
    url: httpsUrl,
  })
  .refine((d) => d.kind !== 'video' || parseVideoUrl(d.url) !== null, { message: 'validation.videoUrlInvalid', path: ['url'] });

export const documentResourceSchema = z.object({
  session_id: uuid,
  source_locale: sourceLocale,
  title,
});

// -----------------------------------------------------------------------------
// Lot 2 : commissions, évaluation finale, attestations
// -----------------------------------------------------------------------------
export const commissionPayoutSchema = z.object({
  enrollment_id: uuid,
  amount,
  method: z.enum(PAYOUT_METHODS, 'validation.methodRequired'),
  reference: optionalText(120),
});

const intBetween = (min: number, max: number, message: string) =>
  z.coerce.number(message).int(message).min(min, message).max(max, message);

export const evaluationSchema = z.object({
  session_id: uuid,
  source_locale: sourceLocale,
  title,
  instructions: optionalText(2000),
  pass_mark: intBetween(1, 100, 'validation.passMarkInvalid'),
  max_attempts: intBetween(1, 10, 'validation.attemptsInvalid'),
});
export type EvaluationInput = z.infer<typeof evaluationSchema>;

export const MAX_CHOICES = 8;

export const questionSchema = z.object({
  session_id: uuid,
  id: z.union([z.literal(''), uuid]).default(''),
  source_locale: sourceLocale,
  prompt: z.string().trim().min(3, 'validation.questionTooShort').max(1000, 'validation.tooLong'),
  multiple: z.enum(['0', '1'], 'errors.generic').default('0'),
  points: intBetween(1, 20, 'validation.pointsInvalid'),
});

/**
 * Propositions d'une question : champs « choice_1 » … « choice_8 » et cases
 * « correct_1 » … (cochées = bonne réponse). Les lignes vides sont ignorées.
 */
export function parseChoices(
  fd: Record<string, string>,
  multiple: boolean,
): { labels: string[]; correct: boolean[] } | { error: string } {
  const labels: string[] = [];
  const correct: boolean[] = [];
  for (let i = 1; i <= MAX_CHOICES; i++) {
    const label = (fd[`choice_${i}`] ?? '').trim();
    if (!label) continue;
    if (label.length > 300) return { error: 'validation.tooLong' };
    labels.push(label);
    correct.push(fd[`correct_${i}`] === 'on' || fd[`correct_${i}`] === '1');
  }
  if (labels.length < 2) return { error: 'validation.choicesTooFew' };
  const good = correct.filter(Boolean).length;
  if (good === 0) return { error: 'validation.correctMissing' };
  if (!multiple && good !== 1) return { error: 'validation.singleCorrect' };
  return { labels, correct };
}

/** Réponses d'une copie : { <id question>: [indices cochés] } (champs « q_<id> »). */
export function answersFromFormData(fd: FormData, questionIds: string[]): Record<string, number[]> {
  const answers: Record<string, number[]> = {};
  for (const id of questionIds) {
    const picked = fd
      .getAll(`q_${id}`)
      .map((v) => Number(v))
      .filter((n) => Number.isInteger(n) && n >= 0 && n < MAX_CHOICES);
    answers[id] = [...new Set(picked)].sort((a, b) => a - b);
  }
  return answers;
}

export const revokeSchema = z.object({
  id: uuid,
  reason: z.string().trim().min(3, 'validation.reasonRequired').max(500, 'validation.tooLong'),
});

/** Saisie d'un numéro d'attestation sur la page publique de vérification. */
export function normalizeCertificateNumber(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s/g, '').toUpperCase().slice(0, 40) : '';
}

/** Documents de formation : PDF, 10 Mo maximum (limite aussi imposée par le stockage). */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

export function checkDocumentFile(file: File): string | null {
  if (file.size > DOCUMENT_MAX_BYTES) return 'validation.documentTooLarge';
  if (file.type !== 'application/pdf') return 'validation.pdfOnly';
  return null;
}
