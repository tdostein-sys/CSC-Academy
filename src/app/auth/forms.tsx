'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
import { CheckboxField, FormMessage, SubmitButton, TextField } from '@/components/forms/fields';
import { PasswordConfirmField, PasswordField } from '@/components/forms/password-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, newPasswordSchema, registerSchema } from '@/lib/validation/auth';
import { passwordValid } from '@/lib/validation/password';
import { changePassword, forgotPassword, login, register, resetPassword } from './actions';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, submit, pending] = useValidatedAction(loginSchema, login);
  const e = state.fieldErrors ?? {};
  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        {next && <input type="hidden" name="next" value={next} />}
        <TextField name="identifier" label={t('identifier')} autoComplete="username" required error={e.identifier} autoCapitalize="none" autoFocus />
        <TextField name="password" type="password" label={t('password')} autoComplete="current-password" required error={e.password} />
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <CheckboxField name="remember" label={t('remember')} defaultChecked />
          <MuiLink component={Link} href="/auth/forgot-password" variant="body2">
            {t('forgot')}
          </MuiLink>
        </Box>
        <SubmitButton pending={pending} pendingLabel={tc('sending')}>
          {t('loginSubmit')}
        </SubmitButton>
      </Stack>
    </form>
  );
}

export function RegisterForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, submit, pending] = useValidatedAction(registerSchema, register);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const e = state.fieldErrors ?? {};

  if (state.status === 'success') {
    return (
      <Stack spacing={3} sx={{ textAlign: 'center' }}>
        <Typography variant="h6" component="h2">
          {t('registerSuccessTitle')}
        </Typography>
        <Typography sx={{ color: 'text.secondary' }}>{t('registerSuccessBody')}</Typography>
        <Box>
          <Button component={Link} href="/auth/login" variant="outlined">
            {t('backToLogin')}
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <TextField name="first_name" label={t('firstName')} autoComplete="given-name" required maxLength={60} error={e.first_name} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="last_name" label={t('lastName')} autoComplete="family-name" required maxLength={60} error={e.last_name} />
          </Grid>
        </Grid>
        <TextField name="email" type="email" label={t('email')} autoComplete="email" required error={e.email} autoCapitalize="none" />
        <TextField name="phone_whatsapp" type="tel" label={t('phone')} hint={t('phoneHint')} autoComplete="tel" inputMode="tel" required error={e.phone_whatsapp} />
        <PasswordField label={t('password')} value={password} onValueChange={setPassword} error={e.password} />
        <PasswordConfirmField label={t('passwordConfirm')} password={password} value={confirm} onValueChange={setConfirm} error={e.password_confirm} />
        <CheckboxField name="accept_terms" label={t('acceptTerms')} error={e.accept_terms} required />
        <SubmitButton pending={pending} pendingLabel={tc('sending')} disabled={!passwordValid(password) || confirm !== password}>
          {t('registerSubmit')}
        </SubmitButton>
      </Stack>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, submit, pending] = useValidatedAction(forgotPasswordSchema, forgotPassword);
  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <TextField name="email" type="email" label={t('email')} autoComplete="email" required error={state.fieldErrors?.email} autoCapitalize="none" autoFocus />
        <SubmitButton pending={pending} pendingLabel={tc('sending')}>
          {t('forgotSubmit')}
        </SubmitButton>
      </Stack>
    </form>
  );
}

/** Nouveau mot de passe après un lien « mot de passe oublié » (l'ancien n'est pas demandé). */
export function ResetPasswordForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, submit, pending] = useValidatedAction(newPasswordSchema, resetPassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const e = state.fieldErrors ?? {};
  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <PasswordField label={t('newPassword')} value={password} onValueChange={setPassword} error={e.password} autoFocus />
        <PasswordConfirmField label={t('passwordConfirm')} password={password} value={confirm} onValueChange={setConfirm} error={e.password_confirm} />
        <SubmitButton pending={pending} pendingLabel={tc('saving')} disabled={!passwordValid(password) || confirm !== password}>
          {tc('save')}
        </SubmitButton>
      </Stack>
    </form>
  );
}

/** Changement depuis le compte (ou imposé au premier login) : le mot de passe actuel est exigé. */
export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, submit, pending] = useValidatedAction(changePasswordSchema, changePassword);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const e = state.fieldErrors ?? {};
  return (
    <form onSubmit={submit} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <TextField
          name="current_password"
          type="password"
          label={t('currentPassword')}
          hint={forced ? t('currentPasswordForcedHint') : undefined}
          autoComplete="current-password"
          required
          error={e.current_password}
          autoFocus
        />
        <PasswordField label={t('newPassword')} value={password} onValueChange={setPassword} error={e.password} />
        <PasswordConfirmField label={t('passwordConfirm')} password={password} value={confirm} onValueChange={setConfirm} error={e.password_confirm} />
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 2, justifyContent: 'flex-end' }}>
          {!forced && (
            <Button component={Link} href="/profile" variant="outlined" size="large">
              {tc('cancel')}
            </Button>
          )}
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={forced} disabled={!passwordValid(password) || confirm !== password}>
            {t('changeSubmit')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
