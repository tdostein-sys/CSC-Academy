'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/routes';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Marque comme lues MES notifications non lues (la fonction SQL se limite à auth.uid()). */
export async function markAllNotificationsRead() {
  await assertUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_notifications_read', { ids: null });
  if (error) console.error('[notifications] tout marquer comme lu', error.message);
  revalidatePath('/', 'layout');
}

/** Marque UNE notification comme lue (bouton « Marquer comme lu »). */
export async function markNotificationRead(fd: FormData) {
  await assertUser();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_notifications_read', { ids: [id] });
  if (error) console.error('[notifications] marquer comme lu', error.message);
  revalidatePath('/', 'layout');
}

/**
 * « Ouvrir » : marque la notification comme lue PUIS ouvre la page liée.
 * Le lien est relu en base (jamais celui envoyé par le navigateur) et
 * n'est suivi que s'il s'agit d'une adresse interne.
 */
export async function openNotification(fd: FormData) {
  const user = await assertUser();
  const id = String(fd.get('id') ?? '');
  if (!UUID.test(id)) redirect('/notifications');
  const supabase = await createClient();
  const [{ data }, { error }] = await Promise.all([
    supabase.from('notifications').select('link').eq('id', id).eq('user_id', user.id).maybeSingle(),
    supabase.rpc('mark_notifications_read', { ids: [id] }),
  ]);
  if (error) console.error('[notifications] ouverture', error.message);
  revalidatePath('/', 'layout');
  redirect(safeNextPath((data as { link: string | null } | null)?.link, '/notifications'));
}
