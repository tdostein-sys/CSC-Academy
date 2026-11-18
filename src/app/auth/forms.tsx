'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import MuiLink from '@mui/material/Link';
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
    <form action={action} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        {next && <input type="hidden" name="next" value={next} />}
        <TextField name="identifier" label={t('identifier')} autoComplete="username" required error={e.identifier} autoCapitalize="none" autoFocus />
        <TextField name="password" type="password" label={t('password')} autoComplete="current-password" required error={e.password} />
        <Box sx={{ textAlign: 'right' }}>
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
  const [state, action, pending] = useValidatedAction(registerSchema, register);
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
    <form action={action} noValidate>
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
        <TextField name="password" type="password" label={t('password')} hint={t('passwordHint')} autoComplete="new-password" required minLength={8} error={e.password} />
        <TextField name="password_confirm" type="password" label={t('passwordConfirm')} autoComplete="new-password" required error={e.password_confirm} />
        <CheckboxField name="accept_terms" label={t('acceptTerms')} error={e.accept_terms} required />
        <SubmitButton pending={pending} pendingLabel={tc('sending')}>
          {t('registerSubmit')}
        </SubmitButton>
      </Stack>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(forgotPasswordSchema, forgotPassword);
  return (
    <form action={action} noValidate>
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

export function NewPasswordForm({ mode }: { mode: 'reset' | 'change' }) {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(newPasswordSchema, mode === 'reset' ? resetPassword : changePassword);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <TextField name="password" type="password" label={t('newPassword')} hint={t('passwordHint')} autoComplete="new-password" required minLength={8} error={e.password} autoFocus />
        <TextField name="password_confirm" type="password" label={t('passwordConfirm')} autoComplete="new-password" required error={e.password_confirm} />
        <SubmitButton pending={pending} pendingLabel={tc('saving')}>
          {mode === 'reset' ? tc('save') : t('changeSubmit')}
        </SubmitButton>
      </Stack>
    </form>
  );
}
