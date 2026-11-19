import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

/** Sujets proposés dans le formulaire de contact (même liste que la base). */
export const CONTACT_SUBJECTS = ['payment', 'course', 'technical', 'other'] as const;
export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];

export const CONTACT_STATUSES = ['new', 'in_progress', 'done'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_MESSAGE_MAX = 2000;

export function isContactSubject(v: unknown): v is ContactSubject {
  return typeof v === 'string' && (CONTACT_SUBJECTS as readonly string[]).includes(v);
}

const optionalPhone = z
  .string()
  .trim()
  .max(30, 'validation.tooLong')
  .transform((v, ctx) => {
    if (!v) return '';
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'validation.phoneInvalid' });
      return z.NEVER;
    }
    return n;
  });

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'validation.tooLong')
  .refine((v) => v === '' || z.email().safeParse(v).success, 'validation.emailInvalid');

/** Formulaire public de contact (revalidé par la base). */
export const contactSchema = z.object({
  name: z.string().trim().min(2, 'validation.nameTooShort').max(80, 'validation.tooLong'),
  email: z.string().trim().toLowerCase().max(254, 'validation.tooLong').pipe(z.email('validation.emailInvalid')),
  phone: optionalPhone.default(''),
  subject: z.enum(CONTACT_SUBJECTS, 'validation.required'),
  message: z.string().trim().min(10, 'contact.validation.messageTooShort').max(CONTACT_MESSAGE_MAX, 'validation.tooLong'),
  enrollment_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null)),
  // Champ piège invisible : rempli seulement par les robots.
  website: z.string().optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

/** Coordonnées affichées (admin). Champ vide = non affiché. */
export const contactSettingsSchema = z.object({
  whatsapp: optionalPhone.default(''),
  phone: optionalPhone.default(''),
  email: optionalEmail.default(''),
});

export const contactUpdateSchema = z.object({
  id: z.uuid('errors.generic'),
  status: z.enum(CONTACT_STATUSES, 'errors.generic'),
  admin_note: z.string().trim().max(1000, 'validation.tooLong').default(''),
});

/** Lien WhatsApp (wa.me) avec un message déjà écrit. */
export function whatsappLink(number: string | null | undefined, text?: string): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** Clé de message pour une erreur renvoyée par les fonctions `contact_*` (aucun détail technique). */
export function contactErrorKey(error: { message?: string } | null | undefined): string {
  const msg = error?.message ?? '';
  if (msg.includes('contact_rate_limited')) return 'contact.errors.rateLimited';
  if (msg.includes('contact_invalid')) return 'errors.checkForm';
  if (msg.includes('forbidden')) return 'errors.forbidden';
  if (msg.includes('not_found')) return 'errors.generic';
  return 'errors.generic';
}

export interface ContactSettings {
  whatsapp: string;
  phone: string;
  email: string;
}
