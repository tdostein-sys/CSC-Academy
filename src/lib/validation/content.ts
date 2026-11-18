import { z } from 'zod';

export const CONTENT_KEYS = ['ambassador_charter'] as const;

/** Contenu saisi dans une seule langue ; l'autre est traduite automatiquement. */
export const contentSchema = z.object({
  key: z.enum(CONTENT_KEYS),
  source_locale: z.enum(['fr', 'en'], 'errors.generic').default('fr'),
  body: z.string().trim().min(1, 'validation.required').max(20000, 'validation.tooLong'),
});
