import { z } from 'zod';
import { normalizePhone } from '@/lib/phone';

/** Messages = clés de traduction (namespace « validation »). */
const name = z
  .string()
  .trim()
  .min(2, 'validation.nameTooShort')
  .max(60, 'validation.tooLong');

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordTooShort')
  .max(72, 'validation.tooLong')
  .regex(/[A-Za-z]/, 'validation.passwordLetterDigit')
  .regex(/\d/, 'validation.passwordLetterDigit');

const phone = z
  .string()
  .trim()
  .min(1, 'validation.required')
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: 'custom', message: 'validation.phoneInvalid' });
      return z.NEVER;
    }
    return n;
  });

const email = z.string().trim().toLowerCase().pipe(z.email('validation.emailInvalid'));

export const registerSchema = z
  .object({
    first_name: name,
    last_name: name,
    email,
    phone_whatsapp: phone,
    password: passwordSchema,
    password_confirm: z.string(),
    accept_terms: z.literal('on', 'validation.acceptTerms'),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'validation.passwordMismatch',
    path: ['password_confirm'],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'validation.required').max(254, 'validation.tooLong'),
  password: z.string().min(1, 'validation.required'),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'validation.passwordMismatch',
    path: ['password_confirm'],
  });

/** Changement de mot de passe depuis le compte : l'actuel est exigé. */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'validation.currentPasswordRequired').max(72, 'validation.tooLong'),
    password: passwordSchema,
    password_confirm: z.string(),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'validation.passwordMismatch',
    path: ['password_confirm'],
  })
  .refine((d) => d.password !== d.current_password, {
    message: 'validation.passwordSameAsOld',
    path: ['password'],
  });

export const profileSchema = z.object({
  first_name: name,
  last_name: name,
  phone_whatsapp: phone,
});

/** Un identifiant sans « @ » est un nom d'utilisateur. */
export function isEmailIdentifier(identifier: string): boolean {
  return identifier.includes('@');
}
