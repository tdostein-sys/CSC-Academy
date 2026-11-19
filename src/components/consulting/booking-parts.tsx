import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { FileText } from 'lucide-react';
import { Markdown } from '@/components/markdown';
import { TextLink } from '@/components/ui/links';
import { formatDate, formatXAF } from '@/lib/format';
import { bookingRef, num, type BookingDetails, type BookingEvent, type ReportView } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';

/** Liste de définitions « libellé : valeur ». */
export function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(140px, auto) 1fr' }, columnGap: 4, rowGap: { xs: 0.5, sm: 2 } }}>
      {items.map(([k, v]) => (
        <Box key={k} sx={{ display: 'contents' }}>
          <Typography component="dt" variant="body2" sx={{ color: 'text.secondary', mt: { xs: 2, sm: 0 } }}>
            {k}
          </Typography>
          <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
            {v}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

/** Informations d'un rendez-vous (côté client ou collaborateur). */
export async function BookingFacts({ b, staff = false }: { b: BookingDetails; staff?: boolean }) {
  const [t, locale] = await Promise.all([getTranslations('consulting'), getLocale()]);
  const l = locale as Locale;
  const price = num(b.price);
  const where =
    b.mode === 'in_person' ? b.location : b.mode === 'phone' ? (staff ? t('detail.callClient', { phone: b.client_phone }) : t('detail.phoneInfo')) : t('detail.videoInfo');
  return (
    <Facts
      items={[
        [t('detail.ref'), bookingRef(b.ref)],
        [t('detail.date'), formatDate(b.starts_at, l, true)],
        [t('detail.duration'), t('minutes', { count: b.duration_minutes })],
        [t('detail.mode'), t(`mode.${b.mode}`)],
        [t('detail.where'), where],
        [t('detail.advisor'), b.advisor_name],
        [t('detail.price'), price === 0 ? t('free') : `${formatXAF(price, l)}${b.paid ? ` · ${t('detail.paid')}` : ''}`],
        ...(staff
          ? ([
              [t('detail.client'), `${b.client_first_name} ${b.client_last_name}`],
              [t('detail.contact'), `${b.client_phone} · ${b.client_email}`],
            ] as [string, string][])
          : []),
        ...(b.client_message ? ([[t('detail.message'), b.client_message]] as [string, string][]) : []),
        ...(b.cancel_reason && b.status !== 'confirmed' && b.status !== 'pending_payment'
          ? ([[t('detail.cancelReason'), b.cancel_reason === 'client' || b.cancel_reason === 'admin' ? t(`detail.cancelBy.${b.cancel_reason}`) : b.cancel_reason]] as [string, string][])
          : []),
      ]}
    />
  );
}

/** Contenu d'un compte rendu (lecture déjà journalisée par la base). */
export async function ReportContent({ report, fileHref }: { report: ReportView; fileHref: (id: string) => string }) {
  const [t, locale] = await Promise.all([getTranslations('consulting.report'), getLocale()]);
  const l = locale as Locale;
  const block = (title: string, text: string) =>
    text.trim() ? (
      <Box>
        <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>
        <Markdown source={text} />
      </Box>
    ) : null;
  return (
    <Stack spacing={4}>
      <Facts
        items={[
          [t('date'), formatDate(report.consultation_date, l)],
          [t('subject'), report.subject],
          ...(report.author ? ([[t('author'), report.author]] as [string, string][]) : []),
          ...(report.published_at ? ([[t('publishedAt'), formatDate(report.published_at, l, true)]] as [string, string][]) : []),
        ]}
      />
      {block(t('summary'), report.summary)}
      {block(t('recommendations'), report.recommendations)}
      {block(t('observations'), report.observations)}
      {report.files.length > 0 && (
        <Box>
          <Typography variant="subtitle2" component="h3" sx={{ fontWeight: 700, mb: 1 }}>
            {t('files')}
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gap: 1 }}>
            {report.files.map((f) => (
              <Box component="li" key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FileText aria-hidden size={16} />
                <TextLink href={fileHref(f.id)} target="_blank" rel="noopener">
                  {f.title}
                </TextLink>
              </Box>
            ))}
          </Box>
        </Box>
      )}
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {t('confidential')}
      </Typography>
    </Stack>
  );
}

/** Historique d'un rendez-vous (journal en ajout seul). */
export async function BookingHistory({ events }: { events: BookingEvent[] }) {
  const [t, locale] = await Promise.all([getTranslations('consulting.history'), getLocale()]);
  const l = locale as Locale;
  if (events.length === 0) return null;
  return (
    <Box component="ol" sx={{ m: 0, pl: 0, listStyle: 'none', display: 'grid', gap: 2 }}>
      {events.map((e) => (
        <Box component="li" key={e.id} sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'baseline' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', minWidth: 150 }}>
            {formatDate(e.created_at, l, true)}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {t(e.event)}
            {e.event === 'rescheduled' && typeof e.data.to === 'string' ? ` → ${formatDate(e.data.to, l, true)}` : ''}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
