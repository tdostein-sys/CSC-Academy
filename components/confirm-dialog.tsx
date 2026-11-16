'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, HelpCircle } from 'lucide-react';

/**
 * Boîte de confirmation intégrée à l'application (remplace window.confirm).
 * Basée sur l'élément natif <dialog> : focus piégé, touche Échap, fond
 * assombri, sans dépendance supplémentaire.
 */
export function ConfirmDialog({
  open,
  message,
  title,
  confirmLabel,
  tone = 'primary',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  message: string;
  title?: string;
  confirmLabel?: string;
  /** « danger » pour les actions destructives (suppression, retrait…). */
  tone?: 'primary' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('common');
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const Icon = tone === 'danger' ? AlertTriangle : HelpCircle;

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault(); // Échap : on passe par onCancel pour garder l'état cohérent
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel(); // clic sur le fond
      }}
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-bg p-0 text-text shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        <div className="flex gap-4">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
              tone === 'danger' ? 'bg-error-soft text-error' : 'bg-primary-soft text-primary'
            }`}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <div>
            <h2 id="confirm-title" className="text-lg font-semibold">
              {title ?? t('confirmTitle')}
            </h2>
            <p id="confirm-message" className="mt-1 text-sm text-muted">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-outline" onClick={onCancel}>
            {t('cancel')}
          </button>
          <button type="button" autoFocus className={tone === 'danger' ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
            {confirmLabel ?? t('confirm')}
          </button>
        </div>
      </div>
    </dialog>
  );
}
