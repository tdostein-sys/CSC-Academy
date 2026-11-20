import {
  Bell,
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  Inbox,
  LayoutGrid,
  LineChart,
  Megaphone,
  MessageCircle,
  Send,
  Shield,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

/**
 * SOURCE UNIQUE du menu : utilisée par le menu latéral, le tiroir mobile et
 * (Lot 3) la barre basse mobile. Les libellés sont des clés de traduction.
 */
export interface NavItem {
  key: string;
  href: string;
  /** Clé de traduction (namespace « nav » sauf mention contraire). */
  label: string;
  Icon: LucideIcon;
  /** Préfixes d'URL pour lesquels l'entrée reste active (sous-pages du module). */
  match: string[];
  exact?: boolean;
  /** Entrée visible mais désactivée, badge or « Bientôt ». */
  soon?: boolean;
  /** Compteur affiché à droite (notifications non lues). */
  badge?: 'unread';
}

export interface NavSection {
  key: string;
  /** Clé de traduction du titre de groupe (absent = pas de titre). */
  title?: string;
  items: NavItem[];
}

export interface NavUser {
  isAdmin: boolean;
}

const ACTIVITIES: NavItem[] = [
  { key: 'academy', href: '/academy', label: 'nav.academy', Icon: GraduationCap, match: ['/academy', '/student'] },
  { key: 'ambassador', href: '/ambassador', label: 'nav.ambassador', Icon: Megaphone, match: ['/ambassador'] },
  { key: 'consulting', href: '/consulting', label: 'nav.consulting', Icon: LineChart, match: ['/consulting'] },
  { key: 'ga', href: '/ga', label: 'nav.ga', Icon: Wallet, match: ['/ga'], soon: true },
];

const ADMIN: NavItem[] = [
  { key: 'admin-dashboard', href: '/admin/dashboard', label: 'admin.nav.dashboard', Icon: TrendingUp, match: ['/admin/dashboard'] },
  { key: 'admin', href: '/admin', label: 'admin.nav.overview', Icon: Shield, match: ['/admin'], exact: true },
  { key: 'admin-ambassador', href: '/admin/ambassador', label: 'admin.nav.ambassador', Icon: Megaphone, match: ['/admin/ambassador'] },
  { key: 'admin-academy', href: '/admin/academy', label: 'admin.nav.academy', Icon: GraduationCap, match: ['/admin/academy'] },
  { key: 'admin-consulting', href: '/admin/consulting', label: 'admin.nav.consulting', Icon: BarChart3, match: ['/admin/consulting'] },
  { key: 'admin-contact', href: '/admin/contact', label: 'admin.nav.contact', Icon: Inbox, match: ['/admin/contact'] },
  { key: 'admin-users', href: '/admin/users', label: 'admin.nav.users', Icon: Users, match: ['/admin/users'] },
  { key: 'admin-content', href: '/admin/content', label: 'admin.nav.content', Icon: FileText, match: ['/admin/content'] },
  { key: 'admin-deliveries', href: '/admin/deliveries', label: 'admin.nav.deliveries', Icon: Send, match: ['/admin/deliveries'] },
  { key: 'admin-audit', href: '/admin/audit', label: 'admin.nav.audit', Icon: ClipboardList, match: ['/admin/audit'] },
];

/**
 * Menu de l'espace membre : 7 entrées en 3 groupes (+ Administration pour
 * les administrateurs). Visiteur non connecté : accueil, activités, contact.
 */
export function navSections(user: NavUser | null): NavSection[] {
  if (!user) {
    return [
      { key: 'main', items: [{ key: 'home', href: '/', label: 'nav.home', Icon: Home, match: ['/'], exact: true }] },
      { key: 'activities', title: 'nav.ourActivities', items: ACTIVITIES },
      { key: 'help', items: [{ key: 'contact', href: '/contact', label: 'nav.contact', Icon: MessageCircle, match: ['/contact'] }] },
    ];
  }
  return [
    { key: 'main', items: [{ key: 'overview', href: '/dashboard', label: 'nav.overview', Icon: LayoutGrid, match: ['/dashboard'] }] },
    { key: 'activities', title: 'nav.myActivities', items: ACTIVITIES },
    {
      key: 'account',
      title: 'nav.account',
      items: [
        { key: 'notifications', href: '/notifications', label: 'nav.notifications', Icon: Bell, match: ['/notifications'], badge: 'unread' },
        { key: 'profile', href: '/profile', label: 'nav.profileSecurity', Icon: UserRound, match: ['/profile', '/auth/change-password'] },
      ],
    },
    ...(user.isAdmin ? [{ key: 'admin', title: 'nav.admin', items: ADMIN }] : []),
  ];
}

/** L'entrée est-elle active pour cette adresse (module et toutes ses sous-pages) ? */
export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** L'entrée la plus précise qui correspond à l'adresse (une seule active à la fois). */
export function activeNavKey(pathname: string, sections: NavSection[]): string | null {
  let best: { key: string; len: number } | null = null;
  for (const s of sections) {
    for (const it of s.items) {
      if (!isNavActive(pathname, it)) continue;
      const len = Math.max(...it.match.filter((m) => pathname === m || pathname.startsWith(`${m}/`) || it.exact).map((m) => m.length), it.href.length);
      if (!best || len > best.len) best = { key: it.key, len };
    }
  }
  return best?.key ?? null;
}

/** Onglets internes des modules (adresses existantes, aucune nouvelle). */
export const MODULE_TABS = {
  academy: [
    { href: '/academy', label: 'nav.tabs.catalogue' },
    { href: '/student', label: 'nav.tabs.myCourses' },
  ],
  consulting: [
    { href: '/consulting', label: 'nav.tabs.offers' },
    { href: '/consulting/bookings', label: 'nav.tabs.myAppointments' },
  ],
  consultingStaff: { href: '/consulting/manage', label: 'nav.tabs.consultations' },
} as const;
