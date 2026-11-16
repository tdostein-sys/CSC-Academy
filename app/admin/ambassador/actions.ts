'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formError, formSuccess, fromZodError, type FormState } from '@/lib/forms';
import {
  campaignSchema,
  checkModopFile,
  MODOP_MIME_TYPES,
  payoutSchema,
  rejectSchema,
  suspendSchema,
  type CampaignInput,
} from '@/lib/validation/ambassador';
import { ambassadorErrorKey } from '@/lib/ambassador/errors';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { dispatchPendingDeliveries, notify } from '@/lib/notifications';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { bilingual } from '@/lib/translation';

/*
 * Actions d'administration du module Ambassador.
 * Double contrôle : assertAdmin() ici, PUIS la fonction SQL / la RLS qui
 * revérifient le rôle admin et les règles métier (montant figé, clôture…).
 */

const BUCKET = 'campaign-files';
const idSchema = z.object({ id: z.uuid('errors.generic') });

function refresh(campaignId?: string) {
  revalidatePath('/admin/ambassador', 'layout');
  revalidatePath('/ambassador', 'layout');
  if (campaignId) revalidatePath(`/admin/ambassador/campaigns/${campaignId}`);
}

async function adminOrNull() {
  return assertAdmin().catch(() => null);
}

/**
 * Colonnes à enregistrer. Le contenu est saisi dans UNE langue et traduit
 * automatiquement dans l'autre (une seule fois, ici). Le montant et le
 * minimum ne sont envoyés que pour un brouillon (figés ensuite par la base).
 */
async function campaignColumns(d: CampaignInput, includeFrozen: boolean) {
  const { columns, translated } = await bilingual({ title: d.title, summary: d.summary, modop: d.modop }, d.source_locale);
  return {
    translated,
    values: {
      ...columns,
      source_locale: d.source_locale,
      video_url: d.video_url,
      ends_on: d.ends_on,
      ...(includeFrozen ? { amount_per_account: d.amount_per_account, min_volume: d.min_volume } : {}),
    },
  };
}

function uploadedFile(fd: FormData): File | null {
  const f = fd.get('modop_file');
  return f instanceof File && f.size > 0 ? f : null;
}

