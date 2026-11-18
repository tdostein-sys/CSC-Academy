import { NextResponse } from 'next/server';
import { getLocale, getTranslations } from 'next-intl/server';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { toCsv } from '@/lib/csv';
import { localized } from '@/lib/localized';
import type { Commission } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';

/**
 * Export CSV (Excel) des commissions CSC Academy — administrateur uniquement.
 * Lecture avec la session de l'admin : la base applique ses droits.
 */
export async function GET() {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const [supabase, locale, t] = await Promise.all([createClient(), getLocale(), getTranslations('adminAcademy.commissions')]);
  const l = locale as Locale;

  let csv: string;
  try {
    const rows = await fetchAll<Commission>((from, to) =>
      supabase.from('academy_commissions').select('*').gt('amount', 0).order('enrolled_at').order('enrollment_id').range(from, to),
    );
    csv = toCsv(rows, [
      { header: t('ambassador'), value: (r) => r.ambassador_code },
      { header: t('student'), value: (r) => r.student_label },
      { header: t('course'), value: (r) => localized(l, r.course_title_fr, r.course_title_en) },
      { header: t('session'), value: (r) => localized(l, r.session_label_fr, r.session_label_en) },
      { header: t('price'), value: (r) => r.price },
      { header: t('studentPaid'), value: (r) => r.student_paid },
      { header: t('rateCol'), value: (r) => r.commission_rate },
      { header: t('commission'), value: (r) => r.amount },
      { header: t('earnedCol'), value: (r) => r.earned },
      { header: t('paidCol'), value: (r) => r.paid },
      { header: t('confirmedCol'), value: (r) => r.confirmed },
      { header: t('dueCol'), value: (r) => r.due },
    ]);
  } catch (e) {
    console.error('[export] commissions', (e as Error).message);
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="csc-academy-commissions-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
