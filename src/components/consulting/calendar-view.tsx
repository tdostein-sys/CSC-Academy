import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import { CalendarDays, List } from 'lucide-react';
import { LinkButton } from '@/components/ui/links';
import type { CalendarLabels } from './booking-calendar';

/** Affichage des rendez-vous : calendrier (par défaut) ou liste. */
export type CalendarView = 'calendrier' | 'liste';

/** Bascule « Calendrier / Liste » (liens : l'affichage choisi se partage et se garde au rechargement). */
export async function CalendarViewSwitch({ basePath, view, extra = '' }: { basePath: string; view: CalendarView; extra?: string }) {
  const t = await getTranslations('consulting.calendar');
  const items: { key: CalendarView; label: string; Icon: typeof List }[] = [
    { key: 'calendrier', label: t('calendar'), Icon: CalendarDays },
    { key: 'liste', label: t('list'), Icon: List },
  ];
  return (
    <Box component="nav" aria-label={t('view')} sx={{ display: 'inline-flex', p: 0.5, mb: 4, borderRadius: '12px', bgcolor: 'action.hover', gap: 0.5 }}>
      {items.map(({ key, label, Icon }) => (
        <LinkButton
          key={key}
          href={`${basePath}?vue=${key}${extra}`}
          size="small"
          variant={key === view ? 'contained' : 'text'}
          color={key === view ? 'primary' : 'inherit'}
          aria-current={key === view ? 'page' : undefined}
          startIcon={<Icon aria-hidden size={16} />}
          sx={{ borderRadius: '10px' }}
        >
          {label}
        </LinkButton>
      ))}
    </Box>
  );
}

/** Libellés du calendrier, traduits côté serveur. */
export async function calendarLabels(): Promise<CalendarLabels> {
  const t = await getTranslations('consulting.calendar');
  return {
    today: t('today'),
    month: t('month'),
    week: t('week'),
    day: t('day'),
    list: t('listView'),
    noEvents: t('noEvents'),
    legend: { confirmed: t('legend.confirmed'), pending: t('legend.pending'), done: t('legend.done'), unavailable: t('legend.unavailable') },
  };
}
