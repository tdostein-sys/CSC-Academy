import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { playbackUrl } from '@/lib/academy/live';
import { UUID } from '@/lib/academy/types';

/**
 * Lecture d'un enregistrement de séance.
 *  1. Lecture avec la session de l'utilisateur : la RLS ne renvoie
 *     l'enregistrement qu'aux inscrits actifs non bloqués (ou à l'admin),
 *     tant qu'il est prêt et non expiré.
 *  2. Seulement ensuite, le serveur lit l'emplacement du fichier (jamais
 *     exposé) et redirige vers un lien de lecture temporaire (2 h maximum).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.from('academy_recordings').select('id, status, expires_at').eq('id', id).maybeSingle();
  const r = data as { id: string; status: string; expires_at: string } | null;
  if (!r || r.status !== 'ready' || new Date(r.expires_at).getTime() <= Date.now()) {
    return new NextResponse(null, { status: 404 });
  }

  const { data: file } = await createAdminClient().from('academy_recordings').select('object_key').eq('id', r.id).single();
  const url = file ? playbackUrl((file as { object_key: string }).object_key, r.expires_at) : null;
  if (!url) return new NextResponse(null, { status: 404 });

  return NextResponse.redirect(url, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
}
