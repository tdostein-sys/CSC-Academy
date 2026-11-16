import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AuditTable, type AuditRow } from '@/components/audit-table';

export const metadata: Metadata = { title: 'Administration' };

export default async function AdminOverviewPage() {
  await requireAdmin();
  const [t, tc, supabase] = await Promise.all([getTranslations('admin'), getTranslations('common'), createClient()]);

  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);
  const [users, admins, pending, failed, audit] = await Promise.all([
    count(supabase.from('profiles').select('id', { count: 'exact', head: true })),
    count(supabase.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'admin')),
    count(supabase.from('notification_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(supabase.from('notification_deliveries').select('id', { count: 'exact', head: true }).eq('status', 'failed')),
    supabase
      .from('audit_log')
      .select('id, action, entity, entity_id, data, created_at, actor:actor_id (first_name, last_name, username)')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const stats = [
    { label: t('overview.users'), value: users },
    { label: t('overview.admins'), value: admins },
    { label: t('overview.pendingDeliveries'), value: pending },
    { label: t('overview.failedDeliveries'), value: failed, alert: failed > 0 },
  ];

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{t('nav.overview')}</h1>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label} className="card">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.alert ? 'text-error' : ''}`}>{s.value}</p>
          </li>
        ))}
      </ul>
      <div className="mt-10 mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('overview.recentAudit')}</h2>
        <Link href="/admin/audit" className="link text-sm">
          {tc('seeAll')} →
        </Link>
      </div>
      <AuditTable rows={(audit.data ?? []) as unknown as AuditRow[]} />
    </>
  );
}
