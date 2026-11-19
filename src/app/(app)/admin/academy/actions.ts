'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import {
  checkDocumentFile,
  courseSchema,
  courseStatusSchema,
  documentResourceSchema,
  doualaLocalToIso,
  extensionSchema,
  linkResourceSchema,
  meetingSchema,
  parseSchedule,
  parseChoices,
  paymentSchema,
  commissionPayoutSchema,
  evaluationSchema,
  questionSchema,
  revokeSchema,
  sessionSchema,
  type CourseInput,
  type SessionInput,
} from '@/lib/validation/academy';
import { academyErrorKey } from '@/lib/academy/errors';
import { notifyCertificate } from '@/lib/academy/notify';
import { purgeExpiredRecordings } from '@/lib/academy/live';
import { num } from '@/lib/academy/types';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { notify } from '@/lib/notifications';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { bilingual } from '@/lib/translation';

/*
 * Actions d'administration de CSC Academy.
 * Double contrôle : assertAdmin() ici, PUIS la RLS / les fonctions SQL qui
 * revérifient le rôle admin et les règles (places, gel de l'échéancier,
 * paiement plafonné au reste dû…).
 */

const BUCKET = 'academy-files';
const idSchema = z.object({ id: z.uuid('errors.generic') });
type Supabase = Awaited<ReturnType<typeof createClient>>;

async function adminOrNull() {
  return assertAdmin().catch(() => null);
}

function refresh(paths: string[] = []) {
  revalidatePath('/admin/academy', 'layout');
  revalidatePath('/academy', 'layout');
  revalidatePath('/student', 'layout');
  for (const p of paths) revalidatePath(p);
}

const untranslatedSuffix = (translated: boolean) => (translated ? '' : '&untranslated=1');
const savedMessage = (translated: boolean) => (translated ? 'adminAcademy.saved' : 'translation.savedUntranslated');

// -----------------------------------------------------------------------------
// Formations
// -----------------------------------------------------------------------------
async function courseColumns(d: CourseInput) {
  const { columns, translated } = await bilingual({ title: d.title, summary: d.summary, program: d.program }, d.source_locale);
  return { translated, values: { ...columns, source_locale: d.source_locale, level: d.level } };
}

export async function createCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = courseSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { values, translated } = await courseColumns(parsed.data);
  const { data, error } = await supabase.from('academy_courses').insert(values).select('id').single();
  if (error || !data) return formError(academyErrorKey(error));
  refresh();
  redirect(`/admin/academy/courses/${data.id}?created=1${untranslatedSuffix(translated)}`);
}

export async function updateCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const ids = idSchema.safeParse(formDataToObject(fd));
  const parsed = courseSchema.safeParse(formDataToObject(fd));
  if (!ids.success) return formError('errors.generic');
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { values, translated } = await courseColumns(parsed.data);
  const { error } = await supabase.from('academy_courses').update(values).eq('id', ids.data.id);
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/courses/${ids.data.id}`]);
  return formSuccess(savedMessage(translated));
}

export async function setCourseStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = courseStatusSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.from('academy_courses').update({ status: parsed.data.status }).eq('id', parsed.data.id);
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/courses/${parsed.data.id}`]);
  return formSuccess('adminAcademy.course.statusSaved');
}

export async function deleteCourse(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  // Seul un brouillon sans session peut être supprimé (RLS + clé étrangère).
  const { error, count } = await supabase.from('academy_courses').delete({ count: 'exact' }).eq('id', parsed.data.id);
  if (error) return formError(academyErrorKey(error));
  if (count === 0) return formError('adminAcademy.course.deleteOnlyDraft');
  refresh();
  redirect('/admin/academy/courses');
}

// -----------------------------------------------------------------------------
// Sessions
// -----------------------------------------------------------------------------
async function sessionColumns(d: SessionInput) {
  const { columns, translated } = await bilingual(
    { label: d.label, payment_instructions: d.payment_instructions },
    d.source_locale,
  );
  return {
    translated,
    values: {
      ...columns,
      source_locale: d.source_locale,
      trainer_name: d.trainer_name,
      starts_on: d.starts_on,
      ends_on: d.ends_on,
      seats: d.seats,
      commission_rate: d.commission_rate,
    },
  };
}

