import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { SUBMISSION_ROW_SELECT, SubmissionsTable, type SubmissionRow } from '../_components/submissions-table';

export const metadata: Metadata = { title: 'Soumissions' };

const PAGE_SIZE = 30;
const STATUSES = ['pending', 'validated', 'rejected'] as const;

export default async function AdminSubmissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; page?: string; q?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [t, ta, tc, supabase] = await Promise.all([
    getTranslations('adminAmbassador.submissions'),
    getTranslations('ambassador'),
    getTranslations('common'),
    createClient(),
  ]);
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
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-1 text-sm" aria-label={t('title')}>
          {[...STATUSES, 'all' as const].map((st) => {
            const active = (status ?? 'all') === st;
            return (
              <Link
                key={st}
                href={`/admin/ambassador/submissions?status=${st}`}
                className={`rounded-full px-3 py-1 ${active ? 'bg-primary text-primary-fg' : 'bg-surface-2 hover:bg-border'}`}
                aria-current={active ? 'page' : undefined}
              >
                {st === 'all' ? t('all') : ta(`status.${st}`)}
              </Link>
            );
          })}
        </nav>
        <form role="search" className="flex gap-2">
          <input type="hidden" name="status" value={status ?? 'all'} />
          <input name="q" defaultValue={search} inputMode="numeric" placeholder={t('binanceUid')} aria-label={tc('search')} className="input min-h-10 py-1" />
          <button type="submit" className="btn-outline min-h-10 py-1">
            {tc('search')}
          </button>
        </form>
      </div>
      <SubmissionsTable rows={(data ?? []) as unknown as SubmissionRow[]} />
      <Pagination
        basePath="/admin/ambassador/submissions"
        current={current}
        total={count ?? 0}
        pageSize={PAGE_SIZE}
        params={{ status: status ?? 'all', q: search }}
      />
    </>
  );
}
