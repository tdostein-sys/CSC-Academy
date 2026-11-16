import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
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
          <a href="/admin/ambassador/export/payouts" className="btn-outline" download>
            <Download aria-hidden className="size-4" />
            {to('exportPayouts')}
          </a>
        }
      />
      <nav className="mb-4 flex gap-1 text-sm" aria-label={t('title')}>
        {[
          { key: 'all', label: t('filterAll'), active: !unconfirmedOnly },
          { key: 'unconfirmed', label: t('filterUnconfirmed'), active: unconfirmedOnly },
        ].map((f) => (
          <Link
            key={f.key}
            href={`/admin/ambassador/payouts${f.key === 'all' ? '' : '?filter=unconfirmed'}`}
            className={`rounded-full px-3 py-1 ${f.active ? 'bg-primary text-primary-fg' : 'bg-surface-2 hover:bg-border'}`}
            aria-current={f.active ? 'page' : undefined}
          >
            {f.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="card text-muted">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('paidAt')}</th>
                <th>{tc('status')}</th>
                <th>{ts('ambassador')}</th>
                <th>{ts('campaign')}</th>
                <th className="text-right">{t('amount')}</th>
                <th>{t('method')}</th>
                <th>{t('reference')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{formatDate(p.paid_at, l, true)}</td>
                  <td>
                    {p.confirmed_at ? (
                      <StatusBadge tone="validated">
                        {t('confirmed')} · {formatDate(p.confirmed_at, l)}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="pending">{t('notConfirmed')}</StatusBadge>
                    )}
                  </td>
                  <td>
                    <span className="font-mono text-xs font-semibold">{p.ambassadors.code}</span>
                    <span className="block">
                      {p.ambassadors.profiles.first_name} {p.ambassadors.profiles.last_name}
                    </span>
                  </td>
                  <td>
                    <Link href={`/admin/ambassador/campaigns/${p.campaigns.id}`} className="link">
                      {localized(l, p.campaigns.title_fr, p.campaigns.title_en)}
                    </Link>
                  </td>
                  <td className="text-right font-semibold whitespace-nowrap">{formatXAF(p.amount, l)}</td>
                  <td>{payoutMethodLabel(p.method, l)}</td>
                  <td className="font-mono text-xs">{p.reference || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/admin/ambassador/payouts"
        current={current}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        params={{ filter: unconfirmedOnly ? 'unconfirmed' : undefined }}
      />
    </>
  );
}
