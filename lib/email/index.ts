import 'server-only';
import { renderEmailHtml, renderEmailText } from './layout';

export interface EmailMessage {
  to: string;
  toName?: string;
  subject: string;
  /** Texte brut (paragraphes séparés par des lignes vides). */
  body: string;
  actionUrl?: string;
  actionLabel?: string;
  locale?: 'fr' | 'en';
}

export interface EmailProvider {
  readonly name: string;
  send(msg: EmailMessage): Promise<void>;
}

class ConsoleProvider implements EmailProvider {
  readonly name = 'console';
  async send(msg: EmailMessage) {
    console.info(`\n[email:console] → ${msg.to}\nSujet : ${msg.subject}\n${renderEmailText(msg)}\n`);
  }
}

/** Brevo (ex-Sendinblue) — API transactionnelle v3. Gratuit : 300 e-mails/jour. */
export class BrevoProvider implements EmailProvider {
  readonly name = 'brevo';
  constructor(
    private readonly apiKey: string,
    private readonly senderEmail: string,
    private readonly senderName: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(msg: EmailMessage) {
    const res = await this.fetchImpl('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': this.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: this.senderEmail, name: this.senderName },
        to: [{ email: msg.to, ...(msg.toName ? { name: msg.toName } : {}) }],
        subject: msg.subject,
        htmlContent: renderEmailHtml(msg),
        textContent: renderEmailText(msg),
      }),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

/**
 * EmailJS — appel REST côté serveur. Nécessite, dans EmailJS :
 * Account > Security > « Allow EmailJS API for non-browser applications »,
 * et un modèle générique utilisant {{to_email}}, {{to_name}}, {{subject}},
 * {{message}}, {{message_html}}, {{action_url}}, {{action_label}}.
 */
export class EmailJsProvider implements EmailProvider {
  readonly name = 'emailjs';
  constructor(
    private readonly cfg: { serviceId: string; templateId: string; publicKey: string; privateKey: string },
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(msg: EmailMessage) {
    const res = await this.fetchImpl('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        service_id: this.cfg.serviceId,
        template_id: this.cfg.templateId,
        user_id: this.cfg.publicKey,
        accessToken: this.cfg.privateKey,
        template_params: {
          to_email: msg.to,
          to_name: msg.toName ?? '',
          subject: msg.subject,
          message: msg.body,
          message_html: renderEmailHtml(msg),
          action_url: msg.actionUrl ?? '',
          action_label: msg.actionLabel ?? '',
        },
      }),
    });
    if (!res.ok) throw new Error(`EmailJS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} manquant dans .env.local`);
  return v;
}

/** Sélectionne le fournisseur selon EMAIL_PROVIDER (console par défaut). */
export function getEmailProvider(): EmailProvider {
  const provider = (process.env.EMAIL_PROVIDER ?? 'console').toLowerCase();
  const fromName = process.env.EMAIL_FROM_NAME ?? 'CSC';
  switch (provider) {
    case 'brevo':
      return new BrevoProvider(required('BREVO_API_KEY'), required('BREVO_SENDER_EMAIL'), fromName);
    case 'emailjs':
      return new EmailJsProvider({
        serviceId: required('EMAILJS_SERVICE_ID'),
        templateId: required('EMAILJS_TEMPLATE_ID'),
        publicKey: required('EMAILJS_PUBLIC_KEY'),
        privateKey: required('EMAILJS_PRIVATE_KEY'),
      });
    case 'console':
      return new ConsoleProvider();
    default:
      throw new Error(`EMAIL_PROVIDER inconnu : ${provider}`);
  }
}
