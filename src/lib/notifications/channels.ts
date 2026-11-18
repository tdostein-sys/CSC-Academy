import 'server-only';
import { getEmailProvider } from '@/lib/email';
import type { Locale } from '@/lib/types';

export type ChannelName = 'email' | 'whatsapp';

export interface OutboundMessage {
  recipient: { email: string; name: string; phone: string; locale: Locale };
  title: string;
  body: string;
  url?: string;
}

export interface NotificationChannel {
  readonly name: ChannelName;
  isEnabled(): boolean;
  /** Le destinataire peut-il être joint par ce canal ? */
  canReach(msg: OutboundMessage): boolean;
  send(msg: OutboundMessage): Promise<void>;
}

export const emailChannel: NotificationChannel = {
  name: 'email',
  isEnabled: () => (process.env.EMAIL_PROVIDER || 'console') !== 'none',
  canReach: (msg) => Boolean(msg.recipient.email),
  async send(msg) {
    await getEmailProvider().send({
      to: msg.recipient.email,
      toName: msg.recipient.name,
      subject: msg.title,
      body: msg.body,
      actionUrl: msg.url,
      actionLabel: msg.recipient.locale === 'en' ? 'Open CSC' : 'Ouvrir CSC',
      locale: msg.recipient.locale,
    });
  },
};

/**
 * Canal WhatsApp — DÉSACTIVÉ par défaut (WHATSAPP_ENABLED=false).
 * Prévu pour WhatsApp Cloud API (Meta). En production, Meta impose des
 * « message templates » approuvés pour les messages initiés par l'entreprise :
 * adaptez `send` pour utiliser vos modèles une fois validés.
 */
export const whatsappChannel: NotificationChannel = {
  name: 'whatsapp',
  isEnabled: () => process.env.WHATSAPP_ENABLED === 'true',
  canReach: (msg) => /^\+\d{8,15}$/.test(msg.recipient.phone),
  async send(msg) {
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneId || !token) throw new Error('WhatsApp non configuré');
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.recipient.phone.replace('+', ''),
        type: 'text',
        text: { preview_url: Boolean(msg.url), body: `*${msg.title}*\n\n${msg.body}${msg.url ? `\n\n${msg.url}` : ''}` },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${(await res.text()).slice(0, 300)}`);
  },
};

export const channels: Record<ChannelName, NotificationChannel> = {
  email: emailChannel,
  whatsapp: whatsappChannel,
};
