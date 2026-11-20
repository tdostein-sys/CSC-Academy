import { localized } from '@/lib/localized';
import type { Locale } from '@/lib/types';
import type { CalendarBooking } from '@/components/consulting/booking-calendar';
import { bookingRef, type BookingDetails } from './types';

/** Statuts affichés dans le calendrier : les rendez-vous annulés, expirés ou remboursés n'y figurent pas. */
export const CALENDAR_STATUSES = ['confirmed', 'pending_payment'] as const;

/** Période chargée : 2 mois en arrière, 6 mois en avant. */
export function calendarWindow(now: number = Date.now()) {
  return { from: new Date(now - 62 * 86_400_000).toISOString(), to: new Date(now + 186 * 86_400_000).toISOString() };
}

type Row = Pick<BookingDetails, 'id' | 'ref' | 'offer_title_fr' | 'offer_title_en' | 'starts_at' | 'ends_at' | 'status'> &
  Partial<Pick<BookingDetails, 'advisor_name' | 'client_first_name' | 'client_last_name'>>;

/**
 * Rendez-vous → entrées du calendrier.
 *  - client : titre = offre, sous-titre = conseiller ; lien vers « Mes rendez-vous » ;
 *  - équipe : titre = client, sous-titre = offre (+ conseiller pour l'admin) ; lien vers la fiche de suivi.
 */
export function toCalendarBookings(
  rows: Row[],
  perspective: 'client' | 'staff',
  locale: Locale,
  opts: { showAdvisor?: boolean; now?: number } = {},
): CalendarBooking[] {
  const now = opts.now ?? Date.now();
  return rows
    .filter((r) => (CALENDAR_STATUSES as readonly string[]).includes(r.status))
    .map((r) => {
      const offer = localized(locale, r.offer_title_fr, r.offer_title_en);
      const client = `${r.client_first_name ?? ''} ${r.client_last_name ?? ''}`.trim();
      const status = r.status === 'pending_payment' ? 'pending' : Date.parse(r.ends_at) < now ? 'done' : 'confirmed';
      return perspective === 'client'
        ? { id: r.id, title: offer, subtitle: [bookingRef(r.ref), r.advisor_name].filter(Boolean).join(' · '), start: r.starts_at, end: r.ends_at, status, href: `/consulting/bookings/${r.id}` }
        : {
            id: r.id,
            title: client || bookingRef(r.ref),
            subtitle: [offer, opts.showAdvisor ? r.advisor_name : null].filter(Boolean).join(' · '),
            start: r.starts_at,
            end: r.ends_at,
            status,
            href: `/consulting/manage/${r.id}`,
          };
    });
}
