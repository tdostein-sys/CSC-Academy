import { getSessionUser } from '@/lib/auth';
import { ModuleTabs } from '@/components/layout/module-tabs';
import { MODULE_TABS } from '@/lib/navigation';

/** Consulting : onglets « Offres » et « Mes rendez-vous » (+ « Consultations » pour les conseillers). */
export default async function ConsultingLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const staff = Boolean(user && (user.isAdmin || user.isAdvisor));
  const tabs = [...MODULE_TABS.consulting, ...(staff ? [MODULE_TABS.consultingStaff] : [])];
  return (
    <>
      <ModuleTabs label="nav.consulting" tabs={tabs} />
      {children}
    </>
  );
}