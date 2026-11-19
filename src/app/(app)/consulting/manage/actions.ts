'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { assertAdmin, assertConsultingStaff } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import {
  adminRescheduleSchema,
  cancelSchema,
  checkConsultingFile,
  doualaLocalToIso,
  fileExtension,
  paymentSchema,
  refundSchema,
  reportFileSchema,
  reportSchema,
} from '@/lib/validation/consulting';
import { consultingErrorKey } from '@/lib/consulting/errors';
import { notifyCancelled, notifyConfirmed, notifyRefunded, notifyReportPublished, notifyRescheduled } from '@/lib/consulting/notify';
import { z } from 'zod';

/*
 * Actions des collaborateurs CSC Consulting (conseiller attribué, admin).
 * Double contrôle : rôle vérifié ici, PUIS chaque fonction SQL revérifie le
 * droit sur le rendez-vous (consulting_can_manage, is_admin) et les règles
 * (montant exact, référence unique, créneau libre, compte rendu figé…).
 * Les fichiers vont dans un stockage privé, déposés par le serveur.
 */

const BUCKET = 'consulting-files';
const bookingIdSchema = z.object({ booking_id: z.uuid('errors.generic') });

function refresh(id: string) {
  revalidatePath('/consulting', 'layout');
  revalidatePath(`/consulting/manage/${id}`);
  revalidatePath('/admin/consulting', 'layout');
}

const adminOrNull = () => assertAdmin().catch(() => null);
const staffOrNull = () => assertConsultingStaff().catch(() => null);

function fileFrom(fd: FormData, name: string): File | null {
  const f = fd.get(name);
  return f instanceof File && f.size > 0 ? f : null;
}

// -----------------------------------------------------------------------------
// Paiements, annulation, report, remboursement (administrateur)
// -----------------------------------------------------------------------------
export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = paymentSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  // Justificatif facultatif, déposé avant l'enregistrement (retiré si refus).
  const proof = fileFrom(fd, 'proof');
  let proofPath: string | null = null;
  const admin = createAdminClient();
  if (proof) {
    const bad = checkConsultingFile(proof);
    if (bad) return { status: 'error', message: 'errors.checkForm', fieldErrors: { proof: bad } };
    proofPath = `payments/${d.booking_id}/${randomUUID()}.${fileExtension(proof.type)}`;
    const { error: upErr } = await admin.storage.from(BUCKET).upload(proofPath, proof, { contentType: proof.type, upsert: false });
    if (upErr) return formError('consulting.errors.upload_failed');
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('consulting_record_payment', {
    p_booking: d.booking_id,
    p_amount: d.amount,
    p_method: d.method,
    p_reference: d.reference,
    p_paid_on: d.paid_on,
    p_proof_path: proofPath,
  });
  if (error) {
    if (proofPath) await admin.storage.from(BUCKET).remove([proofPath]);
    return formError(consultingErrorKey(error));
  }
  await notifyConfirmed(d.booking_id);
  refresh(d.booking_id);
  return formSuccess('consulting.manage.paymentRecorded');
}

export async function adminCancelBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = cancelSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  if (parsed.data.reason.length < 3) return { status: 'error', message: 'errors.checkForm', fieldErrors: { reason: 'validation.reasonRequired' } };
  const supabase = await createClient();
  const { data: refundDue, error } = await supabase.rpc('consulting_cancel_booking', { p_booking: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return formError(consultingErrorKey(error));
  await notifyCancelled(parsed.data.id, false, refundDue === true);
  refresh(parsed.data.id);
  return formSuccess(refundDue ? 'consulting.manage.cancelledRefundDue' : 'consulting.manage.cancelled');
}

export async function adminRescheduleBooking(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = adminRescheduleSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { data: before } = await supabase.from('consulting_bookings').select('starts_at').eq('id', parsed.data.id).maybeSingle();
  if (!before) return formError('consulting.errors.not_found');
  const { error } = await supabase.rpc('consulting_reschedule_booking', {
    p_booking: parsed.data.id,
    p_starts_at: doualaLocalToIso(parsed.data.starts_at),
  });
  if (error) return formError(consultingErrorKey(error));
  await notifyRescheduled(parsed.data.id, before.starts_at as string);
  refresh(parsed.data.id);
  return formSuccess('consulting.manage.rescheduled');
}

export async function refundPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = refundSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('consulting_refund_payment', {
    p_payment: parsed.data.payment_id,
    p_reference: parsed.data.reference,
    p_reason: parsed.data.reason,
  });
  if (error) return formError(consultingErrorKey(error));
  await notifyRefunded(parsed.data.booking_id, parsed.data.reference);
  refresh(parsed.data.booking_id);
  return formSuccess('consulting.manage.refunded');
}

// -----------------------------------------------------------------------------
// Comptes rendus (conseiller attribué ou admin)
// -----------------------------------------------------------------------------
export async function saveReport(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOrNull())) return formError('errors.forbidden');
  const parsed = reportSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('consulting_save_report', {
    p_booking: d.booking_id,
    p_consultation_date: d.consultation_date,
    p_subject: d.subject,
    p_summary: d.summary,
    p_recommendations: d.recommendations,
    p_observations: d.observations,
  });
  if (error) return formError(consultingErrorKey(error));
  refresh(d.booking_id);
  return formSuccess('consulting.manage.reportSaved');
}

export async function publishReport(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOrNull())) return formError('errors.forbidden');
  const parsed = bookingIdSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('consulting_publish_report', { p_booking: parsed.data.booking_id });
  if (error) return formError(consultingErrorKey(error));
  await notifyReportPublished(parsed.data.booking_id);
  refresh(parsed.data.booking_id);
  return formSuccess('consulting.manage.reportPublished');
}

export async function addReportFile(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOrNull())) return formError('errors.forbidden');
  const parsed = reportFileSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const file = fileFrom(fd, 'file');
  if (!file) return { status: 'error', message: 'errors.checkForm', fieldErrors: { file: 'validation.required' } };
  const bad = checkConsultingFile(file);
  if (bad) return { status: 'error', message: 'errors.checkForm', fieldErrors: { file: bad } };

  // La base confirme le droit AVANT tout dépôt dans le stockage.
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc('consulting_can_manage', { p_booking: parsed.data.booking_id });
  if (allowed !== true) return formError('errors.forbidden');

  const path = `${parsed.data.booking_id}/${randomUUID()}.${fileExtension(file.type)}`;
  const admin = createAdminClient();
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) return formError('consulting.errors.upload_failed');
  const { error } = await supabase.rpc('consulting_add_report_file', {
    p_booking: parsed.data.booking_id,
    p_title: parsed.data.title,
    p_path: path,
    p_size: file.size,
  });
  if (error) {
    await admin.storage.from(BUCKET).remove([path]);
    return formError(consultingErrorKey(error));
  }
  refresh(parsed.data.booking_id);
  return formSuccess('consulting.manage.fileAdded');
}

export async function removeReportFile(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await staffOrNull())) return formError('errors.forbidden');
  const parsed = z.object({ id: z.uuid('errors.generic'), booking_id: z.uuid('errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc('consulting_remove_report_file', { p_file: parsed.data.id });
  if (error) return formError(consultingErrorKey(error));
  if (typeof path === 'string') await createAdminClient().storage.from(BUCKET).remove([path]);
  refresh(parsed.data.booking_id);
  return formSuccess('consulting.manage.fileRemoved');
}
