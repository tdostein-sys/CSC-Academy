'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { FormMessage, SubmitButton, TextField } from '@/components/forms/fields';
import { useValidatedAction } from '@/components/forms/use-validated-action';
import { submissionSchema } from '@/lib/validation/ambassador';
import { submitAccount } from '../../actions';

export function SubmissionForm({ campaignId, minVolumeLabel }: { campaignId: string; minVolumeLabel: string | null }) {
  const t = useTranslations('ambassador.campaign');
  const tc = useTranslations('common');
  const [state, action, pending] = useValidatedAction(submissionSchema, submitAccount);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.fieldErrors ?? {};

  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="campaign_id" value={campaignId} />
      <TextField
        name="binance_uid"
        label={t('binanceUid')}
        hint={t('binanceUidHint')}
        inputMode="numeric"
        autoComplete="off"
        maxLength={20}
        required
        error={e.binance_uid}
      />
      <TextField
        name="trading_volume"
        label={t('tradingVolume')}
        hint={minVolumeLabel ?? undefined}
        inputMode="decimal"
        autoComplete="off"
        maxLength={20}
        required
        error={e.trading_volume}
      />
      <SubmitButton pending={pending} pendingLabel={tc('sending')} className="btn-primary w-full sm:w-auto">
        {t('submit')}
      </SubmitButton>
    </form>
  );
}
