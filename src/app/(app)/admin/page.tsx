import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AuditTable, type AuditRow } from '@/components/audit-table';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { LinkButton } from '@/components/ui/links';

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

  return (
    <>
      <PageHeader title={t('nav.overview')} />
      <Grid container spacing={6}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.users')} value={users} icon="Users" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.admins')} value={admins} icon="Shield" tone="accent" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.pendingDeliveries')} value={pending} icon="Clock" tone="warning" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label={t('overview.failedDeliveries')} value={failed} icon="AlertTriangle" tone="error" highlight={failed > 0} />
        </Grid>
      </Grid>
      <Box sx={{ mt: 10, mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" component="h2">
          {t('overview.recentAudit')}
        </Typography>
        <LinkButton href="/admin/audit" size="small">
          {tc('seeAll')} →
        </LinkButton>
      </Box>
      <AuditTable rows={(audit.data ?? []) as unknown as AuditRow[]} />
    </>
  );
}
