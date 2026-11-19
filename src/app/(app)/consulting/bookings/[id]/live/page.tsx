import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { liveConfig } from '@/lib/consulting/live';
import { UUID, videoOpensAt, videoWindow, type BookingDetails } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import { ConsultRoom } from './consult-room';

export const metadata: Metadata = { title: 'Visio — CSC Consulting' };
export const dynamic = 'force-dynamic';

/** Salle de visio d'un rendez-vous (client, conseiller attribué ou admin). */
export default async function ConsultLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireUser(`/consulting/bookings/${id}/live`);
  const [t, locale, supabase] = await Promise.all([getTranslations('consulting'), getLocale(), createClient()]);
  const l = locale as Locale;

  // La vue ne renvoie le rendez-vous qu'à son client, à son conseiller et à l'admin.
  const { data } = await supabase.from('consulting_booking_details').select('*').eq('id', id).maybeSingle();
  const b = data as BookingDetails | null;
  if (!b) notFound();
  const isClient = b.client_id === user.id;
  const backHref = isClient ? `/consulting/bookings/${id}` : `/consulting/manage/${id}`;
  const win = videoWindow(b, !isClient);
  const endLabel = formatDate(new Date(new Date(b.ends_at).getTime() + 30 * 60_000).toISOString(), l, true);

  let blocker: string | null = null;
  if (b.mode !== 'video') blocker = t('errors.booking_not_video');
  else if (b.status !== 'confirmed') blocker = t('errors.booking_not_confirmed');
  else if (!liveConfig()) blocker = t('errors.live_not_configured');
  else if (win === 'over') blocker = t('live.over');
  else if (win === 'early') blocker = t('detail.videoOpensAt', { time: formatDate(videoOpensAt(b, !isClient), l, true) });

  return (
    <Stack spacing={5}>
      <Box>
        <LinkButton href={backHref} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 3 }}>
          {t('live.back')}
        </LinkButton>
        <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
          {localized(l, b.offer_title_fr, b.offer_title_en)}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
          {formatDate(b.starts_at, l, true)} · {t('minutes', { count: b.duration_minutes })} ·{' '}
          {isClient ? b.advisor_name : `${b.client_first_name} ${b.client_last_name}`}
        </Typography>
      </Box>
      {blocker ? <Notice tone="info">{blocker}</Notice> : <ConsultRoom bookingId={b.id} endLabel={endLabel} />}
    </Stack>
  );
}
