/**
 * Vidéos publiées par lien : YouTube, TikTok, Vimeo ou Google Drive (fichier
 * partagé publiquement). Renvoie l'URL d'intégration, ou null si le lien n'est
 * pas reconnu (aucun autre site n'est intégré dans l'application).
 */
export interface VideoEmbed {
  provider: 'youtube' | 'drive' | 'tiktok' | 'vimeo';
  id: string;
  embedUrl: string;
  /** Vidéo verticale (format téléphone, ex. TikTok). */
  vertical?: boolean;
  /** Vignette légère affichée avant le chargement du lecteur (YouTube seulement). */
  thumbnailUrl?: string;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;
const TIKTOK_ID = /^\d{8,25}$/;
const VIMEO_ID = /^\d{6,12}$/;

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

  // TikTok : lien complet « https://www.tiktok.com/@compte/video/123… ».
  // (Les liens courts vm.tiktok.com ne contiennent pas l'identifiant.)
  if (host === 'tiktok.com') {
    const m = /^\/@[^/]+\/video\/(\d+)/.exec(url.pathname) ?? /^\/embed\/(?:v2\/)?(\d+)/.exec(url.pathname);
    if (!m || !TIKTOK_ID.test(m[1])) return null;
    return { provider: 'tiktok', id: m[1], embedUrl: `https://www.tiktok.com/embed/v2/${m[1]}`, vertical: true };
  }

  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = /^\/(?:video\/)?(\d+)/.exec(url.pathname);
    if (!m || !VIMEO_ID.test(m[1])) return null;
    return { provider: 'vimeo', id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}` };
  }
  return null;
}
