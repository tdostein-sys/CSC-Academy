'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { SourceLocaleField } from '@/components/forms/source-locale-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { courseSchema } from '@/lib/validation/academy';
import { COURSE_LEVELS, type Course } from '@/lib/academy/types';
import type { FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Création / modification d'une formation (admin). Saisie dans une seule langue. */
export function CourseForm({ action, course }: { action: ServerAction; course?: Course }) {
  const t = useTranslations('adminAcademy.courseForm');
  const ta = useTranslations('academy');
  const tc = useTranslations('common');
  const uiLocale = useLocale() === 'en' ? 'en' : 'fr';
  const [state, formAction, pending] = useValidatedAction(courseSchema, action);
  const e = state.fieldErrors ?? {};
  const [src, setSrc] = useState<'fr' | 'en'>(course?.source_locale ?? uiLocale);
  const text = (field: 'title' | 'summary' | 'program') =>
    course ? course[`${field}_${src}`] || course[`${field}_${src === 'fr' ? 'en' : 'fr'}`] : '';

  return (
    <form onSubmit={formAction} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        {course && <input type="hidden" name="id" value={course.id} />}
        <SourceLocaleField defaultValue={src} onChange={setSrc} />
        <Stack spacing={5} key={src}>
          <TextField name="title" label={t('title')} hint={t('titleHint')} defaultValue={text('title')} required maxLength={120} error={e.title} />
          <TextAreaField name="summary" label={t('summary')} hint={t('summaryHint')} defaultValue={text('summary')} minRows={3} maxLength={500} error={e.summary} monospace={false} />
          <TextAreaField name="program" label={t('program')} hint={t('programHint')} defaultValue={text('program')} minRows={10} error={e.program} />
        </Stack>
        <Box sx={{ maxWidth: 320 }}>
          <SelectField
            name="level"
            label={t('level')}
            defaultValue={course?.level ?? 'beginner'}
            options={COURSE_LEVELS.map((v) => ({ value: v, label: ta(`level.${v}`) }))}
            error={e.level}
          />
        </Box>
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false}>
            {course ? tc('save') : t('create')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
