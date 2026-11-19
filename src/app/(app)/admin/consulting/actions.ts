'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import {
  advisorSchema,
  advisorStatusSchema,
  availabilitySchema,
  doualaLocalToIso,
  offerSchema,
  offerStatusSchema,
  settingsSchema,
  unavailabilitySchema,
  type OfferInput,
} from '@/lib/validation/consulting';
import { consultingErrorKey } from '@/lib/consulting/errors';
import { bilingual } from '@/lib/translation';

/*
 * Administration de CSC Consulting : offres, conseillers, disponibilités,
 * réglages. Double contrôle : assertAdmin() ici, PUIS la RLS et les fonctions
 * SQL qui revérifient le rôle (et journalisent chaque changement).
 */

const idSchema = z.object({ id: z.uuid('errors.generic') });
const adminOrNull = () => assertAdmin().catch(() => null);

function refresh(paths: string[] = []) {
  revalidatePath('/admin/consulting', 'layout');
  revalidatePath('/consulting', 'layout');
  for (const p of paths) revalidatePath(p);
}

const savedMessage = (translated: boolean) => (translated ? 'adminConsulting.saved' : 'translation.savedUntranslated');

// -----------------------------------------------------------------------------
// Offres
// -----------------------------------------------------------------------------
async function offerColumns(d: OfferInput) {
  const { columns, translated } = await bilingual({ title: d.title, description: d.description, conditions: d.conditions }, d.source_locale);
  return {
    translated,
    values: {
      ...columns,
      source_locale: d.source_locale,
      category: d.category,
      mode: d.mode,
      location: d.mode === 'in_person' ? d.location : '',
      duration_minutes: d.duration_minutes,
      price: d.price,
      once_per_client: d.once_per_client,
    },
  };
}

export async function createOffer(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = offerSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { values, translated } = await offerColumns(parsed.data);
  const { data, error } = await supabase.from('consulting_offers').insert(values).select('id').single();
  if (error || !data) return formError(consultingErrorKey(error));
  refresh();
  redirect(`/admin/consulting/offers/${data.id}?created=1${translated ? '' : '&untranslated=1'}`);
}

export async function updateOffer(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const ids = idSchema.safeParse(formDataToObject(fd));
  const parsed = offerSchema.safeParse(formDataToObject(fd));
  if (!ids.success) return formError('errors.generic');
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { values, translated } = await offerColumns(parsed.data);
  // Les rendez-vous déjà pris gardent leurs conditions (figées en base).
  const { error } = await supabase.from('consulting_offers').update(values).eq('id', ids.data.id);
  if (error) return formError(consultingErrorKey(error));
  refresh([`/admin/consulting/offers/${ids.data.id}`]);
  return formSuccess(savedMessage(translated));
}

export async function setOfferStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = offerStatusSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.from('consulting_offers').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  if (error) return formError(consultingErrorKey(error));
  refresh([`/admin/consulting/offers/${parsed.data.id}`]);
  return formSuccess('adminConsulting.offer.statusSaved');
}

export async function deleteOffer(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  // Seul un brouillon sans rendez-vous peut être supprimé (RLS + clé étrangère).
  const { error, count } = await supabase.from('consulting_offers').delete({ count: 'exact' }).eq('id', parsed.data.id);
  if (error) return formError(consultingErrorKey(error));
  if (count === 0) return formError('adminConsulting.offer.deleteOnlyDraft');
  refresh();
  redirect('/admin/consulting/offers');
}

// -----------------------------------------------------------------------------
// Réglages
// -----------------------------------------------------------------------------
export async function saveSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = settingsSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const { columns, translated } = await bilingual({ payment_instructions: d.payment_instructions }, d.source_locale);
  const supabase = await createClient();
  const { error } = await supabase
    .from('consulting_settings')
    .update({
      ...columns,
      source_locale: d.source_locale,
      hold_hours: d.hold_hours,
      min_notice_hours: d.min_notice_hours,
      horizon_days: d.horizon_days,
      cancel_limit_hours: d.cancel_limit_hours,
      slot_step_minutes: d.slot_step_minutes,
    })
    .eq('id', true);
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess(savedMessage(translated));
}

// -----------------------------------------------------------------------------
// Conseillers et disponibilités
// -----------------------------------------------------------------------------
export async function addAdvisor(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = advisorSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  // RLS : l'admin lit tous les profils.
  const { data: profile } = await supabase.from('profiles').select('id').eq('email', parsed.data.email).maybeSingle();
  if (!profile) return { status: 'error', message: 'errors.checkForm', fieldErrors: { email: 'adminConsulting.advisors.unknownEmail' } };
  const { error } = await supabase.rpc('consulting_set_advisor', { p_user: profile.id, p_display_name: parsed.data.display_name, p_active: true });
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess('adminConsulting.advisors.added');
}

export async function setAdvisorStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = advisorStatusSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('consulting_set_advisor', {
    p_user: parsed.data.user_id,
    p_display_name: parsed.data.display_name,
    p_active: parsed.data.active,
  });
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess(parsed.data.active ? 'adminConsulting.advisors.activated' : 'adminConsulting.advisors.deactivated');
}

export async function addAvailability(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = availabilitySchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.from('consulting_availability').insert(parsed.data);
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess('adminConsulting.availability.added');
}

export async function removeAvailability(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.from('consulting_availability').delete().eq('id', parsed.data.id);
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess('adminConsulting.availability.removed');
}

export async function addUnavailability(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = unavailabilitySchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('consulting_unavailabilities').insert({
    advisor_id: d.advisor_id,
    period: `[${doualaLocalToIso(d.starts_at)},${doualaLocalToIso(d.ends_at)})`,
    reason: d.reason,
  });
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess('adminConsulting.availability.unavailabilityAdded');
}

export async function removeUnavailability(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.from('consulting_unavailabilities').delete().eq('id', parsed.data.id);
  if (error) return formError(consultingErrorKey(error));
  refresh();
  return formSuccess('adminConsulting.availability.removed');
}
