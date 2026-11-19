'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import { Send } from 'lucide-react';
import { FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { CONTACT_MESSAGE_MAX, CONTACT_SUBJECTS, contactSchema, type ContactSubject } from '@/lib/contact';
import { submitContact } from './actions';

export interface ContactFormDefaults {
  name: string;
  email: string;
  phone: string;
  subject: ContactSubject;
  enrollmentId: string;
}

/** Formulaire de la page Contact : validé dans le navigateur, puis par le serveur et la base. */
export function ContactForm({ defaults, enrollments }: { defaults: ContactFormDefaults; enrollments: { id: string; label: string }[] }) {
  const t = useTranslations('contact');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(contactSchema, submitContact);
  const e = state.fieldErrors ?? {};
  const form = useRef<HTMLFormElement>(null);

  // Message envoyé : on vide le texte (les coordonnées restent pour un prochain message).
  useEffect(() => {
    if (state.status !== 'success') return;
    const msg = form.current?.elements.namedItem('message');
    if (msg instanceof HTMLTextAreaElement) msg.value = '';
  }, [state]);

  return (
    <form ref={form} action={action} noValidate>
      <Stack spacing={4}>
        <FormMessage state={state} />
        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <TextField name="name" label={t('name')} defaultValue={defaults.name} required maxLength={80} error={e.name} autoComplete="name" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="email" type="email" label={t('email')} hint={t('emailHint')} defaultValue={defaults.email} required maxLength={254} error={e.email} autoComplete="email" inputMode="email" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="phone" type="tel" label={t('phone')} hint={t('phoneHint')} defaultValue={defaults.phone} optionalLabel maxLength={30} error={e.phone} autoComplete="tel" inputMode="tel" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectField
              name="subject"
              label={t('subject')}
              required
              defaultValue={defaults.subject}
              error={e.subject}
              options={CONTACT_SUBJECTS.map((s) => ({ value: s, label: t(`subjects.${s}`) }))}
            />
          </Grid>
          {enrollments.length > 0 && (
            <Grid item xs={12}>
              <SelectField
                name="enrollment_id"
                label={t('enrollment')}
                hint={t('enrollmentHint')}
                defaultValue={defaults.enrollmentId}
                options={[{ value: '', label: t('enrollmentNone') }, ...enrollments.map((en) => ({ value: en.id, label: en.label }))]}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <TextAreaField name="message" label={t('message')} hint={t('messageHint', { max: CONTACT_MESSAGE_MAX })} required maxLength={CONTACT_MESSAGE_MAX} minRows={6} monospace={false} error={e.message} />
          </Grid>
        </Grid>
        {/* Champ piège pour les robots : invisible et ignoré par les lecteurs d'écran. */}
        <Box aria-hidden sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
          </label>
        </Box>
        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('sending')} fullWidth={false} size="medium" startIcon={<Send aria-hidden size={18} />}>
            {t('send')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
