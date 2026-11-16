import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Envois' };

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-warning-soft text-warning',
  sent: 'bg-success-soft text-success',
  failed: 'bg-error-soft text-error',
  skipped: 'bg-surface-2 text-muted',
};

interface DeliveryRow {
  id: string;
  channel: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  notification: { title: string; profiles: { email: string } | null } | null;
}

export default async function DeliveriesPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const { page } = await searchParams;
  const [t, tc, locale, supabase] = await Promise.all([getTranslations('admin.deliveries'), getTranslations('common'), getLocale(), createClient()]);
  const { from, to, current } = pageRange(page, 50);

  // L'admin lit les envois (RLS) ; les e-mails des destinataires via profiles (RLS admin).
  const { data, count } = await supabase
    .from('notification_deliveries')
    .select('id, channel, status, attempts, last_error, created_at, notification:notification_id (title, profiles:user_id (email))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as unknown as DeliveryRow[];

  return (
    <>
      <PageHeader title={t('title')} />
      {rows.length === 0 ? (
        <p className="card text-muted">{t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{tc('date')}</th>
                <th>{t('channel')}</th>
                <th>{tc('status')}</th>
                <th>{t('attempts')}</th>
                <th>Notification</th>
                <th>{t('error')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{formatDate(d.created_at, locale as Locale, true)}</td>
                  <td>{d.channel}</td>
                  <td>
                    <span className={`badge ${STATUS_STYLE[d.status] ?? ''}`}>{t.has(`statuses.${d.status}`) ? t(`statuses.${d.status}`) : d.status}</span>
                  </td>
                  <td>{d.attempts}</td>
                  <td className="text-xs">
                    {d.notification?.title}
                    <span className="block text-muted">{d.notification?.profiles?.email}</span>
                  </td>
                  <td className="max-w-xs truncate text-xs text-error">{d.last_error ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/admin/deliveries" current={current} total={count ?? 0} pageSize={50} />
    </>
  );
}
