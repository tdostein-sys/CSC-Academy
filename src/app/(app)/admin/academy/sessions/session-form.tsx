'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import { FormMessage, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { SourceLocaleField } from '@/components/forms/source-locale-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { sessionSchema } from '@/lib/validation/academy';
import type { Session } from '@/lib/academy/types';
import type { FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Création / modification d'une session (admin). */
export function SessionForm({ action, courseId, session }: { action: ServerAction; courseId: string; session?: Session }) {
  const t = useTranslations('adminAcademy.sessionForm');
  const tc = useTranslations('common');
  const uiLocale = useLocale() === 'en' ? 'en' : 'fr';
  const [state, formAction, pending] = useValidatedAction(sessionSchema, action);
  const e = state.fieldErrors ?? {};
  const [src, setSrc] = useState<'fr' | 'en'>(session?.source_locale ?? uiLocale);
  const text = (field: 'label' | 'payment_instructions') =>
    session ? session[`${field}_${src}`] || session[`${field}_${src === 'fr' ? 'en' : 'fr'}`] : '';
  const frozen = Boolean(session?.frozen_at);

  return (
    <form action={formAction} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        {session && <input type="hidden" name="id" value={session.id} />}
        <input type="hidden" name="course_id" value={courseId} />
        <SourceLocaleField defaultValue={src} onChange={setSrc} />
        <Stack spacing={5} key={src}>
          <TextField name="label" label={t('label')} hint={t('labelHint')} defaultValue={text('label')} required maxLength={120} error={e.label} />
          <TextAreaField
            name="payment_instructions"
            label={t('instructions')}
            hint={t('instructionsHint')}
            defaultValue={text('payment_instructions')}
            minRows={4}
            maxLength={2000}
            error={e.payment_instructions}
            monospace={false}
          />
        </Stack>
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <TextField name="starts_on" type="date" label={t('startsOn')} defaultValue={session?.starts_on ?? ''} required error={e.starts_on} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="ends_on" type="date" label={t('endsOn')} defaultValue={session?.ends_on ?? ''} required error={e.ends_on} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="seats" label={t('seats')} inputMode="numeric" defaultValue={session ? String(session.seats) : ''} required error={e.seats} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="commission_rate"
              label={t('rate')}
              inputMode="decimal"
              defaultValue={session ? String(session.commission_rate) : '0'}
              hint={frozen ? t('rateFrozen') : t('rateHint')}
              readOnly={frozen}
              error={e.commission_rate}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField name="trainer_name" label={t('trainer')} defaultValue={session?.trainer_name ?? ''} optionalLabel maxLength={120} error={e.trainer_name} />
          </Grid>
        </Grid>
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false}>
            {session ? tc('save') : t('create')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
