import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { LinkButton } from '@/components/ui/links';

export function pageRange(pageParam: string | undefined, pageSize: number) {
  const current = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1);
  const from = (current - 1) * pageSize;
  return { current, from, to: from + pageSize - 1 };
}

export async function Pagination({
  basePath,
  current,
  total,
  pageSize,
  params = {},
}: {
  basePath: string;
  current: number;
  total: number;
  pageSize: number;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const t = await getTranslations('common');
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    sp.set('page', String(p));
    return `${basePath}?${sp.toString()}`;
  };
  return (
    <Box component="nav" aria-label="Pagination" sx={{ mt: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      {current > 1 ? (
        <LinkButton href={href(current - 1)} variant="outlined" size="small">
          ← {t('previous')}
        </LinkButton>
      ) : (
        <span />
      )}
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {current} / {pages}
      </Typography>
      {current < pages ? (
        <LinkButton href={href(current + 1)} variant="outlined" size="small">
          {t('next')} →
        </LinkButton>
      ) : (
        <span />
      )}
    </Box>
  );
}
