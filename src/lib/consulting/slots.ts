import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/types';
import { groupSlotsByDay } from './types';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Libellé court d'un jour local : « mar. 24 nov. ». */
export function dayLabel(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Africa/Douala',
  }).format(new Date(`${day}T12:00:00Z`));
}

/**
 * Créneaux libres d'une offre, regroupés par jour (heure du Cameroun).
 * `ignoreBooking` : rendez-vous à déplacer (son propre créneau reste proposé).
 */
export async function loadSlotDays(supabase: Supabase, offerId: string, locale: Locale, ignoreBooking?: string) {
  const { data, error } = await supabase.rpc('consulting_available_slots', {
    p_offer: offerId,
    p_ignore_booking: ignoreBooking ?? null,
  });
  if (error) {
    console.error('[consulting] créneaux indisponibles', error.message);
    return [];
  }
  const isos = ((data ?? []) as { starts_at: string }[]).map((r) => new Date(r.starts_at).toISOString());
  return groupSlotsByDay(isos).map((g) => ({ ...g, label: dayLabel(g.day, locale) }));
}
