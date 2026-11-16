import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Hourglass } from 'lucide-react';

export async function ComingSoon({ title, description }: { title: string; description: string }) {
  const t = await getTranslations('soon');
  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-xl text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-soft text-text">
          <Hourglass aria-hidden className="size-7" />
        </span>
        <p className="mt-4 text-sm font-semibold tracking-wide text-primary uppercase">{t('title')}</p>
        <h1 className="mt-1 text-2xl font-bold">{title}</h1>
        <p className="mt-3 text-muted">{description}</p>
        <p className="mt-2 text-sm text-muted">{t('notify')}</p>
        <Link href="/" className="btn-outline mt-6">
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
