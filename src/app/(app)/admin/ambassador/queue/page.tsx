import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { RefreshCw, Send } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField } from '@/components/forms/fields';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge, type BadgeTone } from '@/components/status-badge';
import { Notice } from '@/components/ui/notice';
import { LinkStat } from '@/components/ui/link-stat';
import { SearchForm } from '@/components/ui/search-form';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
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

export default async function DeliveryQueuePage({ searchParams }: { searchParams: Promise<{ status?: string; type?: string; q?: string; page?: string }> }) {
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

  let query = supabase.from('ambassador_delivery_queue').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  if (search) {
    const s = search.replace(/[%_,()\\]/g, ' ');
    query = query.or(`email.ilike.%${s}%,first_name.ilike.%${s}%,last_name.ilike.%${s}%,ambassador_code.ilike.%${s}%,title.ilike.%${s}%`);
  }

  const [pending, sent, failed, skipped, { data, count: total }] = await Promise.all([count('pending'), count('sent'), count('failed'), count('skipped'), query]);
  const rows = (data ?? []) as QueueRow[];
  const counters: { key: Status; value: number }[] = [
    { key: 'pending', value: pending },
    { key: 'sent', value: sent },
    { key: 'failed', value: failed },
    { key: 'skipped', value: skipped },
  ];
  const cronConfigured = Boolean(process.env.CRON_SECRET);
  const emailMode = process.env.EMAIL_PROVIDER || 'console';
  const typeLabel = (x: string) => {
    const key = `types.${x.replace('.', '_')}`;
    return t.has(key) ? t(key) : x;
  };

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
              <Button type="submit" variant="contained" startIcon={<Send aria-hidden size={18} />}>
                {t('processNow')}
              </Button>
            </ActionForm>
            {failed > 0 && (
              <ActionForm action={retryDeliveries} confirm={t('retryAllConfirm', { count: failed })} confirmLabel={t('retry')}>
                <Button type="submit" variant="outlined" startIcon={<RefreshCw aria-hidden size={18} />}>
                  {t('retryAll', { count: failed })}
                </Button>
              </ActionForm>
            )}
          </>
        }
      />

      {/* Avertissements de configuration */}
      {(emailMode === 'console' || !cronConfigured) && (
        <Stack spacing={3} sx={{ mb: 4 }}>
          {emailMode === 'console' && (
            <Notice tone="warning" role="alert">
              {t('consoleMode')}
            </Notice>
          )}
          {!cronConfigured && <Notice tone="info">{t('noCron', { max: MAX_DELIVERY_ATTEMPTS })}</Notice>}
        </Stack>
      )}

      {/* Compteurs = filtres rapides */}
      <Grid container spacing={3} component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mb: 4 }}>
        {counters.map((c) => (
          <Grid item xs={6} sm={3} key={c.key} component="li">
            <LinkStat
              href={href({ status: status === c.key ? null : c.key, page: null })}
              label={td(`statuses.${c.key}`)}
              value={String(c.value)}
              alert={(c.key === 'failed' && c.value > 0) || status === c.key}
            />
          </Grid>
        ))}
      </Grid>

      <SearchForm defaultValue={search} placeholder={t('searchPlaceholder')} label={tc('search')}>
        {status && <input type="hidden" name="status" value={status} />}
        <Box sx={{ width: { xs: '100%', sm: 260 } }}>
          <SelectField name="type" label={t('type')} size="small" defaultValue={type ?? ''} options={[{ value: '', label: t('allTypes') }, ...TYPES.map((x) => ({ value: x, label: typeLabel(x) }))]} />
        </Box>
      </SearchForm>

      {rows.length === 0 ? (
        <EmptyCard>{td('empty')}</EmptyCard>
      ) : (
        <TableCard head={[tc('date'), t('recipient'), t('message'), td('channel'), tc('status'), td('attempts'), td('error'), tc('actions')]}>
          {rows.map((d) => (
            <TableRow key={d.id} hover>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(d.created_at, l, true)}</TableCell>
              <TableCell>
                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {d.ambassador_code}
                </Typography>
                <Typography variant="body2">
                  {d.first_name} {d.last_name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {d.email}
                </Typography>
              </TableCell>
              <TableCell sx={{ maxWidth: 256 }}>
                <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                  {typeLabel(d.type)}
                </Typography>
                {d.title}
                {d.read_at && (
                  <Typography variant="caption" component="p" sx={{ color: 'success.main' }}>
                    {t('readInApp')}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{d.channel === 'email' ? t('email') : 'WhatsApp'}</TableCell>
              <TableCell>
                <StatusBadge tone={TONE[d.status]}>{td(`statuses.${d.status}`)}</StatusBadge>
                <Typography variant="caption" component="p" sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  {d.status === 'sent' && d.sent_at && formatDate(d.sent_at, l, true)}
                  {d.status === 'pending' && t('nextAttempt', { date: formatDate(d.next_attempt_at, l, true) })}
                </Typography>
              </TableCell>
              <TableCell>
                {d.attempts}/{MAX_DELIVERY_ATTEMPTS}
              </TableCell>
              <TableCell sx={{ maxWidth: 224, fontSize: '0.75rem', color: 'error.main' }}>{d.last_error ?? ''}</TableCell>
              <TableCell>
                {d.status === 'failed' && (
                  <ActionForm action={retryDeliveries}>
                    <input type="hidden" name="id" value={d.id} />
                    <Button type="submit" variant="outlined" size="small">
                      {t('retry')}
                    </Button>
                  </ActionForm>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
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
