'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import { ExternalLink, PlayCircle } from 'lucide-react';
import type { VideoEmbed as Video } from '@/lib/video';

/**
 * Lecteur vidéo « à la demande » : rien n'est téléchargé avant le clic
 * (connexions lentes, forfaits mobiles). Ensuite, lecteur YouTube (sans
 * cookies) ou Google Drive intégré.
 */
export function VideoEmbed({
  video,
  sourceUrl,
  title,
  labels,
}: {
  video: Video;
  sourceUrl: string;
  title: string;
  labels: { play: string; hint: string; open: string };
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <div>
      <Box
        sx={(theme) => ({
          position: 'relative',
          aspectRatio: video.vertical ? '9 / 16' : '16 / 9',
          width: '100%',
          maxWidth: video.vertical ? 360 : undefined,
          overflow: 'hidden',
          borderRadius: 1,
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'customColors.trackBg',
        })}
      >
        {playing ? (
          <iframe
            src={`${video.embedUrl}${video.provider === 'youtube' ? '?autoplay=1&rel=0' : ''}`}
            title={title}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <Box
            component="button"
            type="button"
            onClick={() => setPlaying(true)}
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              color: 'text.primary',
              font: 'inherit',
            }}
          >
            {video.thumbnailUrl && (
              // Vignette légère (~10 Ko) ; pas d'optimisation Next nécessaire.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnailUrl} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
            )}
            <Button component="span" variant="contained" size="large" startIcon={<PlayCircle aria-hidden size={20} />} sx={{ position: 'relative', borderRadius: 999 }}>
              {labels.play}
            </Button>
            <Box component="span" sx={{ position: 'relative', borderRadius: 1, px: 2, py: 0.5, fontSize: '0.75rem', bgcolor: 'background.paper', color: 'text.secondary' }}>
              {labels.hint}
            </Box>
          </Box>
        )}
      </Box>
      <Link href={sourceUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 2, display: 'inline-flex', alignItems: 'center', gap: 1, fontSize: '0.875rem' }}>
        <ExternalLink aria-hidden size={16} />
        {labels.open}
      </Link>
    </div>
  );
}
