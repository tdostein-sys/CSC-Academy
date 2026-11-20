import { NextResponse, type NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { assertAdmin } from '@/lib/auth';
import { toCsv } from '@/lib/csv';
import { loadModule, loadMonthly, type DashboardModule } from '@/lib/dashboard/data';
import { parsePeriod } from '@/lib/dashboard/period';
import { SNAPSHOT_KEYS } from '@/lib/dashboard/metrics';

/**
 * Export CSV (Excel) des chiffres d'un onglet du tableau de bord, pour la
 * période choisie et la période précédente — administrateur uniquement.
 *   /admin/dashboard/export/<global|academy|consulting|ambassador|contact>?period=30d
 * Les classements (listes) ne sont pas exportés ; la vue globale ajoute
 * l'évolution des 12 derniers mois.
 */
const MODULES: DashboardModule[] = ['global', 'academy', 'consulting', 'ambassador', 'contact'];

interface Line {
  label: string;
  nature: string;
  current: number | string;
  previous: number | string;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ module: string }> }) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { module } = await params;
  if (!MODULES.includes(module as DashboardModule)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const sp = request.nextUrl.searchParams;
  const period = parsePeriod({ period: sp.get('period') ?? undefined, from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined });
  const t = await getTranslations('adminDashboard.csv');

  let csv: string;
  try {
    const { cur, prev } = await loadModule(module as DashboardModule, period);
    const label = (key: string) => (t.has(`${module}.${key}`) ? t(`${module}.${key}`) : key);
    const lines: Line[] = [];
    for (const [key, value] of Object.entries(cur)) {
      if (value !== null && typeof value === 'object') continue; // listes et détails
      const snapshot = SNAPSHOT_KEYS.has(key);
      lines.push({
        label: label(key),
        nature: snapshot ? t('natureToday') : t('naturePeriod'),
        current: value ?? '',
        previous: snapshot ? '' : (prev[key] ?? ''),
      });
    }
    if (module === 'contact') {
      const cs = (cur.by_subject ?? {}) as unknown as Record<string, number>;
      const ps = (prev.by_subject ?? {}) as unknown as Record<string, number>;
      for (const s of ['payment', 'course', 'technical', 'other']) {
        lines.push({ label: t(`contact.subject_${s}`), nature: t('naturePeriod'), current: cs[s] ?? 0, previous: ps[s] ?? 0 });
      }
    }
    // Indicateurs de la période d'abord, puis la « photo du jour ».
    lines.sort((a, b) => Number(a.previous === '' && a.nature === t('natureToday')) - Number(b.previous === '' && b.nature === t('natureToday')));
    csv = toCsv(lines, [
      { header: t('indicator'), value: (r) => r.label },
      { header: t('nature'), value: (r) => r.nature },
      { header: t('current', { from: period.from, to: period.to }), value: (r) => r.current },
      { header: t('previous', { from: period.prevFrom, to: period.prevTo }), value: (r) => r.previous },
    ]);

    if (module === 'global') {
      const monthly = await loadMonthly(12);
      csv += `\r\n${toCsv(monthly, [
        { header: t('month'), value: (m) => m.month.slice(0, 7) },
        { header: t('global.academy_cash'), value: (m) => m.academy_cash },
        { header: t('global.consulting_cash'), value: (m) => m.consulting_cash },
        { header: t('global.consulting_refunds'), value: (m) => m.consulting_refunds },
        { header: t('global.new_users'), value: (m) => m.new_users },
        { header: t('global.enrollments'), value: (m) => m.academy_enrollments },
        { header: t('monthlyConsultingDone'), value: (m) => m.consulting_done },
        { header: t('monthlySubmissions'), value: (m) => m.submissions_validated },
        { header: t('monthlyContact'), value: (m) => m.contact_requests },
      ]).replace(/^﻿/, '')}`;
    }
  } catch (e) {
    console.error('[dashboard export]', module, (e as Error).message);
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="csc-tableau-de-bord-${module}-${period.from}_${period.to}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
