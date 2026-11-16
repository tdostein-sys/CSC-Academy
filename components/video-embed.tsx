'use client';

import { useState } from 'react';
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
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-surface-2">
        {playing ? (
          <iframe
            src={`${video.embedUrl}${video.provider === 'youtube' ? '?autoplay=1&rel=0' : ''}`}
            title={title}
            className="absolute inset-0 size-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-2 text-text"
          >
            {video.thumbnailUrl && (
              // Vignette légère (~10 Ko) ; pas d'optimisation Next nécessaire.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={video.thumbnailUrl} alt="" loading="lazy" className="absolute inset-0 size-full object-cover opacity-60" />
            )}
            <span className="relative flex items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-primary-fg shadow group-hover:bg-primary-hover">
              <PlayCircle aria-hidden className="size-5" />
              {labels.play}
            </span>
            <span className="relative rounded bg-bg/90 px-2 py-0.5 text-xs text-muted">{labels.hint}</span>
          </button>
        )}
      </div>
      <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="link mt-2 inline-flex items-center gap-1 text-sm">
        <ExternalLink aria-hidden className="size-4" />
        {labels.open}
      </a>
    </div>
  );
}
