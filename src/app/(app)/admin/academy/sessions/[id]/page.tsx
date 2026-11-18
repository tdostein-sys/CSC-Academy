import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, ClipboardCheck, DoorClosed, DoorOpen, ExternalLink, Eye, FileText, Link2, PlayCircle, Trash2, Video } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, TextField } from '@/components/forms/fields';
import { StatusBadge } from '@/components/status-badge';
import { Collapsible } from '@/components/ui/collapsible';
import { Notice } from '@/components/ui/notice';
import { LinkButton, TextLink } from '@/components/ui/links';
import { SectionCard } from '@/components/ui/section-card';
import { TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { StatCard } from '@/components/stat-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { displayTone, enrollmentDisplay } from '@/lib/academy/display';
import {
  RECORDING_COLUMNS,
  SESSION_COLUMNS,
  UUID,
  meetingWindow,
  num,
  type Recording,
  type EnrollmentBalance,
  type Installment,
  type InstallmentStateRow,
  type Meeting,
  type Resource,
  type Session,
  type SessionOverview,
} from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { formatDuration, formatSize } from '@/lib/academy/live-shared';
import { addDocument, addLinkResource, addMeeting, deleteMeeting, deleteRecording, deleteResource, deleteSession, saveSchedule, setEnrollmentOpen, updateSession } from '../../actions';
import { EnrollmentActions } from '../../_components/enrollment-actions';
import { ScheduleForm } from '../schedule-form';
import { SessionForm } from '../session-form';

export const metadata: Metadata = { title: 'Session' };

interface EnrollmentRow {
  id: string;
  status: 'pending' | 'active' | 'cancelled';
  hold_expires_at: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string; phone_whatsapp: string; email: string } | null;
  ambassadors: { code: string } | null;
}

const RESOURCE_ICONS = { document: FileText, link: Link2, video: Video } as const;

