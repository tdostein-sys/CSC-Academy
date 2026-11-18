import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { LinkButton } from '@/components/ui/links';
import { localized } from '@/lib/localized';
import { UUID } from '@/lib/academy/types';
import { createSession } from '../../actions';
import { SessionForm } from '../session-form';

export const metadata: Metadata = { title: 'Nouvelle session' };

export default async function NewSessionPage({ searchParams }: { searchParams: Promise<{ course?: string }> }) {
  await requireAdmin();
  const { course } = await searchParams;
  if (!course || !UUID.test(course)) notFound();
  const [t, locale, supabase] = await Promise.all([getTranslations('adminAcademy.sessionForm'), getLocale(), createClient()]);
  const { data: c } = await supabase.from('academy_courses').select('id, title_fr, title_en').eq('id', course).maybeSingle();
  if (!c) notFound();

  return (
    <Box sx={{ maxWidth: 900 }}>
      <LinkButton href={`/admin/academy/courses/${c.id}`} size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
        {localized(locale, c.title_fr, c.title_en)}
      </LinkButton>
      <PageHeader title={t('createTitle')} subtitle={t('createHint')} />
      <Card>
        <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
          <SessionForm action={createSession} courseId={c.id} />
        </CardContent>
      </Card>
    </Box>
  );
}
