'use client';

import { useTranslations } from 'next-intl';
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
    <form action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      {profile.username && <TextField name="_username" label={tp('username')} value={profile.username} readOnly disabled />}
      <TextField name="_email" label={t('email')} value={profile.email} hint={tp('emailReadonly')} readOnly disabled />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="first_name" label={t('firstName')} defaultValue={profile.first_name} required maxLength={60} error={e.first_name} autoComplete="given-name" />
        <TextField name="last_name" label={t('lastName')} defaultValue={profile.last_name} required maxLength={60} error={e.last_name} autoComplete="family-name" />
      </div>
      <TextField name="phone_whatsapp" type="tel" label={t('phone')} hint={t('phoneHint')} defaultValue={profile.phone_whatsapp} required error={e.phone_whatsapp} inputMode="tel" />
      <SubmitButton pending={pending} pendingLabel={tc('saving')} className="btn-primary">
        {tc('save')}
      </SubmitButton>
    </form>
  );
}
