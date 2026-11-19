'use client';

import type { ReactNode } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  BriefcaseBusiness,
  CalendarCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Coins,
  Hourglass,
  Inbox,
  ListChecks,
  Lock,
  Megaphone,
  Shield,
  Target,
  Users,
  Wallet,
} from 'lucide-react';
import { tok } from '@/@core/theme/tokens';

export type StatTone = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent';

// Liste explicite : seules ces icônes sont incluses dans le code envoyé au navigateur.
const ICONS = { Users, Shield, Clock, AlertTriangle, Wallet, CheckCircle2, Inbox, Megaphone, Coins, BadgeCheck, Hourglass, ListChecks, Target, ClipboardCheck, Award, Lock, CalendarCheck, BriefcaseBusiness };
type IconName = keyof typeof ICONS;

/**
 * Carte de statistique « horizontale » de Sneat (CardStatsHorizontal) :
 * icône dans un avatar teinté + valeur + libellé.
 * L'icône est désignée par son nom pour rester utilisable depuis une page serveur.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  highlight = false,
  footer,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  tone?: StatTone;
  /** Valeur mise en évidence (ex. échecs > 0 en rouge). */
  highlight?: boolean;
  footer?: ReactNode;
}) {
  const Icon = ICONS[icon];
  const fgKey = tone === 'accent' ? 'accent-fg' : tone;
  const bgKey = tone === 'accent' ? 'accent' : (`${tone}-soft` as const);
  return (
    <Card
      sx={(theme) => {
        const c = tok(theme);
        const soft = tone === 'accent' ? c['accent-soft'] : c[`${tone}-soft`];
        return {
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid ${c.border}`,
          // Dégradé vers la teinte de la carte, comme la maquette.
          background: `linear-gradient(120deg, ${c.bg} 45%, ${soft} 100%)`,
          '&::after': {
            content: '""',
            position: 'absolute',
            right: -40,
            bottom: -60,
            width: 200,
            height: 120,
            borderRadius: '50%',
            bgcolor: soft,
            opacity: 0.9,
            pointerEvents: 'none',
          },
        };
      }}
    >
      <CardContent sx={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
        <Avatar variant="rounded" sx={(theme) => ({ width: 52, height: 52, borderRadius: 2, bgcolor: tok(theme)[bgKey], color: tok(theme)[fgKey] })}>
          <Icon aria-hidden size={26} />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600 }}>
            {label}
          </Typography>
          <Typography variant="h4" component="p" sx={{ fontWeight: 700, lineHeight: 1.2, ...(highlight && { color: 'error.main' }) }}>
            {value}
          </Typography>
          {footer}
        </Box>
      </CardContent>
    </Card>
  );
}
