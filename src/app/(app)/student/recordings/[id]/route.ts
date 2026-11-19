import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { playbackUrl } from '@/lib/academy/live';
import { ADMIN_LINK_SECONDS, STUDENT_LINK_MAX_SECONDS, canStream } from '@/lib/academy/live-shared';
import { UUID } from '@/lib/academy/types';

const NO_STORE = { 'Cache-Control': 'private, no-store' };

/**
 * Flux vidéo d'un replay, utilisé comme source du lecteur intégré.
 *  1. La base décide avec la session de l'utilisateur (`academy_replay_access`,
 *     sans rien créer) : un lien n'est donné qu'à l'admin ou pendant un
 *     visionnage en cours (inscription active et non bloquée).
 *  2. Seulement ensuite, le serveur lit l'emplacement du fichier (jamais
 *     exposé dans les pages) et redirige vers un lien R2 temporaire, valable
 *     au plus jusqu'à la fin du visionnage. Chaque rechargement redemande.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404, headers: NO_STORE });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('academy_replay_access', { p_recording: id, p_start: false });
  const access = (Array.isArray(data) ? data[0] : data) as { state: string; expires_at: string | null } | undefined;
  if (error || !access || !canStream(access.state) || !access.expires_at) {
    return new NextResponse(null, { status: 403, headers: NO_STORE });
  }

  const { data: file } = await createAdminClient().from('academy_recordings').select('object_key').eq('id', id).single();
  const maxSeconds = access.state === 'admin' ? ADMIN_LINK_SECONDS : STUDENT_LINK_MAX_SECONDS;
  const url = file ? playbackUrl((file as { object_key: string }).object_key, access.expires_at, maxSeconds) : null;
  if (!url) return new NextResponse(null, { status: 403, headers: NO_STORE });

  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
}
