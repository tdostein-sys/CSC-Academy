import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { Archive, ArrowLeft, Eye, Plus, Rocket, Trash2, Undo2 } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { Notice } from '@/components/ui/notice';
import { LinkButton, TextLink } from '@/components/ui/links';
import { SectionCard } from '@/components/ui/section-card';
import { TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { courseTone } from '@/lib/academy/display';
import { COURSE_COLUMNS, UUID, num, type Course, type Session, type SessionOverview } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { deleteCourse, setCourseStatus, updateCourse } from '../../actions';
import { CourseForm } from '../course-form';

export const metadata: Metadata = { title: 'Formation' };

export default async function AdminCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; untranslated?: string }>;
}) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, ta, tt, locale, supabase] = await Promise.all([
    getTranslations('adminAcademy.course'),
    getTranslations('academy'),
    getTranslations('translation'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;

  const { data } = await supabase.from('academy_courses').select(COURSE_COLUMNS).eq('id', id).maybeSingle();
  if (!data) notFound();
  const c = data as Course;

  const [{ data: sessionsData }, { data: overviewData }] = await Promise.all([
    supabase.from('academy_sessions').select('id, label_fr, label_en, starts_on, ends_on, seats, enrollment_open').eq('course_id', id).order('starts_on', { ascending: false }),
    supabase.from('academy_session_overview').select('*').eq('course_id', id),
  ]);
  const sessions = (sessionsData ?? []) as Session[];
  const overview = new Map(((overviewData ?? []) as SessionOverview[]).map((o) => [o.session_id, o]));

  const statusButton = (status: Course['status'], label: string, icon: React.ReactNode, confirm?: string, variant: 'contained' | 'outlined' = 'outlined') => (
    <ActionForm action={setCourseStatus} confirm={confirm} confirmTitle={label} confirmLabel={label}>
      <input type="hidden" name="id" value={c.id} />
      <input type="hidden" name="status" value={status} />
      <Button type="submit" variant={variant} startIcon={icon}>
        {label}
      </Button>
    </ActionForm>
  );

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href="/admin/academy/courses" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 4 }}>
          {t('back')}
        </LinkButton>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, justifyContent: 'space-between', alignItems: { sm: 'flex-start' } }}>
          <Box>
            <StatusBadge tone={courseTone(c.status)}>{ta(`courseStatus.${c.status}`)}</StatusBadge>
            <Typography variant="h5" component="h1" sx={{ mt: 2, fontWeight: 700 }}>
              {localized(l, c.title_fr, c.title_en)}
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
              {ta(`level.${c.level}`)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {c.status === 'published' && (
              <LinkButton href={`/academy/${c.id}`} target="_blank" variant="outlined" startIcon={<Eye aria-hidden size={18} />}>
                {t('preview')}
              </LinkButton>
            )}
            {c.status === 'draft' && statusButton('published', t('publish'), <Rocket aria-hidden size={18} />, t('publishConfirm'), 'contained')}
            {c.status === 'published' && statusButton('archived', t('archive'), <Archive aria-hidden size={18} />, t('archiveConfirm'))}
            {c.status === 'published' && statusButton('draft', t('unpublish'), <Undo2 aria-hidden size={18} />, t('unpublishConfirm'))}
            {c.status === 'archived' && statusButton('published', t('restore'), <Rocket aria-hidden size={18} />)}
            {c.status === 'draft' && (
              <ActionForm action={deleteCourse} confirm={t('deleteConfirm')} confirmTitle={t('delete')} confirmLabel={t('delete')} danger>
                <input type="hidden" name="id" value={c.id} />
                <Button type="submit" variant="outlined" color="error" startIcon={<Trash2 aria-hidden size={18} />}>
                  {t('delete')}
                </Button>
              </ActionForm>
            )}
          </Box>
        </Box>
      </Box>

      {sp.created && <Notice tone="success">{t('created')}</Notice>}
      {sp.untranslated && <Notice tone="warning">{tt('untranslatedBanner')}</Notice>}
      {c.status === 'draft' && <Notice tone="info">{t('draftHint')}</Notice>}

      <Box>
        <TableCard
          title={t('sessions')}
          action={
            <LinkButton href={`/admin/academy/sessions/new?course=${c.id}`} variant="contained" size="small" startIcon={<Plus aria-hidden size={16} />}>
              {t('newSession')}
            </LinkButton>
          }
          head={[t('session'), t('dates'), t('price'), t('seats'), t('enrollment')]}
        >
          {sessions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} sx={{ color: 'text.secondary' }}>
                {t('noSessions')}
              </TableCell>
            </TableRow>
          ) : (
            sessions.map((s) => {
              const o = overview.get(s.id);
              return (
                <TableRow key={s.id} hover>
                  <TableCell>
                    <TextLink href={`/admin/academy/sessions/${s.id}`} sx={{ fontWeight: 500 }}>
                      {localized(l, s.label_fr, s.label_en)}
                    </TextLink>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {formatDate(s.starts_on, l)} → {formatDate(s.ends_on, l)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatXAF(num(o?.price), l)}</TableCell>
                  <TableCell>
                    {num(o?.taken)} / {s.seats}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={s.enrollment_open ? 'active' : 'neutral'}>{s.enrollment_open ? t('open') : t('closed')}</StatusBadge>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableCard>
      </Box>

      <SectionCard id="edit-title" title={t('edit')}>
        <CourseForm action={updateCourse} course={c} />
      </SectionCard>
    </Stack>
  );
}
