'use server';

import { revalidatePath } from 'next/cache';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function markAllNotificationsRead() {
  await assertUser();
  const supabase = await createClient();
  await supabase.rpc('mark_notifications_read', { ids: null });
  revalidatePath('/', 'layout');
}
