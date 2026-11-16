import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

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
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      {current > 1 ? (
        <Link href={href(current - 1)} className="btn-outline">
          ← {t('previous')}
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {current} / {pages}
      </span>
      {current < pages ? (
        <Link href={href(current + 1)} className="btn-outline">
          {t('next')} →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
