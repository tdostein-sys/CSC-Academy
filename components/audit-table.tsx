import { getLocale, getTranslations } from 'next-intl/server';
import { formatDate } from '@/lib/format';
import type { Locale } from '@/lib/types';

export interface AuditRow {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
  actor: { first_name: string; last_name: string; username: string | null } | null;
}

export async function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [t, tc, locale] = await Promise.all([getTranslations('admin.audit'), getTranslations('common'), getLocale()]);
  if (rows.length === 0) return <p className="card text-muted">{t('empty')}</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{tc('date')}</th>
            <th>{t('actor')}</th>
            <th>{t('action')}</th>
            <th>{t('entity')}</th>
            <th>{t('details')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap">{formatDate(r.created_at, locale as Locale, true)}</td>
              <td>{r.actor ? r.actor.username ?? `${r.actor.first_name} ${r.actor.last_name}` : t('system')}</td>
              <td>
                <code className="text-xs">{r.action}</code>
              </td>
              <td className="text-xs">
                {r.entity}
                {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ''}
              </td>
              <td className="max-w-xs truncate text-xs text-muted">{Object.keys(r.data ?? {}).length ? JSON.stringify(r.data) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
