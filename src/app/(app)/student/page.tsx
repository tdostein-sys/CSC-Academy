import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { Notice } from '@/components/ui/notice';
import { EmptyCard } from '@/components/ui/table-card';
import { LinkButton, LinkCardArea } from '@/components/ui/links';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type EnrollmentBalance } from '@/lib/academy/types';
import { displayTone, enrollmentDisplay } from '@/lib/academy/display';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Mes formations' };

interface Row {
  id: string;
  status: 'pending' | 'active' | 'cancelled';
  hold_expires_at: string | null;
  academy_sessions: { label_fr: string; label_en: string; starts_on: string; ends_on: string; academy_courses: { title_fr: string; title_en: string } };
}

/** Espace étudiant : toutes mes inscriptions (hors annulées). */
export default async function StudentPage({ searchParams }: { searchParams: Promise<{ cancelled?: string }> }) {
  const user = await requireUser('/student');
  const [sp, t, ta, locale, supabase] = await Promise.all([searchParams, getTranslations('student'), getTranslations('academy'), getLocale(), createClient()]);
  const l = locale as Locale;

  const { data } = await supabase
    .from('academy_enrollments')
    .select('id, status, hold_expires_at, academy_sessions (label_fr, label_en, starts_on, ends_on, academy_courses (title_fr, title_en))')
    .eq('student_id', user.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as unknown as Row[];
  const { data: balData } = rows.length
    ? await supabase.from('academy_enrollment_balances').select('*').in('enrollment_id', rows.map((r) => r.id))
    : { data: [] };
  const balances = new Map(((balData ?? []) as EnrollmentBalance[]).map((b) => [b.enrollment_id, b]));

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={<LinkButton href="/academy" variant="outlined">{t('browse')}</LinkButton>} />
      {sp.cancelled && (
        <Box sx={{ mb: 6 }}>
          <Notice tone="success">{t('cancelled')}</Notice>
        </Box>
      )}
      {rows.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <Grid container spacing={6}>
          {rows.map((r) => {
            const b = balances.get(r.id);
            const price = num(b?.price);
            const paid = num(b?.paid);
            const display = enrollmentDisplay(r.status, b);
            const overdue = display === 'overdue' || display === 'blocked';
            const s = r.academy_sessions;
            return (
              <Grid item xs={12} md={6} key={r.id}>
                <Card sx={{ height: '100%' }}>
                  <LinkCardArea href={`/student/${r.id}`} sx={{ height: '100%' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <StatusBadge tone={displayTone(display)}>{ta(`status.${display}`)}</StatusBadge>
                      </Box>
                      <Box>
                        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                          {localized(l, s.academy_courses.title_fr, s.academy_courses.title_en)}
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {localized(l, s.label_fr, s.label_en)} · {ta('dates', { start: formatDate(s.starts_on, l), end: formatDate(s.ends_on, l) })}
                        </Typography>
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1 }}>
                          <Typography variant="body2">
                            {t('paid')} : <strong>{formatXAF(paid, l)}</strong>
                          </Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {formatXAF(price, l)}
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={price > 0 ? Math.min(100, (paid / price) * 100) : 0}
                          aria-label={t('paymentProgress')}
                          sx={{ height: 8, borderRadius: 4 }}
                        />
                      </Box>
                      <Typography variant="body2" sx={{ color: overdue ? 'error.main' : 'text.secondary', fontWeight: overdue ? 600 : 400 }}>
                        {display === 'blocked'
                          ? t('blockedShort')
                          : r.status === 'pending' && r.hold_expires_at
                          ? t('holdUntil', { date: formatDate(r.hold_expires_at, l, true) })
                          : b?.next_due_on
                            ? t('nextDue', { date: formatDate(b.next_due_on, l) })
                            : t('fullyPaid')}
                      </Typography>
                    </CardContent>
                  </LinkCardArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </>
  );
}
