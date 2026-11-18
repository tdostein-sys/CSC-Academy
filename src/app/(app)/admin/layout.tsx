import { getTranslations } from 'next-intl/server';
import Typography from '@mui/material/Typography';
import { requireAdmin } from '@/lib/auth';

/** Administration : accès réservé (rôle vérifié en base). Les liens sont dans le menu latéral. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations('admin');
  return (
    <>
      <Typography variant="overline" component="p" sx={{ color: 'primary.main', fontWeight: 700, letterSpacing: 1, mb: 2 }}>
        {t('title')}
      </Typography>
      {children}
    </>
  );
}
