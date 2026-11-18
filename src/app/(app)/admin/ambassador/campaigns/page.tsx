import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { LinkButton, TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type Campaign } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Campagnes' };

const PAGE_SIZE = 20;

interface Stats {
  campaign_id: string;
  views: number;
  participants: number;
  pending: number;
  due: number;
}

export default async function AdminCampaignsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const { page } = await searchParams;
  const [t, tc, ta, td, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.campaigns'),
    getTranslations('common'),
    getTranslations('ambassador'),
    getTranslations('adminAmbassador.detail'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;
  const { from, to, current } = pageRange(page, PAGE_SIZE);

  const { data, count } = await supabase
    .from('campaigns')
    .select('id, title_fr, title_en, status, amount_per_account, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  const campaigns = (data ?? []) as Campaign[];

  const { data: statsData } = campaigns.length
    ? await supabase
        .from('campaign_stats')
        .select('campaign_id, views, participants, pending, due')
        .in(
          'campaign_id',
          campaigns.map((c) => c.id),
        )
    : { data: [] };
  const stats = new Map(((statsData ?? []) as Stats[]).map((s) => [s.campaign_id, s]));

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <LinkButton href="/admin/ambassador/campaigns/new" variant="contained" startIcon={<Plus aria-hidden size={18} />}>
            {t('new')}
          </LinkButton>
        }
      />
      {campaigns.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('campaign'), tc('status'), t('amount'), t('views'), t('participants'), t('pending'), td('due'), t('created')]}>
          {campaigns.map((c) => {
            const s = stats.get(c.id);
            const p = num(s?.pending);
            return (
              <TableRow key={c.id} hover>
                <TableCell>
                  <TextLink href={`/admin/ambassador/campaigns/${c.id}`} sx={{ fontWeight: 500 }}>
                    {localized(l, c.title_fr, c.title_en)}
                  </TextLink>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={c.status}>{ta(`campaignStatus.${c.status}`)}</StatusBadge>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(c.amount_per_account, l)}</TableCell>
                <TableCell>{num(s?.views)}</TableCell>
                <TableCell>{num(s?.participants)}</TableCell>
                <TableCell sx={p > 0 ? { fontWeight: 700, color: 'warning.main' } : undefined}>{p}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(num(s?.due), l)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.created_at, l)}</TableCell>
              </TableRow>
            );
          })}
        </TableCard>
      )}
      <Pagination basePath="/admin/ambassador/campaigns" current={current} total={count ?? 0} pageSize={PAGE_SIZE} />
    </>
  );
}
