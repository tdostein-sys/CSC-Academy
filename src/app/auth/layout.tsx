import { getTranslations } from 'next-intl/server';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { Logo } from '@/components/logo';
import { LanguageMenu, ThemeMenu } from '@/components/layout/preferences';
import { AuthBackdrop, AuthCard } from '@/components/auth-backdrop';
import { AuthTabs } from '@/components/auth-tabs';
import { TextLink } from '@/components/ui/links';
import { ArrowLeft } from 'lucide-react';

/**
 * Pages d'authentification : carte centrée, logo au-dessus, bascule
 * « Se connecter / Créer un compte », langue et thème en haut à droite.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [tf, ta] = await Promise.all([getTranslations('footer'), getTranslations('auth')]);
  return (
    <AuthBackdrop>
      {/* Jamais de page sans issue : retour à l'accueil toujours visible (le logo y mène aussi). */}
      <Box sx={{ position: 'absolute', top: { xs: 14, sm: 22 }, left: { xs: 12, sm: 20 }, zIndex: 1 }}>
        <TextLink href="/" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, fontWeight: 600, minHeight: 44 }}>
          <ArrowLeft aria-hidden size={16} />
          {ta('backToHome')}
        </TextLink>
      </Box>
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
