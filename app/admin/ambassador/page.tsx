import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type Campaign } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'CSC Ambassador — Administration' };

export default async function AdminAmbassadorOverview() {
  await requireAdmin();
  const [t, ta, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.overview'),
    getTranslations('ambassador'),
    getLocale(),
    createClient(),
  ]);
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
    {
      label: t('failedDeliveries'),
      value: String(failedDeliveries),
      alert: failedDeliveries > 0,
      href: '/admin/ambassador/queue?status=failed',
    },
  ];

  const exports = [
    { kind: 'submissions', label: t('exportSubmissions') },
    { kind: 'balances', label: t('exportBalances') },
    { kind: 'payouts', label: t('exportPayouts') },
    { kind: 'ambassadors', label: t('exportAmbassadors') },
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t('title')}</h1>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="card block h-full transition-colors hover:border-primary">
              <p className="text-sm text-muted">{s.label}</p>
              <p className={`mt-1 text-2xl font-bold sm:text-3xl ${s.alert ? 'text-error' : ''}`}>{s.value}</p>
              {s.hint && <p className="text-xs text-muted">{s.hint}</p>}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-lg font-semibold">{t('exports')}</h2>
      <ul className="flex flex-wrap gap-2">
        {exports.map((e) => (
          <li key={e.kind}>
            <a href={`/admin/ambassador/export/${e.kind}`} className="btn-outline" download>
              <Download aria-hidden className="size-4" />
              {e.label}
            </a>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-lg font-semibold">{t('recentCampaigns')}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {((recent.data ?? []) as Campaign[]).map((c) => (
          <li key={c.id}>
            <Link href={`/admin/ambassador/campaigns/${c.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-surface-2">
              <span>
                <span className="font-medium">{localized(l, c.title_fr, c.title_en)}</span>
                <span className="block text-xs text-muted">{formatDate(c.created_at, l)}</span>
              </span>
              <StatusBadge tone={c.status}>{ta(`campaignStatus.${c.status}`)}</StatusBadge>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
