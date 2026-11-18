import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Download, ShieldCheck } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { TextField } from '@/components/forms/fields';
import { PageHeader } from '@/components/page-header';
import { Pagination, pageRange } from '@/components/pagination';
import { StatusBadge } from '@/components/status-badge';
import { Collapsible } from '@/components/ui/collapsible';
import { LinkButton, TextLink } from '@/components/ui/links';
import { SearchForm } from '@/components/ui/search-form';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { normalizeCertificateNumber } from '@/lib/validation/academy';
import { num, type Certificate } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { revokeCertificate } from '../actions';

export const metadata: Metadata = { title: 'Attestations' };

const PAGE_SIZE = 30;

/** Attestations délivrées automatiquement (évaluation réussie ET tout payé). */
export default async function AdminCertificatesPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [t, locale, supabase] = await Promise.all([getTranslations('adminAcademy.certificates'), getLocale(), createClient()]);
  const l = locale as Locale;
  const q = normalizeCertificateNumber(sp.q);
  const { from, to, current } = pageRange(sp.page, PAGE_SIZE);

  let query = supabase.from('academy_certificates').select('*', { count: 'exact' }).order('issued_at', { ascending: false }).range(from, to);
  if (q) query = query.ilike('number', `%${q.replace(/[%_]/g, '')}%`);
  const { data, count } = await query;
  const rows = (data ?? []) as Certificate[];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <LinkButton href="/academy/verify" target="_blank" variant="outlined" startIcon={<ShieldCheck aria-hidden size={18} />}>
            {t('verifyPage')}
          </LinkButton>
        }
      />
      <SearchForm name="q" defaultValue={q} placeholder="CSC-2027-…" label={t('search')} />
      {rows.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('number'), t('student'), t('course'), t('score'), t('issued'), t('status'), t('actions')]}>
          {rows.map((c) => (
            <TableRow key={c.id} hover>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.number}</TableCell>
              <TableCell>{c.student_name}</TableCell>
              <TableCell>
                <TextLink href={`/admin/academy/sessions/${c.session_id}/evaluation`}>
                  {localized(l, c.course_title_fr, c.course_title_en)}
                </TextLink>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {localized(l, c.session_label_fr, c.session_label_en)}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{Math.round(num(c.score_percent))} %</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(c.issued_at, l)}</TableCell>
              <TableCell>
                {c.revoked_at ? (
                  <>
                    <StatusBadge tone="rejected">{t('revoked')}</StatusBadge>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                      {c.revoke_reason}
                    </Typography>
                  </>
                ) : (
                  <StatusBadge tone="validated">{t('valid')}</StatusBadge>
                )}
              </TableCell>
              <TableCell>
                {!c.revoked_at && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
                    <Button href={`/student/certificates/${c.id}`} size="small" variant="outlined" startIcon={<Download aria-hidden size={14} />}>
                      {t('download')}
                    </Button>
                    <Collapsible kind="button" summary={t('revoke')}>
                      <ActionForm
                        action={revokeCertificate}
                        confirm={t('revokeConfirm')}
                        confirmTitle={t('revoke')}
                        confirmLabel={t('revoke')}
                        danger
                        style={{ marginTop: 12, display: 'grid', gap: 12, minWidth: 240 }}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <TextField name="reason" label={t('reason')} required maxLength={500} size="small" />
                        <Button type="submit" variant="contained" color="error">
                          {t('revoke')}
                        </Button>
                      </ActionForm>
                    </Collapsible>
                  </Box>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
      <Pagination basePath="/admin/academy/certificates" current={current} total={count ?? 0} pageSize={PAGE_SIZE} params={{ q: q || undefined }} />
    </>
  );
}
