import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { SubNav } from '@/components/layout/sub-nav';

export default async function AdminConsultingLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations('adminConsulting.nav');
  const links = [
    { href: '/admin/consulting', label: t('overview') },
    { href: '/consulting/manage', label: t('bookings') },
    { href: '/admin/consulting/offers', label: t('offers') },
    { href: '/admin/consulting/availability', label: t('availability') },
    { href: '/admin/consulting/payments', label: t('payments') },
    { href: '/admin/consulting/settings', label: t('settings') },
  ];
  return (
    <>
      <SubNav label="CSC Consulting" links={links} exactRoot="/admin/consulting" />
      {children}
    </>
  );
}
