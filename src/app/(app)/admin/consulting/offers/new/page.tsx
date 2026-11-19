import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { OfferForm } from '../offer-form';
import { createOffer } from '../../actions';

export const metadata: Metadata = { title: 'Nouvelle offre de conseil' };

export default async function NewOfferPage() {
  await requireAdmin();
  const t = await getTranslations('adminConsulting');
  return (
    <>
      <PageHeader title={t('offers.new')} subtitle={t('offerForm.intro')} />
      <Card>
        <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
          <OfferForm action={createOffer} />
        </CardContent>
      </Card>
    </>
  );
}
