'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  const uiLocale = useLocale() === 'en' ? 'en' : 'fr';
  const [state, formAction, pending] = useValidatedAction(campaignSchema, action);
  const e = state.fieldErrors ?? {};
  const frozen = Boolean(campaign && campaign.status !== 'draft');
  // Langue de saisie : celle de la campagne, sinon celle de l'interface.
  const [src, setSrc] = useState<'fr' | 'en'>(campaign?.source_locale ?? uiLocale);
  // Texte affiché pour la langue choisie (si vide, on reprend l'autre version).
  const text = (field: 'title' | 'summary' | 'modop') =>
    campaign ? campaign[`${field}_${src}`] || campaign[`${field}_${src === 'fr' ? 'en' : 'fr'}`] : '';

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      {campaign && <input type="hidden" name="id" value={campaign.id} />}

      <SourceLocaleField defaultValue={src} onChange={setSrc} />

      {/* key={src} : recharge les textes quand on change de langue de saisie */}
      <div key={src} className="space-y-5">
        <TextField name="title" label={t('title')} defaultValue={text('title')} required maxLength={120} error={e.title} />
        <TextAreaField name="summary" label={t('summary')} defaultValue={text('summary')} rows={3} maxLength={500} error={e.summary} />
        <TextAreaField name="modop" label={t('modop')} hint={t('modopHint')} defaultValue={text('modop')} rows={12} error={e.modop} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="amount_per_account"
          label={t('amount')}
          inputMode="numeric"
          defaultValue={campaign ? String(campaign.amount_per_account) : ''}
          readOnly={frozen}
          aria-readonly={frozen}
          hint={frozen ? t('frozen') : undefined}
          required
          error={e.amount_per_account}
        />
        <TextField
          name="min_volume"
          label={t('minVolume')}
          inputMode="decimal"
          defaultValue={campaign?.min_volume !== null && campaign?.min_volume !== undefined ? String(campaign.min_volume) : ''}
          readOnly={frozen}
          aria-readonly={frozen}
          hint={frozen ? t('frozen') : t('minVolumeHint')}
          optionalLabel
          error={e.min_volume}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="video_url"
          type="url"
          label={t('videoUrl')}
          hint={t('videoHint')}
          defaultValue={campaign?.video_url ?? ''}
          placeholder="https://youtu.be/…"
          error={e.video_url}
        />
        <TextField name="ends_on" type="date" label={t('endsOn')} defaultValue={campaign?.ends_on ?? ''} optionalLabel error={e.ends_on} />
      </div>

      <div>
        <label htmlFor="modop_file" className="label">
          {t('modopFile')}
        </label>
        <input
          id="modop_file"
          name="modop_file"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-4 file:py-2 file:font-semibold file:text-text"
          aria-invalid={Boolean(e.modop_file)}
        />
        {e.modop_file && <FormMessage state={{ status: 'error', message: e.modop_file }} />}
        {fileName && (
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-muted">
              {t('currentFile')} : <span className="font-mono">{fileName}</span>
            </p>
            <CheckboxField name="remove_file" label={t('removeFile')} />
          </div>
        )}
      </div>

      <SubmitButton pending={pending} pendingLabel={tc('saving')} className="btn-primary w-full sm:w-auto">
        {campaign ? tc('save') : t('create')}
      </SubmitButton>
    </form>
  );
}
