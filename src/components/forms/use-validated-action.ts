'use client';

import { startTransition, useActionState, useCallback, useEffect, useRef, type FormEvent } from 'react';
import type { ZodType } from 'zod';
import { formDataToObject, fromZodError, initialFormState, type FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Données du formulaire, bouton cliqué compris (name/value). Les navigateurs
 * anciens ignorent le 2e argument de FormData : on ajoute alors le bouton
 * nous-mêmes.
 */
export function formDataWithSubmitter(form: HTMLFormElement, submitter: HTMLElement | null): FormData {
  let fd: FormData;
  try {
    fd = new FormData(form, submitter ?? undefined);
  } catch {
    fd = new FormData(form);
  }
  if (submitter instanceof HTMLButtonElement && submitter.name && !fd.has(submitter.name)) {
    fd.append(submitter.name, submitter.value);
  }
  return fd;
}

/** Premier champ en erreur : on y place le focus (accessibilité, correction rapide). */
export function focusFirstError(form: HTMLFormElement | null, state: FormState) {
  const keys = state.fieldErrors ? Object.keys(state.fieldErrors) : [];
  if (!form || keys.length === 0) return;
  for (const key of keys) {
    const el = form.querySelector<HTMLElement>(`[name="${CSS.escape(key)}"]:not([type="hidden"])`);
    if (el && typeof el.focus === 'function') {
      el.focus();
      return;
    }
  }
}

/**
 * Envoi d'un formulaire vers une action serveur SANS jamais effacer la saisie.
 *
 * React 19 vide automatiquement un `<form action={…}>` après chaque envoi,
 * même quand l'action renvoie une erreur : l'utilisateur perdait tout ce qu'il
 * avait tapé. On envoie donc depuis `onSubmit` (le formulaire n'est pas
 * réinitialisé) : `<form onSubmit={submit} noValidate>`.
 *
 * Si un schéma est fourni, la saisie est validée dans le navigateur (retour
 * immédiat, aucun envoi si elle est invalide) ; l'action serveur revalide
 * toujours avec le même schéma. Une seconde soumission pendant l'envoi est
 * ignorée. En cas d'erreur, le focus va sur le premier champ fautif.
 */
export function useFormSubmit(action: ServerAction, schema?: ZodType) {
  const [state, dispatch, pending] = useActionState(async (prev: FormState, fd: FormData): Promise<FormState> => {
    if (schema) {
      const parsed = schema.safeParse(formDataToObject(fd));
      if (!parsed.success) return fromZodError(parsed.error);
    }
    return action(prev, fd);
  }, initialFormState);

  const formRef = useRef<HTMLFormElement | null>(null);
  const pendingRef = useRef(false);
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const submit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (pendingRef.current) return;
      pendingRef.current = true;
      formRef.current = e.currentTarget;
      const fd = formDataWithSubmitter(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
      startTransition(() => dispatch(fd));
    },
    [dispatch],
  );

  /** Envoi direct de données déjà préparées (ex. après une confirmation). */
  const send = useCallback(
    (fd: FormData, form?: HTMLFormElement | null) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      if (form) formRef.current = form;
      startTransition(() => dispatch(fd));
    },
    [dispatch],
  );

  useEffect(() => {
    // Chaque réponse produit un nouvel état : l'envoi est terminé.
    pendingRef.current = false;
    if (state.status === 'error') focusFirstError(formRef.current, state);
  }, [state]);

  return { state, submit, send, pending };
}

/** Raccourci historique : [état, gestionnaire onSubmit, envoi en cours]. */
export function useValidatedAction(schema: ZodType, action: ServerAction) {
  const { state, submit, pending } = useFormSubmit(action, schema);
  return [state, submit, pending] as const;
}
