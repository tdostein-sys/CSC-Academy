import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, Download, Eye, Lock, Rocket, Trash2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { SectionCard, SectionTitle } from '@/components/ui/section-card';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { CAMPAIGN_COLUMNS, num, type Campaign, type CampaignBalance } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { closeCampaign, deleteCampaign, launchCampaign, updateCampaign } from '../../actions';
import { CampaignForm } from '../campaign-form';
import { SUBMISSION_ROW_SELECT, SubmissionsTable, type SubmissionRow } from '../../_components/submissions-table';
import { PayoutForm } from '../../_components/payout-form';

export const metadata: Metadata = { title: 'Campagne' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Stats {
  views: number;
  participants: number;
  declined: number;
  pending: number;
  validated: number;
  rejected: number;
  earned: number;
  paid: number;
  due: number;
  unconfirmed_payouts: number;
}

export default async function AdminCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; status?: string; untranslated?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, tf, ta, tp, tc, tt, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.detail'),
    getTranslations('adminAmbassador.form'),
    getTranslations('ambassador'),
    getTranslations('adminAmbassador.payout'),
    getTranslations('common'),
    getTranslations('translation'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;

  const { data } = await supabase.from('campaigns').select(CAMPAIGN_COLUMNS).eq('id', id).maybeSingle();
  if (!data) notFound();
  const c = data as Campaign;

  const statusFilter = ['pending', 'validated', 'rejected'].includes(sp.status ?? '') ? sp.status! : null;
  let subsQuery = supabase.from('submissions').select(SUBMISSION_ROW_SELECT).eq('campaign_id', id).order('created_at', { ascending: false }).limit(200);
  if (statusFilter) subsQuery = subsQuery.eq('status', statusFilter);

  const [statsRes, subsRes, balRes] = await Promise.all([
    supabase.from('campaign_stats').select('*').eq('campaign_id', id).single(),
    subsQuery,
    supabase.from('ambassador_campaign_balances').select('*').eq('campaign_id', id).order('due', { ascending: false }),
  ]);
  const s = (statsRes.data ?? {}) as Partial<Stats>;
  const submissions = (subsRes.data ?? []) as unknown as SubmissionRow[];
  const balances = (balRes.data ?? []) as CampaignBalance[];

  const ambIds = balances.map((b) => b.ambassador_id);
  const { data: ambData } = ambIds.length
    ? await supabase.from('ambassadors').select('user_id, code, profiles (first_name, last_name, phone_whatsapp)').in('user_id', ambIds)
    : { data: [] };
  const ambassadors = new Map(
    ((ambData ?? []) as unknown as { user_id: string; code: string; profiles: { first_name: string; last_name: string; phone_whatsapp: string } }[]).map((a) => [a.user_id, a]),
  );

  const fileName = c.modop_file_path?.split('/').pop() ?? null;
  const pending = num(s.pending);
  const due = num(s.due);
  const unconfirmed = num(s.unconfirmed_payouts);
  // Miroir de la règle SQL (close_campaign), qui reste la garantie côté serveur.
  const canClose = c.status === 'launched' && pending === 0 && due === 0 && unconfirmed === 0;

  const statItems = [
    { label: t('views'), value: num(s.views) },
    { label: t('participants'), value: num(s.participants) },
    { label: t('declined'), value: num(s.declined) },
    { label: t('pending'), value: pending, alert: pending > 0 },
    { label: t('validated'), value: num(s.validated) },
    { label: t('rejected'), value: num(s.rejected) },
  ];
  const moneyItems = [
    { label: t('earned'), value: formatXAF(num(s.earned), l) },
    { label: t('paid'), value: formatXAF(num(s.paid), l) },
    { label: t('due'), value: formatXAF(due, l), alert: due > 0 },
  ];

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href="/admin/ambassador/campaigns" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
          {t('back')}
        </LinkButton>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}>
          <Box>
            <StatusBadge tone={c.status}>{ta(`campaignStatus.${c.status}`)}</StatusBadge>
            <Typography variant="h5" component="h1" sx={{ mt: 2, fontWeight: 700 }}>
              {localized(l, c.title_fr, c.title_en)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {t('frozenInfo', {
                amount: formatXAF(c.amount_per_account, l),
                volume: c.min_volume !== null ? `${formatNumber(c.min_volume, l)} USDT` : t('noMinimum'),
              })}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {c.launched_at && `${ta('campaignStatus.launched')} : ${formatDate(c.launched_at, l, true)}`}
              {c.closed_at && ` · ${ta('campaignStatus.closed')} : ${formatDate(c.closed_at, l, true)}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {c.status !== 'draft' && (
              <LinkButton href={`/ambassador/campaigns/${c.id}`} target="_blank" variant="outlined" startIcon={<Eye aria-hidden size={18} />}>
                {t('preview')}
              </LinkButton>
            )}
            <Button href={`/admin/ambassador/export/submissions?campaign=${c.id}`} download variant="outlined" startIcon={<Download aria-hidden size={18} />}>
              {t('export')}
            </Button>
          </Box>
        </Box>
      </Box>

      {sp.created && c.status === 'draft' && <Notice tone="success">{tf('created')}</Notice>}
      {sp.untranslated && <Notice tone="warning">{tt('untranslatedBanner')}</Notice>}

      {/* Actions de cycle de vie */}
      {c.status === 'draft' && (
        <Card>
          <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('launchRequirements')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, flexShrink: 0 }}>
              <ActionForm action={launchCampaign} confirm={t('launchConfirm')} confirmTitle={t('launch')} confirmLabel={t('launch')}>
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" variant="contained" startIcon={<Rocket aria-hidden size={18} />}>
                  {t('launch')}
                </Button>
              </ActionForm>
              <ActionForm action={deleteCampaign} confirm={t('deleteConfirm')} confirmTitle={t('delete')} confirmLabel={t('delete')} danger>
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" variant="outlined" color="error" startIcon={<Trash2 aria-hidden size={18} />}>
                  {t('delete')}
                </Button>
              </ActionForm>
            </Box>
          </CardContent>
        </Card>
      )}

      {c.status === 'launched' && (
        <Card sx={canClose ? { border: 1, borderColor: 'success.main' } : undefined}>
          <CardContent>
            <Box sx={{ mb: 4 }}>
              {canClose ? (
                <Notice tone="success">{t('readyToClose')}</Notice>
              ) : (
                <Notice tone="warning" title={t('blockers')}>
                  <Box component="ul" sx={{ m: 0, pl: 5 }}>
                    {pending > 0 && <li>{t('blockerPending', { count: pending })}</li>}
                    {due > 0 && <li>{t('blockerDue', { amount: formatXAF(due, l) })}</li>}
                    {unconfirmed > 0 && <li>{t('blockerUnconfirmed', { count: unconfirmed })}</li>}
                  </Box>
                </Notice>
              )}
            </Box>
            {/* Bouton grisé tant qu'une condition manque ; la base refuse de toute façon une clôture non conforme. */}
            <ActionForm action={closeCampaign} confirm={t('closeConfirm')} confirmTitle={t('close')} confirmLabel={t('close')}>
              <input type="hidden" name="id" value={c.id} />
              <Button type="submit" variant="contained" disabled={!canClose} aria-describedby={canClose ? undefined : 'close-hint'} startIcon={<Lock aria-hidden size={18} />}>
                {t('close')}
              </Button>
              {!canClose && (
                <Typography id="close-hint" variant="caption" component="p" sx={{ mt: 2, color: 'text.secondary' }}>
                  {t('closeDisabledHint')}
                </Typography>
              )}
            </ActionForm>
          </CardContent>
        </Card>
      )}

      {/* Statistiques */}
      {c.status !== 'draft' && (
        <Box component="section" aria-labelledby="stats-title">
          <SectionTitle id="stats-title">{t('stats')}</SectionTitle>
          <Grid container spacing={3} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {statItems.map((it) => (
              <Grid item xs={4} lg={2} key={it.label} component="li">
                <MiniStat label={it.label} value={String(it.value)} alert={it.alert} />
              </Grid>
            ))}
            {moneyItems.map((it) => (
              <Grid item xs={12} sm={4} key={it.label} component="li">
                <MiniStat label={it.label} value={it.value} alert={it.alert} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Soumissions */}
      {c.status !== 'draft' && (
        <Box component="section" aria-labelledby="subs-title">
          <SectionTitle
            id="subs-title"
            aside={
              <Box component="nav" aria-label={t('submissions')} sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {[null, 'pending', 'validated', 'rejected'].map((st) => {
                  const active = statusFilter === st;
                  return (
                    <LinkButton
                      key={st ?? 'all'}
                      href={`/admin/ambassador/campaigns/${c.id}${st ? `?status=${st}` : ''}`}
                      size="small"
                      variant={active ? 'contained' : 'text'}
                      aria-current={active ? 'page' : undefined}
                      sx={{ borderRadius: 999 }}
                    >
                      {st ? ta(`status.${st}`) : tc('seeAll')}
                    </LinkButton>
                  );
                })}
              </Box>
            }
          >
            {t('submissions')}
          </SectionTitle>
          <SubmissionsTable rows={submissions} showCampaign={false} />
        </Box>
      )}

      {/* Soldes et paiements */}
      {c.status !== 'draft' && (
        <Box component="section" aria-labelledby="bal-title">
          <SectionTitle id="bal-title">{t('balances')}</SectionTitle>
          {balances.length === 0 ? (
            <EmptyCard>{t('noBalances')}</EmptyCard>
          ) : (
            <TableCard head={[ta('badge'), tp('earned'), tp('paid'), tp('confirmed'), tp('due'), tc('actions')]}>
              {balances.map((b) => {
                const a = ambassadors.get(b.ambassador_id);
                return (
                  <TableRow key={b.ambassador_id} hover>
                    <TableCell>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {a?.code}
                      </Typography>
                      <Typography variant="body2">
                        {a?.profiles.first_name} {a?.profiles.last_name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {a?.profiles.phone_whatsapp}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(b.earned, l)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(b.paid, l)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {formatXAF(b.confirmed, l)}
                      {b.unconfirmed_count > 0 && (
                        <Typography variant="caption" component="p" sx={{ color: 'warning.main' }}>
                          {ta('paymentState.awaiting_confirmation')}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600, color: b.due > 0 ? 'warning.main' : 'success.main' }}>{formatXAF(b.due, l)}</TableCell>
                    <TableCell sx={{ minWidth: 200 }}>{b.due > 0 && <PayoutForm campaignId={c.id} ambassadorId={b.ambassador_id} due={b.due} />}</TableCell>
                  </TableRow>
                );
              })}
            </TableCard>
          )}
        </Box>
      )}

      {/* Contenu */}
      {c.status !== 'closed' && (
        <SectionCard id="edit-title" title={tf('editTitle')}>
          <CampaignForm action={updateCampaign} campaign={c} fileName={fileName} />
        </SectionCard>
      )}
    </Stack>
  );
}

function MiniStat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <Card sx={{ height: '100%', ...(alert && { border: 1, borderColor: 'warning.main' }) }}>
      <CardContent sx={{ p: { xs: 3, sm: 4 }, '&:last-child': { pb: { xs: 3, sm: 4 } } }}>
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          {label}
        </Typography>
        <Typography variant="h5" component="p" sx={{ fontWeight: 700, color: alert ? 'warning.main' : 'text.primary' }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
