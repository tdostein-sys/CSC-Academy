import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Download } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ActionForm } from '@/components/forms/action-form';
import { SelectField, TextField } from '@/components/forms/fields';
import { PageHeader } from '@/components/page-header';
import { StatCard } from '@/components/stat-card';
import { StatusBadge } from '@/components/status-badge';
import { Collapsible } from '@/components/ui/collapsible';
import { FilterPills } from '@/components/ui/filter-pills';
import { TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatDate, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { payoutMethodLabel, payoutMethodOptions } from '@/lib/ambassador/methods';
import { num, type Commission, type CommissionPayout } from '@/lib/academy/types';
import type { Locale } from '@/lib/types';
import { recordCommissionPayout } from '../actions';

export const metadata: Metadata = { title: 'Commissions' };

const FILTERS = ['due', 'waiting', 'all'] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Commissions des ambassadeurs sur les inscriptions parrainées. Due une fois
 * la formation entièrement payée ; payée par l'admin (« Payer »), puis
 * confirmée par l'ambassadeur dans son espace.
 */
export default async function AdminCommissionsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const filter: Filter = (FILTERS as readonly string[]).includes(sp.filter ?? '') ? (sp.filter as Filter) : 'due';
  const [t, tp, locale, supabase] = await Promise.all([
    getTranslations('adminAcademy.commissions'),
    getTranslations('adminAmbassador.payout'),
    getLocale(),
    createClient(),
  ]);
  const l = locale as Locale;

  const [allRes, payoutsRes] = await Promise.all([
    supabase.from('academy_commissions').select('*').gt('amount', 0).order('enrolled_at', { ascending: false }).limit(1000),
    supabase
      .from('academy_commission_payouts')
      .select('id, enrollment_id, ambassador_id, amount, method, reference, paid_at, confirmed_at')
      .order('paid_at', { ascending: false })
      .limit(30),
  ]);
  const all = (allRes.data ?? []) as Commission[];
  const payouts = (payoutsRes.data ?? []) as CommissionPayout[];
  const byEnrollment = new Map(all.map((c) => [c.enrollment_id, c]));
  const rows = all.filter((c) => (filter === 'due' ? num(c.due) > 0 : filter === 'waiting' ? !c.fully_paid : true));
  const total = (k: 'earned' | 'paid' | 'due') => all.reduce((a, c) => a + num(c[k]), 0);
  const waiting = all.filter((c) => !c.fully_paid).reduce((a, c) => a + num(c.amount), 0);

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button href="/admin/academy/export/commissions" download variant="outlined" startIcon={<Download aria-hidden size={18} />}>
            {t('export')}
          </Button>
        }
      />
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid item xs={6} md={3}>
          <StatCard label={t('waitingTotal')} value={formatXAF(waiting, l)} icon="Hourglass" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={t('earnedTotal')} value={formatXAF(total('earned'), l)} icon="Coins" tone="info" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={t('paidTotal')} value={formatXAF(total('paid'), l)} icon="CheckCircle2" tone="success" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label={t('dueTotal')} value={formatXAF(total('due'), l)} icon="Wallet" tone="warning" highlight={total('due') > 0} />
        </Grid>
      </Grid>

      <Box sx={{ mb: 4 }}>
        <FilterPills
          label={t('title')}
          items={FILTERS.map((f) => ({
            key: f,
            href: f === 'due' ? '/admin/academy/commissions' : `/admin/academy/commissions?filter=${f}`,
            label: t(`filter.${f}`),
            active: f === filter,
          }))}
        />
      </Box>

      {rows.length === 0 ? (
        <EmptyCard>{t('empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('ambassador'), t('student'), t('course'), t('progress'), t('commission'), t('dueCol'), t('actions')]}>
          {rows.map((c) => (
            <TableRow key={c.enrollment_id} hover>
              <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, whiteSpace: 'nowrap' }}>{c.ambassador_code}</TableCell>
              <TableCell>{c.student_label}</TableCell>
              <TableCell>
                <TextLink href={`/admin/academy/sessions/${c.session_id}`}>
                  {localized(l, c.course_title_fr, c.course_title_en)} — {localized(l, c.session_label_fr, c.session_label_en)}
                </TextLink>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatXAF(c.student_paid, l)} / {formatXAF(c.price, l)}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatXAF(c.amount, l)}
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary' }}>
                  {t('rate', { rate: num(c.commission_rate) })}
                </Typography>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {!c.fully_paid ? (
                  <StatusBadge tone="pending">{t('waiting')}</StatusBadge>
                ) : num(c.due) > 0 ? (
                  <strong>{formatXAF(c.due, l)}</strong>
                ) : (
                  <StatusBadge tone="validated">{t('settled')}</StatusBadge>
                )}
              </TableCell>
              <TableCell>
                {num(c.due) > 0 && (
                  <Collapsible kind="button" summary={tp('record')}>
                    <ActionForm action={recordCommissionPayout} style={{ marginTop: 12, display: 'grid', gap: 12, minWidth: 240 }}>
                      <input type="hidden" name="enrollment_id" value={c.enrollment_id} />
                      <TextField name="amount" label={tp('amount')} inputMode="numeric" defaultValue={String(num(c.due))} required size="small" />
                      <SelectField name="method" label={tp('method')} required size="small" defaultValue="" options={[{ value: '', label: '—' }, ...payoutMethodOptions(locale)]} />
                      <TextField name="reference" label={tp('reference')} maxLength={120} size="small" optionalLabel />
                      <Button type="submit" variant="contained">
                        {tp('record')}
                      </Button>
                    </ActionForm>
                  </Collapsible>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}

      {payouts.length > 0 && (
        <Box sx={{ mt: 8 }}>
          <TableCard title={t('history')} head={[tp('paidAt'), t('status'), t('ambassador'), t('course'), tp('amount'), tp('method'), tp('reference')]}>
            {payouts.map((p) => {
              const c = byEnrollment.get(p.enrollment_id);
              return (
                <TableRow key={p.id}>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(p.paid_at, l, true)}</TableCell>
                  <TableCell>
                    {p.confirmed_at ? (
                      <StatusBadge tone="validated">
                        {tp('confirmed')} · {formatDate(p.confirmed_at, l)}
                      </StatusBadge>
                    ) : (
                      <StatusBadge tone="pending">{tp('notConfirmed')}</StatusBadge>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{c?.ambassador_code ?? '—'}</TableCell>
                  <TableCell>{c ? localized(l, c.course_title_fr, c.course_title_en) : '—'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatXAF(p.amount, l)}</TableCell>
                  <TableCell>{payoutMethodLabel(p.method, l)}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{p.reference || '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableCard>
        </Box>
      )}
    </>
  );
}
