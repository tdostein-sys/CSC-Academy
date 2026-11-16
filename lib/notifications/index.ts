import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { publicEnv } from '@/lib/env';
import type { Locale } from '@/lib/types';
import { channels, type ChannelName, type OutboundMessage } from './channels';
import { nextDeliveryState } from './retry';
import { renderNotification, type NotificationType, type TemplateParams } from './templates';

interface NotifyInput<T extends NotificationType> {
  userIds: string[];
  type: T;
  /** Paramètres fixes, ou calculés selon la langue du destinataire (titre FR/EN, montants…). */
  params: TemplateParams[T] | ((locale: Locale) => TemplateParams[T]);
  /** Lien interne (ex. « /ambassador/campaigns/123 »). */
  link?: string;
}

interface RecipientRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_whatsapp: string;
  locale: Locale;
}

/**
 * Point d'entrée unique pour notifier des utilisateurs :
 *  1. crée la notification in-app (dans la langue de chaque destinataire) ;
 *  2. met en file un envoi par canal actif (e-mail, WhatsApp si activé) ;
 *  3. tente un premier envoi immédiat ; les échecs sont repris par
 *     /api/cron/notifications.
 * Ne lève jamais d'erreur bloquante pour l'action métier appelante.
 */
export async function notify<T extends NotificationType>(input: NotifyInput<T>): Promise<void> {
  const userIds = [...new Set(input.userIds)];
  if (userIds.length === 0) return;

  // Lots de 100 destinataires : évite des URL trop longues (filtre « in »)
  // lorsqu'une campagne est annoncée à tous les ambassadeurs.
  let queued = 0;
  for (let i = 0; i < userIds.length; i += NOTIFY_BATCH) {
    queued += await notifyBatch(input, userIds.slice(i, i + NOTIFY_BATCH));
  }
  if (queued === 0) return;
  try {
    // Premier envoi immédiat, limité pour ne pas ralentir l'action appelante ;
    // le reste part via /api/cron/notifications.
    await dispatchPendingDeliveries(Math.min(queued, 25));
  } catch (e) {
    console.error('[notify] envoi immédiat impossible', (e as Error).message);
  }
}

const NOTIFY_BATCH = 100;

async function notifyBatch<T extends NotificationType>(input: NotifyInput<T>, userIds: string[]): Promise<number> {
  try {
    const admin = createAdminClient();
    const { data: recipients, error } = await admin
      .from('profiles')
      .select('id, email, first_name, last_name, phone_whatsapp, locale')
      .in('id', userIds);
    if (error) throw error;

    const rows = (recipients as RecipientRow[]).map((r) => {
      const params =
        typeof input.params === 'function'
          ? (input.params as (l: Locale) => TemplateParams[T])(r.locale)
          : (input.params as TemplateParams[T]);
      const rendered = renderNotification(input.type, r.locale, params);
      return { user_id: r.id, type: input.type, title: rendered.title, body: rendered.body, link: input.link ?? null };
    });
    if (rows.length === 0) return 0;

    const { data: inserted, error: insErr } = await admin.from('notifications').insert(rows).select('id, user_id');
    if (insErr) throw insErr;

    const byUser = new Map((recipients as RecipientRow[]).map((r) => [r.id, r]));
    const deliveries: { notification_id: string; channel: ChannelName; status: 'pending' | 'skipped' }[] = [];
    for (const n of inserted ?? []) {
      const r = byUser.get(n.user_id)!;
      for (const ch of Object.values(channels)) {
        if (!ch.isEnabled()) continue;
        const reachable = ch.canReach(toOutbound(r, '', '', undefined));
        deliveries.push({ notification_id: n.id, channel: ch.name, status: reachable ? 'pending' : 'skipped' });
      }
    }
    if (deliveries.length > 0) {
      const { error: dErr } = await admin.from('notification_deliveries').insert(deliveries);
      if (dErr) throw dErr;
    }
    return deliveries.filter((d) => d.status === 'pending').length;
  } catch (e) {
    console.error('[notify] échec', input.type, (e as Error).message);
    return 0;
  }
}

function toOutbound(r: RecipientRow, title: string, body: string, link: string | null | undefined): OutboundMessage {
  return {
    recipient: {
      email: r.email,
      name: `${r.first_name} ${r.last_name}`.trim(),
      phone: r.phone_whatsapp,
      locale: r.locale,
    },
    title,
    body,
    url: link ? `${publicEnv.siteUrl}${link}` : undefined,
  };
}

/** Traite un lot d'envois en attente. Retourne le bilan. */
export async function dispatchPendingDeliveries(limit = 50): Promise<{ sent: number; failed: number; retried: number }> {
  const admin = createAdminClient();
  const result = { sent: 0, failed: 0, retried: 0 };

  const { data: claimed, error } = await admin.rpc('claim_notification_deliveries', { p_limit: limit });
  if (error) throw error;
  if (!claimed || claimed.length === 0) return result;

  const notificationIds = [...new Set(claimed.map((d: { notification_id: string }) => d.notification_id))];
  const { data: notifs, error: nErr } = await admin
    .from('notifications')
    .select('id, title, body, link, profiles:user_id (id, email, first_name, last_name, phone_whatsapp, locale)')
    .in('id', notificationIds);
  if (nErr) throw nErr;
  const notifById = new Map(
    (notifs ?? []).map((n) => [n.id as string, n as unknown as { title: string; body: string; link: string | null; profiles: RecipientRow }]),
  );

  for (const d of claimed as { id: string; notification_id: string; channel: ChannelName; attempts: number }[]) {
    const n = notifById.get(d.notification_id);
    const channel = channels[d.channel];
    try {
      if (!n) throw new Error('notification introuvable');
      if (!channel.isEnabled()) {
        await admin.from('notification_deliveries').update({ status: 'skipped' }).eq('id', d.id);
        continue;
      }
      await channel.send(toOutbound(n.profiles, n.title, n.body, n.link));
      await admin
        .from('notification_deliveries')
        .update({ status: 'sent', sent_at: new Date().toISOString(), last_error: null })
        .eq('id', d.id);
      result.sent += 1;
    } catch (e) {
      const next = nextDeliveryState(d.attempts);
      await admin
        .from('notification_deliveries')
        .update({
          status: next.status,
          last_error: (e as Error).message.slice(0, 500),
          next_attempt_at: new Date(Date.now() + next.delayMinutes * 60_000).toISOString(),
        })
        .eq('id', d.id);
      if (next.status === 'failed') result.failed += 1;
      else result.retried += 1;
    }
  }
  return result;
}
