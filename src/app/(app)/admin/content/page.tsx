import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Card from '@mui/material/Card';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { ContentForm } from './content-form';

export const metadata: Metadata = { title: 'Contenus' };

export default async function AdminContentPage() {
  await requireAdmin();
  const [t, supabase] = await Promise.all([getTranslations('admin.content'), createClient()]);
  const { data } = await supabase.from('site_content').select('key, body_fr, body_en, source_locale').order('key');

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('help')} />
      <Stack spacing={6}>
        {(data ?? []).map((c) => (
          <Card component="section" key={c.key}>
            <CardHeader title={t.has(`keys.${c.key}`) ? t(`keys.${c.key}`) : c.key} titleTypographyProps={{ variant: 'h6', component: 'h2' }} />
            <CardContent>
              <ContentForm contentKey={c.key} bodyFr={c.body_fr} bodyEn={c.body_en} sourceLocale={c.source_locale === 'en' ? 'en' : 'fr'} />
            </CardContent>
          </Card>
        ))}
      </Stack>
    </>
  );
}
