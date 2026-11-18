import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ArrowLeft, CheckCircle2, FileDown, XCircle } from 'lucide-react';
import { requireAmbassador } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Markdown } from '@/components/markdown';
import { ActionForm } from '@/components/forms/action-form';
import { StatusBadge } from '@/components/status-badge';
import { VideoEmbed } from '@/components/video-embed';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { Collapsible } from '@/components/ui/collapsible';
import { ListCard, SectionCard, SectionTitle } from '@/components/ui/section-card';
import { formatDate, formatNumber, formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { parseVideoUrl } from '@/lib/video';
import { payoutMethodLabel } from '@/lib/ambassador/methods';
import { CAMPAIGN_COLUMNS, num, type Campaign, type CampaignBalance, type Payout, type Submission } from '@/lib/ambassador/types';
import type { Locale } from '@/lib/types';
import type { PaymentState } from '@/components/payment-badge';
import { cancelSubmission, confirmPayout, setParticipation } from '../../actions';
import { SubmissionForm } from './submission-form';

export const metadata: Metadata = { title: 'Campagne' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAYMENT_TONE = { paid: 'validated', due: 'pending', awaiting_confirmation: 'info' } as const;

export default async function AmbassadorCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireAmbassador(`/ambassador/campaigns/${id}`);
  const [locale, supabase, t] = await Promise.all([getLocale(), createClient(), getTranslations('ambassador')]);
  const l = locale as Locale;

  // La RLS ne renvoie que les campagnes lancées ou clôturées.
  const { data: campaign } = await supabase.from('campaigns').select(CAMPAIGN_COLUMNS).eq('id', id).maybeSingle();
  if (!campaign) notFound();
  const c = campaign as Campaign;

  // Vue comptée une seule fois (la fonction ignore les doublons).
  await supabase.rpc('record_campaign_view', { p_campaign: id });

  const [partRes, subsRes, payoutsRes, balRes, fileRes, statesRes] = await Promise.all([
    supabase.from('campaign_participations').select('participates').eq('campaign_id', id).eq('ambassador_id', user.id).maybeSingle(),
    supabase.from('submissions').select('*').eq('campaign_id', id).eq('ambassador_id', user.id).order('created_at', { ascending: false }),
    supabase.from('payouts').select('*').eq('campaign_id', id).eq('ambassador_id', user.id).order('paid_at', { ascending: false }),
    supabase.from('ambassador_campaign_balances').select('*').eq('campaign_id', id).eq('ambassador_id', user.id).maybeSingle(),
    c.modop_file_path ? supabase.storage.from('campaign-files').createSignedUrl(c.modop_file_path, 3600) : Promise.resolve({ data: null }),
    supabase.from('submission_payment_states').select('submission_id, payment_state').eq('campaign_id', id).eq('ambassador_id', user.id),
  ]);
  const paymentState = new Map((statesRes.data ?? []).map((s) => [s.submission_id as string, s.payment_state as PaymentState]));

  const participates = (partRes.data?.participates as boolean | undefined) ?? null;
  const submissions = (subsRes.data ?? []) as Submission[];
  const payouts = (payoutsRes.data ?? []) as Payout[];
  // Au moins un ID en attente ou validé : refuser n'est plus possible (règle vérifiée aussi en base).
  const participationLocked = submissions.some((s) => s.status !== 'rejected');
  const bal = balRes.data as CampaignBalance | null;
  const fileUrl = fileRes.data?.signedUrl ?? null;

  const title = localized(l, c.title_fr, c.title_en);
  const summary = localized(l, c.summary_fr, c.summary_en);
  const modop = localized(l, c.modop_fr, c.modop_en);
  const video = parseVideoUrl(c.video_url);
  const isOpen = c.status === 'launched';
  const isActive = user.ambassador.status === 'active';
  const minLabel = c.min_volume !== null ? t('campaign.tradingVolumeMin', { volume: formatNumber(c.min_volume, l) }) : null;

  return (
    <Stack spacing={6} sx={{ maxWidth: 860 }}>
      <Box>
        <LinkButton href="/ambassador" size="small" startIcon={<ArrowLeft aria-hidden size={16} />}>
          {t('campaign.back')}
        </LinkButton>
      </Box>

      <Box component="header">
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <StatusBadge tone={c.status}>{t(`campaignStatus.${c.status}`)}</StatusBadge>
          <StatusBadge tone="info">{t('campaigns.perAccount', { amount: formatXAF(c.amount_per_account, l) })}</StatusBadge>
          {c.min_volume !== null && <StatusBadge tone="neutral">{t('campaigns.minVolume', { volume: formatNumber(c.min_volume, l) })}</StatusBadge>}
          {c.ends_on && <StatusBadge tone="neutral">{t('campaigns.endsOn', { date: formatDate(c.ends_on, l) })}</StatusBadge>}
        </Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        {summary && <Typography sx={{ mt: 2, color: 'text.secondary' }}>{summary}</Typography>}
      </Box>

      {!isOpen && <Notice tone="info">{t('campaign.closedNotice')}</Notice>}
      {isOpen && !isActive && <Notice tone="error">{t('campaign.suspendedNotice')}</Notice>}

      {/* Vidéo */}
      {video && c.video_url && (
        <SectionCard id="video-title" title={t('campaign.video')}>
          <VideoEmbed
            video={video}
            sourceUrl={c.video_url}
            title={title}
            labels={{ play: t('campaign.playVideo'), hint: t('campaign.videoDataHint'), open: t('campaign.openVideo') }}
          />
        </SectionCard>
      )}

      {/* Mode opératoire */}
      {(modop || fileUrl) && (
        <SectionCard id="modop-title" title={t('campaign.modop')}>
          {modop && <Markdown source={modop} />}
          {fileUrl && (
            <Button href={fileUrl} target="_blank" rel="noopener noreferrer" variant="outlined" startIcon={<FileDown aria-hidden size={18} />} sx={{ mt: 2 }}>
              {t('campaign.downloadModop')}
            </Button>
          )}
        </SectionCard>
      )}

      {/* Participation */}
      {isOpen && isActive && (
        <SectionCard id="part-title" title={t('campaign.participationTitle')}>
          {participates === null ? (
            // Pas encore de choix : les deux options.
            <>
              <Typography variant="body2" sx={{ mb: 4, color: 'text.secondary' }}>
                {t('campaign.participationQuestion')}
              </Typography>
              <ActionForm action={setParticipation} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input type="hidden" name="campaign_id" value={c.id} />
                <Button type="submit" name="participates" value="yes" variant="contained">
                  {t('campaign.yes')}
                </Button>
                <Button type="submit" name="participates" value="no" variant="outlined">
                  {t('campaign.no')}
                </Button>
              </ActionForm>
            </>
          ) : (
            // Choix fait : seule l'option retenue est affichée ; l'autre est masquée.
            <>
              <Box
                sx={{
                  p: 3,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  bgcolor: participates ? 'success.light' : 'secondary.light',
                  color: participates ? 'success.main' : 'text.secondary',
                }}
              >
                {participates ? <CheckCircle2 aria-hidden size={20} /> : <XCircle aria-hidden size={20} />}
                {participates ? t('campaign.youParticipate') : t('campaign.youDecline')}
              </Box>
              {/* Revenir sur son choix : possible tant qu'aucun ID n'a été soumis. */}
              <Box sx={{ mt: 3 }}>
                {participates && participationLocked ? (
                  <Notice tone="info">{t('campaign.participationLocked')}</Notice>
                ) : (
                  <Collapsible summary={t('campaign.changeChoice')} plain>
                    <Box sx={{ mt: 2 }}>
                      <ActionForm action={setParticipation}>
                        <input type="hidden" name="campaign_id" value={c.id} />
                        <Button type="submit" name="participates" value={participates ? 'no' : 'yes'} variant="outlined">
                          {participates ? t('campaign.no') : t('campaign.yes')}
                        </Button>
                      </ActionForm>
                    </Box>
                  </Collapsible>
                )}
              </Box>
            </>
          )}
        </SectionCard>
      )}

      {/* Déclaration d'un compte */}
      {isOpen && isActive && (
        <SectionCard id="submit-title" title={t('campaign.submitTitle')} subtitle={t('campaign.submitHint')}>
          {participates ? <SubmissionForm campaignId={c.id} minVolumeLabel={minLabel} /> : <Notice tone="info">{t('campaign.mustParticipate')}</Notice>}
        </SectionCard>
      )}

      {/* Mes comptes déclarés */}
      <Box component="section" aria-labelledby="subs-title">
        <SectionTitle
          id="subs-title"
          aside={
            bal && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {t('balance.earned')} : <strong>{formatXAF(num(bal.earned), l)}</strong> · {t('balance.due')} : <strong>{formatXAF(num(bal.due), l)}</strong>
              </Typography>
            )
          }
        >
          {t('campaign.mySubmissions')}
        </SectionTitle>
        {submissions.length === 0 ? (
          <EmptyText>{t('campaign.noSubmissions')}</EmptyText>
        ) : (
          <ListCard>
            {submissions.map((s) => {
              const ps = paymentState.get(s.id);
              return (
                <Box
                  component="li"
                  key={s.id}
                  sx={{ p: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'flex-start' }, justifyContent: 'space-between' }}
                >
                  <Box>
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '1rem' }}>{s.binance_uid}</Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {formatNumber(s.trading_volume, l)} USDT · {formatDate(s.created_at, l, true)}
                    </Typography>
                    {s.status === 'rejected' && s.reject_reason && (
                      <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
                        {t('rejectReason', { reason: s.reject_reason })}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
                    {s.status === 'validated' && (
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.main' }}>
                        +{formatXAF(s.amount, l)}
                      </Typography>
                    )}
                    <StatusBadge tone={s.status}>{t(`status.${s.status}`)}</StatusBadge>
                    {s.status === 'validated' && ps && <StatusBadge tone={PAYMENT_TONE[ps]}>{t(`paymentState.${ps}`)}</StatusBadge>}
                    {s.status === 'pending' && isOpen && (
                      <ActionForm action={cancelSubmission} confirm={t('campaign.cancelConfirm')} confirmLabel={t('campaign.cancel')} danger>
                        <input type="hidden" name="id" value={s.id} />
                        <Button type="submit" size="small" color="error">
                          {t('campaign.cancel')}
                        </Button>
                      </ActionForm>
                    )}
                  </Box>
                </Box>
              );
            })}
          </ListCard>
        )}
      </Box>

      {/* Paiements */}
      <Box component="section" aria-labelledby="pay-title">
        <SectionTitle id="pay-title">{t('campaign.myPayouts')}</SectionTitle>
        {payouts.length === 0 ? (
          <EmptyText>{t('campaign.noPayouts')}</EmptyText>
        ) : (
          <ListCard>
            {payouts.map((p) => (
              <Box
                component="li"
                key={p.id}
                sx={{ p: 4, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' }, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{formatXAF(p.amount, l)}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {payoutMethodLabel(p.method, l)}
                    {p.reference ? ` · ${t('payouts.reference')} ${p.reference}` : ''} · {t('payouts.paidOn')} {formatDate(p.paid_at, l)}
                  </Typography>
                </Box>
                {p.confirmed_at ? (
                  <StatusBadge tone="validated">{t('payouts.confirmedOn', { date: formatDate(p.confirmed_at, l) })}</StatusBadge>
                ) : (
                  <ActionForm action={confirmPayout}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="contained">
                      {t('payouts.confirm')}
                    </Button>
                  </ActionForm>
                )}
              </Box>
            ))}
          </ListCard>
        )}
      </Box>
    </Stack>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent>
        <Typography sx={{ color: 'text.secondary' }}>{children}</Typography>
      </CardContent>
    </Card>
  );
}
