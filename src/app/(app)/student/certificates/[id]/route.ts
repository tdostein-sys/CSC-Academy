import { NextResponse, type NextRequest } from 'next/server';
import { getLocale, getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { formatDate } from '@/lib/format';
import { localized } from '@/lib/localized';
import { certificatePdf } from '@/lib/academy/certificate-pdf';
import { UUID, num, type Certificate } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

/**
 * Téléchargement de l'attestation (PDF). Lecture avec la session de
 * l'utilisateur : la RLS ne renvoie que SES attestations (ou toutes pour
 * l'admin). Une attestation retirée n'est plus téléchargeable.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });

  const supabase = await createClient();
  const { data } = await supabase.from('academy_certificates').select('*').eq('id', id).maybeSingle();
  const c = data as Certificate | null;
  if (!c || c.revoked_at) return new NextResponse(null, { status: 404 });

  const [locale, t] = await Promise.all([getLocale(), getTranslations('certificate')]);
  const l = locale as Locale;
  const verifyUrl = `${publicEnv.siteUrl}/academy/verify?n=${encodeURIComponent(c.number)}`;
  const pdf = certificatePdf({
    org: 'CSC Academy',
    heading: t('heading'),
    awardedTo: t('awardedTo'),
    name: c.student_name,
    completed: t('completed'),
    course: localized(l, c.course_title_fr, c.course_title_en),
    session: t('session', {
      label: localized(l, c.session_label_fr, c.session_label_en),
      start: formatDate(c.session_starts_on, l),
      end: formatDate(c.session_ends_on, l),
    }),
    score: t('score', { percent: Math.round(num(c.score_percent)) }),
    numberLabel: t('numberLabel'),
    number: c.number,
    issuedLabel: t('issuedLabel'),
    issued: formatDate(c.issued_at, l),
    verifyLabel: t('verifyLabel'),
    verifyUrl,
  });

  return new NextResponse(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="attestation-${c.number}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
