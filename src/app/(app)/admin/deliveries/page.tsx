import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Envois' };

const STATUS_TONE: Record<string, BadgeTone> = {
  pending: 'pending',
  sent: 'validated',
  failed: 'rejected',
  skipped: 'neutral',
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
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[tc('date'), t('channel'), tc('status'), t('attempts'), 'Notification', t('error')]}>
          {rows.map((d) => (
            <TableRow key={d.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(d.created_at, locale as Locale, true)}</TableCell>
              <TableCell>{d.channel}</TableCell>
              <TableCell>
                <StatusBadge tone={STATUS_TONE[d.status] ?? 'neutral'}>{t.has(`statuses.${d.status}`) ? t(`statuses.${d.status}`) : d.status}</StatusBadge>
              </TableCell>
              <TableCell>{d.attempts}</TableCell>
              <TableCell sx={{ fontSize: '0.75rem' }}>
                {d.notification?.title}
                <Typography variant="caption" component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                  {d.notification?.profiles?.email}
                </Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'error.main' }}>{d.last_error ?? ''}</TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
      <Pagination basePath="/admin/deliveries" current={current} total={count ?? 0} pageSize={50} />
    </>
  );
}
