import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Paiements des formations' };

const PAGE_SIZE = 30;

interface Row {
  id: string;
  amount: number;
  provider: 'manual' | 'notchpay';
  status: 'pending' | 'confirmed' | 'failed';
  method: string;
  reference: string;
  paid_on: string;
  created_at: string;
  academy_enrollments: {
    session_id: string;
    profiles: { first_name: string; last_name: string } | null;
    academy_sessions: { label_fr: string; label_en: string; academy_courses: { title_fr: string; title_en: string } } | null;
  } | null;
}

const STATUS_TONE = { confirmed: 'validated', pending: 'pending', failed: 'rejected' } as const;

export default async function AdminAcademyPaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const { page } = await searchParams;
  const [t, locale, supabase] = await Promise.all([getTranslations('adminAcademy.payments'), getLocale(), createClient()]);
  const l = locale as Locale;
  const { from, to, current } = pageRange(page, PAGE_SIZE);

  const { data, count } = await supabase
    .from('academy_payments')
    .select(
      'id, amount, provider, status, method, reference, paid_on, created_at, academy_enrollments (session_id, profiles (first_name, last_name), academy_sessions (label_fr, label_en, academy_courses (title_fr, title_en)))',
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {rows.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('paidOn'), t('student'), t('course'), t('amount'), t('method'), t('reference'), t('status')]}>
          {rows.map((r) => {
            const e = r.academy_enrollments;
            const sess = e?.academy_sessions;
            return (
              <TableRow key={r.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.paid_on, l)}</TableCell>
                <TableCell>{e?.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : '—'}</TableCell>
                <TableCell>
                  {sess && e && (
                    <TextLink href={`/admin/academy/sessions/${e.session_id}`}>
                      {localized(l, sess.academy_courses.title_fr, sess.academy_courses.title_en)} — {localized(l, sess.label_fr, sess.label_en)}
                    </TextLink>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatXAF(r.amount, l)}</TableCell>
                <TableCell>
                  {payoutMethodLabel(r.method, l)}
                  {r.provider !== 'manual' && (
                    <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                      {t('online')}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{r.reference || '—'}</TableCell>
                <TableCell>
                  <StatusBadge tone={STATUS_TONE[r.status]}>{t(`statusLabel.${r.status}`)}</StatusBadge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableCard>
      )}
      <Pagination basePath="/admin/academy/payments" current={current} total={count ?? 0} pageSize={PAGE_SIZE} />
    </>
  );
}
