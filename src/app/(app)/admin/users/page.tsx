import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { SearchForm } from '@/components/ui/search-form';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import type { Locale, Profile } from '@/lib/types';

export const metadata: Metadata = { title: 'Utilisateurs' };

const PAGE_SIZE = 25;

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const [t, tc, td, locale, supabase] = await Promise.all([
    getTranslations('admin.users'),
    getTranslations('common'),
    getTranslations('dashboard.roles'),
    getLocale(),
    createClient(),
  ]);
  const { from, to, current } = pageRange(page, PAGE_SIZE);

  let query = supabase
    .from('profiles')
    .select('id, username, email, first_name, last_name, phone_whatsapp, created_at, user_roles!user_roles_user_id_fkey (role)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  const search = q?.trim().slice(0, 80);
  if (search) {
    // Échappe les caractères spéciaux du filtre PostgREST.
    const s = search.replace(/[%_,()\\]/g, ' ');
    query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,email.ilike.%${s}%,phone_whatsapp.ilike.%${s}%`);
  }

  const { data, count } = await query;
  const rows = (data ?? []) as (Profile & { user_roles: { role: string }[] })[];

  return (
    <>
      <PageHeader title={t('title')} subtitle={`${count ?? 0}`} />
      <SearchForm defaultValue={search} placeholder={t('searchPlaceholder')} label={tc('search')} />
      {rows.length === 0 ? (
        <EmptyCard>{search ? tc('noResults') : t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('name'), t('email'), t('phone'), t('roles'), t('joined')]}>
          {rows.map((u) => (
            <TableRow key={u.id} hover>
              <TableCell sx={{ fontWeight: 500 }}>
                {u.first_name} {u.last_name}
                {u.username && (
                  <Typography variant="caption" component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                    @{u.username}
                  </Typography>
                )}
              </TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{u.phone_whatsapp}</TableCell>
              <TableCell>
                {u.user_roles.some((r) => r.role === 'admin') ? <StatusBadge tone="accent">{td('admin')}</StatusBadge> : <StatusBadge tone="neutral">{td('user')}</StatusBadge>}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(u.created_at, locale as Locale)}</TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
      <Pagination basePath="/admin/users" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ q: search }} />
    </>
  );
}
