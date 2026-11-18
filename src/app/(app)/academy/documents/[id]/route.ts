import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UUID } from '@/lib/academy/types';

/**
 * Ouverture d'un document PDF de formation : lien temporaire (2 minutes).
 * La base vérifie l'accès (inscription active ou admin) deux fois : en
 * lecture de la ressource (RLS), puis sur le fichier (politique du stockage).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.from('academy_resources').select('file_path').eq('id', id).eq('kind', 'document').maybeSingle();
  if (!data?.file_path) return new NextResponse(null, { status: 404 });

  const { data: signed } = await supabase.storage.from('academy-files').createSignedUrl(data.file_path, 120);
  if (!signed?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
}
