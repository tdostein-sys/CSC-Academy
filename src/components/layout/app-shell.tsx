'use client';

import { useState, useTransition, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Badge from '@mui/material/Badge';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Divider from '@mui/material/Divider';
import Tooltip from '@mui/material/Tooltip';
import { Bell, Languages, LayoutGrid, LogOut, Menu as MenuIcon, MessageCircle, Moon, Shield, Sun, UserRound, X } from 'lucide-react';
import { logout } from '@/app/auth/actions';
import { setLocale } from '@/app/actions/preferences';
import { IdleTimeout, broadcastLogout } from '@/components/session/idle-timeout';
import { useThemeMode } from '@/components/theme/theme-provider';
import { Logo } from '@/components/logo';
import { RouteProgress } from '@/components/layout/route-progress';
import { tok } from '@/@core/theme/tokens';
import { activeNavKey, navSections, type NavItem } from '@/lib/navigation';
import { LanguageMenu, ThemeMenu } from './preferences';

export const NAV_WIDTH = 264;

/** Informations (sérialisables) sur l'utilisateur connecté, fournies par le serveur. */
export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  /** Conseiller CSC Consulting actif. */
  isAdvisor: boolean;
  ambassadorCode: string | null;
  unread: number;
}

/** Encart « Besoin d'aide ? » : lien WhatsApp de CSC (null si non renseigné par l'admin). */
export interface ShellHelp {
  whatsappUrl: string | null;
}

/**
 * Cadre de l'application : menu latéral marine (fixe sur grand écran,
 * tiroir sur mobile et tablette) construit depuis la configuration unique
 * `lib/navigation.ts`, barre supérieure opaque pleine largeur, conteneur de
 * page unique (largeur max 1200 px, marges 32 px / 16 px).
 */
