import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';

export default async function AdminAmbassadorLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations('adminAmbassador.nav');
  const links = [
    { href: '/admin/ambassador', label: t('overview') },
    { href: '/admin/ambassador/campaigns', label: t('campaigns') },
    { href: '/admin/ambassador/submissions', label: t('submissions') },
    { href: '/admin/ambassador/payouts', label: t('payouts') },
    { href: '/admin/ambassador/ambassadors', label: t('ambassadors') },
    { href: '/admin/ambassador/queue', label: t('queue') },
  ];
  return (
    <>
      <nav aria-label="CSC Ambassador" className="-mx-4 mb-6 overflow-x-auto border-b border-border px-4">
        <ul className="flex gap-1 whitespace-nowrap">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="inline-block border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted hover:border-primary hover:text-text">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {children}
    </>
  );
}
