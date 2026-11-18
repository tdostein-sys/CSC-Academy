import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { ThemedIllustration } from '@/components/themed-illustration';
import { StatusBadge } from '@/components/status-badge';
import { LinkButton, LinkCardArea } from '@/components/ui/links';
import { formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type Course, type SessionOverview } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'CSC Academy' };

/** Catalogue des formations publiées, avec les sessions ouvertes aux inscriptions. */
export default async function AcademyPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const [{ ref }, t, locale, supabase, user] = await Promise.all([
    searchParams,
    getTranslations('academy'),
    getLocale(),
    createClient(),
    getSessionUser(),
  ]);
  const l = locale as Locale;

  const [{ data: coursesData }, { data: sessionsData }, { data: overviewData }] = await Promise.all([
    supabase.from('academy_courses').select('id, title_fr, title_en, summary_fr, summary_en, level').eq('status', 'published').order('created_at', { ascending: false }),
    supabase.from('academy_sessions').select('id, course_id').eq('enrollment_open', true),
    supabase.from('academy_session_overview').select('session_id, course_id, price, remaining'),
  ]);
  const courses = (coursesData ?? []) as Pick<Course, 'id' | 'title_fr' | 'title_en' | 'summary_fr' | 'summary_en' | 'level'>[];
  const openSessions = new Set((sessionsData ?? []).map((s) => s.id as string));
  const overview = ((overviewData ?? []) as SessionOverview[]).filter((o) => openSessions.has(o.session_id));
  const refQuery = ref ? `?ref=${encodeURIComponent(ref)}` : '';

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          user ? (
            <LinkButton href="/student" variant="outlined">
              {t('mySpace')}
            </LinkButton>
          ) : undefined
        }
      />
      {courses.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
            <ThemedIllustration name="girl-with-laptop" width={260} />
            <Typography sx={{ color: 'text.secondary' }}>{t('empty')}</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={6}>
          {courses.map((c) => {
            const sessions = overview.filter((o) => o.course_id === c.id);
            const prices = sessions.map((s) => num(s.price)).filter((p) => p > 0);
            const minPrice = prices.length ? Math.min(...prices) : null;
            return (
              <Grid item xs={12} md={6} xl={4} key={c.id}>
                <Card sx={{ height: '100%' }}>
                  <LinkCardArea href={`/academy/${c.id}${refQuery}`} sx={{ height: '100%' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <StatusBadge tone="primary">{t(`level.${c.level}`)}</StatusBadge>
                        <StatusBadge tone={sessions.length ? 'active' : 'neutral'}>{t('sessionsCount', { count: sessions.length })}</StatusBadge>
                      </Box>
                      <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                        {localized(l, c.title_fr, c.title_en)}
                      </Typography>
                      <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
                        {localized(l, c.summary_fr, c.summary_en)}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
                        {minPrice !== null ? (
                          <Typography sx={{ fontWeight: 700 }}>{t('from', { price: formatXAF(minPrice, l) })}</Typography>
                        ) : (
                          <span />
                        )}
                        <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {t('details')} →
                        </Typography>
                      </Box>
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
