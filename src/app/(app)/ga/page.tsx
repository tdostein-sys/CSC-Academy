import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'CSC Gestion d’actifs' };

export default async function GaPage() {
  const [t, th] = await Promise.all([getTranslations('soon'), getTranslations('home')]);
  return <ComingSoon title={th('modules.ga.title')} description={t('gaDesc')} />;
}
