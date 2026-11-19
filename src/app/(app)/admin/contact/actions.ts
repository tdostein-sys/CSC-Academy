'use server';

import { revalidatePath } from 'next/cache';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import { contactErrorKey, contactSettingsSchema, contactUpdateSchema } from '@/lib/contact';

/* Double contrôle : assertAdmin() ici, puis les fonctions SQL revérifient le rôle. */

export async function updateContactRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await assertAdmin().catch(() => null))) return formError('errors.forbidden');
  const parsed = contactUpdateSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('contact_update_request', {
    p_id: parsed.data.id,
    p_status: parsed.data.status,
    p_note: parsed.data.admin_note,
  });
  if (error) return formError(contactErrorKey(error));
  revalidatePath('/admin/contact');
  return formSuccess('adminContact.saved');
}

export async function updateContactSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await assertAdmin().catch(() => null))) return formError('errors.forbidden');
  const parsed = contactSettingsSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc('contact_update_settings', {
    p_whatsapp: parsed.data.whatsapp,
    p_phone: parsed.data.phone,
    p_email: parsed.data.email,
  });
  if (error) return formError(contactErrorKey(error));
  revalidatePath('/contact');
  revalidatePath('/admin/contact');
  revalidatePath('/student', 'layout');
  return formSuccess('adminContact.settingsSaved');
}
