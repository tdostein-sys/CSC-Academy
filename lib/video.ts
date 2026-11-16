/**
 * Vidéos de campagne : liens YouTube ou Google Drive (fichier partagé
 * publiquement). Renvoie l'URL d'intégration, ou null si le lien n'est pas
 * reconnu (aucun autre site n'est intégré dans l'application).
 */
export interface VideoEmbed {
  provider: 'youtube' | 'drive';
  id: string;
  embedUrl: string;
  /** Vignette légère affichée avant le chargement du lecteur (YouTube seulement). */
  thumbnailUrl?: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

export function parseVideoUrl(raw: string | null | undefined): VideoEmbed | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.replace(/^(www\.|m\.)/, '');

  let ytId: string | null = null;
  if (host === 'youtu.be') {
    ytId = url.pathname.split('/')[1] ?? null;
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const [, first, second] = url.pathname.split('/');
    if (first === 'watch') ytId = url.searchParams.get('v');
    else if (first === 'shorts' || first === 'embed' || first === 'live') ytId = second ?? null;
  }
  if (ytId !== null) {
    if (!YT_ID.test(ytId)) return null;
    return {
      provider: 'youtube',
      id: ytId,
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}`,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
    };
  }

  if (host === 'drive.google.com') {
    const m = /^\/file\/d\/([^/]+)/.exec(url.pathname);
    const id = m?.[1] ?? (url.pathname === '/open' ? url.searchParams.get('id') : null);
    if (!id || !DRIVE_ID.test(id)) return null;
    return { provider: 'drive', id, embedUrl: `https://drive.google.com/file/d/${id}/preview` };
  }
  return null;
}
