'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import type { FormState } from '@/lib/forms';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  optionalLabel?: boolean;
}

/** Champ texte accessible : libellé, aide, message d'erreur traduit. */
export function TextField({ name, label, hint, error, optionalLabel, type = 'text', ...rest }: FieldProps) {
  const t = useTranslations();
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(' ') || undefined;

  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
        {optionalLabel && <span className="ml-1 font-normal text-muted">({t('common.optional')})</span>}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={isPassword && visible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={`input ${isPassword ? 'pr-12' : ''}`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-text"
            aria-label={t('auth.showPassword')}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} error={error} />
    </div>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField({ name, label, hint, error, ...rest }: TextAreaProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        className="input min-h-32 font-mono text-sm"
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      <FieldError id={`${id}-err`} error={error} />
    </div>
  );
}

export function CheckboxField({ name, label, error, ...rest }: { name: string; label: ReactNode; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <div className="flex items-start gap-3">
        <input id={id} name={name} type="checkbox" className="mt-1 size-5 accent-[var(--primary)]" aria-invalid={Boolean(error)} {...rest} />
        <label htmlFor={id} className="text-sm">
          {label}
        </label>
      </div>
      <FieldError id={`${id}-err`} error={error} />
    </div>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  const t = useTranslations();
  if (!error) return null;
  return (
    <p id={id} className="mt-1 flex items-center gap-1 text-sm text-error" role="alert">
      <AlertCircle className="size-4 shrink-0" aria-hidden />
      {t.has(error) ? t(error) : error}
    </p>
  );
}

/** Bandeau de résultat global d'un formulaire. */
export function FormMessage({ state }: { state: FormState }) {
  const t = useTranslations();
  if (!state.message || state.status === 'idle') return null;
  const ok = state.status === 'success';
  const text = t.has(state.message) ? t(state.message) : state.message;
  return (
    <div
      role={ok ? 'status' : 'alert'}
      className={`flex items-start gap-2 rounded-lg p-3 text-sm ${ok ? 'bg-success-soft text-success' : 'bg-error-soft text-error'}`}
    >
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden /> : <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />}
      <span>{text}</span>
    </div>
  );
}

export function SubmitButton({ pending, children, pendingLabel, className = 'btn-primary w-full' }: { pending: boolean; children: ReactNode; pendingLabel?: string; className?: string }) {
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (pendingLabel ?? children) : children}
    </button>
  );
}
