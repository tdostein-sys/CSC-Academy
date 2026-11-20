'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { FormState } from '@/lib/forms';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormMessage } from './fields';
import { formDataWithSubmitter, useFormSubmit } from './use-validated-action';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Petit formulaire d'action (bouton « Valider », « Payer », « Suspendre »…)
 * utilisable directement depuis une page serveur. Les identifiants passent en
 * champs cachés ; l'action serveur revérifie tout (rôle, état, montants).
 * La saisie n'est jamais effacée en cas d'erreur (voir useFormSubmit) ; elle
 * n'est vidée après un succès que si `resetOnSuccess` est demandé.
 */
export function ActionForm({
  action,
  children,
  confirm,
  confirmTitle,
  confirmLabel,
  danger = false,
  style,
  resetOnSuccess = false,
}: {
  action: ServerAction;
  children: ReactNode;
  /** Message de confirmation avant envoi (actions importantes ou irréversibles). */
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  /** Action destructive : bouton de confirmation rouge. */
  danger?: boolean;
  /** Mise en page du formulaire (ex. { display: 'flex', gap: 8 }). */
  style?: CSSProperties;
  resetOnSuccess?: boolean;
}) {
  const { state, submit, send, pending } = useFormSubmit(action);
  const ref = useRef<HTMLFormElement>(null);
  const waiting = useRef<FormData | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (resetOnSuccess && state.status === 'success') ref.current?.reset();
  }, [state, resetOnSuccess]);

  // Pour un petit formulaire, on affiche directement la première erreur de champ.
  const firstFieldError = state.fieldErrors ? Object.values(state.fieldErrors)[0] : undefined;
  const shown: FormState = firstFieldError ? { status: 'error', message: firstFieldError } : state;

  return (
    <>
      <form
        ref={ref}
        noValidate
        onSubmit={(e) => {
          if (!confirm) return submit(e);
          // On suspend l'envoi et on demande confirmation dans l'application.
          e.preventDefault();
          if (pending) return;
          waiting.current = formDataWithSubmitter(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
          setAsking(true);
        }}
        style={style}
        aria-busy={pending}
      >
        <fieldset disabled={pending} style={{ display: 'contents', border: 0, margin: 0, padding: 0 }}>
          {children}
        </fieldset>
        {shown.status !== 'idle' && (
          <div style={{ marginTop: 8, flexBasis: '100%' }}>
            <FormMessage state={shown} />
          </div>
        )}
      </form>
      {confirm && (
        <ConfirmDialog
          open={asking}
          message={confirm}
          title={confirmTitle}
          confirmLabel={confirmLabel}
          tone={danger ? 'danger' : 'primary'}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            if (waiting.current) send(waiting.current, ref.current);
            waiting.current = null;
          }}
        />
      )}
    </>
  );
}
