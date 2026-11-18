'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import { tok } from '@/@core/theme/tokens';

const TABS = [
  { href: '/auth/login', key: 'login' },
  { href: '/auth/register', key: 'register' },
] as const;

/**
 * Bascule « Se connecter / Créer un compte » en tête de la carte
 * d'authentification. Affichée uniquement sur ces deux pages.
 */
export function AuthTabs() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  if (!TABS.some((tab) => tab.href === pathname)) return null;

  return (
    <Box
      component="nav"
      aria-label={`${t('login')} / ${t('register')}`}
      sx={(theme) => ({
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 1,
        p: 1,
        mb: 7,
        borderRadius: 2,
        bgcolor: tok(theme)['surface-2'],
      })}
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Box
            key={tab.href}
            component={Link}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            sx={(theme) => ({
              py: 2,
              textAlign: 'center',
              borderRadius: 1.5,
              fontWeight: 600,
              fontSize: '0.9375rem',
              textDecoration: 'none',
              transition: 'background-color .2s, box-shadow .2s, color .2s',
              color: active ? tok(theme)['primary-fg'] : tok(theme).muted,
              background: active ? `linear-gradient(135deg, ${tok(theme).primary}, ${tok(theme)['primary-hover']})` : 'transparent',
              boxShadow: active ? `0 4px 12px ${theme.palette.mode === 'dark' ? 'rgba(0,0,0,.35)' : 'rgba(29,95,214,.3)'}` : 'none',
              '&:hover': active ? {} : { color: tok(theme).text },
              '&:focus-visible': { outline: `2px solid ${tok(theme).primary}`, outlineOffset: 2 },
            })}
          >
            {t(tab.key)}
          </Box>
        );
      })}
    </Box>
  );
}
