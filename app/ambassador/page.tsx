import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, BadgeCheck, ChevronRight, Megaphone, Settings } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Markdown } from '@/components/markdown';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { num, type Ambassador, type Campaign, type CampaignBalance, type Payout } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { confirmPayout, joinAmbassador } from './actions';

export const metadata: Metadata = { title: 'CSC Ambassador' };

export default async function AmbassadorPage() {
  const user = await requireUser('/ambassador');
  const [locale, supabase, t] = await Promise.all([getLocale(), createClient(), getTranslations('ambassador')]);
  const { data: charter } = await supabase.from('site_content').select('body_fr, body_en').eq('key', 'ambassador_charter').single();
  const charterBody = localized(locale, charter?.body_fr, charter?.body_en);

  // Raccourci réservé aux administrateurs (la gestion se fait dans /admin).
  const adminShortcut = user.isAdmin ? (
    <Link href="/admin/ambassador/campaigns" className="btn-accent w-full sm:w-auto">
      <Settings aria-hidden className="size-4" />
      {t('adminShortcut')}
    </Link>
  ) : null;

  // ---------------------------------------------------------------------------
  // Pas encore ambassadeur : charte + bouton « D'accord »
  // ---------------------------------------------------------------------------
  if (!user.ambassador) {
    const p = user.profile;
    const profileComplete = Boolean(p.first_name.trim() && p.last_name.trim() && p.phone_whatsapp.trim());
    return (
      <div className="container-page max-w-3xl space-y-4 py-8">
        {adminShortcut}
        <div className="card">
          <Megaphone aria-hidden className="mb-4 size-8 text-primary" />
          <Markdown source={charterBody} />
          <div className="mt-6 border-t border-border pt-6">
            {profileComplete ? (
              <ActionForm action={joinAmbassador}>
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  <BadgeCheck aria-hidden className="size-5" />
                  {t('join')}
                </button>
                <p className="mt-2 text-sm text-muted">{t('joinHint')}</p>
              </ActionForm>
            ) : (
              <div className="rounded-lg bg-warning-soft p-4 text-sm text-warning">
                <p>{t('profileIncomplete')}</p>
                <Link href="/profile" className="btn-outline mt-3">
                  {t('completeProfile')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Espace ambassadeur
  // ---------------------------------------------------------------------------
  const [ambRes, balanceRes, campaignsRes, participationsRes, toConfirmRes, perCampaignRes] = await Promise.all([
    supabase.from('ambassadors').select('*').eq('user_id', user.id).single(),
    supabase.from('ambassador_balances').select('*').eq('ambassador_id', user.id).maybeSingle(),
    supabase
      .from('campaigns')
      .select('id, title_fr, title_en, summary_fr, summary_en, amount_per_account, min_volume, ends_on, status, closed_at')
      .in('status', ['launched', 'closed'])
      .order('launched_at', { ascending: false })
      .limit(30),
    supabase.from('campaign_participations').select('campaign_id, participates').eq('ambassador_id', user.id),
    supabase
      .from('payouts')
      .select('id, campaign_id, amount, method, reference, paid_at, confirmed_at')
      .eq('ambassador_id', user.id)
      .is('confirmed_at', null)
      .order('paid_at'),
    supabase.from('ambassador_campaign_balances').select('*').eq('ambassador_id', user.id),
  ]);

  const amb = ambRes.data as Ambassador;
  const bal = balanceRes.data as CampaignBalance | null;
  const campaigns = (campaignsRes.data ?? []) as Campaign[];
  const titleOf = new Map(campaigns.map((c) => [c.id, localized(locale, c.title_fr, c.title_en)]));
  const choice = new Map((participationsRes.data ?? []).map((p) => [p.campaign_id as string, p.participates as boolean]));
  const toConfirm = (toConfirmRes.data ?? []) as Payout[];
  const perCampaign = new Map(((perCampaignRes.data ?? []) as CampaignBalance[]).map((b) => [b.campaign_id, b]));
  const open = campaigns.filter((c) => c.status === 'launched');
  const closed = campaigns.filter((c) => c.status === 'closed');
  const l = locale as Locale;

  return (
    <div className="container-page max-w-4xl space-y-8 py-8">
      {adminShortcut}
      {/* Badge */}
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-accent-fg">
          <BadgeCheck aria-hidden className="size-9" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary uppercase">{t('badge')}</p>
          <p className="text-2xl font-bold tracking-wide">{amb.code}</p>
          <p className="text-sm text-muted">
            {user.profile.first_name} {user.profile.last_name} · {t('memberSince', { date: formatDate(amb.charter_accepted_at, l) })}
          </p>
        </div>
        <StatusBadge tone={amb.status}>{t(`ambassadorStatus.${amb.status}`)}</StatusBadge>
      </section>

      {amb.status === 'suspended' && (
        <p role="alert" className="flex gap-2 rounded-lg bg-error-soft p-4 text-sm text-error">
          <AlertTriangle aria-hidden className="size-5 shrink-0" />
          {t('suspendedBanner', { reason: amb.status_reason ?? '—' })}
        </p>
      )}

      {/* Gains */}
      <section aria-labelledby="balance-title">
        <h2 id="balance-title" className="mb-3 text-lg font-semibold">
          {t('balance.title')}
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat label={t('balance.earned')} value={formatXAF(num(bal?.earned), l)} hint={t('balance.validated', { count: num(bal?.validated_count) })} />
          <Stat label={t('balance.paid')} value={formatXAF(num(bal?.paid), l)} />
          <Stat label={t('balance.due')} value={formatXAF(num(bal?.due), l)} highlight={num(bal?.due) > 0} />
        </ul>
      </section>

      {/* Paiements à confirmer */}
      {toConfirm.length > 0 && (
        <section aria-labelledby="confirm-title" className="card border-accent">
          <h2 id="confirm-title" className="text-lg font-semibold">
            {t('toConfirm.title')}
          </h2>
          <p className="mb-4 text-sm text-muted">{t('toConfirm.desc')}</p>
          <ul className="space-y-3">
            {toConfirm.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-lg bg-bg p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="text-base font-bold">{formatXAF(p.amount, l)}</p>
                  <p className="text-muted">
                    {titleOf.get(p.campaign_id) ?? '—'} · {payoutMethodLabel(p.method, l)}
                    {p.reference ? ` · ${t('payouts.reference')} ${p.reference}` : ''} · {formatDate(p.paid_at, l)}
                  </p>
                </div>
                <ActionForm action={confirmPayout}>
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="btn-primary w-full sm:w-auto">
                    {t('payouts.confirm')}
                  </button>
                </ActionForm>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Campagnes en cours */}
      <section aria-labelledby="open-title">
        <h2 id="open-title" className="mb-3 text-lg font-semibold">
          {t('campaigns.open')}
        </h2>
        {open.length === 0 ? (
          <p className="card text-muted">{t('campaigns.emptyOpen')}</p>
        ) : (
          <ul className="space-y-3">
            {open.map((c) => {
              const ch = choice.get(c.id);
              return (
                <li key={c.id}>
                  <Link href={`/ambassador/campaigns/${c.id}`} className="card block transition-colors hover:border-primary">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{localized(l, c.title_fr, c.title_en)}</p>
                        <p className="mt-1 text-sm text-muted">{localized(l, c.summary_fr, c.summary_en)}</p>
                      </div>
                      <ChevronRight aria-hidden className="mt-1 size-5 shrink-0 text-muted" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <StatusBadge tone="info">{t('campaigns.perAccount', { amount: formatXAF(c.amount_per_account, l) })}</StatusBadge>
                      {c.min_volume !== null && (
                        <StatusBadge tone="neutral">{t('campaigns.minVolume', { volume: formatNumber(c.min_volume, l) })}</StatusBadge>
                      )}
                      {c.ends_on && <StatusBadge tone="neutral">{t('campaigns.endsOn', { date: formatDate(c.ends_on, l) })}</StatusBadge>}
                      <StatusBadge tone={ch === true ? 'validated' : ch === false ? 'neutral' : 'pending'}>
                        {t(`campaigns.choice.${ch === true ? 'yes' : ch === false ? 'no' : 'none'}`)}
                      </StatusBadge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Campagnes terminées */}
      {closed.length > 0 && (
        <section aria-labelledby="closed-title">
          <h2 id="closed-title" className="mb-3 text-lg font-semibold">
            {t('campaigns.closed')}
          </h2>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {closed.map((c) => {
              const b = perCampaign.get(c.id);
              return (
                <li key={c.id}>
                  <Link href={`/ambassador/campaigns/${c.id}`} className="flex items-center justify-between gap-3 p-3 text-sm hover:bg-surface-2">
                    <span>
                      <span className="font-medium">{localized(l, c.title_fr, c.title_en)}</span>
                      <span className="block text-xs text-muted">{formatDate(c.closed_at, l)}</span>
                    </span>
                    <span className="text-right font-semibold">{formatXAF(num(b?.earned), l)}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <details className="card">
        <summary className="cursor-pointer font-semibold">{t('readCharter')}</summary>
        <div className="mt-4">
          <Markdown source={charterBody} />
        </div>
      </details>
    </div>
  );
}

function Stat({ label, value, hint, highlight }: { label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <li className={`card ${highlight ? 'border-primary bg-primary-soft' : ''}`}>
      <p className="text-sm text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </li>
  );
}
