import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { Markdown } from '@/components/markdown';
import { SectionCard } from '@/components/ui/section-card';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { StatusBadge } from '@/components/status-badge';
import { SlotPicker } from '@/components/consulting/slot-picker';
import { formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { loadSlotDays } from '@/lib/consulting/slots';
import { OFFER_COLUMNS, SETTINGS_COLUMNS, UUID, num, type Offer, type Settings } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import { bookSlot } from '../actions';

export const metadata: Metadata = { title: 'CSC Consulting' };
export const dynamic = 'force-dynamic';

/** Détail d'une offre de conseil et réservation d'un créneau. */
export default async function OfferPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [t, locale, supabase, user] = await Promise.all([getTranslations('consulting'), getLocale(), createClient(), getSessionUser()]);
  const l = locale as Locale;

  const [{ data: offerData }, { data: settingsData }] = await Promise.all([
    supabase.from('consulting_offers').select(OFFER_COLUMNS).eq('id', id).maybeSingle(),
    supabase.from('consulting_settings').select(SETTINGS_COLUMNS).maybeSingle(),
  ]);
  const offer = offerData as Offer | null;
  if (!offer) notFound();
  const settings = settingsData as Settings | null;
  const price = num(offer.price);
  const bookable = offer.status === 'published';
  const profileIncomplete = user && (!user.profile.first_name.trim() || !user.profile.last_name.trim() || !user.profile.phone_whatsapp.trim());
  const days = bookable && user && !profileIncomplete ? await loadSlotDays(supabase, offer.id, l) : [];
  const description = localized(l, offer.description_fr, offer.description_en);
  const conditions = localized(l, offer.conditions_fr, offer.conditions_en);

  const facts: [string, string][] = [
    [t('offer.duration'), t('minutes', { count: offer.duration_minutes })],
    [t('offer.mode'), t(`mode.${offer.mode}`)],
    ...(offer.mode === 'in_person' && offer.location ? ([[t('offer.location'), offer.location]] as [string, string][]) : []),
    [t('offer.price'), price === 0 ? t('free') : formatXAF(price, l)],
  ];

  return (
    <Stack spacing={6}>
      <Box>
        <LinkButton href="/consulting" size="small" startIcon={<ArrowLeft aria-hidden size={16} />} sx={{ mb: 3 }}>
          {t('backCatalog')}
        </LinkButton>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <StatusBadge tone="primary">{t(`category.${offer.category}`)}</StatusBadge>
          {offer.once_per_client && <StatusBadge tone="info">{t('oncePerClient')}</StatusBadge>}
        </Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {localized(l, offer.title_fr, offer.title_en)}
        </Typography>
      </Box>

      <Grid container spacing={6}>
        <Grid item xs={12} lg={7}>
          <Stack spacing={6}>
            {description && (
              <SectionCard id="offer-description" title={t('offer.description')}>
                <Markdown source={description} />
              </SectionCard>
            )}
            {conditions && (
              <SectionCard id="offer-conditions" title={t('offer.conditions')}>
                <Markdown source={conditions} />
              </SectionCard>
            )}
            <Notice tone="info" title={t('disclaimerTitle')}>
              {t('disclaimer')}
            </Notice>
          </Stack>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Stack spacing={6}>
            <SectionCard id="offer-facts" title={t('offer.facts')}>
              <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 4, rowGap: 2 }}>
                {facts.map(([k, v]) => (
                  <Box key={k} sx={{ display: 'contents' }}>
                    <Typography component="dt" variant="body2" sx={{ color: 'text.secondary' }}>
                      {k}
                    </Typography>
                    <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600 }}>
                      {v}
                    </Typography>
                  </Box>
                ))}
              </Box>
              {price > 0 && settings && (
                <Typography variant="body2" sx={{ mt: 4, color: 'text.secondary' }}>
                  {t('offer.holdInfo', { hours: settings.hold_hours, cancel: settings.cancel_limit_hours })}
                </Typography>
              )}
            </SectionCard>
          </Stack>
        </Grid>
      </Grid>

      <SectionCard id="offer-book" title={t('offer.bookTitle')} subtitle={bookable ? t('offer.bookSubtitle') : undefined}>
        {!bookable ? (
          <Notice tone="warning">{t('offer.unavailable')}</Notice>
        ) : !user ? (
          <Stack spacing={3} sx={{ alignItems: 'flex-start' }}>
            <Typography>{t('offer.loginToBook')}</Typography>
            <LinkButton href={`/auth/login?next=${encodeURIComponent(`/consulting/${offer.id}`)}`} variant="contained">
              {t('offer.login')}
            </LinkButton>
          </Stack>
        ) : profileIncomplete ? (
          <Notice tone="warning" action={<LinkButton href="/profile" size="small">{t('offer.completeProfile')}</LinkButton>}>
            {t('errors.profile_incomplete')}
          </Notice>
        ) : (
          <SlotPicker
            days={days}
            action={bookSlot}
            hidden={{ offer_id: offer.id }}
            submitLabel={price === 0 ? t('picker.confirmFree') : t('picker.confirmPaid', { amount: formatXAF(price, l) })}
            withMessage
            timezoneNote={t('picker.timezone')}
          />
        )}
      </SectionCard>
    </Stack>
  );
}
