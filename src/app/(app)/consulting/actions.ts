'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, fromZodError, type FormState } from '@/lib/forms';
import { bookSchema, cancelSchema, rescheduleSchema } from '@/lib/validation/consulting';
import { consultingErrorKey } from '@/lib/consulting/errors';
import { notifyBooked, notifyCancelled, notifyRescheduled } from '@/lib/consulting/notify';

/*
 * Actions des clients CSC Consulting. Les règles (créneau réellement libre,
 * jamais deux réservations sur le même créneau, délais d'annulation, offre
 * unique) sont vérifiées par les fonctions SQL ; ici on valide la saisie,
 * on appelle la base et on prévient les intéressés.
 */

function refresh(id?: string) {
  revalidatePath('/consulting', 'layout');
  if (id) revalidatePath(`/consulting/bookings/${id}`);
}

export async function bookSlot(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.sessionExpired');
  const parsed = bookSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc('consulting_book', {
    p_offer: parsed.data.offer_id,
    p_starts_at: parsed.data.starts_at,
    p_message: parsed.data.message,
  });
  if (error || typeof id !== 'string') return formError(consultingErrorKey(error));

  await notifyBooked(id);
  refresh(id);
  redirect(`/consulting/bookings/${id}?booked=1`);
}

export async function cancelMyBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.sessionExpired');
  const parsed = cancelSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { data: refundDue, error } = await supabase.rpc('consulting_cancel_booking', {
    p_booking: parsed.data.id,
    p_reason: parsed.data.reason || null,
  });
  if (error) return formError(consultingErrorKey(error));

  await notifyCancelled(parsed.data.id, true, refundDue === true);
  refresh(parsed.data.id);
  redirect(`/consulting/bookings/${parsed.data.id}?cancelled=1`);
}

export async function rescheduleMyBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.sessionExpired');
  const parsed = rescheduleSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  // RLS : seul le client du rendez-vous (ou l'admin) le voit.
  const { data: before } = await supabase.from('consulting_bookings').select('starts_at').eq('id', parsed.data.id).maybeSingle();
  if (!before) return formError('consulting.errors.not_found');

  const { error } = await supabase.rpc('consulting_reschedule_booking', {
    p_booking: parsed.data.id,
    p_starts_at: parsed.data.starts_at,
  });
  if (error) return formError(consultingErrorKey(error));

  await notifyRescheduled(parsed.data.id, before.starts_at as string);
  refresh(parsed.data.id);
  redirect(`/consulting/bookings/${parsed.data.id}?rescheduled=1`);
}
