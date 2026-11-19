import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { Notice } from '@/components/ui/notice';
import { SETTINGS_COLUMNS, type Settings } from '@/lib/consulting/types';
import { SettingsForm } from './settings-form';
import { saveSettings } from '../actions';

export const metadata: Metadata = { title: 'Réglages — CSC Consulting' };
export const dynamic = 'force-dynamic';

export default async function ConsultingSettingsPage() {
  await requireAdmin();
  const [t, supabase] = await Promise.all([getTranslations('adminConsulting.settings'), createClient()]);
  const { data } = await supabase.from('consulting_settings').select(SETTINGS_COLUMNS).maybeSingle();
  const settings = data as Settings | null;
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      {!settings ? (
        <Notice tone="warning">{t('missing')}</Notice>
      ) : (
        <Card>
          <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
            <SettingsForm action={saveSettings} settings={settings} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
