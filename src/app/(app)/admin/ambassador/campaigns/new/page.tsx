import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { LinkButton } from '@/components/ui/links';
import { createCampaign } from '../../actions';
import { CampaignForm } from '../campaign-form';

export const metadata: Metadata = { title: 'Nouvelle campagne' };

export default async function NewCampaignPage() {
  await requireAdmin();
  const [t, td] = await Promise.all([getTranslations('adminAmbassador.form'), getTranslations('adminAmbassador.detail')]);
  return (
    <Box sx={{ maxWidth: 900 }}>
      <LinkButton href="/admin/ambassador/campaigns" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
        {td('back')}
      </LinkButton>
      <PageHeader title={t('createTitle')} subtitle={td('launchRequirements')} />
      <Card>
        <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
          <CampaignForm action={createCampaign} />
        </CardContent>
      </Card>
    </Box>
  );
}
