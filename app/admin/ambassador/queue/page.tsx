import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Info, RefreshCw, Search, Send } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { formatDate } from '@/lib/format';
import { MAX_DELIVERY_ATTEMPTS } from '@/lib/notifications/retry';
import type { Locale } from '@/lib/types';
import { processQueue, retryDeliveries } from '../actions';

export const metadata: Metadata = { title: "File d'envoi" };

const PAGE_SIZE = 40;
const STATUSES = ['pending', 'sent', 'failed', 'skipped'] as const;
type Status = (typeof STATUSES)[number];
const TONE: Record<Status, BadgeTone> = { pending: 'pending', sent: 'validated', failed: 'rejected', skipped: 'neutral' };
const TYPES = [
  'campaign.launched',
  'campaign.closed',
  'submission.validated',
  'submission.rejected',
  'payout.marked_paid',
  'ambassador.joined',
  'ambassador.suspended',
  'ambassador.reactivated',
] as const;

interface QueueRow {
  id: string;
  channel: string;
  status: Status;
  attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  sent_at: string | null;
  created_at: string;
  type: string;
  title: string;
  read_at: string | null;
  ambassador_code: string;
  first_name: string;
  last_name: string;
  email: string;
}

export default async function DeliveryQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const [t, td, tc, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.queue'),
    getTranslations('admin.deliveries'),
    getTranslations('common'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;
  const status = STATUSES.find((s) => s === sp.status) ?? null;
  const type = TYPES.find((x) => x === sp.type) ?? null;
  const search = sp.q?.trim().slice(0, 60) || undefined;
  const { from, to, current } = pageRange(sp.page, PAGE_SIZE);

  // Compteurs par statut (toute la file des ambassadeurs).
  const count = (s: Status) =>
    supabase
      .from('ambassador_delivery_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', s)
      .then((r) => r.count ?? 0);

  let query = supabase
    .from('ambassador_delivery_queue')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  if (search) {
    const s = search.replace(/[%_,()\\]/g, ' ');
    query = query.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,ambassador_code.ilike.%${s}%,title.ilike.%${s}%`);
  }

  const [pending, sent, failed, skipped, { data, count: total }] = await Promise.all([
    count('pending'),
    count('sent'),
    count('failed'),
    count('skipped'),
    query,
  ]);
  const rows = (data ?? []) as QueueRow[];
  const counters: { key: Status; value: number }[] = [
    { key: 'pending', value: pending },
    { key: 'sent', value: sent },
    { key: 'failed', value: failed },
    { key: 'skipped', value: skipped },
  ];
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const emailMode = process.env.EMAIL_PROVIDER || 'console';

  const href = (params: Record<string, string | null | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, type, q: search, ...params };
    Object.entries(merged).forEach(([k, v]) => v && p.set(k, v));
    const qs = p.toString();
    return `/admin/ambassador/queue${qs ? `?${qs}` : ''}`;
  };

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <>
            <ActionForm action={processQueue}>
              <button type="submit" className="btn-primary">
                <Send aria-hidden className="size-4" />
                {t('processNow')}
              </button>
            </ActionForm>
            {failed > 0 && (
              <ActionForm action={retryDeliveries} confirm={t('retryAllConfirm', { count: failed })} confirmLabel={t('retry')}>
                <button type="submit" className="btn-outline">
                  <RefreshCw aria-hidden className="size-4" />
                  {t('retryAll', { count: failed })}
                </button>
              </ActionForm>
            )}
          </>
        }
      />

      {/* Avertissements de configuration */}
      {emailMode === 'console' && (
        <p role="alert" className="mb-4 flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('consoleMode')}
        </p>
      )}
      {!cronConfigured && (
        <p className="mb-4 flex gap-2 rounded-lg bg-info-soft p-3 text-sm text-info">
          <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('noCron', { max: MAX_DELIVERY_ATTEMPTS })}
        </p>
      )}

      {/* Compteurs = filtres rapides */}
      <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {counters.map((c) => (
          <li key={c.key}>
            <Link
              href={href({ status: status === c.key ? null : c.key, page: null })}
              aria-current={status === c.key ? 'page' : undefined}
              className={`card block p-3 transition-colors hover:border-primary sm:p-4 ${status === c.key ? 'border-primary' : ''}`}
            >
              <p className="text-xs text-muted">{td(`statuses.${c.key}`)}</p>
              <p className={`text-2xl font-bold ${c.key === 'failed' && c.value > 0 ? 'text-error' : ''}`}>{c.value}</p>
            </Link>
          </li>
        ))}
      </ul>

      <form role="search" className="mb-4 flex flex-col gap-2 sm:flex-row">
        {status && <input type="hidden" name="status" value={status} />}
        <select name="type" defaultValue={type ?? ''} aria-label={t('type')} className="input sm:max-w-xs">
          <option value="">{t('allTypes')}</option>
          {TYPES.map((x) => (
            <option key={x} value={x}>
              {t(`types.${x.replace('.', '_')}`)}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={search} placeholder={t('searchPlaceholder')} aria-label={tc('search')} className="input" />
        <button type="submit" className="btn-outline" aria-label={tc('search')}>
          <Search aria-hidden className="size-4" />
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="card text-muted">{td('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{tc('date')}</th>
                <th>{t('recipient')}</th>
                <th>{t('message')}</th>
                <th>{td('channel')}</th>
                <th>{tc('status')}</th>
                <th className="text-right">{td('attempts')}</th>
                <th>{td('error')}</th>
                <th>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{formatDate(d.created_at, l, true)}</td>
                  <td>
                    <span className="font-mono text-xs font-semibold">{d.ambassador_code}</span>
                    <span className="block">
                      {d.first_name} {d.last_name}
                    </span>
                    <span className="block text-xs text-muted">{d.email}</span>
                  </td>
                  <td className="max-w-64 whitespace-normal">
                    <span className="block text-xs text-muted">
                      {t.has(`types.${d.type.replace('.', '_')}`) ? t(`types.${d.type.replace('.', '_')}`) : d.type}
                    </span>
                    {d.title}
                    {d.read_at && <span className="block text-xs text-success">{t('readInApp')}</span>}
                  </td>
                  <td>{d.channel === 'email' ? t('email') : 'WhatsApp'}</td>
                  <td>
                    <StatusBadge tone={TONE[d.status]}>{td(`statuses.${d.status}`)}</StatusBadge>
                    <span className="block text-xs whitespace-nowrap text-muted">
                      {d.status === 'sent' && d.sent_at && formatDate(d.sent_at, l, true)}
                      {d.status === 'pending' && t('nextAttempt', { date: formatDate(d.next_attempt_at, l, true) })}
                    </span>
                  </td>
                  <td className="text-right">
                    {d.attempts}/{MAX_DELIVERY_ATTEMPTS}
                  </td>
                  <td className="max-w-56 text-xs whitespace-normal text-error">{d.last_error ?? ''}</td>
                  <td>
                    {d.status === 'failed' && (
                      <ActionForm action={retryDeliveries}>
                        <input type="hidden" name="id" value={d.id} />
                        <button type="submit" className="btn-outline min-h-9 py-1">
                          {t('retry')}
                        </button>
                      </ActionForm>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        basePath="/admin/ambassador/queue"
        current={current}
        total={total ?? 0}
        pageSize={PAGE_SIZE}
        params={{ status: status ?? undefined, type: type ?? undefined, q: search }}
      />
    </>
  );
}
