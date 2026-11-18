import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { LinkButton } from '@/components/ui/links';
import { createCourse } from '../../actions';
import { CourseForm } from '../course-form';

export const metadata: Metadata = { title: 'Nouvelle formation' };

export default async function NewCoursePage() {
  await requireAdmin();
  const [t, tc] = await Promise.all([getTranslations('adminAcademy.courseForm'), getTranslations('adminAcademy.course')]);
  return (
    <Box sx={{ maxWidth: 900 }}>
      <LinkButton href="/admin/academy/courses" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
        {tc('back')}
      </LinkButton>
      <PageHeader title={t('createTitle')} subtitle={t('createHint')} />
      <Card>
        <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
          <CourseForm action={createCourse} />
        </CardContent>
      </Card>
    </Box>
  );
}
