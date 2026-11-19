import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { ReplayPlayer } from '@/components/live/replay-player';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { academyErrorKey } from '@/lib/academy/errors';
import { canStream, formatDuration, type ReplayState } from '@/lib/academy/live-shared';
import { RECORDING_COLUMNS, UUID, type Recording } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { ReplayAction } from '../replay-action';

export const metadata: Metadata = { title: 'Replay' };

/**
 * Page de visionnage d'un replay. Ne crée JAMAIS de visionnage (une page peut
 * être préchargée) : seul le bouton « Regarder » (action serveur) le fait.
 */
export default async function ReplayPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser('/student');
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, tr, locale, supabase] = await Promise.all([getTranslations('student'), getTranslations(), getLocale(), createClient()]);
  const l = locale as Locale;

  const { data, error } = await supabase.rpc('academy_replay_access', { p_recording: id, p_start: false });
  const access = (Array.isArray(data) ? data[0] : data) as { state: ReplayState; expires_at: string | null } | undefined;

  if (error || !access) {
    const key = academyErrorKey(error);
    if (key === 'academy.errors.not_found' || key === 'errors.generic') notFound();
    return (
      <Stack spacing={4}>
        <Box>
          <LinkButton href="/student" size="small" startIcon={<ArrowLeft aria-hidden size={16} />}>
            {t('back')}
          </LinkButton>
        </Box>
        <Notice tone="error">{tr(key)}</Notice>
      </Stack>
    );
  }

  const { data: recData } = await supabase.from('academy_recordings').select(RECORDING_COLUMNS).eq('id', id).maybeSingle();
  const rec = recData as Recording | null;
  if (!rec) notFound();

  const [meetingRes, enrollmentRes, settingsRes] = await Promise.all([
    supabase.from('academy_meetings').select('title_fr, title_en').eq('id', rec.meeting_id).maybeSingle(),
    supabase.from('academy_enrollments').select('id').eq('session_id', rec.session_id).eq('student_id', user.id).neq('status', 'cancelled').maybeSingle(),
    supabase.from('academy_replay_settings').select('view_hours').maybeSingle(),
  ]);
  const meeting = meetingRes.data as { title_fr: string; title_en: string } | null;
  const title = meeting ? localized(l, meeting.title_fr, meeting.title_en) : t('replay');
  const back =
    access.state === 'admin'
      ? `/admin/academy/sessions/${rec.session_id}`
      : enrollmentRes.data
        ? `/student/${(enrollmentRes.data as { id: string }).id}`
        : '/student';
  const hours = Number((settingsRes.data as { view_hours: number } | null)?.view_hours ?? 2);

  return (
    <Stack spacing={5}>
      <Box>
        <LinkButton href={back} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
          {t('back')}
        </LinkButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {formatDate(rec.started_at, l, true)} · {formatDuration(rec.duration_seconds)}
        </Typography>
      </Box>

      {canStream(access.state) && access.expires_at ? (
        <>
          <Notice tone="info">
            {access.state === 'admin' ? t('replayAdminInfo') : t('replayWatchUntil', { date: formatDate(access.expires_at, l, true) })}
          </Notice>
          <ReplayPlayer
            src={`/student/recordings/${rec.id}`}
            until={access.expires_at}
            title={title}
            labels={{ expired: t('replayExpired'), interrupted: t('replayInterrupted'), retry: t('replayRetry') }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {t('replayProtection')}
          </Typography>
        </>
      ) : (
        <Paper variant="outlined" sx={{ p: { xs: 4, sm: 6 }, display: 'grid', gap: 3, justifyItems: 'start' }}>
          <Typography>{access.state === 'watched' ? t('replayWatchedInfo') : t('replayOnce', { hours })}</Typography>
          <ReplayAction
            recordingId={rec.id}
            state={access.state === 'watched' ? 'watched' : 'available'}
            labels={{
              watch: t('watchReplay'),
              resume: t('replayResume'),
              watched: t('replayWatched'),
              confirm: t('replayConfirm', { hours }),
              confirmTitle: t('watchReplay'),
            }}
          />
        </Paper>
      )}
    </Stack>
  );
}
