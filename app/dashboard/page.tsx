import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Bell, GraduationCap, Megaphone, Shield, User } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'Mon espace' };

export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  const t = await getTranslations('dashboard');

  const roles: string[] = ['user'];
  if (user.ambassador) roles.push('ambassador');
  if (user.isAdmin) roles.push('admin');

  const cards = [
    { key: user.ambassador ? 'ambassadorSpaceCard' : 'ambassadorCard', href: '/ambassador', Icon: Megaphone },
    { key: 'academyCard', href: '/academy', Icon: GraduationCap },
    { key: 'notificationsCard', href: '/notifications', Icon: Bell },
    { key: 'profileCard', href: '/profile', Icon: User },
    ...(user.isAdmin ? [{ key: 'adminCard', href: '/admin', Icon: Shield }] : []),
  ];

  return (
    <div className="container-page py-8">
      <PageHeader
        title={t('hello', { name: user.profile.first_name || user.profile.username || '' })}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>{t('rolesLabel')} :</span>
            {roles.map((r) => (
              <span key={r} className={`badge ${r === 'admin' ? 'bg-accent text-accent-fg' : 'bg-primary-soft text-primary'}`}>
                {t(`roles.${r}`)}
              </span>
            ))}
          </span>
        }
      />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(({ key, href, Icon }) => (
          <li key={key}>
            <Link href={href} className="card flex h-full flex-col transition-colors hover:border-primary">
              <span className="flex items-center gap-3 font-semibold">
                <Icon aria-hidden className="size-5 text-primary" />
                {t(`${key}.title`)}
              </span>
              <span className="mt-2 flex-1 text-sm text-muted">
                {key === 'notificationsCard'
                  ? t(`${key}.desc`, { count: user.unreadNotifications })
                  : key === 'ambassadorSpaceCard'
                    ? t(`${key}.desc`, { code: user.ambassador?.code ?? '' })
                    : t(`${key}.desc`)}
              </span>
              <span className="mt-4 text-sm font-semibold text-primary">{t(`${key}.cta`)} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
