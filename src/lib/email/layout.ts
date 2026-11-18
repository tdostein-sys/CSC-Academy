import type { EmailMessage } from './index';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Gabarit HTML léger, styles en ligne (compatibilité clients mail). */
export function renderEmailHtml(msg: EmailMessage): string {
  const paragraphs = msg.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.5">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const button =
    msg.actionUrl && /^https?:\/\//.test(msg.actionUrl)
      ? `<p style="margin:22px 0"><a href="${escapeHtml(msg.actionUrl)}" style="background:#1E7A1E;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(msg.actionLabel ?? (msg.locale === 'en' ? 'Open' : 'Ouvrir'))}</a></p>`
      : '';
  const footer =
    msg.locale === 'en'
      ? 'You receive this e-mail because you have a CSC account.'
      : 'Vous recevez cet e-mail car vous avez un compte CSC.';
  return `<!doctype html><html><body style="margin:0;background:#F4F8F2;font-family:Arial,Helvetica,sans-serif;color:#0F1A14">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:12px;border:1px solid #DDE7D9">
<tr><td style="padding:18px 24px;border-bottom:4px solid #F5C211"><strong style="font-size:20px;color:#1E7A1E">CSC</strong> <span style="color:#4B5B50;font-size:13px">Crypto Sans Complexe</span></td></tr>
<tr><td style="padding:24px"><h1 style="font-size:19px;margin:0 0 16px">${escapeHtml(msg.subject)}</h1>${paragraphs}${button}</td></tr>
<tr><td style="padding:14px 24px;color:#4B5B50;font-size:12px;border-top:1px solid #DDE7D9">${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export function renderEmailText(msg: EmailMessage): string {
  return [msg.body, msg.actionUrl ? `\n${msg.actionUrl}` : ''].join('');
}
