import { getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { SubNav } from '@/components/layout/sub-nav';

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
      <SubNav label="CSC Ambassador" links={links} exactRoot="/admin/ambassador" />
      {children}
    </>
  );
}
