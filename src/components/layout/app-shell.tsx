'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { alpha, type Theme } from '@mui/material/styles';
import {
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  Send,
  Shield,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { logout } from '@/app/auth/actions';
import { Logo } from '@/components/logo';
import { tok } from '@/@core/theme/tokens';
import { LanguageMenu, ThemeMenu } from './preferences';

export const NAV_WIDTH = 260;

/** Fond bleu nuit du menu latéral (dans les deux thèmes). */
const tokNavBg = (theme: Theme) => tok(theme)['nav-bg'];

/** Informations (sérialisables) sur l'utilisateur connecté, fournies par le serveur. */
export interface ShellUser {
  firstName: string;
  lastName: string;
  email: string;
  isAdmin: boolean;
  ambassadorCode: string | null;
  unread: number;
}

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
  exact?: boolean;
  badge?: number;
  soon?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/**
 * Mise en page « verticale » du template Sneat : menu latéral (fixe sur grand
 * écran, escamotable sur mobile), barre supérieure floutée, pied de page.
 */
export function AppShell({ user, children }: { user: ShellUser | null; children: ReactNode }) {
  const t = useTranslations('nav');
  const ts = useTranslations('shell');
  const th = useTranslations('home');
  const ta = useTranslations('admin.nav');
  const tf = useTranslations('footer');
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const sections: NavSection[] = [
    {
      items: [
        { href: '/', label: t('home'), Icon: Home, exact: true },
        ...(user ? [{ href: '/dashboard', label: t('dashboard'), Icon: LayoutDashboard }] : []),
      ],
    },
    {
      title: ts('modules'),
      items: [
        { href: '/ambassador', label: t('ambassador'), Icon: Megaphone },
        { href: '/academy', label: t('academy'), Icon: GraduationCap },
        { href: '/consulting', label: t('consulting'), Icon: BarChart3, soon: true },
        { href: '/ga', label: t('ga'), Icon: Briefcase, soon: true },
      ],
    },
    ...(user
      ? [
          {
            title: ts('account'),
            items: [
              { href: '/student', label: t('student'), Icon: BookOpen },
              { href: '/notifications', label: t('notifications'), Icon: Bell, badge: user.unread },
              { href: '/profile', label: t('profile'), Icon: User },
            ],
          },
        ]
      : []),
    ...(user?.isAdmin
      ? [
          {
            title: t('admin'),
            items: [
              { href: '/admin', label: ta('overview'), Icon: Shield, exact: true },
              { href: '/admin/ambassador', label: ta('ambassador'), Icon: Megaphone },
              { href: '/admin/academy', label: ta('academy'), Icon: GraduationCap },
              { href: '/admin/users', label: ta('users'), Icon: Users },
              { href: '/admin/content', label: ta('content'), Icon: FileText },
              { href: '/admin/deliveries', label: ta('deliveries'), Icon: Send },
              { href: '/admin/audit', label: ta('audit'), Icon: ClipboardList },
            ],
          },
        ]
      : []),
  ];

  const closeMobile = () => setMobileOpen(false);

  const nav = (
    <Box sx={(theme) => ({ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: tok(theme)['nav-bg'], color: tok(theme)['nav-text'] })}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 5, pt: 4, pb: 2, minHeight: 64 }}>
        <Logo onClick={closeMobile} size={52} onDark />
        <IconButton onClick={closeMobile} aria-label={ts('closeMenu')} sx={{ display: { lg: 'none' }, color: 'inherit' }}>
          <X aria-hidden size={20} />
        </IconButton>
      </Box>
      <Box component="nav" aria-label={t('mainNav')} sx={{ flex: 1, overflowY: 'auto', pb: 4 }}>
        {sections.map((section, i) => (
          <List key={i} disablePadding sx={{ pt: section.title ? 0 : 1 }}>
            {section.title && (
              <ListItem sx={{ px: 6, pt: 4, pb: 1.5 }}>
                <Typography variant="caption" sx={(theme) => ({ color: tok(theme)['nav-muted'], textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 })}>
                  {section.title}
                </Typography>
              </ListItem>
            )}
            {section.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <ListItem key={item.href} disablePadding sx={{ px: 3, mt: 0.5 }}>
                  <ListItemButton
                    component={Link}
                    href={item.href}
                    onClick={closeMobile}
                    aria-current={active ? 'page' : undefined}
                    sx={(theme) => {
                      const c = tok(theme);
                      return {
                        borderRadius: 1.5,
                        py: 1.25,
                        px: 3,
                        color: active ? c['nav-active-fg'] : c['nav-text'],
                        background: active ? `linear-gradient(90deg, ${c['nav-active-from']}, ${c['nav-active-to']})` : 'transparent',
                        boxShadow: active ? '0 4px 14px rgba(29,95,214,.45)' : 'none',
                        fontWeight: active ? 600 : 400,
                        '&:hover': { bgcolor: active ? undefined : c['nav-hover'] },
                        '&.Mui-focusVisible': { outline: `2px solid ${c['nav-text']}`, outlineOffset: -2 },
                      };
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 0, mr: 2.5, color: 'inherit' }}>
                      <item.Icon aria-hidden size={20} />
                    </ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ noWrap: true, fontWeight: 'inherit', color: 'inherit' }} />
                    {item.soon && <Chip label={th('soonBadge')} size="small" sx={(theme) => ({ height: 20, fontSize: '0.7rem', bgcolor: tok(theme)['accent-soft'], color: tok(theme).text })} />}
                    {Boolean(item.badge) && <Chip label={item.badge! > 99 ? '99+' : item.badge} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        ))}
      </Box>
      {user && (
        <Box sx={(theme) => ({ m: 3, p: 3, display: 'flex', alignItems: 'center', gap: 3, borderRadius: 2, bgcolor: tok(theme)['nav-hover'] })}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: '0.875rem', fontWeight: 600 }}>{initials(user)}</Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'inherit' }}>
              {user.firstName} {user.lastName}
            </Typography>
            <Typography variant="caption" noWrap component="p" sx={(theme) => ({ color: tok(theme)['nav-muted'] })}>
              {user.isAdmin ? t('admin') : (user.ambassadorCode ?? user.email)}
            </Typography>
          </Box>
          <Box component="form" action={logout}>
            <Tooltip title={t('logout')}>
              <IconButton type="submit" aria-label={t('logout')} sx={{ color: 'inherit' }}>
                <LogOut aria-hidden size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100dvh' }}>
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
          '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box', borderRight: 0, boxShadow: 2, bgcolor: tokNavBg },
        }}
      >
        {nav}
      </Drawer>
      {/* … escamotable sur mobile et tablette. */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={closeMobile}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', lg: 'none' }, '& .MuiDrawer-paper': { width: NAV_WIDTH, boxSizing: 'border-box', bgcolor: tokNavBg } }}
      >
        {nav}
      </Drawer>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar user={user} onOpenNav={() => setMobileOpen(true)} />
        <Box component="main" id="contenu" tabIndex={-1} sx={{ flex: 1, width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 4, sm: 6 }, py: 6, outline: 'none' }}>
          {children}
        </Box>
        <Box component="footer" sx={{ width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 4, sm: 6 }, py: 4 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', color: 'text.secondary', fontSize: '0.875rem' }}>
            <span>
              {tf('tagline')} · {tf('location')}
            </span>
            <span>{tf('rights', { year: new Date().getFullYear() })}</span>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function TopBar({ user, onOpenNav }: { user: ShellUser | null; onOpenNav: () => void }) {
  const t = useTranslations('nav');
  const ts = useTranslations('shell');
  const tn = useTranslations('notifications');

  return (
    <Box component="header" sx={{ position: 'sticky', top: 0, zIndex: (theme) => theme.zIndex.appBar, px: { xs: 4, sm: 6 }, width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <Box
        sx={(theme) => ({
          mt: { xs: 0, sm: 3 },
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: { xs: 2, sm: 4 },
          borderRadius: { xs: '0 0 6px 6px', sm: 1 },
          bgcolor: alpha(theme.palette.background.paper, 0.9),
          backdropFilter: 'blur(6px)',
          boxShadow: theme.shadows[3],
          color: 'text.primary',
        })}
      >
        <IconButton color="inherit" onClick={onOpenNav} aria-label={ts('openMenu')} sx={{ display: { lg: 'none' }, ml: -1 }}>
          <MenuIcon aria-hidden size={22} />
        </IconButton>
        <Box sx={{ display: { xs: 'flex', lg: 'none' }, alignItems: 'center' }}>
          <Logo size={26} />
        </Box>

        <Box sx={{ flex: 1 }} />

        <LanguageMenu />
        <ThemeMenu />

        {user ? (
          <>
            <Tooltip title={t('notifications')}>
              <IconButton color="inherit" component={Link} href="/notifications" aria-label={tn('bellLabel', { count: user.unread })}>
                <Badge color="error" badgeContent={user.unread} max={99}>
                  <Bell aria-hidden size={20} />
                </Badge>
              </IconButton>
            </Tooltip>
            <Button component={Link} href="/dashboard" variant="text" startIcon={<LayoutDashboard aria-hidden size={18} />} sx={{ display: { xs: 'none', md: 'inline-flex' } }}>
              {t('dashboard')}
            </Button>
            <UserMenu user={user} />
          </>
        ) : (
          <>
            <Button component={Link} href="/auth/login" variant="text" sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
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

/** Menu utilisateur (avatar) inspiré du « UserDropdown » de Sneat. */
function UserMenu({ user }: { user: ShellUser }) {
  const t = useTranslations('nav');
  const ts = useTranslations('shell');
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  const avatar = (size: number) => (
    <Badge overlap="circular" variant="dot" color="success" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
      <Avatar sx={{ width: size, height: size, bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: size / 2.6, fontWeight: 600 }}>{initials(user)}</Avatar>
    </Badge>
  );

  return (
    <>
      <IconButton onClick={(e: MouseEvent<HTMLElement>) => setAnchor(e.currentTarget)} aria-label={ts('userMenu')} aria-haspopup="menu" sx={{ ml: 1 }}>
        {avatar(38)}
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={close}
        sx={{ '& .MuiMenu-paper': { width: 240, mt: 1 } }}
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
            <LayoutDashboard aria-hidden size={18} />
          </ListItemIcon>
          {t('dashboard')}
        </MenuItem>
        <MenuItem component={Link} href="/profile" onClick={close}>
          <ListItemIcon>
            <User aria-hidden size={18} />
          </ListItemIcon>
          {t('profile')}
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
        <Box component="form" action={logout}>
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
