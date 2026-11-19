'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import GlobalStyles from '@mui/material/GlobalStyles';
import { ThemeProvider, createTheme, responsiveFontSizes } from '@mui/material/styles';
import themeOptions from '@/@core/theme/ThemeOptions';
import { defaultSettings, type Mode } from '@/@core/theme/settings';
import { THEME_COOKIE, THEME_SYSTEM_COOKIE, writeCookie, type ThemePref } from '@/lib/theme-cookies';

interface ThemeModeValue {
  pref: ThemePref;
  mode: Mode;
  setPref: (p: ThemePref) => void;
}

const ThemeModeContext = createContext<ThemeModeValue | null>(null);

export function useThemeMode(): ThemeModeValue {
  const v = useContext(ThemeModeContext);
  if (!v) throw new Error('useThemeMode hors de AppThemeProvider');
  return v;
}

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

/**
 * Thème Sneat (MUI) aux couleurs CSC, clair / sombre / système.
 * La préférence est gardée dans un cookie : le serveur rend directement le bon thème.
 */
export function AppThemeProvider({
  initialPref,
  initialSystemMode,
  children,
}: {
  initialPref: ThemePref;
  initialSystemMode: Mode;
  children: ReactNode;
}) {
  const [pref, setPrefState] = useState<ThemePref>(initialPref);
  const systemMode = useSyncExternalStore<Mode>(
    subscribe,
    () => (window.matchMedia(QUERY).matches ? 'dark' : 'light'),
    () => initialSystemMode,
  );

  // Mémorise le thème système observé pour le prochain rendu serveur.
  useEffect(() => {
    writeCookie(THEME_SYSTEM_COOKIE, systemMode);
  }, [systemMode]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    writeCookie(THEME_COOKIE, p);
  }, []);

  const mode: Mode = pref === 'system' ? systemMode : pref;

  const theme = useMemo(() => responsiveFontSizes(createTheme(themeOptions({ ...defaultSettings, mode }))), [mode]);
  const value = useMemo(() => ({ pref, mode, setPref }), [pref, mode, setPref]);

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <GlobalStyles
          styles={{
            'html, body': { minHeight: '100%' },
            a: { color: theme.palette.primary.main },
            ':focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            // Cases à cocher et boutons radio natifs (questionnaire) : couleur principale du thème.
            'input[type="checkbox"], input[type="radio"]': { accentColor: theme.palette.primary.main },
            '.sr-only': {
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0, 0, 0, 0)',
              whiteSpace: 'nowrap',
              border: 0,
            },
          }}
        />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
