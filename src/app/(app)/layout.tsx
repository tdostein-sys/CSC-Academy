import { getTranslations } from 'next-intl/server';
import { getSessionUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { whatsappLink } from '@/lib/contact';
import { AppShell, type ShellUser } from '@/components/layout/app-shell';

/** Pages de l'application : menu latéral + barre supérieure + conteneur de page. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // En parallèle : utilisateur, numéro WhatsApp de CSC (encart « Besoin d'aide ? »), textes.
  const [user, { data: contact }, t] = await Promise.all([
    getSessionUser(),
    createClient().then((s) => s.from('contact_settings').select('whatsapp').maybeSingle()),
    getTranslations('nav.help'),
  ]);
  const shellUser: ShellUser | null = user
    ? {
        firstName: user.profile.first_name,
        lastName: user.profile.last_name,
        email: user.email,
        isAdmin: user.isAdmin,
        isAdvisor: user.isAdvisor,
        ambassadorCode: user.ambassador?.code ?? null,
        unread: user.unreadNotifications,
      }
    : null;

  return (
    <AppShell user={shellUser} help={{ whatsappUrl: whatsappLink((contact as { whatsapp: string } | null)?.whatsapp, t('whatsappMessage')) }}>
      {children}
    </AppShell>
  );
}