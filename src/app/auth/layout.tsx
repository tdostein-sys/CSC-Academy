import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Logo } from '@/components/logo';
import { LanguageMenu, ThemeMenu } from '@/components/layout/preferences';
import { AuthBackdrop, AuthCard } from '@/components/auth-backdrop';
import { AuthTabs } from '@/components/auth-tabs';

/**
 * Pages d'authentification : carte centrée, logo au-dessus, bascule
 * « Se connecter / Créer un compte », langue et thème en haut à droite.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const tf = await getTranslations('footer');
  return (
    <AuthBackdrop>
      <Box sx={{ position: 'absolute', top: { xs: 8, sm: 16 }, right: { xs: 8, sm: 16 }, display: 'flex', alignItems: 'center', color: 'text.primary', zIndex: 1 }}>
        <LanguageMenu />
        <ThemeMenu />
      </Box>
      <Box
        component="main"
        sx={{
          position: 'relative',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 4,
          py: { xs: 14, sm: 10 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Box sx={{ mb: 6 }}>
            <Logo size={84} />
          </Box>
          <AuthCard>
            <AuthTabs />
            {children}
          </AuthCard>
          <Typography variant="body2" sx={{ mt: 6, textAlign: 'center', color: 'text.secondary' }}>
            {tf('rights', { year: new Date().getFullYear() })}
          </Typography>
        </Box>
      </Box>
    </AuthBackdrop>
  );
}
