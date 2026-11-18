import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
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
import { displayTone, enrollmentDisplay } from '@/lib/academy/display';
import { num, type EnrollmentBalance } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Inscrits' };

const PAGE_SIZE = 30;
const FILTERS = ['all', 'pending', 'active', 'overdue', 'blocked', 'cancelled'] as const;
type Filter = (typeof FILTERS)[number];

interface Row {
  id: string;
  session_id: string;
  status: 'pending' | 'active' | 'cancelled';
  created_at: string;
  profiles: { first_name: string; last_name: string; phone_whatsapp: string } | null;
  ambassadors: { code: string } | null;
  academy_sessions: { label_fr: string; label_en: string; academy_courses: { title_fr: string; title_en: string } } | null;
}

export default async function AdminEnrollmentsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.status ?? '') ? (sp.status as Filter) : 'all';
  const [t, ta, ts, locale, supabase] = await Promise.all([
    getTranslations('adminAcademy.enrollments'),
    getTranslations('academy'),
    getTranslations('adminAcademy.session'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;
  const { from, to, current } = pageRange(sp.page, PAGE_SIZE);

  // « En retard » : calculé par la vue des soldes (aucun état stocké).
  let overdueIds: string[] | null = null;
  if (filter === 'overdue') {
    const { data } = await supabase.from('academy_enrollment_balances').select('enrollment_id').gt('overdue_count', 0).neq('status', 'cancelled').limit(1000);
    overdueIds = (data ?? []).map((r) => r.enrollment_id as string);
  } else if (filter === 'blocked') {
    const { data } = await supabase.from('academy_enrollment_balances').select('enrollment_id').not('blocked_since', 'is', null).limit(1000);
    overdueIds = (data ?? []).map((r) => r.enrollment_id as string);
  }

  let query = supabase
    .from('academy_enrollments')
    .select(
      'id, session_id, status, created_at, profiles (first_name, last_name, phone_whatsapp), ambassadors (code), academy_sessions (label_fr, label_en, academy_courses (title_fr, title_en))',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  if (filter === 'pending' || filter === 'active' || filter === 'cancelled') query = query.eq('status', filter);
  if (overdueIds) query = query.in('id', overdueIds.length ? overdueIds : ['00000000-0000-0000-0000-000000000000']);

  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];
  const { data: balData } = rows.length ? await supabase.from('academy_enrollment_balances').select('*').in('enrollment_id', rows.map((r) => r.id)) : { data: [] };
  const balances = new Map(((balData ?? []) as EnrollmentBalance[]).map((b) => [b.enrollment_id, b]));

  return (
    <>
      <PageHeader title={t('title')} />
      <FilterPills
        label={t('filter')}
        items={FILTERS.map((f) => ({
          key: f,
          href: f === 'all' ? '/admin/academy/enrollments' : `/admin/academy/enrollments?status=${f}`,
          label: f === 'all' ? t('all') : ta(`status.${f}`),
          active: f === filter,
        }))}
      />
      {rows.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[ts('student'), t('session'), ta('referralCode'), ts('status'), ts('paidCol'), ts('nextDue'), t('created')]}>
          {rows.map((r) => {
            const b = balances.get(r.id);
            const display = enrollmentDisplay(r.status, b);
            const overdue = display === 'overdue' || display === 'blocked';
            const sess = r.academy_sessions;
            return (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {r.profiles?.phone_whatsapp}
                  </Typography>
                </TableCell>
                <TableCell>
                  {sess && (
                    <TextLink href={`/admin/academy/sessions/${r.session_id}`}>
                      {localized(l, sess.academy_courses.title_fr, sess.academy_courses.title_en)} — {localized(l, sess.label_fr, sess.label_en)}
                    </TextLink>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.ambassadors?.code ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge tone={displayTone(display)}>{ta(`status.${display}`)}</StatusBadge>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatXAF(num(b?.paid), l)} / {formatXAF(num(b?.price), l)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', color: overdue ? 'error.main' : undefined }}>
                  {r.status !== 'cancelled' && b?.next_due_on ? formatDate(b.next_due_on, l) : '—'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.created_at, l)}</TableCell>
              </TableRow>
            );
          })}
        </TableCard>
      )}
      <Pagination basePath="/admin/academy/enrollments" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ status: filter === 'all' ? undefined : filter }} />
    </>
  );
}
