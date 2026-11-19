import { getSessionUser } from '@/lib/auth';
import { AppShell, type ShellUser } from '@/components/layout/app-shell';

/** Pages de l'application : cadre Sneat (menu latéral + barre supérieure). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
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

  return <AppShell user={shellUser}>{children}</AppShell>;
}
