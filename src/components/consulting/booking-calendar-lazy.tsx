'use client';

import dynamic from 'next/dynamic';
import Skeleton from '@mui/material/Skeleton';

/**
 * Calendrier chargé uniquement dans le navigateur (sa vue dépend de la largeur
 * de l'écran) et en différé : FullCalendar n'alourdit pas les autres pages.
 */
export const BookingCalendarLazy = dynamic(() => import('./booking-calendar').then((m) => m.BookingCalendar), {
  ssr: false,
  loading: () => <Skeleton variant="rounded" height={520} sx={{ borderRadius: '12px' }} />,
});