export async function createSession(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = sessionSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { values, translated } = await sessionColumns(parsed.data);
  const { data, error } = await supabase
    .from('academy_sessions')
    .insert({ ...values, course_id: parsed.data.course_id })
    .select('id')
    .single();
  if (error || !data) return formError(academyErrorKey(error));
  refresh([`/admin/academy/courses/${parsed.data.course_id}`]);
  redirect(`/admin/academy/sessions/${data.id}?created=1${untranslatedSuffix(translated)}`);
}

export async function updateSession(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const ids = idSchema.safeParse(formDataToObject(fd));
  const parsed = sessionSchema.safeParse(formDataToObject(fd));
  if (!ids.success) return formError('errors.generic');
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { values, translated } = await sessionColumns(parsed.data);
  // Une fois la session figée, la base refuse tout changement du taux de commission.
  const { data: current } = await supabase.from('academy_sessions').select('frozen_at, commission_rate').eq('id', ids.data.id).maybeSingle();
  if (!current) return formError('academy.errors.not_found');
  const update = current.frozen_at ? { ...values, commission_rate: current.commission_rate } : values;
  const { error } = await supabase.from('academy_sessions').update(update).eq('id', ids.data.id);
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/sessions/${ids.data.id}`]);
  return formSuccess(savedMessage(translated));
}

export async function deleteSession(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { data: s } = await supabase.from('academy_sessions').select('course_id').eq('id', parsed.data.id).maybeSingle();
  if (!s) return formError('academy.errors.not_found');
  const { data: files } = await supabase.from('academy_resources').select('file_path').eq('session_id', parsed.data.id).not('file_path', 'is', null);
  // Refusé par la base s'il existe des inscriptions (clé étrangère).
  const { error } = await supabase.from('academy_sessions').delete().eq('id', parsed.data.id);
  if (error) return formError(academyErrorKey(error));
  const paths = (files ?? []).map((f) => f.file_path as string);
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  refresh();
  redirect(`/admin/academy/courses/${s.course_id}`);
}

export async function setEnrollmentOpen(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = z.object({ id: z.uuid('errors.generic'), open: z.enum(['1', '0']) }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_set_enrollment_open', { p_session: parsed.data.id, p_open: parsed.data.open === '1' });
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/sessions/${parsed.data.id}`]);
  return formSuccess(parsed.data.open === '1' ? 'adminAcademy.session.opened' : 'adminAcademy.session.closedMsg');
}

