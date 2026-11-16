import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AuditTable, type AuditRow } from '@/components/audit-table';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';

export const metadata: Metadata = { title: 'Journal d’audit' };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const { page } = await searchParams;
  const [t, supabase] = await Promise.all([getTranslations('admin.audit'), createClient()]);
  const { from, to, current } = pageRange(page, 50);

  const { data, count } = await supabase
    .from('audit_log')
    .select('id, action, entity, entity_id, data, created_at, actor:actor_id (first_name, last_name, username)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <AuditTable rows={(data ?? []) as unknown as AuditRow[]} />
      <Pagination basePath="/admin/audit" current={current} total={count ?? 0} pageSize={50} />
    </>
  );
}
