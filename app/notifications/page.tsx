import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { BellOff, CheckCheck } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { PageHeader } from '@/components/page-header';
import type { Locale, NotificationRow } from '@/lib/types';
import { markAllNotificationsRead } from './actions';

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
    <div className="container-page max-w-3xl py-8">
      <PageHeader
        title={t('title')}
        actions={
          user.unreadNotifications > 0 && (
            <form action={markAllNotificationsRead}>
              <button type="submit" className="btn-outline">
                <CheckCheck aria-hidden className="size-4" />
                {t('markAllRead')}
              </button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 py-12 text-muted">
          <BellOff aria-hidden className="size-8" />
          {t('empty')}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id} className={`card ${n.read_at ? '' : 'border-l-4 border-l-accent'}`}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{n.title}</h2>
                {!n.read_at && <span className="badge shrink-0 bg-accent-soft text-text">{t('unread')}</span>}
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-muted">{n.body}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <time dateTime={n.created_at}>{formatDate(n.created_at, locale as Locale, true)}</time>
                {n.link && (
                  <Link href={n.link} className="link text-sm">
                    {t('open')} →
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
