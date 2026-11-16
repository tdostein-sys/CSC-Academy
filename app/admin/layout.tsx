import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations('admin');

  const links = [
    { href: '/admin', label: t('nav.overview') },
    { href: '/admin/ambassador', label: t('nav.ambassador') },
    { href: '/admin/users', label: t('nav.users') },
    { href: '/admin/content', label: t('nav.content') },
    { href: '/admin/deliveries', label: t('nav.deliveries') },
    { href: '/admin/audit', label: t('nav.audit') },
  ];

  return (
    <div className="container-page py-6">
      <p className="mb-3 text-xs font-semibold tracking-wide text-primary uppercase">{t('title')}</p>
      <nav aria-label={t('title')} className="-mx-4 mb-6 overflow-x-auto px-4">
        <ul className="flex gap-2 whitespace-nowrap">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-block rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-primary">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </div>
  );
}
