'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CheckboxField, FormMessage, SubmitButton, TextField } from '@/components/forms/fields';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { forgotPasswordSchema, loginSchema, newPasswordSchema, registerSchema } from '@/lib/validation/auth';
import { changePassword, forgotPassword, login, register, resetPassword } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(loginSchema, login);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {next && <input type="hidden" name="next" value={next} />}
      <TextField name="identifier" label={t('identifier')} autoComplete="username" required error={e.identifier} autoCapitalize="none" />
      <TextField name="password" type="password" label={t('password')} autoComplete="current-password" required error={e.password} />
      <div className="text-right text-sm">
        <Link href="/auth/forgot-password" className="link">
          {t('forgot')}
        </Link>
      </div>
      <SubmitButton pending={pending} pendingLabel={tc('sending')}>
        {t('loginSubmit')}
      </SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(registerSchema, register);
  const e = state.fieldErrors ?? {};

  if (state.status === 'success') {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-lg font-semibold">{t('registerSuccessTitle')}</h2>
        <p className="text-muted">{t('registerSuccessBody')}</p>
        <Link href="/auth/login" className="btn-outline">
          {t('backToLogin')}
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="first_name" label={t('firstName')} autoComplete="given-name" required maxLength={60} error={e.first_name} />
        <TextField name="last_name" label={t('lastName')} autoComplete="family-name" required maxLength={60} error={e.last_name} />
      </div>
      <TextField name="email" type="email" label={t('email')} autoComplete="email" required error={e.email} autoCapitalize="none" />
      <TextField name="phone_whatsapp" type="tel" label={t('phone')} hint={t('phoneHint')} autoComplete="tel" inputMode="tel" required error={e.phone_whatsapp} />
      <TextField name="password" type="password" label={t('password')} hint={t('passwordHint')} autoComplete="new-password" required minLength={8} error={e.password} />
      <TextField name="password_confirm" type="password" label={t('passwordConfirm')} autoComplete="new-password" required error={e.password_confirm} />
      <CheckboxField name="accept_terms" label={t('acceptTerms')} error={e.accept_terms} required />
      <SubmitButton pending={pending} pendingLabel={tc('sending')}>
        {t('registerSubmit')}
      </SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(forgotPasswordSchema, forgotPassword);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField name="email" type="email" label={t('email')} autoComplete="email" required error={state.fieldErrors?.email} autoCapitalize="none" />
      <SubmitButton pending={pending} pendingLabel={tc('sending')}>
        {t('forgotSubmit')}
      </SubmitButton>
    </form>
  );
}

export function NewPasswordForm({ mode }: { mode: 'reset' | 'change' }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(newPasswordSchema, mode === 'reset' ? resetPassword : changePassword);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField name="password" type="password" label={t('newPassword')} hint={t('passwordHint')} autoComplete="new-password" required minLength={8} error={e.password} />
      <TextField name="password_confirm" type="password" label={t('passwordConfirm')} autoComplete="new-password" required error={e.password_confirm} />
      <SubmitButton pending={pending} pendingLabel={tc('saving')}>
        {mode === 'reset' ? tc('save') : t('changeSubmit')}
      </SubmitButton>
    </form>
  );
}
