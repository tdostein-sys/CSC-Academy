import type { Locale } from '@/lib/types';

/**
 * Modèles de notifications (in-app + e-mail + WhatsApp), en FR et EN.
 * Chaque type déclare ses paramètres. Ajoutez ici les nouveaux types.
 */
export interface TemplateParams {
  'system.welcome': { firstName: string };
  'system.test': { message: string };
  'account.password_changed': { date: string };
  'ambassador.joined': { code: string };
  'ambassador.suspended': { reason: string };
  'ambassador.reactivated': Record<string, never>;
  'campaign.launched': { campaignTitle: string; endDate: string | null };
  'campaign.closed': { campaignTitle: string };
  'submission.validated': { campaignTitle: string; binanceUid: string; amount: string };
  'submission.rejected': { campaignTitle: string; binanceUid: string; reason: string };
  'payout.marked_paid': { campaignTitle: string; amount: string; method: string; reference: string };
  'academy.enrolled': { courseTitle: string; sessionLabel: string; firstAmount: string; holdUntil: string };
  'academy.new_enrollment': { studentName: string; courseTitle: string; sessionLabel: string };
  'academy.payment_recorded': { courseTitle: string; amount: string; remaining: string; activated: boolean };
  'academy.enrollment_cancelled': { courseTitle: string; sessionLabel: string };
  'academy.reminder_due_soon': { courseTitle: string; rank: number; amount: string; dueDate: string };
  'academy.reminder_due_today': { courseTitle: string; rank: number; amount: string; blockDate: string };
  'academy.access_blocked': { courseTitle: string; rank: number; amount: string };
  'academy.commission_earned': { courseTitle: string; studentLabel: string; amount: string };
  'academy.commission_paid': { courseTitle: string; amount: string; method: string; reference: string };
  'academy.evaluation_opened': { courseTitle: string };
  'academy.certificate_issued': { courseTitle: string; number: string };
  'contact.new_request': { name: string; subject: ContactSubjectLabel; excerpt: string; course: string };
  'consulting.booked': { offerTitle: string; date: string; amount: string; holdUntil: string; free: boolean; mode: ConsultingModeLabel; location: string };
  'consulting.new_booking': { clientName: string; offerTitle: string; date: string; free: boolean };
  'consulting.confirmed': { offerTitle: string; date: string; amount: string; mode: ConsultingModeLabel; location: string };
  'consulting.cancelled': { offerTitle: string; date: string; byClient: boolean; refundDue: boolean };
  'consulting.cancelled_staff': { clientName: string; offerTitle: string; date: string; byClient: boolean };
  'consulting.rescheduled': { offerTitle: string; oldDate: string; newDate: string };
  'consulting.expired': { offerTitle: string; date: string };
  'consulting.reminder_day': { offerTitle: string; date: string; mode: ConsultingModeLabel; location: string };
  'consulting.reminder_hour': { offerTitle: string; date: string; mode: ConsultingModeLabel; location: string };
  'consulting.reminder_staff': { clientName: string; offerTitle: string; date: string; mode: ConsultingModeLabel; phone: string };
  'consulting.report_published': { offerTitle: string; date: string };
  'consulting.refunded': { offerTitle: string; amount: string; reference: string };
}

/** Mode de consultation, dans la langue du destinataire. */
export type ConsultingModeLabel = 'video' | 'phone' | 'in_person';
const CONSULTING_WHERE: Record<Locale, (mode: ConsultingModeLabel, location: string) => string> = {
  fr: (mode, location) =>
    mode === 'video'
      ? 'en visio : le lien est dans votre espace « Mes rendez-vous », 15 minutes avant le début'
      : mode === 'phone'
        ? 'par téléphone : votre conseiller vous appellera au numéro de votre profil'
        : `en rencontre physique : ${location}`,
  en: (mode, location) =>
    mode === 'video'
      ? 'by video: the link is in your "My appointments" area, 15 minutes before the start'
      : mode === 'phone'
        ? 'by phone: your advisor will call you on the number in your profile'
        : `in person: ${location}`,
};
const CONSULTING_MODE_NAMES: Record<Locale, Record<ConsultingModeLabel, string>> = {
  fr: { video: 'visio', phone: 'téléphone', in_person: 'rencontre physique' },
  en: { video: 'video', phone: 'phone', in_person: 'in person' },
};