export function AppShell({ user, help, children }: { user: ShellUser | null; help: ShellHelp; children: ReactNode }) {
  const t = useTranslations();
  const ts = useTranslations('shell');
  const tf = useTranslations('footer');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const sections = navSections(user ? { isAdmin: user.isAdmin } : null);
  const active = activeNavKey(pathname, sections);
  const closeMobile = () => setMobileOpen(false);

  const renderItem = (item: NavItem) => {
    const isActive = active === item.key;
    const count = item.badge === 'unread' ? (user?.unread ?? 0) : 0;
    const content = (
      <>
        <ListItemIcon sx={{ minWidth: 0, mr: 3, color: 'inherit' }}>
          <item.Icon aria-hidden size={20} />
        </ListItemIcon>
        <ListItemText primary={t(item.label)} primaryTypographyProps={{ fontWeight: 'inherit', color: 'inherit', fontSize: '0.9375rem', sx: { whiteSpace: 'normal' } }} />
        {item.soon && (
          <Box component="span" sx={(theme) => ({ ml: 1, px: 1.5, py: 0.25, borderRadius: 999, fontSize: '0.6875rem', fontWeight: 600, whiteSpace: 'nowrap', bgcolor: tok(theme).accent, color: tok(theme)['accent-fg'] })}>
            {t('home.soonBadge')}
          </Box>
        )}
        {count > 0 && (
          <Box component="span" sx={{ ml: 1, minWidth: 24, height: 22, px: 1.5, borderRadius: 999, display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
            {count > 99 ? '99+' : count}
            <span className="sr-only"> {t('nav.unreadSuffix')}</span>
          </Box>
        )}
      </>
    );
    const sx = (theme: Parameters<typeof tok>[0]) => {
      const c = tok(theme);
      return {
        borderRadius: '10px',
        minHeight: 44,
        py: 1,
        px: 3,
        color: item.soon ? c['nav-muted'] : isActive ? c['nav-active-fg'] : c['nav-text'],
        bgcolor: isActive ? c['nav-active-bg'] : 'transparent',
        fontWeight: isActive ? 600 : 500,
        transition: 'background-color 150ms ease-out',
        '&:hover': { bgcolor: isActive ? c['nav-active-bg'] : c['nav-hover'] },
        '&.Mui-focusVisible': { outline: `2px solid ${c['nav-text']}`, outlineOffset: -2 },
        '&.Mui-disabled': { opacity: 1 },
      };
    };
    return (
      <ListItem key={item.key} disablePadding sx={{ px: 3, mt: 0.5 }}>
        {item.soon ? (
          <ListItemButton disabled aria-disabled sx={sx}>
            {content}
          </ListItemButton>
        ) : (
          <ListItemButton component={Link} href={item.href} onClick={closeMobile} aria-current={isActive ? 'page' : undefined} sx={sx}>
            {content}
          </ListItemButton>
        )}
      </ListItem>
    );
  };

  const nav = (
    <Box sx={(theme) => ({ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tok(theme)['nav-bg'], color: tok(theme)['nav-text'] })}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 5, pt: 5, pb: 3, minHeight: 72 }}>
        <Logo onClick={closeMobile} size={48} onDark />
        <IconButton onClick={closeMobile} aria-label={ts('closeMenu')} sx={{ display: { lg: 'none' }, color: 'inherit' }}>
          <X aria-hidden size={20} />
        </IconButton>
      </Box>
      <Box component="nav" aria-label={t('nav.mainNav')} sx={{ flex: 1, overflowY: 'auto', pb: 4 }}>
        {sections.map((section) => (
          <List key={section.key} disablePadding sx={{ pt: section.title ? 0 : 1 }}>
            {section.title && (
              <ListItem sx={{ px: 6, pt: 5, pb: 1.5 }}>
                <Typography variant="overline" component="h2" sx={(theme) => ({ color: tok(theme)['nav-section'], lineHeight: 1.4 })}>
                  {t(section.title)}
                </Typography>
              </ListItem>
            )}
            {section.items.map(renderItem)}
          </List>
        ))}
      </Box>
      <HelpBox help={help} onNavigate={closeMobile} />
    </Box>
  );

  return (
    // Fond et couleur de texte posés ici (et pas seulement sur <body>) : après un
    // changement de thème sans rechargement, le style global du rendu serveur
    // restait prioritaire (page blanche en mode sombre, titres illisibles).
    <Box sx={{ display: 'flex', minHeight: '100dvh', bgcolor: 'background.default', color: 'text.primary' }}>
      <RouteProgress />
      {user && <IdleTimeout />}
      <a href="#contenu" className="sr-only">
        {ts('skipToContent')}
      </a>

      {/* Menu latéral : fixe sur grand écran… */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: NAV_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': (theme) => ({ width: NAV_WIDTH, boxSizing: 'border-box', borderRight: `1px solid ${tok(theme)['nav-border']}`, boxShadow: 'none', bgcolor: tok(theme)['nav-bg'] }),
        }}
      >
        {nav}
      </Drawer>
      {/* … tiroir sur mobile et tablette. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobile}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': (theme) => ({ width: NAV_WIDTH, maxWidth: '86vw', boxSizing: 'border-box', bgcolor: tok(theme)['nav-bg'], borderRight: 0 }) }}
      >
        {nav}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar user={user} onOpenNav={() => setMobileOpen(true)} />
        <Box component="main" id="contenu" tabIndex={-1} sx={{ flex: 1, outline: 'none' }}>
          <PageContainer>{children}</PageContainer>
        </Box>
        <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider' }}>
          <PageContainer dense>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', color: 'text.secondary', fontSize: '0.8125rem' }}>
              <span>
                {tf('tagline')} · {tf('location')}
              </span>
              <span>{tf('rights', { year: new Date().getFullYear() })}</span>
            </Box>
          </PageContainer>
        </Box>
      </Box>
    </Box>
  );
}

/** Conteneur de page unique : largeur max ~1200 px, marges 32 px (ordinateur) / 16 px (mobile). */
export function PageContainer({ children, dense = false }: { children: ReactNode; dense?: boolean }) {
  return <Box sx={{ width: '100%', maxWidth: 1264, mx: 'auto', px: { xs: 4, md: 8 }, py: dense ? 4 : { xs: 6, md: 8 } }}>{children}</Box>;
}

/** Encart « Besoin d'aide ? » en bas du menu latéral (remplace l'entrée Contact). */
function HelpBox({ help, onNavigate }: { help: ShellHelp; onNavigate: () => void }) {
  const t = useTranslations('nav.help');
  return (
    <Box sx={(theme) => ({ m: 3, p: 4, borderRadius: '12px', bgcolor: tok(theme)['nav-hover'] })}>
      <Typography variant="body2" component="p" sx={{ fontWeight: 700, color: 'inherit' }}>
        {t('title')}
      </Typography>
      <Typography variant="caption" component="p" sx={(theme) => ({ mt: 1, color: tok(theme)['nav-muted'] })}>
        {t('hours')}
      </Typography>
      <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
        {help.whatsappUrl && (
          <Box
            component="a"
            href={help.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            sx={(theme) => ({ display: 'inline-flex', alignItems: 'center', gap: 1, minHeight: 32, fontWeight: 600, fontSize: '0.875rem', color: tok(theme)['nav-link'], textDecoration: 'none', '&:hover': { textDecoration: 'underline' } })}
          >
            <MessageCircle aria-hidden size={16} />
            {t('whatsapp')}
          </Box>
        )}
        <Box
          component={Link}
          href="/contact"
          onClick={onNavigate}
          sx={(theme) => ({ display: 'inline-flex', minHeight: 32, alignItems: 'center', fontSize: '0.8125rem', color: tok(theme)['nav-text'], textDecoration: 'underline', textUnderlineOffset: 3 })}
        >
          {t('contactPage')}
        </Box>
      </Box>
    </Box>
  );
}

/**
 * Barre supérieure : pleine largeur, opaque, bordure basse. Sur ordinateur :
 * langue, thème, cloche, avatar. Sur mobile : cloche et avatar seulement
 * (langue et thème passent dans le menu de l'avatar).
 */
function TopBar({ user, onOpenNav }: { user: ShellUser | null; onOpenNav: () => void }) {
  const t = useTranslations('nav');
  const ts = useTranslations('shell');
  const tn = useTranslations('notifications');

  return (
    <Box
      component="header"
      sx={(theme) => ({
        position: 'sticky',
        top: 0,
        zIndex: theme.zIndex.appBar,
        bgcolor: 'background.paper',
        borderBottom: `1px solid ${theme.palette.divider}`,
      })}
    >
      <Box sx={{ minHeight: 64, display: 'flex', alignItems: 'center', gap: 1, px: { xs: 2, md: 8 }, maxWidth: 1264, mx: 'auto' }}>
        <IconButton color="inherit" onClick={onOpenNav} aria-label={ts('openMenu')} sx={{ display: { lg: 'none' } }}>
          <MenuIcon aria-hidden size={22} />
        </IconButton>
        <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center' }}>
          <Logo size={28} />
        </Box>

        <Box sx={{ flex: 1 }} />

        {/* Langue et thème : visibles sur ordinateur (et pour les visiteurs, sans menu avatar). */}
        <Box sx={{ display: user ? { xs: 'none', md: 'flex' } : 'flex', alignItems: 'center', gap: 1 }}>
          <LanguageMenu />
          <ThemeMenu />
        </Box>

        {user ? (
          <>
            <Tooltip title={t('notifications')}>
              <IconButton color="inherit" component={Link} href="/notifications" aria-label={tn('bellLabel', { count: user.unread })}>
                <Badge color="error" variant={user.unread > 0 ? 'dot' : 'standard'} invisible={user.unread === 0} overlap="circular">
                  <Bell aria-hidden size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
            <UserMenu user={user} />
          </>
        ) : (
          <>
            <Button component={Link} href="/auth/login" variant="text" size="small" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
              {t('login')}
            </Button>
            <Button component={Link} href="/auth/register" variant="contained" size="small">
              {t('register')}
            </Button>
          </>
        )}
      </Box>
    </Box>
  );
}

function initials(u: ShellUser) {
  return `${u.firstName.charAt(0)}${u.lastName.charAt(0)}`.toUpperCase() || 'U';
}

/** Menu du compte (avatar) : espace, profil, administration, langue, thème, déconnexion. */
function UserMenu({ user }: { user: ShellUser }) {
  const t = useTranslations('nav');
  const ts = useTranslations('shell');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { mode, setPref } = useThemeMode();
  const [pendingLocale, startTransition] = useTransition();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);
  const dark = mode === 'dark';

  const avatar = (size: number) => (
    <Avatar sx={{ width: size, height: size, bgcolor: 'text.primary', color: 'background.paper', fontSize: size / 2.6, fontWeight: 600 }}>{initials(user)}</Avatar>
  );

  return (
    <>
      <Button
        onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)}
        aria-label={ts('userMenu')}
        aria-haspopup="menu"
        color="inherit"
        sx={{ ml: 1, gap: 2, px: 1.5, minWidth: 0, color: 'text.primary' }}
      >
        {avatar(36)}
        <Box component="span" sx={{ display: { xs: 'none', md: 'inline' }, fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.firstName}
        </Box>
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        sx={{ '& .MuiMenu-paper': { width: 260, mt: 1 } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 4, py: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
          {avatar(40)}
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600 }} noWrap>
              {user.firstName} {user.lastName}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }} noWrap>
              {user.ambassadorCode ?? user.email}
            </Typography>
          </Box>
        </Box>
        <Divider sx={{ my: 1 }} />
        <MenuItem component={Link} href="/dashboard" onClick={close}>
          <ListItemIcon>
            <LayoutGrid aria-hidden size={18} />
          </ListItemIcon>
          {t('overview')}
        </MenuItem>
        <MenuItem component={Link} href="/profile" onClick={close}>
          <ListItemIcon>
            <UserRound aria-hidden size={18} />
          </ListItemIcon>
          {t('profileSecurity')}
        </MenuItem>
        {user.isAdmin && (
          <MenuItem component={Link} href="/admin" onClick={close}>
            <ListItemIcon>
              <Shield aria-hidden size={18} />
            </ListItemIcon>
            {t('admin')}
          </MenuItem>
        )}
        <Divider sx={{ my: 1 }} />
        {/* Langue et thème (seul accès sur mobile). */}
        <MenuItem
          disabled={pendingLocale}
          onClick={() => {
            close();
            startTransition(() => setLocale(locale === 'en' ? 'fr' : 'en'));
          }}
          lang={locale === 'en' ? 'fr' : 'en'}
        >
          <ListItemIcon>
            <Languages aria-hidden size={18} />
          </ListItemIcon>
          {locale === 'en' ? tc('french') : tc('english')}
        </MenuItem>
        <MenuItem onClick={() => setPref(dark ? 'light' : 'dark')}>
          <ListItemIcon>{dark ? <Sun aria-hidden size={18} /> : <Moon aria-hidden size={18} />}</ListItemIcon>
          {dark ? tc('switchToLight') : tc('switchToDark')}
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <Box component="form" action={logout} onSubmit={broadcastLogout}>
          <MenuItem component="button" type="submit" sx={{ width: '100%', color: 'error.main' }}>
            <ListItemIcon sx={{ color: 'inherit' }}>
              <LogOut aria-hidden size={18} />
            </ListItemIcon>
            {t('logout')}
          </MenuItem>
        </Box>
      </Menu>
    </>
  );
}
