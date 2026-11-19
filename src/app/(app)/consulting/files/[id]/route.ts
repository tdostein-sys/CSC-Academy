import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { UUID } from '@/lib/consulting/types';

/**
 * Ouverture d'une pièce jointe de compte rendu : la base vérifie l'accès
 * (client du rendez-vous une fois publié, conseiller attribué ou admin) et
 * journalise l'ouverture ; le serveur crée ensuite un lien temporaire de 2 min.
 * Le chemin du fichier n'est jamais exposé aux navigateurs.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc('consulting_report_file_path', { p_file: id });
  if (error || typeof path !== 'string') return new NextResponse(null, { status: 404 });

  const { data: signed } = await createAdminClient().storage.from('consulting-files').createSignedUrl(path, 120);
  if (!signed?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
}
