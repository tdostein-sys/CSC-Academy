'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { keepSessionAlive, logoutWithReason } from '@/app/auth/actions';
import { ACTIVITY_STORAGE_KEY, IDLE_MS, SESSION_CHANNEL, WARNING_SECONDS } from '@/lib/session-policy';

type Message = { type: 'activity'; at: number } | { type: 'logout'; reason: string | null };

/** Écritures d'activité limitées : au plus une toutes les 15 s. */
const ACTIVITY_THROTTLE_MS = 15_000;
/** Pendant l'activité, le serveur est prévenu au plus toutes les 5 min. */
const SERVER_PING_MS = 5 * 60_000;
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
/** Pages où l'on peut rester longtemps sans toucher l'écran (visio). */
const isLivePage = (p: string) => p.startsWith('/live/') || /\/live$/.test(p);

/** Déconnexion volontaire : les autres onglets ouverts se déconnectent aussi. */
export function broadcastLogout() {
  try {
    const ch = new BroadcastChannel(SESSION_CHANNEL);
    ch.postMessage({ type: 'logout', reason: null } satisfies Message);
    ch.close();
  } catch {
    // Navigateur sans BroadcastChannel : les autres onglets seront déconnectés à leur prochaine requête.
  }
}

function readStored(): number {
  try {
    return Number(localStorage.getItem(ACTIVITY_STORAGE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeStored(at: number) {
  try {
    localStorage.setItem(ACTIVITY_STORAGE_KEY, String(at));
  } catch {
    // Navigation privée stricte : la synchronisation passe par BroadcastChannel seul.
  }
}

function formatCountdown(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Déconnexion après inactivité (navigateur).
 *  - activité = clics, frappes, défilement, navigation (écoute limitée) ;
 *  - avertissement 2 min avant : « Rester connecté » / « Me déconnecter » ;
 *  - synchronisation entre onglets (BroadcastChannel + localStorage) :
 *    l'activité d'un onglet garde les autres actifs, la déconnexion d'un
 *    onglet déconnecte tous les autres ;
 *  - le serveur applique la même règle (proxy) : même onglet fermé ou
 *    ordinateur en veille, la session expire.
 */
export function IdleTimeout() {
  const t = useTranslations('session');
  const pathname = usePathname();
  const [remaining, setRemaining] = useState<number | null>(null);
  const [, startTransition] = useTransition();
  const last = useRef(0);
  const lastWrite = useRef(0);
  const lastPing = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const leaving = useRef(false);

  const leave = useCallback(
    (reason: string | null, broadcast: boolean) => {
      if (leaving.current) return;
      leaving.current = true;
      if (broadcast) channel.current?.postMessage({ type: 'logout', reason } satisfies Message);
      startTransition(() => {
        void logoutWithReason(reason, window.location.pathname + window.location.search);
      });
    },
    [startTransition],
  );

  const markActive = useCallback((force = false) => {
    const now = Date.now();
    last.current = Math.max(last.current, now);
    if (!force && now - lastWrite.current < ACTIVITY_THROTTLE_MS) return;
    lastWrite.current = now;
    writeStored(now);
    channel.current?.postMessage({ type: 'activity', at: now } satisfies Message);
    if (now - lastPing.current > SERVER_PING_MS) {
      lastPing.current = now;
      void keepSessionAlive();
    }
  }, []);

  // Écoute de l'activité et des autres onglets.
  useEffect(() => {
    const now = Date.now();
    last.current = Math.max(readStored(), now);
    lastPing.current = now; // la page vient d'être servie : le serveur est à jour
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel(SESSION_CHANNEL);
      channel.current.onmessage = (e: MessageEvent<Message>) => {
        if (e.data?.type === 'activity') last.current = Math.max(last.current, e.data.at);
        if (e.data?.type === 'logout') leave(e.data.reason, false);
      };
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === ACTIVITY_STORAGE_KEY && e.newValue) last.current = Math.max(last.current, Number(e.newValue) || 0);
    };
    const onActivity = () => markActive();
    for (const ev of EVENTS) window.addEventListener(ev, onActivity, { passive: true, capture: true });
    window.addEventListener('storage', onStorage);
    return () => {
      for (const ev of EVENTS) window.removeEventListener(ev, onActivity, { capture: true });
      window.removeEventListener('storage', onStorage);
      channel.current?.close();
      channel.current = null;
    };
  }, [leave, markActive]);

  // Changer de page est une activité.
  useEffect(() => {
    markActive(true);
  }, [pathname, markActive]);

  // Horloge : avertissement puis déconnexion.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (isLivePage(window.location.pathname)) {
        markActive();
        setRemaining(null);
        return;
      }
      last.current = Math.max(last.current, readStored());
      const left = Math.ceil((IDLE_MS - (Date.now() - last.current)) / 1000);
      if (left <= 0) {
        setRemaining(0);
        leave('inactivite', true);
      } else {
        setRemaining(left <= WARNING_SECONDS ? left : null);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [leave, markActive]);

  const open = remaining !== null && remaining > 0;

  return (
    <Dialog open={open} aria-labelledby="idle-title" aria-describedby="idle-body" role="alertdialog" maxWidth="xs" fullWidth>
      <DialogTitle id="idle-title">{t('warningTitle')}</DialogTitle>
      <DialogContent>
        <Typography id="idle-body">
          {t('warningBody', { countdown: formatCountdown(remaining ?? 0) })}
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexWrap: 'wrap' }}>
        <Button variant="outlined" onClick={() => leave(null, true)}>
          {t('logoutNow')}
        </Button>
        <Button
          variant="contained"
          autoFocus
          onClick={() => {
            lastPing.current = 0;
            markActive(true);
            setRemaining(null);
          }}
        >
          {t('stay')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
