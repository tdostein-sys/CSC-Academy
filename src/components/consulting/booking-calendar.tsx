'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import type { EventContentArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import frLocale from '@fullcalendar/core/locales/fr';
import enGbLocale from '@fullcalendar/core/locales/en-gb';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { tok } from '@/@core/theme/tokens';

/**
 * Calendrier des rendez-vous (vues mois, semaine, jour et liste, comme
 * Outlook), construit sur FullCalendar comme l'application Calendrier du
 * modèle Sneat, aux couleurs du thème CSC.
 *
 * Lecture seule : un clic ouvre la fiche du rendez-vous (report et
 * annulation y restent soumis aux règles vérifiées par la base).
 *
 * Fuseau : le Cameroun est à UTC+1 toute l'année (pas d'heure d'été). Les
 * heures sont converties en « heure murale » de Douala et le calendrier
 * travaille en UTC : l'affichage est le même pour tous, quel que soit le
 * fuseau de l'ordinateur.
 */
export type CalendarStatus = 'confirmed' | 'pending' | 'done';

export interface CalendarBooking {
  id: string;
  title: string;
  subtitle: string;
  start: string; // ISO
  end: string; // ISO
  status: CalendarStatus;
  href: string;
}

export interface CalendarBlock {
  start: string;
  end: string;
}

export interface CalendarLabels {
  today: string;
  month: string;
  week: string;
  day: string;
  list: string;
  noEvents: string;
  legend: Record<CalendarStatus | 'unavailable', string>;
}

const DOUALA_OFFSET_MS = 3_600_000;
/** ISO → « heure murale » de Douala, sans fuseau (interprétée en UTC par le calendrier). */
const toDouala = (iso: string) => new Date(Date.parse(iso) + DOUALA_OFFSET_MS).toISOString().slice(0, 19);

