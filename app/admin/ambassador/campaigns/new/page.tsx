import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createCampaign } from '../../actions';
import { CampaignForm } from '../campaign-form';

export const metadata: Metadata = { title: 'Nouvelle campagne' };

export default async function NewCampaignPage() {
  await requireAdmin();
  const [t, td] = await Promise.all([getTranslations('adminAmbassador.form'), getTranslations('adminAmbassador.detail')]);
  return (
    <>
      <Link href="/admin/ambassador/campaigns" className="link mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft aria-hidden className="size-4" />
        {td('back')}
      </Link>
      <h1 className="mb-2 text-2xl font-bold">{t('createTitle')}</h1>
      <p className="mb-6 text-sm text-muted">{td('launchRequirements')}</p>
      <div className="card">
        <CampaignForm action={createCampaign} />
      </div>
    </>
  );
}
