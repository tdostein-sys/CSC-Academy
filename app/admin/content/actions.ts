'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import { contentSchema } from '@/lib/validation/content';
import { bilingual } from '@/lib/translation';

export async function saveContent(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertAdmin().catch(() => null);
  if (!user) return formError('errors.forbidden');

  const parsed = contentSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  // Saisie dans une langue → traduction automatique de l'autre.
  const { columns, translated } = await bilingual({ body: parsed.data.body }, parsed.data.source_locale);

  // La fonction SQL revérifie le rôle admin et journalise l'action.
  const supabase = await createClient();
  const { error } = await supabase.rpc('update_site_content', {
    p_key: parsed.data.key,
    p_body_fr: columns.body_fr,
    p_body_en: columns.body_en,
    p_source_locale: parsed.data.source_locale,
  });
  if (error) return formError(error.message.includes('forbidden') ? 'errors.forbidden' : 'errors.generic');

  revalidatePath('/ambassador');
  revalidatePath('/admin/content');
  return formSuccess(translated ? 'admin.content.saved' : 'translation.savedUntranslated');
}
