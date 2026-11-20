'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

/**
 * Sous-navigation en onglets (Tabs MUI), défilante sur mobile.
 * `keepParams` : paramètres d'URL conservés d'un onglet à l'autre (ex. la
 * période du tableau de bord).
 */
export function SubNav({
  label,
  links,
  exactRoot,
  keepParams,
}: {
  label: string;
  links: { href: string; label: string }[];
  exactRoot: string;
  keepParams?: string[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active =
    links
      .filter((l) => (l.href === exactRoot ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`)))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? false;

  let suffix = '';
  if (keepParams?.length) {
    const kept = new URLSearchParams();
    for (const k of keepParams) {
      const v = searchParams.get(k);
      if (v) kept.set(k, v);
    }
    const qs = kept.toString();
    suffix = qs ? `?${qs}` : '';
  }

  return (
    <nav aria-label={label}>
      <Tabs value={active} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile sx={{ mb: 6, borderBottom: 1, borderColor: 'divider' }}>
        {links.map((l) => (
          <Tab key={l.href} value={l.href} label={l.label} component={Link} href={`${l.href}${suffix}`} aria-current={l.href === active ? 'page' : undefined} />
        ))}
      </Tabs>
    </nav>
  );
}
