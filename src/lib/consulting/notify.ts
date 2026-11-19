import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import type { Locale } from '@/lib/types';
import type { BookingStatus, ConsultingMode } from './types';

/*
 * Notifications CSC Consulting. Appelées APRÈS que la base a accepté
 * l'opération ; elles lisent le rendez-vous avec la clé serveur (le contenu
 * envoyé ne dépend jamais de ce que le navigateur a transmis).
 * Un échec d'envoi ne bloque jamais l'action (reprise par la tâche planifiée).
 */

export interface BookingContext {
  id: string;
  clientId: string;
  advisorId: string;
  clientName: string;
  clientPhone: string;
  offerTitle: (l: Locale) => string;
  date: (l: Locale) => string;
  amount: (l: Locale) => string;
  price: number;
  mode: ConsultingMode;
  location: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
}

interface Row {
  id: string;
  client_id: string;
  advisor_id: string;
  price: number | string;
  mode: ConsultingMode;
  location: string;
  status: BookingStatus;
  starts_at: string;
  hold_expires_at: string | null;
  consulting_offers: { title_fr: string; title_en: string } | null;
  profiles: { first_name: string; last_name: string; phone_whatsapp: string } | null;
}

export async function bookingContext(id: string): Promise<BookingContext | null> {
  const { data } = await createAdminClient()
    .from('consulting_bookings')
    .select(
      'id, client_id, advisor_id, price, mode, location, status, starts_at, hold_expires_at, consulting_offers (title_fr, title_en), profiles:client_id (first_name, last_name, phone_whatsapp)',
    )
    .eq('id', id)
    .maybeSingle();
  const r = data as unknown as Row | null;
  if (!r) return null;
  const price = Number(r.price) || 0;
  return {
    id: r.id,
    clientId: r.client_id,
    advisorId: r.advisor_id,
    clientName: r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}`.trim() : '—',
    clientPhone: r.profiles?.phone_whatsapp ?? '',
    offerTitle: (l) => localized(l, r.consulting_offers?.title_fr, r.consulting_offers?.title_en),
    date: (l) => formatDate(r.starts_at, l, true),
    amount: (l) => formatXAF(price, l),
    price,
    mode: r.mode,
    location: r.location,
    status: r.status,
    holdExpiresAt: r.hold_expires_at,
  };
}

/** Destinataires « équipe » d'un rendez-vous : le conseiller et les administrateurs. */
export async function staffIds(advisorId: string): Promise<string[]> {
  try {
    const { data } = await createAdminClient().from('user_roles').select('user_id').eq('role', 'admin');
    return [...new Set([advisorId, ...(data ?? []).map((a) => a.user_id as string)])];
  } catch {
    return [advisorId];
  }
}

const clientLink = (id: string) => `/consulting/bookings/${id}`;
const staffLink = (id: string) => `/consulting/manage/${id}`;

/** Après une réservation : le client (instructions ou confirmation) et l'équipe. */
export async function notifyBooked(id: string) {
  const c = await bookingContext(id);
  if (!c) return;
  const free = c.price === 0;
  await notify({
    userIds: [c.clientId],
    type: 'consulting.booked',
    params: (l) => ({
      offerTitle: c.offerTitle(l),
      date: c.date(l),
      amount: c.amount(l),
      holdUntil: formatDate(c.holdExpiresAt, l, true),
      free,
      mode: c.mode,
      location: c.location,
    }),
    link: clientLink(id),
  });
  await notify({
    userIds: await staffIds(c.advisorId),
    type: 'consulting.new_booking',
    params: (l) => ({ clientName: c.clientName, offerTitle: c.offerTitle(l), date: c.date(l), free }),
    link: staffLink(id),
  });
}

/** Paiement enregistré : rendez-vous confirmé. */
export async function notifyConfirmed(id: string) {
  const c = await bookingContext(id);
  if (!c) return;
  await notify({
    userIds: [c.clientId],
    type: 'consulting.confirmed',
    params: (l) => ({ offerTitle: c.offerTitle(l), date: c.date(l), amount: c.amount(l), mode: c.mode, location: c.location }),
    link: clientLink(id),
  });
}

/** Annulation : le client et l'équipe. */
export async function notifyCancelled(id: string, byClient: boolean, refundDue: boolean) {
  const c = await bookingContext(id);
  if (!c) return;
  await notify({
    userIds: [c.clientId],
    type: 'consulting.cancelled',
    params: (l) => ({ offerTitle: c.offerTitle(l), date: c.date(l), byClient, refundDue }),
    link: clientLink(id),
  });
  await notify({
    userIds: await staffIds(c.advisorId),
    type: 'consulting.cancelled_staff',
    params: (l) => ({ clientName: c.clientName, offerTitle: c.offerTitle(l), date: c.date(l), byClient }),
    link: staffLink(id),
  });
}

/** Report : le client et l'équipe (ancienne et nouvelle date). */
export async function notifyRescheduled(id: string, oldStartsAt: string) {
  const c = await bookingContext(id);
  if (!c) return;
  const params = (l: Locale) => ({ offerTitle: c.offerTitle(l), oldDate: formatDate(oldStartsAt, l, true), newDate: c.date(l) });
  await notify({ userIds: [c.clientId], type: 'consulting.rescheduled', params, link: clientLink(id) });
  await notify({ userIds: await staffIds(c.advisorId), type: 'consulting.rescheduled', params, link: staffLink(id) });
}

export async function notifyReportPublished(id: string) {
  const c = await bookingContext(id);
  if (!c) return;
  await notify({
    userIds: [c.clientId],
    type: 'consulting.report_published',
    params: (l) => ({ offerTitle: c.offerTitle(l), date: c.date(l) }),
    link: clientLink(id),
  });
}

export async function notifyRefunded(id: string, reference: string) {
  const c = await bookingContext(id);
  if (!c) return;
  await notify({
    userIds: [c.clientId],
    type: 'consulting.refunded',
    params: (l) => ({ offerTitle: c.offerTitle(l), amount: c.amount(l), reference }),
    link: clientLink(id),
  });
}
