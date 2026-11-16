import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
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
        .in('campaign_id', campaigns.map((c) => c.id))
    : { data: [] };
  const stats = new Map(((statsData ?? []) as Stats[]).map((s) => [s.campaign_id, s]));

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <Link href="/admin/ambassador/campaigns/new" className="btn-primary">
            <Plus aria-hidden className="size-4" />
            {t('new')}
          </Link>
        }
      />
      {campaigns.length === 0 ? (
        <p className="card text-muted">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('campaign')}</th>
                <th>{tc('status')}</th>
                <th className="text-right">{t('amount')}</th>
                <th className="text-right">{t('views')}</th>
                <th className="text-right">{t('participants')}</th>
                <th className="text-right">{t('pending')}</th>
                <th className="text-right">{td('due')}</th>
                <th>{t('created')}</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const s = stats.get(c.id);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/ambassador/campaigns/${c.id}`} className="link">
                        {localized(l, c.title_fr, c.title_en)}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge tone={c.status}>{ta(`campaignStatus.${c.status}`)}</StatusBadge>
                    </td>
                    <td className="text-right whitespace-nowrap">{formatXAF(c.amount_per_account, l)}</td>
                    <td className="text-right">{num(s?.views)}</td>
                    <td className="text-right">{num(s?.participants)}</td>
                    <td className={`text-right ${num(s?.pending) > 0 ? 'font-bold text-warning' : ''}`}>{num(s?.pending)}</td>
                    <td className="text-right whitespace-nowrap">{formatXAF(num(s?.due), l)}</td>
                    <td className="whitespace-nowrap">{formatDate(c.created_at, l)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/admin/ambassador/campaigns" current={current} total={count ?? 0} pageSize={PAGE_SIZE} />
    </>
  );
}
