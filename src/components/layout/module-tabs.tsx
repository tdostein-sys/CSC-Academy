'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SubNav } from './sub-nav';

/**
 * Onglets internes d'un module (« Catalogue / Mes formations »,
 * « Offres / Mes rendez-vous »). Affichés sur les pages de liste ; les pages
 * de détail ont un fil d'Ariane à la place. Aucune nouvelle adresse.
 */
export function ModuleTabs({ label, tabs }: { label: string; tabs: { href: string; label: string }[] }) {
  const t = useTranslations();
  const pathname = usePathname();
  if (!tabs.some((tab) => tab.href === pathname)) return null;
  return <SubNav label={t(label)} links={tabs.map((tab) => ({ href: tab.href, label: t(tab.label) }))} exactRoot={tabs[0].href} />;
}
