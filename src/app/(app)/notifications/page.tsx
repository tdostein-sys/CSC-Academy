import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { BellOff, CheckCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import type { Locale, NotificationRow } from '@/lib/types';
import { markAllNotificationsRead } from './actions';
import { LinkButton } from '@/components/ui/links';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const user = await requireUser('/notifications');
  const [t, locale, supabase] = await Promise.all([getTranslations('notifications'), getLocale(), createClient()]);
  const { data } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  const items = (data ?? []) as NotificationRow[];

  return (
    <Box sx={{ maxWidth: 860 }}>
      <PageHeader
        title={t('title')}
        actions={
          user.unreadNotifications > 0 && (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outlined" startIcon={<CheckCheck aria-hidden size={18} />}>
                {t('markAllRead')}
              </Button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: 'text.secondary' }}>
            <BellOff aria-hidden size={32} />
            {t('empty')}
          </CardContent>
        </Card>
      ) : (
        <Stack component="ul" spacing={3} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {items.map((n) => (
            <Card component="li" key={n.id} sx={n.read_at ? undefined : { borderLeft: '4px solid #f5c211' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 3 }}>
                  <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600 }}>
                    {n.title}
                  </Typography>
                  {!n.read_at && <StatusBadge tone="accentSoft">{t('unread')}</StatusBadge>}
                </Box>
                <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line', color: 'text.secondary' }}>
                  {n.body}
                </Typography>
                <Box sx={{ mt: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'text.secondary' }}>
                  <time dateTime={n.created_at}>{formatDate(n.created_at, locale as Locale, true)}</time>
                  {n.link && (
                    <LinkButton href={n.link} size="small">
                      {t('open')} →
                    </LinkButton>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