export async function saveSchedule(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const obj = formDataToObject(fd);
  const ids = idSchema.safeParse(obj);
  if (!ids.success) return formError('errors.generic');
  const schedule = parseSchedule(obj);
  if ('error' in schedule) return formError(schedule.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_set_installments', {
    p_session: ids.data.id,
    p_amounts: schedule.amounts,
    p_due_dates: schedule.dates,
  });
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/sessions/${ids.data.id}`]);
  return formSuccess('adminAcademy.session.scheduleSaved');
}

// -----------------------------------------------------------------------------
// Inscriptions et paiements
// -----------------------------------------------------------------------------
async function enrollmentContext(supabase: Supabase, enrollmentId: string) {
  const { data } = await supabase
    .from('academy_enrollments')
    .select('student_id, session_id, academy_sessions (label_fr, label_en, academy_courses (title_fr, title_en))')
    .eq('id', enrollmentId)
    .maybeSingle();
  return data as unknown as {
    student_id: string;
    session_id: string;
    academy_sessions: { label_fr: string; label_en: string; academy_courses: { title_fr: string; title_en: string } };
  } | null;
}

export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = paymentSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();

  const [{ data: before }, { data: balBefore }, { data: certBefore }] = await Promise.all([
    supabase.from('academy_enrollments').select('status').eq('id', d.enrollment_id).maybeSingle(),
    supabase.from('academy_enrollment_balances').select('fully_paid').eq('enrollment_id', d.enrollment_id).maybeSingle(),
    supabase.from('academy_certificates').select('id').eq('enrollment_id', d.enrollment_id).maybeSingle(),
  ]);
  // La base refuse tout montant supérieur au reste à payer.
  const { error } = await supabase.rpc('academy_record_payment', {
    p_enrollment: d.enrollment_id,
    p_amount: d.amount,
    p_method: d.method,
    p_reference: d.reference,
    p_paid_on: d.paid_on,
  });
  if (error) return formError(academyErrorKey(error));

  const [ctx, { data: bal }, { data: commission }, { data: cert }] = await Promise.all([
    enrollmentContext(supabase, d.enrollment_id),
    supabase.from('academy_enrollment_balances').select('remaining, fully_paid').eq('enrollment_id', d.enrollment_id).maybeSingle(),
    supabase.from('academy_commissions').select('ambassador_id, student_label, earned').eq('enrollment_id', d.enrollment_id).maybeSingle(),
    supabase.from('academy_certificates').select('id').eq('enrollment_id', d.enrollment_id).maybeSingle(),
  ]);
  if (ctx) {
    const course = ctx.academy_sessions.academy_courses;
    await notify({
      userIds: [ctx.student_id],
      type: 'academy.payment_recorded',
      params: (locale) => ({
        courseTitle: localized(locale, course.title_fr, course.title_en),
        amount: formatXAF(d.amount, locale),
        remaining: formatXAF(bal?.remaining ?? 0, locale),
        activated: before?.status === 'pending',
      }),
      link: `/student/${d.enrollment_id}`,
    });
    // Formation tout juste soldée : la commission du parrain devient due.
    if (bal?.fully_paid && !balBefore?.fully_paid && commission && num(commission.earned) > 0) {
      await notify({
        userIds: [commission.ambassador_id as string],
        type: 'academy.commission_earned',
        params: (locale) => ({
          courseTitle: localized(locale, course.title_fr, course.title_en),
          studentLabel: commission.student_label as string,
          amount: formatXAF(commission.earned, locale),
        }),
        link: '/ambassador#academy-title',
      });
    }
  }
  // Évaluation déjà réussie : l'attestation est délivrée par la base au dernier paiement.
  if (cert && !certBefore) await notifyCertificate(supabase, cert.id as string);
  refresh(ctx ? [`/admin/academy/sessions/${ctx.session_id}`] : []);
  return formSuccess('adminAcademy.session.paymentRecorded');
}

export async function grantExtension(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = extensionSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_grant_extension', {
    p_enrollment: parsed.data.enrollment_id,
    p_rank: parsed.data.rank,
    p_due_on: parsed.data.due_on,
    p_reason: parsed.data.reason,
  });
  if (error) return formError(academyErrorKey(error));
  refresh();
  return formSuccess('adminAcademy.session.extensionSaved');
}

export async function cancelEnrollment(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_cancel_enrollment', { p_id: parsed.data.id, p_reason: 'admin' });
  if (error) return formError(academyErrorKey(error));
  const ctx = await enrollmentContext(supabase, parsed.data.id);
  if (ctx) {
    const s = ctx.academy_sessions;
    await notify({
      userIds: [ctx.student_id],
      type: 'academy.enrollment_cancelled',
      params: (locale) => ({
        courseTitle: localized(locale, s.academy_courses.title_fr, s.academy_courses.title_en),
        sessionLabel: localized(locale, s.label_fr, s.label_en),
      }),
      link: '/student',
    });
  }
  refresh(ctx ? [`/admin/academy/sessions/${ctx.session_id}`] : []);
  return formSuccess('adminAcademy.session.enrollmentCancelled');
}

// -----------------------------------------------------------------------------
// Séances
// -----------------------------------------------------------------------------
export async function addMeeting(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = meetingSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { columns, translated } = await bilingual({ title: d.title }, d.source_locale);
  const { error } = await supabase.from('academy_meetings').insert({
    ...columns,
    session_id: d.session_id,
    source_locale: d.source_locale,
    starts_at: doualaLocalToIso(d.starts_at),
    duration_minutes: d.duration_minutes,
    external_url: d.external_url,
  });
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/sessions/${d.session_id}`]);
  return formSuccess(translated ? 'adminAcademy.session.meetingAdded' : 'translation.savedUntranslated');
}

export async function deleteMeeting(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  // Enregistrements de la séance : fichiers effacés du stockage d'abord.
  const { data: recs } = await supabase.from('academy_recordings').select('id').eq('meeting_id', parsed.data.id).neq('status', 'deleted');
  for (const r of (recs ?? []) as { id: string }[]) {
    const { error: expErr } = await supabase.rpc('academy_expire_recording', { p_id: r.id });
    if (!expErr) await purgeExpiredRecordings(r.id).catch(() => 0);
  }
  const { error } = await supabase.from('academy_meetings').delete().eq('id', parsed.data.id);
  if (error) return formError(academyErrorKey(error));
  refresh();
  return formSuccess('adminAcademy.session.meetingDeleted');
}

/** Suppression anticipée d'un enregistrement (sinon : automatique après 7 jours). */
export async function deleteRecording(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_expire_recording', { p_id: parsed.data.id });
  if (error) return formError(academyErrorKey(error));
  await purgeExpiredRecordings(parsed.data.id).catch(() => 0);
  refresh();
  return formSuccess('adminAcademy.session.recordingDeleted');
}

