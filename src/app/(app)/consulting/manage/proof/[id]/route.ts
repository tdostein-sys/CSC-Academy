import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UUID } from '@/lib/consulting/types';

/**
 * Justificatif d'un paiement (administrateur uniquement) : la RLS ne renvoie
 * le paiement qu'à l'admin (ou au client, sans accès au fichier), puis la
 * politique du stockage réserve le fichier à l'admin. Lien de 2 minutes.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc('is_admin');
  if (isAdmin !== true) return new NextResponse(null, { status: 404 });
  const { data } = await supabase.from('consulting_payments').select('proof_path').eq('id', id).maybeSingle();
  if (!data?.proof_path) return new NextResponse(null, { status: 404 });
  const { data: signed } = await supabase.storage.from('consulting-files').createSignedUrl(data.proof_path as string, 120);
  if (!signed?.signedUrl) return new NextResponse(null, { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
}
