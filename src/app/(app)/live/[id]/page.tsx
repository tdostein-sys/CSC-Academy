import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { liveConfig } from '@/lib/academy/live';
import { UUID, hostOpensAt, meetingEnd, meetingWindow, tooEarlyToOpen, type Meeting } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { LiveRoom } from './live-room';

export const metadata: Metadata = { title: 'Visio' };
export const dynamic = 'force-dynamic';

interface SessionRow {
  id: string;
  label_fr: string;
  label_en: string;
  academy_courses: { title_fr: string; title_en: string } | null;
}

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/live/${id}`);
  const [t, locale, supabase] = await Promise.all([getTranslations('academy.live'), getLocale(), createClient()]);
  const l = locale as Locale;

  // RLS : la séance n'est visible que des inscrits actifs non bloqués et de l'admin.
  const { data } = await supabase.from('academy_meetings').select('*').eq('id', id).maybeSingle();
  const m = data as Meeting | null;

  if (!m) {
    return (
      <Stack spacing={4}>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {t('title')}
        </Typography>
        <Notice tone="warning">{t('noAccess')}</Notice>
        <Box>
          <LinkButton href="/student" variant="outlined" startIcon={<ArrowLeft aria-hidden size={16} />}>
            {t('backStudent')}
          </LinkButton>
        </Box>
      </Stack>
    );
  }

  const [sessionRes, roomRes, enrollmentRes] = await Promise.all([
    supabase.from('academy_sessions').select('id, label_fr, label_en, academy_courses (title_fr, title_en)').eq('id', m.session_id).maybeSingle(),
    supabase.from('academy_live_rooms').select('closed_at').eq('meeting_id', id).maybeSingle(),
    user.isAdmin
      ? Promise.resolve({ data: null })
      : supabase.from('academy_enrollments').select('id').eq('session_id', m.session_id).eq('student_id', user.id).eq('status', 'active').maybeSingle(),
  ]);
  const s = sessionRes.data as unknown as SessionRow | null;
  const room = roomRes.data as { closed_at: string | null } | null;
  const roomOpen = Boolean(room && !room.closed_at);
  const enrollmentId = (enrollmentRes.data as { id: string } | null)?.id;
  const backHref = user.isAdmin ? `/admin/academy/sessions/${m.session_id}` : enrollmentId ? `/student/${enrollmentId}` : '/student';

  const win = meetingWindow(m);
  const endIso = meetingEnd(m);
  const tooEarlyForHost = user.isAdmin && !roomOpen && tooEarlyToOpen(m);
  const over = win === 'past' && !roomOpen;

  return (
    <Stack spacing={5}>
      <Box>
        <LinkButton href={backHref} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 3 }}>
          {user.isAdmin ? t('backAdmin') : t('backStudent')}
        </LinkButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {localized(l, m.title_fr, m.title_en)}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {s?.academy_courses && `${localized(l, s.academy_courses.title_fr, s.academy_courses.title_en)} · `}
          {formatDate(m.starts_at, l, true)} · {t('minutes', { count: m.duration_minutes })}
        </Typography>
      </Box>

      {m.external_url ? (
        <Notice tone="info">
          {t('externalInfo')}{' '}
          <Box component="a" href={m.external_url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 600, color: 'inherit' }}>
            {t('openExternal')}
            <ExternalLink aria-hidden size={14} />
          </Box>
        </Notice>
      ) : !liveConfig() ? (
        <Notice tone="warning">{t('notConfigured')}</Notice>
      ) : over ? (
        <Notice tone="info">{t('over')}</Notice>
      ) : tooEarlyForHost ? (
        <Notice tone="info">{t('tooEarly', { time: formatDate(hostOpensAt(m), l, true) })}</Notice>
      ) : (
        <LiveRoom meetingId={m.id} isAdmin={user.isAdmin} roomOpen={roomOpen} endLabel={formatDate(endIso, l, true)} />
      )}

      {!m.external_url && !over && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {t('privacy')}
        </Typography>
      )}
    </Stack>
  );
}
