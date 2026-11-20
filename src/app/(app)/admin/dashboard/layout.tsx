import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { SubNav } from '@/components/layout/sub-nav';

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations('adminDashboard.nav');
  const links = [
    { href: '/admin/dashboard', label: t('global') },
    { href: '/admin/dashboard/academy', label: t('academy') },
    { href: '/admin/dashboard/consulting', label: t('consulting') },
    { href: '/admin/dashboard/ambassador', label: t('ambassador') },
    { href: '/admin/dashboard/contact', label: t('contact') },
    { href: '/admin/dashboard/goals', label: t('goals') },
  ];
  return (
    <>
      <SubNav label={t('label')} links={links} exactRoot="/admin/dashboard" keepParams={['period', 'from', 'to']} />
      {children}
    </>
  );
}
