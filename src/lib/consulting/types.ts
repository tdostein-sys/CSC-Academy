/** Types du module CSC Consulting (miroir des tables `consulting_*`). */
export type OfferStatus = 'draft' | 'published' | 'archived';
export type ConsultingMode = 'video' | 'phone' | 'in_person';
export type ConsultingCategory = 'financial' | 'stock' | 'crypto' | 'investment' | 'other';
export type BookingStatus = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded';
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded';
export type ReportStatus = 'draft' | 'published';

export const OFFER_STATUSES: OfferStatus[] = ['draft', 'published', 'archived'];
export const CONSULTING_MODES: ConsultingMode[] = ['video', 'phone', 'in_person'];
export const CONSULTING_CATEGORIES: ConsultingCategory[] = ['financial', 'stock', 'crypto', 'investment', 'other'];
export const BOOKING_STATUSES: BookingStatus[] = ['pending_payment', 'confirmed', 'expired', 'cancelled', 'refunded'];

export interface Offer {
  id: string;
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  conditions_fr: string;
  conditions_en: string;
  source_locale: 'fr' | 'en';
  category: ConsultingCategory;
  mode: ConsultingMode;
  location: string;
  duration_minutes: number;
  price: number;
  once_per_client: boolean;
  status: OfferStatus;
  created_at: string;
}

export const OFFER_COLUMNS =
  'id, title_fr, title_en, description_fr, description_en, conditions_fr, conditions_en, source_locale, category, mode, location, duration_minutes, price, once_per_client, status, created_at';

export interface Settings {
  hold_hours: number;
  min_notice_hours: number;
  horizon_days: number;
  cancel_limit_hours: number;
  slot_step_minutes: number;
  payment_instructions_fr: string;
  payment_instructions_en: string;
  source_locale: 'fr' | 'en';
}

export const SETTINGS_COLUMNS =
  'hold_hours, min_notice_hours, horizon_days, cancel_limit_hours, slot_step_minutes, payment_instructions_fr, payment_instructions_en, source_locale';

/** Ligne de la vue `consulting_booking_details`. */
export interface BookingDetails {
  id: string;
  ref: number;
  offer_id: string;
  client_id: string;
  advisor_id: string;
  mode: ConsultingMode;
  location: string;
  duration_minutes: number;
  price: number;
  starts_at: string;
  ends_at: string;
  client_message: string;
  status: BookingStatus;
  hold_expires_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  client_joined_at: string | null;
  created_at: string;
  offer_title_fr: string;
  offer_title_en: string;
  category: ConsultingCategory;
  client_first_name: string;
  client_last_name: string;
  client_email: string;
  client_phone: string;
  advisor_name: string;
  report_status: ReportStatus | null;
  report_published_at: string | null;
  paid: boolean;
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  provider: 'manual' | 'notchpay';
  status: PaymentStatus;
  method: string;
  reference: string;
  paid_on: string;
  proof_path: string | null;
  confirmed_at: string | null;
  refunded_at: string | null;
  refund_reference: string | null;
  refund_reason: string | null;
  created_at: string;
}

export interface BookingEvent {
  id: number;
  booking_id: string;
  event: 'created' | 'confirmed' | 'payment_recorded' | 'expired' | 'cancelled' | 'rescheduled' | 'refunded' | 'report_published';
  data: Record<string, unknown>;
  created_at: string;
}

/** Contenu d'un compte rendu (renvoyé par consulting_report_view, lecture journalisée). */
export interface ReportView {
  booking_id: string;
  consultation_date: string;
  subject: string;
  summary: string;
  recommendations: string;
  observations: string;
  status: ReportStatus;
  published_at: string | null;
  updated_at: string;
  author: string | null;
  files: { id: string; title: string; size_bytes: number; created_at: string }[];
}

export interface Advisor {
  user_id: string;
  display_name: string;
  active: boolean;
}

export interface AvailabilityRule {
  id: string;
  advisor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
}

export interface Unavailability {
  id: string;
  advisor_id: string;
  period: string;
  reason: string;
}

/** Statuts « actifs » : le créneau est tenu. */
export const ACTIVE_STATUSES: BookingStatus[] = ['pending_payment', 'confirmed'];

/** Numéro lisible d'un rendez-vous : RDV-000042. */
export function bookingRef(ref: number | string): string {
  return `RDV-${String(ref).padStart(6, '0')}`;
}

/** Les montants `bigint` arrivent parfois en chaîne : conversion sûre. */
export const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0) || 0);

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DOUALA_OFFSET_MS = 60 * 60_000; // UTC+1, sans heure d'été

/** Jour (AAAA-MM-JJ) d'un instant, à l'heure du Cameroun. */
export function doualaDay(iso: string): string {
  return new Date(new Date(iso).getTime() + DOUALA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Heure (HH:MM) d'un instant, à l'heure du Cameroun. */
export function doualaTime(iso: string): string {
  return new Date(new Date(iso).getTime() + DOUALA_OFFSET_MS).toISOString().slice(11, 16);
}

/** Regroupe des créneaux (instants ISO triés) par jour local. */
export function groupSlotsByDay(startsAt: string[]): { day: string; slots: { iso: string; time: string }[] }[] {
  const days = new Map<string, { iso: string; time: string }[]>();
  for (const iso of [...startsAt].sort()) {
    const day = doualaDay(iso);
    const list = days.get(day) ?? [];
    list.push({ iso, time: doualaTime(iso) });
    days.set(day, list);
  }
  return [...days.entries()].map(([day, slots]) => ({ day, slots }));
}

/** L'instant est-il passé ? (`now` injectable pour les tests) */
export function isPast(iso: string | null | undefined, now = Date.now()): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() < now;
}

/** Plus de `hours` heures se sont-elles écoulées depuis cet instant ? */
export function olderThanHours(iso: string | null | undefined, hours: number, now = Date.now()): boolean {
  return !iso || now - new Date(iso).getTime() > hours * 3600_000;
}

/** Le client peut-il encore annuler ou reporter lui-même ? (même règle que la base) */
export function clientCanChange(b: Pick<BookingDetails, 'status' | 'starts_at'>, cancelLimitHours: number, now = Date.now()): boolean {
  const start = new Date(b.starts_at).getTime();
  if (b.status === 'pending_payment') return now < start;
  if (b.status !== 'confirmed') return false;
  return now <= start - cancelLimitHours * 3600_000;
}

/** Fenêtre d'accès à la visio (même règle que consulting_join). */
export function videoWindow(b: Pick<BookingDetails, 'starts_at' | 'ends_at'>, isHost: boolean, now = Date.now()) {
  const start = new Date(b.starts_at).getTime();
  const end = new Date(b.ends_at).getTime() + 30 * 60_000;
  if (now > end) return 'over' as const;
  if (now < start - (isHost ? 60 : 15) * 60_000) return 'early' as const;
  return 'open' as const;
}

/** Heure à partir de laquelle on peut entrer dans la salle. */
export function videoOpensAt(b: Pick<BookingDetails, 'starts_at'>, isHost: boolean): string {
  return new Date(new Date(b.starts_at).getTime() - (isHost ? 60 : 15) * 60_000).toISOString();
}
