'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { FormMessage, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { initialFormState } from '@/lib/forms';
import { saveReport } from '../actions';

export interface ReportDraft {
  consultation_date: string;
  subject: string;
  summary: string;
  recommendations: string;
  observations: string;
}

/** Rédaction du compte rendu (brouillon, modifiable jusqu'à la publication). */
export function ReportForm({ bookingId, draft }: { bookingId: string; draft: ReportDraft }) {
  const t = useTranslations('consulting.report');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(saveReport, initialFormState);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <input type="hidden" name="booking_id" value={bookingId} />
        <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', sm: '200px 1fr' } }}>
          <TextField name="consultation_date" type="date" label={t('date')} defaultValue={draft.consultation_date} required error={e.consultation_date} />
          <TextField name="subject" label={t('subject')} defaultValue={draft.subject} required maxLength={200} error={e.subject} />
        </Box>
        <TextAreaField name="summary" label={t('summary')} hint={t('markdownHint')} defaultValue={draft.summary} minRows={6} maxLength={20000} error={e.summary} monospace={false} />
        <TextAreaField name="recommendations" label={t('recommendations')} defaultValue={draft.recommendations} minRows={4} maxLength={20000} error={e.recommendations} monospace={false} />
        <TextAreaField name="observations" label={t('observations')} defaultValue={draft.observations} minRows={3} maxLength={5000} error={e.observations} monospace={false} />
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false}>
            {t('saveDraft')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
