'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormHelperText from '@mui/material/FormHelperText';
import { CheckboxField, FormMessage, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { SourceLocaleField } from '@/components/forms/source-locale-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { campaignSchema } from '@/lib/validation/ambassador';
import type { FormState } from '@/lib/forms';
import type { Campaign } from '@/lib/ambassador/types';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Formulaire de création / modification d'une campagne (admin). */
export function CampaignForm({
  action,
  campaign,
  fileName,
}: {
  action: ServerAction;
  campaign?: Campaign;
  /** Nom du fichier de modop actuel, s'il existe. */
  fileName?: string | null;
}) {
  const t = useTranslations('adminAmbassador.form');
  const tc = useTranslations('common');
  const tAll = useTranslations();
  const uiLocale = useLocale() === 'en' ? 'en' : 'fr';
  const [state, formAction, pending] = useValidatedAction(campaignSchema, action);
  const e = state.fieldErrors ?? {};
  const frozen = Boolean(campaign && campaign.status !== 'draft');
  // Langue de saisie : celle de la campagne, sinon celle de l'interface.
  const [src, setSrc] = useState<'fr' | 'en'>(campaign?.source_locale ?? uiLocale);
  // Texte affiché pour la langue choisie (si vide, on reprend l'autre version).
  const text = (field: 'title' | 'summary' | 'modop') => (campaign ? campaign[`${field}_${src}`] || campaign[`${field}_${src === 'fr' ? 'en' : 'fr'}`] : '');

  return (
    <form action={formAction} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        {campaign && <input type="hidden" name="id" value={campaign.id} />}

        <SourceLocaleField defaultValue={src} onChange={setSrc} />

        {/* key={src} : recharge les textes quand on change de langue de saisie */}
        <Stack spacing={5} key={src}>
          <TextField name="title" label={t('title')} defaultValue={text('title') ?? ''} required maxLength={120} error={e.title} />
          <TextAreaField name="summary" label={t('summary')} defaultValue={text('summary') ?? ''} minRows={3} maxLength={500} error={e.summary} monospace={false} />
          <TextAreaField name="modop" label={t('modop')} hint={t('modopHint')} defaultValue={text('modop') ?? ''} minRows={12} error={e.modop} />
        </Stack>

        <Grid container spacing={4}>
          <Grid item xs={12} sm={6}>
            <TextField
              name="amount_per_account"
              label={t('amount')}
              inputMode="numeric"
              defaultValue={campaign ? String(campaign.amount_per_account) : ''}
              readOnly={frozen}
              hint={frozen ? t('frozen') : undefined}
              required
              error={e.amount_per_account}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="min_volume"
              label={t('minVolume')}
              inputMode="decimal"
              defaultValue={campaign?.min_volume !== null && campaign?.min_volume !== undefined ? String(campaign.min_volume) : ''}
              readOnly={frozen}
              hint={frozen ? t('frozen') : t('minVolumeHint')}
              optionalLabel
              error={e.min_volume}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              name="video_url"
              type="url"
              label={t('videoUrl')}
              hint={t('videoHint')}
              defaultValue={campaign?.video_url ?? ''}
              placeholder="https://youtu.be/…"
              error={e.video_url}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField name="ends_on" type="date" label={t('endsOn')} defaultValue={campaign?.ends_on ?? ''} optionalLabel error={e.ends_on} />
          </Grid>
        </Grid>

        <Box>
          <Typography component="label" htmlFor="modop_file" variant="body2" sx={{ display: 'block', mb: 1.5, fontWeight: 500 }}>
            {t('modopFile')}
          </Typography>
          <Box
            component="input"
            id="modop_file"
            name="modop_file"
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            aria-invalid={Boolean(e.modop_file)}
            aria-describedby={e.modop_file ? 'modop_file-error' : undefined}
            sx={{
              display: 'block',
              width: '100%',
              fontSize: '0.875rem',
              color: 'text.primary',
              '&::file-selector-button': {
                mr: 3,
                px: 4,
                py: 2,
                border: 0,
                borderRadius: 1,
                bgcolor: 'secondary.light',
                color: 'text.primary',
                fontWeight: 600,
                cursor: 'pointer',
                font: 'inherit',
              },
            }}
          />
          {e.modop_file && (
            <FormHelperText error id="modop_file-error" role="alert">
              {tAll.has(e.modop_file) ? tAll(e.modop_file) : e.modop_file}
            </FormHelperText>
          )}
          {fileName && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('currentFile')} : <Box component="span" sx={{ fontFamily: 'monospace' }}>{fileName}</Box>
              </Typography>
              <CheckboxField name="remove_file" label={t('removeFile')} />
            </Box>
          )}
        </Box>

        <Box>
          <SubmitButton pending={pending} pendingLabel={tc('saving')} fullWidth={false}>
            {campaign ? tc('save') : t('create')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