/** Libellé du sujet d'un message de contact, dans la langue du destinataire. */
export type ContactSubjectLabel = 'payment' | 'course' | 'technical' | 'other';
const CONTACT_SUBJECT_LABELS: Record<Locale, Record<ContactSubjectLabel, string>> = {
  fr: { payment: 'Paiement', course: 'Question sur une formation', technical: 'Problème technique', other: 'Autre' },
  en: { payment: 'Payment', course: 'Question about a course', technical: 'Technical issue', other: 'Other' },
};

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
  'account.password_changed': {
    fr: (p) => ({
      title: 'Votre mot de passe a été modifié',
      body: `Le mot de passe de votre compte CSC a été modifié le ${p.date} (heure du Cameroun). Les autres appareils ont été déconnectés. Si vous n'êtes pas à l'origine de ce changement, utilisez « Mot de passe oublié » puis contactez CSC sans attendre.`,
    }),
    en: (p) => ({
      title: 'Your password was changed',
      body: `Your CSC account password was changed on ${p.date} (Cameroon time). Other devices have been signed out. If you did not make this change, use "Forgot password" and contact CSC right away.`,
    }),
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
  'academy.enrolled': {
    fr: (p) => ({
      title: `Inscription enregistrée : ${p.courseTitle}`,
      body: `Votre place est réservée pour « ${p.courseTitle} » (${p.sessionLabel}) jusqu'au ${p.holdUntil}. Réglez la première tranche (${p.firstAmount}) avant cette date pour confirmer votre inscription. Les instructions de paiement sont dans votre espace formations.`,
    }),
    en: (p) => ({
      title: `Enrolment recorded: ${p.courseTitle}`,
      body: `Your seat for "${p.courseTitle}" (${p.sessionLabel}) is held until ${p.holdUntil}. Pay the first instalment (${p.firstAmount}) before then to confirm your enrolment. Payment instructions are in your courses area.`,
    }),
  },
  'contact.new_request': {
    fr: (p) => ({
      title: `Nouveau message (${CONTACT_SUBJECT_LABELS.fr[p.subject]}) : ${p.name}`,
      body: `${p.name} vous a écrit depuis la page Contact${p.course ? ` au sujet de « ${p.course} »` : ''} :\n\n« ${p.excerpt} »\n\nRépondez-lui depuis la boîte de réception de l'administration.`,
    }),
    en: (p) => ({
      title: `New message (${CONTACT_SUBJECT_LABELS.en[p.subject]}): ${p.name}`,
      body: `${p.name} wrote to you from the Contact page${p.course ? ` about "${p.course}"` : ''}:\n\n"${p.excerpt}"\n\nReply from the administration inbox.`,
    }),
  },
  'academy.new_enrollment': {
    fr: (p) => ({
      title: 'Nouvelle inscription à une formation',
      body: `${p.studentName} s'est inscrit(e) à « ${p.courseTitle} » (${p.sessionLabel}). Inscription en attente du premier paiement.`,
    }),
    en: (p) => ({
      title: 'New course enrolment',
      body: `${p.studentName} enrolled in "${p.courseTitle}" (${p.sessionLabel}). Awaiting the first payment.`,
    }),
  },
  'academy.payment_recorded': {
    fr: (p) => ({
      title: p.activated ? `Inscription confirmée : ${p.courseTitle}` : 'Paiement reçu',
      body: `CSC a bien reçu votre paiement de ${p.amount} pour « ${p.courseTitle} ». Reste à payer : ${p.remaining}.${p.activated ? ' Votre accès à la formation est ouvert.' : ''}`,
    }),
    en: (p) => ({
      title: p.activated ? `Enrolment confirmed: ${p.courseTitle}` : 'Payment received',
      body: `CSC has received your payment of ${p.amount} for "${p.courseTitle}". Remaining: ${p.remaining}.${p.activated ? ' Your access to the course is now open.' : ''}`,
    }),
  },
  'academy.enrollment_cancelled': {
    fr: (p) => ({
      title: 'Inscription annulée',
      body: `Votre inscription à « ${p.courseTitle} » (${p.sessionLabel}) a été annulée. La place a été libérée.`,
    }),
    en: (p) => ({
      title: 'Enrolment cancelled',
      body: `Your enrolment in "${p.courseTitle}" (${p.sessionLabel}) has been cancelled. The seat has been released.`,
    }),
  },
  'academy.reminder_due_soon': {
    fr: (p) => ({
      title: `Rappel : tranche ${p.rank} à régler`,
      body: `La tranche ${p.rank} de « ${p.courseTitle} » (${p.amount}) est à régler au plus tard le ${p.dueDate}. Les instructions de paiement sont dans votre espace formations.`,
    }),
    en: (p) => ({
      title: `Reminder: instalment ${p.rank} due soon`,
      body: `Instalment ${p.rank} of "${p.courseTitle}" (${p.amount}) is due by ${p.dueDate}. Payment instructions are in your courses area.`,
    }),
  },
  'academy.reminder_due_today': {
    fr: (p) => ({
      title: `Tranche ${p.rank} : date limite atteinte`,
      body: `La tranche ${p.rank} de « ${p.courseTitle} » (${p.amount}) arrive à échéance. Sans paiement, votre accès à la formation sera bloqué le ${p.blockDate}.`,
    }),
    en: (p) => ({
      title: `Instalment ${p.rank}: deadline reached`,
      body: `Instalment ${p.rank} of "${p.courseTitle}" (${p.amount}) is now due. Without payment, your access to the course will be blocked on ${p.blockDate}.`,
    }),
  },
  'academy.access_blocked': {
    fr: (p) => ({
      title: `Accès bloqué : ${p.courseTitle}`,
      body: `La tranche ${p.rank} (${p.amount}) n'a pas été réglée. Votre accès aux séances, documents et vidéos de « ${p.courseTitle} » est bloqué. Il sera rétabli dès l'enregistrement de votre paiement.`,
    }),
    en: (p) => ({
      title: `Access blocked: ${p.courseTitle}`,
      body: `Instalment ${p.rank} (${p.amount}) has not been paid. Your access to the sessions, documents and videos of "${p.courseTitle}" is blocked. It will be restored as soon as your payment is recorded.`,
    }),
  },
  'academy.commission_earned': {
    fr: (p) => ({
      title: 'Nouvelle commission CSC Academy',
      body: `${p.studentLabel} a entièrement payé « ${p.courseTitle} ». Une commission de ${p.amount} a été ajoutée à votre solde.`,
    }),
    en: (p) => ({
      title: 'New CSC Academy commission',
      body: `${p.studentLabel} has fully paid "${p.courseTitle}". A commission of ${p.amount} has been added to your balance.`,
    }),
  },
  'academy.commission_paid': {
    fr: (p) => ({
      title: 'Commission payée',
      body: `CSC indique vous avoir payé ${p.amount} de commission pour la formation « ${p.courseTitle} » (${p.method}, réf. ${p.reference}). Merci de confirmer la réception dans votre espace ambassadeur.`,
    }),
    en: (p) => ({
      title: 'Commission paid',
      body: `CSC reports having paid you a ${p.amount} commission for the course "${p.courseTitle}" (${p.method}, ref. ${p.reference}). Please confirm receipt in your ambassador dashboard.`,
    }),
  },
  'academy.evaluation_opened': {
    fr: (p) => ({
      title: `Évaluation finale ouverte : ${p.courseTitle}`,
      body: `L'évaluation finale de « ${p.courseTitle} » est disponible dans votre espace formations. Réussissez-la pour obtenir votre attestation.`,
    }),
    en: (p) => ({
      title: `Final assessment open: ${p.courseTitle}`,
      body: `The final assessment of "${p.courseTitle}" is available in your courses area. Pass it to obtain your certificate.`,
    }),
  },
  'academy.certificate_issued': {
    fr: (p) => ({
      title: 'Votre attestation est disponible',
      body: `Félicitations ! Votre attestation pour « ${p.courseTitle} » (n° ${p.number}) est prête à être téléchargée dans votre espace formations.`,
    }),
    en: (p) => ({
      title: 'Your certificate is ready',
      body: `Congratulations! Your certificate for "${p.courseTitle}" (no. ${p.number}) is ready to download in your courses area.`,
    }),
  },
  'consulting.booked': {
    fr: (p) =>
      p.free
        ? {
            title: `Rendez-vous confirmé : ${p.offerTitle}`,
            body: `Votre rendez-vous « ${p.offerTitle} » du ${p.date} est confirmé. Il aura lieu ${CONSULTING_WHERE.fr(p.mode, p.location)}.`,
          }
        : {
            title: `Rendez-vous réservé : ${p.offerTitle}`,
            body: `Votre créneau du ${p.date} est réservé jusqu'au ${p.holdUntil}. Réglez ${p.amount} avant cette date pour confirmer le rendez-vous ; sans paiement, le créneau sera libéré. Les instructions de paiement sont dans « Mes rendez-vous ».`,
          },
    en: (p) =>
      p.free
        ? {
            title: `Appointment confirmed: ${p.offerTitle}`,
            body: `Your appointment "${p.offerTitle}" on ${p.date} is confirmed. It will take place ${CONSULTING_WHERE.en(p.mode, p.location)}.`,
          }
        : {
            title: `Appointment booked: ${p.offerTitle}`,
            body: `Your slot on ${p.date} is held until ${p.holdUntil}. Pay ${p.amount} before then to confirm the appointment; without payment, the slot will be released. Payment instructions are in "My appointments".`,
          },
  },
  'consulting.new_booking': {
    fr: (p) => ({
      title: 'Nouveau rendez-vous de conseil',
      body: `${p.clientName} a réservé « ${p.offerTitle} » le ${p.date}.${p.free ? ' Rendez-vous gratuit, confirmé.' : ' En attente de paiement.'}`,
    }),
    en: (p) => ({
      title: 'New consulting appointment',
      body: `${p.clientName} booked "${p.offerTitle}" on ${p.date}.${p.free ? ' Free appointment, confirmed.' : ' Awaiting payment.'}`,
    }),
  },
  'consulting.confirmed': {
    fr: (p) => ({
      title: `Rendez-vous confirmé : ${p.offerTitle}`,
      body: `CSC a bien reçu votre paiement de ${p.amount}. Votre rendez-vous du ${p.date} est confirmé. Il aura lieu ${CONSULTING_WHERE.fr(p.mode, p.location)}.`,
    }),
    en: (p) => ({
      title: `Appointment confirmed: ${p.offerTitle}`,
      body: `CSC has received your payment of ${p.amount}. Your appointment on ${p.date} is confirmed. It will take place ${CONSULTING_WHERE.en(p.mode, p.location)}.`,
    }),
  },
  'consulting.cancelled': {
    fr: (p) => ({
      title: 'Rendez-vous annulé',
      body: `${p.byClient ? 'Votre annulation est enregistrée' : 'CSC a annulé votre rendez-vous'} : « ${p.offerTitle} » du ${p.date}.${p.refundDue ? ' Le remboursement de votre paiement sera traité par CSC ; vous serez prévenu.' : ''}`,
    }),
    en: (p) => ({
      title: 'Appointment cancelled',
      body: `${p.byClient ? 'Your cancellation has been recorded' : 'CSC has cancelled your appointment'}: "${p.offerTitle}" on ${p.date}.${p.refundDue ? ' CSC will process the refund of your payment; you will be notified.' : ''}`,
    }),
  },
  'consulting.cancelled_staff': {
    fr: (p) => ({
      title: 'Rendez-vous annulé',
      body: `Le rendez-vous « ${p.offerTitle} » de ${p.clientName} du ${p.date} a été annulé${p.byClient ? ' par le client' : ''}. Le créneau est libéré.`,
    }),
    en: (p) => ({
      title: 'Appointment cancelled',
      body: `The appointment "${p.offerTitle}" with ${p.clientName} on ${p.date} has been cancelled${p.byClient ? ' by the client' : ''}. The slot is released.`,
    }),
  },
  'consulting.rescheduled': {
    fr: (p) => ({
      title: 'Rendez-vous déplacé',
      body: `Le rendez-vous « ${p.offerTitle} » prévu le ${p.oldDate} est déplacé au ${p.newDate}.`,
    }),
    en: (p) => ({
      title: 'Appointment moved',
      body: `The appointment "${p.offerTitle}" planned on ${p.oldDate} has been moved to ${p.newDate}.`,
    }),
  },
  'consulting.expired': {
    fr: (p) => ({
      title: 'Réservation expirée',
      body: `Faute de paiement dans le délai, votre réservation « ${p.offerTitle} » du ${p.date} a expiré et le créneau a été libéré. Vous pouvez réserver un nouveau créneau à tout moment.`,
    }),
    en: (p) => ({
      title: 'Booking expired',
      body: `As no payment was received in time, your booking "${p.offerTitle}" on ${p.date} has expired and the slot has been released. You can book a new slot at any time.`,
    }),
  },
  'consulting.reminder_day': {
    fr: (p) => ({
      title: `Rappel : rendez-vous demain`,
      body: `Rappel : votre rendez-vous « ${p.offerTitle} » a lieu le ${p.date}, ${CONSULTING_WHERE.fr(p.mode, p.location)}.`,
    }),
    en: (p) => ({
      title: `Reminder: appointment tomorrow`,
      body: `Reminder: your appointment "${p.offerTitle}" takes place on ${p.date}, ${CONSULTING_WHERE.en(p.mode, p.location)}.`,
    }),
  },
  'consulting.reminder_hour': {
    fr: (p) => ({
      title: `Votre rendez-vous commence bientôt`,
      body: `Votre rendez-vous « ${p.offerTitle} » commence le ${p.date}, ${CONSULTING_WHERE.fr(p.mode, p.location)}.`,
    }),
    en: (p) => ({
      title: `Your appointment starts soon`,
      body: `Your appointment "${p.offerTitle}" starts on ${p.date}, ${CONSULTING_WHERE.en(p.mode, p.location)}.`,
    }),
  },
  'consulting.reminder_staff': {
    fr: (p) => ({
      title: `Consultation à venir : ${p.clientName}`,
      body: `Consultation « ${p.offerTitle} » avec ${p.clientName} le ${p.date} (${CONSULTING_MODE_NAMES.fr[p.mode]}${p.mode === 'phone' ? `, à appeler au ${p.phone}` : ''}).`,
    }),
    en: (p) => ({
      title: `Upcoming consultation: ${p.clientName}`,
      body: `Consultation "${p.offerTitle}" with ${p.clientName} on ${p.date} (${CONSULTING_MODE_NAMES.en[p.mode]}${p.mode === 'phone' ? `, call on ${p.phone}` : ''}).`,
    }),
  },
  'consulting.report_published': {
    fr: (p) => ({
      title: 'Compte rendu disponible',
      body: `Le compte rendu de votre consultation « ${p.offerTitle} » du ${p.date} est disponible dans « Mes rendez-vous ».`,
    }),
    en: (p) => ({
      title: 'Report available',
      body: `The report of your consultation "${p.offerTitle}" on ${p.date} is available in "My appointments".`,
    }),
  },
  'consulting.refunded': {
    fr: (p) => ({
      title: 'Remboursement effectué',
      body: `CSC indique vous avoir remboursé ${p.amount} pour le rendez-vous « ${p.offerTitle} » (réf. ${p.reference}).`,
    }),
    en: (p) => ({
      title: 'Refund sent',
      body: `CSC reports having refunded you ${p.amount} for the appointment "${p.offerTitle}" (ref. ${p.reference}).`,
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
