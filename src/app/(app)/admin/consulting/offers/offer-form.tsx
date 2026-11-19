'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { CheckboxField, FormMessage, SelectField, SubmitButton, TextAreaField, TextField } from '@/components/forms/fields';
import { SourceLocaleField } from '@/components/forms/source-locale-field';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { offerSchema } from '@/lib/validation/consulting';
import { CONSULTING_CATEGORIES, CONSULTING_MODES, type ConsultingMode, type Offer } from '@/lib/consulting/types';
import type { FormState } from '@/lib/forms';

type ServerAction = (prev: FormState, fd: FormData) => Promise<FormState>;

/** Création / modification d'une offre de conseil (admin). Saisie dans une seule langue. */
export function OfferForm({ action, offer }: { action: ServerAction; offer?: Offer }) {
  const t = useTranslations('adminConsulting.offerForm');
  const tc = useTranslations('consulting');
  const tcommon = useTranslations('common');
  const uiLocale = useLocale() === 'en' ? 'en' : 'fr';
  const [state, formAction, pending] = useValidatedAction(offerSchema, action);
  const e = state.fieldErrors ?? {};
  const [src, setSrc] = useState<'fr' | 'en'>(offer?.source_locale ?? uiLocale);
  const [mode, setMode] = useState<ConsultingMode>(offer?.mode ?? 'video');
  const text = (field: 'title' | 'description' | 'conditions') =>
    offer ? offer[`${field}_${src}`] || offer[`${field}_${src === 'fr' ? 'en' : 'fr'}`] : '';

  return (
    <form action={formAction} noValidate>
      <Stack spacing={5}>
        <FormMessage state={state} />
        {offer && <input type="hidden" name="id" value={offer.id} />}
        <SourceLocaleField defaultValue={src} onChange={setSrc} />
        <Stack spacing={5} key={src}>
          <TextField name="title" label={t('title')} defaultValue={text('title')} required maxLength={120} error={e.title} />
          <TextAreaField name="description" label={t('description')} hint={t('descriptionHint')} defaultValue={text('description')} minRows={8} error={e.description} />
          <TextAreaField name="conditions" label={t('conditions')} hint={t('conditionsHint')} defaultValue={text('conditions')} minRows={3} maxLength={2000} error={e.conditions} />
        </Stack>
        <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
          <SelectField
            name="category"
            label={t('category')}
            defaultValue={offer?.category ?? 'investment'}
            options={CONSULTING_CATEGORIES.map((v) => ({ value: v, label: tc(`category.${v}`) }))}
            error={e.category}
          />
          <SelectField
            name="mode"
            label={t('mode')}
            defaultValue={mode}
            onChange={(v) => setMode(v as ConsultingMode)}
            options={CONSULTING_MODES.map((v) => ({ value: v, label: tc(`mode.${v}`) }))}
            error={e.mode}
          />
          <TextField name="duration_minutes" type="number" label={t('duration')} hint={t('durationHint')} defaultValue={offer?.duration_minutes ?? 60} min={15} max={240} required error={e.duration_minutes} />
          <TextField name="price" label={t('price')} hint={t('priceHint')} defaultValue={offer ? String(offer.price) : '0'} inputMode="numeric" error={e.price} />
          {mode === 'in_person' && (
            <Box sx={{ gridColumn: { md: '1 / -1' } }}>
              <TextField name="location" label={t('location')} defaultValue={offer?.location ?? ''} required maxLength={300} error={e.location} />
            </Box>
          )}
        </Box>
        <CheckboxField name="once_per_client" label={t('oncePerClient')} defaultChecked={offer?.once_per_client ?? false} />
        <Box>
          <SubmitButton pending={pending} pendingLabel={tcommon('saving')} fullWidth={false}>
            {offer ? tcommon('save') : t('create')}
          </SubmitButton>
        </Box>
      </Stack>
    </form>
  );
}