export function BookingCalendar({
  bookings,
  blocks = [],
  businessHours,
  locale,
  labels,
}: {
  bookings: CalendarBooking[];
  /** Indisponibilités du conseiller (fond grisé). */
  blocks?: CalendarBlock[];
  /** Créneaux habituels (jours ISO 1 = lundi … 7 = dimanche, heures « HH:MM »). */
  businessHours?: { weekday: number; start: string; end: string }[];
  locale: 'fr' | 'en';
  labels: CalendarLabels;
}) {
  const theme = useTheme();
  const c = tok(theme);
  const router = useRouter();
  const compact = useMediaQuery(theme.breakpoints.down('md'));

  const colors: Record<CalendarStatus, { bg: string; fg: string; border: string }> = {
    confirmed: { bg: c.primary, fg: c['primary-fg'], border: c.primary },
    pending: { bg: c['warning-soft'], fg: c.warning, border: c.warning },
    done: { bg: c['neutral-soft'], fg: c.neutral, border: c.border },
  };

  const events: EventInput[] = useMemo(
    () => [
      ...bookings.map((b) => ({
        id: b.id,
        title: b.title,
        start: toDouala(b.start),
        end: toDouala(b.end),
        url: b.href,
        extendedProps: { subtitle: b.subtitle, status: b.status },
        backgroundColor: colors[b.status].bg,
        borderColor: colors[b.status].border,
        textColor: colors[b.status].fg,
      })),
      ...blocks.map((u, i) => ({ id: `block-${i}`, start: toDouala(u.start), end: toDouala(u.end), display: 'background', backgroundColor: c['neutral-soft'] })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- couleurs dérivées du thème (mode clair / sombre)
    [bookings, blocks, theme.palette.mode],
  );

  const renderEvent = (arg: EventContentArg) => {
    const subtitle = arg.event.extendedProps.subtitle as string;
    const list = arg.view.type.startsWith('list');
    return (
      <Box sx={{ px: list ? 0 : 0.75, py: list ? 0 : 0.25, overflow: 'hidden', lineHeight: 1.3, minWidth: 0 }}>
        {!list && arg.timeText && (
          <Box component="span" sx={{ fontSize: '0.6875rem', fontWeight: 600, display: 'block', opacity: 0.9 }}>
            {arg.timeText}
          </Box>
        )}
        <Box component="span" sx={{ fontSize: '0.75rem', fontWeight: 600, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: list ? 'normal' : 'nowrap' }}>
          {arg.event.title}
        </Box>
        {subtitle && (
          <Box component="span" sx={{ fontSize: '0.6875rem', display: 'block', opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: list ? 'normal' : 'nowrap' }}>
            {subtitle}
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Box>
      <Box
        sx={{
          // Habillage FullCalendar aux couleurs du thème (variables CSS officielles).
          '--fc-border-color': c.border,
          '--fc-page-bg-color': c.bg,
          '--fc-neutral-bg-color': c['surface-2'],
          '--fc-today-bg-color': c['primary-soft'],
          '--fc-now-indicator-color': c.error,
          '--fc-list-event-hover-bg-color': c['surface-2'],
          '--fc-button-text-color': c.text,
          '--fc-button-bg-color': c.bg,
          '--fc-button-border-color': c.border,
          '--fc-button-hover-bg-color': c['surface-2'],
          '--fc-button-hover-border-color': c.border,
          '--fc-button-active-bg-color': c['primary-soft'],
          '--fc-button-active-border-color': c.primary,
          '--fc-event-border-color': 'transparent',
          color: c.text,
          fontSize: '0.875rem',
          '& .fc .fc-toolbar': { flexWrap: 'wrap', gap: 2 },
          '& .fc .fc-toolbar-title': { fontSize: { xs: '1rem', sm: '1.125rem' }, fontWeight: 700, fontFamily: 'var(--font-heading), inherit', textTransform: 'none' },
          '& .fc .fc-button': { textTransform: 'none', fontWeight: 600, borderRadius: '10px', minHeight: 40, px: 3, boxShadow: 'none !important' },
          '& .fc .fc-button-group > .fc-button': { borderRadius: 0 },
          '& .fc .fc-button-group > .fc-button:first-of-type': { borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px' },
          '& .fc .fc-button-group > .fc-button:last-of-type': { borderTopRightRadius: '10px', borderBottomRightRadius: '10px' },
          '& .fc .fc-button-primary:not(:disabled).fc-button-active': { color: c['primary-hover'] },
          '& .fc .fc-button:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 2 },
          '& .fc .fc-col-header-cell-cushion, & .fc .fc-daygrid-day-number, & .fc .fc-list-day-text, & .fc .fc-list-day-side-text': { color: c.text, textDecoration: 'none', fontWeight: 600 },
          '& .fc .fc-timegrid-slot-label-cushion, & .fc .fc-list-event-time': { color: c.muted, fontVariantNumeric: 'tabular-nums' },
          '& .fc .fc-event': { borderRadius: '6px', cursor: 'pointer', borderLeftWidth: 3 },
          '& .fc .fc-event:focus-visible': { outline: `2px solid ${c.primary}`, outlineOffset: 1 },
          '& .fc .fc-list-event a': { color: c.text, textDecoration: 'none' },
          '& .fc .fc-list-empty': { bgcolor: c.bg, color: c.muted },
          '& .fc .fc-non-business': { bgcolor: c['surface-2'] },
          '& .fc-theme-standard .fc-scrollgrid, & .fc-theme-standard .fc-list': { borderRadius: '12px', overflow: 'hidden' },
        }}
      >
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
          locale={locale === 'en' ? enGbLocale : frLocale}
          timeZone="UTC"
          now={() => new Date(Date.now() + DOUALA_OFFSET_MS).toISOString().slice(0, 19)}
          initialView={compact ? 'listWeek' : 'timeGridWeek'}
          headerToolbar={compact ? { left: 'prev,next', center: 'title', right: 'today' } : { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek' }}
          footerToolbar={compact ? { center: 'dayGridMonth,timeGridDay,listWeek' } : undefined}
          buttonText={{ today: labels.today, month: labels.month, week: labels.week, day: labels.day, list: labels.list }}
          noEventsText={labels.noEvents}
          firstDay={1}
          allDaySlot={false}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          nowIndicator
          navLinks
          dayMaxEvents={3}
          height="auto"
          businessHours={businessHours?.map((h) => ({ daysOfWeek: [h.weekday % 7], startTime: h.start.slice(0, 5), endTime: h.end.slice(0, 5) }))}
          events={events}
          eventContent={renderEvent}
          eventClick={(info) => {
            // Navigation interne (sans rechargement) ; le lien reste un vrai lien pour le clavier.
            info.jsEvent.preventDefault();
            if (info.event.url) router.push(info.event.url);
          }}
        />
      </Box>

      {/* Légende : la couleur n'est jamais la seule information (le titre de la fiche donne le statut). */}
      <Box component="ul" sx={{ listStyle: 'none', m: 0, mt: 3, p: 0, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {(['confirmed', 'pending', 'done'] as const).map((s) => (
          <Box component="li" key={s} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: colors[s].bg, border: `1px solid ${colors[s].border}` }} />
            <Typography variant="caption">{labels.legend[s]}</Typography>
          </Box>
        ))}
        {blocks.length > 0 && (
          <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box aria-hidden sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: c['neutral-soft'], border: `1px dashed ${c.border}` }} />
            <Typography variant="caption">{labels.legend.unavailable}</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
