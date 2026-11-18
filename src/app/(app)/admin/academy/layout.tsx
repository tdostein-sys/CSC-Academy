import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { SubNav } from '@/components/layout/sub-nav';

export default async function AdminAcademyLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations('adminAcademy.nav');
  const links = [
    { href: '/admin/academy', label: t('overview') },
    { href: '/admin/academy/courses', label: t('courses') },
    { href: '/admin/academy/enrollments', label: t('enrollments') },
    { href: '/admin/academy/payments', label: t('payments') },
    { href: '/admin/academy/commissions', label: t('commissions') },
    { href: '/admin/academy/certificates', label: t('certificates') },
  ];
  return (
    <>
      <SubNav label="CSC Academy" links={links} exactRoot="/admin/academy" />
      {children}
    </>
  );
}