export default async function AdminSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; untranslated?: string; all?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, ta, tt, locale, supabase] = await Promise.all([
    getTranslations('adminAcademy.session'),
    getTranslations('academy'),
    getTranslations('translation'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;

  const { data } = await supabase.from('academy_sessions').select(SESSION_COLUMNS).eq('id', id).maybeSingle();
  if (!data) notFound();
  const s = data as Session;

  let enrollmentsQuery = supabase
    .from('academy_enrollments')
    .select('id, status, hold_expires_at, created_at, profiles (first_name, last_name, phone_whatsapp, email), ambassadors (code)')
    .eq('session_id', id)
    .order('created_at', { ascending: false });
  if (!sp.all) enrollmentsQuery = enrollmentsQuery.neq('status', 'cancelled');

  const [courseRes, overviewRes, instRes, enrRes, balRes, statesRes, meetRes, resRes, liveRes, recRes] = await Promise.all([
    supabase.from('academy_courses').select('id, title_fr, title_en, status').eq('id', s.course_id).single(),
    supabase.from('academy_session_overview').select('*').eq('session_id', id).maybeSingle(),
    supabase.from('academy_installments').select('*').eq('session_id', id).order('rank'),
    enrollmentsQuery,
    supabase.from('academy_enrollment_balances').select('*').eq('session_id', id),
    supabase.from('academy_installment_states').select('*').eq('session_id', id).order('rank'),
    supabase.from('academy_meetings').select('*').eq('session_id', id).order('starts_at'),
    supabase.from('academy_resources').select('*').eq('session_id', id).order('created_at'),
    supabase.from('academy_live_rooms').select('meeting_id, closed_at').eq('session_id', id),
    supabase.from('academy_recordings').select(RECORDING_COLUMNS).eq('session_id', id).neq('status', 'deleted').order('started_at'),
  ]);
  const course = courseRes.data as { id: string; title_fr: string; title_en: string; status: string } | null;
  const o = overviewRes.data as SessionOverview | null;
  const installments = (instRes.data ?? []) as Installment[];
  const enrollments = (enrRes.data ?? []) as unknown as EnrollmentRow[];
  const balances = new Map(((balRes.data ?? []) as EnrollmentBalance[]).map((b) => [b.enrollment_id, b]));
  const states = (statesRes.data ?? []) as InstallmentStateRow[];
  const meetings = (meetRes.data ?? []) as Meeting[];
  const resources = (resRes.data ?? []) as Resource[];
  const openRooms = new Set(((liveRes.data ?? []) as { meeting_id: string; closed_at: string | null }[]).filter((r) => !r.closed_at).map((r) => r.meeting_id));
  const recordings = (recRes.data ?? []) as Recording[];
  const { data: attRows } = meetings.length
    ? await supabase.from('academy_meeting_attendance').select('meeting_id').in('meeting_id', meetings.map((m) => m.id))
    : { data: [] };
  const attendance = new Map<string, number>();
  for (const a of (attRows ?? []) as { meeting_id: string }[]) attendance.set(a.meeting_id, (attendance.get(a.meeting_id) ?? 0) + 1);

  const activeBalances = [...balances.values()].filter((b) => b.status !== 'cancelled');
  const collected = activeBalances.reduce((a, b) => a + num(b.paid), 0);
  const toCollect = activeBalances.reduce((a, b) => a + num(b.remaining), 0);
  const hasEnrollments = activeBalances.length > 0 || enrollments.length > 0;
  const uiSource = l === 'en' ? 'en' : 'fr';

  return (
    <Stack spacing={6}>
      <Box>
        {course && (
          <LinkButton href={`/admin/academy/courses/${course.id}`} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
            {localized(l, course.title_fr, course.title_en)}
          </LinkButton>
        )}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
          <Box>
            <StatusBadge tone={s.enrollment_open ? 'active' : 'neutral'}>{s.enrollment_open ? t('openBadge') : t('closedBadge')}</StatusBadge>
            <Typography variant="h5" component="h1" sx={{ mt: 2, fontWeight: 700 }}>
              {localized(l, s.label_fr, s.label_en)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {ta('dates', { start: formatDate(s.starts_on, l), end: formatDate(s.ends_on, l) })}
              {s.trainer_name && ` · ${ta('trainer', { name: s.trainer_name })}`}
              {` · ${t('rateInfo', { rate: num(s.commission_rate) })}`}
            </Typography>
            {s.frozen_at && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('frozenInfo', { date: formatDate(s.frozen_at, l, true) })}
              </Typography>
            )}
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <LinkButton href={`/admin/academy/sessions/${s.id}/evaluation`} variant="outlined" startIcon={<ClipboardCheck aria-hidden size={18} />}>
              {t('evaluationLink')}
            </LinkButton>
            {course?.status === 'published' && (
              <LinkButton href={`/academy/${s.course_id}`} target="_blank" variant="outlined" startIcon={<Eye aria-hidden size={18} />}>
                {t('preview')}
              </LinkButton>
            )}
            <ActionForm
              action={setEnrollmentOpen}
              confirm={s.enrollment_open ? t('closeConfirm') : t('openConfirm')}
              confirmTitle={s.enrollment_open ? t('close') : t('open')}
              confirmLabel={s.enrollment_open ? t('close') : t('open')}
            >
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="open" value={s.enrollment_open ? '0' : '1'} />
              <Button
                type="submit"
                variant={s.enrollment_open ? 'outlined' : 'contained'}
                startIcon={s.enrollment_open ? <DoorClosed aria-hidden size={18} /> : <DoorOpen aria-hidden size={18} />}
              >
                {s.enrollment_open ? t('close') : t('open')}
              </Button>
            </ActionForm>
            {!hasEnrollments && (
              <ActionForm action={deleteSession} confirm={t('deleteConfirm')} confirmTitle={t('delete')} confirmLabel={t('delete')} danger>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" variant="outlined" color="error" startIcon={<Trash2 aria-hidden size={18} />}>
                  {t('delete')}
                </Button>
              </ActionForm>
            )}
          </Box>
        </Box>
      </Box>

      {sp.created && <Notice tone="success">{t('created')}</Notice>}
      {sp.untranslated && <Notice tone="warning">{tt('untranslatedBanner')}</Notice>}
      {!s.enrollment_open && installments.length === 0 && <Notice tone="info">{t('openRequirements')}</Notice>}

      <Grid container spacing={4}>
        <Grid item xs={6} md={3}>
          <StatCard label={t('price')} value={formatXAF(num(o?.price), l)} icon="Wallet" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={t('seatsTaken')} value={`${num(o?.taken)} / ${s.seats}`} icon="Users" tone="info" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={t('collected')} value={formatXAF(collected, l)} icon="CheckCircle2" tone="success" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={t('toCollect')} value={formatXAF(toCollect, l)} icon="Hourglass" tone="warning" />
        </Grid>
      </Grid>

      {/* Échéancier */}
      <SectionCard id="schedule-title" title={t('schedule')} subtitle={s.frozen_at ? t('scheduleFrozen') : t('scheduleHint')}>
        {s.frozen_at ? (
          <Box component="ol" sx={{ m: 0, pl: 5, display: 'grid', gap: 1 }}>
            {installments.map((i) => (
              <li key={i.rank}>
                <strong>{formatXAF(i.amount, l)}</strong> {ta('dueOn', { date: formatDate(i.due_on, l) })}
              </li>
            ))}
          </Box>
        ) : (
          <ScheduleForm action={saveSchedule} sessionId={s.id} installments={installments} />
        )}
      </SectionCard>

      {/* Inscrits */}
      <TableCard
        title={t('enrollments')}
        action={
          <TextLink href={sp.all ? `/admin/academy/sessions/${s.id}` : `/admin/academy/sessions/${s.id}?all=1`} variant="body2">
            {sp.all ? t('hideCancelled') : t('showCancelled')}
          </TextLink>
        }
        head={[t('student'), ta('referralCode'), t('status'), t('paidCol'), t('nextDue'), t('actions')]}
      >
        {enrollments.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} sx={{ color: 'text.secondary' }}>
              {t('noEnrollments')}
            </TableCell>
          </TableRow>
        ) : (
          enrollments.map((e) => {
            const b = balances.get(e.id);
            const display = enrollmentDisplay(e.status, b);
            const overdue = display === 'overdue' || display === 'blocked';
            const p = e.profiles;
            return (
              <TableRow key={e.id}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {p ? `${p.first_name} ${p.last_name}` : '—'}
                  </Typography>
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {p?.phone_whatsapp} · {p?.email}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.ambassadors?.code ?? '—'}</TableCell>
                <TableCell>
                  <StatusBadge tone={displayTone(display)}>{ta(`status.${display}`)}</StatusBadge>
                  {e.status === 'pending' && e.hold_expires_at && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      {t('holdUntil', { date: formatDate(e.hold_expires_at, l, true) })}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatXAF(num(b?.paid), l)} / {formatXAF(num(b?.price), l)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', color: overdue ? 'error.main' : undefined }}>{b?.next_due_on ? formatDate(b.next_due_on, l) : '—'}</TableCell>
                <TableCell>
                  <EnrollmentActions
                    enrollmentId={e.id}
                    status={e.status}
                    paid={num(b?.paid)}
                    remaining={num(b?.remaining)}
                    states={states.filter((st) => st.enrollment_id === e.id)}
                  />
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableCard>

      {/* Séances */}
      <SectionCard id="meetings-title" title={t('meetings')} subtitle={t('meetingsHint')}>
        <Stack spacing={3}>
          {meetings.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('noMeetings')}
            </Typography>
          )}
          {meetings.map((m) => {
            const isOpen = openRooms.has(m.id);
            const w = meetingWindow(m);
            const recs = recordings.filter((r) => r.meeting_id === m.id);
            const present = attendance.get(m.id) ?? 0;
            return (
              <Box key={m.id} sx={{ p: 3, borderRadius: 1, border: 1, borderColor: isOpen ? 'success.main' : 'divider' }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
              <Box>
                <Typography sx={{ fontWeight: 600 }}>{localized(l, m.title_fr, m.title_en)}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {formatDate(m.starts_at, l, true)} · {t('minutes', { count: m.duration_minutes })}
                </Typography>
                {m.external_url && (
                  <TextLink href={m.external_url} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                    <ExternalLink aria-hidden size={14} />
                    {t('externalLink')}
                  </TextLink>
                )}
                {present > 0 && (
                  <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                    {t('attendance', { count: present })}
                  </Typography>
                )}
              </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                    {isOpen && <StatusBadge tone="active">{t('liveNow')}</StatusBadge>}
                    {!m.external_url && (isOpen || w !== 'past') && (
                      <LinkButton href={`/live/${m.id}`} size="small" variant={isOpen || w === 'live' ? 'contained' : 'outlined'} startIcon={<Video aria-hidden size={16} />}>
                        {t('hostMeeting')}
                      </LinkButton>
                    )}
                    <ActionForm
                      action={deleteMeeting}
                      confirm={recs.length ? t('deleteMeetingWithRecordingsConfirm') : t('deleteMeetingConfirm')}
                      confirmTitle={t('deleteMeeting')}
                      confirmLabel={t('deleteMeeting')}
                      danger
                    >
                      <input type="hidden" name="id" value={m.id} />
                      <Button type="submit" size="small" color="error" startIcon={<Trash2 aria-hidden size={16} />}>
                        {t('deleteMeeting')}
                      </Button>
                    </ActionForm>
                  </Box>
                </Box>
                {recs.length > 0 && (
                  <Box component="ul" aria-label={t('recordings')} sx={{ listStyle: 'none', m: 0, mt: 3, p: 0, display: 'grid', gap: 2 }}>
                    {recs.map((r) => (
                      <Box
                        component="li"
                        key={r.id}
                        sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2, px: 3, py: 2, borderRadius: 1, bgcolor: 'background.default' }}
                      >
                        <Box>
                          <StatusBadge tone={r.status === 'ready' ? 'validated' : r.status === 'failed' ? 'rejected' : 'pending'}>{t(`recordingStatus.${r.status}`)}</StatusBadge>
                          <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                            {formatDate(r.started_at, l, true)}
                            {r.status === 'ready' && ` · ${formatDuration(r.duration_seconds)} · ${formatSize(r.size_bytes, l)}`}
                            {r.status !== 'recording' && ` · ${t('recordingExpires', { date: formatDate(r.expires_at, l, true) })}`}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          {r.status === 'ready' && (
                            <Button href={`/student/recordings/${r.id}`} target="_blank" rel="noopener" size="small" variant="outlined" startIcon={<PlayCircle aria-hidden size={16} />}>
                              {t('watchRecording')}
                            </Button>
                          )}
                          {r.status !== 'recording' && (
                            <ActionForm action={deleteRecording} confirm={t('deleteRecordingConfirm')} confirmTitle={t('deleteRecording')} confirmLabel={t('deleteRecording')} danger>
                              <input type="hidden" name="id" value={r.id} />
                              <Button type="submit" size="small" color="error" aria-label={t('deleteRecording')}>
                                <Trash2 aria-hidden size={16} />
                              </Button>
                            </ActionForm>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
          <Collapsible kind="button" summary={t('addMeeting')}>
            <ActionForm action={addMeeting} resetOnSuccess style={{ marginTop: 12, display: 'grid', gap: 12, maxWidth: 560 }}>
              <input type="hidden" name="session_id" value={s.id} />
              <input type="hidden" name="source_locale" value={uiSource} />
              <TextField name="title" label={t('meetingTitle')} required maxLength={120} size="small" />
              <TextField name="starts_at" type="datetime-local" label={t('startsAt')} hint={t('startsAtHint')} required size="small" />
              <SelectField
                name="duration_minutes"
                label={t('duration')}
                size="small"
                defaultValue="60"
                options={[15, 30, 45, 60].map((n) => ({ value: String(n), label: t('minutes', { count: n }) }))}
              />
              <TextField name="external_url" type="url" label={t('externalUrl')} hint={t('externalUrlHint')} optionalLabel size="small" placeholder="https://meet.google.com/…" />
              <Button type="submit" variant="contained">
                {t('addMeeting')}
              </Button>
            </ActionForm>
          </Collapsible>
        </Stack>
      </SectionCard>

      {/* Documents, liens, vidéos */}
      <SectionCard id="resources-title" title={t('resources')} subtitle={t('resourcesHint')}>
        <Stack spacing={3}>
          {resources.length === 0 && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('noResources')}
            </Typography>
          )}
          {resources.map((r) => {
            const Icon = RESOURCE_ICONS[r.kind];
            return (
              <Box key={r.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 3, p: 3, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
                  <Icon aria-hidden size={18} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600 }}>{localized(l, r.title_fr, r.title_en)}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t(`kind.${r.kind}`)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button href={r.kind === 'document' ? `/academy/documents/${r.id}` : (r.url ?? '#')} target="_blank" rel="noopener noreferrer" size="small" variant="outlined">
                    {t('openResource')}
                  </Button>
                  <ActionForm action={deleteResource} confirm={t('deleteResourceConfirm')} confirmTitle={t('deleteResource')} confirmLabel={t('deleteResource')} danger>
                    <input type="hidden" name="id" value={r.id} />
                    <Button type="submit" size="small" color="error" aria-label={`${t('deleteResource')} : ${localized(l, r.title_fr, r.title_en)}`}>
                      <Trash2 aria-hidden size={16} />
                    </Button>
                  </ActionForm>
                </Box>
              </Box>
            );
          })}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
            <Collapsible kind="button" summary={t('addDocument')}>
              <ActionForm action={addDocument} resetOnSuccess style={{ marginTop: 12, display: 'grid', gap: 12, maxWidth: 480 }}>
                <input type="hidden" name="session_id" value={s.id} />
                <input type="hidden" name="source_locale" value={uiSource} />
                <TextField name="title" label={t('resourceTitle')} required maxLength={120} size="small" />
                <Box>
                  <Typography component="label" htmlFor={`file-${s.id}`} variant="body2" sx={{ display: 'block', mb: 1, fontWeight: 500 }}>
                    {t('file')}
                  </Typography>
                  <Box component="input" id={`file-${s.id}`} name="file" type="file" accept="application/pdf" required sx={{ display: 'block', width: '100%', fontSize: '0.875rem', color: 'text.primary' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {t('fileHint')}
                  </Typography>
                </Box>
                <Button type="submit" variant="contained">
                  {t('addDocument')}
                </Button>
              </ActionForm>
            </Collapsible>
            <Collapsible kind="button" summary={t('addLink')}>
              <ActionForm action={addLinkResource} resetOnSuccess style={{ marginTop: 12, display: 'grid', gap: 12, maxWidth: 480 }}>
                <input type="hidden" name="session_id" value={s.id} />
                <input type="hidden" name="source_locale" value={uiSource} />
                <SelectField name="kind" label={t('kindLabel')} size="small" defaultValue="link" options={[{ value: 'link', label: t('kind.link') }, { value: 'video', label: t('kind.video') }]} />
                <TextField name="title" label={t('resourceTitle')} required maxLength={120} size="small" />
                <TextField name="url" type="url" label={t('url')} hint={t('urlHint')} required size="small" placeholder="https://…" />
                <Button type="submit" variant="contained">
                  {t('addLink')}
                </Button>
              </ActionForm>
            </Collapsible>
          </Box>
        </Stack>
      </SectionCard>

      <SectionCard id="edit-title" title={t('edit')}>
        <SessionForm action={updateSession} courseId={s.course_id} session={s} />
      </SectionCard>
    </Stack>
  );
}
