'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

/** Sous-navigation en onglets (Tabs MUI), défilante sur mobile. */
export function SubNav({ label, links, exactRoot }: { label: string; links: { href: string; label: string }[]; exactRoot: string }) {
  const pathname = usePathname();
  const active =
    links
      .filter((l) => (l.href === exactRoot ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? false;

  return (
    <nav aria-label={label}>
      <Tabs value={active} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 6, borderBottom: 1, borderColor: 'divider' }}>
        {links.map((l) => (
          <Tab key={l.href} value={l.href} label={l.label} component={Link} href={l.href} aria-current={l.href === active ? 'page' : undefined} />
        ))}
      </Tabs>
    </nav>
  );
}
