'use client';

import Avatar from '@mui/material/Avatar';
import { BarChart3, Bell, Briefcase, GraduationCap, Megaphone, Shield, User } from 'lucide-react';
import { tok } from '@/@core/theme/tokens';

const ICONS = {
  ambassador: Megaphone,
  academy: GraduationCap,
  consulting: BarChart3,
  ga: Briefcase,
  notifications: Bell,
  profile: User,
  admin: Shield,
};

export type ModuleKey = keyof typeof ICONS;

/** Icône dans un avatar teinté (style Sneat), désignée par nom (utilisable depuis le serveur). */
export function ModuleIcon({ module, accent = false }: { module: ModuleKey; accent?: boolean }) {
  const Icon = ICONS[module];
  return (
    <Avatar
      variant="rounded"
      sx={(theme) => ({
        width: 48,
        height: 48,
        flexShrink: 0,
        bgcolor: tok(theme)[accent ? 'accent' : 'primary-soft'],
        color: tok(theme)[accent ? 'accent-fg' : 'primary'],
      })}
    >
      <Icon aria-hidden size={24} />
    </Avatar>
  );
}
