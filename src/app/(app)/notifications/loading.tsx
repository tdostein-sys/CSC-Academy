import { getTranslations } from 'next-intl/server';
import { PageSkeleton } from '@/components/ui/page-skeleton';

/** Affiché immédiatement au clic, pendant que le serveur prépare la page. */
export default async function Loading() {
  const t = await getTranslations('shell');
  return <PageSkeleton variant="feed" label={t('loadingPage')} />;
}
