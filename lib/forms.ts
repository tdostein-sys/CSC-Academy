import type { ZodError } from 'zod';

/**
 * État renvoyé par les actions de formulaire. Les messages sont des CLÉS de
 * traduction (ex. « validation.required ») traduites côté interface.
 */
export interface FormState {
  status: 'idle' | 'error' | 'success';
  message?: string;
  fieldErrors?: Record<string, string>;
}

export const initialFormState: FormState = { status: 'idle' };

export function fromZodError(error: ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { status: 'error', message: 'errors.checkForm', fieldErrors };
}

export function formError(message: string): FormState {
  return { status: 'error', message };
}

export function formSuccess(message?: string): FormState {
  return { status: 'success', message };
}

/** FormData → objet simple (les champs répétés gardent la dernière valeur). */
export function formDataToObject(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  fd.forEach((value, key) => {
    if (typeof value === 'string' && !key.startsWith('$ACTION')) out[key] = value;
  });
  return out;
}
