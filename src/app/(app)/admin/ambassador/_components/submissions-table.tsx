import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ActionForm } from '@/components/forms/action-form';
import { TextField } from '@/components/forms/fields';
import { StatusBadge } from '@/components/status-badge';
import { PaymentBadge, type PaymentState } from '@/components/payment-badge';
import { Collapsible } from '@/components/ui/collapsible';
import { TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import type { Submission } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';
import { deleteRejectedSubmission, rejectSubmission, validateSubmission } from '../actions';

export type SubmissionRow = Submission & {
  ambassadors: { code: string; profiles: { first_name: string; last_name: string; phone_whatsapp: string } };
  campaigns: { id: string; title_fr: string; title_en: string; status: string };
};

/** Requête PostgREST correspondant à SubmissionRow. */
export const SUBMISSION_ROW_SELECT = '*, ambassadors (code, profiles (first_name, last_name, phone_whatsapp)), campaigns (id, title_fr, title_en, status)';

/** Tableau des soumissions avec validation / rejet (motif obligatoire) / suppression des rejets. */
export async function SubmissionsTable({ rows, showCampaign = true }: { rows: SubmissionRow[]; showCampaign?: boolean }) {
  const [t, ta, tc, locale] = await Promise.all([getTranslations('adminAmbassador.submissions'), getTranslations('ambassador'), getTranslations('common'), getLocale()]);
  const l = locale as Locale;
  if (rows.length === 0) return <EmptyCard>{t('empty')}</EmptyCard>;

  // État de paiement des ID validés (payé = réception confirmée par l'ambassadeur).
  const validatedIds = rows.filter((r) => r.status === 'validated').map((r) => r.id);
  const supabase = await createClient();
  const { data: states } = validatedIds.length
    ? await supabase.from('submission_payment_states').select('submission_id, payment_state').in('submission_id', validatedIds)
    : { data: [] };
  const paymentState = new Map((states ?? []).map((s) => [s.submission_id as string, s.payment_state as PaymentState]));

  const head = [t('ambassador'), ...(showCampaign ? [t('campaign')] : []), t('binanceUid'), t('volume'), t('submittedAt'), tc('status'), tc('actions')];

  return (
    <TableCard head={head}>
      {rows.map((s) => {
        const p = s.ambassadors.profiles;
        const open = s.campaigns.status === 'launched';
        const ps = paymentState.get(s.id);
        return (
          <TableRow key={s.id} hover>
            <TableCell>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                {s.ambassadors.code}
              </Typography>
              <Typography variant="body2">
                {p.first_name} {p.last_name}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {p.phone_whatsapp}
              </Typography>
            </TableCell>
            {showCampaign && (
              <TableCell>
                <TextLink href={`/admin/ambassador/campaigns/${s.campaigns.id}`}>{localized(l, s.campaigns.title_fr, s.campaigns.title_en)}</TextLink>
              </TableCell>
            )}
            <TableCell sx={{ fontFamily: 'monospace' }}>{s.binance_uid}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatNumber(s.trading_volume, l)}</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(s.created_at, l, true)}</TableCell>
            <TableCell>
              <StatusBadge tone={s.status}>{ta(`status.${s.status}`)}</StatusBadge>
              {s.status === 'validated' && (
                <>
                  <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                    {formatXAF(s.amount, l)}
                  </Typography>
                  {ps && <PaymentBadge state={ps} label={ta(`paymentState.${ps}`)} />}
                </>
              )}
              {s.status === 'rejected' && s.reject_reason && (
                <Typography variant="caption" component="p" sx={{ maxWidth: 224, color: 'text.secondary' }}>
                  {s.reject_reason}
                </Typography>
              )}
            </TableCell>
            <TableCell sx={{ minWidth: 224 }}>
              {s.status === 'pending' && open && (
                <Box sx={{ display: 'grid', gap: 2 }}>
                  <ActionForm action={validateSubmission}>
                    <input type="hidden" name="id" value={s.id} />
                    <Button type="submit" variant="contained" fullWidth size="small">
                      {t('validate')}
                    </Button>
                  </ActionForm>
                  <Collapsible kind="dangerButton" summary={t('reject')}>
                    <ActionForm action={rejectSubmission} style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                      <input type="hidden" name="id" value={s.id} />
                      <TextField name="reason" label={t('reasonPlaceholder')} required minLength={3} maxLength={500} size="small" />
                      <Button type="submit" variant="contained" color="error" fullWidth size="small">
                        {t('reject')}
                      </Button>
                    </ActionForm>
                  </Collapsible>
                </Box>
              )}
              {s.status === 'rejected' && (
                <ActionForm action={deleteRejectedSubmission} confirm={t('deleteConfirm')} confirmLabel={t('delete')} danger>
                  <input type="hidden" name="id" value={s.id} />
                  <Button type="submit" size="small" color="error">
                    {t('delete')}
                  </Button>
                </ActionForm>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </TableCard>
  );
}
