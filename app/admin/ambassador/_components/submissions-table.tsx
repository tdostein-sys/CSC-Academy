import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import type { Submission } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { PaymentBadge, type PaymentState } from '@/components/payment-badge';
import { deleteRejectedSubmission, rejectSubmission, validateSubmission } from '../actions';

export type SubmissionRow = Submission & {
  ambassadors: { code: string; profiles: { first_name: string; last_name: string; phone_whatsapp: string } };
  campaigns: { id: string; title_fr: string; title_en: string; status: string };
};

/** Requête PostgREST correspondant à SubmissionRow. */
export const SUBMISSION_ROW_SELECT =
  '*, ambassadors (code, profiles (first_name, last_name, phone_whatsapp)), campaigns (id, title_fr, title_en, status)';

/** Tableau des soumissions avec validation / rejet (motif obligatoire) / suppression des rejets. */
export async function SubmissionsTable({ rows, showCampaign = true }: { rows: SubmissionRow[]; showCampaign?: boolean }) {
  const [t, ta, tc, locale] = await Promise.all([
    getTranslations('adminAmbassador.submissions'),
    getTranslations('ambassador'),
    getTranslations('common'),
    getLocale(),
  ]);
  const l = locale as Locale;
  if (rows.length === 0) return <p className="card text-muted">{t('empty')}</p>;

  // État de paiement des ID validés (payé = réception confirmée par l'ambassadeur).
  const validatedIds = rows.filter((r) => r.status === 'validated').map((r) => r.id);
  const supabase = await createClient();
  const { data: states } = validatedIds.length
    ? await supabase.from('submission_payment_states').select('submission_id, payment_state').in('submission_id', validatedIds)
    : { data: [] };
  const paymentState = new Map((states ?? []).map((s) => [s.submission_id as string, s.payment_state as PaymentState]));

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t('ambassador')}</th>
            {showCampaign && <th>{t('campaign')}</th>}
            <th>{t('binanceUid')}</th>
            <th className="text-right">{t('volume')}</th>
            <th>{t('submittedAt')}</th>
            <th>{tc('status')}</th>
            <th>{tc('actions')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const p = s.ambassadors.profiles;
            const open = s.campaigns.status === 'launched';
            return (
              <tr key={s.id}>
                <td>
                  <span className="font-mono text-xs font-semibold">{s.ambassadors.code}</span>
                  <span className="block">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="block text-xs text-muted">{p.phone_whatsapp}</span>
                </td>
                {showCampaign && (
                  <td>
                    <Link href={`/admin/ambassador/campaigns/${s.campaigns.id}`} className="link">
                      {localized(l, s.campaigns.title_fr, s.campaigns.title_en)}
                    </Link>
                  </td>
                )}
                <td className="font-mono">{s.binance_uid}</td>
                <td className="text-right whitespace-nowrap">{formatNumber(s.trading_volume, l)}</td>
                <td className="whitespace-nowrap">{formatDate(s.created_at, l, true)}</td>
                <td>
                  <StatusBadge tone={s.status}>{ta(`status.${s.status}`)}</StatusBadge>
                  {s.status === 'validated' && (
                    <>
                      <span className="block text-xs text-muted">{formatXAF(s.amount, l)}</span>
                      {paymentState.get(s.id) && <PaymentBadge state={paymentState.get(s.id)!} label={ta(`paymentState.${paymentState.get(s.id)}`)} />}
                    </>
                  )}
                  {s.status === 'rejected' && s.reject_reason && (
                    <span className="block max-w-56 text-xs whitespace-normal text-muted">{s.reject_reason}</span>
                  )}
                </td>
                <td className="min-w-56">
                  {s.status === 'pending' && open && (
                    <div className="space-y-2">
                      <ActionForm action={validateSubmission}>
                        <input type="hidden" name="id" value={s.id} />
                        <button type="submit" className="btn-primary min-h-9 w-full py-1">
                          {t('validate')}
                        </button>
                      </ActionForm>
                      <details>
                        <summary className="btn-outline min-h-9 w-full cursor-pointer list-none py-1 text-error [&::-webkit-details-marker]:hidden">
                          {t('reject')}
                        </summary>
                        <ActionForm action={rejectSubmission} className="mt-2 space-y-2">
                          <input type="hidden" name="id" value={s.id} />
                          <input
                            name="reason"
                            required
                            minLength={3}
                            maxLength={500}
                            placeholder={t('reasonPlaceholder')}
                            aria-label={t('reasonPlaceholder')}
                            className="input min-h-9 py-1 text-sm"
                          />
                          <button type="submit" className="btn-danger min-h-9 w-full py-1">
                            {t('reject')}
                          </button>
                        </ActionForm>
                      </details>
                    </div>
                  )}
                  {s.status === 'rejected' && (
                    <ActionForm action={deleteRejectedSubmission} confirm={t('deleteConfirm')} confirmLabel={t('delete')} danger>
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn-ghost min-h-9 px-2 text-xs text-error">
                        {t('delete')}
                      </button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
