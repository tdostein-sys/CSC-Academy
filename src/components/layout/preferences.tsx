'use client';

import { useState, useTransition, type MouseEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import { Check, Languages, Moon, Sun } from 'lucide-react';
import { setLocale } from '@/app/actions/preferences';
import { useThemeMode } from '@/components/theme/theme-provider';
import { tok } from '@/@core/theme/tokens';

/** Sélecteur de langue (cookie NEXT_LOCALE + profil si connecté). */
export function LanguageMenu() {
  const t = useTranslations('common');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = (value: 'fr' | 'en') => {
    setAnchor(null);
    if (value !== locale) startTransition(() => setLocale(value));
  };

  return (
    <>
      <Tooltip title={t('language')}>
        <IconButton
          color="inherit"
          aria-label={`${t('language')} : ${locale === 'en' ? t('english') : t('french')}`}
          aria-haspopup="menu"
          disabled={pending}
          onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
          sx={{ gap: 0.5, borderRadius: 1, fontSize: '0.8125rem', fontWeight: 600 }}
        >
          <Languages aria-hidden size={20} />
          <span aria-hidden>{locale.toUpperCase()}</span>
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        {(['fr', 'en'] as const).map((l) => (
          <MenuItem key={l} selected={l === locale} onClick={() => choose(l)} lang={l}>
            <ListItemText>{l === 'fr' ? t('french') : t('english')}</ListItemText>
            {l === locale && <Check aria-hidden size={16} style={{ marginLeft: 12 }} />}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * Bascule thème clair / sombre en un clic : soleil en thème clair, lune en
 * thème sombre. Tant qu'on n'a pas cliqué, le thème suit celui de l'appareil.
 */
export function ThemeMenu() {
  const t = useTranslations('common');
  const { mode, setPref } = useThemeMode();
  const dark = mode === 'dark';
  const label = dark ? t('switchToLight') : t('switchToDark');

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label}
        onClick={() => setPref(dark ? 'light' : 'dark')}
        sx={(theme) => ({
          color: dark ? tok(theme).text : '#b45309',
          bgcolor: dark ? tok(theme)['surface-2'] : tok(theme)['accent-soft'],
          '&:hover': dark ? { bgcolor: tok(theme).border } : { bgcolor: tok(theme).accent, color: tok(theme)['accent-fg'] },
        })}
      >
        {dark ? <Moon aria-hidden size={20} /> : <Sun aria-hidden size={20} />}
      </IconButton>
    </Tooltip>
  );
}
