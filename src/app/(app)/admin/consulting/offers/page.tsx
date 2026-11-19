import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requireAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { LinkButton, TextLink } from '@/components/ui/links';
import { EmptyCard, TableCard, TableCell, TableRow } from '@/components/ui/table-card';
import { formatXAF } from '@/lib/format';
import { localized } from '@/lib/localized';
import { num, type Offer } from '@/lib/consulting/types';
import type { Locale } from '@/lib/types';

export const metadata: Metadata = { title: 'Offres de conseil' };

const STATUS_TONE = { draft: 'draft', published: 'launched', archived: 'closed' } as const;

export default async function AdminOffersPage() {
  await requireAdmin();
  const [t, tc, locale, supabase] = await Promise.all([getTranslations('adminConsulting'), getTranslations('consulting'), getLocale(), createClient()]);
  const l = locale as Locale;
  const { data } = await supabase
    .from('consulting_offers')
    .select('id, title_fr, title_en, category, mode, duration_minutes, price, status, once_per_client')
    .order('created_at', { ascending: false });
  const offers = (data ?? []) as Offer[];

  return (
    <>
      <PageHeader
        title={t('offers.title')}
        subtitle={t('offers.subtitle')}
        actions={
          <LinkButton href="/admin/consulting/offers/new" variant="contained">
            {t('offers.new')}
          </LinkButton>
        }
      />
      {offers.length === 0 ? (
        <EmptyCard>{t('offers.empty')}</EmptyCard>
      ) : (
        <TableCard head={[t('offers.titleCol'), t('offers.category'), t('offers.mode'), t('offers.duration'), t('offers.price'), t('offers.status')]}>
          {offers.map((o) => (
            <TableRow key={o.id} hover>
              <TableCell>
                <TextLink href={`/admin/consulting/offers/${o.id}`}>{localized(l, o.title_fr, o.title_en)}</TextLink>
              </TableCell>
              <TableCell>{tc(`category.${o.category}`)}</TableCell>
              <TableCell>{tc(`mode.${o.mode}`)}</TableCell>
              <TableCell>{tc('minutes', { count: o.duration_minutes })}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>{num(o.price) === 0 ? tc('free') : formatXAF(o.price, l)}</TableCell>
              <TableCell>
                <StatusBadge tone={STATUS_TONE[o.status]}>{t(`offer.status.${o.status}`)}</StatusBadge>
              </TableCell>
            </TableRow>
          ))}
        </TableCard>
      )}
    </>
  );
}
