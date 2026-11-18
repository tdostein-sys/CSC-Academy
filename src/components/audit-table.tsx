import { getLocale, getTranslations } from 'next-intl/server';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableContainer from '@mui/material/TableContainer';
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
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography sx={{ color: 'text.secondary' }}>{t('empty')}</Typography>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{tc('date')}</TableCell>
              <TableCell>{t('actor')}</TableCell>
              <TableCell>{t('action')}</TableCell>
              <TableCell>{t('entity')}</TableCell>
              <TableCell>{t('details')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(r.created_at, locale as Locale, true)}</TableCell>
                <TableCell>{r.actor ? (r.actor.username ?? `${r.actor.first_name} ${r.actor.last_name}`) : t('system')}</TableCell>
                <TableCell>
                  <code style={{ fontSize: '0.75rem' }}>{r.action}</code>
                </TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>
                  {r.entity}
                  {r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ''}
                </TableCell>
                <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.75rem', color: 'text.secondary' }}>
                  {Object.keys(r.data ?? {}).length ? JSON.stringify(r.data) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Card>
  );
}
