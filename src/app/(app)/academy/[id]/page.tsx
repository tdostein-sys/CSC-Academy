import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, CalendarDays, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { ActionForm } from '@/components/forms/action-form';
import { TextField } from '@/components/forms/fields';
import { Markdown } from '@/components/markdown';
import { StatusBadge } from '@/components/status-badge';
import { Notice } from '@/components/ui/notice';
import { LinkButton, TextLink } from '@/components/ui/links';
import { SectionCard } from '@/components/ui/section-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { COURSE_COLUMNS, SESSION_COLUMNS, UUID, num, type Course, type Installment, type Session, type SessionOverview } from '@/lib/academy/types';
import { REFERRAL_CODE } from '@/lib/validation/academy';
import type { Locale } from '@/lib/types';
import { enrollInSession } from '../actions';

export const metadata: Metadata = { title: 'Formation' };

export default async function CoursePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ref?: string }> }) {
  const [{ id }, { ref }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, locale, supabase, user] = await Promise.all([getTranslations('academy'), getLocale(), createClient(), getSessionUser()]);
  const l = locale as Locale;

  const { data } = await supabase.from('academy_courses').select(COURSE_COLUMNS).eq('id', id).maybeSingle();
  if (!data) notFound();
  const course = data as Course;

  const [{ data: sessionsData }, { data: overviewData }, myEnrollments] = await Promise.all([
    supabase.from('academy_sessions').select(SESSION_COLUMNS).eq('course_id', id).order('starts_on'),
    supabase.from('academy_session_overview').select('*').eq('course_id', id),
    user
      ? supabase.from('academy_enrollments').select('id, session_id').eq('student_id', user.id).neq('status', 'cancelled')
      : Promise.resolve({ data: [] as { id: string; session_id: string }[] }),
  ]);
  const enrolledBySession = new Map(((myEnrollments.data ?? []) as { id: string; session_id: string }[]).map((e) => [e.session_id, e.id]));
  // Sessions affichées : ouvertes aux inscriptions, ou celles où l'utilisateur est inscrit.
  const sessions = ((sessionsData ?? []) as Session[]).filter((s) => s.enrollment_open || enrolledBySession.has(s.id));
  const overview = new Map(((overviewData ?? []) as SessionOverview[]).map((o) => [o.session_id, o]));

  const { data: instData } = sessions.length
    ? await supabase.from('academy_installments').select('*').in('session_id', sessions.map((s) => s.id)).order('rank')
    : { data: [] };
  const installments = (instData ?? []) as Installment[];

  const profileComplete = Boolean(user && user.profile.first_name.trim() && user.profile.last_name.trim() && user.profile.phone_whatsapp.trim());
  const referral = ref && REFERRAL_CODE.test(ref.toUpperCase()) ? ref.toUpperCase() : '';
  const program = localized(l, course.program_fr, course.program_en);

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href="/academy" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
          {t('back')}
        </LinkButton>
        <StatusBadge tone="primary">{t(`level.${course.level}`)}</StatusBadge>
        <Typography variant="h4" component="h1" sx={{ mt: 2, fontWeight: 700 }}>
          {localized(l, course.title_fr, course.title_en)}
        </Typography>
        <Typography sx={{ mt: 2, color: 'text.secondary', maxWidth: 760 }}>{localized(l, course.summary_fr, course.summary_en)}</Typography>
      </Box>

      <SectionCard id="sessions-title" title={t('sessions')} subtitle={t('noRefund')}>
        {sessions.length === 0 ? (
          <Typography sx={{ color: 'text.secondary' }}>{t('noSessions')}</Typography>
        ) : (
          <Stack spacing={4}>
            {sessions.map((s) => {
              const o = overview.get(s.id);
              const remaining = num(o?.remaining);
              const plan = installments.filter((i) => i.session_id === s.id);
              const enrollmentId = enrolledBySession.get(s.id);
              return (
                <Card key={s.id} variant="outlined" sx={{ boxShadow: 'none' }}>
                  <CardContent sx={{ display: 'grid', gap: 4, gridTemplateColumns: { md: '1fr 1fr' } }}>
                    <Box>
                      <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                        {localized(l, s.label_fr, s.label_en)}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                        <CalendarDays aria-hidden size={16} />
                        {t('dates', { start: formatDate(s.starts_on, l), end: formatDate(s.ends_on, l) })}
                      </Typography>
                      {s.trainer_name && (
                        <Typography variant="body2" sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1.5, color: 'text.secondary' }}>
                          <UserRound aria-hidden size={16} />
                          {t('trainer', { name: s.trainer_name })}
                        </Typography>
                      )}
                      <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.25rem' }}>{formatXAF(num(o?.price), l)}</Typography>
                        <StatusBadge tone={remaining > 0 ? 'active' : 'rejected'}>{t('seatsLeft', { count: remaining })}</StatusBadge>
                      </Box>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2" component="h4" sx={{ mb: 2 }}>
                        {t('schedule')}
                      </Typography>
                      <Box component="ol" sx={{ m: 0, pl: 5, display: 'grid', gap: 1 }}>
                        {plan.map((i) => (
                          <li key={i.rank}>
                            <Typography variant="body2">
                              <strong>{formatXAF(i.amount, l)}</strong> {t('dueOn', { date: formatDate(i.due_on, l) })}
                            </Typography>
                          </li>
                        ))}
                      </Box>
                    </Box>

                    <Box sx={{ gridColumn: { md: '1 / -1' } }}>
                      {enrollmentId ? (
                        <Notice tone="success" action={<TextLink href={`/student/${enrollmentId}`}>{t('openMySpace')}</TextLink>}>
                          {t('alreadyEnrolled')}
                        </Notice>
                      ) : !s.enrollment_open ? (
                        <StatusBadge tone="neutral">{t('closed')}</StatusBadge>
                      ) : remaining <= 0 ? (
                        <StatusBadge tone="rejected">{t('full')}</StatusBadge>
                      ) : !user ? (
                        <LinkButton href={`/auth/login?next=${encodeURIComponent(`/academy/${id}${referral ? `?ref=${referral}` : ''}`)}`} variant="contained">
                          {t('loginToEnroll')}
                        </LinkButton>
                      ) : !profileComplete ? (
                        <Notice tone="warning" action={<TextLink href="/profile">{t('completeProfileCta')}</TextLink>}>
                          {t('completeProfile')}
                        </Notice>
                      ) : (
                        <ActionForm
                          action={enrollInSession}
                          confirm={t('enrollConfirm', { amount: formatXAF(plan[0]?.amount ?? 0, l) })}
                          confirmTitle={t('enroll')}
                          confirmLabel={t('enroll')}
                          style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' }}
                        >
                          <input type="hidden" name="session_id" value={s.id} />
                          <Box sx={{ flex: '1 1 260px', maxWidth: 360 }}>
                            <TextField
                              name="referral_code"
                              label={t('referralCode')}
                              hint={t('referralHint')}
                              defaultValue={referral}
                              optionalLabel
                              autoCapitalize="characters"
                              maxLength={20}
                              size="small"
                            />
                          </Box>
                          <Button type="submit" variant="contained" size="large">
                            {t('enroll')}
                          </Button>
                        </ActionForm>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        )}
      </SectionCard>

      {program.trim() && (
        <SectionCard id="program-title" title={t('program')}>
          <Markdown source={program} />
        </SectionCard>
      )}
    </Stack>
  );
}
