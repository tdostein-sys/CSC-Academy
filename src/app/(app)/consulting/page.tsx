import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { Clock, MapPin, Phone, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { PageHeader } from '@/components/page-header';
import { ThemedIllustration } from '@/components/themed-illustration';
import { StatusBadge } from '@/components/status-badge';
import { Notice } from '@/components/ui/notice';
import { LinkButton, LinkCardArea } from '@/components/ui/links';
import { formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type Offer } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'CSC Consulting' };

const MODE_ICONS ={ video: Video, phone: Phone, in_person: MapPin } as const;

/** Catalogue des offres de conseil publiées. */
export default async function ConsultingPage() {
  const [t, locale, supabase, user] = await Promise.all([getTranslations('consulting'), getLocale(), createClient(), getSessionUser()]);
  const l = locale as Locale;

  const { data } = await supabase
    .from('consulting_offers')
    .select('id, title_fr, title_en, description_fr, description_en, category, mode, duration_minutes, price')
    .eq('status', 'published')
    .order('price', { ascending: true });
  const offers = (data ?? []) as Pick<Offer, 'id' | 'title_fr' | 'title_en' | 'description_fr' | 'description_en' | 'category' | 'mode' | 'duration_minutes' | 'price'>[];

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          user ? (
            <LinkButton href="/consulting/bookings" variant="outlined">
              {t('myBookings')}
            </LinkButton>
          ) : undefined
        }
      />
      <Stack spacing={6}>
        <Notice tone="info" title={t('disclaimerTitle')}>
          {t('disclaimer')}
        </Notice>
        {offers.length === 0 ? (
          <Card>
            <CardContent sx={{ py: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
              <ThemedIllustration name="girl-with-laptop" width={260} />
              <Typography sx={{ color: 'text.secondary' }}>{t('empty')}</Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={6}>
            {offers.map((o) => {
              const ModeIcon = MODE_ICONS[o.mode];
              const price = num(o.price);
              // Premier paragraphe de la description, sans mise en forme.
              const excerpt = localized(l, o.description_fr, o.description_en).split(/\n\s*\n/)[0].replace(/[#*_>`]/g, '').slice(0, 220);
              return (
                <Grid item xs={12} md={6} xl={4} key={o.id}>
                  <Card sx={{ height: '100%' }}>
                    <LinkCardArea href={`/consulting/${o.id}`} sx={{ height: '100%' }}>
                      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, height: '100%' }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                          <StatusBadge tone="primary">{t(`category.${o.category}`)}</StatusBadge>
                          {price === 0 && <StatusBadge tone="active">{t('free')}</StatusBadge>}
                        </Box>
                        <Typography variant="h6" component="h2" sx={{ fontWeight: 700 }}>
                          {localized(l, o.title_fr, o.title_en)}
                        </Typography>
                        <Typography variant="body2" sx={{ flex: 1, color: 'text.secondary' }}>
                          {excerpt}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, color: 'text.secondary' }}>
                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <Clock aria-hidden size={16} />
                            <Typography variant="body2">{t('minutes', { count: o.duration_minutes })}</Typography>
                          </Box>
                          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                            <ModeIcon aria-hidden size={16} />
                            <Typography variant="body2">{t(`mode.${o.mode}`)}</Typography>
                          </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: 2 }}>
                          <Typography sx={{ fontWeight: 700 }}>{price === 0 ? t('free') : formatXAF(price, l)}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.main' }}>
                            {t('book')} →
                          </Typography>
                        </Box>
                      </CardContent>
                    </LinkCardArea>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Stack>
    </>
  );
}
