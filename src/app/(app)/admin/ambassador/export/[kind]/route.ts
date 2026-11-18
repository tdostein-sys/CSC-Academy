import { NextResponse, type NextRequest } from 'next/server';
import { getLocale, getTranslations } from 'next-intl/server';
import { assertAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { fetchAll } from '@/lib/supabase/fetch-all';
import { toCsv, type CsvColumn } from '@/lib/csv';
import { localized } from '@/lib/localized';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import type { Locale } from '@/lib/types';

/**
 * Exports CSV (Excel) du module Ambassador — administrateur uniquement.
 *   /admin/ambassador/export/submissions[?campaign=<id>]
 *   /admin/ambassador/export/balances[?campaign=<id>]
 *   /admin/ambassador/export/payouts[?campaign=<id>]
 *   /admin/ambassador/export/ambassadors
 * Les données sont lues avec la session de l'admin : la RLS s'applique.
 */
const KINDS = ['submissions', 'balances', 'payouts', 'ambassadors'] as const;
type Kind = (typeof KINDS)[number];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Person {
  code: string;
  profiles: { first_name: string; last_name: string; email: string; phone_whatsapp: string };
}
interface CampaignRef {
  title_fr: string;
  title_en: string;
}

const iso = (v: string | null | undefined) => (v ? new Date(v).toISOString().replace('T', ' ').slice(0, 19) : '');

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  try {
    await assertAdmin();
  } catch {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { kind } = await params;
  if (!KINDS.includes(kind as Kind)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const campaign = request.nextUrl.searchParams.get('campaign');
  if (campaign && !UUID.test(campaign)) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const [supabase, locale, t, ta] = await Promise.all([
    createClient(),
    getLocale(),
    getTranslations('adminAmbassador.csv'),
    getTranslations('ambassador'),
  ]);
  const l = locale as Locale;
  const personCols = <T extends { ambassadors: Person }>(): CsvColumn<T>[] => [
    { header: t('code'), value: (r) => r.ambassadors.code },
    { header: t('firstName'), value: (r) => r.ambassadors.profiles.first_name },
    { header: t('lastName'), value: (r) => r.ambassadors.profiles.last_name },
    { header: t('phone'), value: (r) => r.ambassadors.profiles.phone_whatsapp },
  ];
  const campaignCol = <T extends { campaigns: CampaignRef }>(): CsvColumn<T> => ({
    header: t('campaign'),
    value: (r) => localized(l, r.campaigns.title_fr, r.campaigns.title_en),
  });
  const PERSON = 'ambassadors (code, profiles (first_name, last_name, email, phone_whatsapp))';

  let csv: string;
  try {
    if (kind === 'submissions') {
      type Row = {
        binance_uid: string;
        trading_volume: number;
        status: string;
        amount: number;
        reject_reason: string | null;
        created_at: string;
        reviewed_at: string | null;
        ambassadors: Person;
        campaigns: CampaignRef;
      };
      const rows = await fetchAll<Row>((from, to) => {
        let q = supabase
          .from('submissions')
          .select(`binance_uid, trading_volume, status, amount, reject_reason, created_at, reviewed_at, ${PERSON}, campaigns (title_fr, title_en)`)
          .order('created_at')
          .order('id')
          .range(from, to);
        if (campaign) q = q.eq('campaign_id', campaign);
        return q as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
      });
      csv = toCsv(rows, [
        ...personCols<Row>(),
        campaignCol<Row>(),
        { header: t('binanceUid'), value: (r) => r.binance_uid },
        { header: t('volume'), value: (r) => r.trading_volume },
        { header: t('status'), value: (r) => ta(`status.${r.status}`) },
        { header: t('amount'), value: (r) => r.amount },
        { header: t('reason'), value: (r) => r.reject_reason },
        { header: t('submittedAt'), value: (r) => iso(r.created_at) },
        { header: t('reviewedAt'), value: (r) => iso(r.reviewed_at) },
      ]);
    } else if (kind === 'payouts') {
      type Row = {
        amount: number;
        method: string;
        reference: string;
        paid_at: string;
        confirmed_at: string | null;
        ambassadors: Person;
        campaigns: CampaignRef;
      };
      const rows = await fetchAll<Row>((from, to) => {
        let q = supabase
          .from('payouts')
          .select(`amount, method, reference, paid_at, confirmed_at, ${PERSON}, campaigns (title_fr, title_en)`)
          .order('paid_at')
          .order('id')
          .range(from, to);
        if (campaign) q = q.eq('campaign_id', campaign);
        return q as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>;
      });
      csv = toCsv(rows, [
        ...personCols<Row>(),
        campaignCol<Row>(),
        { header: t('amount'), value: (r) => r.amount },
        { header: t('method'), value: (r) => payoutMethodLabel(r.method, l) },
        { header: t('reference'), value: (r) => r.reference },
        { header: t('paidAt'), value: (r) => iso(r.paid_at) },
        { header: t('confirmedAt'), value: (r) => iso(r.confirmed_at) },
      ]);
    } else if (kind === 'balances') {
      type Bal = { campaign_id: string; ambassador_id: string; earned: number; paid: number; confirmed: number; due: number };
      const bals = await fetchAll<Bal>((from, to) => {
        let q = supabase.from('ambassador_campaign_balances').select('*').order('campaign_id').order('ambassador_id').range(from, to);
        if (campaign) q = q.eq('campaign_id', campaign);
        return q as unknown as PromiseLike<{ data: Bal[] | null; error: { message: string } | null }>;
      });
      // Les vues n'ont pas de relations : on joint en mémoire.
      const [people, campaigns] = await Promise.all([
        fetchAll<Person & { user_id: string }>((from, to) =>
          supabase
            .from('ambassadors')
            .select('user_id, code, profiles (first_name, last_name, email, phone_whatsapp)')
            .order('number')
            .range(from, to) as unknown as PromiseLike<{ data: (Person & { user_id: string })[] | null; error: { message: string } | null }>,
        ),
        fetchAll<CampaignRef & { id: string }>((from, to) =>
          supabase.from('campaigns').select('id, title_fr, title_en').order('created_at').range(from, to),
        ),
      ]);
      const byUser = new Map(people.map((p) => [p.user_id, p]));
      const byCampaign = new Map(campaigns.map((c) => [c.id, c]));
      type Row = Bal & { ambassadors: Person; campaigns: CampaignRef };
      const rows: Row[] = bals
        .filter((b) => byUser.has(b.ambassador_id) && byCampaign.has(b.campaign_id))
        .map((b) => ({ ...b, ambassadors: byUser.get(b.ambassador_id)!, campaigns: byCampaign.get(b.campaign_id)! }));
      csv = toCsv(rows, [
        ...personCols<Row>(),
        campaignCol<Row>(),
        { header: t('earned'), value: (r) => r.earned },
        { header: t('paid'), value: (r) => r.paid },
        { header: t('confirmed'), value: (r) => r.confirmed },
        { header: t('due'), value: (r) => r.due },
      ]);
    } else {
      type Row = Person & {
        user_id: string;
        status: string;
        charter_accepted_at: string;
      };
      type Bal = { ambassador_id: string; earned: number; paid: number; due: number };
      const [people, bals] = await Promise.all([
        fetchAll<Row>((from, to) =>
          supabase
            .from('ambassadors')
            .select('user_id, code, status, charter_accepted_at, profiles (first_name, last_name, email, phone_whatsapp)')
            .order('number')
            .range(from, to) as unknown as PromiseLike<{ data: Row[] | null; error: { message: string } | null }>,
        ),
        fetchAll<Bal>((from, to) => supabase.from('ambassador_balances').select('ambassador_id, earned, paid, due').order('ambassador_id').range(from, to)),
      ]);
      const balOf = new Map(bals.map((b) => [b.ambassador_id, b]));
      csv = toCsv(people, [
        { header: t('code'), value: (r) => r.code },
        { header: t('firstName'), value: (r) => r.profiles.first_name },
        { header: t('lastName'), value: (r) => r.profiles.last_name },
        { header: t('email'), value: (r) => r.profiles.email },
        { header: t('phone'), value: (r) => r.profiles.phone_whatsapp },
        { header: t('status'), value: (r) => ta(`ambassadorStatus.${r.status}`) },
        { header: t('joinedAt'), value: (r) => iso(r.charter_accepted_at) },
        { header: t('earned'), value: (r) => balOf.get(r.user_id)?.earned ?? 0 },
        { header: t('paid'), value: (r) => balOf.get(r.user_id)?.paid ?? 0 },
        { header: t('due'), value: (r) => balOf.get(r.user_id)?.due ?? 0 },
      ]);
    }
  } catch (e) {
    console.error('[export]', kind, (e as Error).message);
    return NextResponse.json({ error: 'export_failed' }, { status: 500 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="csc-ambassador-${kind}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