async function uploadModop(supabase: Awaited<ReturnType<typeof createClient>>, campaignId: string, file: File) {
  const ext = MODOP_MIME_TYPES[file.type];
  const path = `${campaignId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  return error ? null : path;
}

// -----------------------------------------------------------------------------
// Campagnes
// -----------------------------------------------------------------------------
export async function createCampaign(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = campaignSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const file = uploadedFile(fd);
  const fileError = file ? checkModopFile(file) : null;
  if (fileError) return { status: 'error', message: 'errors.checkForm', fieldErrors: { modop_file: fileError } };

  const supabase = await createClient();
  const { values, translated } = await campaignColumns(parsed.data, true);
  const { data, error } = await supabase.from('campaigns').insert(values).select('id').single();
  if (error || !data) return formError(ambassadorErrorKey(error));

  if (file) {
    const path = await uploadModop(supabase, data.id, file);
    if (!path) return formError('ambassador.errors.upload_failed');
    await supabase.from('campaigns').update({ modop_file_path: path }).eq('id', data.id);
  }
  refresh();
  redirect(`/admin/ambassador/campaigns/${data.id}?created=1${translated ? '' : '&untranslated=1'}`);
}

export async function updateCampaign(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const ids = idSchema.safeParse(formDataToObject(fd));
  if (!ids.success) return formError('errors.generic');
  const parsed = campaignSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const file = uploadedFile(fd);
  const fileError = file ? checkModopFile(file) : null;
  if (fileError) return { status: 'error', message: 'errors.checkForm', fieldErrors: { modop_file: fileError } };

  const supabase = await createClient();
  const id = ids.data.id;
  const { data: current } = await supabase.from('campaigns').select('status, modop_file_path').eq('id', id).single();
  if (!current) return formError('ambassador.errors.not_found');
  if (current.status === 'closed') return formError('ambassador.errors.campaign_closed');

  let filePath: string | null | undefined; // undefined = inchangé
  if (file) {
    const path = await uploadModop(supabase, id, file);
    if (!path) return formError('ambassador.errors.upload_failed');
    filePath = path;
  } else if (parsed.data.remove_file === 'on') {
    filePath = null;
  }

  const { values, translated } = await campaignColumns(parsed.data, current.status === 'draft');
  const { error } = await supabase
    .from('campaigns')
    .update({ ...values, ...(filePath !== undefined ? { modop_file_path: filePath } : {}) })
    .eq('id', id);
  if (error) return formError(ambassadorErrorKey(error));

  // Ancien fichier remplacé ou supprimé : on le retire du stockage.
  if (filePath !== undefined && current.modop_file_path) {
    await supabase.storage.from(BUCKET).remove([current.modop_file_path]);
  }
  refresh(id);
  return formSuccess(translated ? 'adminAmbassador.form.saved' : 'translation.savedUntranslated');
}

export async function deleteCampaign(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { data: c } = await supabase.from('campaigns').select('status, modop_file_path').eq('id', parsed.data.id).single();
  if (!c) return formError('ambassador.errors.not_found');
  if (c.status !== 'draft') return formError('ambassador.errors.invalid_status_transition');

  const { error, count } = await supabase.from('campaigns').delete({ count: 'exact' }).eq('id', parsed.data.id);
  if (error || count === 0) return formError('ambassador.errors.invalid_status_transition');
  if (c.modop_file_path) await supabase.storage.from(BUCKET).remove([c.modop_file_path]);
  refresh();
  redirect('/admin/ambassador/campaigns');
}

export async function launchCampaign(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const id = parsed.data.id;

  const supabase = await createClient();
  const { error } = await supabase.rpc('launch_campaign', { p_id: id });
  if (error) return formError(ambassadorErrorKey(error));

  // Annonce à tous les ambassadeurs actifs, dans la langue de chacun.
  const [{ data: c }, ambassadors] = await Promise.all([
    supabase.from('campaigns').select('title_fr, title_en, ends_on').eq('id', id).single(),
    fetchAll<{ user_id: string }>((from, to) =>
      supabase.from('ambassadors').select('user_id').eq('status', 'active').order('number').range(from, to),
    ).catch(() => []),
  ]);
  if (c && ambassadors.length) {
    await notify({
      userIds: ambassadors.map((a) => a.user_id as string),
      type: 'campaign.launched',
      params: (locale) => ({
        campaignTitle: localized(locale, c.title_fr, c.title_en),
        endDate: c.ends_on ? formatDate(c.ends_on, locale) : null,
      }),
      link: `/ambassador/campaigns/${id}`,
    });
  }
  refresh(id);
  return formSuccess('adminAmbassador.detail.launched');
}

export async function closeCampaign(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');
  const id = parsed.data.id;

  const supabase = await createClient();
  // La fonction SQL refuse la clôture s'il reste des soumissions en attente ou un dû.
  const { error } = await supabase.rpc('close_campaign', { p_id: id });
  if (error) return formError(ambassadorErrorKey(error));

  const [{ data: c }, parts, subs] = await Promise.all([
    supabase.from('campaigns').select('title_fr, title_en').eq('id', id).single(),
    fetchAll<{ ambassador_id: string }>((from, to) =>
      supabase
        .from('campaign_participations')
        .select('ambassador_id')
        .eq('campaign_id', id)
        .eq('participates', true)
        .order('ambassador_id')
        .range(from, to),
    ).catch(() => []),
    fetchAll<{ ambassador_id: string }>((from, to) =>
      supabase.from('submissions').select('ambassador_id').eq('campaign_id', id).order('id').range(from, to),
    ).catch(() => []),
  ]);
  const recipients = [...parts, ...subs].map((r) => r.ambassador_id);
  if (c && recipients.length) {
    await notify({
      userIds: recipients,
      type: 'campaign.closed',
      params: (locale) => ({ campaignTitle: localized(locale, c.title_fr, c.title_en) }),
      link: `/ambassador/campaigns/${id}`,
    });
  }
  refresh(id);
  return formSuccess('adminAmbassador.detail.closed');
}

// -----------------------------------------------------------------------------
// Soumissions
// -----------------------------------------------------------------------------
async function submissionContext(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from('submissions')
    .select('ambassador_id, binance_uid, amount, reject_reason, campaign_id, campaigns (title_fr, title_en)')
    .eq('id', id)
    .single();
  return data as unknown as {
    ambassador_id: string;
    binance_uid: string;
    amount: number;
    reject_reason: string | null;
    campaign_id: string;
    campaigns: { title_fr: string; title_en: string };
  } | null;
}

export async function validateSubmission(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_submission', { p_id: parsed.data.id, p_decision: 'validated', p_reason: null });
  if (error) return formError(ambassadorErrorKey(error));

  const s = await submissionContext(supabase, parsed.data.id);
  if (s) {
    await notify({
      userIds: [s.ambassador_id],
      type: 'submission.validated',
      params: (locale) => ({
        campaignTitle: localized(locale, s.campaigns.title_fr, s.campaigns.title_en),
        binanceUid: s.binance_uid,
        amount: formatXAF(s.amount, locale),
      }),
      link: `/ambassador/campaigns/${s.campaign_id}`,
    });
  }
  refresh(s?.campaign_id);
  return formSuccess('adminAmbassador.submissions.validated');
}

export async function rejectSubmission(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = rejectSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('review_submission', {
    p_id: parsed.data.id,
    p_decision: 'rejected',
    p_reason: parsed.data.reason,
  });
  if (error) return formError(ambassadorErrorKey(error));

  const s = await submissionContext(supabase, parsed.data.id);
  if (s) {
    await notify({
      userIds: [s.ambassador_id],
      type: 'submission.rejected',
      params: (locale) => ({
        campaignTitle: localized(locale, s.campaigns.title_fr, s.campaigns.title_en),
        binanceUid: s.binance_uid,
        reason: parsed.data.reason,
      }),
      link: `/ambassador/campaigns/${s.campaign_id}`,
    });
  }
  refresh(s?.campaign_id);
  return formSuccess('adminAmbassador.submissions.rejected');
}

export async function deleteRejectedSubmission(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = idSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_rejected_submission', { p_id: parsed.data.id });
  if (error) return formError(ambassadorErrorKey(error));
  refresh();
  return formSuccess('adminAmbassador.submissions.deleted');
}

// -----------------------------------------------------------------------------
// Paiements
// -----------------------------------------------------------------------------
export async function recordPayout(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = payoutSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  // La fonction SQL refuse tout montant supérieur au reste dû.
  const { error } = await supabase.rpc('record_payout', {
    p_campaign: d.campaign_id,
    p_ambassador: d.ambassador_id,
    p_amount: d.amount,
    p_method: d.method,
    p_reference: d.reference,
  });
  if (error) return formError(ambassadorErrorKey(error));

  const { data: c } = await supabase.from('campaigns').select('title_fr, title_en').eq('id', d.campaign_id).single();
  if (c) {
    await notify({
      userIds: [d.ambassador_id],
      type: 'payout.marked_paid',
      params: (locale) => ({
        campaignTitle: localized(locale, c.title_fr, c.title_en),
        amount: formatXAF(d.amount, locale),
        method: payoutMethodLabel(d.method, locale),
        reference: d.reference || '—',
      }),
      link: '/ambassador',
    });
  }
  refresh(d.campaign_id);
  return formSuccess('adminAmbassador.payout.recorded');
}

// -----------------------------------------------------------------------------
// Ambassadeurs
// -----------------------------------------------------------------------------
export async function suspendAmbassador(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = suspendSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_ambassador_status', {
    p_user: parsed.data.user_id,
    p_status: 'suspended',
    p_reason: parsed.data.reason,
  });
  if (error) return formError(ambassadorErrorKey(error));
  await notify({ userIds: [parsed.data.user_id], type: 'ambassador.suspended', params: { reason: parsed.data.reason }, link: '/ambassador' });
  refresh();
  return formSuccess('adminAmbassador.ambassadors.suspended');
}

export async function reactivateAmbassador(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const parsed = z.object({ user_id: z.uuid('errors.generic') }).safeParse(formDataToObject(fd));
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('set_ambassador_status', {
    p_user: parsed.data.user_id,
    p_status: 'active',
    p_reason: null,
  });
  if (error) return formError(ambassadorErrorKey(error));
  await notify({ userIds: [parsed.data.user_id], type: 'ambassador.reactivated', params: {}, link: '/ambassador' });
  refresh();
  return formSuccess('adminAmbassador.ambassadors.reactivated');
}

// -----------------------------------------------------------------------------
// File d'envoi des messages aux ambassadeurs
// -----------------------------------------------------------------------------
/** Envoie immédiatement les messages en attente dont l'heure est venue. */
export async function processQueue(...args: [FormState, FormData]): Promise<FormState> {
  void args;
  if (!(await adminOrNull())) return formError('errors.forbidden');
  try {
    const r = await dispatchPendingDeliveries(100);
    revalidatePath('/admin/ambassador/queue');
    // Les compteurs de la page se mettent à jour ; on précise seulement s'il y a eu des échecs.
    return formSuccess(r.failed + r.retried > 0 ? 'adminAmbassador.queue.processedWithErrors' : 'adminAmbassador.queue.processed');
  } catch (e) {
    console.error('[queue] traitement impossible', (e as Error).message);
    return formError('errors.generic');
  }
}

/** Remet en file un envoi en échec (id) ou tous les échecs (sans id), puis envoie. */
export async function retryDeliveries(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await adminOrNull())) return formError('errors.forbidden');
  const raw = formDataToObject(fd).id;
  const parsed = z.uuid().optional().safeParse(raw || undefined);
  if (!parsed.success) return formError('errors.generic');

  const supabase = await createClient();
  const { error } = await supabase.rpc('retry_failed_deliveries', { p_ids: parsed.data ? [parsed.data] : null });
  if (error) return formError(ambassadorErrorKey(error));
  try {
    await dispatchPendingDeliveries(100);
  } catch (e) {
    console.error('[queue] envoi immédiat impossible', (e as Error).message);
  }
  revalidatePath('/admin/ambassador/queue');
  return formSuccess('adminAmbassador.queue.retried');
}
