import { getTranslations } from 'next-intl/server';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="container-page flex flex-col gap-1 py-6 text-sm text-muted sm:flex-row sm:justify-between">
        <p>{t('tagline')} · {t('location')}</p>
        <p>{t('rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
