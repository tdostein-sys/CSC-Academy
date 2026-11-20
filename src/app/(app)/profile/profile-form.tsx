'use client';

import { useTranslations } from 'next-intl';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { FormMessage, SubmitButton, TextField } from '@/components/forms/fields';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { profileSchema } from '@/lib/validation/auth';
import type { Profile } from '@/lib/types';
import { updateProfile } from './actions';

export function ProfileForm({ profile }: { profile: Profile }) {
  const t = useTranslations('auth');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(profileSchema, updateProfile);
  const e = state.fieldErrors ?? {};

  return (
    <form onSubmit={action} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        <Grid container spacing={5}>
          {profile.username && (
            <Grid item xs={12} sm={6}>
              <TextField name="_username" label={tp('username')} value={profile.username} readOnly disabled />
            </Grid>
          )}
          <Grid item xs={12} sm={profile.username ? 6 : 12}>
            <TextField name="_email" label={t('email')} value={profile.email} hint={tp('emailReadonly')} readOnly disabled />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="first_name" label={t('firstName')} defaultValue={profile.first_name} required maxLength={60} error={e.first_name} autoComplete="given-name" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="last_name" label={t('lastName')} defaultValue={profile.last_name} required maxLength={60} error={e.last_name} autoComplete="family-name" />
          </Grid>
          <Grid item xs={12}>
            <TextField name="phone_whatsapp" type="tel" label={t('phone')} hint={t('phoneHint')} defaultValue={profile.phone_whatsapp} required error={e.phone_whatsapp} inputMode="tel" />
          </Grid>
        </Grid>
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false} size="medium">
            {tc('save')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
