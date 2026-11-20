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
            // Chiffres tabulaires partout : montants, dates et tableaux restent alignés.
            body: { fontVariantNumeric: 'tabular-nums', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' },
            a: { color: theme.palette.primary.main },
            // Icônes Lucide : trait affiné (1,75) par défaut ; une épaisseur choisie explicitement est conservée.
            'svg.lucide[stroke-width="2"]': { strokeWidth: 1.75 },
            // Anneau de focus visible sur tout élément interactif (2 px, décalé de 2 px).
            ':focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2, borderRadius: 4 },
            // Animations et transitions désactivées si l'utilisateur l'a demandé.
            '@media (prefers-reduced-motion: reduce)': {
              '*, *::before, *::after': {
                animationDuration: '0.01ms !important',
                animationIterationCount: '1 !important',
                transitionDuration: '0.01ms !important',
                scrollBehavior: 'auto !important',
              },
            },
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
