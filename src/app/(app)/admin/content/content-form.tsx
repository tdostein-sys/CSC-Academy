'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { FormMessage, SubmitButton, TextAreaField } from '@/components/forms/fields';
import { SourceLocaleField } from '@/components/forms/source-locale-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { contentSchema } from '@/lib/validation/content';
import { saveContent } from './actions';

/** Contenu rédigé une seule fois ; l'autre langue est traduite automatiquement. */
export function ContentForm({
  contentKey,
  bodyFr,
  bodyEn,
  sourceLocale,
}: {
  contentKey: string;
  bodyFr: string;
  bodyEn: string;
  sourceLocale: 'fr' | 'en';
}) {
  const t = useTranslations('admin.content');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(contentSchema, saveContent);
  const [src, setSrc] = useState<'fr' | 'en'>(sourceLocale);
  const e = state.fieldErrors ?? {};
  const body = src === 'fr' ? bodyFr || bodyEn : bodyEn || bodyFr;

  return (
    <form action={action} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        <input type="hidden" name="key" value={contentKey} />
        <SourceLocaleField defaultValue={src} onChange={setSrc} />
        <TextAreaField key={src} name="body" label={t('body')} defaultValue={body} minRows={16} required error={e.body} />
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false} size="medium">
            {tc('save')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
