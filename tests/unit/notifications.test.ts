import { describe, expect, it, vi } from 'vitest';
import { renderNotification, type NotificationType, type TemplateParams } from '@/lib/notifications/templates';
import { MAX_DELIVERY_ATTEMPTS, nextDeliveryState, retryDelayMinutes } from '@/lib/notifications/retry';
import { BrevoProvider, EmailJsProvider, getEmailProvider } from '@/lib/email';
import { escapeHtml, renderEmailHtml } from '@/lib/email/layout';
import { formatXAF } from '@/lib/format';

const samples: { [K in NotificationType]: TemplateParams[K] } = {
  'system.welcome': { firstName: 'Awa' },
  'system.test': { message: 'ok' },
  'ambassador.joined': { code: 'CSC-AMB-0001' },
  'ambassador.suspended': { reason: 'Fraude' },
  'ambassador.reactivated': {},
  'campaign.launched': { campaignTitle: 'Binance Q1', endDate: '31/01/2027' },
  'campaign.closed': { campaignTitle: 'Binance Q1' },
  'submission.validated': { campaignTitle: 'Binance Q1', binanceUid: '123456789', amount: '2 000 FCFA' },
  'submission.rejected': { campaignTitle: 'Binance Q1', binanceUid: '123456789', reason: 'KYC incomplet' },
  'payout.marked_paid': { campaignTitle: 'Binance Q1', amount: '10 000 FCFA', method: 'MTN MoMo', reference: 'TX1' },
  'academy.enrolled': { courseTitle: 'Trading', sessionLabel: 'Janvier', firstAmount: '40 000 FCFA', holdUntil: '21 nov. 2026' },
  'academy.new_enrollment': { studentName: 'Awa N.', courseTitle: 'Trading', sessionLabel: 'Janvier' },
  'academy.payment_recorded': { courseTitle: 'Trading', amount: '40 000 FCFA', remaining: '60 000 FCFA', activated: true },
  'academy.enrollment_cancelled': { courseTitle: 'Trading', sessionLabel: 'Janvier' },
  'academy.reminder_due_soon': { courseTitle: 'Trading', rank: 2, amount: '30 000 FCFA', dueDate: '10/02/2027' },
  'academy.reminder_due_today': { courseTitle: 'Trading', rank: 2, amount: '30 000 FCFA', blockDate: '13/02/2027' },
  'academy.access_blocked': { courseTitle: 'Trading', rank: 2, amount: '30 000 FCFA' },
  'academy.commission_earned': { courseTitle: 'Trading', studentLabel: 'Awa N.', amount: '10 000 FCFA' },
  'academy.commission_paid': { courseTitle: 'Trading', amount: '10 000 FCFA', method: 'Orange Money', reference: 'TX1' },
  'academy.evaluation_opened': { courseTitle: 'Trading' },
  'academy.certificate_issued': { courseTitle: 'Trading', number: 'CSC-2027-00001-AB12' },
  'contact.new_request': { name: 'Awa Ndiaye', subject: 'payment', excerpt: 'Je veux payer ma tranche.', course: 'Trading (Session 1)' },
};

describe('modèles de notifications', () => {
  for (const type of Object.keys(samples) as NotificationType[]) {
    it(`${type} : rendu FR et EN non vides et différents`, () => {
      const fr = renderNotification(type, 'fr', samples[type] as never);
      const en = renderNotification(type, 'en', samples[type] as never);
      expect(fr.title.length).toBeGreaterThan(0);
      expect(en.body.length).toBeGreaterThan(0);
      expect(fr.title).not.toBe(en.title);
    });
  }

  it('le motif de rejet est visible par l’ambassadeur', () => {
    expect(renderNotification('submission.rejected', 'fr', samples['submission.rejected']).body).toContain('KYC incomplet');
  });
});

describe('politique de réessai des envois', () => {
  it('délai exponentiel plafonné', () => {
    expect(retryDelayMinutes(1)).toBe(2);
    expect(retryDelayMinutes(3)).toBe(8);
    expect(retryDelayMinutes(20)).toBe(120);
  });
  it('abandon après le nombre maximal de tentatives', () => {
    expect(nextDeliveryState(1).status).toBe('pending');
    expect(nextDeliveryState(MAX_DELIVERY_ATTEMPTS).status).toBe('failed');
  });
});

describe('fournisseurs e-mail', () => {
  const msg = { to: 'a@b.cm', toName: 'Awa', subject: 'Sujet <test>', body: 'Ligne 1\n\nLigne 2', actionUrl: 'https://csc.cm/x', locale: 'fr' as const };

  it('Brevo : appel API v3 avec la clé et le contenu HTML échappé', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 201 }));
    await new BrevoProvider('KEY', 'no-reply@csc.cm', 'CSC', fetchMock).send(msg);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.headers['api-key']).toBe('KEY');
    const body = JSON.parse(init.body);
    expect(body.to[0].email).toBe('a@b.cm');
    expect(body.htmlContent).toContain('Sujet &lt;test&gt;');
    expect(body.htmlContent).not.toContain('<test>');
  });

  it('EmailJS : paramètres du modèle générique et clé privée', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('OK', { status: 200 }));
    await new EmailJsProvider({ serviceId: 's', templateId: 't', publicKey: 'pub', privateKey: 'priv' }, fetchMock).send(msg);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({ service_id: 's', template_id: 't', user_id: 'pub', accessToken: 'priv' });
    expect(body.template_params).toMatchObject({ to_email: 'a@b.cm', subject: 'Sujet <test>', action_url: 'https://csc.cm/x' });
  });

  it('une erreur HTTP du fournisseur est remontée (pour réessai)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('quota', { status: 429 }));
    await expect(new BrevoProvider('K', 'x@y.z', 'CSC', fetchMock).send(msg)).rejects.toThrow(/429/);
  });

  it('sélection du fournisseur par variable d’environnement', () => {
    vi.stubEnv('EMAIL_PROVIDER', 'console');
    expect(getEmailProvider().name).toBe('console');
    vi.stubEnv('EMAIL_PROVIDER', 'brevo');
    vi.stubEnv('BREVO_API_KEY', '');
    expect(() => getEmailProvider()).toThrow(/BREVO_API_KEY/);
    vi.unstubAllEnvs();
  });

  it('le bouton n’accepte que des liens http(s)', () => {
    expect(renderEmailHtml({ ...msg, actionUrl: 'javascript:alert(1)' })).not.toContain('javascript:');
    expect(escapeHtml(`"'<>&`)).toBe('&quot;&#39;&lt;&gt;&amp;');
  });
});

describe('format FCFA', () => {
  it('sans décimales, séparateur de milliers', () => {
    expect(formatXAF(150000)).toBe('150 000 FCFA');
    expect(formatXAF('2500', 'en')).toBe('2,500 FCFA');
  });
});
