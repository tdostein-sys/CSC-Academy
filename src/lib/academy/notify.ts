import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import { localized } from '@/lib/localized';
import { notify } from '@/lib/notifications';

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Prévient l'étudiant que son attestation est prête (après réussite ou dernier paiement). */
export async function notifyCertificate(supabase: Supabase, certificateId: string) {
  const { data: c } = await supabase
    .from('academy_certificates')
    .select('student_id, enrollment_id, number, course_title_fr, course_title_en')
    .eq('id', certificateId)
    .maybeSingle();
  if (!c) return;
  await notify({
    userIds: [c.student_id as string],
    type: 'academy.certificate_issued',
    params: (locale) => ({ courseTitle: localized(locale, c.course_title_fr, c.course_title_en), number: c.number as string }),
    link: `/student/${c.enrollment_id}`,
  });
}
