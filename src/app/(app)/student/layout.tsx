import { ModuleTabs } from '@/components/layout/module-tabs';
import { MODULE_TABS } from '@/lib/navigation';

/** Academy : onglets « Catalogue » (/academy) et « Mes formations » (/student). */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ModuleTabs label="nav.academy" tabs={[...MODULE_TABS.academy]} />
      {children}
    </>
  );
}