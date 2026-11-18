import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { SearchForm } from '@/components/ui/search-form';
import { Notice } from '@/components/ui/notice';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { normalizeCertificateNumber } from '@/lib/validation/academy';
import { CERTIFICATE_NUMBER } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Vérifier une attestation' };

interface Verified {
  number: string;
  student_name: string;
  course_title_fr: string;
  course_title_en: string;
  session_label_fr: string;
  session_label_en: string;
  session_starts_on: string;
  session_ends_on: string;
  issued_at: string;
  revoked: boolean;
}

/**
 * Page publique (sans compte) : un employeur vérifie qu'une attestation est
 * authentique à partir de son numéro. N'affiche que ce qui figure déjà sur
 * l'attestation.
 */
export default async function VerifyCertificatePage({ searchParams }: { searchParams: Promise<{ n?: string }> }) {
  const [sp, t, locale] = await Promise.all([searchParams, getTranslations('verify'), getLocale()]);
  const l = locale as Locale;
  const number = normalizeCertificateNumber(sp.n);

  let result: Verified | null = null;
  let searched = false;
  if (number) {
    searched = true;
    if (CERTIFICATE_NUMBER.test(number)) {
      const supabase = await createClient();
      const { data } = await supabase.rpc('academy_verify_certificate', { p_number: number });
      result = ((data ?? []) as Verified[])[0] ?? null;
    }
  }

  return (
    <Box sx={{ maxWidth: 760 }}>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <SearchForm name="n" defaultValue={number} placeholder="CSC-2027-00001-AB12" label={t('label')} />

      {searched && !result && <Notice tone="error">{t('notFound')}</Notice>}

      {result && (
        <Card>
          <CardContent sx={{ p: { xs: 5, sm: 6 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4, color: result.revoked ? 'error.main' : 'success.main' }}>
              {result.revoked ? <ShieldAlert aria-hidden size={32} /> : <ShieldCheck aria-hidden size={32} />}
              <Typography variant="h6" component="p" sx={{ fontWeight: 700, color: 'inherit' }}>
                {result.revoked ? t('revoked') : t('valid')}
              </Typography>
            </Box>
            <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr' }, gap: { xs: 1, sm: 2 } }}>
              {[
                [t('number'), result.number],
                [t('name'), result.student_name],
                [t('course'), localized(l, result.course_title_fr, result.course_title_en)],
                [t('session'), `${localized(l, result.session_label_fr, result.session_label_en)} · ${formatDate(result.session_starts_on, l)} – ${formatDate(result.session_ends_on, l)}`],
                [t('issued'), formatDate(result.issued_at, l)],
              ].map(([k, v]) => (
                <Box key={k} sx={{ display: 'contents' }}>
                  <Typography component="dt" variant="body2" sx={{ color: 'text.secondary', mt: { xs: 2, sm: 0 } }}>
                    {k}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {v}
                  </Typography>
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
