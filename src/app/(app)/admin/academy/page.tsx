import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { LinkStat } from '@/components/ui/link-stat';
import { LinkButton, TextLink } from '@/components/ui/links';
import { ListCard, SectionTitle } from '@/components/ui/section-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, upcomingMeetingsSince, type EnrollmentBalance, type Meeting } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'CSC Academy — Administration' };

export default async function AdminAcademyOverview() {
  await requireAdmin();
  const [t, locale, supabase] = await Promise.all([getTranslations('adminAcademy.overview'), getLocale(), createClient()]);
  const l = locale as Locale;
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [published, openSessions, pending, active, balancesRes, meetingsRes, commissionsRes] = await Promise.all([
    count(supabase.from('academy_courses').select('id', { count: 'exact', head: true }).eq('status', 'published')),
    count(supabase.from('academy_sessions').select('id', { count: 'exact', head: true }).eq('enrollment_open', true)),
    count(supabase.from('academy_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(supabase.from('academy_enrollments').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    supabase.from('academy_enrollment_balances').select('paid, remaining, overdue_count, blocked_since').neq('status', 'cancelled'),
    supabase
      .from('academy_meetings')
      .select('id, session_id, title_fr, title_en, starts_at, duration_minutes')
      .gte('starts_at', upcomingMeetingsSince())
      .order('starts_at')
      .limit(6),
    supabase.from('academy_commissions').select('due').gt('due', 0),
  ]);
  const balances = (balancesRes.data ?? []) as Pick<EnrollmentBalance, 'paid' | 'remaining' | 'overdue_count' | 'blocked_since'>[];
  const collected = balances.reduce((a, b) => a + num(b.paid), 0);
  const remaining = balances.reduce((a, b) => a + num(b.remaining), 0);
  const overdue = balances.filter((b) => num(b.overdue_count) > 0).length;
  const blocked = balances.filter((b) => b.blocked_since).length;
  const commissionsDue = (commissionsRes.data ?? []).reduce((a, c) => a + num(c.due), 0);
  const meetings = (meetingsRes.data ?? []) as Meeting[];

  const stats = [
    { label: t('courses'), value: String(published), href: '/admin/academy/courses' },
    { label: t('openSessions'), value: String(openSessions), href: '/admin/academy/courses' },
    { label: t('pending'), value: String(pending), alert: pending > 0, href: '/admin/academy/enrollments?status=pending' },
    { label: t('active'), value: String(active), href: '/admin/academy/enrollments?status=active' },
    { label: t('collected'), value: formatXAF(collected, l), href: '/admin/academy/payments' },
    { label: t('remaining'), value: formatXAF(remaining, l), href: '/admin/academy/enrollments' },
    { label: t('overdue'), value: String(overdue), alert: overdue > 0, href: '/admin/academy/enrollments?status=overdue' },
    { label: t('blocked'), value: String(blocked), alert: blocked > 0, href: '/admin/academy/enrollments?status=blocked' },
    { label: t('commissionsDue'), value: formatXAF(commissionsDue, l), alert: commissionsDue > 0, href: '/admin/academy/commissions' },
  ];

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <LinkButton href="/admin/academy/courses/new" variant="contained" startIcon={<Plus aria-hidden size={18} />}>
            {t('newCourse')}
          </LinkButton>
        }
      />
      <Grid container spacing={4} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {stats.map((s) => (
          <Grid item xs={6} lg={4} key={s.label} component="li">
            <LinkStat {...s} />
          </Grid>
        ))}
      </Grid>

      <Box component="section" aria-labelledby="upcoming-title" sx={{ mt: 10 }}>
        <SectionTitle id="upcoming-title">{t('upcoming')}</SectionTitle>
        {meetings.length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {t('noUpcoming')}
          </Typography>
        ) : (
          <ListCard>
            {meetings.map((m) => (
              <Box component="li" key={m.id} sx={{ px: 5, py: 3, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
                <TextLink href={`/admin/academy/sessions/${m.session_id}`} sx={{ fontWeight: 500 }}>
                  {localized(l, m.title_fr, m.title_en)}
                </TextLink>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {formatDate(m.starts_at, l, true)}
                </Typography>
              </Box>
            ))}
          </ListCard>
        )}
      </Box>
    </>
  );
}
