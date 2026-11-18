import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'CSC Consulting' };

export default async function ConsultingPage() {
  const [t, th] = await Promise.all([getTranslations('soon'), getTranslations('home')]);
  return <ComingSoon title={th('modules.consulting.title')} description={t('consultingDesc')} />;
}
