import type { Locale } from '@/lib/types';

/**
 * Modèles de notifications (in-app + e-mail + WhatsApp), en FR et EN.
 * Chaque type déclare ses paramètres. Ajoutez ici les nouveaux types.
 */
export interface TemplateParams {
  'system.welcome': { firstName: string };
  'system.test': { message: string };
  'ambassador.joined': { code: string };
  'ambassador.suspended': { reason: string };
  'ambassador.reactivated': Record<string, never>;
  'campaign.launched': { campaignTitle: string; endDate: string | null };
  'campaign.closed': { campaignTitle: string };
  'submission.validated': { campaignTitle: string; binanceUid: string; amount: string };
  'submission.rejected': { campaignTitle: string; binanceUid: string; reason: string };
  'payout.marked_paid': { campaignTitle: string; amount: string; method: string; reference: string };
}

export type NotificationType = keyof TemplateParams;

export interface RenderedNotification {
  title: string;
  body: string;
}

type Renderer<P> = (p: P) => RenderedNotification;
type Templates = { [K in NotificationType]: Record<Locale, Renderer<TemplateParams[K]>> };

const templates: Templates = {
  'system.welcome': {
    fr: (p) => ({
      title: 'Bienvenue chez CSC',
      body: `Bonjour ${p.firstName}, votre compte CSC est prêt. Découvrez nos formations et devenez ambassadeur depuis votre espace.`,
    }),
    en: (p) => ({
      title: 'Welcome to CSC',
      body: `Hello ${p.firstName}, your CSC account is ready. Discover our courses and become an ambassador from your dashboard.`,
    }),
  },
  'system.test': {
    fr: (p) => ({ title: 'Notification de test', body: p.message }),
    en: (p) => ({ title: 'Test notification', body: p.message }),
  },
  'ambassador.joined': {
    fr: (p) => ({
      title: 'Bienvenue parmi les ambassadeurs CSC',
      body: `Vous avez accepté la charte. Votre numéro d'ambassadeur est ${p.code}. Vous serez prévenu à chaque nouvelle campagne.`,
    }),
    en: (p) => ({
      title: 'Welcome to the CSC ambassadors',
      body: `You have accepted the charter. Your ambassador number is ${p.code}. You will be notified of every new campaign.`,
    }),
  },
  'ambassador.suspended': {
    fr: (p) => ({
      title: 'Compte ambassadeur suspendu',
      body: `Votre compte ambassadeur a été suspendu. Motif : ${p.reason}. Vous gardez l'accès à vos soldes et paiements.`,
    }),
    en: (p) => ({
      title: 'Ambassador account suspended',
      body: `Your ambassador account has been suspended. Reason: ${p.reason}. You still have access to your balances and payments.`,
    }),
  },
  'ambassador.reactivated': {
    fr: () => ({
      title: 'Compte ambassadeur réactivé',
      body: 'Votre compte ambassadeur est de nouveau actif. Vous pouvez participer aux campagnes en cours.',
    }),
    en: () => ({
      title: 'Ambassador account reactivated',
      body: 'Your ambassador account is active again. You can take part in the current campaigns.',
    }),
  },
  'campaign.launched': {
    fr: (p) => ({
      title: `Nouvelle campagne : ${p.campaignTitle}`,
      body: `Une nouvelle campagne est disponible${p.endDate ? ` jusqu'au ${p.endDate}` : ''}. Consultez le mode opératoire et la vidéo, puis indiquez si vous participez.`,
    }),
    en: (p) => ({
      title: `New campaign: ${p.campaignTitle}`,
      body: `A new campaign is available${p.endDate ? ` until ${p.endDate}` : ''}. Read the operating procedure and watch the video, then let us know if you take part.`,
    }),
  },
  'campaign.closed': {
    fr: (p) => ({
      title: `Campagne terminée : ${p.campaignTitle}`,
      body: `La campagne « ${p.campaignTitle} » est clôturée. Merci pour votre participation ! Pensez à confirmer la réception de vos paiements.`,
    }),
    en: (p) => ({
      title: `Campaign closed: ${p.campaignTitle}`,
      body: `The campaign "${p.campaignTitle}" is closed. Thank you for taking part! Remember to confirm receipt of your payments.`,
    }),
  },
  'submission.validated': {
    fr: (p) => ({
      title: 'Compte validé',
      body: `Votre compte Binance ${p.binanceUid} (campagne « ${p.campaignTitle} ») a été validé. ${p.amount} ont été ajoutés à votre solde.`,
    }),
    en: (p) => ({
      title: 'Account validated',
      body: `Your Binance account ${p.binanceUid} (campaign "${p.campaignTitle}") has been validated. ${p.amount} added to your balance.`,
    }),
  },
  'submission.rejected': {
    fr: (p) => ({
      title: 'Compte rejeté',
      body: `Votre compte Binance ${p.binanceUid} (campagne « ${p.campaignTitle} ») a été rejeté. Motif : ${p.reason}`,
    }),
    en: (p) => ({
      title: 'Account rejected',
      body: `Your Binance account ${p.binanceUid} (campaign "${p.campaignTitle}") was rejected. Reason: ${p.reason}`,
    }),
  },
  'payout.marked_paid': {
    fr: (p) => ({
      title: 'Paiement effectué',
      body: `CSC indique vous avoir payé ${p.amount} pour la campagne « ${p.campaignTitle} » (${p.method}, réf. ${p.reference}). Merci de confirmer la réception dans votre espace ambassadeur.`,
    }),
    en: (p) => ({
      title: 'Payment sent',
      body: `CSC reports having paid you ${p.amount} for the campaign "${p.campaignTitle}" (${p.method}, ref. ${p.reference}). Please confirm receipt in your ambassador dashboard.`,
    }),
  },
};

export function renderNotification<T extends NotificationType>(
  type: T,
  locale: Locale,
  params: TemplateParams[T],
): RenderedNotification {
  const byLocale = templates[type] as Record<Locale, Renderer<TemplateParams[T]>>;
  return (byLocale[locale] ?? byLocale.fr)(params);
}
