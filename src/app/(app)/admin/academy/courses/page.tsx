import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { Plus } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { LinkButton, TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { courseTone } from '@/lib/academy/display';
import type { Course } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Formations' };

export default async function AdminCoursesPage() {
  await requireAdmin();
  const [t, ta, locale, supabase] = await Promise.all([getTranslations('adminAcademy.courses'), getTranslations('academy'), getLocale(), createClient()]);
  const l = locale as Locale;

  const [{ data }, { data: sessions }] = await Promise.all([
    supabase.from('academy_courses').select('id, title_fr, title_en, level, status, created_at').order('created_at', { ascending: false }),
    supabase.from('academy_sessions').select('course_id, enrollment_open'),
  ]);
  const courses = (data ?? []) as Course[];
  const counts = new Map<string, { total: number; open: number }>();
  for (const s of sessions ?? []) {
    const c = counts.get(s.course_id as string) ?? { total: 0, open: 0 };
    c.total += 1;
    if (s.enrollment_open) c.open += 1;
    counts.set(s.course_id as string, c);
  }

  return (
    <>
      <PageHeader
        title={t('title')}
        actions={
          <LinkButton href="/admin/academy/courses/new" variant="contained" startIcon={<Plus aria-hidden size={18} />}>
            {t('new')}
          </LinkButton>
        }
      />
      {courses.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('course'), t('status'), t('level'), t('sessions'), t('created')]}>
          {courses.map((c) => {
            const n = counts.get(c.id) ?? { total: 0, open: 0 };
            return (
              <TableRow key={c.id} hover>
                <TableCell>
                  <TextLink href={`/admin/academy/courses/${c.id}`} sx={{ fontWeight: 500 }}>
                    {localized(l, c.title_fr, c.title_en)}
                  </TextLink>
                </TableCell>
                <TableCell>
                  <StatusBadge tone={courseTone(c.status)}>{ta(`courseStatus.${c.status}`)}</StatusBadge>
                </TableCell>
                <TableCell>{ta(`level.${c.level}`)}</TableCell>
                <TableCell>{t('sessionsCount', { total: n.total, open: n.open })}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.created_at, l)}</TableCell>
              </TableRow>
            );
          })}
        </TableCard>
      )}
    </>
  );
}