/** Réinitialise le visionnage d'un étudiant (ex. après un problème technique). */
export async function resetReplayView(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = z.object({ recording_id: z.uuid('errors.generic'), user_id: z.uuid('errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_reset_replay_view', { p_recording: parsed.data.recording_id, p_user: parsed.data.user_id });
  if (error) return formError(academyErrorKey(error));
  refresh();
  return formSuccess('adminAcademy.session.replayReset');
}

/** Durée d'un visionnage de replay, pour toutes les formations (1 à 48 h). */
export async function setReplayViewHours(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = z.object({ hours: z.coerce.number().int().min(1, 'errors.generic').max(48, 'errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_set_replay_view_hours', { p_hours: parsed.data.hours });
  if (error) return formError(academyErrorKey(error));
  refresh();
  return formSuccess('adminAcademy.session.replayHoursSaved');
}

// -----------------------------------------------------------------------------
// Documents, liens, vidéos
// -----------------------------------------------------------------------------
export async function addLinkResource(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = linkResourceSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { columns, translated } = await bilingual({ title: d.title }, d.source_locale);
  const { error } = await supabase
    .from('academy_resources')
    .insert({ ...columns, session_id: d.session_id, source_locale: d.source_locale, kind: d.kind, url: d.url });
  if (error) return formError(academyErrorKey(error));
  refresh([`/admin/academy/sessions/${d.session_id}`]);
  return formSuccess(translated ? 'adminAcademy.session.resourceAdded' : 'translation.savedUntranslated');
}

export async function addDocument(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = documentResourceSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'errors.checkForm', fieldErrors: { file: 'validation.required' } };
  }
  const fileError = checkDocumentFile(file);
  if (fileError) return { status: 'error', message: 'errors.checkForm', fieldErrors: { file: fileError } };

  const d = parsed.data;
  const supabase = await createClient();
  const path = `${d.session_id}/${crypto.randomUUID()}.pdf`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false });
  if (upErr) return formError('academy.errors.upload_failed');

  const { columns, translated } = await bilingual({ title: d.title }, d.source_locale);
  const { error } = await supabase
    .from('academy_resources')
    .insert({ ...columns, session_id: d.session_id, source_locale: d.source_locale, kind: 'document', file_path: path });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return formError(academyErrorKey(error));
  }
  refresh([`/admin/academy/sessions/${d.session_id}`]);
  return formSuccess(translated ? 'adminAcademy.session.resourceAdded' : 'translation.savedUntranslated');
}

export async function deleteResource(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { data: r } = await supabase.from('academy_resources').select('file_path').eq('id', parsed.data.id).maybeSingle();
  const { error } = await supabase.from('academy_resources').delete().eq('id', parsed.data.id);
  if (error) return formError(academyErrorKey(error));
  if (r?.file_path) await supabase.storage.from(BUCKET).remove([r.file_path]);
  refresh();
  return formSuccess('adminAcademy.session.resourceDeleted');
}

// -----------------------------------------------------------------------------
// Évaluation finale (questionnaire)
// -----------------------------------------------------------------------------
const evaluationPath = (sessionId: string) => `/admin/academy/sessions/${sessionId}/evaluation`;

export async function saveEvaluation(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = evaluationSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  const { columns, translated } = await bilingual({ title: d.title, instructions: d.instructions }, d.source_locale);
  // La base refuse de changer le seuil de réussite une fois une copie rendue.
  const { error } = await supabase.rpc('academy_save_evaluation', {
    p_session: d.session_id,
    p_title_fr: columns.title_fr,
    p_title_en: columns.title_en,
    p_instructions_fr: columns.instructions_fr,
    p_instructions_en: columns.instructions_en,
    p_source_locale: d.source_locale,
    p_pass_mark: d.pass_mark,
    p_max_attempts: d.max_attempts,
  });
  if (error) return formError(academyErrorKey(error));
  refresh([evaluationPath(d.session_id)]);
  return formSuccess(savedMessage(translated));
}

