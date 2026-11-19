import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { SectionCard } from '@/components/ui/section-card';
import { Notice } from '@/components/ui/notice';
import { LinkButton } from '@/components/ui/links';
import { ActionForm } from '@/components/forms/action-form';
import { SubmitButton } from '@/components/forms/fields';
import { localized } from '@/lib/localized';
import { OFFER_COLUMNS, UUID, type Offer } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';
import { OfferForm } from '../offer-form';
import { deleteOffer, setOfferStatus, updateOffer } from '../../actions';

export const metadata: Metadata = { title: 'Offre de conseil' };

const STATUS_TONE = { draft: 'draft', published: 'launched', archived: 'closed' } as const;

export default async function EditOfferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; untranslated?: string }> }) {
  await requireAdmin();
  const [{ id }, flags] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const [t, locale, supabase] = await Promise.all([getTranslations('adminConsulting'), getLocale(), createClient()]);
  const l = locale as Locale;
  const { data } = await supabase.from('consulting_offers').select(OFFER_COLUMNS).eq('id', id).maybeSingle();
  const offer = data as Offer | null;
  if (!offer) notFound();
  const { count: bookings } = await supabase.from('consulting_bookings').select('id', { count: 'exact', head: true }).eq('offer_id', id);

  const statusButton = (status: 'draft' | 'published' | 'archived', label: string, variant: 'contained' | 'outlined' = 'outlined') => (
    <ActionForm action={setOfferStatus} key={status}>
      <input type="hidden" name="id" value={offer.id} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton pending={false} fullWidth={false} variant={variant} size="medium">
        {label}
      </SubmitButton>
    </ActionForm>
  );

  return (
    <>
      <PageHeader
        title={localized(l, offer.title_fr, offer.title_en)}
        subtitle={<StatusBadge tone={STATUS_TONE[offer.status]}>{t(`offer.status.${offer.status}`)}</StatusBadge>}
        actions={
          <LinkButton href={`/consulting/${offer.id}`} variant="outlined" target="_blank">
            {t('offer.preview')}
          </LinkButton>
        }
      />
      <Stack spacing={6}>
        {flags.created && <Notice tone="success">{t('offer.created')}</Notice>}
        {flags.untranslated && <Notice tone="warning">{t('untranslated')}</Notice>}
        <SectionCard id="offer-status" title={t('offer.statusTitle')} subtitle={t('offer.statusHint')}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {offer.status !== 'published' && statusButton('published', t('offer.publish'), 'contained')}
            {offer.status === 'published' && statusButton('draft', t('offer.unpublish'))}
            {offer.status !== 'archived' && statusButton('archived', t('offer.archive'))}
            {offer.status === 'draft' && !bookings && (
              <ActionForm action={deleteOffer} confirm={t('offer.deleteConfirm')} danger>
                <input type="hidden" name="id" value={offer.id} />
                <SubmitButton pending={false} fullWidth={false} color="error" variant="outlined" size="medium">
                  {t('offer.delete')}
                </SubmitButton>
              </ActionForm>
            )}
          </Box>
        </SectionCard>
        <SectionCard id="offer-edit" title={t('offer.editTitle')} subtitle={bookings ? t('offer.frozenHint', { count: bookings }) : undefined}>
          <OfferForm action={updateOffer} offer={offer} />
        </SectionCard>
      </Stack>
    </>
  );
}
