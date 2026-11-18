'use server';

import { revalidatePath } from 'next/cache';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import { profileSchema } from '@/lib/validation/auth';

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.sessionExpired');

  const parsed = profileSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  // Client utilisateur : la RLS et les privilèges de colonnes limitent la mise à
  // jour à son propre profil et aux champs autorisés.
  const supabase = await createClient();
  const { error } = await supabase.from('profiles').update(parsed.data).eq('id', user.id);
  if (error) return formError('errors.generic');

  revalidatePath('/', 'layout');
  return formSuccess('profile.saved');
}