export async function saveQuestion(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const obj = formDataToObject(fd);
  const parsed = questionSchema.safeParse(obj);
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const multiple = d.multiple === '1';
  const choices = parseChoices(obj, multiple);
  if ('error' in choices) return formError(choices.error);

  // Énoncé et propositions traduits en une seule fois.
  const fields: Record<string, string> = { prompt: d.prompt };
  choices.labels.forEach((label, i) => (fields[`c${i}`] = label));
  const { columns, translated } = await bilingual(fields, d.source_locale);
  const col = columns as Record<string, string>;

  const supabase = await createClient();
  // La base revérifie les propositions et refuse toute modification après la première copie.
  const { error } = await supabase.rpc('academy_save_question', {
    p_session: d.session_id,
    p_id: d.id || null,
    p_prompt_fr: col.prompt_fr,
    p_prompt_en: col.prompt_en,
    p_source_locale: d.source_locale,
    p_multiple: multiple,
    p_points: d.points,
    p_choices: choices.labels.map((_, i) => ({ label_fr: col[`c${i}_fr`], label_en: col[`c${i}_en`], correct: choices.correct[i] })),
  });
  if (error) return formError(academyErrorKey(error));
  refresh([evaluationPath(d.session_id)]);
  return formSuccess(translated ? 'adminAcademy.evaluation.questionSaved' : 'translation.savedUntranslated');
}

export async function deleteQuestion(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_delete_question', { p_id: parsed.data.id });
  if (error) return formError(academyErrorKey(error));
  refresh();
  return formSuccess('adminAcademy.evaluation.questionDeleted');
}

export async function setEvaluationStatus(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = z
    .object({ session_id: z.uuid('errors.generic'), status: z.enum(['open', 'closed'], 'errors.generic') })
    .safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const { session_id, status } = parsed.data;
  const supabase = await createClient();
  const { data: before } = await supabase.from('academy_evaluations').select('status').eq('session_id', session_id).maybeSingle();
  const { error } = await supabase.rpc('academy_set_evaluation_status', { p_session: session_id, p_status: status });
  if (error) return formError(academyErrorKey(error));

  // Première ouverture : les inscrits actifs sont prévenus.
  if (status === 'open' && before?.status === 'draft') {
    const [{ data: s }, students] = await Promise.all([
      supabase.from('academy_sessions').select('academy_courses (title_fr, title_en)').eq('id', session_id).maybeSingle(),
      fetchAll<{ student_id: string }>((from, to) =>
        supabase.from('academy_enrollments').select('student_id').eq('session_id', session_id).eq('status', 'active').order('id').range(from, to),
      ).catch(() => []),
    ]);
    const course = (s as unknown as { academy_courses: { title_fr: string; title_en: string } } | null)?.academy_courses;
    if (course && students.length) {
      await notify({
        userIds: students.map((r) => r.student_id),
        type: 'academy.evaluation_opened',
        params: (locale) => ({ courseTitle: localized(locale, course.title_fr, course.title_en) }),
        link: '/student',
      });
    }
  }
  refresh([evaluationPath(session_id)]);
  return formSuccess(status === 'open' ? 'adminAcademy.evaluation.opened' : 'adminAcademy.evaluation.closedMsg');
}

// -----------------------------------------------------------------------------
// Commissions des ambassadeurs
// -----------------------------------------------------------------------------
export async function recordCommissionPayout(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = commissionPayoutSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();
  // La base refuse tout montant supérieur à la commission due.
  const { error } = await supabase.rpc('academy_record_commission_payout', {
    p_enrollment: d.enrollment_id,
    p_amount: d.amount,
    p_method: d.method,
    p_reference: d.reference,
  });
  if (error) return formError(academyErrorKey(error));

  const [{ data: c }, ctx] = await Promise.all([
    supabase.from('academy_commissions').select('ambassador_id').eq('enrollment_id', d.enrollment_id).maybeSingle(),
    enrollmentContext(supabase, d.enrollment_id),
  ]);
  if (c && ctx) {
    const course = ctx.academy_sessions.academy_courses;
    await notify({
      userIds: [c.ambassador_id as string],
      type: 'academy.commission_paid',
      params: (locale) => ({
        courseTitle: localized(locale, course.title_fr, course.title_en),
        amount: formatXAF(d.amount, locale),
        method: payoutMethodLabel(d.method, locale),
        reference: d.reference || '—',
      }),
      link: '/ambassador',
    });
  }
  refresh(['/ambassador']);
  return formSuccess('adminAcademy.commissions.paidMsg');
}

// -----------------------------------------------------------------------------
// Attestations
// -----------------------------------------------------------------------------
export async function revokeCertificate(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = revokeSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_revoke_certificate', { p_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return formError(academyErrorKey(error));
  refresh();
  return formSuccess('adminAcademy.certificates.revokedMsg');
}
