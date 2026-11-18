import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page-header';
import { LinkStat } from '@/components/ui/link-stat';
import { LinkCardArea } from '@/components/ui/links';
import { ListCard, SectionTitle } from '@/components/ui/section-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type Campaign } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'CSC Ambassador — Administration' };

export default async function AdminAmbassadorOverview() {
  await requireAdmin();
  const [t, ta, locale, supabase] = await Promise.all([getTranslations('adminAmbassador.overview'), getTranslations('ambassador'), getLocale(), createClient()]);
  const l = locale as Locale;
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [ambassadors, active, launched, pending, unconfirmed, totals, recent, failedDeliveries] = await Promise.all([
    count(supabase.from('ambassadors').select('user_id', { count: 'exact', head: true })),
    count(supabase.from('ambassadors').select('user_id', { count: 'exact', head: true }).eq('status', 'active')),
    count(supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('status', 'launched')),
    count(supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(supabase.from('payouts').select('id', { count: 'exact', head: true }).is('confirmed_at', null)),
    // Agrégats calculés par Postgres (aucun solde stocké).
    supabase.from('ambassador_program_totals').select('due, paid').single(),
    supabase.from('campaigns').select('id, title_fr, title_en, status, created_at').order('created_at', { ascending: false }).limit(6),
    count(supabase.from('ambassador_delivery_queue').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
  ]);

  const totalDue = num(totals.data?.due);
  const totalPaid = num(totals.data?.paid);

  const stats = [
    { label: t('ambassadors'), value: String(ambassadors), hint: t('activeCount', { count: active }), href: '/admin/ambassador/ambassadors' },
    { label: t('launched'), value: String(launched), href: '/admin/ambassador/campaigns' },
    { label: t('pending'), value: String(pending), alert: pending > 0, href: '/admin/ambassador/submissions?status=pending' },
    { label: t('totalDue'), value: formatXAF(totalDue, l), alert: totalDue > 0, href: '/admin/ambassador/campaigns' },
    { label: t('totalPaid'), value: formatXAF(totalPaid, l), href: '/admin/ambassador/payouts' },
    { label: t('unconfirmed'), value: String(unconfirmed), href: '/admin/ambassador/payouts?filter=unconfirmed' },
    { label: t('failedDeliveries'), value: String(failedDeliveries), alert: failedDeliveries > 0, href: '/admin/ambassador/queue?status=failed' },
  ];

  const exports = [
    { kind: 'submissions', label: t('exportSubmissions') },
    { kind: 'balances', label: t('exportBalances') },
    { kind: 'payouts', label: t('exportPayouts') },
    { kind: 'ambassadors', label: t('exportAmbassadors') },
  ];

  return (
    <>
      <PageHeader title={t('title')} />
      <Grid container spacing={4} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {stats.map((s) => (
          <Grid item xs={6} lg={4} key={s.label} component="li">
            <LinkStat {...s} />
          </Grid>
        ))}
      </Grid>

      <Box component="section" aria-labelledby="exports-title" sx={{ mt: 10 }}>
        <SectionTitle id="exports-title">{t('exports')}</SectionTitle>
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {exports.map((e) => (
            <li key={e.kind}>
              <Button href={`/admin/ambassador/export/${e.kind}`} download variant="outlined" startIcon={<Download aria-hidden size={18} />}>
                {e.label}
              </Button>
            </li>
          ))}
        </Box>
      </Box>

      <Box component="section" aria-labelledby="recent-title" sx={{ mt: 10 }}>
        <SectionTitle id="recent-title">{t('recentCampaigns')}</SectionTitle>
        <ListCard>
          {((recent.data ?? []) as Campaign[]).map((c) => (
            <li key={c.id}>
              <LinkCardArea href={`/admin/ambassador/campaigns/${c.id}`} sx={{ p: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                <span>
                  <Typography component="span" sx={{ display: 'block', fontWeight: 500 }}>
                    {localized(l, c.title_fr, c.title_en)}
                  </Typography>
                  <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatDate(c.created_at, l)}
                  </Typography>
                </span>
                <StatusBadge tone={c.status}>{ta(`campaignStatus.${c.status}`)}</StatusBadge>
              </LinkCardArea>
            </li>
          ))}
        </ListCard>
      </Box>
    </>
  );
}
