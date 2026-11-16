import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Briefcase, GraduationCap, Megaphone } from 'lucide-react';
import { getSessionUser } from '@/lib/auth';

export default async function HomePage() {
  const [t, user] = await Promise.all([getTranslations('home'), getSessionUser()]);

  const modules = [
    { key: 'ambassador', href: '/ambassador', Icon: Megaphone, soon: false },
    { key: 'academy', href: '/academy', Icon: GraduationCap, soon: false },
    { key: 'consulting', href: '/consulting', Icon: BarChart3, soon: true },
    { key: 'ga', href: '/ga', Icon: Briefcase, soon: true },
  ] as const;

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-primary-soft to-bg">
        <div className="container-page py-12 sm:py-20">
          <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight sm:text-5xl">{t('heroTitle')}</h1>
          <div className="mt-3 h-1.5 w-20 rounded-full bg-accent" aria-hidden />
          <p className="mt-5 max-w-xl text-base text-muted sm:text-lg">{t('heroSubtitle')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            {user ? (
              <Link href="/dashboard" className="btn-primary">
                {t('ctaDashboard')}
              </Link>
            ) : (
              <Link href="/auth/register" className="btn-primary">
                {t('ctaRegister')}
              </Link>
            )}
            <Link href="/academy" className="btn-outline">
              {t('ctaCourses')}
            </Link>
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <h2 className="text-2xl font-bold">{t('modulesTitle')}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {modules.map(({ key, href, Icon, soon }) => (
            <li key={key}>
              <Link href={href} className="card group flex h-full gap-4 transition-colors hover:border-primary">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                  <Icon aria-hidden className="size-6" />
                </span>
                <span className="flex flex-col">
                  <span className="flex items-center gap-2 font-semibold">
                    {t(`modules.${key}.title`)}
                    {soon && <span className="badge bg-accent-soft text-text">{t('soonBadge')}</span>}
                  </span>
                  <span className="mt-1 text-sm text-muted">{t(`modules.${key}.desc`)}</span>
                  <span className="mt-3 text-sm font-semibold text-primary group-hover:underline">{t('discover')} →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
