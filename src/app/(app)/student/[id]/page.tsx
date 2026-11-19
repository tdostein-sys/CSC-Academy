import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, Award, ClipboardCheck, Download, ExternalLink, FileText, Link2, Lock, Mail, MessageCircle, ShieldCheck, Video } from 'lucide-react';
import { whatsappLink } from '@/lib/contact';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { Markdown } from '@/components/markdown';
import { StatusBadge } from '@/components/status-badge';
import { VideoEmbed } from '@/components/video-embed';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { ListCard, SectionCard, SectionTitle } from '@/components/ui/section-card';
import { TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { parseVideoUrl } from '@/lib/video';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { displayTone, enrollmentDisplay, installmentTone } from '@/lib/academy/display';
import {
  ENROLLMENT_COLUMNS,
  RECORDING_COLUMNS,
  UUID,
  meetingWindow,
  num,
  type Attempt,
  type Certificate,
  type Enrollment,
  type EnrollmentBalance,
  type Evaluation,
  type InstallmentStateRow,
  type Meeting,
  type Payment,
  type Recording,
  type Resource,
} from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { formatDuration, formatSize, replayListState } from '@/lib/academy/live-shared';
import { cancelMyEnrollment } from '../../academy/actions';
import { ReplayAction } from '../replays/replay-action';

export const metadata: Metadata = { title: 'Ma formation' };

interface SessionRow {
  label_fr: string;
  label_en: string;
  payment_instructions_fr: string;
  payment_instructions_en: string;
  trainer_name: string;
  starts_on: string;
  ends_on: string;
  academy_courses: { id: string; title_fr: string; title_en: string };
}

export default async function StudentEnrollmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enrolled?: string; evaluated?: string }>;
}) {
  const user = await requireUser('/student');
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, ta, tc, locale, supabase] = await Promise.all([
    getTranslations('student'),
    getTranslations('academy'),
    getTranslations('contact'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;

  const { data } = await supabase.from('academy_enrollments').select(ENROLLMENT_COLUMNS).eq('id', id).eq('student_id', user.id).maybeSingle();
  if (!data) notFound();
  const e = data as Enrollment;

  const [sessionRes, balRes, statesRes, paymentsRes, meetingsRes, resourcesRes, evalRes, attemptsRes, certRes, recordingsRes] = await Promise.all([
    supabase
      .from('academy_sessions')
      .select('label_fr, label_en, payment_instructions_fr, payment_instructions_en, trainer_name, starts_on, ends_on, academy_courses (id, title_fr, title_en)')
      .eq('id', e.session_id)
      .single(),
    supabase.from('academy_enrollment_balances').select('*').eq('enrollment_id', id).maybeSingle(),
    supabase.from('academy_installment_states').select('*').eq('enrollment_id', id).order('rank'),
    supabase.from('academy_payments').select('*').eq('enrollment_id', id).eq('status', 'confirmed').order('paid_on', { ascending: false }),
    // RLS : séances et ressources ne sont renvoyées qu'aux inscrits actifs.
    supabase.from('academy_meetings').select('*').eq('session_id', e.session_id).order('starts_at'),
    supabase.from('academy_resources').select('*').eq('session_id', e.session_id).order('created_at'),
    // Évaluation finale (hors brouillon), mes copies et mon attestation.
    supabase.from('academy_evaluations').select('*').eq('session_id', e.session_id).maybeSingle(),
    supabase.from('academy_evaluation_attempts').select('id, attempt_no, score, max_score, percent, passed, submitted_at').eq('enrollment_id', id).order('attempt_no'),
    supabase.from('academy_certificates').select('*').eq('enrollment_id', id).maybeSingle(),
    // RLS : enregistrements prêts et non expirés, réservés aux inscrits actifs non bloqués.
    supabase.from('academy_recordings').select(RECORDING_COLUMNS).eq('session_id', e.session_id).order('started_at', { ascending: false }),
  ]);
  const s = sessionRes.data as unknown as SessionRow | null;
  if (!s) notFound();
  const b = balRes.data as EnrollmentBalance | null;
  const states = (statesRes.data ?? []) as InstallmentStateRow[];
  const payments = (paymentsRes.data ?? []) as Payment[];
  const meetings = (meetingsRes.data ?? []) as Meeting[];
  const resources = (resourcesRes.data ?? []) as Resource[];
  const evaluation = evalRes.data as Evaluation | null;
  const attempts = (attemptsRes.data ?? []) as Attempt[];
  const certificate = certRes.data as Certificate | null;
  const recordings = (recordingsRes.data ?? []) as Recording[];
  // Mes visionnages en cours ou terminés (un seul par replay, hors réinitialisation).
  const { data: viewRows } = recordings.length
    ? await supabase
        .from('academy_replay_views')
        .select('recording_id, expires_at')
        .eq('user_id', user.id)
        .is('reset_at', null)
        .in('recording_id', recordings.map((r) => r.id))
    : { data: [] };
  const myViews = new Map(((viewRows ?? []) as { recording_id: string; expires_at: string }[]).map((v) => [v.recording_id, v]));
  const { data: replaySettings } = recordings.length ? await supabase.from('academy_replay_settings').select('view_hours').maybeSingle() : { data: null };
  const replayHours = Number((replaySettings as { view_hours: number } | null)?.view_hours ?? 2);
  const replayLabels = {
    watch: t('watchReplay'),
    resume: t('replayResume'),
    watched: t('replayWatched'),
    confirm: t('replayConfirm', { hours: replayHours }),
    confirmTitle: t('watchReplay'),
  };
  const meetingTitle = new Map(meetings.map((m) => [m.id, localized(l, m.title_fr, m.title_en)]));

  const courseTitle = localized(l, s.academy_courses.title_fr, s.academy_courses.title_en);
  const display = enrollmentDisplay(e.status, b);
  const blocked = display === 'blocked';
  const overdue = display === 'overdue';
  const passedAttempt = attempts.find((a) => a.passed);
  const canTakeEvaluation =
    e.status === 'active' && !blocked && evaluation?.status === 'open' && !passedAttempt && attempts.length < num(evaluation.max_attempts);
  const instructions = localized(l, s.payment_instructions_fr, s.payment_instructions_en);
  const firstUnpaid = states.find((st) => st.state !== 'paid');
  // Contact pour le paiement : WhatsApp de CSC avec un message déjà écrit.
  const { data: contact } = num(b?.remaining) > 0 ? await supabase.from('contact_settings').select('whatsapp').maybeSingle() : { data: null };
  const paymentWhatsapp = whatsappLink(
    (contact as { whatsapp: string } | null)?.whatsapp,
    tc('whatsappPayment', {
      name: `${user.profile.first_name} ${user.profile.last_name}`.trim() || '…',
      course: `${courseTitle} — ${localized(l, s.label_fr, s.label_en)}`,
    }),
  );
  const documents = resources.filter((r) => r.kind === 'document');
  const links = resources.filter((r) => r.kind === 'link');
  const videos = resources.filter((r) => r.kind === 'video');

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href="/student" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
          {t('back')}
        </LinkButton>
        <StatusBadge tone={displayTone(display)}>{ta(`status.${display}`)}</StatusBadge>
        <Typography variant="h5" component="h1" sx={{ mt: 2, fontWeight: 700 }}>
          {courseTitle}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {localized(l, s.label_fr, s.label_en)} · {ta('dates', { start: formatDate(s.starts_on, l), end: formatDate(s.ends_on, l) })}
          {s.trainer_name && ` · ${ta('trainer', { name: s.trainer_name })}`}
        </Typography>
      </Box>

      {sp.enrolled && <Notice tone="success">{t('enrolledNotice')}</Notice>}
      {e.status === 'cancelled' && <Notice tone="info">{t('cancelledInfo')}</Notice>}
      {overdue && <Notice tone="error">{t('overdueNotice')}</Notice>}
      {blocked && b?.blocked_since && (
        <Notice tone="error" title={t('blockedTitle')}>
          {t('blockedBody', { date: formatDate(b.blocked_since, l) })}
        </Notice>
      )}
      {sp.evaluated === 'passed' && <Notice tone="success">{t('evaluation.passedNotice')}</Notice>}
      {sp.evaluated === 'failed' && <Notice tone="warning">{t('evaluation.failedNotice')}</Notice>}

      {e.status !== 'cancelled' && num(b?.remaining) > 0 && (
        <SectionCard
          id="pay-title"
          title={e.status === 'pending' ? t('pendingTitle') : t('paymentInstructions')}
          highlight={e.status === 'pending'}
          subtitle={
            e.status === 'pending' && e.hold_expires_at
              ? t('pendingBody', { date: formatDate(e.hold_expires_at, l, true), amount: formatXAF(firstUnpaid ? num(firstUnpaid.amount) - num(firstUnpaid.paid_amount) : 0, l) })
              : firstUnpaid
                ? t('nextInstallment', { rank: firstUnpaid.rank, amount: formatXAF(num(firstUnpaid.amount) - num(firstUnpaid.paid_amount), l), date: formatDate(firstUnpaid.due_on, l) })
                : undefined
          }
        >
          <Stack spacing={4}>
            {instructions.trim() ? <Markdown source={instructions} /> : <Typography variant="body2">{t('noInstructions')}</Typography>}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {paymentWhatsapp && (
                <Button href={paymentWhatsapp} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<MessageCircle aria-hidden size={18} />}>
                  {t('payWhatsapp')}
                </Button>
              )}
              <LinkButton href={`/contact?subject=payment&enrollment=${e.id}`} variant={paymentWhatsapp ? 'outlined' : 'contained'} startIcon={<Mail aria-hidden size={18} />}>
                {t('payContact')}
              </LinkButton>
            </Box>
          </Stack>
        </SectionCard>
      )}

      {/* Échéancier */}
      <Box component="section" aria-labelledby="schedule-title">
        <SectionTitle
          id="schedule-title"
          aside={
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('paid')} : <strong>{formatXAF(num(b?.paid), l)}</strong> / {formatXAF(num(b?.price), l)} · {t('remaining')} : <strong>{formatXAF(num(b?.remaining), l)}</strong>
            </Typography>
          }
        >
          {t('schedule')}
        </SectionTitle>
        <TableCard head={[t('installment'), t('amount'), t('dueDate'), t('state')]}>
          {states.map((st) => (
            <TableRow key={st.rank}>
              <TableCell>{ta('installment', { rank: st.rank })}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatXAF(st.amount, l)}
                {st.state === 'partial' && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {t('partialPaid', { amount: formatXAF(st.paid_amount, l) })}
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatDate(st.due_on, l)}
                {st.due_on !== st.original_due_on && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {t('extended')}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge tone={installmentTone(st.state, st.overdue)}>{st.overdue ? ta('installmentState.overdue') : ta(`installmentState.${st.state}`)}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      </Box>

      {payments.length > 0 && (
        <TableCard title={t('payments')} head={[t('date'), t('amount'), t('method'), t('reference')]}>
          {payments.map((p) => (
            <TableRow key={p.id}>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(p.paid_on, l)}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(p.amount, l)}</TableCell>
              <TableCell>{payoutMethodLabel(p.method, l)}</TableCell>
              <TableCell>{p.reference || '—'}</TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}

      {e.status === 'pending' && (
        <Notice tone="info" title={t('lockedTitle')}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Lock aria-hidden size={16} />
            {t('lockedBody')}
          </Box>
        </Notice>
      )}

      {e.status === 'active' && !blocked && (
        <>
          <SectionCard id="meetings-title" title={t('meetings')}>
            {meetings.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('noMeetings')}
              </Typography>
            ) : (
              <Stack spacing={3}>
                {meetings.map((m) => {
                  const w = meetingWindow(m);
                  return (
                    <Box
                      key={m.id}
                      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 3, p: 3, borderRadius: 1, border: 1, borderColor: 'divider', opacity: w === 'past' ? 0.75 : 1 }}
                    >
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>{localized(l, m.title_fr, m.title_en)}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {formatDate(m.starts_at, l, true)} · {t('minutes', { count: m.duration_minutes })}
                        </Typography>
                      </Box>
                      {w === 'past' ? (
                        <StatusBadge tone="neutral">{t('past')}</StatusBadge>
                      ) : w === 'live' && m.external_url ? (
                        <Button href={m.external_url} target="_blank" rel="noopener noreferrer" variant="contained" startIcon={<Video aria-hidden size={18} />}>
                          {t('join')}
                        </Button>
                      ) : w === 'live' ? (
                        <LinkButton href={`/live/${m.id}`} variant="contained" startIcon={<Video aria-hidden size={18} />}>
                          {t('join')}
                        </LinkButton>
                      ) : (
                        <StatusBadge tone="info">{t('upcoming')}</StatusBadge>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            )}
          </SectionCard>

          {recordings.length > 0 && (
            <SectionCard id="replays-title" title={t('replays')} subtitle={t('replaysHint')}>
              <Stack spacing={3}>
                {recordings.map((r) => (
                  <Box
                    key={r.id}
                    sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 3, p: 3, borderRadius: 1, border: 1, borderColor: 'divider' }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 600 }}>{meetingTitle.get(r.meeting_id) ?? t('replay')}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {formatDate(r.started_at, l, true)} · {formatDuration(r.duration_seconds)} · {formatSize(r.size_bytes, l)}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {t('replayUntil', { date: formatDate(r.expires_at, l, true) })}
                      </Typography>
                    </Box>
                    <ReplayAction recordingId={r.id} state={replayListState(myViews.get(r.id))} labels={replayLabels} />
                  </Box>
                ))}
              </Stack>
            </SectionCard>
          )}

          <Box component="section" aria-labelledby="docs-title">
            <SectionTitle id="docs-title">{t('documents')}</SectionTitle>
            {documents.length + links.length === 0 ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('noContent')}
              </Typography>
            ) : (
              <ListCard>
                {documents.map((r) => (
                  <Box component="li" key={r.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, px: 5, py: 3 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <FileText aria-hidden size={18} />
                      {localized(l, r.title_fr, r.title_en)}
                    </Typography>
                    <Button href={`/academy/documents/${r.id}`} target="_blank" rel="noopener" size="small" variant="outlined">
                      {t('download')}
                    </Button>
                  </Box>
                ))}
                {links.map((r) => (
                  <Box component="li" key={r.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, px: 5, py: 3 }}>
                    <Typography sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Link2 aria-hidden size={18} />
                      {localized(l, r.title_fr, r.title_en)}
                    </Typography>
                    <Button href={r.url ?? '#'} target="_blank" rel="noopener noreferrer" size="small" variant="outlined" endIcon={<ExternalLink aria-hidden size={14} />}>
                      {t('openLink')}
                    </Button>
                  </Box>
                ))}
              </ListCard>
            )}
          </Box>

          {videos.length > 0 && (
            <SectionCard id="videos-title" title={t('videos')}>
              <Stack spacing={6}>
                {videos.map((r) => {
                  const v = parseVideoUrl(r.url);
                  const title = localized(l, r.title_fr, r.title_en);
                  return (
                    <Box key={r.id}>
                      <Typography sx={{ mb: 2, fontWeight: 600 }}>{title}</Typography>
                      {v && r.url ? (
                        <VideoEmbed video={v} sourceUrl={r.url} title={title} labels={{ play: t('playVideo'), hint: t('videoDataHint'), open: t('openVideo') }} />
                      ) : null}
                    </Box>
                  );
                })}
              </Stack>
            </SectionCard>
          )}
        </>
      )}

      {/* Évaluation finale et attestation */}
      {e.status === 'active' && evaluation && (
        <SectionCard
          id="evaluation-title"
          title={t('evaluation.title')}
          subtitle={t('evaluation.rules', { mark: num(evaluation.pass_mark), attempts: num(evaluation.max_attempts) })}
          highlight={canTakeEvaluation}
        >
          <Stack spacing={4}>
            {attempts.length > 0 && (
              <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 2 }}>
                {attempts.map((a) => (
                  <Box component="li" key={a.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                    <StatusBadge tone={a.passed ? 'validated' : 'rejected'}>{a.passed ? t('evaluation.passed') : t('evaluation.failed')}</StatusBadge>
                    <Typography variant="body2">
                      {t('evaluation.attemptLine', { no: a.attempt_no, percent: Math.round(num(a.percent)), date: formatDate(a.submitted_at, l, true) })}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}

            {certificate && !certificate.revoked_at ? (
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between', p: 4, borderRadius: 1, bgcolor: 'background.default' }}>
                <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                  <Award aria-hidden size={28} />
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{t('evaluation.certificateReady')}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                      {certificate.number}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Button href={`/student/certificates/${certificate.id}`} variant="contained" startIcon={<Download aria-hidden size={18} />}>
                    {t('evaluation.download')}
                  </Button>
                  <LinkButton href={`/academy/verify?n=${encodeURIComponent(certificate.number)}`} variant="outlined" startIcon={<ShieldCheck aria-hidden size={18} />}>
                    {t('evaluation.verify')}
                  </LinkButton>
                </Box>
              </Box>
            ) : certificate?.revoked_at ? (
              <Notice tone="error">{t('evaluation.certificateRevoked')}</Notice>
            ) : passedAttempt ? (
              <Notice tone="info">{t('evaluation.certificateAfterPayment', { amount: formatXAF(num(b?.remaining), l) })}</Notice>
            ) : canTakeEvaluation ? (
              <Box>
                <LinkButton href={`/student/${e.id}/evaluation`} variant="contained" startIcon={<ClipboardCheck aria-hidden size={18} />}>
                  {attempts.length ? t('evaluation.retry') : t('evaluation.start')}
                </LinkButton>
                <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
                  {t('evaluation.attemptsLeft', { count: num(evaluation.max_attempts) - attempts.length })}
                </Typography>
              </Box>
            ) : blocked ? (
              <Notice tone="warning">{t('evaluation.blocked')}</Notice>
            ) : evaluation.status === 'closed' ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('evaluation.closedInfo')}
              </Typography>
            ) : (
              <Notice tone="warning">{t('evaluation.noAttemptsLeft')}</Notice>
            )}
          </Stack>
        </SectionCard>
      )}

      {e.status === 'pending' && num(b?.paid) === 0 && (
        <Box>
          <ActionForm action={cancelMyEnrollment} confirm={t('cancelConfirm')} confirmTitle={t('cancel')} confirmLabel={t('cancel')} danger>
            <input type="hidden" name="id" value={e.id} />
            <Button type="submit" variant="outlined" color="error">
              {t('cancel')}
            </Button>
          </ActionForm>
        </Box>
      )}
    </Stack>
  );
}
