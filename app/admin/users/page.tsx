import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Search } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
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
                <th>{t('name')}</th>
                <th>{t('email')}</th>
                <th>{t('phone')}</th>
                <th>{t('roles')}</th>
                <th>{t('joined')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">
                    {u.first_name} {u.last_name}
                    {u.username && <span className="block text-xs text-muted">@{u.username}</span>}
                  </td>
                  <td>{u.email}</td>
                  <td className="whitespace-nowrap">{u.phone_whatsapp}</td>
                  <td>
                    {u.user_roles.some((r) => r.role === 'admin') ? (
                      <span className="badge bg-accent text-accent-fg">{td('admin')}</span>
                    ) : (
                      <span className="badge bg-surface-2 text-muted">{td('user')}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(u.created_at, locale as Locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination basePath="/admin/users" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ q: search }} />
    </>
  );
}
