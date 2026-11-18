import { getLocale, getTranslations } from 'next-intl/server';
import Button from '@mui/material/Button';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, TextField } from '@/components/forms/fields';
import { Collapsible } from '@/components/ui/collapsible';
import { payoutMethodOptions } from '@/lib/ambassador/methods';
import { recordPayout } from '../actions';

/** Formulaire « Payer » : montant proposé = reste dû (paiement partiel possible). */
export async function PayoutForm({ campaignId, ambassadorId, due }: { campaignId: string; ambassadorId: string; due: number }) {
  const [t, locale] = await Promise.all([getTranslations('adminAmbassador.payout'), getLocale()]);
  return (
    <Collapsible kind="button" summary={t('record')}>
      <ActionForm action={recordPayout} style={{ marginTop: 12, display: 'grid', gap: 12, minWidth: 240 }}>
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="ambassador_id" value={ambassadorId} />
        <TextField name="amount" label={t('amount')} inputMode="numeric" defaultValue={String(due)} required size="small" />
        <SelectField name="method" label={t('method')} required size="small" defaultValue="" options={[{ value: '', label: '—' }, ...payoutMethodOptions(locale)]} />
        <TextField name="reference" label={t('reference')} maxLength={120} size="small" optionalLabel />
        <Button type="submit" variant="contained">
          {t('record')}
        </Button>
      </ActionForm>
    </Collapsible>
  );
}
