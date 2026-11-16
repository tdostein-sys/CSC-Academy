import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Download, Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { formatDate, formatXAF } from '@/lib/format';
import { num, type Ambassador, type CampaignBalance } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import { reactivateAmbassador, suspendAmbassador } from '../actions';

export const metadata: Metadata = { title: 'Ambassadeurs' };

const PAGE_SIZE = 30;

type Row = Ambassador & { profiles: { first_name: string; last_name: string; phone_whatsapp: string; email: string } };

export default async function AdminAmbassadorsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [t, ta, to, tc, locale, supabase] = await Promise.all([
    getTranslations('adminAmbassador.ambassadors'),
    getTranslations('ambassador'),
    getTranslations('adminAmbassador.overview'),
    getTranslations('common'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;
  const { from, to: end, current } = pageRange(sp.page, PAGE_SIZE);
  const search = sp.q?.trim().slice(0, 60);

  // Recherche : numéro CSC-AMB-xxxx, ou nom / téléphone (via le profil).
  let query = supabase
    .from('ambassadors')
    .select('*, profiles!inner (first_name, last_name, phone_whatsapp, email)', { count: 'exact' })
    .order('number', { ascending: false })
    .range(from, end);
  if (search) {
    const code = /(\d{1,6})$/.exec(search.toUpperCase().startsWith('CSC') ? search : '')?.[1];
    if (code) {
      query = query.eq('number', Number(code));
    } else {
      const s = search.replace(/[%_,()\\.]/g, ' ');
      query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone_whatsapp.ilike.%${s}%`, { referencedTable: 'profiles' });
    }
  }
  const { data, count } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const { data: balData } = rows.length
    ? await supabase.from('ambassador_balances').select('*').in('ambassador_id', rows.map((r) => r.user_id))
    : { data: [] };
  const balances = new Map(((balData ?? []) as CampaignBalance[]).map((b) => [b.ambassador_id, b]));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={String(count ?? 0)}
        actions={
          <a href="/admin/ambassador/export/ambassadors" className="btn-outline" download>
            <Download aria-hidden className="size-4" />
            {to('exportAmbassadors')}
          </a>
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={search} placeholder={t('searchPlaceholder')} className="input" aria-label={tc('search')} />
        <button type="submit" className="btn-outline" aria-label={tc('search')}>
          <Search aria-hidden className="size-4" />
        </button>
      </form>
      {rows.length === 0 ? (
        <p className="card text-muted">{search ? tc('noResults') : t('empty')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('code')}</th>
                <th>{t('name')}</th>
                <th>{t('phone')}</th>
                <th>{t('joined')}</th>
                <th className="text-right">{t('earned')}</th>
                <th className="text-right">{t('due')}</th>
                <th>{t('status')}</th>
                <th>{tc('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => {
                const b = balances.get(a.user_id);
                return (
                  <tr key={a.user_id}>
                    <td className="font-mono font-semibold whitespace-nowrap">{a.code}</td>
                    <td>
                      {a.profiles.first_name} {a.profiles.last_name}
                      <span className="block text-xs text-muted">{a.profiles.email}</span>
                    </td>
                    <td className="whitespace-nowrap">{a.profiles.phone_whatsapp}</td>
                    <td className="whitespace-nowrap">{formatDate(a.charter_accepted_at, l)}</td>
                    <td className="text-right whitespace-nowrap">{formatXAF(num(b?.earned), l)}</td>
                    <td className={`text-right whitespace-nowrap ${num(b?.due) > 0 ? 'font-semibold text-warning' : ''}`}>{formatXAF(num(b?.due), l)}</td>
                    <td>
                      <StatusBadge tone={a.status}>{ta(`ambassadorStatus.${a.status}`)}</StatusBadge>
                      {a.status === 'suspended' && a.status_reason && (
                        <span className="block max-w-48 text-xs whitespace-normal text-muted">{a.status_reason}</span>
                      )}
                    </td>
                    <td className="min-w-48">
                      {a.status === 'active' ? (
                        <details>
                          <summary className="btn-outline min-h-9 cursor-pointer list-none py-1 text-error [&::-webkit-details-marker]:hidden">
                            {t('suspend')}
                          </summary>
                          <ActionForm action={suspendAmbassador} className="mt-2 space-y-2">
                            <input type="hidden" name="user_id" value={a.user_id} />
                            <input
                              name="reason"
                              required
                              minLength={3}
                              maxLength={300}
                              placeholder={t('reasonPlaceholder')}
                              aria-label={t('reasonPlaceholder')}
                              className="input min-h-9 py-1 text-sm"
                            />
                            <button type="submit" className="btn-danger min-h-9 w-full py-1">
                              {t('suspend')}
                            </button>
                          </ActionForm>
                        </details>
                      ) : (
                        <ActionForm action={reactivateAmbassador} confirm={t('reactivateConfirm')} confirmLabel={t('reactivate')}>
                          <input type="hidden" name="user_id" value={a.user_id} />
                          <button type="submit" className="btn-outline min-h-9 py-1">
                            {t('reactivate')}
                          </button>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/admin/ambassador/ambassadors" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ q: search }} />
    </>
  );
}
