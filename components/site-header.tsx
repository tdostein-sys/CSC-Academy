import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Bell, LayoutDashboard, LogOut, Menu, Shield, User } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';
import { logout } from '@/app/auth/actions';
import { Logo } from './logo';

/** En-tête : rendu serveur, menu mobile sans JavaScript (<details>). */
export async function SiteHeader() {
  const [t, user] = await Promise.all([getTranslations('nav'), getSessionUser()]);

  const modules = [
    { href: '/ambassador', label: t('ambassador') },
    { href: '/academy', label: t('academy') },
    { href: '/consulting', label: t('consulting') },
    { href: '/ga', label: t('ga') },
  ];

  const tc = await getTranslations('common');
  const tn = await getTranslations('notifications');

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-3">
        <Logo />

        <nav aria-label={t('mainNav')} className="ml-4 hidden items-center gap-1 md:flex">
          {modules.map((m) => (
            <Link key={m.href} href={m.href} className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-text">
              {m.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {user ? (
            <>
              <Link
                href="/notifications"
                className="relative flex size-11 items-center justify-center rounded-lg hover:bg-surface-2"
                aria-label={tn('bellLabel', { count: user.unreadNotifications })}
              >
                <Bell aria-hidden className="size-5" />
                {user.unreadNotifications > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-fg">
                    {user.unreadNotifications > 99 ? '99+' : user.unreadNotifications}
                  </span>
                )}
              </Link>
              <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">
                <LayoutDashboard aria-hidden className="size-4" />
                {t('dashboard')}
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn-ghost hidden sm:inline-flex">
                {t('login')}
              </Link>
              <Link href="/auth/register" className="btn-primary hidden sm:inline-flex">
                {t('register')}
              </Link>
            </>
          )}

          <details className="group relative">
            <summary
              className="flex size-11 cursor-pointer list-none items-center justify-center rounded-lg hover:bg-surface-2 [&::-webkit-details-marker]:hidden"
              aria-label={tc('menu')}
            >
              <Menu aria-hidden className="size-5" />
            </summary>
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-border bg-bg p-2 shadow-lg">
              <ul className="md:hidden">
                {modules.map((m) => (
                  <li key={m.href}>
                    <Link href={m.href} className="block rounded-md px-3 py-2.5 text-sm hover:bg-surface-2">
                      {m.label}
                    </Link>
                  </li>
                ))}
                <li className="my-2 border-t border-border" aria-hidden />
              </ul>
              {user ? (
                <ul>
                  <li className="truncate px-3 py-2 text-xs text-muted">
                    {user.profile.first_name} {user.profile.last_name}
                  </li>
                  <MenuLink href="/dashboard" icon={<LayoutDashboard className="size-4" aria-hidden />} label={t('dashboard')} />
                  <MenuLink href="/profile" icon={<User className="size-4" aria-hidden />} label={t('profile')} />
                  {user.isAdmin && <MenuLink href="/admin" icon={<Shield className="size-4" aria-hidden />} label={t('admin')} />}
                  <li>
                    <form action={logout}>
                      <button type="submit" className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-error hover:bg-surface-2">
                        <LogOut aria-hidden className="size-4" />
                        {t('logout')}
                      </button>
                    </form>
                  </li>
                </ul>
              ) : (
                <ul>
                  <MenuLink href="/auth/login" label={t('login')} />
                  <MenuLink href="/auth/register" label={t('register')} />
                </ul>
              )}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

function MenuLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-surface-2">
        {icon}
        {label}
      </Link>
    </li>
  );
}
