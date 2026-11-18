'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formDataToObject, formError, fromZodError, type FormState } from '@/lib/forms';
import { answersFromFormData, enrollSchema } from '@/lib/validation/academy';
import { academyErrorKey } from '@/lib/academy/errors';
import type { Paper } from '@/lib/academy/types';
import { notifyCertificate } from '@/lib/academy/notify';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { notify } from '@/lib/notifications';

/*
 * Actions des étudiants. Les règles (places, code de parrainage, annulation
 * sans paiement) sont vérifiées par les fonctions SQL ; ici on ne fait que
 * valider la saisie, appeler la base et prévenir les intéressés.
 */

interface SessionContext {
  label_fr: string;
  label_en: string;
  academy_courses: { title_fr: string; title_en: string };
}

async function sessionContext(supabase: Awaited<ReturnType<typeof createClient>>, sessionId: string) {
  const { data } = await supabase
    .from('academy_sessions')
    .select('label_fr, label_en, academy_courses (title_fr, title_en)')
    .eq('id', sessionId)
    .maybeSingle();
  return data as unknown as SessionContext | null;
}

export async function enrollInSession(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.forbidden');
  const parsed = enrollSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const { session_id, referral_code } = parsed.data;

  const supabase = await createClient();
  const { data: enrollmentId, error } = await supabase.rpc('academy_enroll', {
    p_session: session_id,
    p_referral_code: referral_code || null,
  });
  if (error || !enrollmentId) {
    const key = academyErrorKey(error);
    // Erreur liée au code : affichée sous le champ concerné.
    if (key.includes('referral')) return { status: 'error', message: 'errors.checkForm', fieldErrors: { referral_code: key } };
    return formError(key);
  }

  const [ctx, { data: first }, { data: enrollment }] = await Promise.all([
    sessionContext(supabase, session_id),
    supabase.from('academy_installments').select('amount').eq('session_id', session_id).eq('rank', 1).maybeSingle(),
    supabase.from('academy_enrollments').select('hold_expires_at').eq('id', enrollmentId).maybeSingle(),
  ]);
  if (ctx) {
    await notify({
      userIds: [user.id],
      type: 'academy.enrolled',
      params: (locale) => ({
        courseTitle: localized(locale, ctx.academy_courses.title_fr, ctx.academy_courses.title_en),
        sessionLabel: localized(locale, ctx.label_fr, ctx.label_en),
        firstAmount: formatXAF(first?.amount ?? 0, locale),
        holdUntil: formatDate(enrollment?.hold_expires_at ?? null, locale, true),
      }),
      link: `/student/${enrollmentId}`,
    });
    // Les administrateurs sont prévenus pour suivre le paiement.
    try {
      const { data: admins } = await createAdminClient().from('user_roles').select('user_id').eq('role', 'admin');
      const studentName = `${user.profile.first_name} ${user.profile.last_name.charAt(0)}.`.trim();
      await notify({
        userIds: (admins ?? []).map((a) => a.user_id as string),
        type: 'academy.new_enrollment',
        params: (locale) => ({
          studentName,
          courseTitle: localized(locale, ctx.academy_courses.title_fr, ctx.academy_courses.title_en),
          sessionLabel: localized(locale, ctx.label_fr, ctx.label_en),
        }),
        link: `/admin/academy/sessions/${session_id}`,
      });
    } catch (e) {
      console.error('[academy] notification admin impossible', (e as Error).message);
    }
  }

  revalidatePath('/academy', 'layout');
  revalidatePath('/student', 'layout');
  redirect(`/student/${enrollmentId}?enrolled=1`);
}

/**
 * Copie de l'évaluation finale. La base corrige, limite le nombre de
 * tentatives, refuse un étudiant bloqué et délivre l'attestation si tout est
 * payé : l'interface ne connaît jamais les bonnes réponses.
 */
export async function submitEvaluation(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.sessionExpired');
  const parsed = z.object({ enrollment_id: z.uuid('errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const enrollmentId = parsed.data.enrollment_id;

  const supabase = await createClient();
  const { data: e } = await supabase
    .from('academy_enrollments')
    .select('session_id')
    .eq('id', enrollmentId)
    .eq('student_id', user.id)
    .maybeSingle();
  if (!e) return formError('academy.errors.not_found');

  const { data: paper, error: paperErr } = await supabase.rpc('academy_evaluation_paper', { p_session: e.session_id });
  if (paperErr || !paper) return formError(academyErrorKey(paperErr));
  const ids = ((paper as Paper).questions ?? []).map((q) => q.id);
  const answers = answersFromFormData(fd, ids);
  if (ids.some((id) => answers[id].length === 0)) return formError('validation.answerAll');

  const { data, error } = await supabase.rpc('academy_submit_evaluation', { p_session: e.session_id, p_answers: answers });
  if (error) return formError(academyErrorKey(error));
  const result = (Array.isArray(data) ? data[0] : data) as { passed: boolean; certificate_id: string | null } | undefined;

  if (result?.certificate_id) await notifyCertificate(supabase, result.certificate_id);
  revalidatePath('/student', 'layout');
  redirect(`/student/${enrollmentId}?evaluated=${result?.passed ? 'passed' : 'failed'}#evaluation-title`);
}

export async function cancelMyEnrollment(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.forbidden');
  const parsed = z.object({ id: z.uuid('errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_cancel_enrollment', { p_id: parsed.data.id, p_reason: null });
  if (error) return formError(academyErrorKey(error));

  revalidatePath('/academy', 'layout');
  revalidatePath('/student', 'layout');
  redirect('/student?cancelled=1');
}
