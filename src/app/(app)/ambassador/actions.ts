'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { assertUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import { submissionSchema } from '@/lib/validation/ambassador';
import { ambassadorErrorKey } from '@/lib/ambassador/errors';
import { notify } from '@/lib/notifications';

/*
 * Actions de l'ambassadeur. Chaque action passe par une fonction SQL qui
 * revérifie l'identité, le statut d'ambassadeur et l'état de la campagne :
 * l'interface n'est jamais la seule barrière.
 */

const idSchema = z.object({ id: z.uuid('errors.generic') });

async function sessionOrError() {
  return assertUser().catch(() => null);
}

// Signature imposée par useActionState (état précédent, données du formulaire), inutilisés ici.
export async function joinAmbassador(...args: [FormState, FormData]): Promise<FormState> {
  void args;
  const user = await sessionOrError();
  if (!user) return formError('errors.sessionExpired');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('become_ambassador');
  if (error) return formError(ambassadorErrorKey(error));

  if (!user.ambassador) {
    await notify({ userIds: [user.id], type: 'ambassador.joined', params: { code: String(data) }, link: '/ambassador' });
  }
  revalidatePath('/', 'layout');
  return formSuccess('ambassador.joined');
}

export async function setParticipation(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await sessionOrError();
  if (!user) return formError('errors.sessionExpired');

  const parsed = z
    .object({ campaign_id: z.uuid('errors.generic'), participates: z.enum(['yes', 'no'], 'errors.generic') })
    .safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_participation', {
    p_campaign: parsed.data.campaign_id,
    p_participates: parsed.data.participates === 'yes',
  });
  if (error) return formError(ambassadorErrorKey(error));

  revalidatePath(`/ambassador/campaigns/${parsed.data.campaign_id}`);
  revalidatePath('/ambassador');
  return formSuccess('ambassador.campaign.participationSaved');
}

export async function submitAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await sessionOrError();
  if (!user) return formError('errors.sessionExpired');

  const parsed = submissionSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('submit_account', {
    p_campaign: parsed.data.campaign_id,
    p_binance_uid: parsed.data.binance_uid,
    p_volume: parsed.data.trading_volume,
  });
  if (error) {
    const key = ambassadorErrorKey(error);
    // Erreur rattachée au champ concerné pour un affichage plus clair.
    if (key.endsWith('binance_uid_taken') || key.endsWith('binance_uid_invalid')) {
      return { status: 'error', message: 'errors.checkForm', fieldErrors: { binance_uid: key } };
    }
    if (key.endsWith('volume_below_minimum') || key.endsWith('volume_invalid')) {
      return { status: 'error', message: 'errors.checkForm', fieldErrors: { trading_volume: key } };
    }
    return formError(key);
  }

  revalidatePath(`/ambassador/campaigns/${parsed.data.campaign_id}`);
  return formSuccess('ambassador.campaign.submitted');
}

export async function cancelSubmission(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await sessionOrError();
  if (!user) return formError('errors.sessionExpired');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_submission', { p_id: parsed.data.id });
  if (error) return formError(ambassadorErrorKey(error));

  revalidatePath('/ambassador', 'layout');
  return formSuccess('ambassador.campaign.cancelled');
}

export async function confirmPayout(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await sessionOrError();
  if (!user) return formError('errors.sessionExpired');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('confirm_payout', { p_id: parsed.data.id });
  if (error) return formError(ambassadorErrorKey(error));

  revalidatePath('/ambassador', 'layout');
  return formSuccess('ambassador.payouts.confirmed');
}

/** Confirmation de réception d'une commission CSC Academy (ses propres paiements uniquement). */
export async function confirmCommissionPayout(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await sessionOrError();
  if (!user) return formError('errors.sessionExpired');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('academy_confirm_commission_payout', { p_id: parsed.data.id });
  if (error) return formError(ambassadorErrorKey(error));

  revalidatePath('/ambassador', 'layout');
  revalidatePath('/admin/academy', 'layout');
  return formSuccess('ambassador.payouts.confirmed');
}
