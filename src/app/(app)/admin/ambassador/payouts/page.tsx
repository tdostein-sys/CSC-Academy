import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { FilterPills } from '@/components/ui/filter-pills';
import { TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import type { Payout } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Paiements' };

const PAGE_SIZE = 30;

type Row = Payout & {
  campaigns: { id: string; title_fr: string; title_en: string };
  ambassadors: { code: string; profiles: { first_name: string; last_name: string } };
};

export default async function AdminPayoutsPage({ searchParams }: { searchParams: Promise<{ filter?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [t, to, ts, tc, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.payout'),
    getTranslations('adminAmbassador.overview'),
    getTranslations('adminAmbassador.submissions'),
    getTranslations('common'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;
  const unconfirmedOnly = sp.filter === 'unconfirmed';
  const { from, to: end, current } = pageRange(sp.page, PAGE_SIZE);

  let query = supabase
    .from('payouts')
    .select('*, campaigns (id, title_fr, title_en), ambassadors (code, profiles (first_name, last_name))', { count: 'exact' })
    .order('paid_at', { ascending: false })
    .range(from, end);
  if (unconfirmedOnly) query = query.is('confirmed_at', null);
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={String(count ?? 0)}
        actions={
          <Button href="/admin/ambassador/export/payouts" download variant="outlined" startIcon={<Download aria-hidden size={18} />}>
            {to('exportPayouts')}
          </Button>
        }
      />
      <Box sx={{ mb: 4 }}>
        <FilterPills
          label={t('title')}
          items={[
            { key: 'all', href: '/admin/ambassador/payouts', label: t('filterAll'), active: !unconfirmedOnly },
            { key: 'unconfirmed', href: '/admin/ambassador/payouts?filter=unconfirmed', label: t('filterUnconfirmed'), active: unconfirmedOnly },
          ]}
        />
      </Box>
      {rows.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('paidAt'), tc('status'), ts('ambassador'), ts('campaign'), t('amount'), t('method'), t('reference')]}>
          {rows.map((p) => (
            <TableRow key={p.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(p.paid_at, l, true)}</TableCell>
              <TableCell>
                {p.confirmed_at ? (
                  <StatusBadge tone="validated">
                    {t('confirmed')} · {formatDate(p.confirmed_at, l)}
                  </StatusBadge>
                ) : (
                  <StatusBadge tone="pending">{t('notConfirmed')}</StatusBadge>
                )}
              </TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {p.ambassadors.code}
                </Typography>
                <Typography variant="body2">
                  {p.ambassadors.profiles.first_name} {p.ambassadors.profiles.last_name}
                </Typography>
              </TableCell>
              <TableCell>
                <TextLink href={`/admin/ambassador/campaigns/${p.campaigns.id}`}>{localized(l, p.campaigns.title_fr, p.campaigns.title_en)}</TextLink>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatXAF(p.amount, l)}</TableCell>
              <TableCell>{payoutMethodLabel(p.method, l)}</TableCell>
              <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.reference || '—'}</TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
      <Pagination basePath="/admin/ambassador/payouts" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ filter: unconfirmedOnly ? 'unconfirmed' : undefined }} />
    </>
  );
}
