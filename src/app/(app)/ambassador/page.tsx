import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import { BadgeCheck, ChevronRight, GraduationCap, Megaphone, Settings } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Markdown } from '@/components/markdown';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { StatCard } from '@/components/stat-card';
import { Notice } from '@/components/ui/notice';
import { LinkButton, LinkCardArea } from '@/components/ui/links';
import { ListCard, SectionCard, SectionTitle } from '@/components/ui/section-card';
import { Collapsible } from '@/components/ui/collapsible';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { num, type Ambassador, type Campaign, type CampaignBalance, type Payout } from '@/lib/ambassador/types';
import type { Commission, CommissionPayout } from '@/lib/academy/types';
import { publicEnv } from '@/lib/env';
import type { Locale } from '@/lib/types';
import { confirmCommissionPayout, confirmPayout, joinAmbassador } from './actions';

export const metadata: Metadata = { title: 'CSC Ambassador' };

export default async function AmbassadorPage() {
  const user = await requireUser('/ambassador');
  const [locale, supabase, t] = await Promise.all([getLocale(), createClient(), getTranslations('ambassador')]);
  const { data: charter } = await supabase.from('site_content').select('body_fr, body_en').eq('key', 'ambassador_charter').single();
  const charterBody = localized(locale, charter?.body_fr, charter?.body_en);

  // Raccourci réservé aux administrateurs (la gestion se fait dans /admin).
  const adminShortcut = user.isAdmin ? (
    <Box>
      <LinkButton href="/admin/ambassador/campaigns" variant="contained" color="warning" startIcon={<Settings aria-hidden size={18} />}>
        {t('adminShortcut')}
      </LinkButton>
    </Box>
  ) : null;

  // ---------------------------------------------------------------------------
  // Pas encore ambassadeur : charte + bouton « D'accord »
  // ---------------------------------------------------------------------------
  if (!user.ambassador) {
    const p = user.profile;
    const profileComplete = Boolean(p.first_name.trim() && p.last_name.trim() && p.phone_whatsapp.trim());
    return (
      <Stack spacing={4} sx={{ maxWidth: 860 }}>
        {adminShortcut}
        <Card>
          <CardContent sx={{ p: { xs: 5, sm: 8 } }}>
            <Avatar variant="rounded" sx={{ mb: 4, width: 52, height: 52, bgcolor: 'primary.light', color: 'primary.main' }}>
              <Megaphone aria-hidden size={28} />
            </Avatar>
            <Markdown source={charterBody} />
            <Box sx={{ mt: 6, pt: 6, borderTop: 1, borderColor: 'divider' }}>
              {profileComplete ? (
                <ActionForm action={joinAmbassador}>
                  <Button type="submit" variant="contained" size="large" startIcon={<BadgeCheck aria-hidden size={20} />}>
                    {t('join')}
                  </Button>
                  <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                    {t('joinHint')}
                  </Typography>
                </ActionForm>
              ) : (
                <Notice
                  tone="warning"
                  action={
                    <LinkButton href="/profile" variant="outlined" color="inherit" size="small">
                      {t('completeProfile')}
                    </LinkButton>
                  }
                >
                  {t('profileIncomplete')}
                </Notice>
              )}
            </Box>
          </CardContent>
        </Card>
      </Stack>
    );
  }

  // ---------------------------------------------------------------------------
  // Espace ambassadeur
  // ---------------------------------------------------------------------------
  const [ambRes, balanceRes, campaignsRes, participationsRes, toConfirmRes, perCampaignRes, commissionsRes, commissionToConfirmRes] = await Promise.all([
    supabase.from('ambassadors').select('*').eq('user_id', user.id).single(),
    supabase.from('ambassador_balances').select('*').eq('ambassador_id', user.id).maybeSingle(),
    supabase
      .from('campaigns')
      .select('id, title_fr, title_en, summary_fr, summary_en, amount_per_account, min_volume, ends_on, status, closed_at')
      .in('status', ['launched', 'closed'])
      .order('launched_at', { ascending: false })
      .limit(30),
    supabase.from('campaign_participations').select('campaign_id, participates').eq('ambassador_id', user.id),
    supabase
      .from('payouts')
      .select('id, campaign_id, amount, method, reference, paid_at, confirmed_at')
      .eq('ambassador_id', user.id)
      .is('confirmed_at', null)
      .order('paid_at'),
    supabase.from('ambassador_campaign_balances').select('*').eq('ambassador_id', user.id),
    // CSC Academy : inscriptions parrainées et commissions (la vue ne renvoie que les miennes).
    supabase.from('academy_commissions').select('*').eq('ambassador_id', user.id).order('enrolled_at', { ascending: false }),
    supabase
      .from('academy_commission_payouts')
      .select('id, enrollment_id, ambassador_id, amount, method, reference, paid_at, confirmed_at')
      .eq('ambassador_id', user.id)
      .is('confirmed_at', null)
      .order('paid_at'),
  ]);

  const amb = ambRes.data as Ambassador;
  const bal = balanceRes.data as CampaignBalance | null;
  const campaigns = (campaignsRes.data ?? []) as Campaign[];
  const l = locale as Locale;
  const titleOf = new Map(campaigns.map((c) => [c.id, localized(l, c.title_fr, c.title_en)]));
  const choice = new Map((participationsRes.data ?? []).map((p) => [p.campaign_id as string, p.participates as boolean]));
  const toConfirm = (toConfirmRes.data ?? []) as Payout[];
  const perCampaign = new Map(((perCampaignRes.data ?? []) as CampaignBalance[]).map((b) => [b.campaign_id, b]));
  const open = campaigns.filter((c) => c.status === 'launched');
  const closed = campaigns.filter((c) => c.status === 'closed');
  const commissions = (commissionsRes.data ?? []) as Commission[];
  const commissionToConfirm = (commissionToConfirmRes.data ?? []) as CommissionPayout[];
  const commissionOf = new Map(commissions.map((c) => [c.enrollment_id, c]));
  const sum = (k: 'earned' | 'paid' | 'due') => commissions.reduce((a, c) => a + num(c[k]), 0);
  // Les commissions Academy s'ajoutent aux gains des campagnes.
  const earned = num(bal?.earned) + sum('earned');
  const paidTotal = num(bal?.paid) + sum('paid');
  const due = num(bal?.due) + sum('due');
  const shareLink = `${publicEnv.siteUrl}/academy?ref=${amb.code}`;

  return (
    <Stack spacing={6} sx={{ maxWidth: 1000 }}>
      {adminShortcut}

      {/* Badge */}
      <Card component="section" aria-label={t('badge')}>
        <CardContent sx={{ p: { xs: 5, sm: 6 }, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, gap: 4 }}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: 'warning.light', color: 'warning.main' }}>
            <BadgeCheck aria-hidden size={36} />
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" component="p" sx={{ color: 'primary.main', lineHeight: 1.5 }}>
              {t('badge')}
            </Typography>
            <Typography variant="h4" component="p" sx={{ fontWeight: 700, letterSpacing: '1px' }}>
              {amb.code}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {user.profile.first_name} {user.profile.last_name} · {t('memberSince', { date: formatDate(amb.charter_accepted_at, l) })}
            </Typography>
          </Box>
          <StatusBadge tone={amb.status} size="medium">
            {t(`ambassadorStatus.${amb.status}`)}
          </StatusBadge>
        </CardContent>
      </Card>

      {amb.status === 'suspended' && <Notice tone="error">{t('suspendedBanner', { reason: amb.status_reason ?? '—' })}</Notice>}

      {/* Gains */}
      <Box component="section" aria-labelledby="balance-title">
        <SectionTitle id="balance-title">{t('balance.title')}</SectionTitle>
        <Grid container spacing={4} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          <Grid item xs={12} sm={4} component="li">
            <StatCard
              label={t('balance.earned')}
              value={formatXAF(earned, l)}
              icon="Coins"
              tone="primary"
              footer={
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {t('balance.validated', { count: num(bal?.validated_count) })}
                </Typography>
              }
            />
          </Grid>
          <Grid item xs={12} sm={4} component="li">
            <StatCard label={t('balance.paid')} value={formatXAF(paidTotal, l)} icon="CheckCircle2" tone="success" />
          </Grid>
          <Grid item xs={12} sm={4} component="li">
            <StatCard label={t('balance.due')} value={formatXAF(due, l)} icon="Hourglass" tone={due > 0 ? 'info' : 'primary'} />
          </Grid>
        </Grid>
      </Box>

      {/* Paiements à confirmer */}
      {toConfirm.length + commissionToConfirm.length > 0 && (
        <SectionCard id="confirm-title" title={t('toConfirm.title')} subtitle={t('toConfirm.desc')} highlight>
          <Stack spacing={3} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {toConfirm.map((p) => (
              <Box
                component="li"
                key={p.id}
                sx={{ p: 3, borderRadius: 1, bgcolor: 'background.default', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{formatXAF(p.amount, l)}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {titleOf.get(p.campaign_id) ?? '—'} · {payoutMethodLabel(p.method, l)}
                    {p.reference ? ` · ${t('payouts.reference')} ${p.reference}` : ''} · {formatDate(p.paid_at, l)}
                  </Typography>
                </Box>
                <ActionForm action={confirmPayout}>
                  <input type="hidden" name="id" value={p.id} />
                  <Button type="submit" variant="contained">
                    {t('payouts.confirm')}
                  </Button>
                </ActionForm>
              </Box>
            ))}
            {commissionToConfirm.map((p) => {
              const c = commissionOf.get(p.enrollment_id);
              return (
                <Box
                  component="li"
                  key={p.id}
                  sx={{ p: 3, borderRadius: 1, bgcolor: 'background.default', display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{formatXAF(p.amount, l)}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {t('academy.commissionFor', { course: c ? localized(l, c.course_title_fr, c.course_title_en) : '—' })} · {payoutMethodLabel(p.method, l)}
                      {p.reference ? ` · ${t('payouts.reference')} ${p.reference}` : ''} · {formatDate(p.paid_at, l)}
                    </Typography>
                  </Box>
                  <ActionForm action={confirmCommissionPayout}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="contained">
                      {t('payouts.confirm')}
                    </Button>
                  </ActionForm>
                </Box>
              );
            })}
          </Stack>
        </SectionCard>
      )}

      {/* Parrainages CSC Academy */}
      <SectionCard id="academy-title" title={t('academy.title')} subtitle={t('academy.desc')}>
        <Stack spacing={4}>
          <Box sx={{ p: 3, borderRadius: 1, bgcolor: 'background.default', display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
            <GraduationCap aria-hidden size={22} style={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {t('academy.shareLink')}
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, overflowWrap: 'anywhere' }}>{shareLink}</Typography>
            </Box>
          </Box>
          {commissions.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {t('academy.empty')}
            </Typography>
          ) : (
            <Stack spacing={3} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {commissions.map((c) => {
                const progress = num(c.price) > 0 ? Math.min(100, (num(c.student_paid) / num(c.price)) * 100) : 0;
                const state = !c.fully_paid ? 'waiting' : num(c.due) > 0 ? 'due' : 'paid';
                return (
                  <Box component="li" key={c.enrollment_id} sx={{ p: 3, borderRadius: 1, border: 1, borderColor: 'divider' }}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 2 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }}>{c.student_label}</Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {localized(l, c.course_title_fr, c.course_title_en)} · {localized(l, c.session_label_fr, c.session_label_en)}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: { sm: 'right' } }}>
                        <Typography sx={{ fontWeight: 700 }}>{formatXAF(c.amount, l)}</Typography>
                        <StatusBadge tone={state === 'waiting' ? 'pending' : state === 'due' ? 'info' : 'validated'}>{t(`academy.state.${state}`)}</StatusBadge>
                      </Box>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      aria-label={t('academy.progress', { percent: Math.round(progress) })}
                      sx={{ mt: 3, height: 6, borderRadius: 3 }}
                    />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('academy.progress', { percent: Math.round(progress) })} · {t('academy.rate', { rate: num(c.commission_rate) })}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Stack>
      </SectionCard>

      {/* Campagnes en cours */}
      <Box component="section" aria-labelledby="open-title">
        <SectionTitle id="open-title">{t('campaigns.open')}</SectionTitle>
        {open.length === 0 ? (
          <Card>
            <CardContent>
              <Typography sx={{ color: 'text.secondary' }}>{t('campaigns.emptyOpen')}</Typography>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={3} component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
            {open.map((c) => {
              const ch = choice.get(c.id);
              return (
                <Card component="li" key={c.id}>
                  <LinkCardArea href={`/ambassador/campaigns/${c.id}`}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 600 }}>{localized(l, c.title_fr, c.title_en)}</Typography>
                          <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                            {localized(l, c.summary_fr, c.summary_en)}
                          </Typography>
                        </Box>
                        <ChevronRight aria-hidden size={20} style={{ flexShrink: 0, marginTop: 4 }} />
                      </Box>
                      <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <StatusBadge tone="info">{t('campaigns.perAccount', { amount: formatXAF(c.amount_per_account, l) })}</StatusBadge>
                        {c.min_volume !== null && <StatusBadge tone="neutral">{t('campaigns.minVolume', { volume: formatNumber(c.min_volume, l) })}</StatusBadge>}
                        {c.ends_on && <StatusBadge tone="neutral">{t('campaigns.endsOn', { date: formatDate(c.ends_on, l) })}</StatusBadge>}
                        <StatusBadge tone={ch === true ? 'validated' : ch === false ? 'neutral' : 'pending'}>
                          {t(`campaigns.choice.${ch === true ? 'yes' : ch === false ? 'no' : 'none'}`)}
                        </StatusBadge>
                      </Box>
                    </CardContent>
                  </LinkCardArea>
                </Card>
              );
            })}
          </Stack>
        )}
      </Box>

      {/* Campagnes terminées */}
      {closed.length > 0 && (
        <Box component="section" aria-labelledby="closed-title">
          <SectionTitle id="closed-title">{t('campaigns.closed')}</SectionTitle>
          <ListCard>
            {closed.map((c) => {
              const b = perCampaign.get(c.id);
              return (
                <li key={c.id}>
                  <LinkCardArea href={`/ambassador/campaigns/${c.id}`} sx={{ p: 4, display: 'flex', justifyContent: 'space-between', gap: 3 }}>
                    <span>
                      <Typography component="span" sx={{ display: 'block', fontWeight: 500 }}>
                        {localized(l, c.title_fr, c.title_en)}
                      </Typography>
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                        {formatDate(c.closed_at, l)}
                      </Typography>
                    </span>
                    <Typography component="span" sx={{ fontWeight: 600 }}>
                      {formatXAF(num(b?.earned), l)}
                    </Typography>
                  </LinkCardArea>
                </li>
              );
            })}
          </ListCard>
        </Box>
      )}

      <Collapsible summary={t('readCharter')}>
        <Markdown source={charterBody} />
      </Collapsible>
    </Stack>
  );
}
