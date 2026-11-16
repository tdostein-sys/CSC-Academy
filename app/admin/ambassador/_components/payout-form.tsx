import { getLocale, getTranslations } from 'next-intl/server';
import { ActionForm } from '@/components/forms/action-form';
import { payoutMethodOptions } from '@/lib/ambassador/methods';
import { recordPayout } from '../actions';

/** Formulaire « Payer » : montant proposé = reste dû (paiement partiel possible). */
export async function PayoutForm({ campaignId, ambassadorId, due }: { campaignId: string; ambassadorId: string; due: number }) {
  const [t, locale] = await Promise.all([getTranslations('adminAmbassador.payout'), getLocale()]);
  return (
    <details>
      <summary className="btn-primary min-h-9 cursor-pointer list-none py-1 [&::-webkit-details-marker]:hidden">{t('record')}</summary>
      <ActionForm action={recordPayout} className="mt-2 grid min-w-60 gap-2">
        <input type="hidden" name="campaign_id" value={campaignId} />
        <input type="hidden" name="ambassador_id" value={ambassadorId} />
        <label className="text-xs font-medium">
          {t('amount')}
          <input name="amount" inputMode="numeric" defaultValue={String(due)} required className="input mt-1 min-h-9 py-1 text-sm" />
        </label>
        <label className="text-xs font-medium">
          {t('method')}
          <select name="method" required defaultValue="" className="input mt-1 min-h-9 py-1 text-sm">
            <option value="" disabled>
              —
            </option>
            {payoutMethodOptions(locale).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium">
          {t('reference')}
          <input name="reference" maxLength={120} className="input mt-1 min-h-9 py-1 text-sm" />
        </label>
        <button type="submit" className="btn-primary min-h-9 py-1">
          {t('record')}
        </button>
      </ActionForm>
    </details>
  );
}
