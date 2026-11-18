import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { TextField } from '@/components/forms/fields';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { Collapsible } from '@/components/ui/collapsible';
import { SearchForm } from '@/components/ui/search-form';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
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
    ? await supabase
        .from('ambassador_balances')
        .select('*')
        .in(
          'ambassador_id',
          rows.map((r) => r.user_id),
        )
    : { data: [] };
  const balances = new Map(((balData ?? []) as CampaignBalance[]).map((b) => [b.ambassador_id, b]));

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={String(count ?? 0)}
        actions={
          <Button href="/admin/ambassador/export/ambassadors" download variant="outlined" startIcon={<Download aria-hidden size={18} />}>
            {to('exportAmbassadors')}
          </Button>
        }
      />
      <SearchForm defaultValue={search} placeholder={t('searchPlaceholder')} label={tc('search')} />
      {rows.length === 0 ? (
        <EmptyCard>{search ? tc('noResults') : t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('code'), t('name'), t('phone'), t('joined'), t('earned'), t('due'), t('status'), tc('actions')]}>
          {rows.map((a) => {
            const b = balances.get(a.user_id);
            const due = num(b?.due);
            return (
              <TableRow key={a.user_id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{a.code}</TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {a.profiles.first_name} {a.profiles.last_name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {a.profiles.email}
                  </Typography>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{a.profiles.phone_whatsapp}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(a.charter_accepted_at, l)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(num(b?.earned), l)}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', ...(due > 0 && { fontWeight: 600, color: 'warning.main' }) }}>{formatXAF(due, l)}</TableCell>
                <TableCell>
                  <StatusBadge tone={a.status}>{ta(`ambassadorStatus.${a.status}`)}</StatusBadge>
                  {a.status === 'suspended' && a.status_reason && (
                    <Typography variant="caption" component="p" sx={{ maxWidth: 192, color: 'text.secondary' }}>
                      {a.status_reason}
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 192 }}>
                  {a.status === 'active' ? (
                    <Collapsible kind="dangerButton" summary={t('suspend')}>
                      <ActionForm action={suspendAmbassador} style={{ marginTop: 8, display: 'grid', gap: 8 }}>
                        <input type="hidden" name="user_id" value={a.user_id} />
                        <TextField name="reason" label={t('reasonPlaceholder')} required minLength={3} maxLength={300} size="small" />
                        <Button type="submit" variant="contained" color="error" fullWidth size="small">
                          {t('suspend')}
                        </Button>
                      </ActionForm>
                    </Collapsible>
                  ) : (
                    <ActionForm action={reactivateAmbassador} confirm={t('reactivateConfirm')} confirmLabel={t('reactivate')}>
                      <input type="hidden" name="user_id" value={a.user_id} />
                      <Button type="submit" variant="outlined" size="small">
                        {t('reactivate')}
                      </Button>
                    </ActionForm>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableCard>
      )}
      <Pagination basePath="/admin/ambassador/ambassadors" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ q: search }} />
    </>
  );
}
