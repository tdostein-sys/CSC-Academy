import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { safeNextPath } from '@/lib/routes';

/**
 * Point d'arrivée des liens envoyés par Supabase Auth (confirmation
 * d'inscription, réinitialisation du mot de passe). Gère les deux formats :
 *   ?token_hash=…&type=…  (modèles d'e-mail recommandés, voir README)
 *   ?code=…               (flux PKCE par défaut)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get('next'), '/dashboard');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');

  const supabase = await createClient();
  let ok = false;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  if (!ok) return NextResponse.redirect(new URL('/auth/login?error=link', origin));
  const target = type === 'recovery' ? '/auth/reset-password' : next;
  return NextResponse.redirect(new URL(target, origin));
}
