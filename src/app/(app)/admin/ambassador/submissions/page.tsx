import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { FilterPills } from '@/components/ui/filter-pills';
import { SearchForm } from '@/components/ui/search-form';
import { SUBMISSION_ROW_SELECT, SubmissionsTable, type SubmissionRow } from '../_components/submissions-table';

export const metadata: Metadata = { title: 'Soumissions' };

const PAGE_SIZE = 30;
const STATUSES = ['pending', 'validated', 'rejected'] as const;

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [t, ta, tc, supabase] = await Promise.all([getTranslations('adminAmbassador.submissions'), getTranslations('ambassador'), getTranslations('common'), createClient()]);
  // Par défaut : la file des soumissions à traiter, les plus anciennes d'abord.
  const status = sp.status === 'all' ? null : (STATUSES.find((s) => s === sp.status) ?? 'pending');
  const { from, to, current } = pageRange(sp.page, PAGE_SIZE);
  const search = sp.q?.replace(/\D/g, '').slice(0, 12);

  let query = supabase
    .from('submissions')
    .select(SUBMISSION_ROW_SELECT, { count: 'exact' })
    .order('created_at', { ascending: status === 'pending' })
    .range(from, to);
  if (status) query = query.eq('status', status);
  if (search) query = query.like('binance_uid', `%${search}%`);
  const { data, count } = await query;

  return (
    <>
      <PageHeader title={t('title')} subtitle={String(count ?? 0)} />
      <Box sx={{ mb: 2, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: { md: 'center' }, justifyContent: 'space-between' }}>
        <FilterPills
          label={t('title')}
          items={[...STATUSES, 'all' as const].map((st) => ({
            key: st,
            href: `/admin/ambassador/submissions?status=${st}`,
            label: st === 'all' ? t('all') : ta(`status.${st}`),
            active: (status ?? 'all') === st,
          }))}
        />
        <Box sx={{ flex: 1, maxWidth: { md: 420 }, '& form': { mb: 0 } }}>
          <SearchForm defaultValue={search} placeholder={t('binanceUid')} label={tc('search')}>
            <input type="hidden" name="status" value={status ?? 'all'} />
          </SearchForm>
        </Box>
      </Box>
      <Box sx={{ mt: 4 }}>
        <SubmissionsTable rows={(data ?? []) as unknown as SubmissionRow[]} />
      </Box>
      <Pagination basePath="/admin/ambassador/submissions" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ status: status ?? 'all', q: search }} />
    </>
  );
}
