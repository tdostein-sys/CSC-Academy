'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, type FormState } from '@/lib/forms';
import { academyErrorKey } from '@/lib/academy/errors';

/**
 * Lancement (ou reprise) du visionnage d'un replay. La base vérifie
 * l'inscription et les paiements, crée le visionnage unique et refuse tout
 * nouveau visionnage une fois le délai écoulé.
 */
export async function startReplay(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await assertUser().catch(() => null);
  if (!user) return formError('errors.forbidden');
  const parsed = z.object({ id: z.uuid('errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_replay_access', { p_recording: parsed.data.id, p_start: true });
  if (error) return formError(academyErrorKey(error));

  revalidatePath('/student', 'layout');
  redirect(`/student/replays/${parsed.data.id}`);
}
