'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Box from '@mui/material/Box';

/**
 * Barre de progression fine en haut de l'écran pendant un changement de page.
 * Elle démarre AU CLIC sur un lien interne (retour visuel immédiat, avant
 * même la réponse du serveur) et se termine quand la nouvelle adresse est
 * affichée. Aucune dépendance externe.
 */
function Bar() {
  const t = useTranslations('shell');
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');
  const timer = useRef<number | null>(null);
  const current = `${pathname}?${search.toString()}`;
  const last = useRef(current);

  // Fin : la nouvelle page est rendue.
  useEffect(() => {
    if (last.current === current) return;
    last.current = current;
    setState('done');
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 300);
  }, [current]);

  // Début : clic sur un lien interne vers une autre adresse.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (timer.current) window.clearTimeout(timer.current);
      setState('loading');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  if (state === 'idle') return null;
  return (
    <Box
      role="progressbar"
      aria-label={t('loadingPage')}
      aria-busy={state === 'loading'}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: (t) => t.zIndex.tooltip + 1,
        pointerEvents: 'none',
        '& > span': {
          display: 'block',
          height: '100%',
          bgcolor: 'primary.main',
          width: state === 'done' ? '100%' : '85%',
          opacity: state === 'done' ? 0 : 1,
          transition: state === 'done' ? 'width 150ms ease-out, opacity 250ms ease-out 100ms' : 'width 8s cubic-bezier(0.1, 0.7, 0.2, 1)',
          '@keyframes csc-progress-start': { from: { width: '0%' }, to: { width: '85%' } },
          animation: state === 'loading' ? 'csc-progress-start 8s cubic-bezier(0.1, 0.7, 0.2, 1)' : 'none',
        },
      }}
    >
      <span />
    </Box>
  );
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
