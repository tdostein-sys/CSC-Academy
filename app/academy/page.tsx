import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export const metadata: Metadata = { title: 'CSC Academy' };

/** Catalogue public — contenu complet livré à l'étape 3 (CSC Academy). */
export default async function AcademyPage() {
  const t = await getTranslations('academy');
  return (
    <div className="container-page py-8">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="card flex flex-col items-center gap-2 py-12 text-center text-muted">
        <GraduationCap aria-hidden className="size-10" />
        {t('empty')}
      </div>
    </div>
  );
}
