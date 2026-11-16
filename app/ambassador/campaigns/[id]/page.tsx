import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { ArrowLeft, CheckCircle2, FileDown, Info, XCircle } from 'lucide-react';
import { requireAmbassador } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Markdown } from '@/components/markdown';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { VideoEmbed } from '@/components/video-embed';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { parseVideoUrl } from '@/lib/video';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import {
  CAMPAIGN_COLUMNS,
  num,
  type Campaign,
  type CampaignBalance,
  type Payout,
  type Submission,
} from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { cancelSubmission, confirmPayout, setParticipation } from '../../actions';
import { SubmissionForm } from './submission-form';
import type { PaymentState } from '@/components/payment-badge';

export const metadata: Metadata = { title: 'Campagne' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AmbassadorCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireAmbassador(`/ambassador/campaigns/${id}`);
  const [locale, supabase, t] = await Promise.all([getLocale(), createClient(), getTranslations('ambassador')]);
  const l = locale as Locale;

  // La RLS ne renvoie que les campagnes lancées ou clôturées.
  const { data: campaign } = await supabase.from('campaigns').select(CAMPAIGN_COLUMNS).eq('id', id).maybeSingle();
  if (!campaign) notFound();
  const c = campaign as Campaign;

  // Vue comptée une seule fois (la fonction ignore les doublons).
  await supabase.rpc('record_campaign_view', { p_campaign: id });

  const [partRes, subsRes, payoutsRes, balRes, fileRes, statesRes] = await Promise.all([
    supabase
      .from('campaign_participations')
      .select('participates')
      .eq('campaign_id', id)
      .eq('ambassador_id', user.id)
      .maybeSingle(),
    supabase
      .from('submissions')
      .select('*')
      .eq('campaign_id', id)
      .eq('ambassador_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('payouts')
      .select('*')
      .eq('campaign_id', id)
      .eq('ambassador_id', user.id)
      .order('paid_at', { ascending: false }),
    supabase
      .from('ambassador_campaign_balances')
      .select('*')
      .eq('campaign_id', id)
      .eq('ambassador_id', user.id)
      .maybeSingle(),
    c.modop_file_path
      ? supabase.storage.from('campaign-files').createSignedUrl(c.modop_file_path, 3600)
      : Promise.resolve({ data: null }),
    supabase
      .from('submission_payment_states')
      .select('submission_id, payment_state')
      .eq('campaign_id', id)
      .eq('ambassador_id', user.id),
  ]);
  const paymentState = new Map(
    (statesRes.data ?? []).map((s) => [s.submission_id as string, s.payment_state as PaymentState]),
  );

  const participates = (partRes.data?.participates as boolean | undefined) ?? null;
  const submissions = (subsRes.data ?? []) as Submission[];
  const payouts = (payoutsRes.data ?? []) as Payout[];
  // Au moins un ID en attente ou validé : refuser n'est plus possible (règle vérifiée aussi en base).
  const participationLocked = submissions.some((s) => s.status !== 'rejected');
  const bal = balRes.data as CampaignBalance | null;
  const fileUrl = fileRes.data?.signedUrl ?? null;

  const title = localized(l, c.title_fr, c.title_en);
  const modop = localized(l, c.modop_fr, c.modop_en);
  const video = parseVideoUrl(c.video_url);
  const isOpen = c.status === 'launched';
  const isActive = user.ambassador.status === 'active';
  const minLabel =
    c.min_volume !== null
      ? t('campaign.tradingVolumeMin', {
          volume: formatNumber(c.min_volume, l),
        })
      : null;

  return (
    <div className="container-page max-w-3xl space-y-6 py-8">
      <Link href="/ambassador" className="link inline-flex items-center gap-1 text-sm">
        <ArrowLeft aria-hidden className="size-4" />
        {t('campaign.back')}
      </Link>

      <header>
        <div className="mb-2 flex flex-wrap gap-2">
          <StatusBadge tone={c.status}>{t(`campaignStatus.${c.status}`)}</StatusBadge>
          <StatusBadge tone="info">
            {t('campaigns.perAccount', {
              amount: formatXAF(c.amount_per_account, l),
            })}
          </StatusBadge>
          {c.min_volume !== null && (
            <StatusBadge tone="neutral">
              {t('campaigns.minVolume', {
                volume: formatNumber(c.min_volume, l),
              })}
            </StatusBadge>
          )}
          {c.ends_on && (
            <StatusBadge tone="neutral">{t('campaigns.endsOn', { date: formatDate(c.ends_on, l) })}</StatusBadge>
          )}
        </div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {localized(l, c.summary_fr, c.summary_en) && (
          <p className="mt-2 text-muted">{localized(l, c.summary_fr, c.summary_en)}</p>
        )}
      </header>

      {!isOpen && <Notice>{t('campaign.closedNotice')}</Notice>}
      {isOpen && !isActive && <Notice tone="error">{t('campaign.suspendedNotice')}</Notice>}

      {/* Vidéo */}
      {video && c.video_url && (
        <section aria-labelledby="video-title" className="card">
          <h2 id="video-title" className="mb-3 text-lg font-semibold">
            {t('campaign.video')}
          </h2>
          <VideoEmbed
            video={video}
            sourceUrl={c.video_url}
            title={title}
            labels={{
              play: t('campaign.playVideo'),
              hint: t('campaign.videoDataHint'),
              open: t('campaign.openVideo'),
            }}
          />
        </section>
      )}

      {/* Mode opératoire */}
      {(modop || fileUrl) && (
        <section aria-labelledby="modop-title" className="card">
          <h2 id="modop-title" className="mb-3 text-lg font-semibold">
            {t('campaign.modop')}
          </h2>
          {modop && <Markdown source={modop} />}
          {fileUrl && (
            <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="btn-outline mt-2">
              <FileDown aria-hidden className="size-4" />
              {t('campaign.downloadModop')}
            </a>
          )}
        </section>
      )}

      {/* Participation */}
      {isOpen && isActive && (
        <section aria-labelledby="part-title" className="card">
          <h2 id="part-title" className="text-lg font-semibold">
            {t('campaign.participationTitle')}
          </h2>
          {participates === null ? (
            // Pas encore de choix : les deux options.
            <>
              <p className="mb-4 text-sm text-muted">{t('campaign.participationQuestion')}</p>
              <ActionForm action={setParticipation} className="flex flex-wrap gap-2">
                <input type="hidden" name="campaign_id" value={c.id} />
                <button type="submit" name="participates" value="yes" className="btn-primary">
                  {t('campaign.yes')}
                </button>
                <button type="submit" name="participates" value="no" className="btn-outline">
                  {t('campaign.no')}
                </button>
              </ActionForm>
            </>
          ) : (
            // Choix fait : seule l'option retenue est affichée ; l'autre est masquée.
            <>
              <p
                className={`mt-2 flex items-center gap-2 rounded-lg p-3 text-sm font-semibold ${
                  participates ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'
                }`}
              >
                {participates ? (
                  <CheckCircle2 aria-hidden className="size-5" />
                ) : (
                  <XCircle aria-hidden className="size-5" />
                )}
                {participates ? t('campaign.youParticipate') : t('campaign.youDecline')}
              </p>
              {/* Revenir sur son choix : possible tant qu'aucun ID n'a été soumis. */}
              {participates && participationLocked ? (
                <p className="mt-3 flex gap-2 text-sm text-muted">
                  <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
                  {t('campaign.participationLocked')}
                </p>
              ) : (
                <details className="mt-3">
                  <summary className="link cursor-pointer text-sm">{t('campaign.changeChoice')}</summary>
                  <ActionForm action={setParticipation} className="mt-2">
                    <input type="hidden" name="campaign_id" value={c.id} />
                    <button
                      type="submit"
                      name="participates"
                      value={participates ? 'no' : 'yes'}
                      className="btn-outline"
                    >
                      {participates ? t('campaign.no') : t('campaign.yes')}
                    </button>
                  </ActionForm>
                </details>
              )}
            </>
          )}
        </section>
      )}

      {/* Déclaration d'un compte */}
      {isOpen && isActive && (
        <section aria-labelledby="submit-title" className="card">
          <h2 id="submit-title" className="text-lg font-semibold">
            {t('campaign.submitTitle')}
          </h2>
          <p className="mb-4 flex gap-2 text-sm text-muted">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
            {t('campaign.submitHint')}
          </p>
          {participates ? (
            <SubmissionForm campaignId={c.id} minVolumeLabel={minLabel} />
          ) : (
            <Notice>{t('campaign.mustParticipate')}</Notice>
          )}
        </section>
      )}

      {/* Mes comptes déclarés */}
      <section aria-labelledby="subs-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="subs-title" className="text-lg font-semibold">
            {t('campaign.mySubmissions')}
          </h2>
          {bal && (
            <p className="text-sm text-muted">
              {t('balance.earned')} : <strong className="text-text">{formatXAF(num(bal.earned), l)}</strong> ·{' '}
              {t('balance.due')} : <strong className="text-text">{formatXAF(num(bal.due), l)}</strong>
            </p>
          )}
        </div>
        {submissions.length === 0 ? (
          <p className="card text-muted">{t('campaign.noSubmissions')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {submissions.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="text-sm">
                  <p className="font-mono text-base font-semibold">{s.binance_uid}</p>
                  <p className="text-muted">
                    {formatNumber(s.trading_volume, l)} USDT · {formatDate(s.created_at, l, true)}
                  </p>
                  {s.status === 'rejected' && s.reject_reason && (
                    <p className="mt-1 text-error">{t('rejectReason', { reason: s.reject_reason })}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {s.status === 'validated' && (
                    <span className="text-sm font-semibold text-success">+{formatXAF(s.amount, l)}</span>
                  )}
                  <StatusBadge tone={s.status}>{t(`status.${s.status}`)}</StatusBadge>
                  {s.status === 'validated' && paymentState.get(s.id) && (
                    <StatusBadge
                      tone={
                        paymentState.get(s.id) === 'paid'
                          ? 'validated'
                          : paymentState.get(s.id) === 'due'
                            ? 'pending'
                            : 'info'
                      }
                    >
                      {t(`paymentState.${paymentState.get(s.id)}`)}
                    </StatusBadge>
                  )}
                  {s.status === 'pending' && isOpen && (
                    <ActionForm
                      action={cancelSubmission}
                      confirm={t('campaign.cancelConfirm')}
                      confirmLabel={t('campaign.cancel')}
                      danger
                    >
                      <input type="hidden" name="id" value={s.id} />
                      <button type="submit" className="btn-ghost min-h-9 px-2 text-xs text-error">
                        {t('campaign.cancel')}
                      </button>
                    </ActionForm>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Paiements */}
      <section aria-labelledby="pay-title">
        <h2 id="pay-title" className="mb-3 text-lg font-semibold">
          {t('campaign.myPayouts')}
        </h2>
        {payouts.length === 0 ? (
          <p className="card text-muted">{t('campaign.noPayouts')}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {payouts.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="text-base font-bold">{formatXAF(p.amount, l)}</p>
                  <p className="text-muted">
                    {payoutMethodLabel(p.method, l)}
                    {p.reference ? ` · ${t('payouts.reference')} ${p.reference}` : ''} · {t('payouts.paidOn')}{' '}
                    {formatDate(p.paid_at, l)}
                  </p>
                </div>
                {p.confirmed_at ? (
                  <StatusBadge tone="validated">
                    {t('payouts.confirmedOn', {
                      date: formatDate(p.confirmed_at, l),
                    })}
                  </StatusBadge>
                ) : (
                  <ActionForm action={confirmPayout}>
                    <input type="hidden" name="id" value={p.id} />
                    <button type="submit" className="btn-primary w-full sm:w-auto">
                      {t('payouts.confirm')}
                    </button>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'error' }) {
  return (
    <p
      className={`flex gap-2 rounded-lg p-3 text-sm ${tone === 'error' ? 'bg-error-soft text-error' : 'bg-info-soft text-info'}`}
    >
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}
