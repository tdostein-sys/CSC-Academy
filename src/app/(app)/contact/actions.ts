'use server';

import { getLocale } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import { contactErrorKey, contactSchema } from '@/lib/contact';
import { localized } from '@/lib/localized';
import { notify } from '@/lib/notifications';

/**
 * Envoi d'un message depuis la page Contact (visiteur ou membre connecté).
 * Double contrôle : validation ici, puis la fonction SQL `contact_submit`
 * revérifie tout (formats, anti-abus, inscription appartenant à l'auteur).
 * Les administrateurs sont prévenus (notification + e-mail).
 */
export async function submitContact(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = contactSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;
  // Robot (champ piège rempli) : réponse identique à un succès, rien n'est enregistré.
  if (d.website) return formSuccess('contact.sent');

  const [user, locale, supabase] = await Promise.all([getSessionUser(), getLocale(), createClient()]);
  const { data: id, error } = await supabase.rpc('contact_submit', {
    p_name: d.name,
    p_email: d.email,
    p_phone: d.phone,
    p_subject: d.subject,
    p_message: d.message,
    p_enrollment: user ? d.enrollment_id : null,
    p_locale: locale === 'en' ? 'en' : 'fr',
  });
  if (error || !id) return formError(contactErrorKey(error));

  try {
    const admin = createAdminClient();
    const [{ data: admins }, { data: row }] = await Promise.all([
      admin.from('user_roles').select('user_id').eq('role', 'admin'),
      admin
        .from('contact_requests')
        .select('enrollment_id, academy_enrollments (academy_sessions (label_fr, label_en, academy_courses (title_fr, title_en)))')
        .eq('id', id as string)
        .maybeSingle(),
    ]);
    const s = (row as unknown as { academy_enrollments: { academy_sessions: { label_fr: string; label_en: string; academy_courses: { title_fr: string; title_en: string } } } | null } | null)
      ?.academy_enrollments?.academy_sessions;
    const excerpt = d.message.length > 300 ? `${d.message.slice(0, 300)}…` : d.message;
    await notify({
      userIds: (admins ?? []).map((a) => a.user_id as string),
      type: 'contact.new_request',
      params: (l) => ({
        name: d.name,
        subject: d.subject,
        excerpt,
        course: s ? `${localized(l, s.academy_courses.title_fr, s.academy_courses.title_en)} (${localized(l, s.label_fr, s.label_en)})` : '',
      }),
      link: '/admin/contact',
    });
  } catch (e) {
    // Le message est enregistré : un échec de notification ne doit pas le faire perdre.
    console.error('[contact] notification admin impossible', (e as Error).message);
  }

  return formSuccess('contact.sent');
}
