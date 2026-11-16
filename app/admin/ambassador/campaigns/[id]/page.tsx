import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Eye, Lock, Rocket, Trash2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { CAMPAIGN_COLUMNS, num, type Campaign, type CampaignBalance } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { closeCampaign, deleteCampaign, launchCampaign, updateCampaign } from '../../actions';
import { CampaignForm } from '../campaign-form';
import { SUBMISSION_ROW_SELECT, SubmissionsTable, type SubmissionRow } from '../../_components/submissions-table';
import { PayoutForm } from '../../_components/payout-form';

export const metadata: Metadata = { title: 'Campagne' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Stats {
  views: number;
  participants: number;
  declined: number;
  pending: number;
  validated: number;
  rejected: number;
  earned: number;
  paid: number;
  due: number;
  unconfirmed_payouts: number;
}

export default async function AdminCampaignPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; status?: string; untranslated?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, tf, ta, tp, tc, tt, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.detail'),
    getTranslations('adminAmbassador.form'),
    getTranslations('ambassador'),
    getTranslations('adminAmbassador.payout'),
    getTranslations('common'),
    getTranslations('translation'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;

  const { data } = await supabase.from('campaigns').select(CAMPAIGN_COLUMNS).eq('id', id).maybeSingle();
  if (!data) notFound();
  const c = data as Campaign;

  const statusFilter = ['pending', 'validated', 'rejected'].includes(sp.status ?? '') ? sp.status! : null;
  let subsQuery = supabase.from('submissions').select(SUBMISSION_ROW_SELECT).eq('campaign_id', id).order('created_at', { ascending: false }).limit(200);
  if (statusFilter) subsQuery = subsQuery.eq('status', statusFilter);

  const [statsRes, subsRes, balRes] = await Promise.all([
    supabase.from('campaign_stats').select('*').eq('campaign_id', id).single(),
    subsQuery,
    supabase.from('ambassador_campaign_balances').select('*').eq('campaign_id', id).order('due', { ascending: false }),
  ]);
  const s = (statsRes.data ?? {}) as Partial<Stats>;
  const submissions = (subsRes.data ?? []) as unknown as SubmissionRow[];
  const balances = (balRes.data ?? []) as CampaignBalance[];

  const ambIds = balances.map((b) => b.ambassador_id);
  const { data: ambData } = ambIds.length
    ? await supabase.from('ambassadors').select('user_id, code, profiles (first_name, last_name, phone_whatsapp)').in('user_id', ambIds)
    : { data: [] };
  const ambassadors = new Map(
    ((ambData ?? []) as unknown as { user_id: string; code: string; profiles: { first_name: string; last_name: string; phone_whatsapp: string } }[]).map(
      (a) => [a.user_id, a],
    ),
  );

  const fileName = c.modop_file_path?.split('/').pop() ?? null;
  const pending = num(s.pending);
  const due = num(s.due);
  const unconfirmed = num(s.unconfirmed_payouts);
  // Miroir de la règle SQL (close_campaign), qui reste la garantie côté serveur.
  const canClose = c.status === 'launched' && pending === 0 && due === 0 && unconfirmed === 0;

  const statItems = [
    { label: t('views'), value: num(s.views) },
    { label: t('participants'), value: num(s.participants) },
    { label: t('declined'), value: num(s.declined) },
    { label: t('pending'), value: pending, alert: pending > 0 },
    { label: t('validated'), value: num(s.validated) },
    { label: t('rejected'), value: num(s.rejected) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/ambassador/campaigns" className="link mb-4 inline-flex items-center gap-1 text-sm">
          <ArrowLeft aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <StatusBadge tone={c.status}>{ta(`campaignStatus.${c.status}`)}</StatusBadge>
            <h1 className="mt-2 text-2xl font-bold">{localized(l, c.title_fr, c.title_en)}</h1>
            <p className="mt-1 text-sm text-muted">
              {t('frozenInfo', {
                amount: formatXAF(c.amount_per_account, l),
                volume: c.min_volume !== null ? `${formatNumber(c.min_volume, l)} USDT` : t('noMinimum'),
              })}
            </p>
            <p className="text-xs text-muted">
              {c.launched_at && `${ta('campaignStatus.launched')} : ${formatDate(c.launched_at, l, true)}`}
              {c.closed_at && ` · ${ta('campaignStatus.closed')} : ${formatDate(c.closed_at, l, true)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.status !== 'draft' && (
              <Link href={`/ambassador/campaigns/${c.id}`} className="btn-outline" target="_blank">
                <Eye aria-hidden className="size-4" />
                {t('preview')}
              </Link>
            )}
            <a href={`/admin/ambassador/export/submissions?campaign=${c.id}`} className="btn-outline" download>
              <Download aria-hidden className="size-4" />
              {t('export')}
            </a>
          </div>
        </div>
      </div>

      {sp.created && c.status === 'draft' && (
        <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success">
          {tf('created')}
        </p>
      )}
      {sp.untranslated && (
        <p role="status" className="rounded-lg bg-warning-soft p-3 text-sm text-warning">
          {tt('untranslatedBanner')}
        </p>
      )}

      {/* Actions de cycle de vie */}
      {c.status === 'draft' && (
        <section className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">{t('launchRequirements')}</p>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={launchCampaign} confirm={t('launchConfirm')} confirmTitle={t('launch')} confirmLabel={t('launch')}>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="btn-primary">
                <Rocket aria-hidden className="size-4" />
                {t('launch')}
              </button>
            </ActionForm>
            <ActionForm action={deleteCampaign} confirm={t('deleteConfirm')} confirmTitle={t('delete')} confirmLabel={t('delete')} danger>
              <input type="hidden" name="id" value={c.id} />
              <button type="submit" className="btn-outline text-error">
                <Trash2 aria-hidden className="size-4" />
                {t('delete')}
              </button>
            </ActionForm>
          </div>
        </section>
      )}

      {c.status === 'launched' && (
        <section className={`card ${canClose ? 'border-success' : ''}`}>
          {canClose ? (
            <p className="mb-3 flex gap-2 text-sm text-success">
              <CheckCircle2 aria-hidden className="size-5 shrink-0" />
              {t('readyToClose')}
            </p>
          ) : (
            <div className="mb-3 text-sm text-warning">
              <p className="flex gap-2 font-semibold">
                <AlertTriangle aria-hidden className="size-5 shrink-0" />
                {t('blockers')}
              </p>
              <ul className="mt-1 ml-7 list-disc">
                {pending > 0 && <li>{t('blockerPending', { count: pending })}</li>}
                {due > 0 && <li>{t('blockerDue', { amount: formatXAF(due, l) })}</li>}
                {unconfirmed > 0 && <li>{t('blockerUnconfirmed', { count: unconfirmed })}</li>}
              </ul>
            </div>
          )}
          {/* Bouton grisé tant qu'une condition manque ; la base refuse de toute façon une clôture non conforme. */}
          <ActionForm action={closeCampaign} confirm={t('closeConfirm')} confirmTitle={t('close')} confirmLabel={t('close')}>
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              className="btn-primary"
              disabled={!canClose}
              aria-describedby={canClose ? undefined : 'close-hint'}
            >
              <Lock aria-hidden className="size-4" />
              {t('close')}
            </button>
            {!canClose && (
              <p id="close-hint" className="mt-2 text-xs text-muted">
                {t('closeDisabledHint')}
              </p>
            )}
          </ActionForm>
        </section>
      )}

      {/* Statistiques */}
      {c.status !== 'draft' && (
        <section aria-labelledby="stats-title">
          <h2 id="stats-title" className="mb-3 text-lg font-semibold">
            {t('stats')}
          </h2>
          <ul className="grid grid-cols-3 gap-3 lg:grid-cols-6">
            {statItems.map((it) => (
              <li key={it.label} className="card p-3 sm:p-4">
                <p className="text-xs text-muted">{it.label}</p>
                <p className={`text-2xl font-bold ${it.alert ? 'text-warning' : ''}`}>{it.value}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <li className="card p-3 sm:p-4">
              <p className="text-xs text-muted">{t('earned')}</p>
              <p className="text-xl font-bold">{formatXAF(num(s.earned), l)}</p>
            </li>
            <li className="card p-3 sm:p-4">
              <p className="text-xs text-muted">{t('paid')}</p>
              <p className="text-xl font-bold">{formatXAF(num(s.paid), l)}</p>
            </li>
            <li className={`card p-3 sm:p-4 ${due > 0 ? 'border-warning' : ''}`}>
              <p className="text-xs text-muted">{t('due')}</p>
              <p className={`text-xl font-bold ${due > 0 ? 'text-warning' : ''}`}>{formatXAF(due, l)}</p>
            </li>
          </ul>
        </section>
      )}

      {/* Soumissions */}
      {c.status !== 'draft' && (
        <section aria-labelledby="subs-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="subs-title" className="text-lg font-semibold">
              {t('submissions')}
            </h2>
            <nav className="flex flex-wrap gap-1 text-sm" aria-label={t('submissions')}>
              {[null, 'pending', 'validated', 'rejected'].map((st) => (
                <Link
                  key={st ?? 'all'}
                  href={`/admin/ambassador/campaigns/${c.id}${st ? `?status=${st}` : ''}`}
                  className={`rounded-full px-3 py-1 ${statusFilter === st ? 'bg-primary text-primary-fg' : 'bg-surface-2 hover:bg-border'}`}
                  aria-current={statusFilter === st ? 'page' : undefined}
                >
                  {st ? ta(`status.${st}`) : tc('seeAll')}
                </Link>
              ))}
            </nav>
          </div>
          <SubmissionsTable rows={submissions} showCampaign={false} />
        </section>
      )}

      {/* Soldes et paiements */}
      {c.status !== 'draft' && (
        <section aria-labelledby="bal-title">
          <h2 id="bal-title" className="mb-3 text-lg font-semibold">
            {t('balances')}
          </h2>
          {balances.length === 0 ? (
            <p className="card text-muted">{t('noBalances')}</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{ta('badge')}</th>
                    <th className="text-right">{tp('earned')}</th>
                    <th className="text-right">{tp('paid')}</th>
                    <th className="text-right">{tp('confirmed')}</th>
                    <th className="text-right">{tp('due')}</th>
                    <th>{tc('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => {
                    const a = ambassadors.get(b.ambassador_id);
                    return (
                      <tr key={b.ambassador_id}>
                        <td>
                          <span className="font-mono text-xs font-semibold">{a?.code}</span>
                          <span className="block">
                            {a?.profiles.first_name} {a?.profiles.last_name}
                          </span>
                          <span className="block text-xs text-muted">{a?.profiles.phone_whatsapp}</span>
                        </td>
                        <td className="text-right whitespace-nowrap">{formatXAF(b.earned, l)}</td>
                        <td className="text-right whitespace-nowrap">{formatXAF(b.paid, l)}</td>
                        <td className="text-right whitespace-nowrap">
                          {formatXAF(b.confirmed, l)}
                          {b.unconfirmed_count > 0 && (
                            <span className="block text-xs text-warning">{ta('paymentState.awaiting_confirmation')}</span>
                          )}
                        </td>
                        <td className={`text-right font-semibold whitespace-nowrap ${b.due > 0 ? 'text-warning' : 'text-success'}`}>
                          {formatXAF(b.due, l)}
                        </td>
                        <td>{b.due > 0 && <PayoutForm campaignId={c.id} ambassadorId={b.ambassador_id} due={b.due} />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Contenu */}
      {c.status !== 'closed' && (
        <section aria-labelledby="edit-title" className="card">
          <h2 id="edit-title" className="mb-4 text-lg font-semibold">
            {tf('editTitle')}
          </h2>
          <CampaignForm action={updateCampaign} campaign={c} fileName={fileName} />
        </section>
      )}
    </div>
  );
}
