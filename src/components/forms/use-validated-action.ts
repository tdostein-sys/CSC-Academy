'use client';

import { useActionState } from 'react';
import type { ZodType } from 'zod';
import { formDataToObject, fromZodError, initialFormState, type FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Valide le formulaire dans le navigateur (retour immédiat, pas d'aller-retour
 * réseau) PUIS appelle l'action serveur, qui revalide avec le même schéma.
 */
export function useValidatedAction(schema: ZodType, action: ServerAction) {
  return useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    const parsed = schema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    return action(prev, fd);
  }, initialFormState);
}
