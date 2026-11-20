'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { tok } from '@/@core/theme/tokens';
import { RotateCcw } from 'lucide-react';
import { Notice } from '@/components/ui/notice';

interface Props {
  /** Adresse de NOTRE serveur (qui revérifie l'accès), jamais celle du fichier. */
  src: string;
  /** Fin du droit de lecture (ISO). */
  until: string;
  title: string;
  labels: { expired: string; interrupted: string; retry: string };
}

/**
 * Lecteur intégré des replays : contrôles du navigateur sans bouton de
 * téléchargement ni menu clic droit. À l'heure de fin, la lecture s'arrête
 * et la page se met à jour (« Déjà visionné »).
 */
export function ReplayPlayer({ src, until, title, labels }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [expired, setExpired] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const ms = new Date(until).getTime() - Date.now();
    const stop = () => {
      video.current?.pause();
      setExpired(true);
      router.refresh();
    };
    if (ms <= 0) {
      const id = setTimeout(stop, 0);
      return () => clearTimeout(id);
    }
    const id = setTimeout(stop, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(id);
  }, [until, router]);

  if (expired) return <Notice tone="info">{labels.expired}</Notice>;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {failed && (
        <Notice tone="warning">
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
            {labels.interrupted}
            <Button
              size="small"
              variant="outlined"
              startIcon={<RotateCcw aria-hidden size={16} />}
              onClick={() => {
                setFailed(false);
                setAttempt((a) => a + 1);
              }}
            >
              {labels.retry}
            </Button>
          </Box>
        </Notice>
      )}
      <video
        key={attempt}
        ref={video}
        // `attempt` force une nouvelle demande au serveur, donc un nouveau lien temporaire.
        src={attempt ? `${src}?r=${attempt}` : src}
        controls
        controlsList="nodownload"
        disablePictureInPicture
        playsInline
        preload="metadata"
        aria-label={title}
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={(e) => {
          if (resumeAt.current > 0) e.currentTarget.currentTime = resumeAt.current;
        }}
        onTimeUpdate={(e) => {
          resumeAt.current = e.currentTarget.currentTime;
        }}
        onError={() => setFailed(true)}
        style={{ width: '100%', aspectRatio: '16 / 9', background: tok(theme).media, borderRadius: 12, display: 'block' }}
      />
    </Box>
  );
}
