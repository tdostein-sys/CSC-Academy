'use client';

import { useActionState, useEffect, useRef, useState, type ReactNode } from 'react';
import { initialFormState, type FormState } from '@/lib/forms';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { FormMessage } from './fields';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/**
 * Petit formulaire d'action (bouton « Valider », « Payer », « Suspendre »…)
 * utilisable directement depuis une page serveur. Les identifiants passent en
 * champs cachés ; l'action serveur revérifie tout (rôle, état, montants).
 */
export function ActionForm({
  action,
  children,
  confirm,
  confirmTitle,
  confirmLabel,
  danger = false,
  className,
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
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const submitter = useRef<HTMLElement | null>(null);
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
        action={formAction}
        onSubmit={(e) => {
          if (!confirm || confirmed.current) {
            confirmed.current = false;
            return;
          }
          // On suspend l'envoi et on demande confirmation dans l'application.
          e.preventDefault();
          submitter.current = (e.nativeEvent as SubmitEvent).submitter;
          setAsking(true);
        }}
        className={className}
        aria-busy={pending}
      >
        <fieldset disabled={pending} className="contents">
          {children}
        </fieldset>
        {shown.status !== 'idle' && (
          <div className="mt-2 basis-full">
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
            confirmed.current = true;
            // Renvoie le formulaire avec le même bouton (conserve name/value).
            ref.current?.requestSubmit(submitter.current instanceof HTMLButtonElement ? submitter.current : undefined);
          }}
        />
      )}
    </>
  );
}
