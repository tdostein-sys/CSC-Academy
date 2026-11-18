'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, toLocale } from '@/i18n/config';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Change la langue de l'interface (et des e-mails si l'utilisateur est connecté). */
export async function setLocale(value: string) {
  const locale = toLocale(value);
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });

  const user = await getSessionUser();
  if (user && user.profile.locale !== locale) {
    const supabase = await createClient();
    await supabase.from('profiles').update({ locale }).eq('id', user.id);
  }
  revalidatePath('/', 'layout');
}
