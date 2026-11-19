'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { SourceLocaleField } from '@/components/forms/source-locale-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { settingsSchema } from '@/lib/validation/consulting';
import type { Settings } from '@/lib/consulting/types';
import type { FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Réglages de la prise de rendez-vous et instructions de paiement. */
export function SettingsForm({ action, settings }: { action: ServerAction; settings: Settings }) {
  const t = useTranslations('adminConsulting.settings');
  const tc = useTranslations('common');
  const uiLocale = useLocale() === 'en' ? 'en' : 'fr';
  const [state, formAction, pending] = useValidatedAction(settingsSchema, action);
  const e = state.fieldErrors ?? {};
  const [src, setSrc] = useState<'fr' | 'en'>(settings.source_locale ?? uiLocale);
  const instructions = settings[`payment_instructions_${src}`] || settings[`payment_instructions_${src === 'fr' ? 'en' : 'fr'}`];

  return (
    <form action={formAction} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <TextField name="hold_hours" type="number" label={t('holdHours')} hint={t('holdHoursHint')} defaultValue={settings.hold_hours} min={1} max={72} error={e.hold_hours} />
          <TextField name="cancel_limit_hours" type="number" label={t('cancelLimit')} hint={t('cancelLimitHint')} defaultValue={settings.cancel_limit_hours} min={0} max={168} error={e.cancel_limit_hours} />
          <TextField name="min_notice_hours" type="number" label={t('minNotice')} hint={t('minNoticeHint')} defaultValue={settings.min_notice_hours} min={0} max={168} error={e.min_notice_hours} />
          <TextField name="horizon_days" type="number" label={t('horizon')} hint={t('horizonHint')} defaultValue={settings.horizon_days} min={7} max={90} error={e.horizon_days} />
          <SelectField
            name="slot_step_minutes"
            label={t('step')}
            hint={t('stepHint')}
            defaultValue={String(settings.slot_step_minutes)}
            options={['15', '30', '60'].map((v) => ({ value: v, label: t('stepValue', { minutes: v }) }))}
            error={e.slot_step_minutes}
          />
        </Box>
        <SourceLocaleField defaultValue={src} onChange={setSrc} />
        <TextAreaField
          key={src}
          name="payment_instructions"
          label={t('instructions')}
          hint={t('instructionsHint')}
          defaultValue={instructions}
          minRows={5}
          maxLength={2000}
          error={e.payment_instructions}
          monospace={false}
        />
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false}>
            {tc('save')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
